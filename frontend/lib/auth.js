import { API_URL } from "./config";
const TOKEN_KEY = "token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
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
    credentials: options.credentials || "include",
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
    const error = new Error(message);
    error.status = res.status;
    error.authFailure = res.status === 401 || res.status === 403;
    throw error;
  }
  if (!data) {
    const error = new Error("Invalid auth response");
    error.status = res.status;
    error.authFailure = false;
    throw error;
  }
  return data;
}
