/**
 * Cloudflare Pages Function: /api/proxy
 *
 * CORS proxy for ExpTech earthquake data APIs.
 * Only allowlisted upstream hosts are permitted.
 */

const ALLOWED_HOSTS = new Set([
  'api.lb.exptech.dev',
  'api.lb-tpe1.exptech.dev',
  'api.lb-khh1.exptech.dev',
  'api-1.exptech.dev',
  'api-2.exptech.dev',
  'api.core.exptech.dev',
  'api.core-tyo1.exptech.dev',
  'api.core-tnn1.exptech.dev',
]);

const ALLOWED_PATH_PREFIXES = [
  '/api/v1/eq/',
  '/api/v1/trem/',
  '/api/v2/eq/',
  '/api/v2/trem/',
];

export async function onRequest(context: {
  request: Request;
  env: Record<string, string>;
}): Promise<Response> {
  const { request } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (request.method !== 'GET') {
    return errorResponse(405, 'Method Not Allowed');
  }

  const url = new URL(request.url);
  const target = url.searchParams.get('url');

  if (!target) {
    return errorResponse(400, 'Missing url parameter');
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return errorResponse(400, 'Invalid url parameter');
  }

  // Enforce HTTPS only
  if (targetUrl.protocol !== 'https:') {
    return errorResponse(403, 'Only HTTPS targets allowed');
  }

  // Allowlist check — host must be in the permitted set
  if (!ALLOWED_HOSTS.has(targetUrl.hostname)) {
    return errorResponse(403, `Host not allowed: ${targetUrl.hostname}`);
  }

  // Path prefix check
  const pathAllowed = ALLOWED_PATH_PREFIXES.some((prefix) =>
    targetUrl.pathname.startsWith(prefix)
  );
  if (!pathAllowed) {
    return errorResponse(403, `Path not allowed: ${targetUrl.pathname}`);
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'TREM-Lite-Web/1.0 (Cloudflare-Proxy)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    const body = await upstream.arrayBuffer();

    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
        'Cache-Control': 'no-store',
        ...corsHeaders(),
      },
    });
  } catch (err) {
    console.error('[proxy] Upstream fetch failed:', err);
    return errorResponse(502, 'Upstream fetch failed');
  }
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}
