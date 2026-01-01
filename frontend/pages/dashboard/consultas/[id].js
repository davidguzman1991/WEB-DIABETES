import { useEffect, useState } from "react";
import { useRouter } from "next/router";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not set");
}

const readAdminToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
};

const clearAdminToken = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export default function AdminConsultationDetail() {
  const router = useRouter();
  const [token, setToken] = useState(undefined);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const readText = (...values) => {
    for (const value of values) {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
    }
    return "";
  };

  const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== "";

  useEffect(() => {
    setToken(readAdminToken());
  }, []);

  useEffect(() => {
    if (!router.isReady || token === undefined) return;
    const consultationId = Array.isArray(router.query.id)
      ? router.query.id[0]
      : router.query.id;

    if (!token) {
      setLoading(false);
      router.replace("/login?type=admin");
      return;
    }
    if (!consultationId) return;

    let active = true;
    setLoading(true);
    setError("");

    fetch(`${API_URL}/admin/consultations/${consultationId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          clearAdminToken();
          router.replace("/login?type=admin");
          return;
        }
        if (res.status === 404) {
          if (active) {
            setError("Consulta no encontrada");
            setLoading(false);
          }
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (active) {
            setError(data?.detail || "No se pudo cargar la consulta");
            setLoading(false);
          }
          return;
        }
        const data = await res.json().catch(() => null);
        if (active) {
          setDetail(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError("No se pudo cargar la consulta");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router, router.isReady, router.query.id, token]);

  const diagnosisText = readText(detail?.diagnosis, detail?.diagnostico);
  const indicationsText = readText(detail?.indications, detail?.indicaciones);
  const reasonText = readText(detail?.reason_for_visit, detail?.motivo_consulta);
  const historyText = readText(
    detail?.current_illness,
    detail?.historia_actual,
    detail?.notes,
    detail?.notas_medicas,
    detail?.notas
  );
  const examText = readText(detail?.physical_exam, detail?.examen_fisico);

  const vitalSource = detail?.vital_signs ?? detail?.signos_vitales;
  const vitalSigns =
    vitalSource && typeof vitalSource === "object" && !Array.isArray(vitalSource)
      ? vitalSource
      : null;
  const vitalRows = [
    { label: "Peso", value: vitalSigns?.weight ?? vitalSigns?.peso ?? detail?.weight },
    { label: "Talla", value: vitalSigns?.height ?? vitalSigns?.talla ?? detail?.height },
    {
      label: "Presion arterial",
      value: vitalSigns?.blood_pressure ?? vitalSigns?.presion_arterial ?? detail?.blood_pressure,
    },
    {
      label: "Frecuencia cardiaca",
      value:
        vitalSigns?.heart_rate ?? vitalSigns?.frecuencia_cardiaca ?? detail?.heart_rate,
    },
    {
      label: "Saturacion O2",
      value:
        vitalSigns?.oxygen_saturation ??
        vitalSigns?.saturacion_oxigeno ??
        detail?.oxygen_saturation,
    },
  ].filter((row) => hasValue(row.value));

  const medications = Array.isArray(detail?.medications) ? detail.medications : [];

  if (loading) {
    return (
      <div className="page">
        <div className="admin-shell">
          <div className="card portal-detail-card">
            <h1>Consulta</h1>
            <p className="muted">Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="admin-shell">
        <div className="card portal-detail-card">
          <h1>Consulta</h1>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => router.push("/dashboard")}
          >
            Volver al dashboard
          </button>
          {error && <div className="error">{error}</div>}
          {detail && (
            <>
              <div className="consultation-card">
                <div className="consultation-label">Paciente</div>
                <div className="consultation-patient">
                  {detail.patient_full_name ||
                    [detail?.patient?.nombres, detail?.patient?.apellidos]
                      .filter(Boolean)
                      .join(" ")}
                </div>
                {(detail.date || detail.created_at) && (
                  <div className="consultation-date">
                    {formatDate(detail.date || detail.created_at)}
                  </div>
                )}
              </div>

              {diagnosisText && (
                <details className="accordion">
                  <summary className="accordion-title">
                    <span className="medication-name">Diagnostico</span>
                  </summary>
                  <div className="accordion-content">
                    <div className="detail-row detail-block">
                      <span className="detail-value">{diagnosisText}</span>
                    </div>
                  </div>
                </details>
              )}

              {(reasonText || historyText) && (
                <details className="accordion">
                  <summary className="accordion-title">
                    <span className="medication-name">Motivo e historia actual</span>
                  </summary>
                  <div className="accordion-content">
                    {reasonText && (
                      <div className="detail-row detail-block">
                        <span className="detail-label">Motivo de consulta</span>
                        <span className="detail-value">{reasonText}</span>
                      </div>
                    )}
                    {historyText && (
                      <div className="detail-row detail-block">
                        <span className="detail-label">Historia actual</span>
                        <span className="detail-value">{historyText}</span>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {examText && (
                <details className="accordion">
                  <summary className="accordion-title">
                    <span className="medication-name">Examen fisico</span>
                  </summary>
                  <div className="accordion-content">
                    <div className="detail-row detail-block">
                      <span className="detail-value">{examText}</span>
                    </div>
                  </div>
                </details>
              )}

              {vitalRows.length > 0 && (
                <details className="accordion">
                  <summary className="accordion-title">
                    <span className="medication-name">Signos vitales</span>
                  </summary>
                  <div className="accordion-content">
                    {vitalRows.map((row) => (
                      <div key={row.label} className="detail-row">
                        <span className="detail-label">{row.label}</span>
                        <span className="detail-value">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {indicationsText && (
                <details className="accordion">
                  <summary className="accordion-title">
                    <span className="medication-name">Indicaciones generales</span>
                  </summary>
                  <div className="accordion-content">
                    <div className="detail-row detail-block">
                      <span className="detail-value">{indicationsText}</span>
                    </div>
                  </div>
                </details>
              )}

              <div className="section-title">Medicacion</div>
              <div className="medications-list">
                {medications.length === 0 && (
                  <div className="muted">No hay medicacion registrada.</div>
                )}
                {medications.map((med, index) => {
                  if (!med || typeof med !== "object") return null;
                  const quantityValue = med.quantity ?? "";
                  const durationValue = med.duration_days ?? "";
                  const descriptionValue = med.description ?? "";
                  const medKey = `${med.drug_name || "med"}-${index}`;
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
