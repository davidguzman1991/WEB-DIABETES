import { useState } from "react";
import { useRouter } from "next/router";

import { apiFetch, setToken } from "../../lib/auth";

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
      if (!res.ok) {
        setError(data?.detail || "Credenciales invalidas");
        return;
      }
      if (!data?.access_token) {
        setError("Token invalido");
        return;
      }
      setToken(data.access_token);
      router.replace("/patient");
    } catch {
      setError("Error al iniciar sesion");
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
