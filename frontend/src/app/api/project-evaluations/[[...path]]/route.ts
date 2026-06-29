export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

type ProxyRequestInit = RequestInit & {
  duplex?: "half";
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function backendBaseUrl(): string {
  const configured =
    process.env.INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;

  return (configured || "http://localhost:8000").replace(/\/+$/, "");
}

function buildTargetUrl(request: Request, path: string[]): string {
  const requestUrl = new URL(request.url);
  const encodedPath = path.map((segment) => encodeURIComponent(segment)).join("/");
  const suffix = encodedPath ? `/${encodedPath}` : "";
  const target = new URL(`/api/project-evaluations${suffix}`, backendBaseUrl());
  target.search = requestUrl.search;
  return target.toString();
}

function copyRequestHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
    headers.set(key, value);
  }
  return headers;
}

function copyResponseHeaders(response: Response): Headers {
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  return headers;
}

async function proxyProjectEvaluations(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { path = [] } = await context.params;
  const init: ProxyRequestInit = {
    method: request.method,
    headers: copyRequestHeaders(request),
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(buildTargetUrl(request, path), init);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return Response.json(
      {
        detail: {
          stage: "api_proxy",
          reason: "backend_unreachable",
          message: `백엔드 API에 연결할 수 없습니다: ${message}`,
        },
      },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: copyResponseHeaders(upstream),
  });
}

export function GET(request: Request, context: RouteContext): Promise<Response> {
  return proxyProjectEvaluations(request, context);
}

export function POST(request: Request, context: RouteContext): Promise<Response> {
  return proxyProjectEvaluations(request, context);
}

export function PUT(request: Request, context: RouteContext): Promise<Response> {
  return proxyProjectEvaluations(request, context);
}

export function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return proxyProjectEvaluations(request, context);
}

export function DELETE(request: Request, context: RouteContext): Promise<Response> {
  return proxyProjectEvaluations(request, context);
}
