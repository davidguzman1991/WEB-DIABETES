import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { apiFetch, logout } from "../../../../lib/auth";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";

function computeAge(dateStr) {
  if (!dateStr) return null;
  const birth = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age < 0 ? null : age;
}

export default function ConsultaDetalle() {
  const router = useRouter();
  const { user, loading } = useAuthGuard({ redirectTo: "/login" });
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !router.query.id) return;
    if (String(user.role).toLowerCase() !== "patient") {
      logout(router, "/login");
      return;
    }
    apiFetch(`/consultations/${router.query.id}/print`)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.detail || "Error al cargar consulta");
          return;
        }
        const data = await res.json();
        setDetail(data);
      })
      .catch(() => {
        setError("Error al cargar consulta");
      });
  }, [router, user]);

  const consultationId = typeof router.query.id === "string" ? router.query.id : "";
  const patient = detail?.patient || null;
  const consultation = detail?.consultation || null;
  const diagnosisText = (consultation?.diagnosis || "").trim();
  const indicationsText = (consultation?.indications || "").trim();
  const age = computeAge(patient?.fecha_nacimiento);
  const patientName = patient
    ? [patient.nombres, patient.apellidos].filter(Boolean).join(" ")
    : "";
  const headerDiagnosis = diagnosisText || "Diagnóstico no registrado";
  // Función para formatear fecha, manejando correctamente fechas sin hora
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

  // Usar consultation_date si está disponible (fecha real de la consulta),
  // de lo contrario usar created_at (fecha de registro)
  const consultationDate = formatDate(
    consultation?.consultation_date || consultation?.created_at
  );
  const headerSubtitle = consultationDate || headerDiagnosis;

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
          <h1>Consulta</h1>
          <p className="portal-medical-header-subtitle">
            {headerSubtitle || "Detalle de la consulta"}
          </p>
          <div className="portal-medical-header-info">
            <div className="portal-medical-header-info-item">
              <span className="portal-medical-header-info-label">Paciente</span>
              <span className="portal-medical-header-info-value">
                {patientName || "Paciente"}
              </span>
            </div>
            <div className="portal-medical-header-info-item">
              <span className="portal-medical-header-info-label">Edad</span>
              <span className="portal-medical-header-info-value">
                {age !== null ? `${age} años` : "No disponible"}
              </span>
            </div>
            <div className="portal-medical-header-info-item">
              <span className="portal-medical-header-info-label">Fecha</span>
              <span className="portal-medical-header-info-value">
                {consultationDate || "Sin fecha"}
              </span>
            </div>
          </div>
          <div className="portal-medical-header-actions">
            <button
              type="button"
              onClick={() => router.push("/portal/historial")}
              className="portal-medical-button portal-medical-button-secondary portal-medical-button-small"
            >
              Volver al historial
            </button>
          </div>
        </header>

        {error && (
          <section className="portal-medical-card">
            <div className="portal-medical-card-content">
              <div className="portal-medical-alert portal-medical-alert-error">
                {error}
              </div>
            </div>
          </section>
        )}

        {!detail && !error && (
          <section className="portal-medical-card">
            <div className="portal-medical-empty-state">
              <div className="portal-medical-empty-state-icon">CS</div>
              <p className="portal-medical-empty-state-text">
                No se encontró información de la consulta.
              </p>
            </div>
          </section>
        )}

        {detail && (
          <div className="space-y-5">
            <section className="portal-medical-card">
              <div className="portal-medical-card-header">
                <div className="portal-medical-card-title-section">
                  <div className="portal-medical-card-icon history">DX</div>
                  <div className="portal-medical-card-title-group">
                    <h2 className="portal-medical-card-title">Diagnóstico / Motivo</h2>
                    <p className="portal-medical-card-subtitle">
                      Resumen clínico de la consulta.
                    </p>
                  </div>
                </div>
              </div>
              <div className="portal-medical-card-content">
                <div className="portal-medical-note">
                  {diagnosisText || "Diagnóstico no registrado."}
                </div>
              </div>
            </section>

            {consultationId && (
              <div className="grid gap-4 md:grid-cols-3">
                <section className="portal-medical-card">
                  <div className="portal-medical-card-content">
                    <div className="portal-medical-card-title">Tratamiento</div>
                    <p className="portal-medical-card-subtitle">Detalle de medicamentos.</p>
                    <button
                      type="button"
                      className="portal-medical-button portal-medical-button-secondary"
                      onClick={() =>
                        router.push(`/portal/consultas/${consultationId}/tratamiento`)
                      }
                    >
                      Ver tratamiento
                    </button>
                  </div>
                </section>

                <section className="portal-medical-card">
                  <div className="portal-medical-card-content">
                    <div className="portal-medical-card-title">Laboratorios</div>
                    <p className="portal-medical-card-subtitle">Resultados actuales.</p>
                    <button
                      type="button"
                      className="portal-medical-button portal-medical-button-secondary"
                      onClick={() =>
                        router.push(`/portal/consultas/${consultationId}/laboratorios`)
                      }
                    >
                      Ver laboratorios
                    </button>
                  </div>
                </section>

                {indicationsText && (
                  <section className="portal-medical-card">
                    <div className="portal-medical-card-content">
                      <div className="portal-medical-card-title">Indicaciones</div>
                      <p className="portal-medical-card-subtitle">
                        Recomendaciones médicas.
                      </p>
                      <button
                        type="button"
                        className="portal-medical-button portal-medical-button-secondary"
                        onClick={() =>
                          router.push(`/portal/consultas/${consultationId}/indicaciones`)
                        }
                      >
                        Ver indicaciones
                      </button>
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
