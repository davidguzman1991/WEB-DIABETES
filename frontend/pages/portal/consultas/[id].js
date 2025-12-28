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
  const [expandedMeds, setExpandedMeds] = useState({});
  const [labsOpen, setLabsOpen] = useState(false);
  const [labsMessage, setLabsMessage] = useState("");

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
        const list = Array.isArray(data?.labs) ? data.labs : [];
        if (!list.length) {
          setLabsMessage("No existen laboratorios registrados");
        } else {
          setLabsMessage("");
        }
      })
      .catch(() => {
        setError("Error al cargar consulta");
      });
  }, [router, user]);

  const toggleMedication = (id) => {
    setExpandedMeds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
                const metaParts = [];
                if (med.quantity !== null && med.quantity !== undefined) {
                  metaParts.push(`Cantidad ${med.quantity}`);
                }
                if (med.duration_days !== null && med.duration_days !== undefined) {
                  metaParts.push(`Duracion ${med.duration_days} dias`);
                }
                const medKey = `${med.drug_name}-${index}`;
                const isOpen = !!expandedMeds[medKey];
                return (
                  <div key={medKey} className="medication-card">
                    <button
                      type="button"
                      className="accordion-toggle"
                      onClick={() => toggleMedication(medKey)}
                      aria-expanded={isOpen}
                    >
                      <span className="medication-name">{med.drug_name}</span>
                      <span className="accordion-icon">{isOpen ? "-" : "+"}</span>
                    </button>
                    {isOpen && (
                      <div className="accordion-body">
                        {!!metaParts.length && (
                          <div className="medication-meta">{metaParts.join(" | ")}</div>
                        )}
                        {med.description && (
                          <div className="medication-description">{med.description}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="section-title">Resultados de laboratorio actuales</div>
            {labsMessage && <div className="muted">{labsMessage}</div>}
            <button
              type="button"
              className="accordion-toggle lab-toggle"
              onClick={() => setLabsOpen((prev) => !prev)}
              aria-expanded={labsOpen}
            >
              <span>Ver resultados</span>
              <span className="accordion-icon">{labsOpen ? "-" : "+"}</span>
            </button>
            {labsOpen && (
              <div className="lab-list">
                {labs.map((lab, index) => (
                  <div key={`${lab.lab_nombre}-${index}`} className="lab-card">
                    <div className="lab-row">
                      <div className="lab-name">{lab.lab_nombre}</div>
                      <div className="lab-value">
                        {lab.valor_num ?? lab.valor_texto}
                        {lab.unidad_snapshot ? ` ${lab.unidad_snapshot}` : ""}
                      </div>
                    </div>
                    {lab.rango_ref_snapshot && (
                      <div className="lab-range">Rango: {lab.rango_ref_snapshot}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
