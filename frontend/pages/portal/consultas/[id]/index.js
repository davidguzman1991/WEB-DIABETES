import { useEffect, useState } from "react";
import Link from "next/link";
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
  const headerDiagnosis = diagnosisText || "Diagnostico no registrado";

  if (loading) {
    return (
      <div className="page">
        <div className="card portal-detail-card">
          <h1>Consulta</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card portal-detail-card">
        <h1>Consulta</h1>
        <Link className="button button-secondary" href="/portal/historial">
          Volver al historial
        </Link>
        {error && <div className="error">{error}</div>}
        {detail && (
          <>
            <div className="consultation-header">
              <div className="consultation-header-title">{patientName}</div>
              <div className="consultation-header-meta">
                {age !== null ? `Edad: ${age} anos` : ""}
              </div>
              {consultation?.created_at && (
                <div className="consultation-header-meta">
                  Consulta {new Date(consultation.created_at).toLocaleDateString()}
                </div>
              )}
              <div className="consultation-header-diagnosis">{headerDiagnosis}</div>
            </div>

            {consultationId && (
              <div className="consultation-actions">
                <Link
                  className="consultation-action-card"
                  href={`/portal/consultas/${consultationId}/tratamiento`}
                >
                  <div className="consultation-action-title">Tratamiento</div>
                  <div className="consultation-action-meta">Detalle de medicamentos</div>
                </Link>
                <Link
                  className="consultation-action-card"
                  href={`/portal/consultas/${consultationId}/laboratorios`}
                >
                  <div className="consultation-action-title">
                    Resultados de laboratorio
                  </div>
                  <div className="consultation-action-meta">Resultados actuales</div>
                </Link>
                {indicationsText && (
                  <Link
                    className="consultation-action-card"
                    href={`/portal/consultas/${consultationId}/indicaciones`}
                  >
                    <div className="consultation-action-title">Indicaciones</div>
                    <div className="consultation-action-meta">
                      Recomendaciones medicas
                    </div>
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
