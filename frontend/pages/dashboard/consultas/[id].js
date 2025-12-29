import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import { api } from "../../../lib/api";

const API_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

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

const fetchConsultation = async (token, consultationId) => {
  const res = await fetch(`${API_URL}/admin/consultations/${consultationId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    const err = new Error("Unauthorized");
    err.code = "unauthorized";
    throw err;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = data?.detail || "No se pudo cargar la consulta";
    throw new Error(detail);
  }

  return res.json();
};

export default function AdminConsultationDetail() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setToken(api.getToken("admin"));
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
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
    fetchConsultation(token, consultationId)
      .then((data) => {
        if (!active) return;
        setDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        if (err?.code === "unauthorized") {
          api.clearToken("admin");
          router.replace("/login?type=admin");
          return;
        }
        setError(err?.message || "No se pudo cargar la consulta");
        setLoading(false);
        router.replace("/dashboard");
      });

    return () => {
      active = false;
    };
  }, [router, router.isReady, router.query.id, token]);

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
          <Link className="button button-secondary" href="/dashboard">
            Volver al dashboard
          </Link>
          {error && <div className="error">{error}</div>}
          {detail && (
            <>
              <div className="consultation-card">
                <div className="consultation-label">Paciente</div>
                <div className="consultation-patient">{detail.patient_full_name}</div>
                {detail.date && (
                  <div className="consultation-date">{formatDate(detail.date)}</div>
                )}
                {detail.diagnosis && (
                  <div className="consultation-diagnosis">{detail.diagnosis}</div>
                )}
                {detail.indications && (
                  <>
                    <div className="consultation-label">Indicaciones</div>
                    <div className="consultation-notes">{detail.indications}</div>
                  </>
                )}
              </div>

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
