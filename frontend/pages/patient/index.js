import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { apiFetch, clearToken, getToken, logout } from "../../lib/auth";

export default function PatientDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const token = getToken();
    if (!token) {
      router.replace("/patient/login");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    apiFetch("/auth/me")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          clearToken();
          router.replace("/patient/login");
          return;
        }
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (!active) return;
          setError(data?.detail || "No se pudo validar la sesion");
          setLoading(false);
          return;
        }
        if (!active) return;
        setUser(data);
        setError("");
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("No se pudo validar la sesion");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <h1>Paciente</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="card">
          <h1>Paciente</h1>
          <div className="error">{error}</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="page">
      <div className="card">
        <h1>Paciente</h1>
        <div>Usuario: {user.username}</div>
        <div>Rol: {user.role}</div>
        <div>Activo: {user.activo ? "Si" : "No"}</div>
        <button type="button" onClick={() => logout(router, "/patient/login")}>
          Cerrar sesion
        </button>
      </div>
    </div>
  );
}
