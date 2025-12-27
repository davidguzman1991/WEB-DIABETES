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
            <div className="list-meta">
              {new Date(consulta.created_at).toLocaleDateString()}
            </div>
            {consulta.diagnosis && (
              <div className="list-meta">Diagnostico: {consulta.diagnosis}</div>
            )}
            {consulta.notes && (
              <div className="list-meta">Notas: {consulta.notes}</div>
            )}
            {consulta.indications && (
              <div className="list-meta">Indicaciones: {consulta.indications}</div>
            )}
            <div className="list">
              {consulta.medications.map((med) => (
                <div key={med.id} className="list-item">
                  <div className="list-title">{med.drug_name}</div>
                  <div className="list-meta">
                    {[med.dose, med.frequency, med.route, med.duration]
                      .filter(Boolean)
                      .join(" / ")}
                  </div>
                  {med.indications && <div className="list-meta">{med.indications}</div>}
                </div>
              ))}
            </div>
            <h2>Laboratorios</h2>
            {labsMessage && <div className="muted">{labsMessage}</div>}
            <div className="list">
              {labs.map((lab) => (
                <div key={lab.id} className="list-item">
                  <div className="list-title">{lab.lab_nombre}</div>
                  <div className="list-meta">
                    {lab.valor_num ?? lab.valor_texto}
                    {lab.unidad_snapshot ? ` ${lab.unidad_snapshot}` : ""}
                  </div>
                  {lab.rango_ref_snapshot && (
                    <div className="list-meta">Rango: {lab.rango_ref_snapshot}</div>
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
