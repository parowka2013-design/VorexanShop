// Obsługuje /api/* i /api
export async function onRequest(context) {
  const { params, request } = context;
  const path = params.path || 'index';
  
  return new Response(
    JSON.stringify({
      path: path,
      fullPath: Array.isArray(path) ? path.join('/') : path,
      endpoint: `/api/${path}`
    })
  );
}
