import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import { apiFetch, logout } from "../../../../lib/auth";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";

export default function LaboratoriosConsulta() {
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
  const labs = Array.isArray(detail?.labs) ? detail.labs : [];

  if (loading) {
    return (
      <div className="page">
        <div className="card portal-detail-card">
          <h1>Resultados de laboratorio</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card portal-detail-card">
        <h1>Resultados de laboratorio</h1>
        <Link
          className="button button-secondary"
          href={consultationId ? `/portal/consultas/${consultationId}` : "/portal/historial"}
        >
          Volver a consulta
        </Link>
        {error && <div className="error">{error}</div>}
        <div className="medications-list">
          {labs.length === 0 && <div className="muted">No hay resultados registrados.</div>}
          {labs.map((lab, index) => {
            if (!lab || typeof lab !== "object") return null;
            const resultValue = lab.valor_num ?? lab.valor_texto ?? "";
            const resultLabel = resultValue !== "" ? resultValue : "Sin resultado";
            const unit = lab.unidad_snapshot ? ` ${lab.unidad_snapshot}` : "";
            const labKey = `${lab.lab_nombre || "lab"}-${index}`;
            return (
              <div key={labKey} className="flash-card">
                <div className="flash-title">{lab.lab_nombre || "Examen"}</div>
                <div className="flash-row">
                  <span className="flash-label">Resultado</span>
                  <span className="flash-value">
                    {resultLabel}
                    {resultValue !== "" ? unit : ""}
                  </span>
                </div>
                {lab.rango_ref_snapshot && (
                  <div className="flash-note">Rango: {lab.rango_ref_snapshot}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
