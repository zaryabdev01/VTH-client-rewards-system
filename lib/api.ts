/** Tiny typed fetch wrapper for our own API. Throws ApiErr with the server's message + payload. */
export class ApiErr extends Error {
  constructor(public status: number, message: string, public data: Record<string, any> = {}) { super(message); }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method, credentials: "same-origin", headers: body !== undefined ? { "content-type": "application/json" } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiErr(0, "Can't reach the server. Check your connection and try again.", { network: true });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiErr(res.status, data.error ?? "Something went wrong", data);
  return data as T;
}

export const api = {
  get: <T>(p: string) => call<T>("GET", p),
  post: <T>(p: string, b: unknown = {}) => call<T>("POST", p, b),
  patch: <T>(p: string, b: unknown) => call<T>("PATCH", p, b),
  put: <T>(p: string, b: unknown) => call<T>("PUT", p, b),
};
