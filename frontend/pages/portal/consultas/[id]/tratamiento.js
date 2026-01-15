import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { apiFetch, logout } from "../../../../lib/auth";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";

export default function TratamientoConsulta() {
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
  const medications = Array.isArray(detail?.medications) ? detail.medications : [];
  const medicationCount = Array.isArray(medications) ? medications.length : 0;

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
          <h1>Tratamiento</h1>
          <p className="portal-medical-header-subtitle">Como tomar sus medicamentos.</p>
          <div className="portal-medical-header-info">
            <div className="portal-medical-header-info-item">
              <span className="portal-medical-header-info-label">Medicamentos</span>
              <span className="portal-medical-header-info-value">{medicationCount}</span>
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
              <div className="portal-medical-card-icon treatment">TR</div>
              <div className="portal-medical-card-title-group">
                <h2 className="portal-medical-card-title">Medicacion</h2>
                <p className="portal-medical-card-subtitle">
                  Detalle de medicamentos prescritos.
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

            {medications.length === 0 && !error && (
              <div className="portal-medical-empty-state">
                <div className="portal-medical-empty-state-icon">TR</div>
                <p className="portal-medical-empty-state-text">
                  No hay medicacion registrada.
                </p>
              </div>
            )}

            {medications.length > 0 && (
              <div className="portal-medical-medication-list">
                {medications.map((med, index) => {
                  if (!med || typeof med !== "object") return null;
                  const quantityValue = med.quantity ?? "";
                  const durationValue = med.duration_days ?? "";
                  const descriptionValue = med.description ?? "";
                  const medKey = `${med.drug_name || "med"}-${index}`;
                  const chipItems = [];
                  if (quantityValue !== "") chipItems.push(`Dosis: ${quantityValue}`);
                  if (med.horario) chipItems.push(`Horario: ${med.horario}`);
                  if (med.via) chipItems.push(`Via: ${med.via}`);
                  if (durationValue !== "") {
                    chipItems.push(`Duracion: ${durationValue} dias`);
                  }
                  return (
                    <div key={medKey} className="portal-medical-medication-item">
                      <div style={{ flex: 1 }}>
                        <div className="portal-medical-medication-name">
                          {med.drug_name || "Medicamento"}
                        </div>
                        {chipItems.length > 0 && (
                          <div className="portal-medical-medication-details">
                            {chipItems.map((chip) => (
                              <span key={chip} className="portal-medical-medication-badge">
                                {chip}
                              </span>
                            ))}
                          </div>
                        )}
                        {descriptionValue && (
                          <div className="portal-medical-note" style={{ marginTop: 12 }}>
                            {descriptionValue}
                          </div>
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
