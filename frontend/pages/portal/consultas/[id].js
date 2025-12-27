import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import { apiFetch, logout } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";

export default function ConsultaDetalle() {
  const router = useRouter();
  const { user, loading } = useAuthGuard({ redirectTo: "/login" });
  const [consulta, setConsulta] = useState(null);
  const [error, setError] = useState("");
  const [labs, setLabs] = useState([]);
  const [labsMessage, setLabsMessage] = useState("");

  useEffect(() => {
    if (!user || !router.query.id) return;
    if (String(user.role).toLowerCase() !== "patient") {
      logout(router, "/login");
      return;
    }
    apiFetch(`/patient/consultations/${router.query.id}`)
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
        setConsulta(data);
      })
      .catch(() => {
        setError("Error al cargar consulta");
      });

    apiFetch(`/consultas/${router.query.id}/labs`)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) {
          setLabs([]);
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setLabs(list);
        if (!list.length) {
          setLabsMessage("No existen laboratorios registrados");
        }
      })
      .catch(() => {
        setLabs([]);
      });
  }, [router, user]);

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <h1>Consulta</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <h1>Consulta</h1>
        <Link className="button" href="/portal/historial">
          ← Volver al historial
        </Link>
        {error && <div className="error">{error}</div>}
        {consulta && (
          <>
            <div className="consultation-card">
              <div className="consultation-date">
                {new Date(consulta.created_at).toLocaleDateString()}
              </div>
              {consulta.diagnosis && (
                <div className="consultation-diagnosis">{consulta.diagnosis}</div>
              )}
              {consulta.notes && (
                <div className="consultation-notes">{consulta.notes}</div>
              )}
              {consulta.indications && (
                <div className="consultation-notes">{consulta.indications}</div>
              )}
              <div className="section-title">Medicacion</div>
              <div className="medications-list">
                {consulta.medications.map((med) => {
                  const metaParts = [];
                  if (med.quantity !== null && med.quantity !== undefined) {
                    metaParts.push(`Cantidad ${med.quantity}`);
                  }
                  if (med.duration_days !== null && med.duration_days !== undefined) {
                    metaParts.push(`Duracion ${med.duration_days} dias`);
                  }
                  return (
                    <div key={med.id} className="medication-card">
                      <div className="medication-name">{med.drug_name}</div>
                      {!!metaParts.length && (
                        <div className="medication-meta">{metaParts.join(" · ")}</div>
                      )}
                      {med.description && (
                        <div className="medication-description">{med.description}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="section-title">Laboratorios</div>
            {labsMessage && <div className="muted">{labsMessage}</div>}
            <div className="lab-list">
              {labs.map((lab) => (
                <div key={lab.id} className="lab-card">
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
          </>
        )}
      </div>
    </div>
  );
}
