import { useEffect, useState } from "react";
import Link from "next/link";
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

  if (loading) {
    return (
      <div className="page">
        <div className="card portal-detail-card">
          <h1>Tratamiento</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card portal-detail-card">
        <h1>Tratamiento</h1>
        <Link
          className="button button-secondary"
          href={consultationId ? `/portal/consultas/${consultationId}` : "/portal/historial"}
        >
          Volver a consulta
        </Link>
        {error && <div className="error">{error}</div>}
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
              <div key={medKey} className="flash-card">
                <div className="flash-title">{med.drug_name}</div>
                <div className="flash-row">
                  <span className="flash-label">Dosis</span>
                  <span className="flash-value">
                    {quantityValue !== "" ? quantityValue : "Sin dato"}
                  </span>
                </div>
                {durationValue !== "" && (
                  <div className="flash-row">
                    <span className="flash-label">Duracion</span>
                    <span className="flash-value">{durationValue} dias</span>
                  </div>
                )}
                {descriptionValue && (
                  <div className="flash-note">{descriptionValue}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
