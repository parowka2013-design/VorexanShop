import Stripe from 'stripe';

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestPost(context) {
    const { request, env } = context;
    
    // Obsługa CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: corsHeaders,
            status: 204
        });
    }
    
    try {
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);
        const body = await request.json();
        
        // Walidacja danych
        if (!body.email || !body.amount || !body.cart || !Array.isArray(body.cart)) {
            return new Response(JSON.stringify({
                error: 'Invalid request data'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
        
        // Przygotuj line items dla Stripe
        const lineItems = body.cart.map(item => ({
            price_data: {
                currency: 'pln',
                product_data: {
                    name: item.name,
                    description: item.desc,
                    metadata: {
                        product_id: item.id
                    }
                },
                unit_amount: Math.round(item.price * 100), // w groszach
            },
            quantity: item.quantity,
        }));
        
        // Utwórz sesję checkout w Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'blik', 'p24'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${new URL(request.url).origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${new URL(request.url).origin}/payment-canceled`,
            customer_email: body.email,
            metadata: {
                order_id: body.orderId || `vx-${Date.now()}`,
                discord: body.discord || '',
                cart_items: JSON.stringify(body.cart.map(item => `${item.name} x${item.quantity}`))
            },
            expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 godzina
        });
        
        return new Response(JSON.stringify({
            success: true,
            sessionId: session.id,
            url: session.url,
            orderId: session.metadata.order_id
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
        
    } catch (error) {
        console.error('Create checkout error:', error);
        
        return new Response(JSON.stringify({
            error: error.message,
            code: error.type || 'server_error'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }
}

// Obsługa OPTIONS dla CORS
export async function onRequestOptions(context) {
    return new Response(null, {
        headers: corsHeaders,
        status: 204
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
            return new Response(JSON.stringify({
                error: 'Method not allowed'
            }), {
                status: 405,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
    }
}
