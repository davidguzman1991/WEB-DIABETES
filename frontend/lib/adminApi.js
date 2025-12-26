const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

const ADMIN_TOKEN_KEY = "admin_token";

export function getAdminToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

function buildHeaders(token, extraHeaders) {
  const headers = { ...(extraHeaders || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

export async function adminRequest(
  path,
  { method = "GET", body, token, router, headers } = {}
) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: buildHeaders(token, headers),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 || res.status === 403) {
    clearAdminToken();
    if (router) {
      router.replace("/admin/login");
    } else if (typeof window !== "undefined") {
      window.location.href = "/admin/login";
    }
    throw new Error("Unauthorized");
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.detail ? `${res.status}: ${data.detail}` : `Error ${res.status}`;
    throw new Error(detail);
  }
  return data;
}

export async function adminRequestHtml(path, { token, router } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (res.status === 401 || res.status === 403) {
    clearAdminToken();
    if (router) {
      router.replace("/admin/login");
    } else if (typeof window !== "undefined") {
      window.location.href = "/admin/login";
    }
    throw new Error("Unauthorized");
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${text}`);
  }
  return text;
}
