import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.text();

  let response: Response;
  try {
    const apiUrl = process.env['API_URL'] ?? 'http://localhost:3001';
    response = await fetch(`${apiUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'proxy error';
    return Response.json({ error: 'generate_failed', message: msg }, { status: 502 });
  }

  const data = await response.arrayBuffer();
  return new Response(data, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') ?? 'application/octet-stream' },
  });
}
