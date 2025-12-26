import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { api } from "../lib/api";

export default function Login() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginType = useMemo(() => {
    const type = typeof router.query.type === "string" ? router.query.type : "patient";
    return type === "admin" ? "admin" : "patient";
  }, [router.query.type]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const isAdmin = loginType === "admin";
      const endpoint = isAdmin ? "/auth/admin/login" : "/auth/patient/login";
      const body = isAdmin
        ? { username: identifier, password }
        : { cedula: identifier, password };
      const data = await api.request(endpoint, {
        method: "POST",
        body
      });
      api.setToken(isAdmin ? "admin" : "patient", data.access_token);
      router.push(isAdmin ? "/dashboard" : "/portal");
    } catch (err) {
      setError("Credenciales invalidas");
    }
  };

  const isAdmin = loginType === "admin";

  return (
    <div className="page">
      <div className="card">
        <h1>{isAdmin ? "Ingreso Administrador" : "Ingreso Paciente"}</h1>
        {!isAdmin && <p className="muted">Credenciales temporales: apellido + nombre.</p>}
        <form onSubmit={onSubmit} className="form">
          <label>
            {isAdmin ? "Usuario" : "Cedula"}
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          </label>
          <label>
            Contrasena
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <div className="error">{error}</div>}
          <button type="submit">Entrar</button>
        </form>
        {isAdmin ? (
          <Link className="link" href="/login">
            Volver a paciente
          </Link>
        ) : (
          <Link className="link" href="/login?type=admin">
            Administrador
          </Link>
        )}
      </div>
    </div>
  );
}
