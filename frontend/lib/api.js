const API_URL = process.env.NEXT_PUBLIC_API_URL;

function getToken(role) {
  return typeof window === "undefined" ? null : localStorage.getItem(`token_${role}`);
}

function setToken(role, token) {
  if (typeof window !== "undefined") {
    localStorage.setItem(`token_${role}`, token);
  }
}

function clearToken(role) {
  if (typeof window !== "undefined") {
    localStorage.removeItem(`token_${role}`);
  }
}

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error inesperado");
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getToken,
  setToken,
  clearToken,
  request
};
