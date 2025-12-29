import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import { apiFetch, logout } from "../../lib/auth";
import { useAuthGuard } from "../../hooks/useAuthGuard";

export default function PortalHistorial() {
  const router = useRouter();
  const { user, loading } = useAuthGuard({ redirectTo: "/login" });
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  useEffect(() => {
    if (!user) return;
    if (String(user.role).toLowerCase() !== "patient") {
      logout(router, "/login");
      return;
    }
    setMessage("");
    setError("");
    apiFetch("/patient/consultations")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) {
          setItems([]);
          setError("No se pudo cargar la informacion");
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setItems(list);
        if (!list.length) {
          setMessage("No existen consultas registradas");
        }
      })
      .catch(() => {
        setItems([]);
        setError("No se pudo cargar la informacion");
      });
  }, [router, user]);

  const patientName = items?.[0]?.patient
    ? [items[0].patient.nombres, items[0].patient.apellidos].filter(Boolean).join(" ")
    : "";

  if (loading) {
    return (
      <div className="page">
        <div className="card portal-detail-card">
          <div className="portal-header">
            <h1 className="portal-title">Historial clinico</h1>
          </div>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card portal-detail-card">
        <header className="portal-header">
          <h1 className="portal-title">Historial clinico</h1>
          {patientName && <p className="portal-subtitle">{patientName}</p>}
        </header>
        <Link className="button ghost" href="/portal">
          &larr; Volver al portal
        </Link>
        {error && <div className="error">{error}</div>}
        {message && (
          <div className="consultation-card">
            <div className="consultation-meta">{message}</div>
          </div>
        )}
        {!message && !error && (
          <div className="medications-list">
            {items.map((item) => {
              const diagnosisText =
                item.diagnosis || item.indications || "Consulta registrada";
              return (
            <Link
              key={item.id}
              className="consultation-card consultation-link"
              href={`/portal/consultas/${item.id}`}
            >
              <div>
                <div className="consultation-date">
                  Consulta {formatDate(item.created_at)}
                </div>
                <div className="consultation-diagnosis">{diagnosisText}</div>
              </div>
              <div className="consultation-meta">Ver consulta</div>
            </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
