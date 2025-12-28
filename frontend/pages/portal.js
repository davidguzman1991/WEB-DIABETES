import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { apiFetch, logout } from "../lib/auth";
import { useAuthGuard } from "../hooks/useAuthGuard";

export default function Portal() {
  const router = useRouter();
  const { user, loading } = useAuthGuard({ redirectTo: "/login" });
  const [current, setCurrent] = useState(null);
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [patientName, setPatientName] = useState("");

  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  useEffect(() => {
    if (!user) return;
    if (String(user.role).toLowerCase() !== "patient") {
      logout(router, "/login");
      return;
    }
    setLoadingCurrent(true);
    setMessage("");
    setError("");
    apiFetch("/patient/medication/current")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) {
          setError("No se pudo cargar la informacion");
          return;
        }
        const data = await res.json().catch(() => null);
        if (!data) {
          setCurrent(null);
          setMessage("No existen consultas registradas");
          return;
        }
        setCurrent(data);
      })
      .catch(() => {
        setError("No se pudo cargar la informacion");
      })
      .finally(() => {
        setLoadingCurrent(false);
      });
  }, [router, user]);

  useEffect(() => {
    if (!current?.id) return;
    let active = true;
    apiFetch(`/consultations/${current.id}/print`)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!active || !data?.patient) return;
        const fullName = [data.patient.nombres, data.patient.apellidos]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (fullName) {
          setPatientName(fullName);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [current?.id, router]);

  if (loading || loadingCurrent) {
    return (
      <div className="page">
        <div className="card">
          <h1>Portal</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <h1>Portal</h1>
        <div className="portal-welcome">
          <div className="portal-welcome-line">
            Bienvenido/a,{" "}
            <span className="portal-welcome-name">
              {patientName || user?.username || ""}
            </span>
          </div>
          <div className="portal-welcome-subtitle">
            Este es su plan de tratamiento actual basado en su ultima consulta medica.
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        {message && <div className="muted">{message}</div>}
        <div className="section-title">Tratamiento o plan actual</div>
        {current && (
          <Link
            className="consultation-card portal-plan-card consultation-link"
            href={`/portal/consultas/${current.id}`}
          >
            <div className="consultation-date">
              Consulta {formatDate(current.created_at)}
            </div>
          </Link>
        )}
        <Link className="button" href="/portal/historial">
          Ver historial
        </Link>
        <button type="button" onClick={() => logout(router)}>
          Cerrar sesion
        </button>
      </div>
    </div>
  );
}
