// workers.js - Przykład
import Stripe from 'stripe'

export default {
  async fetch(request, env) {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY)
    
    // Tworzenie sesji płatności
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Produkt' },
          unit_amount: 2000,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'https://twoja-domena.com/success',
      cancel_url: 'https://twoja-domena.com/cancel',
    })
    
    return Response.redirect(session.url, 303)
  }
}
