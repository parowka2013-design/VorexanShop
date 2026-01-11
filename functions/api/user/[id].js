export async function onRequest(context) {
  const { params } = context;
  const userId = params.id;
  
  return new Response(
    JSON.stringify({ userId, message: `User ${userId} profile` }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
