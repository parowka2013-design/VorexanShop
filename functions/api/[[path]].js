// functions/api/[[path]].js - Obsługa wszystkich endpointów API
export async function onRequest(context) {
    const { request, params } = context;
    const path = params.path || [];
    
    // Główny endpoint API
    if (request.method === 'GET' && path.length === 0) {
        return new Response(JSON.stringify({
            name: "Vorexan Tipply API",
            version: "1.0.0",
            endpoints: {
                "POST /api/track-donation": "Track donation clicks",
                "GET /api/stats": "Get donation statistics",
                "GET /api/services": "List available services"
            },
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
    
    // Endpoint z listą usług
    if (request.method === 'GET' && path[0] === 'services') {
        const services = [
            { id: 'plugin', name: 'Plugin Minecraft', price: 50, description: 'Custom plugin z GUI' },
            { id: 'skript', name: 'Skrypty Skript', price: 30, description: 'Rangi, eventy, systemy' },
            { id: 'www', name: 'Strona WWW', price: 90, description: 'Portfolio lub sklep' },
            { id: 'video', name: 'Montaż wideo', price: 0.6, description: '1 sek = 0,01 zł' },
            { id: 'custom', name: 'Własna kwota', price: 'flexible', description: 'Dowolna kwota od 5 zł' }
        ];
        
        return new Response(JSON.stringify({
            services: services,
            count: services.length,
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
    
    // Endpoint ze statystykami
    if (request.method === 'GET' && path[0] === 'stats') {
        return new Response(JSON.stringify({
            totalClicks: 0, // Możesz zwiększać w KV Store
            services: {
                plugin: { clicks: 0, total: 0 },
                skript: { clicks: 0, total: 0 },
                www: { clicks: 0, total: 0 },
                video: { clicks: 0, total: 0 },
                custom: { clicks: 0, total: 0 }
            },
            timestamp: new Date().toISOString(),
            note: "Statistics will be populated as users click donation buttons"
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
    
    // 404 dla nieznanych endpointów
    return new Response(JSON.stringify({
        error: "Endpoint not found",
        path: `/${path.join('/')}`,
        method: request.method,
        availableEndpoints: ["/api/track-donation", "/api/services", "/api/stats"]
    }), {
        status: 404,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
