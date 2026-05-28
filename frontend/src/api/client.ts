const defaultApiBase =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8080/api/v1`
    : "http://localhost:8080/api/v1";

const rawBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const API_BASE = (rawBase && rawBase.length > 0 ? rawBase : defaultApiBase).replace(/\/+$/, "");

// Direct AI service URL — used only for SSE streaming connections.
// SSE needs a persistent long-lived connection; the Spring Boot proxy buffers responses.
const rawAiBase = (import.meta.env.VITE_AI_SERVICE_URL as string | undefined)?.trim();
const AI_SERVICE_BASE = (rawAiBase && rawAiBase.length > 0 ? rawAiBase : "http://localhost:8001").replace(/\/+$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly detail?: string;
  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new ApiError(
      response.status,
      detail || `Request failed (${response.status})`,
      detail,
    );
  }
  return response.json() as Promise<T>;
}

// ── SSE streaming ─────────────────────────────────────────────────────────────

export type SseEvent = { event: string; data: string };

/**
 * Opens a POST-based SSE stream to the AI service.
 * Yields {event, data} pairs as they arrive from the server.
 *
 * Usage:
 *   for await (const { event, data } of ssePost("/agents/intake/stream-question", body)) { ... }
 */
export async function* ssePost(
  path: string,
  body: object,
): AsyncGenerator<SseEvent> {
  const res = await fetch(`${AI_SERVICE_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    throw new Error(`SSE request failed: ${res.status}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer       = "";
  let currentEvent = "message";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";   // keep incomplete last line in buffer

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        yield { event: currentEvent, data: line.slice(6) };
        currentEvent = "message"; // reset after each data line
      }
      // blank lines (SSE dispatch boundaries) are ignored
    }
  }
}

export function getApiOrigin(): string {
  return API_BASE.replace(/\/api\/v1\/?$/, "");
}

/** WebSocket URL for demo emergency vitals stream (same host/port as REST API). */
export function getVitalsWebSocketUrl(): string {
  const origin = getApiOrigin();
  const wsProto = origin.startsWith("https") ? "wss" : "ws";
  const hostPath = origin.replace(/^https?:\/\//, "");
  return `${wsProto}://${hostPath}/api/v1/emergency/vitals/ws`;
}

export { API_BASE };
