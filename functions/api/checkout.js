import Stripe from 'stripe';

// Stałe konfiguracyjne
const CURRENCY = 'pln'; // Domyślna waluta
const SHIPPING_OPTIONS = [
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: {
        amount: 0,
        currency: CURRENCY,
      },
      display_name: 'Darmowa dostawa',
      delivery_estimate: {
        minimum: {
          unit: 'business_day',
          value: 5,
        },
        maximum: {
          unit: 'business_day',
          value: 7,
        },
      },
    },
  },
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: {
        amount: 1990, // 19.90 PLN
        currency: CURRENCY,
      },
      display_name: 'Ekspresowa dostawa',
      delivery_estimate: {
        minimum: {
          unit: 'business_day',
          value: 1,
        },
        maximum: {
          unit: 'business_day',
          value: 2,
        },
      },
    },
  },
];

// Nagłówki CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

/**
 * Główna funkcja obsługująca endpoint /checkout
 */
export async function onRequest(context) {
  const { request, env } = context;
  
  // Obsługa preflight CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204
    });
  }
  
  try {
    // Inicjalizacja Stripe
    const stripe = new Stripe(env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY_TEST);
    
    // Routing w zależności od metody HTTP
    switch (request.method) {
      case 'GET':
        return await handleGetCheckout(request, stripe);
        
      case 'POST':
        return await handlePostCheckout(request, stripe, env);
        
      case 'PUT':
        return await handlePutCheckout(request, stripe);
        
      default:
        return jsonResponse(
          { error: 'Method not allowed. Use GET, POST, or PUT.' },
          405,
          corsHeaders
        );
    }
    
  } catch (error) {
    console.error('Checkout error:', error);
    
    // Przyjazne komunikaty błędów dla różnych typów błędów Stripe
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error.type === 'StripeInvalidRequestError') {
      errorMessage = 'Invalid request to payment processor';
      statusCode = 400;
    } else if (error.type === 'StripeAuthenticationError') {
      errorMessage = 'Payment processor authentication failed';
      statusCode = 500;
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Cannot connect to payment service';
      statusCode = 503;
    }
    
    return jsonResponse(
      {
        error: errorMessage,
        details: env.ENVIRONMENT === 'development' ? error.message : undefined,
        code: error.type || error.code
      },
      statusCode,
      corsHeaders
    );
  }
}

/**
 * GET /checkout - Pobierz konfigurację lub status checkout
 */
async function handleGetCheckout(request, stripe) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  const paymentIntentId = url.searchParams.get('payment_intent');
  
  // Jeśli podano session_id, pobierz informacje o sesji
  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent', 'line_items.data.price.product']
      });
      
      return jsonResponse({
        type: 'checkout_session',
        session: sanitizeSession(session),
        status: session.status,
        payment_status: session.payment_status,
        expires_at: session.expires_at,
        url: session.url
      }, 200, corsHeaders);
      
    } catch (error) {
      return jsonResponse(
        { error: 'Session not found', sessionId },
        404,
        corsHeaders
      );
    }
  }
  
  // Jeśli podano payment_intent, pobierz jego status
  if (paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      return jsonResponse({
        type: 'payment_intent',
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        client_secret: paymentIntent.client_secret,
        next_action: paymentIntent.next_action
      }, 200, corsHeaders);
      
    } catch (error) {
      return jsonResponse(
        { error: 'Payment intent not found', paymentIntentId },
        404,
        corsHeaders
      );
    }
  }
  
  // Zwróć domyślną konfigurację checkout
  return jsonResponse({
    available_methods: ['card', 'blik', 'p24', 'paypal'],
    currency: CURRENCY,
    shipping_options: SHIPPING_OPTIONS.map(opt => ({
      name: opt.shipping_rate_data.display_name,
      amount: opt.shipping_rate_data.fixed_amount.amount / 100,
      currency: opt.shipping_rate_data.fixed_amount.currency,
      delivery_estimate: opt.shipping_rate_data.delivery_estimate
    })),
    features: {
      allow_promotion_codes: true,
      phone_number_collection: true,
      shipping_address_collection: true,
      customer_creation: 'always'
    }
  }, 200, corsHeaders);
}

/**
 * POST /checkout - Utwórz nową sesję checkout
 */
async function handlePostCheckout(request, stripe, env) {
  const body = await request.json();
  
  // Walidacja wymaganych pól
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return jsonResponse(
      { error: 'Items array is required and cannot be empty' },
      400,
      corsHeaders
    );
  }
  
  // Przygotuj line_items dla Stripe
  const lineItems = body.items.map(item => {
    // Sprawdź czy item ma price_id (dla predefiniowanych cen)
    if (item.price_id) {
      return {
        price: item.price_id,
        quantity: item.quantity || 1,
        adjustable_quantity: item.adjustable_quantity || {
          enabled: false,
          minimum: 1,
          maximum: 10
        }
      };
    }
    
    // Lub dynamiczne tworzenie ceny
    if (!item.price_data) {
      throw new Error('Each item must have either price_id or price_data');
    }
    
    return {
      price_data: {
        currency: item.price_data.currency || CURRENCY,
        product_data: {
          name: item.price_data.name,
          description: item.price_data.description,
          images: item.price_data.images,
          metadata: item.price_data.metadata
        },
        unit_amount: item.price_data.unit_amount, // w groszach
        recurring: item.price_data.recurring,
      },
      quantity: item.quantity || 1,
      adjustable_quantity: item.adjustable_quantity
    };
  });
  
  // Konfiguracja sesji checkout
  const sessionConfig = {
    payment_method_types: body.payment_method_types || ['card', 'blik', 'p24'],
    line_items: lineItems,
    mode: body.mode || 'payment', // 'payment', 'subscription', 'setup'
    success_url: body.success_url || `${new URL(request.url).origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: body.cancel_url || `${new URL(request.url).origin}/cart`,
    customer_email: body.customer_email,
    client_reference_id: body.client_reference_id,
    locale: body.locale || 'pl',
    allow_promotion_codes: body.allow_promotion_codes ?? true,
    billing_address_collection: body.billing_address_collection || 'required',
    shipping_address_collection: body.shipping_address_collection ? {
      allowed_countries: body.shipping_address_collection.allowed_countries || ['PL', 'US', 'GB', 'DE']
    } : undefined,
    shipping_options: body.shipping_options || SHIPPING_OPTIONS,
    phone_number_collection: {
      enabled: body.phone_number_collection ?? true
    },
    custom_text: body.custom_text || {
      submit: {
        message: "Dziękujemy za złożenie zamówienia! Potwierdzenie wyślemy na Twój adres email."
      },
      shipping_address: {
        message: "Wpisz adres dostawy. Darmowa dostawa dla zamówień powyżej 200 zł."
      }
    },
    metadata: {
      ...body.metadata,
      source: 'cloudflare_pages_checkout',
      user_agent: request.headers.get('user-agent'),
      timestamp: new Date().toISOString()
    },
    expires_at: Math.floor(Date.now() / 1000) + (body.expires_in || 3600), // 1 godzina domyślnie
    consent_collection: body.consent_collection || {
      terms_of_service: 'required',
      promotions: 'auto'
    },
    invoice_creation: body.invoice_creation || {
      enabled: true,
      invoice_data: {
        account_tax_ids: body.tax_ids,
        custom_fields: body.custom_fields,
        footer: body.invoice_footer || "Dziękujemy za zakupy!",
        metadata: body.invoice_metadata
      }
    },
    payment_intent_data: body.payment_intent_data,
    subscription_data: body.subscription_data,
    tax_id_collection: {
      enabled: body.tax_id_collection ?? false
    },
    after_expiration: body.after_expiration || {
      recovery: {
        enabled: true,
        allow_promotion_codes: true
      }
    }
  };
  
  // Utwórz sesję w Stripe
  const session = await stripe.checkout.sessions.create(sessionConfig);
  
  // Jeśli klient chce natychmiastowy redirect
  if (body.auto_redirect) {
    return new Response(null, {
      status: 303,
      headers: {
        'Location': session.url,
        ...corsHeaders
      }
    });
  }
  
  // Zwróć informacje o sesji
  return jsonResponse({
    success: true,
    session_id: session.id,
    url: session.url,
    expires_at: session.expires_at,
    payment_intent: session.payment_intent,
    customer: session.customer,
    metadata: session.metadata,
    // Dla integracji z frontendem
    publishable_key: env.STRIPE_PUBLIC_KEY || env.STRIPE_PUBLIC_KEY_TEST
  }, 201, corsHeaders);
}

/**
 * PUT /checkout - Aktualizuj istniejącą sesję
 */
async function handlePutCheckout(request, stripe) {
  const body = await request.json();
  const sessionId = body.session_id;
  
  if (!sessionId) {
    return jsonResponse(
      { error: 'session_id is required for updating checkout' },
      400,
      corsHeaders
    );
  }
  
  // Dozwolone pola do aktualizacji
  const allowedUpdates = {
    shipping_address_collection: body.shipping_address_collection,
    shipping_options: body.shipping_options,
    custom_text: body.custom_text,
    allow_promotion_codes: body.allow_promotion_codes,
    phone_number_collection: body.phone_number_collection,
    metadata: body.metadata,
    customer_email: body.customer_email,
    customer_creation: body.customer_creation,
    locale: body.locale,
    payment_intent_data: body.payment_intent_data,
    subscription_data: body.subscription_data,
    invoice_creation: body.invoice_creation,
    consent_collection: body.consent_collection,
    expires_at: body.expires_at ? 
      Math.floor(new Date(body.expires_at).getTime() / 1000) : 
      undefined
  };
  
  // Usuń undefined values
  const updates = Object.fromEntries(
    Object.entries(allowedUpdates).filter(([_, v]) => v !== undefined)
  );
  
  if (Object.keys(updates).length === 0) {
    return jsonResponse(
      { error: 'No valid fields to update' },
      400,
      corsHeaders
    );
  }
  
  try {
    // Pobierz aktualną sesję
    const currentSession = await stripe.checkout.sessions.retrieve(sessionId);
    
    // Sprawdź czy sesja może być aktualizowana
    if (currentSession.status === 'complete' || currentSession.status === 'expired') {
      return jsonResponse(
        { 
          error: `Cannot update ${currentSession.status} session`,
          current_status: currentSession.status
        },
        400,
        corsHeaders
      );
    }
    
    // Zaktualizuj sesję
    const updatedSession = await stripe.checkout.sessions.update(
      sessionId,
      updates
    );
    
    return jsonResponse({
      success: true,
      session_id: updatedSession.id,
      updated_fields: Object.keys(updates),
      status: updatedSession.status,
      expires_at: updatedSession.expires_at,
      url: updatedSession.url
    }, 200, corsHeaders);
    
  } catch (error) {
    if (error.type === 'StripeInvalidRequestError') {
      return jsonResponse(
        { error: 'Session not found or cannot be updated', sessionId },
        404,
        corsHeaders
      );
    }
    throw error;
  }
}

/**
 * Przygotuj bezpieczną wersję sesji (bez wrażliwych danych)
 */
function sanitizeSession(session) {
  return {
    id: session.id,
    object: session.object,
    status: session.status,
    payment_status: session.payment_status,
    amount_total: session.amount_total,
    amount_subtotal: session.amount_subtotal,
    currency: session.currency,
    customer: session.customer ? {
      id: session.customer.id,
      email: session.customer.email,
      name: session.customer.name
    } : null,
    customer_email: session.customer_email,
    customer_details: session.customer_details,
    shipping_details: session.shipping_details,
    metadata: session.metadata,
    created: session.created,
    expires_at: session.expires_at,
    success_url: session.success_url,
    cancel_url: session.cancel_url,
    url: session.url,
    locale: session.locale,
    consent: session.consent,
    payment_intent: session.payment_intent ? {
      id: session.payment_intent.id,
      status: session.payment_intent.status,
      amount: session.payment_intent.amount,
      currency: session.payment_intent.currency
    } : null,
    line_items: session.line_items?.data.map(item => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      amount_total: item.amount_total,
      amount_subtotal: item.amount_subtotal,
      price: {
        id: item.price.id,
        unit_amount: item.price.unit_amount,
        currency: item.price.currency,
        product: item.price.product ? {
          id: item.price.product.id,
          name: item.price.product.name,
          description: item.price.product.description
        } : null
      }
    }))
  };
}

/**
 * Helper function do tworzenia JSON response
 */
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...headers
    }
  });
}

/**
 * Przykładowy test dla lokalnego developmentu
 */
if (typeof addEventListener === 'function') {
  addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
  });
  
  async function handleRequest(request) {
    // Symulacja środowiska dla lokalnego testowania
    const env = {
      STRIPE_SECRET_KEY_TEST: 'sk_test_...',
      STRIPE_PUBLIC_KEY_TEST: 'pk_test_...',
      ENVIRONMENT: 'development'
    };
    
    const context = { request, env };
    return onRequest(context);
  }
}
