// Globalny middleware dla wszystkich funkcji
export async function onRequest(context) {
    const { request, next } = context;
    
    // Dodaj nagłówki CORS dla wszystkich odpowiedzi
    const response = await next();
    
    // Klonuj odpowiedź aby móc modyfikować nagłówki
    const newResponse = new Response(response.body, response);
    
    // Dodaj CORS headers
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Stripe-Signature');
    
    // Obsługa preflight OPTIONS
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: newResponse.headers
        });
    }
    
    // Dodaj security headers
    newResponse.headers.set('X-Content-Type-Options', 'nosniff');
    newResponse.headers.set('X-Frame-Options', 'DENY');
    newResponse.headers.set('X-XSS-Protection', '1; mode=block');
    
    return newResponse;
}
