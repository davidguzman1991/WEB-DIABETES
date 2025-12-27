import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { apiFetch, logout } from "../lib/auth";
import { useAuthGuard } from "../hooks/useAuthGuard";

export default function Portal() {
  const router = useRouter();
  const { user, loading } = useAuthGuard({ redirectTo: "/login" });
  const [current, setCurrent] = useState(null);
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    if (String(user.role).toLowerCase() !== "patient") {
      logout(router, "/login");
      return;
    }
    setLoadingCurrent(true);
    setMessage("");
    setError("");
    apiFetch("/patient/medication/current")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) {
          setError("No se pudo cargar la informacion");
          return;
        }
        const data = await res.json().catch(() => null);
        if (!data) {
          setCurrent(null);
          setMessage("No existen consultas registradas");
          return;
        }
        setCurrent(data);
      })
      .catch(() => {
        setError("No se pudo cargar la informacion");
      })
      .finally(() => {
        setLoadingCurrent(false);
      });
  }, [router, user]);

  if (loading || loadingCurrent) {
    return (
      <div className="page">
        <div className="card">
          <h1>Portal</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <h1>Portal</h1>
        {error && <div className="error">{error}</div>}
        {message && <div className="muted">{message}</div>}
        {current && (
          <div className="consultation-card">
            <div className="consultation-date">
              {new Date(current.created_at).toLocaleDateString()}
            </div>
            {current.diagnosis && (
              <div className="consultation-diagnosis">{current.diagnosis}</div>
            )}
            {current.indications && (
              <div className="consultation-notes">{current.indications}</div>
            )}
            <div className="section-title">Medicacion</div>
            <div className="medications-list">
              {current.medications.map((med) => {
                const metaParts = [];
                if (med.quantity !== null && med.quantity !== undefined) {
                  metaParts.push(`Cantidad ${med.quantity}`);
                }
                if (med.duration_days !== null && med.duration_days !== undefined) {
                  metaParts.push(`Duracion ${med.duration_days} dias`);
                }
                return (
                  <div key={med.id} className="medication-card">
                    <div className="medication-name">{med.drug_name}</div>
                    {!!metaParts.length && (
                      <div className="medication-meta">{metaParts.join(" · ")}</div>
                    )}
                    {med.description && (
                      <div className="medication-description">{med.description}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <Link className="button" href="/portal/historial">
          Ver historial
        </Link>
        <button type="button" onClick={() => logout(router)}>
          Cerrar sesion
        </button>
      </div>
    </div>
  );
}
