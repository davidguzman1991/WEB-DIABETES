import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { apiFetch, clearToken, fetchMe, setToken } from "../lib/auth";

const REMEMBER_ADMIN_KEY = "remembered_admin_username";
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_MS = 30000;

export default function Login() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUser, setRememberUser] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const loginType = useMemo(() => {
    const type = typeof router.query.type === "string" ? router.query.type : "patient";
    return type === "admin" ? "admin" : "patient";
  }, [router.query.type]);

  useEffect(() => {
    if (loginType !== "admin") return;
    try {
      const stored = localStorage.getItem(REMEMBER_ADMIN_KEY);
      if (stored) {
        setIdentifier(stored);
        setRememberUser(true);
      }
    } catch {
      // Ignore storage failures.
    }
  }, [loginType]);

  useEffect(() => {
    if (!lockoutUntil) return;
    const tick = () => {
      const remainingMs = Math.max(0, lockoutUntil - Date.now());
      const seconds = Math.ceil(remainingMs / 1000);
      setLockoutSeconds(seconds);
      if (remainingMs <= 0) {
        setLockoutUntil(null);
        setLockoutSeconds(0);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [lockoutUntil]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (lockoutUntil) {
      setError("Demasiados intentos. Intente nuevamente en unos segundos.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      const isAdmin = loginType === "admin";
      const endpoint = isAdmin ? "/auth/admin/login" : "/auth/patient/login";
      const body = isAdmin
        ? { username: identifier, password }
        : { cedula: identifier, password };
      const res = await apiFetch(endpoint, {
        method: "POST",
        body
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setError(
          isAdmin
            ? "Credenciales incorrectas. Verifique su usuario y contraseña."
            : "Credenciales incorrectas. Verifique su cédula y contraseña."
        );
        setFailedAttempts((prev) => {
          const next = prev + 1;
          if (next >= MAX_FAILED_ATTEMPTS) {
            setLockoutUntil(Date.now() + LOCKOUT_MS);
            return 0;
          }
          return next;
        });
        return;
      }
      if (!res.ok) {
        setError("No se pudo conectar con el servidor. Intente nuevamente.");
        return;
      }
      if (!data?.access_token) {
        setError("No se pudo iniciar sesión. Intente nuevamente.");
        return;
      }
      setToken(data.access_token);
      try {
        const me = await fetchMe();
        const role = String(me?.role || "").toLowerCase();
        if (isAdmin) {
          try {
            if (rememberUser) {
              localStorage.setItem(REMEMBER_ADMIN_KEY, identifier);
            } else {
              localStorage.removeItem(REMEMBER_ADMIN_KEY);
            }
          } catch {
            // Ignore storage failures.
          }
        }
        setFailedAttempts(0);
        router.push(role === "admin" ? "/dashboard" : "/portal");
      } catch (err) {
        clearToken();
        setError("No se pudo validar la sesión. Intente nuevamente.");
      }
    } catch (err) {
      setError("No se pudo conectar con el servidor. Intente nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdmin = loginType === "admin";
  const isLocked = Boolean(lockoutUntil);
  const isDisabled = isSubmitting || isLocked;
  const pageClassName = isAdmin ? "page" : "page login-hero";
  const contentClassName =
    "login-hero-content flex w-full items-center justify-center px-4 py-8 sm:px-6 sm:py-10";
  const cardClassName = `${isAdmin ? "card" : "card login-card"} w-full !mt-0`;
  const formClassName = `form ${isAdmin ? "mt-6" : "mt-4"}`;

  return (
    <div className={pageClassName}>
      <div className={contentClassName}>
        <div className={cardClassName}>
          {isAdmin ? (
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  WD
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">
                    Acceso Administrador
                  </h1>
                  <p className="text-sm text-slate-500">
                    Portal Administrativo Clínico
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h1 className="login-title">
                Bienvenido al portal de gestión médica del Dr. David Guzmán
              </h1>
              <p className="login-subtitle">
                Acceda de forma segura a su información médica
              </p>
            </>
          )}
          <form onSubmit={onSubmit} className={formClassName}>
            <label>
              {isAdmin ? "Usuario" : "Cédula"}
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={isAdmin ? "Usuario" : "Ingrese su cédula"}
                disabled={isDisabled}
                required
              />
            </label>
            <label>
              Contraseña
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  disabled={isDisabled}
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-slate-500 transition hover:text-slate-700"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={isDisabled}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </label>
            {isAdmin && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberUser}
                  onChange={(event) => setRememberUser(event.target.checked)}
                  disabled={isDisabled}
                />
                Recordar usuario
              </label>
            )}
            {error && <div className="error">{error}</div>}
            {isAdmin && isLocked && lockoutSeconds > 0 && (
              <div className="error">
                Demasiados intentos. Intente nuevamente en {lockoutSeconds}s.
              </div>
            )}
            <button
              type="submit"
              className={`${isAdmin ? "button-primary" : "button-primary login-button"} w-full`}
              disabled={isDisabled}
            >
              {isSubmitting ? "Ingresando..." : "Entrar"}
            </button>
          </form>
          {isAdmin && (
            <p className="muted text-sm">
              Acceso restringido. Se registran intentos fallidos.
            </p>
          )}
          {!isAdmin && (
            <p className="login-disclaimer">
              <span className="login-disclaimer-title">Aviso importante:</span>
              La información disponible en este portal corresponde a indicaciones
              médicas registradas durante su consulta. No sustituye una valoración
              médica presencial ni debe utilizarse para emergencias.
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
