import { useState } from "react";
import { useRouter } from "next/router";

import { apiFetch, clearToken, fetchMe, setToken } from "../../lib/auth";

export default function AdminLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/auth/admin/login", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setError("Credenciales invalidas");
        return;
      }
      if (!res.ok) {
        setError("Error de conexion con el servidor");
        return;
      }
      if (!data?.access_token) {
        setError("Error de conexion con el servidor");
        return;
      }
      setToken(data.access_token);
      try {
        const me = await fetchMe();
        const role = String(me?.role || "").toLowerCase();
        router.replace(role === "admin" ? "/dashboard" : "/portal");
      } catch (err) {
        clearToken();
        setError("Error de conexion con el servidor");
      }
    } catch (err) {
      setError("Error de conexion con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <h1>Admin Login</h1>
        {error && <div className="error">{error}</div>}
        <form className="form" onSubmit={onSubmit}>
          <label>
            Usuario
            <input name="username" value={form.username} onChange={onChange} required />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={onChange}
              required
            />
          </label>
          <button type="submit" className="button-primary" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
