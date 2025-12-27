import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import { apiFetch, logout } from "../../../lib/auth";

const CLINIC_NAME = "WEB DIABETES";
const CLINIC_SPECIALTY = "Clinica de Diabetes";
const CLINIC_LOCATION = "Ciudad, Pais";

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

function formatDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString();
}

export default function ConsultationPrint() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!router.isReady) return;
    const { consultaId } = router.query;
    if (!consultaId) return;

    setLoading(true);
    setError("");

    apiFetch(`/consultations/${consultaId}/print`)
      .then(async (res) => {
        if (res.status === 401) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          setError(payload.detail || "No se pudo cargar la consulta");
          setLoading(false);
          return;
        }
        const payload = await res.json();
        setData(payload);
        setLoading(false);
      })
      .catch(() => {
        setError("No se pudo cargar la consulta");
        setLoading(false);
      });
  }, [router]);

  const age = useMemo(() => computeAge(data?.patient?.fecha_nacimiento), [data]);
  const medications = data?.medications || [];
  const labs = data?.labs || [];

  if (loading) {
    return (
      <div className="print-page">
        <div className="print-header">
          <div>
            <div className="print-title">{CLINIC_NAME}</div>
            <div className="print-subtitle">{CLINIC_SPECIALTY}</div>
            <div className="print-meta">{CLINIC_LOCATION}</div>
          </div>
        </div>
        <div className="print-empty">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="print-page">
      <header className="print-header">
        <div>
          <div className="print-title">{CLINIC_NAME}</div>
          <div className="print-subtitle">{CLINIC_SPECIALTY}</div>
          <div className="print-meta">{CLINIC_LOCATION}</div>
        </div>
        <div className="print-meta">
          Fecha de consulta: {formatDate(data?.consultation?.created_at)}
        </div>
      </header>

      {error && <div className="print-error">{error}</div>}

      {data && (
        <>
          <section className="print-section">
            <h2>Paciente</h2>
            <div className="print-grid">
              <div>
                <div className="print-label">Nombre completo</div>
                <div className="print-text">
                  {data.patient.nombres} {data.patient.apellidos}
                </div>
              </div>
              <div>
                <div className="print-label">Cedula</div>
                <div className="print-text">{data.patient.cedula}</div>
              </div>
              <div>
                <div className="print-label">Fecha nacimiento</div>
                <div className="print-text">
                  {formatDate(data.patient.fecha_nacimiento)}
                </div>
              </div>
              <div>
                <div className="print-label">Edad</div>
                <div className="print-text">{age === null ? "--" : `${age} anos`}</div>
              </div>
            </div>
          </section>

          <section className="print-section">
            <h2>Consulta</h2>
            <div className="print-text">
              <span className="print-label">Diagnostico: </span>
              {data.consultation.diagnosis || "--"}
            </div>
            <div className="print-text">
              <span className="print-label">Notas medicas: </span>
              {data.consultation.notes || "--"}
            </div>
            <div className="print-text">
              <span className="print-label">Indicaciones generales: </span>
              {data.consultation.indications || "--"}
            </div>
          </section>

          <section className="print-section">
            <h2>Receta medica</h2>
            {medications.length === 0 ? (
              <div className="print-empty">Sin medicamentos registrados</div>
            ) : (
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Medicamento</th>
                    <th>Cantidad</th>
                    <th>Descripcion</th>
                    <th>Duracion (dias)</th>
                  </tr>
                </thead>
                <tbody>
                  {medications.map((med, index) => (
                    <tr key={`${med.drug_name}-${index}`}>
                      <td>{med.drug_name}</td>
                      <td>{med.quantity ?? "--"}</td>
                      <td>{med.description || "--"}</td>
                      <td>{med.duration_days ?? "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="print-section">
            <h2>Laboratorios</h2>
            {labs.length === 0 ? (
              <div className="print-empty">Sin laboratorios registrados</div>
            ) : (
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Examen</th>
                    <th>Valor</th>
                    <th>Unidad</th>
                    <th>Rango ref</th>
                  </tr>
                </thead>
                <tbody>
                  {labs.map((lab, index) => (
                    <tr key={`${lab.lab_nombre}-${index}`}>
                      <td>{lab.lab_nombre}</td>
                      <td>
                        {lab.valor_num ?? lab.valor_texto ?? "--"}
                      </td>
                      <td>{lab.unidad_snapshot || "--"}</td>
                      <td>{lab.rango_ref_snapshot || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      <footer className="print-footer">
        <div>
          <div className="print-line" />
          <div>Firma y sello</div>
          <div>{CLINIC_NAME}</div>
        </div>
        <div>
          Este documento contiene informacion confidencial destinada exclusivamente al
          paciente.
        </div>
      </footer>
    </div>
  );
}
