import { useEffect, useState } from "react";
import Link from "next/link";
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
      <div className="page">
        <div className="card portal-detail-card">
          <h1>Indicaciones</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card portal-detail-card">
        <h1>Indicaciones</h1>
        <Link
          className="button button-secondary"
          href={consultationId ? `/portal/consultas/${consultationId}` : "/portal/historial"}
        >
          Volver a consulta
        </Link>
        {error && <div className="error">{error}</div>}
        {indicationsText ? (
          <div className="flash-card">
            <div className="flash-note">{indicationsText}</div>
          </div>
        ) : (
          <div className="muted">No hay indicaciones registradas.</div>
        )}
      </div>
    </div>
  );
}
