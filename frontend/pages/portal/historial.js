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

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <h1>Historial</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <h1>Historial</h1>
        {error && <div className="error">{error}</div>}
        {message && <div className="muted">{message}</div>}
        <div className="list">
          {items.map((item) => (
            <Link
              key={item.id}
              className="history-card"
              href={`/portal/consultas/${item.id}`}
            >
              <div className="history-diagnosis">
                Consulta {formatDate(item.created_at)}
              </div>
            </Link>
          ))}
        </div>
        <Link className="button" href="/portal">
          Volver
        </Link>
      </div>
    </div>
  );
}
