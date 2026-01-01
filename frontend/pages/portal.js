import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { getToken, logout } from "../lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not set");
}
const SKELETON_BASE = {
  backgroundColor: "#e5e7eb",
  borderRadius: "8px",
};

const SkeletonLine = ({ width = "100%", height = 12, style = {} }) => (
  <div
    aria-hidden="true"
    style={{
      ...SKELETON_BASE,
      width,
      height,
      marginBottom: 10,
      ...style,
    }}
  />
);

const SkeletonCard = ({ children, style = {} }) => (
  <div
    className="portal-card"
    aria-hidden="true"
    style={{
      backgroundColor: "#f3f4f6",
      borderColor: "#e5e7eb",
      ...style,
    }}
  >
    {children}
  </div>
);

const PortalSkeleton = () => (
  <div className="page">
    <div className="card portal-shell">
      <div className="portal-dashboard">
        <div style={{ marginBottom: 20 }}>
          <SkeletonLine width="60%" height={22} />
          <SkeletonLine width="90%" height={14} style={{ marginTop: 8 }} />
          <SkeletonLine width="80%" height={14} />
        </div>
        <SkeletonLine width="100%" height={48} style={{ borderRadius: 12, marginBottom: 20 }} />
        <section className="portal-section">
          <SkeletonLine width="40%" height={16} />
          <SkeletonCard style={{ marginTop: 8 }}>
            <SkeletonLine width="70%" height={16} />
            <SkeletonLine width="45%" height={12} />
          </SkeletonCard>
        </section>
        <section className="portal-section">
          <SkeletonLine width="30%" height={16} />
          <SkeletonCard style={{ marginTop: 8 }}>
            <SkeletonLine width="85%" height={14} />
            <SkeletonLine width="90%" height={14} />
            <SkeletonLine width="65%" height={14} />
          </SkeletonCard>
        </section>
      </div>
    </div>
  </div>
);

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
    type: "",
    date: "",
    value: "",
    observation: "",
  });
  const [showGlucoseForm, setShowGlucoseForm] = useState(false);
  const [glucoseLogs, setGlucoseLogs] = useState([]);
  const [glucoseLoading, setGlucoseLoading] = useState(false);
  const [glucoseError, setGlucoseError] = useState("");
  const [glucoseSaving, setGlucoseSaving] = useState(false);

  const getDisplayName = (payload) => {
    const safeValue = (value) => (typeof value === "string" ? value.trim() : "");
    const fullName = safeValue(payload?.full_name);
    if (fullName) return fullName;
    const names = safeValue(payload?.nombres);
    const last = safeValue(payload?.apellidos);
    const full = [names, last].filter(Boolean).join(" ").trim();
    if (full) return full;
    if (names) return names;
    const cedula = safeValue(payload?.cedula) || safeValue(payload?.username);
    if (cedula) return cedula;
    return "Paciente";
  };

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

  const formatShortDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit" });
  };

  const formatGlucoseType = (value) => {
    if (value === "postprandial") return "Postprandial";
    if (value === "ayuno") return "Ayuno";
    return "Sin tipo";
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
          setPatientName(getDisplayName(data));
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
        if (res.status === 404) {
          if (active) setGlucoseLogs([]);
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
    if (!glucoseForm.type) {
      setGlucoseError("Seleccione el tipo de medicion");
      return;
    }
    if (!glucoseForm.date || !glucoseForm.value) {
      setGlucoseError("Fecha y valor son requeridos");
      return;
    }
    const numericValue = Number(glucoseForm.value);
    if (!Number.isFinite(numericValue) || numericValue <= 20 || numericValue >= 600) {
      setGlucoseError("El valor debe estar entre 20 y 600 mg/dL");
      return;
    }
    setGlucoseSaving(true);
    try {
      const takenAt = new Date(`${glucoseForm.date}T00:00:00`);
      const payload = {
        patient_id: user?.id || null,
        value: numericValue,
        type: glucoseForm.type,
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
      setGlucoseForm({ type: "", date: "", value: "", observation: "" });
      setShowGlucoseForm(false);
      const resList = await authFetch(`/glucoses/patient/${user.id}`);
      if (resList.status === 404) {
        setGlucoseLogs([]);
        return;
      }
      if (resList.ok) {
        const data = await resList.json().catch(() => []);
        setGlucoseLogs(Array.isArray(data) ? data : []);
      } else {
        setGlucoseError("No se pudo cargar el historial de glucosas");
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

  const numericValue = Number(glucoseForm.value);
  const isGlucoseValueValid =
    Number.isFinite(numericValue) && numericValue > 20 && numericValue < 600;
  const isGlucoseFormValid =
    Boolean(glucoseForm.type) && Boolean(glucoseForm.date) && isGlucoseValueValid;
  const orderedGlucoseLogs = useMemo(() => {
    const list = Array.isArray(glucoseLogs) ? glucoseLogs : [];
    return list.slice().sort((a, b) => {
      const aTime = new Date(a?.taken_at || a?.created_at || 0).getTime();
      const bTime = new Date(b?.taken_at || b?.created_at || 0).getTime();
      return bTime - aTime;
    });
  }, [glucoseLogs]);
  const glucoseSummaryLogs = useMemo(
    () => orderedGlucoseLogs.slice(0, 3),
    [orderedGlucoseLogs]
  );

  if (authLoading) {
    return <PortalSkeleton />;
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
    <div className="page portal-bg">
      <div className="portal-bg-overlay" aria-hidden="true" />
      <div className="portal-bg-content">
        <div className="card portal-shell portal-main-card">
          <div className="portal-dashboard">
          <header className="portal-header">
            <h1 className="portal-title">
              Bienvenido/a,{" "}
              <span className="portal-name">{getDisplayName(user)}</span>
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
            {loadingCurrent ? (
              <SkeletonCard style={{ marginTop: 8 }}>
                <SkeletonLine width="70%" height={16} />
                <SkeletonLine width="45%" height={12} />
              </SkeletonCard>
            ) : current ? (
              <>
                <div className="portal-card portal-card-highlight">
                  <div className="portal-card-title">
                    Consulta {formatDate(current.created_at)}
                  </div>
                  <div className="portal-card-note">Consulta mas reciente</div>
                </div>
                <Link className="button button-secondary" href={`/portal/consultas/${current.id}`}>
                  Ver consulta
                </Link>
              </>
            ) : (
              <div className="portal-card">
                <div className="portal-card-note">No existen consultas registradas.</div>
              </div>
            )}
          </section>

          <section className="portal-section">
            <div className="section-title">Registro de glucosa</div>
            <div className="portal-card glucose-card" aria-busy={glucoseLoading ? "true" : "false"}>
              <button
                type="button"
                className="button-primary glucose-action-button"
                onClick={() => setShowGlucoseForm((prev) => !prev)}
              >
                {showGlucoseForm ? "Cerrar" : "Registrar glucosa"}
              </button>
              <div className="glucose-helper">
                Registre su control de glucosa cuando su medico se lo indique
              </div>
              {showGlucoseForm && (
                <form onSubmit={onGlucoseSubmit} className="form glucose-form">
                  <fieldset className="glucose-type">
                    <legend>Tipo de medicion</legend>
                    <div className="glucose-type-options">
                      <label className="glucose-option">
                        <input
                          type="radio"
                          name="type"
                          value="ayuno"
                          checked={glucoseForm.type === "ayuno"}
                          onChange={onGlucoseChange}
                          required
                          className="glucose-option-input"
                        />
                        <span className="glucose-option-card">
                          <span className="glucose-option-title">Ayuno</span>
                          <span className="glucose-option-desc">Antes de ingerir alimentos.</span>
                        </span>
                      </label>
                      <label className="glucose-option">
                        <input
                          type="radio"
                          name="type"
                          value="postprandial"
                          checked={glucoseForm.type === "postprandial"}
                          onChange={onGlucoseChange}
                          required
                          className="glucose-option-input"
                        />
                        <span className="glucose-option-card">
                          <span className="glucose-option-title">Despues de comer</span>
                          <span className="glucose-option-desc">Control postprandial.</span>
                        </span>
                      </label>
                    </div>
                  </fieldset>
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
                      min="21"
                      max="599"
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
                  <button
                    type="submit"
                    className="button-secondary"
                    disabled={glucoseSaving || !isGlucoseFormValid}
                  >
                    {glucoseSaving ? "Guardando..." : "Guardar registro"}
                  </button>
                </form>
              )}
            </div>
          </section>

          <section className="portal-section">
            <div className="section-title">Historial de glucosas</div>
            <div className="portal-card">
              {glucoseLoading && <div className="muted">Cargando historial...</div>}
              {glucoseError && <div className="error">{glucoseError}</div>}
              {!glucoseLoading && !glucoseError && !glucoseSummaryLogs.length && (
                <div className="muted">No hay registros de glucosa.</div>
              )}
              {!glucoseLoading && !glucoseError && glucoseSummaryLogs.length > 0 && (
                <div className="list">
                  {glucoseSummaryLogs.map((log, index) => {
                    if (!log || typeof log !== "object") return null;
                    const logId =
                      log.id ||
                      `${log.taken_at || log.created_at || "glucose"}-${index}`;
                    const logDate = formatShortDate(log.taken_at || log.created_at);
                    const logType = formatGlucoseType(log.type);
                    const logValue =
                      log.value !== null && log.value !== undefined
                        ? `${log.value} mg/dL`
                        : "Sin valor";
                    return (
                      <div key={logId} className="list-item">
                        <div className="list-title">
                          {logDate} - {logType} - <strong>{logValue}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link className="button button-secondary" href="/portal/glucosas">
                Ver historial de glucosas
              </Link>
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
            <button
              type="button"
              className="logout-button"
              onClick={() => logout(router)}
            >
              Cerrar sesion
            </button>
          </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .portal-bg {
          position: relative;
          background-image: url("/images/portal-bg.webp");
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }

        .portal-bg-overlay {
          position: absolute;
          inset: 0;
          background: rgba(234, 242, 255, 0.72);
        }

        .portal-bg-content {
          position: relative;
          z-index: 1;
        }

        .portal-main-card {
          background: #ffffff;
        }

        .glucose-action-button {
          width: 100%;
          border-radius: 12px;
          padding: 14px 18px;
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          background: #0f766e;
          box-shadow: 0 10px 20px rgba(15, 118, 110, 0.2);
          cursor: pointer;
          animation: glucoseGlow 4s ease-in-out infinite;
        }

        .glucose-action-button:hover {
          background: #0b5f59;
        }

        .glucose-action-button:focus-visible {
          outline: 2px solid #93c5fd;
          outline-offset: 2px;
        }

        .glucose-helper {
          font-size: 13px;
          color: #6b7280;
          line-height: 1.5;
          margin-top: 6px;
        }

        .glucose-type {
          border: none;
          padding: 0;
          margin: 0 0 12px;
        }

        .glucose-type legend {
          font-weight: 600;
          color: #111827;
          margin-bottom: 8px;
        }

        .glucose-type-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 10px;
        }

        .glucose-option {
          display: block;
          position: relative;
          cursor: pointer;
        }

        .glucose-option-input {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          border: 0;
          padding: 0;
          clip: rect(0 0 0 0);
          overflow: hidden;
          white-space: nowrap;
        }

        .glucose-option-card {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          color: #111827;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }

        .glucose-option-title {
          font-weight: 600;
          font-size: 14px;
        }

        .glucose-option-desc {
          font-size: 12px;
          color: #6b7280;
        }

        .glucose-option-input:checked + .glucose-option-card {
          border-color: #0f766e;
          background: #ecfdf5;
          box-shadow: 0 8px 16px rgba(15, 118, 110, 0.15);
        }

        .glucose-option-input:focus-visible + .glucose-option-card {
          outline: 2px solid #93c5fd;
          outline-offset: 2px;
        }

        .glucose-option:hover .glucose-option-card {
          border-color: #94a3b8;
        }

        @keyframes glucoseGlow {
          0%,
          100% {
            box-shadow: 0 8px 18px rgba(15, 118, 110, 0.18);
          }
          50% {
            box-shadow: 0 10px 22px rgba(15, 118, 110, 0.28);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .glucose-action-button {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
