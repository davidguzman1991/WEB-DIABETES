import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import { apiFetch, logout } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";

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

  const patient = detail?.patient || null;
  const consultation = detail?.consultation || null;
  const medications = detail?.medications || [];
  const labs = detail?.labs || [];
  const age = computeAge(patient?.fecha_nacimiento);
  const indicationsText = consultation?.indications || "";

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
        <Link className="button" href="/portal/historial">
          Volver al historial
        </Link>
        {error && <div className="error">{error}</div>}
        {detail && (
          <>
            <div className="consultation-card">
              {patient && (
                <>
                  <div className="consultation-label">Paciente</div>
                  <div className="consultation-patient">
                    {patient.nombres} {patient.apellidos}
                  </div>
                </>
              )}
              {age !== null && <div className="consultation-meta">Edad: {age} años</div>}
              {consultation?.created_at && (
                <div className="consultation-date">
                  {new Date(consultation.created_at).toLocaleDateString()}
                </div>
              )}
              {consultation?.diagnosis && (
                <div className="consultation-diagnosis">{consultation.diagnosis}</div>
              )}
              {indicationsText && (
                <>
                  <div className="consultation-label">Indicaciones</div>
                  <div className="consultation-notes">{indicationsText}</div>
                </>
              )}
            </div>

            <div className="section-title">Medicacion actual</div>
            <div className="medications-list">
              {medications.length === 0 && (
                <div className="muted">No hay medicacion registrada.</div>
              )}
              {medications.map((med, index) => {
                const quantityValue = med.quantity ?? "";
                const durationValue = med.duration_days ?? "";
                const descriptionValue = med.description ?? "";
                const medKey = `${med.drug_name}-${index}`;
                return (
                  <details key={medKey} className="accordion">
                    <summary className="accordion-title">
                      <span className="medication-name">{med.drug_name}</span>
                    </summary>
                    <div className="accordion-content">
                      {quantityValue !== "" && (
                        <div className="detail-row">
                          <span className="detail-label">Cantidad</span>
                          <span className="detail-value">{quantityValue}</span>
                        </div>
                      )}
                      {durationValue !== "" && (
                        <div className="detail-row">
                          <span className="detail-label">Duracion</span>
                          <span className="detail-value">{durationValue} dias</span>
                        </div>
                      )}
                      {descriptionValue && (
                        <div className="detail-row detail-block">
                          <span className="detail-label">Descripcion</span>
                          <span className="detail-value">{descriptionValue}</span>
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>

            {labs.length > 0 && (
              <>
                <div className="section-title">Resultados de laboratorio actuales</div>
                <div className="medications-list">
                  {labs.map((lab, index) => {
                    const resultValue = lab.valor_num ?? lab.valor_texto ?? "";
                    const resultLabel = resultValue !== "" ? resultValue : "Sin resultado";
                    const unit = lab.unidad_snapshot ? ` ${lab.unidad_snapshot}` : "";
                    return (
                      <details key={`${lab.lab_nombre}-${index}`} className="accordion">
                        <summary className="accordion-title">
                          <span className="medication-name">{lab.lab_nombre}</span>
                        </summary>
                        <div className="accordion-content">
                          <div className="detail-row">
                            <span className="detail-label">Resultado</span>
                            <span className="detail-value">
                              {resultLabel}
                              {resultValue !== "" ? unit : ""}
                            </span>
                          </div>
                          {lab.rango_ref_snapshot && (
                            <div className="detail-row">
                              <span className="detail-label">Rango</span>
                              <span className="detail-value">{lab.rango_ref_snapshot}</span>
                            </div>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
