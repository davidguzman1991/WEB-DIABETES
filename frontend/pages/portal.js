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

  const appointmentUrl =
    process.env.NEXT_PUBLIC_APPOINTMENT_URL || "https://example.com";

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
      <div className="card portal-shell">
        <div className="portal-dashboard">
          <header className="portal-header">
            <h1 className="portal-title">
              Bienvenido/a,{" "}
              <span className="portal-name">
                {patientName || user?.username || ""}
              </span>
            </h1>
            <p className="portal-subtitle">
              Este portal le permite consultar su tratamiento, revisar su historial
              medico y registrar informacion solicitada por su medico. No reemplaza
              una consulta presencial.
            </p>
          </header>
          <div className="portal-banner">
            Seguimiento recomendado cada 90 dias segun su ultimo control.
          </div>
          {error && <div className="error">{error}</div>}
          {message && <div className="muted">{message}</div>}
          <section className="portal-section">
            <div className="section-title">Plan de tratamiento actual</div>
            {current ? (
              <Link
                className="portal-card portal-card-highlight"
                href={`/portal/consultas/${current.id}`}
              >
                <div className="portal-card-title">
                  Consulta {formatDate(current.created_at)}
                </div>
                <div className="portal-card-note">Ver detalle de la consulta</div>
              </Link>
            ) : (
              <div className="muted">No existen consultas registradas.</div>
            )}
          </section>

          <section className="portal-section">
            <div className="section-title">Accesos rapidos</div>
            <div className="portal-actions">
              <Link className="portal-card portal-action" href="/portal/historial">
                <div className="portal-card-title">Historial de consultas</div>
                <div className="portal-card-note">Solo lectura</div>
              </Link>
              <Link className="portal-card portal-action" href="/portal/glucosas">
                <div className="portal-card-title">Historial de glucosas</div>
                <div className="portal-card-note">
                  Aqui podra registrar y revisar sus controles de glucosa cuando su
                  medico lo habilite.
                </div>
              </Link>
              <div className="portal-card portal-action portal-card-muted">
                <div className="portal-card-title">Tareas pendientes</div>
                <div className="portal-card-note">
                  Cuestionarios o registros solicitados por su medico.
                </div>
              </div>
              <a
                className="portal-card portal-action"
                href={appointmentUrl}
                target="_blank"
                rel="noreferrer"
              >
                <div className="portal-card-title">Agendar cita</div>
                <div className="portal-card-note">
                  Abrir enlace externo para coordinar su atencion.
                </div>
              </a>
            </div>
          </section>

          <div className="portal-footer">
            <button type="button" onClick={() => logout(router)}>
              Cerrar sesion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
