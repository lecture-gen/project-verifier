// 백엔드 FastAPI 와의 통신을 담당하는 fetch 래퍼.
// CLAUDE.md 정책: silent fallback 금지. 실패 응답은 ApiError 로 그대로 throw.

export interface ApiAuth {
  sessionId?: string | null;
  sessionToken?: string | null;
}

export interface ApiRequestOptions extends ApiAuth {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  // JSON 직렬화 대상. FormData / Blob / string / null 도 그대로 전송.
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  // 응답을 Response 그대로 반환할지 (TTS audio stream 등 binary 응답용).
  raw?: boolean;
  // SSR / Route Handler에서 docker network 내부 호출용 INTERNAL_API_BASE_URL 강제.
  internal?: boolean;
}

export interface ApiErrorDetail {
  message: string;
  status: number;
  // FastAPI 가 돌려준 detail 원본 (string | object | array). 디버깅용.
  detail: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(payload: ApiErrorDetail) {
    super(payload.message);
    this.name = "ApiError";
    this.status = payload.status;
    this.detail = payload.detail;
  }
}

const PUBLIC_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const INTERNAL_BASE = process.env.INTERNAL_API_BASE_URL ?? PUBLIC_BASE;

function resolveBaseUrl(internal: boolean): string {
  // 브라우저(window 존재)에서는 항상 PUBLIC_BASE.
  if (typeof window !== "undefined") return PUBLIC_BASE;
  return internal ? INTERNAL_BASE : PUBLIC_BASE;
}

function appendQuery(path: string, query?: ApiRequestOptions["query"]): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  if (!qs) return path;
  return path.includes("?") ? `${path}&${qs}` : `${path}?${qs}`;
}

function buildHeaders(options: ApiRequestOptions, body: BodyInit | null): Headers {
  const headers = new Headers(options.headers ?? {});
  if (options.sessionId) headers.set("X-Session-Id", options.sessionId);
  if (options.sessionToken) headers.set("X-Session-Token", options.sessionToken);

  if (body !== null && !(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

function serializeBody(body: unknown): BodyInit | null {
  if (body === undefined || body === null) return null;
  if (body instanceof FormData) return body;
  if (body instanceof Blob) return body;
  if (typeof body === "string") return body;
  if (body instanceof ArrayBuffer) return body;
  return JSON.stringify(body);
}

function detailToMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail.trim().length > 0) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as Record<string, unknown> | undefined;
    if (first && typeof first.msg === "string") return first.msg;
  }
  if (detail && typeof detail === "object") {
    const obj = detail as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.detail === "string") return obj.detail;
  }
  return fallback;
}

function htmlErrorToMessage(text: string, fallback: string): string {
  if (!text.trimStart().toLowerCase().startsWith("<!doctype html")) return fallback;
  return "API 서버가 JSON 대신 HTML을 반환했습니다. API base URL 또는 /api 프록시 설정을 확인하세요.";
}

async function parseError(response: Response): Promise<ApiError> {
  const fallback = `${response.status} ${response.statusText}`.trim();
  let detail: unknown = null;
  const ct = response.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const data = (await response.json()) as { detail?: unknown };
      detail = data?.detail ?? data;
    } else {
      const text = await response.text();
      detail = text.length > 0 ? htmlErrorToMessage(text, fallback) : null;
    }
  } catch {
    detail = null;
  }
  return new ApiError({
    status: response.status,
    detail,
    message: detailToMessage(detail, fallback),
  });
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const url = `${resolveBaseUrl(options.internal ?? false)}${appendQuery(path, options.query)}`;
  const body = serializeBody(options.body);
  const headers = buildHeaders(options, body);
  const response = await fetch(url, {
    method: options.method ?? (body ? "POST" : "GET"),
    headers,
    body,
    signal: options.signal,
    // 동일 출처가 아닌 dev 환경(localhost:3000 → localhost:8000) 대비.
    credentials: "omit",
    cache: "no-store",
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  if (options.raw) return response as unknown as T;

  if (response.status === 204) return undefined as T;
  const ct = response.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return (await response.json()) as T;
  }
  // 비-JSON 성공 응답 (예: audio/mpeg) 은 raw 옵션을 통해 받아야 한다.
  // 호출자가 raw 를 누락한 경우 silent decode 하지 않고 명시적으로 실패시킨다.
  throw new ApiError({
    status: response.status,
    detail: ct,
    message: `예상치 못한 응답 Content-Type: ${ct || "(없음)"}`,
  });
}

// TTS 등 binary 스트림 응답을 받기 위한 헬퍼. Response 를 그대로 돌려준다.
export async function apiFetchRaw(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Response> {
  return apiFetch<Response>(path, { ...options, raw: true });
}
