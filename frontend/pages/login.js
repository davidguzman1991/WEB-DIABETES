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
  const pageClassName = isAdmin ? "page" : "page login-hero";
  const cardClassName = isAdmin ? "card" : "card login-card";

  return (
    <div className={pageClassName}>
      <div className="login-hero-content">
        <div className={cardClassName}>
          {isAdmin ? (
            <h1>Ingreso Administrador</h1>
          ) : (
            <>
              <h1 className="login-title">
                Bienvenido al portal de gestion medica del Dr. David Guzman
              </h1>
              <p className="login-subtitle">
                Acceda de forma segura a su informacion medica
              </p>
            </>
          )}
          <form onSubmit={onSubmit} className="form">
            <label>
              {isAdmin ? "Usuario" : "Cedula"}
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={isAdmin ? "Usuario" : "Ingrese su cedula"}
                required
              />
            </label>
            <label>
              Contrasena
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingrese su contrasena"
                required
              />
            </label>
            {error && <div className="error">{error}</div>}
            <button type="submit" className={isAdmin ? "" : "login-button"}>
              Entrar
            </button>
          </form>
          {!isAdmin && (
            <p className="login-disclaimer">
              <span className="login-disclaimer-title">Aviso importante:</span>
              La informacion disponible en este portal corresponde a indicaciones
              medicas registradas durante su consulta. No sustituye una valoracion
              medica presencial ni debe utilizarse para emergencias.
            </p>
          )}
          {isAdmin ? (
            <Link className="link" href="/login">
              Volver a paciente
            </Link>
          ) : (
            <Link className="link login-admin-link" href="/login?type=admin">
              Administrador
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
