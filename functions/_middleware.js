// functions/_middleware.js - Globalny middleware dla wszystkich funkcji
export async function onRequest(context) {
    const { request, next } = context;
    
    // Logowanie requestów (opcjonalnie)
    console.log(`${new Date().toLocaleString('pl-PL')} ${request.method} ${request.url}`);
    
    // Obsługa preflight CORS
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            }
        });
    }
    
    // Przetwórz request
    const response = await next();
    
    // Dodaj CORS headers do wszystkich odpowiedzi
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Dodaj security headers
    newResponse.headers.set('X-Content-Type-Options', 'nosniff');
    newResponse.headers.set('X-Frame-Options', 'DENY');
    newResponse.headers.set('X-XSS-Protection', '1; mode=block');
    newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Cache headers dla API
    if (request.url.includes('/api/')) {
        newResponse.headers.set('Cache-Control', 'no-store, max-age=0');
    }
    
    return newResponse;
}
