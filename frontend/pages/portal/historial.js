import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { apiFetch, logout } from "../../lib/auth";
import { useAuthGuard } from "../../hooks/useAuthGuard";

export default function PortalHistorial() {
  const router = useRouter();
  const { user, loading } = useAuthGuard({ redirectTo: "/login" });
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const formatDate = (value) => {
    if (!value) return "";
    // Si es una fecha sin hora (solo fecha, formato YYYY-MM-DD), parsearla directamente
    // para evitar problemas de zona horaria
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      if (Number.isNaN(date.getTime())) return "";
      return date.toLocaleDateString("es-EC", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
    // Para fechas con hora (datetime), usar el constructor normal
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
    setMessage("");
    setError("");
    apiFetch("/patient/consultations")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) {
          setItems([]);
          setError("No se pudo cargar la informacion");
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setItems(list);
        if (!list.length) {
          setMessage("No existen consultas registradas");
        }
      })
      .catch(() => {
        setItems([]);
        setError("No se pudo cargar la informacion");
      });
  }, [router, user]);

  const patientName = items?.[0]?.patient
    ? [items[0].patient.nombres, items[0].patient.apellidos].filter(Boolean).join(" ")
    : "";
  const recordsCount = Array.isArray(items) ? items.length : 0;

  if (loading) {
    return (
      <div className="page" style={{ background: "#f8fafc", minHeight: "100vh" }}>
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <section className="portal-medical-card">
            <div className="portal-medical-empty-state">
              <div className="portal-medical-empty-state-icon">...</div>
              <p className="portal-medical-empty-state-text">Cargando...</p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="portal-medical-header">
          <h1>Historial clinico</h1>
          <p className="portal-medical-header-subtitle">
            Revise sus consultas anteriores.
          </p>
          <div className="portal-medical-header-info">
            <div className="portal-medical-header-info-item">
              <span className="portal-medical-header-info-label">Paciente</span>
              <span className="portal-medical-header-info-value">
                {patientName || "Paciente"}
              </span>
            </div>
            <div className="portal-medical-header-info-item">
              <span className="portal-medical-header-info-label">Consultas</span>
              <span className="portal-medical-header-info-value">{recordsCount}</span>
            </div>
          </div>
          <div className="portal-medical-header-actions">
            <button
              type="button"
              onClick={() => router.push("/portal")}
              className="portal-medical-button portal-medical-button-secondary portal-medical-button-small"
            >
              Volver al portal
            </button>
          </div>
        </header>

        <section className="portal-medical-card">
          <div className="portal-medical-card-header">
            <div className="portal-medical-card-title-section">
              <div className="portal-medical-card-icon history">HC</div>
              <div className="portal-medical-card-title-group">
                <h2 className="portal-medical-card-title">Consultas</h2>
                <p className="portal-medical-card-subtitle">
                  Acceda al detalle de cada consulta registrada.
                </p>
              </div>
            </div>
          </div>
          <div className="portal-medical-card-content">
            {error && (
              <div className="portal-medical-alert portal-medical-alert-error">
                {error}
              </div>
            )}

            {message && !error && (
              <div className="portal-medical-empty-state">
                <div className="portal-medical-empty-state-icon">HC</div>
                <p className="portal-medical-empty-state-text">{message}</p>
              </div>
            )}

            {!message && !error && (
              <div className="portal-medical-list">
                {items.map((item) => {
                  const diagnosisText =
                    item.diagnosis || item.indications || "Consulta registrada";
                  return (
                    <div key={item.id} className="portal-medical-list-item">
                      <div>
                        <div className="portal-medical-list-title">
                          Consulta {formatDate(item.consultation_date || item.created_at)}
                        </div>
                        <div className="portal-medical-list-meta">{diagnosisText}</div>
                      </div>
                      <button
                        type="button"
                        className="portal-medical-button portal-medical-button-secondary portal-medical-button-small"
                        onClick={() => router.push(`/portal/consultas/${item.id}`)}
                      >
                        Ver consulta
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
