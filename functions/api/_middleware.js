export async function onRequest(context) {
  const { request, next } = context;
  
  // Logowanie requestów
  console.log(`${new Date().toISOString()} ${request.method} ${request.url}`);
  
  // CORS headers
  const response = await next();
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Obsługa preflight OPTIONS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: response.headers,
      status: 204
    });
  }
  
  return response;
}
