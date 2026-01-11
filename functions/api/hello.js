// GET /api/hello
export async function onRequestGet(context) {
  // context zawiera: env, request, params, data (z middleware)
  const { request, env } = context;
  
  return new Response(
    JSON.stringify({
      message: "Hello from Cloudflare Pages Functions!",
      timestamp: new Date().toISOString(),
      method: request.method,
      url: request.url
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      status: 200
    }
  );
}

// POST /api/hello
export async function onRequestPost(context) {
  const { request } = context;
  const body = await request.json();
  
  return new Response(
    JSON.stringify({ 
      received: true, 
      data: body 
    }),
    { 
      headers: { 'Content-Type': 'application/json' },
      status: 201 
    }
  );
}

// Obsługa wszystkich metod HTTP
export async function onRequest(context) {
  const { request } = context;
  
  switch (request.method) {
    case 'GET':
      return onRequestGet(context);
    case 'POST':
      return onRequestPost(context);
    default:
      return new Response('Method not allowed', { status: 405 });
  }
}
