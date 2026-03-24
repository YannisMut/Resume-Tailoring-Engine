import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  const body = await request.arrayBuffer();

  let response: Response;
  try {
    const apiUrl = process.env['API_URL'] ?? 'http://localhost:3001';
    response = await fetch(`${apiUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body,
      signal: AbortSignal.timeout(180_000), // 3 minutes — two sequential Gemini calls
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'proxy error';
    return Response.json({ error: 'ai_timeout', message: msg }, { status: 504 });
  }

  const data = await response.arrayBuffer();
  return new Response(data, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
  });
}
