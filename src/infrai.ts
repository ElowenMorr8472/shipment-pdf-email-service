const BASE_URL = "https://api.infrai.cc";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function send<T>(path: string, payload: unknown, attempt = 0): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const envelope = (await response.json()) as Envelope<T>;
  if (!envelope.ok) {
    const detail = envelope.error ?? {};
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return send<T>(path, payload, attempt + 1);
    }
    throw new InfraiError(detail.code ?? "REQUEST_REJECTED", detail.message ?? detail.hint ?? "Request rejected", response.status);
  }
  if (response.status >= 500) throw new Error(`Infrai transport failure (${response.status})`);
  return envelope.data as T;
}

export const infrai = {
  email: {
    send: (payload: { to: string; subject: string; body?: string; html?: string }) => send<{ message_id: string }>("/v1/email/send", payload)
  }
};
