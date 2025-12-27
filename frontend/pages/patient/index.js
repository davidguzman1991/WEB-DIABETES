import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { apiFetch, clearToken, getToken, logout } from "../../lib/auth";

export default function PatientDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [medication, setMedication] = useState(null);
  const [medsLoading, setMedsLoading] = useState(false);
  const [medsError, setMedsError] = useState("");
  const [consultations, setConsultations] = useState([]);
  const [consultationsLoading, setConsultationsLoading] = useState(false);
  const [consultationsError, setConsultationsError] = useState("");

  useEffect(() => {
    let active = true;
    const token = getToken();
    if (!token) {
      router.replace("/patient/login");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    apiFetch("/auth/me")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          clearToken();
          router.replace("/patient/login");
          return;
        }
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (!active) return;
          setError(data?.detail || "No se pudo validar la sesion");
          setLoading(false);
          return;
        }
        if (!data || String(data.role).toLowerCase() !== "patient") {
          if (!active) return;
          logout(router, "/patient/login");
          return;
        }
        if (!active) return;
        setUser(data);
        setError("");
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("No se pudo validar la sesion");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setMedsLoading(true);
    setMedsError("");
    apiFetch("/patient/medication/current")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/patient/login");
          return;
        }
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (!active) return;
          setMedsError(data?.detail || "No se pudo cargar la medicacion actual");
          setMedsLoading(false);
          return;
        }
        if (!active) return;
        setMedication(data);
        setMedsError("");
        setMedsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setMedsError("No se pudo cargar la medicacion actual");
        setMedsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router, user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setConsultationsLoading(true);
    setConsultationsError("");
    apiFetch("/patient/consultations")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/patient/login");
          return;
        }
        const data = await res.json().catch(() => []);
        if (!res.ok) {
          if (!active) return;
          setConsultationsError(data?.detail || "No se pudo cargar el historial");
          setConsultationsLoading(false);
          return;
        }
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setConsultations(list);
        setConsultationsError("");
        setConsultationsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setConsultationsError("No se pudo cargar el historial");
        setConsultationsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router, user]);

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <h1>Paciente</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="card">
          <h1>Paciente</h1>
          <div className="error">{error}</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="page">
      <div className="card">
        <h1>Paciente</h1>
        <div>Usuario: {user.username}</div>
        <div>Rol: {user.role}</div>
        <div>Activo: {user.activo ? "Si" : "No"}</div>
        <button type="button" onClick={() => logout(router, "/patient/login")}>
          Cerrar sesion
        </button>
      </div>
      <div className="card">
        <h2>Medicacion actual</h2>
        {medsLoading && <p className="muted">Cargando medicacion actual...</p>}
        {!medsLoading && medsError && <div className="error">{medsError}</div>}
        {!medsLoading && !medsError && (!medication || !medication.medications?.length) && (
          <p className="muted">Aun no tienes medicacion registrada.</p>
        )}
        {!medsLoading && !medsError && medication?.medications?.length ? (
          <div className="list">
            {medication.medications.map((med) => (
              <div key={med.id} className="list-item">
                <div className="list-title">{med.drug_name}</div>
                {med.quantity !== null && med.quantity !== undefined && (
                  <div className="list-meta">Cantidad: {med.quantity}</div>
                )}
                {med.description && (
                  <div className="list-meta">Descripcion: {med.description}</div>
                )}
                {med.duration_days !== null && med.duration_days !== undefined && (
                  <div className="list-meta">Duracion: {med.duration_days} dias</div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="card">
        <h2>Historial de consultas</h2>
        {consultationsLoading && <p className="muted">Cargando historial...</p>}
        {!consultationsLoading && consultationsError && (
          <div className="error">{consultationsError}</div>
        )}
        {!consultationsLoading && !consultationsError && consultations.length === 0 && (
          <p className="muted">Aun no tienes consultas registradas.</p>
        )}
        {!consultationsLoading && !consultationsError && consultations.length > 0 && (
          <div className="list">
            {consultations.map((item) => (
              <div key={item.id} className="list-item">
                <div className="list-title">
                  {item.created_at ? new Date(item.created_at).toLocaleDateString() : "Sin fecha"}
                </div>
                {item.diagnosis && <div className="list-meta">{item.diagnosis}</div>}
                {item.indications && <div className="list-meta">{item.indications}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
