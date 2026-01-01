import { useState } from "react";
import { useRouter } from "next/router";

import { apiFetch, clearToken, fetchMe, setToken } from "../../lib/auth";

export default function PatientLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ cedula: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/auth/patient/login", {
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
      } catch {
        clearToken();
        setError("Error de conexion con el servidor");
      }
    } catch {
      setError("Error de conexion con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <h1>Ingreso Paciente</h1>
        {error && <div className="error">{error}</div>}
        <form className="form" onSubmit={onSubmit}>
          <label>
            Cedula
            <input name="cedula" value={form.cedula} onChange={onChange} required />
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
          <button type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
