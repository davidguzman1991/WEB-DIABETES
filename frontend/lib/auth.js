const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const TOKEN_KEY = "token";
const LEGACY_ADMIN_TOKEN_KEY = "token_admin";
const LEGACY_PATIENT_TOKEN_KEY = "token_patient";

export function getToken() {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem(LEGACY_ADMIN_TOKEN_KEY) ||
    localStorage.getItem(LEGACY_PATIENT_TOKEN_KEY)
  );
}

export function setToken(token) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_ADMIN_TOKEN_KEY);
  localStorage.removeItem(LEGACY_PATIENT_TOKEN_KEY);
}

export function logout(router, redirectPath = "/login") {
  clearToken();
  if (router) {
    router.replace(redirectPath);
    return;
  }
  if (typeof window !== "undefined") {
    window.location.href = redirectPath;
  }
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const body =
    options.body && headers["Content-Type"] === "application/json"
      ? JSON.stringify(options.body)
      : options.body;

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body,
  });
}

export async function fetchMe() {
  const res = await apiFetch("/auth/me");
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = data?.detail || "Unauthorized";
    throw new Error(message);
  }
  return data;
}
