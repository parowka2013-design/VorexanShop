export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Only POST", { status: 405 });
    }

    const { items, email } = await request.json();

    const line_items = items.map(item => ({
      price_data: {
        currency: "pln",
        product_data: {
          name: item.name
        },
        unit_amount: item.price * 100
      },
      quantity: 1
    }));

    const body = new URLSearchParams();
    body.append("mode", "payment");
    body.append("success_url", "https://TWOJA-DOMENA/success.html");
    body.append("cancel_url", "https://TWOJA-DOMENA/cancel.html");
    body.append("customer_email", email);

    line_items.forEach((item, i) => {
      body.append(`line_items[${i}][price_data][currency]`, "pln");
      body.append(`line_items[${i}][price_data][product_data][name]`, item.price_data.product_data.name);
      body.append(`line_items[${i}][price_data][unit_amount]`, item.price_data.unit_amount);
      body.append(`line_items[${i}][quantity]`, 1);
    });

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.STRIPE_SECRET}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    const data = await stripeRes.json();
    return Response.json({ url: data.url });
  }
};
