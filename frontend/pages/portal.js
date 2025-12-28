import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { getToken, logout } from "../lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Portal() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [current, setCurrent] = useState(null);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [patientName, setPatientName] = useState("");
  const [glucoseForm, setGlucoseForm] = useState({
    date: "",
    value: "",
    observation: "",
  });
  const [glucoseLogs, setGlucoseLogs] = useState([]);
  const [glucoseLoading, setGlucoseLoading] = useState(false);
  const [glucoseError, setGlucoseError] = useState("");
  const [glucoseSaving, setGlucoseSaving] = useState(false);

  const authFetch = async (path, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body && !headers["Content-Type"] && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    const body =
      options.body && headers["Content-Type"] === "application/json"
        ? JSON.stringify(options.body)
        : options.body;
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      body,
    });
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

  useEffect(() => {
    let active = true;
    const storedToken = getToken();
    if (active) {
      setToken(storedToken);
    }
    if (!storedToken) {
      if (active) setAuthLoading(false);
      router.replace("/login");
    }
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setAuthLoading(true);
    setAuthError("");
    authFetch("/auth/me")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          if (active) setAuthError("No se pudo validar la sesion");
          logout(router, "/login");
          return;
        }
        if (String(data.role || "").toLowerCase() !== "patient") {
          logout(router, "/login");
          return;
        }
        if (active) {
          setUser(data);
          setAuthError("");
        }
      })
      .catch(() => {
        if (active) setAuthError("No se pudo validar la sesion");
        logout(router, "/login");
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router, token]);

  useEffect(() => {
    if (!token || !user) return;
    let active = true;
    setLoadingCurrent(true);
    setMessage("");
    setError("");
    authFetch("/patient/medication/current")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) {
          if (active) setError("No se pudo cargar la informacion");
          return;
        }
        const data = await res.json().catch(() => null);
        if (!data) {
          if (active) {
            setCurrent(null);
            setMessage("No existen consultas registradas");
          }
          return;
        }
        if (active) setCurrent(data);
      })
      .catch(() => {
        if (active) setError("No se pudo cargar la informacion");
      })
      .finally(() => {
        if (active) setLoadingCurrent(false);
      });

    return () => {
      active = false;
    };
  }, [router, token, user]);

  useEffect(() => {
    if (!token || !current?.id) return;
    let active = true;
    authFetch(`/consultations/${current.id}/print`)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!active || !data?.patient) return;
        const fullName = [data.patient.nombres, data.patient.apellidos]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (fullName && active) {
          setPatientName(fullName);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [current?.id, router, token]);

  useEffect(() => {
    if (!token || !user?.id) return;
    let active = true;
    const load = async () => {
      setGlucoseLoading(true);
      setGlucoseError("");
      try {
        const res = await authFetch(`/glucoses/patient/${user.id}`);
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) {
          if (active) setGlucoseError("No se pudo cargar el historial de glucosas");
          return;
        }
        const data = await res.json().catch(() => []);
        if (active) setGlucoseLogs(Array.isArray(data) ? data : []);
      } catch (err) {
        if (active) setGlucoseError("No se pudo cargar el historial de glucosas");
      } finally {
        if (active) setGlucoseLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [router, token, user?.id]);

  const onGlucoseChange = (event) => {
    const { name, value } = event.target;
    setGlucoseForm((prev) => ({ ...prev, [name]: value }));
  };

  const onGlucoseSubmit = async (event) => {
    event.preventDefault();
    setGlucoseError("");
    if (!token || !user?.id) {
      setGlucoseError("Sesion no valida");
      return;
    }
    if (!glucoseForm.date || !glucoseForm.value) {
      setGlucoseError("Fecha y valor son requeridos");
      return;
    }
    const numericValue = Number(glucoseForm.value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setGlucoseError("El valor debe ser un numero positivo");
      return;
    }
    setGlucoseSaving(true);
    try {
      const takenAt = new Date(`${glucoseForm.date}T00:00:00`);
      const payload = {
        patient_id: user?.id || null,
        value: numericValue,
        type: "ayuno",
        taken_at: Number.isNaN(takenAt.getTime()) ? null : takenAt.toISOString(),
        observation: glucoseForm.observation.trim() || null,
      };
      const res = await authFetch("/glucoses", {
        method: "POST",
        body: payload,
      });
      if (res.status === 401 || res.status === 403) {
        logout(router, "/login");
        return;
      }
      if (!res.ok) {
        setGlucoseError("No se pudo guardar el registro");
        return;
      }
      setGlucoseForm({ date: "", value: "", observation: "" });
      const resList = await authFetch(`/glucoses/patient/${user.id}`);
      if (resList.ok) {
        const data = await resList.json().catch(() => []);
        setGlucoseLogs(Array.isArray(data) ? data : []);
      } else {
        setGlucoseLogs([]);
      }
    } catch (err) {
      setGlucoseError("No se pudo guardar el registro");
    } finally {
      setGlucoseSaving(false);
    }
  };

  const appointmentUrl =
    process.env.NEXT_PUBLIC_APPOINTMENT_URL || "https://example.com";
  const nextVisitDate = current?.next_visit_date || null;
  const today = new Date();
  const normalizeDate = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  };
  const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const normalizedNext = nextVisitDate ? normalizeDate(nextVisitDate) : null;
  const diffMs = normalizedNext ? normalizedNext.getTime() - normalizedToday.getTime() : null;
  const diffDays = diffMs === null ? null : Math.ceil(diffMs / 86400000);
  let nextVisitStatus = "neutral";
  let nextVisitText = "Su medico aun no ha programado la proxima cita.";
  if (diffDays !== null) {
    if (diffDays > 30) {
      nextVisitStatus = "ok";
      nextVisitText = `Su proximo control esta programado para ${formatDate(nextVisitDate)}. Faltan ${diffDays} dias.`;
    } else if (diffDays >= 0) {
      nextVisitStatus = "warn";
      nextVisitText = `Su control medico esta proximo (${formatDate(nextVisitDate)}). Faltan ${diffDays} dias.`;
    } else {
      const overdue = Math.abs(diffDays);
      nextVisitStatus = "overdue";
      nextVisitText = `Su control medico estaba programado para ${formatDate(nextVisitDate)} y presenta un retraso de ${overdue} dias. Por favor agende una cita.`;
    }
  }

  const safeGlucoseLogs = Array.isArray(glucoseLogs) ? glucoseLogs : [];

  if (authLoading || loadingCurrent) {
    return (
      <div className="page">
        <div className="card">
          <h1>Portal</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="page">
        <div className="card">
          <h1>Portal</h1>
          <div className="error">{authError}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card portal-shell">
        <div className="portal-dashboard">
          <header className="portal-header">
            <h1 className="portal-title">
              Bienvenido/a, {" "}
              <span className="portal-name">
                {patientName || user?.username || ""}
              </span>
            </h1>
            <p className="portal-subtitle">
              Este portal le permite consultar su tratamiento, revisar su historial
              medico y registrar informacion solicitada por su medico. No reemplaza
              una consulta presencial.
            </p>
          </header>
          <div className={`portal-banner portal-banner-${nextVisitStatus}`}>
            {nextVisitText}
          </div>
          {error && <div className="error">{error}</div>}
          {message && <div className="muted">{message}</div>}
          <section className="portal-section">
            <div className="section-title">Plan de tratamiento actual</div>
            {current ? (
              <Link
                className="portal-card portal-card-highlight"
                href={`/portal/consultas/${current.id}`}
              >
                <div className="portal-card-title">
                  Consulta {formatDate(current.created_at)}
                </div>
                <div className="portal-card-note">Ver detalle de la consulta</div>
              </Link>
            ) : (
              <div className="muted">No existen consultas registradas.</div>
            )}
          </section>

          <section className="portal-section">
            <div className="section-title">Mis glucosas</div>
            <div className="portal-card glucose-card">
              <form onSubmit={onGlucoseSubmit} className="form glucose-form">
                <label>
                  Fecha
                  <input
                    type="date"
                    name="date"
                    value={glucoseForm.date}
                    onChange={onGlucoseChange}
                    required
                  />
                </label>
                <label>
                  Valor (mg/dL)
                  <input
                    type="number"
                    name="value"
                    value={glucoseForm.value}
                    onChange={onGlucoseChange}
                    required
                  />
                </label>
                <label>
                  Observacion (opcional)
                  <textarea
                    name="observation"
                    value={glucoseForm.observation}
                    onChange={onGlucoseChange}
                  />
                </label>
                {glucoseError && <div className="error">{glucoseError}</div>}
                <button type="submit" disabled={glucoseSaving}>
                  {glucoseSaving ? "Guardando..." : "Guardar registro"}
                </button>
              </form>
              <div className="glucose-list">
                {glucoseLoading && <div className="muted">Cargando historial...</div>}
                {!glucoseLoading && safeGlucoseLogs.length === 0 && (
                  <div className="muted">No hay registros de glucosa.</div>
                )}
                {safeGlucoseLogs.map((log, index) => {
                  if (!log || typeof log !== "object") return null;
                  const logId =
                    log.id ||
                    `${log.taken_at || log.created_at || "glucose"}-${index}`;
                  const logDate = log.taken_at || log.created_at;
                  const logValue =
                    log.value !== null && log.value !== undefined
                      ? `${log.value} mg/dL`
                      : "Sin valor";
                  const noteText = log.observation || log.notes || log.description;
                  return (
                    <div key={logId} className="glucose-item">
                      <div className="glucose-meta">{formatDate(logDate)}</div>
                      <div className="glucose-value">{logValue}</div>
                      {noteText && <div className="glucose-note">{noteText}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="portal-section">
            <div className="section-title">Accesos rapidos</div>
            <div className="portal-actions">
              <Link className="portal-card portal-action" href="/portal/historial">
                <div className="portal-card-title">Historial de consultas</div>
                <div className="portal-card-note">Solo lectura</div>
              </Link>
              <Link className="portal-card portal-action" href="/portal/glucosas">
                <div className="portal-card-title">Historial de glucosas</div>
                <div className="portal-card-note">
                  Aqui podra registrar y revisar sus controles de glucosa cuando su
                  medico lo habilite.
                </div>
              </Link>
              <div className="portal-card portal-action portal-card-muted">
                <div className="portal-card-title">Tareas pendientes</div>
                <div className="portal-card-note">
                  Cuestionarios o registros solicitados por su medico.
                </div>
              </div>
              <a
                className="portal-card portal-action"
                href={appointmentUrl}
                target="_blank"
                rel="noreferrer"
              >
                <div className="portal-card-title">Agendar cita</div>
                <div className="portal-card-note">
                  Abrir enlace externo para coordinar su atencion.
                </div>
              </a>
            </div>
          </section>

          <div className="portal-footer">
            <button type="button" onClick={() => logout(router)}>
              Cerrar sesion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
