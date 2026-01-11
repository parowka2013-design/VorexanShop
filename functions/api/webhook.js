import Stripe from 'stripe';

/**
 * Endpoint do obsługi webhooków Stripe
 * POST /api/webhook
 * 
 * Ważne: W panelu Stripe ustaw webhook URL na:
 * https://twoja-domena.com/api/webhook
 */

// Konfiguracja endpointu
export const config = {
  runtime: 'edge', // Uruchom na Edge dla lepszej wydajności
};

// Cache dla secretów webhook (optymalizacja)
const webhookSecrets = new Map();

// Cache dla przetworzonych eventów (zapobieganie duplikatom)
const processedEvents = new Map();
const EVENT_CACHE_TTL = 60000; // 60 sekund

// Typy eventów do obsługi
const HANDLED_EVENT_TYPES = new Set([
  // Płatności
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.processing',
  'payment_intent.canceled',
  'payment_intent.amount_capturable_updated',
  
  // Checkout Sessions
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  
  // Subskrypcje
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  
  // Faktury
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
  'invoice.upcoming',
  
  // Klienci
  'customer.created',
  'customer.updated',
  'customer.deleted',
  
  // Refundy
  'charge.refunded',
  'charge.refund.updated',
  
  // Disputes
  'charge.dispute.created',
  'charge.dispute.closed',
  'charge.dispute.funds_reinstated',
  'charge.dispute.funds_withdrawn',
  
  // Rachunki (Billing Portal)
  'billing_portal.session.created',
  
  // Testowe
  'ping'
]);

// Nagłówki odpowiedzi
const responseHeaders = {
  'Content-Type': 'application/json',
  'X-Webhook-Processor': 'Cloudflare-Pages-Stripe-Webhook',
  'X-Webhook-Version': '2.0.0',
};

/**
 * Główna funkcja obsługująca webhooki
 */
export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;
  const startTime = Date.now();
  
  // ID requestu dla śledzenia
  const requestId = generateRequestId();
  const logContext = { requestId, timestamp: new Date().toISOString() };
  
  try {
    // Log wejściowy request
    await logRequest(request, env, logContext);
    
    // Sprawdź metodę HTTP (tylko POST)
    if (request.method !== 'POST') {
      return errorResponse(
        'Method not allowed. Webhook endpoint only accepts POST requests.',
        405,
        requestId
      );
    }
    
    // Sprawdź nagłówek Stripe-Signature
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return errorResponse(
        'Missing Stripe-Signature header',
        400,
        requestId
      );
    }
    
    // Pobierz raw body
    const rawBody = await request.text();
    
    if (!rawBody || rawBody.trim().length === 0) {
      return errorResponse(
        'Empty request body',
        400,
        requestId
      );
    }
    
    // Sprawdź czy to testowy ping od Stripe
    if (request.headers.get('user-agent')?.includes('Stripe') && rawBody.includes('"type":"ping"')) {
      console.log('Stripe webhook test received', logContext);
      return successResponse({ received: true, type: 'ping' }, 200, requestId);
    }
    
    // Parsuj body żeby sprawdzić typ eventu (bez weryfikacji)
    let eventType;
    try {
      const parsedBody = JSON.parse(rawBody);
      eventType = parsedBody.type;
      logContext.eventType = eventType;
      logContext.eventId = parsedBody.id;
    } catch (parseError) {
      return errorResponse(
        'Invalid JSON in request body',
        400,
        requestId
      );
    }
    
    // Sprawdź czy obsługujemy ten typ eventu
    if (!HANDLED_EVENT_TYPES.has(eventType)) {
      console.log(`Unhandled event type: ${eventType}`, logContext);
      return successResponse(
        { received: true, message: `Event type '${eventType}' not handled` },
        200,
        requestId
      );
    }
    
    // Sprawdź duplikat eventu (idempotency)
    const eventId = logContext.eventId;
    if (eventId && isDuplicateEvent(eventId)) {
      console.log(`Duplicate event detected: ${eventId}`, logContext);
      return successResponse(
        { received: true, message: 'Event already processed' },
        200,
        requestId
      );
    }
    
    // Pobierz odpowiedni klucz webhook secret
    const webhookSecret = await getWebhookSecret(env, eventType, logContext);
    if (!webhookSecret) {
      return errorResponse(
        'Webhook secret not configured',
        500,
        requestId
      );
    }
    
    // Inicjalizacja Stripe
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    
    let event;
    try {
      // Weryfikuj webhook
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );
      
      logContext.verification = 'success';
      
    } catch (verificationError) {
      logContext.verification = 'failed';
      logContext.verificationError = verificationError.message;
      
      console.error('Webhook verification failed:', logContext);
      
      return errorResponse(
        `Webhook verification failed: ${verificationError.message}`,
        400,
        requestId
      );
    }
    
    // Zaznacz event jako przetwarzany (zapobieganie równoległemu przetwarzaniu)
    markEventAsProcessing(eventId);
    
    // Przetwarzaj event asynchronicznie (nie blokuj odpowiedzi)
    waitUntil(processWebhookEvent(event, stripe, env, logContext));
    
    // Natychmiastowa odpowiedź do Stripe
    const processingTime = Date.now() - startTime;
    
    return successResponse(
      {
        received: true,
        event_id: event.id,
        event_type: event.type,
        processing_time_ms: processingTime,
        message: 'Event received and processing started'
      },
      200,
      requestId
    );
    
  } catch (error) {
    console.error('Unhandled webhook error:', {
      ...logContext,
      error: error.message,
      stack: error.stack
    });
    
    return errorResponse(
      'Internal server error',
      500,
      requestId
    );
  }
}

/**
 * Przetwarzanie webhook eventu
 */
async function processWebhookEvent(event, stripe, env, logContext) {
  const processingStart = Date.now();
  
  try {
    // Extrahuj dane z eventu
    const eventData = extractEventData(event);
    
    // Log rozpoczęcia przetwarzania
    console.log(`Processing webhook: ${event.type}`, {
      ...logContext,
      ...eventData.metadata
    });
    
    // Wywołaj odpowiednią funkcję obsługi w zależności od typu eventu
    const result = await handleEventByType(event, stripe, env, logContext);
    
    // Zapisz event do bazy danych lub logów
    await storeWebhookEvent(event, result, env, logContext);
    
    // Zaznacz jako przetworzony
    markEventAsProcessed(event.id, result);
    
    const processingTime = Date.now() - processingStart;
    
    console.log(`Webhook processed successfully: ${event.type}`, {
      ...logContext,
      processingTime,
      result: result.status,
      eventId: event.id
    });
    
    return result;
    
  } catch (processingError) {
    console.error('Error processing webhook event:', {
      ...logContext,
      error: processingError.message,
      stack: processingError.stack,
      eventType: event.type
    });
    
    // Zapisanie błędu do bazy danych
    await storeWebhookError(event, processingError, env, logContext);
    
    // Nie rzucaj błędu dalej - już odpowiedzieliśmy 200 do Stripe
    return {
      status: 'error',
      error: processingError.message,
      eventId: event.id
    };
  }
}

/**
 * Obsługa eventów w zależności od typu
 */
async function handleEventByType(event, stripe, env, logContext) {
  const eventType = event.type;
  const eventData = event.data.object;
  
  switch (eventType) {
    // ========== CHECKOUT SESSIONS ==========
    case 'checkout.session.completed':
      return await handleCheckoutCompleted(eventData, stripe, env, logContext);
      
    case 'checkout.session.async_payment_succeeded':
      return await handleAsyncPaymentSucceeded(eventData, stripe, env, logContext);
      
    case 'checkout.session.async_payment_failed':
      return await handleAsyncPaymentFailed(eventData, stripe, env, logContext);
      
    case 'checkout.session.expired':
      return await handleCheckoutExpired(eventData, stripe, env, logContext);
    
    // ========== PAYMENT INTENTS ==========
    case 'payment_intent.succeeded':
      return await handlePaymentIntentSucceeded(eventData, stripe, env, logContext);
      
    case 'payment_intent.payment_failed':
      return await handlePaymentIntentFailed(eventData, stripe, env, logContext);
      
    case 'payment_intent.processing':
      return await handlePaymentIntentProcessing(eventData, stripe, env, logContext);
      
    // ========== INVOICES ==========
    case 'invoice.paid':
      return await handleInvoicePaid(eventData, stripe, env, logContext);
      
    case 'invoice.payment_failed':
      return await handleInvoicePaymentFailed(eventData, stripe, env, logContext);
      
    case 'invoice.upcoming':
      return await handleInvoiceUpcoming(eventData, stripe, env, logContext);
    
    // ========== SUBSCRIPTIONS ==========
    case 'customer.subscription.created':
      return await handleSubscriptionCreated(eventData, stripe, env, logContext);
      
    case 'customer.subscription.updated':
      return await handleSubscriptionUpdated(eventData, stripe, env, logContext);
      
    case 'customer.subscription.deleted':
      return await handleSubscriptionDeleted(eventData, stripe, env, logContext);
      
    case 'customer.subscription.trial_will_end':
      return await handleSubscriptionTrialEnding(eventData, stripe, env, logContext);
    
    // ========== CUSTOMERS ==========
    case 'customer.created':
      return await handleCustomerCreated(eventData, stripe, env, logContext);
      
    case 'customer.updated':
      return await handleCustomerUpdated(eventData, stripe, env, logContext);
      
    case 'customer.deleted':
      return await handleCustomerDeleted(eventData, stripe, env, logContext);
    
    // ========== CHARGES & REFUNDS ==========
    case 'charge.refunded':
      return await handleChargeRefunded(eventData, stripe, env, logContext);
      
    case 'charge.dispute.created':
      return await handleDisputeCreated(eventData, stripe, env, logContext);
    
    // ========== DEFAULT ==========
    default:
      return {
        status: 'ignored',
        message: `Event type '${eventType}' not specifically handled`,
        eventId: event.id
      };
  }
}

/**
 * HANDLERY SPECJALISTYCZNE
 */

// Checkout Session Completed
async function handleCheckoutCompleted(session, stripe, env, logContext) {
  const metadata = session.metadata || {};
  const orderId = metadata.order_id || session.client_reference_id;
  
  console.log('Checkout session completed:', {
    sessionId: session.id,
    paymentStatus: session.payment_status,
    customerEmail: session.customer_email,
    amount: session.amount_total / 100,
    currency: session.currency,
    orderId,
    ...logContext
  });
  
  // Jeśli to subskrypcja, pobierz szczegóły
  if (session.mode === 'subscription' && session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription, {
      expand: ['latest_invoice', 'customer']
    });
    
    console.log('Subscription details:', {
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      customerId: subscription.customer
    });
  }
  
  // Aktualizuj zamówienie w swojej bazie danych
  await updateOrderStatus(orderId, 'paid', {
    stripeSessionId: session.id,
    stripeCustomerId: session.customer,
    paymentMethod: session.payment_method_types?.[0],
    metadata
  }, env);
  
  // Wyślij email potwierdzający
  if (session.customer_email) {
    await sendOrderConfirmationEmail(
      session.customer_email,
      orderId,
      session.amount_total / 100,
      session.currency,
      metadata,
      env
    );
  }
  
  return {
    status: 'success',
    action: 'order_fulfilled',
    orderId,
    sessionId: session.id,
    customerEmail: session.customer_email
  };
}

// Payment Intent Succeeded
async function handlePaymentIntentSucceeded(paymentIntent, stripe, env, logContext) {
  console.log('Payment intent succeeded:', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount / 100,
    currency: paymentIntent.currency,
    customerId: paymentIntent.customer,
    ...logContext
  });
  
  // Jeśli payment intent ma charge, pobierz szczegóły
  if (paymentIntent.charges?.data?.length > 0) {
    const charge = paymentIntent.charges.data[0];
    
    console.log('Charge details:', {
      chargeId: charge.id,
      paymentMethod: charge.payment_method_details?.type,
      billingDetails: charge.billing_details
    });
  }
  
  return {
    status: 'success',
    action: 'payment_confirmed',
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount
  };
}

// Invoice Paid
async function handleInvoicePaid(invoice, stripe, env, logContext) {
  const subscriptionId = invoice.subscription;
  const customerId = invoice.customer;
  
  console.log('Invoice paid:', {
    invoiceId: invoice.id,
    subscriptionId,
    customerId,
    amountPaid: invoice.amount_paid / 100,
    currency: invoice.currency,
    ...logContext
  });
  
  // Pobierz subscription jeśli dostępne
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Aktualizuj status subskrypcji w swojej bazie
    await updateSubscriptionStatus(
      subscriptionId,
      'active',
      {
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        invoiceId: invoice.id
      },
      env
    );
  }
  
  // Wyślij fakturę do klienta
  if (invoice.customer_email) {
    await sendInvoiceEmail(
      invoice.customer_email,
      invoice.id,
      invoice.amount_paid / 100,
      invoice.currency,
      env
    );
  }
  
  return {
    status: 'success',
    action: 'invoice_paid',
    invoiceId: invoice.id,
    subscriptionId,
    customerId
  };
}

// Subscription Created/Updated
async function handleSubscriptionCreated(subscription, stripe, env, logContext) {
  console.log('Subscription created:', {
    subscriptionId: subscription.id,
    status: subscription.status,
    customerId: subscription.customer,
    planId: subscription.items.data[0]?.price.id,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    ...logContext
  });
  
  await createOrUpdateSubscription(
    subscription.id,
    subscription.customer,
    subscription.status,
    subscription.items.data[0]?.price.id,
    new Date(subscription.current_period_end * 1000),
    env
  );
  
  return {
    status: 'success',
    action: 'subscription_created',
    subscriptionId: subscription.id,
    status: subscription.status
  };
}

// Customer Created
async function handleCustomerCreated(customer, stripe, env, logContext) {
  console.log('Customer created:', {
    customerId: customer.id,
    email: customer.email,
    name: customer.name,
    ...logContext
  });
  
  await createOrUpdateCustomer(
    customer.id,
    customer.email,
    customer.name,
    customer.metadata,
    env
  );
  
  return {
    status: 'success',
    action: 'customer_created',
    customerId: customer.id,
    email: customer.email
  };
}

/**
 * FUNKCJE POMOCNICZE
 */

// Pobierz odpowiedni webhook secret
async function getWebhookSecret(env, eventType, logContext) {
  // Spróbuj pobierz z cache
  const cacheKey = `${env.ENVIRONMENT || 'production'}_${eventType}`;
  if (webhookSecrets.has(cacheKey)) {
    return webhookSecrets.get(cacheKey);
  }
  
  // Pobierz z environment variables
  let secret;
  
  if (eventType.includes('test') || env.ENVIRONMENT === 'development') {
    secret = env.STRIPE_WEBHOOK_SECRET_TEST || env.STRIPE_WEBHOOK_SECRET;
  } else {
    secret = env.STRIPE_WEBHOOK_SECRET;
  }
  
  if (!secret) {
    console.error('Webhook secret not found in environment variables', logContext);
    return null;
  }
  
  // Cache secret
  webhookSecrets.set(cacheKey, secret);
  
  return secret;
}

// Sprawdź duplikat eventu
function isDuplicateEvent(eventId) {
  const cached = processedEvents.get(eventId);
  if (!cached) return false;
  
  // Sprawdź czy cache jest jeszcze aktualny
  if (Date.now() - cached.timestamp > EVENT_CACHE_TTL) {
    processedEvents.delete(eventId);
    return false;
  }
  
  return true;
}

// Oznacz event jako przetwarzany
function markEventAsProcessing(eventId) {
  if (!eventId) return;
  
  processedEvents.set(eventId, {
    timestamp: Date.now(),
    status: 'processing'
  });
}

// Oznacz event jako przetworzony
function markEventAsProcessed(eventId, result) {
  if (!eventId) return;
  
  processedEvents.set(eventId, {
    timestamp: Date.now(),
    status: 'processed',
    result: result.status
  });
}

// Extrahuj dane z eventu
function extractEventData(event) {
  const obj = event.data.object;
  
  return {
    id: obj.id,
    type: event.type,
    created: new Date(event.created * 1000),
    livemode: event.livemode,
    metadata: {
      customerId: obj.customer,
      subscriptionId: obj.subscription,
      amount: obj.amount || obj.amount_total || obj.amount_paid,
      currency: obj.currency,
      status: obj.status || obj.payment_status,
      email: obj.customer_email || obj.receipt_email,
      ...obj.metadata
    }
  };
}

// Generuj unikalny ID requestu
function generateRequestId() {
  return `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Logowanie requestu
async function logRequest(request, env, logContext) {
  if (env.ENVIRONMENT === 'development') {
    const headers = {};
    for (const [key, value] of request.headers.entries()) {
      if (!key.toLowerCase().includes('authorization') && !key.toLowerCase().includes('key')) {
        headers[key] = value;
      }
    }
    
    console.log('Webhook request received:', {
      ...logContext,
      method: request.method,
      url: request.url,
      headers: headers,
      cf: request.cf
    });
  }
}

// Store webhook event w bazie danych
async function storeWebhookEvent(event, result, env, logContext) {
  // Implementacja zapisu do bazy danych
  // Przykład z użyciem D1, KV lub innej bazy
  try {
    const eventData = {
      id: event.id,
      type: event.type,
      data: extractEventData(event),
      result: result,
      processed_at: new Date().toISOString(),
      request_id: logContext.requestId
    };
    
    // Przykład z Cloudflare D1
    if (env.DB) {
      await env.DB.prepare(`
        INSERT INTO webhook_events (id, type, data, result, processed_at, request_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        event.id,
        event.type,
        JSON.stringify(eventData.data),
        JSON.stringify(result),
        eventData.processed_at,
        logContext.requestId
      ).run();
    }
    
    // Przykład z Cloudflare KV
    if (env.WEBHOOK_EVENTS) {
      await env.WEBHOOK_EVENTS.put(
        `event_${event.id}_${Date.now()}`,
        JSON.stringify(eventData),
        { expirationTtl: 86400 * 30 } // 30 dni
      );
    }
    
  } catch (dbError) {
    console.error('Failed to store webhook event:', {
      ...logContext,
      error: dbError.message
    });
  }
}

// Store error
async function storeWebhookError(event, error, env, logContext) {
  try {
    const errorData = {
      event_id: event.id,
      event_type: event.type,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      request_id: logContext.requestId
    };
    
    if (env.DB) {
      await env.DB.prepare(`
        INSERT INTO webhook_errors (event_id, event_type, error, stack, timestamp, request_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        event.id,
        event.type,
        error.message,
        error.stack || '',
        errorData.timestamp,
        logContext.requestId
      ).run();
    }
    
  } catch (dbError) {
    console.error('Failed to store webhook error:', dbError.message);
  }
}

/**
 * FUNKCJE INTEGRACYJNE (do zaimplementowania wg potrzeb)
 */

// Aktualizuj status zamówienia
async function updateOrderStatus(orderId, status, data, env) {
  // Implementacja aktualizacji zamówienia w Twojej bazie danych
  // Przykład z fetch do wewnętrznego API
  try {
    const response = await fetch(`${env.INTERNAL_API_URL}/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.INTERNAL_API_KEY}`
      },
      body: JSON.stringify({
        status,
        stripe_data: data,
        updated_at: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update order: ${response.statusText}`);
    }
    
    console.log(`Order ${orderId} updated to status: ${status}`);
    
  } catch (error) {
    console.error(`Error updating order ${orderId}:`, error.message);
    // Możesz dodać retry logic lub zapis do dead letter queue
  }
}

// Wyślij email potwierdzający
async function sendOrderConfirmationEmail(email, orderId, amount, currency, metadata, env) {
  // Implementacja wysyłki emaila
  // Przykład z użyciem Resend, SendGrid, itp.
  try {
    const emailData = {
      from: env.EMAIL_FROM || 'Sklep <sklep@twoja-domena.pl>',
      to: email,
      subject: `Potwierdzenie zamówienia #${orderId}`,
      html: `
        <h1>Dziękujemy za zamówienie!</h1>
        <p>Twoje zamówienie <strong>#${orderId}</strong> zostało potwierdzone.</p>
        <p>Kwota: ${amount} ${currency.toUpperCase()}</p>
        ${metadata.note ? `<p>Uwaga: ${metadata.note}</p>` : ''}
        <p>Szczegóły zamówienia dostępne są w panelu klienta.</p>
      `
    };
    
    // Przykład z Resend
    if (env.RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailData)
      });
      
      if (!response.ok) {
        throw new Error(`Email send failed: ${response.statusText}`);
      }
    }
    
    console.log(`Confirmation email sent to: ${email}`);
    
  } catch (error) {
    console.error(`Error sending email to ${email}:`, error.message);
  }
}

// Obsługa innych typów eventów (skrócone implementacje)
async function handleAsyncPaymentSucceeded(session, stripe, env, logContext) {
  console.log('Async payment succeeded for session:', session.id);
  return { status: 'success', action: 'async_payment_succeeded' };
}

async function handleAsyncPaymentFailed(session, stripe, env, logContext) {
  console.log('Async payment failed for session:', session.id);
  return { status: 'warning', action: 'async_payment_failed' };
}

async function handleCheckoutExpired(session, stripe, env, logContext) {
  console.log('Checkout session expired:', session.id);
  return { status: 'info', action: 'checkout_expired' };
}

// ... dodaj pozostałe funkcje obsługi w podobny sposób

/**
 * FORMATOWANIE ODPOWIEDZI
 */
function successResponse(data, status = 200, requestId = '') {
  return new Response(JSON.stringify({
    ...data,
    request_id: requestId,
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: {
      ...responseHeaders,
      'X-Request-ID': requestId
    }
  });
}

function errorResponse(message, status = 400, requestId = '') {
  return new Response(JSON.stringify({
    error: message,
    request_id: requestId,
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: {
      ...responseHeaders,
      'X-Request-ID': requestId
    }
  });
}

// Obsługa OPTIONS dla CORS
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// Dla kompletności - obsługa wszystkich metod
export async function onRequest(context) {
  const { request } = context;
  
  switch (request.method) {
    case 'POST':
      return onRequestPost(context);
    case 'OPTIONS':
      return onRequestOptions(context);
    default:
      return errorResponse(
        'Method not allowed. Webhook endpoint only accepts POST and OPTIONS requests.',
        405,
        generateRequestId()
      );
  }
}
