// Fallback API route - obsługuje wszystkie inne endpointy
export async function onRequest(context) {
    const { request, params } = context;
    
    return new Response(JSON.stringify({
        message: 'Vorexan Shop API',
        endpoint: params.path ? `/api/${params.path.join('/')}` : '/api',
        method: request.method,
        timestamp: new Date().toISOString()
    }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
    });
}
