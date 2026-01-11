import Stripe from 'stripe';

// CORS headers dla wszystkich odpowiedzi
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Stripe-Signature',
};

// Konfiguracja runtime dla lepszej kompatybilności
export const config = {
  runtime: 'edge',
};

/**
 * Główna funkcja obsługująca wszystkie żądania do /payment/:sessionId
 */
export async function onRequest(context) {
  const { request, params, env } = context;
  
  // Obsługa OPTIONS (preflight CORS)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204
    });
  }
  
  try {
    // Inicjalizacja Stripe
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const sessionId = params.session;
    
    if (!sessionId) {
      return jsonResponse(
        { error: 'Session ID is required' },
        400
      );
    }
    
    // Routing w zależności od metody HTTP
    switch (request.method) {
      case 'GET':
        return await handleGetSession(stripe, sessionId);
        
      case 'POST':
        return await handlePostSession(request, stripe, sessionId, env);
        
      case 'PUT':
        return await handleUpdateSession(request, stripe, sessionId);
        
      case 'DELETE':
        return await handleCancelSession(stripe, sessionId);
        
      default:
        return jsonResponse(
          { error: 'Method not allowed' },
          405
        );
    }
    
  } catch (error) {
    console.error('Error in payment session handler:', error);
    
    return jsonResponse(
      { 
        error: 'Internal server error',
        message: error.message,
        sessionId: params.session
      },
      500
    );
  }
}

/**
 * Pobierz informacje o sesji płatności
 * GET /payment/sess_123456789
 */
async function handleGetSession(stripe, sessionId) {
  try {
    // Pobierz sesję z Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: [
        'payment_intent',
        'customer',
        'line_items.data.price.product'
      ]
    });
    
    // Przygotuj bezpieczną odpowiedź (bez wrażliwych danych)
    const safeSession = {
      id: session.id,
      status: session.status,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: session.customer_email,
      customer_details: session.customer_details,
      shipping_details: session.shipping_details,
      metadata: session.metadata,
      created: session.created,
      expires_at: session.expires_at,
      success_url: session.success_url,
      cancel_url: session.cancel_url,
      url: session.url,
      // Informacje o płatności (jeśli dostępne)
      payment_intent: session.payment_intent ? {
        id: session.payment_intent.id,
        status: session.payment_intent.status,
        amount: session.payment_intent.amount,
        charges: session.payment_intent.charges?.data.map(charge => ({
          id: charge.id,
          amount: charge.amount,
          status: charge.status,
          payment_method: charge.payment_method_details?.type
        }))
      } : null,
      // Informacje o produktach
      line_items: session.line_items?.data.map(item => ({
        description: item.description,
        quantity: item.quantity,
        price: {
          unit_amount: item.price.unit_amount,
          currency: item.price.currency,
          product: item.price.product
        }
      }))
    };
    
    return jsonResponse(safeSession);
    
  } catch (error) {
    if (error.type === 'StripeInvalidRequestError') {
      return jsonResponse(
        { error: 'Session not found', sessionId },
        404
      );
    }
    
    throw error;
  }
}

/**
 * Aktualizuj sesję płatności
 * PUT /payment/sess_123456789
 */
async function handleUpdateSession(request, stripe, sessionId) {
  const body = await request.json();
  
  // Dozwolone pola do aktualizacji
  const allowedUpdates = {
    metadata: body.metadata,
    customer_email: body.customer_email,
    shipping_address_collection: body.shipping_address_collection,
    shipping_options: body.shipping_options,
    custom_fields: body.custom_fields
  };
  
  // Filtruj undefined values
  const updates = Object.fromEntries(
    Object.entries(allowedUpdates).filter(([_, v]) => v !== undefined)
  );
  
  if (Object.keys(updates).length === 0) {
    return jsonResponse(
      { error: 'No valid fields to update' },
      400
    );
  }
  
  const session = await stripe.checkout.sessions.update(
    sessionId,
    updates
  );
  
  return jsonResponse({
    success: true,
    sessionId: session.id,
    updated: Object.keys(updates),
    metadata: session.metadata
  });
}

/**
 * Anuluj sesję płatności
 * DELETE /payment/sess_123456789
 */
async function handleCancelSession(stripe, sessionId) {
  const session = await stripe.checkout.sessions.expire(sessionId);
  
  return jsonResponse({
    success: true,
    message: 'Session cancelled',
    sessionId: session.id,
    status: session.status,
    expires_at: session.expires_at
  });
}

/**
 * Webhook lub akcje na istniejącej sesji
 * POST /payment/sess_123456789
 */
async function handlePostSession(request, stripe, sessionId, env) {
  const contentType = request.headers.get('content-type') || '';
  
  // Sprawdź czy to webhook Stripe
  if (contentType.includes('application/json') && 
      request.headers.get('stripe-signature')) {
    return await handleWebhook(request, stripe, sessionId, env);
  }
  
  // Zwykły POST do sesji
  const body = await request.json();
  const action = body.action;
  
  switch (action) {
    case 'resend_customer_email':
      // Ponowne wysłanie emaila do klienta
      const emailSent = await stripe.checkout.sessions.sendCustomerEmail(sessionId);
      return jsonResponse({
        success: true,
        message: 'Customer email resent',
        email_sent: emailSent
      });
      
    case 'create_portal':
      // Utwórz portal klienta
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: body.customer_id,
        return_url: body.return_url || 'https://twoja-strona.com/account'
      });
      return jsonResponse({
        url: portalSession.url,
        expires_at: portalSession.expires_at
      });
      
    case 'apply_coupon':
      // Zastosuj kupon do sesji
      if (!body.coupon_id) {
        return jsonResponse(
          { error: 'Coupon ID is required' },
          400
        );
      }
      
      const updatedSession = await stripe.checkout.sessions.update(
        sessionId,
        {
          discounts: [{
            coupon: body.coupon_id
          }]
        }
      );
      
      return jsonResponse({
        success: true,
        discounts: updatedSession.discounts,
        amount_total: updatedSession.amount_total,
        amount_subtotal: updatedSession.amount_subtotal
      });
      
    default:
      return jsonResponse(
        { error: 'Invalid action', allowed_actions: ['resend_customer_email', 'create_portal', 'apply_coupon'] },
        400
      );
  }
}

/**
 * Obsługa webhooków Stripe dla konkretnej sesji
 */
async function handleWebhook(request, stripe, sessionId, env) {
  const signature = request.headers.get('stripe-signature');
  const rawBody = await request.text();
  
  try {
    // Weryfikuj webhook
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
    
    // Sprawdź czy webhook dotyczy naszej sesji
    const eventSessionId = event.data.object?.id || 
                          event.data.object?.session || 
                          event.data.object?.checkout_session;
    
    if (eventSessionId !== sessionId) {
      return jsonResponse(
        { 
          warning: 'Webhook does not match session ID',
          eventSessionId,
          requestedSessionId: sessionId 
        },
        200
      );
    }
    
    // Logika przetwarzania webhooka
    const result = await processStripeWebhook(event, stripe);
    
    return jsonResponse({
      success: true,
      event: event.type,
      sessionId: sessionId,
      processed: result
    });
    
  } catch (error) {
    console.error('Webhook verification failed:', error);
    
    return jsonResponse(
      { error: 'Webhook verification failed', message: error.message },
      400
    );
  }
}

/**
 * Przetwarzanie różnych typów webhooków Stripe
 */
async function processStripeWebhook(event, stripe) {
  const eventType = event.type;
  const session = event.data.object;
  
  console.log(`Processing webhook: ${eventType} for session: ${session.id}`);
  
  switch (eventType) {
    case 'checkout.session.completed':
      // Sesja checkout została ukończona
      // Tutaj możesz zaktualizować zamówienie w swojej bazie danych
      return {
        action: 'order_fulfillment',
        status: session.payment_status,
        metadata: session.metadata
      };
      
    case 'checkout.session.async_payment_succeeded':
      // Asynchroniczna płatność zakończona sukcesem
      return {
        action: 'async_payment_completed',
        payment_status: session.payment_status
      };
      
    case 'checkout.session.async_payment_failed':
      // Asynchroniczna płatność nieudana
      return {
        action: 'async_payment_failed',
        payment_status: session.payment_status
      };
      
    case 'checkout.session.expired':
      // Sesja wygasła
      return {
        action: 'session_expired',
        expires_at: session.expires_at
      };
      
    default:
      return {
        action: 'logged_only',
        event_type: eventType
      };
  }
}

/**
 * Pomocnicza funkcja do zwracania JSON response z CORS
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}
