import Stripe from 'stripe';

export const config = {
    runtime: 'edge',
};

export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);
        const signature = request.headers.get('stripe-signature');
        
        if (!signature) {
            return new Response('No signature', { status: 400 });
        }
        
        const rawBody = await request.text();
        
        let event;
        try {
            event = stripe.webhooks.constructEvent(
                rawBody,
                signature,
                env.STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return new Response(`Webhook Error: ${err.message}`, { status: 400 });
        }
        
        // Obsługa różnych typów eventów
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                await handleCheckoutCompleted(session, env);
                break;
                
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                await handlePaymentIntentSucceeded(paymentIntent, env);
                break;
                
            case 'charge.refunded':
                const charge = event.data.object;
                await handleChargeRefunded(charge, env);
                break;
                
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
        
        return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('Webhook error:', error);
        return new Response(`Webhook Error: ${error.message}`, { status: 400 });
    }
}

// Funkcje obsługi eventów
async function handleCheckoutCompleted(session, env) {
    console.log('Checkout session completed:', {
        sessionId: session.id,
        customerEmail: session.customer_email,
        amountTotal: session.amount_total / 100,
        orderId: session.metadata.order_id,
        discord: session.metadata.discord
    });
    
    // Tutaj wyślij email z dostępem do produktu
    // Możesz użyć Resend, SendGrid, itp.
    
    // Przykład z Resend:
    if (env.RESEND_API_KEY && session.customer_email) {
        const emailData = {
            from: 'Vorexan Shop <shop@vorexan.pl>',
            to: session.customer_email,
            subject: `Potwierdzenie zamówienia #${session.metadata.order_id}`,
            html: `
                <h1>Dziękujemy za zakup w Vorexan Shop!</h1>
                <p>Twoje zamówienie <strong>#${session.metadata.order_id}</strong> zostało opłacone.</p>
                <p>Kwota: ${session.amount_total / 100} PLN</p>
                <p>Produkty: ${session.metadata.cart_items}</p>
                <p>Dostęp do produktów zostanie wysłany w oddzielnej wiadomości.</p>
                <p>W razie pytań pisz na Discord: vorexan</p>
            `
        };
        
        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(emailData)
            });
            
            if (!response.ok) {
                console.error('Failed to send email:', await response.text());
            }
        } catch (emailError) {
            console.error('Email send error:', emailError);
        }
    }
    
    // Możesz też zapisać zamówienie do bazy danych (np. D1, KV)
    if (env.ORDERS_KV) {
        await env.ORDERS_KV.put(
            `order_${session.metadata.order_id}`,
            JSON.stringify({
                id: session.metadata.order_id,
                email: session.customer_email,
                discord: session.metadata.discord,
                amount: session.amount_total / 100,
                status: 'paid',
                paid_at: new Date().toISOString(),
                session_id: session.id
            }),
            { expirationTtl: 86400 * 30 } // 30 dni
        );
    }
}

async function handlePaymentIntentSucceeded(paymentIntent, env) {
    console.log('Payment intent succeeded:', paymentIntent.id);
    // Dodatkowa logika jeśli potrzebna
}

async function handleChargeRefunded(charge, env) {
    console.log('Charge refunded:', charge.id);
    // Logika refundacji
}

// Obsługa OPTIONS dla CORS
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature'
        }
    });
}
