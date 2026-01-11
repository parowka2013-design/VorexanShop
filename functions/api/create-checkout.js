import Stripe from 'stripe';

/**
 * Specjalizowany endpoint do tworzenia sesji Checkout Stripe
 * POST /api/create-checkout
 */

// Stałe konfiguracyjne
const DEFAULT_CONFIG = {
  currency: 'pln',
  locale: 'pl',
  paymentMethods: ['card', 'blik', 'p24'],
  shippingOptions: [
    {
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: { amount: 0, currency: 'pln' },
        display_name: 'Darmowa dostawa',
        delivery_estimate: {
          minimum: { unit: 'business_day', value: 5 },
          maximum: { unit: 'business_day', value: 7 }
        }
      }
    },
    {
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: { amount: 1990, currency: 'pln' },
        display_name: 'Kurier 24h',
        delivery_estimate: {
          minimum: { unit: 'business_day', value: 1 },
          maximum: { unit: 'business_day', value: 2 }
        }
      }
    }
  ],
  expiresIn: 3600, // 1 godzina w sekundach
  taxRates: {
    pl: 'txr_pl_standard', // ID stawki VAT w Stripe (23% VAT)
    eu: 'txr_eu_reduced'   // Obniżona stawka dla EU
  }
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Version',
};

// Walidacja produktów
const validateProducts = (products) => {
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('Products array is required and cannot be empty');
  }

  return products.map((product, index) => {
    // Walidacja podstawowych pól
    if (!product.name || typeof product.name !== 'string') {
      throw new Error(`Product ${index}: name is required and must be a string`);
    }

    if (!product.price || typeof product.price !== 'number' || product.price <= 0) {
      throw new Error(`Product ${index}: price must be a positive number`);
    }

    // Konwersja ceny do groszy
    const amount = Math.round(product.price * 100);
    
    // Sprawdź czy cena ma co najmniej 1 grosz
    if (amount < 1) {
      throw new Error(`Product ${index}: price must be at least 0.01 ${DEFAULT_CONFIG.currency}`);
    }

    // Sprawdź maksymalną cenę (1,000,000 zł)
    if (amount > 100000000) {
      throw new Error(`Product ${index}: price cannot exceed 1,000,000 ${DEFAULT_CONFIG.currency}`);
    }

    // Walidacja ilości
    const quantity = Math.max(1, Math.min(product.quantity || 1, 9999));
    
    // Walidacja opisu
    const description = product.description || '';
    if (description.length > 500) {
      throw new Error(`Product ${index}: description cannot exceed 500 characters`);
    }

    // Walidacja obrazków
    const images = Array.isArray(product.images) ? product.images.slice(0, 8) : [];
    images.forEach((img, imgIndex) => {
      try {
        new URL(img);
      } catch {
        throw new Error(`Product ${index}, image ${imgIndex}: must be a valid URL`);
      }
    });

    return {
      price_data: {
        currency: product.currency || DEFAULT_CONFIG.currency,
        product_data: {
          name: product.name.trim(),
          description: description.trim(),
          images: images,
          metadata: {
            sku: product.sku || `SKU-${Date.now()}-${index}`,
            category: product.category || 'general',
            ...product.metadata
          }
        },
        unit_amount: amount,
        tax_behavior: product.tax_behavior || 'exclusive',
      },
      quantity: quantity,
      adjustable_quantity: product.adjustable_quantity ? {
        enabled: true,
        minimum: Math.max(1, product.adjustable_quantity.minimum || 1),
        maximum: Math.min(999, product.adjustable_quantity.maximum || 999)
      } : undefined,
      tax_rates: product.tax_exempt ? [] : [DEFAULT_CONFIG.taxRates.pl]
    };
  });
};

// Obsługa preflight CORS
export async function onRequestOptions(context) {
  return new Response(null, {
    headers: corsHeaders,
    status: 204
  });
}

// Główna funkcja dla POST
export async function onRequestPost(context) {
  const { request, env } = context;
  
  // Start timer dla monitorowania wydajności
  const startTime = Date.now();
  
  try {
    // Sprawdź Content-Type
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return jsonResponse(
        { error: 'Content-Type must be application/json' },
        415
      );
    }

    // Sprawdź rozmiar requesta
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 1024 * 100) { // 100KB max
      return jsonResponse(
        { error: 'Request payload too large. Maximum size is 100KB.' },
        413
      );
    }

    // Parse request body
    const requestBody = await request.json();
    
    // Walidacja podstawowych pól
    if (!requestBody.products) {
      return jsonResponse(
        { error: 'Missing required field: products' },
        400
      );
    }

    // Waliduj i przygotuj produkty
    const lineItems = validateProducts(requestBody.products);
    
    // Oblicz całkowitą kwotę (do logowania)
    const totalAmount = lineItems.reduce((sum, item) => {
      return sum + (item.price_data.unit_amount * item.quantity);
    }, 0);

    // Inicjalizuj Stripe
    const stripe = new Stripe(env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY_TEST);
    const isTestMode = !env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY.includes('_test_');
    
    // Przygotuj konfigurację sesji
    const sessionConfig = {
      payment_method_types: requestBody.payment_method_types || DEFAULT_CONFIG.paymentMethods,
      line_items: lineItems,
      mode: requestBody.mode || 'payment',
      success_url: requestBody.success_url || 
        `${getBaseUrl(request)}/success?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: requestBody.cancel_url || 
        `${getBaseUrl(request)}/cart?canceled=true&session_id={CHECKOUT_SESSION_ID}`,
      customer_email: validateEmail(requestBody.customer_email),
      client_reference_id: requestBody.client_reference_id || 
        `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      locale: validateLocale(requestBody.locale || DEFAULT_CONFIG.locale),
      allow_promotion_codes: requestBody.allow_promotion_codes ?? true,
      billing_address_collection: requestBody.billing_address_collection || 'auto',
      shipping_address_collection: requestBody.shipping_address_collection ? {
        allowed_countries: Array.isArray(requestBody.shipping_address_collection.allowed_countries) 
          ? requestBody.shipping_address_collection.allowed_countries.slice(0, 10)
          : ['PL', 'US', 'GB', 'DE', 'FR']
      } : undefined,
      shipping_options: requestBody.shipping_options || DEFAULT_CONFIG.shippingOptions,
      phone_number_collection: {
        enabled: requestBody.phone_number_collection ?? true
      },
      custom_text: {
        submit: {
          message: requestBody.custom_text?.submit_message || 
            "Dziękujemy za zamówienie! Potwierdzenie wyślemy na Twój adres email."
        },
        shipping_address: {
          message: requestBody.custom_text?.shipping_message ||
            "Wprowadź adres dostawy. Darmowa dostawa dla zamówień powyżej 200 zł."
        }
      },
      metadata: {
        // Systemowe metadata
        source: 'cloudflare_pages_api',
        environment: isTestMode ? 'test' : 'production',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        user_agent: request.headers.get('user-agent')?.substring(0, 200),
        client_ip: request.headers.get('cf-connecting-ip'),
        total_amount: totalAmount,
        item_count: lineItems.length,
        // Metadata użytkownika
        ...requestBody.metadata
      },
      expires_at: Math.floor(Date.now() / 1000) + 
        (requestBody.expires_in || DEFAULT_CONFIG.expiresIn),
      consent_collection: {
        terms_of_service: requestBody.consent?.terms_of_service || 'required',
        promotions: requestBody.consent?.promotions || 'auto'
      },
      invoice_creation: requestBody.invoice_creation ? {
        enabled: true,
        invoice_data: {
          description: requestBody.invoice_description,
          footer: requestBody.invoice_footer || "Dziękujemy za zakupy w naszym sklepie!",
          metadata: requestBody.invoice_metadata,
          custom_fields: requestBody.invoice_custom_fields?.slice(0, 2) // Max 2 pola
        }
      } : undefined,
      payment_intent_data: requestBody.payment_intent_data ? {
        description: requestBody.payment_intent_data.description,
        metadata: requestBody.payment_intent_data.metadata,
        setup_future_usage: requestBody.payment_intent_data.setup_future_usage,
        capture_method: requestBody.payment_intent_data.capture_method || 'automatic'
      } : undefined,
      tax_id_collection: {
        enabled: requestBody.tax_id_collection ?? false
      },
      after_expiration: {
        recovery: {
          enabled: true,
          allow_promotion_codes: true
        }
      },
      // Dla subskrypcji
      subscription_data: requestBody.subscription_data ? {
        trial_period_days: requestBody.subscription_data.trial_period_days,
        metadata: requestBody.subscription_data.metadata,
        description: requestBody.subscription_data.description
      } : undefined
    };

    // Dodaj automatyczne taxy dla Polski jeśli nie określono inaczej
    if (!requestBody.tax_exempt && !requestBody.tax_id_collection) {
      sessionConfig.automatic_tax = { enabled: true };
    }

    // Utwórz sesję w Stripe
    const session = await stripe.checkout.sessions.create(sessionConfig);
    
    // Czas wykonania
    const executionTime = Date.now() - startTime;
    
    // Przygotuj odpowiedź
    const responseData = {
      success: true,
      session: {
        id: session.id,
        url: session.url,
        expires_at: new Date(session.expires_at * 1000).toISOString(),
        status: session.status,
        payment_status: session.payment_status
      },
      order: {
        amount_total: session.amount_total / 100,
        currency: session.currency.toUpperCase(),
        client_reference_id: session.client_reference_id,
        items: lineItems.map(item => ({
          name: item.price_data.product_data.name,
          quantity: item.quantity,
          unit_price: item.price_data.unit_amount / 100,
          total: (item.price_data.unit_amount * item.quantity) / 100
        }))
      },
      integration: {
        publishable_key: env.STRIPE_PUBLIC_KEY || env.STRIPE_PUBLIC_KEY_TEST,
        mode: isTestMode ? 'test' : 'live',
        frontend_implementation: getFrontendImplementationHint()
      },
      _meta: {
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString()
      }
    };

    // Dodaj client_secret jeśli dostępne (dla Payment Intents)
    if (session.payment_intent?.client_secret) {
      responseData.session.client_secret = session.payment_intent.client_secret;
    }

    // Dodaj customer ID jeśli dostępne
    if (session.customer) {
      responseData.customer = {
        id: session.customer,
        email: session.customer_email
      };
    }

    // Logowanie (tylko w trybie development)
    if (env.ENVIRONMENT === 'development') {
      console.log('Checkout session created:', {
        sessionId: session.id,
        amount: session.amount_total,
        email: session.customer_email,
        products: lineItems.length,
        executionTime
      });
    }

    return jsonResponse(responseData, 201);

  } catch (error) {
    console.error('Create checkout error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: request.url,
      method: request.method
    });

    // Przyjazne komunikaty błędów
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    let errorDetails = null;

    if (error.message.includes('required') || error.message.includes('must be')) {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.type === 'StripeInvalidRequestError') {
      statusCode = 400;
      errorMessage = 'Invalid request to payment processor';
      errorDetails = env.ENVIRONMENT === 'development' ? error.message : undefined;
    } else if (error.type === 'StripeCardError') {
      statusCode = 402;
      errorMessage = 'Payment method was declined';
    } else if (error.type === 'StripeRateLimitError') {
      statusCode = 429;
      errorMessage = 'Too many requests. Please try again later.';
    } else if (error.code === 'validation_error') {
      statusCode = 422;
      errorMessage = 'Validation failed';
      errorDetails = error.details;
    }

    return jsonResponse({
      success: false,
      error: errorMessage,
      details: errorDetails,
      code: error.type || error.code,
      timestamp: new Date().toISOString()
    }, statusCode);
  }
}

// Helper functions
function getBaseUrl(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function validateEmail(email) {
  if (!email) return undefined;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email address format');
  }
  
  return email;
}

function validateLocale(locale) {
  const supportedLocales = ['pl', 'en', 'de', 'fr', 'es', 'it'];
  return supportedLocales.includes(locale.toLowerCase()) ? locale : DEFAULT_CONFIG.locale;
}

function getFrontendImplementationHint() {
  return {
    stripe_js: "Use Stripe.js with publishable key",
    checkout_button: "Redirect user to session.url",
    embedded: "Use Stripe Embedded Checkout with session.id",
    react: "Use @stripe/react-stripe-js with session.client_secret"
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders,
      'X-Content-Type-Options': 'nosniff',
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '99'
    }
  });
}

// Export dla wszystkich metod HTTP
export async function onRequest(context) {
  const { request } = context;
  
  switch (request.method) {
    case 'POST':
      return onRequestPost(context);
    case 'OPTIONS':
      return onRequestOptions(context);
    default:
      return jsonResponse(
        { 
          error: 'Method not allowed',
          allowed_methods: ['POST', 'OPTIONS'],
          documentation: 'https://docs.your-site.com/api/create-checkout'
        },
        405
      );
  }
}
