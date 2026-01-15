import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { apiFetch, logout } from "../../../../lib/auth";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";

export default function IndicacionesConsulta() {
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
  const indicationsText = (detail?.consultation?.indications || "").trim();

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
          <h1>Indicaciones</h1>
          <p className="portal-medical-header-subtitle">
            Recomendaciones para su consulta.
          </p>
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
              <div className="portal-medical-card-icon history">IN</div>
              <div className="portal-medical-card-title-group">
                <h2 className="portal-medical-card-title">Indicaciones medicas</h2>
                <p className="portal-medical-card-subtitle">
                  Revise las recomendaciones del especialista.
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
            {!error && indicationsText && (
              <div className="portal-medical-indications">
                <div className="portal-medical-indications-title">Indicaciones</div>
                <p className="portal-medical-indications-text">{indicationsText}</p>
              </div>
            )}
            {!error && !indicationsText && (
              <div className="portal-medical-empty-state">
                <div className="portal-medical-empty-state-icon">IN</div>
                <p className="portal-medical-empty-state-text">
                  No hay indicaciones registradas.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
