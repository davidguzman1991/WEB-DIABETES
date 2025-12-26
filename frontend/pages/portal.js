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
          <>
            <p className="muted">Medicacion actual</p>
            <div className="list">
              <div className="list-item">
                <div className="list-title">
                  {new Date(current.created_at).toLocaleDateString()}
                </div>
                {current.diagnosis && (
                  <div className="list-meta">Diagnostico: {current.diagnosis}</div>
                )}
                {current.indications && (
                  <div className="list-meta">Indicaciones: {current.indications}</div>
                )}
                <div className="list">
                  {current.medications.map((med) => (
                    <div key={med.id} className="list-item">
                      <div className="list-title">{med.drug_name}</div>
                      <div className="list-meta">
                        {[med.dose, med.frequency, med.route, med.duration]
                          .filter(Boolean)
                          .join(" / ")}
                      </div>
                      {med.indications && <div className="list-meta">{med.indications}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
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
