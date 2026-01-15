import { useEffect, useState } from "react";
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
  const labsCount = Array.isArray(labs) ? labs.length : 0;

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
          <h1>Laboratorios</h1>
          <p className="portal-medical-header-subtitle">Resultados de laboratorio.</p>
          <div className="portal-medical-header-info">
            <div className="portal-medical-header-info-item">
              <span className="portal-medical-header-info-label">Resultados</span>
              <span className="portal-medical-header-info-value">{labsCount}</span>
            </div>
          </div>
          <div className="portal-medical-header-actions">
            <button
              type="button"
              onClick={() =>
                router.push(
                  consultationId ? `/portal/consultas/${consultationId}` : "/portal/historial"
                )
              }
              className="portal-medical-button portal-medical-button-secondary portal-medical-button-small"
            >
              Volver a consulta
            </button>
          </div>
        </header>

        <section className="portal-medical-card">
          <div className="portal-medical-card-header">
            <div className="portal-medical-card-title-section">
              <div className="portal-medical-card-icon labs">LB</div>
              <div className="portal-medical-card-title-group">
                <h2 className="portal-medical-card-title">Resultados actuales</h2>
                <p className="portal-medical-card-subtitle">
                  Revise los valores registrados en la consulta.
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

            {labs.length === 0 && !error && (
              <div className="portal-medical-empty-state">
                <div className="portal-medical-empty-state-icon">LB</div>
                <p className="portal-medical-empty-state-text">
                  No hay resultados registrados.
                </p>
              </div>
            )}

            {labs.length > 0 && (
              <div className="portal-medical-lab-list">
                {labs.map((lab, index) => {
                  if (!lab || typeof lab !== "object") return null;
                  const resultValue = lab.valor_num ?? lab.valor_texto ?? "";
                  const resultLabel = resultValue !== "" ? resultValue : "Sin resultado";
                  const unit = lab.unidad_snapshot ? ` ${lab.unidad_snapshot}` : "";
                  const labKey = `${lab.lab_nombre || "lab"}-${index}`;
                  return (
                    <div key={labKey} className="portal-medical-lab-item">
                      <div className="portal-medical-lab-header">
                        <div className="portal-medical-lab-name">
                          {lab.lab_nombre || "Examen"}
                        </div>
                        <div className="portal-medical-lab-value">
                          {resultLabel}
                          {resultValue !== "" ? unit : ""}
                        </div>
                      </div>
                      <div className="portal-medical-lab-meta">
                        {lab.rango_ref_snapshot && (
                          <span>Rango: {lab.rango_ref_snapshot}</span>
                        )}
                      </div>
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
