import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { getToken, logout } from "../lib/auth";
import Button from "../components/ui/Button";
import SectionTitle from "../components/ui/SectionTitle";

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
    <div className="card portal-shell w-full !max-w-5xl !mt-6 sm:!mt-10">
      <div className="portal-dashboard !gap-6 sm:!gap-8">
        <div style={{ marginBottom: 20 }}>
          <SkeletonLine width="60%" height={22} />
          <SkeletonLine width="90%" height={14} style={{ marginTop: 8 }} />
          <SkeletonLine width="80%" height={14} />
        </div>
        <SkeletonLine width="100%" height={48} style={{ borderRadius: 12, marginBottom: 20 }} />
        <section className="portal-section rounded-2xl border border-slate-200/80 p-4 shadow-sm sm:p-6">
          <SkeletonLine width="40%" height={16} />
          <SkeletonCard style={{ marginTop: 8 }}>
            <SkeletonLine width="70%" height={16} />
            <SkeletonLine width="45%" height={12} />
          </SkeletonCard>
        </section>
        <section className="portal-section rounded-2xl border border-slate-200/80 p-4 shadow-sm sm:p-6">
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
  const [glucoseOpen, setGlucoseOpen] = useState(false);
  const [glucoseHighlight, setGlucoseHighlight] = useState(false);
  const [glucoseLogs, setGlucoseLogs] = useState([]);
  const [glucoseLoading, setGlucoseLoading] = useState(false);
  const [glucoseError, setGlucoseError] = useState("");
  const [glucoseSaving, setGlucoseSaving] = useState(false);
  const [treatmentOpen, setTreatmentOpen] = useState(false);
  const [labsOpen, setLabsOpen] = useState(false);
  const [hba1cSummary, setHba1cSummary] = useState(null);
  const [hba1cLoading, setHba1cLoading] = useState(false);
  const [hba1cError, setHba1cError] = useState("");
  const [allLabs, setAllLabs] = useState([]);
  const [allLabsLoading, setAllLabsLoading] = useState(false);
  const [allLabsError, setAllLabsError] = useState("");
  const glucoseSectionRef = useRef(null);
  const glucoseFormRef = useRef(null);
  const glucoseHighlightTimer = useRef(null);

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
    // Si es una fecha sin hora (solo fecha, formato YYYY-MM-DD), parsearla directamente
    // para evitar problemas de zona horaria
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      if (Number.isNaN(date.getTime())) return "";
      return date.toLocaleDateString("es-EC", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
    // Para fechas con hora (datetime), usar el constructor normal
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
    if (value === "postprandial") return "Despues de comer";
    if (value === "ayuno") return "Ayuno";
    return "Sin tipo registrado";
  };

  const normalizeLabName = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const isHbA1cLabName = (value) => {
    const normalized = normalizeLabName(value);
    if (!normalized) return false;
    if (normalized === "hba1c") return true;
    if (normalized === "hemoglobina glicosilada") return true;
    return normalized.includes("hba1c");
  };

  const formatHbA1cValue = (value) => {
    if (!Number.isFinite(value)) return "Sin resultado";
    const rounded = Math.round(value * 10) / 10;
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `${text}%`;
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

  useEffect(() => {
    if (!token || !user?.id) return;
    let active = true;
    const load = async () => {
      setHba1cLoading(true);
      setHba1cError("");
      try {
        const res = await authFetch("/patient/consultations");
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) {
          if (active) setHba1cError("No se pudo cargar resultados de laboratorio");
          return;
        }
        const data = await res.json().catch(() => []);
        const list = Array.isArray(data) ? data : [];
        if (!list.length) {
          if (active) setHba1cSummary(null);
          return;
        }
        const ordered = list
          .slice()
          .sort((a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0));
        const limited = ordered.slice(0, 12).filter((item) => item?.id);
        const entries = [];
        for (const item of limited) {
          if (!active) return;
          const detailRes = await authFetch(`/consultations/${item.id}/print`);
          if (detailRes.status === 401 || detailRes.status === 403) {
            logout(router, "/login");
            return;
          }
          if (!detailRes.ok) {
            continue;
          }
          const detail = await detailRes.json().catch(() => null);
          const labs = Array.isArray(detail?.labs) ? detail.labs : [];
          const match = labs.find((lab) => {
            if (!isHbA1cLabName(lab?.lab_nombre)) return false;
            const value = Number(lab?.valor_num);
            return Number.isFinite(value);
          });
          if (match) {
            const value = Number(match.valor_num);
            const dateValue = detail?.consultation?.created_at || item.created_at;
            entries.push({ value, date: dateValue });
          }
        }
        if (!active) return;
        if (!entries.length) {
          setHba1cSummary(null);
          return;
        }
        entries.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        setHba1cSummary(entries[0]);
      } catch (err) {
        if (active) setHba1cError("No se pudo cargar resultados de laboratorio");
      } finally {
        if (active) setHba1cLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [router, token, user?.id]);

  // Cargar todos los laboratorios del paciente
  useEffect(() => {
    if (!token || !user?.id) return;
    let active = true;
    const loadAllLabs = async () => {
      setAllLabsLoading(true);
      setAllLabsError("");
      try {
        const res = await authFetch("/patient/consultations");
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) {
          if (active) setAllLabsError("No se pudo cargar laboratorios");
          return;
        }
        const data = await res.json().catch(() => []);
        const consultations = Array.isArray(data) ? data : [];
        if (!consultations.length) {
          if (active) setAllLabs([]);
          return;
        }
        const ordered = consultations
          .slice()
          .sort((a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0));
        const limited = ordered.slice(0, 12).filter((item) => item?.id);
        const labsMap = new Map();
        for (const consulta of limited) {
          if (!active) return;
          try {
            const detailRes = await authFetch(`/consultations/${consulta.id}/print`);
            if (detailRes.status === 401 || detailRes.status === 403) {
              logout(router, "/login");
              return;
            }
            if (!detailRes.ok) {
              continue;
            }
            const detail = await detailRes.json().catch(() => null);
            const labs = Array.isArray(detail?.labs) ? detail.labs : [];
            labs.forEach((lab) => {
              if (!lab || !lab.lab_nombre) return;
              const labName = lab.lab_nombre.trim();
              if (!labsMap.has(labName)) {
                labsMap.set(labName, {
                  ...lab,
                  consulta_id: consulta.id,
                  consulta_date: detail?.consultation?.created_at || consulta.created_at,
                });
              }
            });
          } catch (err) {
            continue;
          }
        }
        if (!active) return;
        const importantLabs = ["HbA1c", "Glucosa ayunas", "Creatinina", "TFG", "UACR"];
        const sortedLabs = Array.from(labsMap.values()).sort((a, b) => {
          const aIndex = importantLabs.indexOf(a.lab_nombre);
          const bIndex = importantLabs.indexOf(b.lab_nombre);
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return (a.lab_nombre || "").localeCompare(b.lab_nombre || "");
        });
        if (active) setAllLabs(sortedLabs);
      } catch (err) {
        if (active) setAllLabsError("No se pudo cargar laboratorios");
      } finally {
        if (active) setAllLabsLoading(false);
      }
    };
    loadAllLabs();
    return () => {
      active = false;
    };
  }, [router, token, user?.id]);

  useEffect(() => {
    return () => {
      if (glucoseHighlightTimer.current) {
        clearTimeout(glucoseHighlightTimer.current);
      }
    };
  }, []);

  const scrollToRef = (ref) => {
    if (!ref?.current) return;
    ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const triggerGlucoseHighlight = () => {
    setGlucoseHighlight(true);
    if (glucoseHighlightTimer.current) {
      clearTimeout(glucoseHighlightTimer.current);
    }
    glucoseHighlightTimer.current = setTimeout(() => {
      setGlucoseHighlight(false);
    }, 1500);
  };

  const openGlucoseForm = () => {
    setGlucoseOpen(true);
    setTimeout(() => {
      scrollToRef(glucoseFormRef);
      triggerGlucoseHighlight();
    }, 120);
  };

  const closeGlucoseForm = () => {
    setGlucoseOpen(false);
    scrollToRef(glucoseSectionRef);
  };

  const toggleGlucoseForm = () => {
    if (glucoseOpen) {
      closeGlucoseForm();
    } else {
      openGlucoseForm();
    }
  };

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
      setGlucoseOpen(false);
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
  // Usar consultation_date si está disponible (fecha real de la consulta),
  // de lo contrario usar created_at (fecha de registro)
  const lastConsultationDate = formatDate(
    current?.consultation_date || current?.created_at
  );
  const currentMedications = Array.isArray(current?.medications)
    ? current.medications
    : [];
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
  let nextVisitText = "Su medico aun no ha programado la proxima cita de control.";
  let nextVisitSummary = null;
  if (diffDays !== null) {
    if (diffDays >= 0) {
      if (diffDays > 14) {
        nextVisitStatus = "ok";
      } else if (diffDays >= 4) {
        nextVisitStatus = "warn";
      } else {
        nextVisitStatus = "overdue";
      }
      nextVisitSummary = {
        date: formatDate(nextVisitDate),
        days: `Faltan ${diffDays} dias`,
      };
    } else {
      nextVisitStatus = "overdue";
      nextVisitSummary = {
        date: formatDate(nextVisitDate),
        days: `Retraso de ${Math.abs(diffDays)} dias`,
      };
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
  const lastGlucoseLog = orderedGlucoseLogs[0] || null;
  const lastGlucoseDateValue =
    lastGlucoseLog?.taken_at || lastGlucoseLog?.created_at || "";
  const lastGlucoseDate = formatDate(lastGlucoseDateValue);
  const lastGlucoseValue =
    lastGlucoseLog?.value !== null && lastGlucoseLog?.value !== undefined
      ? `${lastGlucoseLog.value} mg/dL`
      : "";
  const lastGlucoseType = lastGlucoseLog?.type
    ? formatGlucoseType(lastGlucoseLog.type)
    : "";
  const glucoseBubbleLines = useMemo(() => {
    if (!orderedGlucoseLogs.length) {
      return { primary: "Primera vez aqui?", secondary: "Registra tu glucosa" };
    }
    if (!lastGlucoseDateValue) {
      return { primary: "Registra tu glucosa" };
    }
    const lastDate = new Date(lastGlucoseDateValue);
    if (Number.isNaN(lastDate.getTime())) {
      return { primary: "Registra tu glucosa" };
    }
    const todayDate = new Date();
    const normalizedToday = new Date(
      todayDate.getFullYear(),
      todayDate.getMonth(),
      todayDate.getDate()
    );
    const normalizedLast = new Date(
      lastDate.getFullYear(),
      lastDate.getMonth(),
      lastDate.getDate()
    );
    const diffDays = Math.floor((normalizedToday - normalizedLast) / 86400000);
    if (diffDays <= 0) {
      return { primary: "Gracias ✅", secondary: "Registro actualizado hoy" };
    }
    if (diffDays >= 2) {
      return {
        primary: `Han pasado ${diffDays} dias.`,
        secondary: "Registra tu glucosa",
      };
    }
    return { primary: "Registra tu glucosa" };
  }, [lastGlucoseDateValue, orderedGlucoseLogs.length]);

  if (authLoading) {
    return <PortalSkeleton />;
  }

  if (authError) {
    return (
      <div className="page">
        <div className="card">
          <h1>Portal del paciente</h1>
          <div className="error">{authError}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Header médico limpio */}
        <header id="inicio" className="portal-medical-header">
          <h1>
            Bienvenido, <span style={{ fontWeight: 700 }}>{getDisplayName(user)}</span>
          </h1>
          <p className="portal-medical-header-subtitle">
            Portal de seguimiento médico - Revise su información de salud
          </p>
          <div className="portal-medical-header-info">
            <div className="portal-medical-header-info-item">
              <span className="portal-medical-header-info-label">Última consulta</span>
              <span className="portal-medical-header-info-value">
                {lastConsultationDate || "Sin registros"}
              </span>
            </div>
            <div className="portal-medical-header-info-item">
              <span className="portal-medical-header-info-label">Médico tratante</span>
              <span className="portal-medical-header-info-value">Dr. David Guzmán</span>
            </div>
          </div>
        </header>

        {/* Navegación simplificada */}
        <nav className="portal-medical-nav" aria-label="Navegación del portal">
          <a href="#tratamiento" className="portal-medical-nav-item">
            Tratamiento
          </a>
          <a href="#laboratorios" className="portal-medical-nav-item">
            Laboratorios
          </a>
          <a href="#glucosas" className="portal-medical-nav-item">
            Glucosas
          </a>
          <a href="#historial" className="portal-medical-nav-item">
            Historial
          </a>
        </nav>

        {/* Banner de próxima cita mejorado */}
        {nextVisitSummary && (
          <div className="portal-medical-banner">
            <div className="portal-medical-banner-content">
              <div className="portal-medical-banner-icon">📅</div>
              <div className="portal-medical-banner-text">
                <span className="portal-medical-banner-label">Próximo control</span>
                <span className="portal-medical-banner-value">
                  {nextVisitSummary.date} • {nextVisitSummary.days}
                </span>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="error" style={{ marginBottom: "24px" }}>
            {error}
          </div>
        )}
        {message && (
          <div className="muted" style={{ marginBottom: "24px" }}>
            {message}
          </div>
        )}

        {/* Sección de Tratamiento */}
        <section id="tratamiento" className="portal-medical-card">
          <div className="portal-medical-card-header">
            <div className="portal-medical-card-title-section">
              <div className="portal-medical-card-icon treatment">💊</div>
              <div className="portal-medical-card-title-group">
                <h2 className="portal-medical-card-title">Tratamiento actual</h2>
                <p className="portal-medical-card-subtitle">
                  Medicación vigente e indicaciones de su médico
                </p>
              </div>
            </div>
            <div className="portal-medical-card-actions">
              {treatmentOpen && (
                <Link
                  href={current ? `/portal/consultas/${current.id}` : "/portal/historial"}
                  className="portal-medical-button portal-medical-button-primary portal-medical-button-small"
                >
                  Ver detalles
                </Link>
              )}
              <button
                type="button"
                className="portal-medical-button portal-medical-button-secondary portal-medical-button-small"
                onClick={() => setTreatmentOpen((prev) => !prev)}
                aria-expanded={treatmentOpen}
                aria-controls="tratamiento-content"
              >
                {treatmentOpen ? "Ocultar tratamiento" : "Ver tratamiento"}
              </button>
            </div>
          </div>
          <div id="tratamiento-content" className="portal-medical-card-content">
            {!treatmentOpen ? (
              <div className="portal-medical-summary">
                {loadingCurrent ? (
                  <div className="portal-medical-summary-row">
                    <span className="portal-medical-summary-label">Estado</span>
                    <span className="portal-medical-summary-value">
                      Cargando tratamiento...
                    </span>
                  </div>
                ) : current ? (
                  <>
                    <div className="portal-medical-summary-row">
                      <span className="portal-medical-summary-label">Medicacion</span>
                      <span className="portal-medical-summary-value">
                        {currentMedications.length
                          ? `${currentMedications.length} medicamento${
                              currentMedications.length === 1 ? "" : "s"
                            }`
                          : "Sin medicacion"}
                      </span>
                    </div>
                    <div className="portal-medical-summary-row">
                      <span className="portal-medical-summary-label">Indicaciones</span>
                      <span className="portal-medical-summary-value">
                        {current.indications || current.notes
                          ? "Disponibles"
                          : "Sin indicaciones"}
                      </span>
                    </div>
                    <div className="portal-medical-summary-row">
                      <span className="portal-medical-summary-label">Ultima consulta</span>
                      <span className="portal-medical-summary-value">
                        {lastConsultationDate || "Sin registros"}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="portal-medical-summary-row">
                    <span className="portal-medical-summary-label">Estado</span>
                    <span className="portal-medical-summary-value">
                      Sin tratamiento registrado
                    </span>
                  </div>
                )}
              </div>
            ) : loadingCurrent ? (
              <div className="portal-medical-empty-state">
                <div className="portal-medical-empty-state-icon">⏳</div>
                <p className="portal-medical-empty-state-text">Cargando información...</p>
              </div>
            ) : current ? (
              <>
                {(current.indications || current.notes) && (
                  <div className="portal-medical-indications">
                    <div className="portal-medical-indications-title">Indicaciones generales</div>
                    <p className="portal-medical-indications-text">
                      {current.indications ||
                        current.notes ||
                        `Registradas en la consulta del ${formatDate(
                          current.consultation_date || current.created_at
                        )}.`}
                    </p>
                  </div>
                )}
                {currentMedications.length > 0 ? (
                  <div className="portal-medical-medication-list">
                    {currentMedications.map((med, index) => {
                      if (!med || typeof med !== "object") return null;
                      const medId = med.id || `${med.drug_name}-${index}`;
                      return (
                        <div key={medId} className="portal-medical-medication-item">
                          <div style={{ flex: 1 }}>
                            <div className="portal-medical-medication-name">{med.drug_name}</div>
                            {med.description && (
                              <p style={{ fontSize: "14px", color: "#64748b", margin: "8px 0 0 0" }}>
                                {med.description}
                              </p>
                            )}
                            <div className="portal-medical-medication-details">
                              {med.quantity && (
                                <span className="portal-medical-medication-badge">
                                  Cantidad: {med.quantity}
                                </span>
                              )}
                              {med.duration_days && (
                                <span className="portal-medical-medication-badge">
                                  Duración: {med.duration_days} días
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="portal-medical-empty-state">
                    <div className="portal-medical-empty-state-icon">💊</div>
                    <p className="portal-medical-empty-state-text">
                      Aún no hay medicación registrada
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="portal-medical-empty-state">
                <div className="portal-medical-empty-state-icon">💊</div>
                <p className="portal-medical-empty-state-text">Aún no hay medicación registrada</p>
              </div>
            )}
          </div>
        </section>

        {/* Sección de Glucosas */}
        <section id="glucosas" ref={glucoseSectionRef} className="portal-medical-card">
          <div className="portal-medical-card-header">
            <div className="portal-medical-card-title-section">
              <div className="portal-medical-card-icon glucose">📊</div>
              <div className="portal-medical-card-title-group">
                <h2 className="portal-medical-card-title">Control de glucosa</h2>
                <p className="portal-medical-card-subtitle">
                  Registre sus controles cuando su médico se lo solicite
                </p>
              </div>
            </div>
            <div className="portal-medical-card-actions">
              <Button
                type="button"
                size="sm"
                onClick={() => router.push("/portal/glucosas")}
                style={{ marginRight: "8px" }}
              >
                Ver historial
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={toggleGlucoseForm}>
                {glucoseOpen ? "Cerrar" : "Registrar"}
              </Button>
            </div>
          </div>
          <div className="portal-medical-card-content">
            {!glucoseOpen && (
              <div
                style={{
                  background: "#f0f9ff",
                  border: "1px solid #bae6fd",
                  borderRadius: "12px",
                  padding: "20px",
                  marginTop: "16px",
                }}
              >
                <div style={{ fontSize: "15px", fontWeight: 600, color: "#1e293b", marginBottom: "8px" }}>
                  Último registro
                </div>
                {(lastGlucoseDate || lastGlucoseValue) ? (
                  <div style={{ fontSize: "14px", color: "#64748b" }}>
                    {[lastGlucoseDate, lastGlucoseType, lastGlucoseValue]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>
                ) : (
                  <div style={{ fontSize: "14px", color: "#64748b" }}>
                    Aún no hay registros
                  </div>
                )}
              </div>
            )}
            <div
              ref={glucoseFormRef}
              className={glucoseHighlight ? "ring-2 ring-emerald-300 ring-offset-2" : ""}
              aria-busy={glucoseLoading ? "true" : "false"}
            >
              {glucoseOpen && (
                <form
                  onSubmit={onGlucoseSubmit}
                  style={{
                    marginTop: "24px",
                    padding: "24px",
                    background: "#f8fafc",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                      GL
                    </div>
                    <SectionTitle
                      title="Registro de glucosa"
                      subtitle="Ingrese el control solicitado por su medico"
                      className="flex-1"
                    />
                  </div>
                  <fieldset className="glucose-type space-y-3">
                    <legend className="text-sm font-medium text-slate-700">
                      Tipo de control de glucosa
                    </legend>
                    <div className="glucose-type-options grid gap-3 sm:grid-cols-2">
                      <label
                        className={`glucose-option group flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition sm:items-center ${
                          glucoseForm.type === "ayuno"
                            ? "border-emerald-500 bg-emerald-50/60"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="type"
                          value="ayuno"
                          checked={glucoseForm.type === "ayuno"}
                          onChange={onGlucoseChange}
                          required
                          className="glucose-option-input sr-only"
                        />
                        <span className="glucose-option-card flex flex-col gap-1">
                          <span className="glucose-option-title text-sm font-semibold text-slate-900">
                            Ayuno
                          </span>
                          <span className="glucose-option-desc text-xs text-slate-500">
                            Antes de comer.
                          </span>
                        </span>
                      </label>
                      <label
                        className={`glucose-option group flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition sm:items-center ${
                          glucoseForm.type === "postprandial"
                            ? "border-emerald-500 bg-emerald-50/60"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="type"
                          value="postprandial"
                          checked={glucoseForm.type === "postprandial"}
                          onChange={onGlucoseChange}
                          required
                          className="glucose-option-input sr-only"
                        />
                        <span className="glucose-option-card flex flex-col gap-1">
                          <span className="glucose-option-title text-sm font-semibold text-slate-900">
                            Despues de comer
                          </span>
                          <span className="glucose-option-desc text-xs text-slate-500">
                            Dos horas despues de comer.
                          </span>
                        </span>
                      </label>
                    </div>
                  </fieldset>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm font-medium text-slate-700">
                      <span>Fecha del control</span>
                      <input
                        type="date"
                        name="date"
                        value={glucoseForm.date}
                        onChange={onGlucoseChange}
                        required
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium text-slate-700">
                      <span>Valor de glucosa</span>
                      <div className="relative">
                        <input
                          type="number"
                          name="value"
                          min="21"
                          max="599"
                          value={glucoseForm.value}
                          onChange={onGlucoseChange}
                          required
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-16 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">
                          mg/dL
                        </span>
                      </div>
                    </label>
                  </div>
                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    <span>Observacion adicional (opcional)</span>
                    <textarea
                      name="observation"
                      value={glucoseForm.observation}
                      onChange={onGlucoseChange}
                      className="min-h-[90px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </label>
                  {glucoseError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {glucoseError}
                    </div>
                  )}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <Button
                      type="submit"
                      className="w-full sm:w-auto"
                      disabled={glucoseSaving || !isGlucoseFormValid}
                    >
                      {glucoseSaving ? "Guardando..." : "Guardar control"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* Sección de Laboratorios */}
        <section id="laboratorios" className="portal-medical-card">
          <div className="portal-medical-card-header">
            <div className="portal-medical-card-title-section">
              <div className="portal-medical-card-icon labs">🔬</div>
              <div className="portal-medical-card-title-group">
                <h2 className="portal-medical-card-title">Resultados de laboratorio</h2>
                <p className="portal-medical-card-subtitle">
                  Resultados recientes de sus exámenes médicos
                </p>
              </div>
            </div>
            <div className="portal-medical-card-actions">
              {labsOpen && (
                <Link
                  href="/portal/laboratorios/hba1c"
                  className="portal-medical-button portal-medical-button-primary portal-medical-button-small"
                >
                  Historial de hemoglobina glicosilada (HbA1c)
                </Link>
              )}
              <button
                type="button"
                className="portal-medical-button portal-medical-button-secondary portal-medical-button-small"
                onClick={() => setLabsOpen((prev) => !prev)}
                aria-expanded={labsOpen}
                aria-controls="laboratorios-content"
              >
                {labsOpen ? "Ocultar laboratorios" : "Ver laboratorios"}
              </button>
            </div>
          </div>
          <div id="laboratorios-content" className="portal-medical-card-content">
            {!labsOpen ? (
              <div className="portal-medical-summary">
                {(allLabsLoading || hba1cLoading) && (
                  <div className="portal-medical-summary-row">
                    <span className="portal-medical-summary-label">Estado</span>
                    <span className="portal-medical-summary-value">
                      Cargando resultados...
                    </span>
                  </div>
                )}
                {(allLabsError || hba1cError) && (
                  <div className="portal-medical-summary-row">
                    <span className="portal-medical-summary-label">Estado</span>
                    <span className="portal-medical-summary-value">
                      {allLabsError || hba1cError}
                    </span>
                  </div>
                )}
                {!allLabsLoading &&
                  !hba1cLoading &&
                  !allLabsError &&
                  !hba1cError &&
                  allLabs.length === 0 && (
                    <div className="portal-medical-summary-row">
                      <span className="portal-medical-summary-label">Estado</span>
                      <span className="portal-medical-summary-value">
                        Sin resultados registrados
                      </span>
                    </div>
                  )}
                {!allLabsLoading &&
                  !hba1cLoading &&
                  !allLabsError &&
                  !hba1cError &&
                  allLabs.length > 0 && (
                    <>
                      <div className="portal-medical-summary-row">
                        <span className="portal-medical-summary-label">Resultados</span>
                        <span className="portal-medical-summary-value">
                          {allLabs.length} disponibles
                        </span>
                      </div>
                      <div className="portal-medical-summary-row">
                        <span className="portal-medical-summary-label">HbA1c</span>
                        <span className="portal-medical-summary-value">
                          {hba1cSummary
                            ? `${formatHbA1cValue(hba1cSummary.value)} (${formatShortDate(
                                hba1cSummary.date
                              )})`
                            : "Sin datos"}
                        </span>
                      </div>
                    </>
                  )}
              </div>
            ) : (
              <>
                {(allLabsLoading || hba1cLoading) && (
                  <div className="portal-medical-empty-state">
                    <div className="portal-medical-empty-state-icon">⏳</div>
                    <p className="portal-medical-empty-state-text">Cargando resultados...</p>
                  </div>
                )}
                {(allLabsError || hba1cError) && (
                  <div className="error" style={{ marginTop: "16px" }}>
                    {allLabsError || hba1cError}
                  </div>
                )}
                {!allLabsLoading &&
                  !hba1cLoading &&
                  !allLabsError &&
                  !hba1cError &&
                  allLabs.length === 0 && (
                    <div className="portal-medical-empty-state">
                      <div className="portal-medical-empty-state-icon">🔬</div>
                      <p className="portal-medical-empty-state-text">
                        Aún no hay resultados de laboratorio registrados
                      </p>
                    </div>
                  )}
                {!allLabsLoading &&
                  !hba1cLoading &&
                  !allLabsError &&
                  !hba1cError &&
                  allLabs.length > 0 && (
                    <div className="portal-medical-lab-list">
                      {allLabs.map((lab, index) => {
                        if (!lab || typeof lab !== "object") return null;
                        const resultValue = lab.valor_num ?? lab.valor_texto ?? "";
                        const resultLabel = resultValue !== "" ? resultValue : "Sin resultado";
                        const unit = lab.unidad_snapshot ? ` ${lab.unidad_snapshot}` : "";
                        const labKey = `${lab.lab_nombre || "lab"}-${index}`;
                        const labDate = lab.consulta_date ? formatDate(lab.consulta_date) : "";
                        return (
                          <div key={labKey} className="portal-medical-lab-item">
                            <div className="portal-medical-lab-header">
                              <div className="portal-medical-lab-name">{lab.lab_nombre || "Examen"}</div>
                              <div className="portal-medical-lab-value">
                                {resultLabel}
                                {unit}
                              </div>
                            </div>
                            <div className="portal-medical-lab-meta">
                              {labDate && <span>Fecha: {labDate}</span>}
                              {lab.rango_ref_snapshot && <span>Rango: {lab.rango_ref_snapshot}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                {allLabs.length > 0 && (
                  <div style={{ marginTop: "20px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    <Link
                      href={allLabs[0]?.consulta_id ? `/portal/consultas/${allLabs[0].consulta_id}/laboratorios` : "/portal/historial"}
                      className="portal-medical-button portal-medical-button-secondary portal-medical-button-small"
                    >
                      Ver todos los laboratorios
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Sección de Historial - Simplificada */}
        <section id="historial" className="portal-medical-card">
          <div className="portal-medical-card-header">
            <div className="portal-medical-card-title-section">
              <div className="portal-medical-card-icon history">📋</div>
              <div className="portal-medical-card-title-group">
                <h2 className="portal-medical-card-title">Historial y recursos</h2>
                <p className="portal-medical-card-subtitle">
                  Acceda a su historial médico y recursos adicionales
                </p>
              </div>
            </div>
          </div>
          <div className="portal-medical-card-content">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "16px",
              }}
            >
              <Link
                href="/portal/historial"
                className="portal-medical-button portal-medical-button-secondary"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  padding: "20px",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: "18px", marginBottom: "8px" }}>📄</div>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>Historial de consultas</div>
                <div style={{ fontSize: "13px", color: "#64748b" }}>Revise sus consultas anteriores</div>
              </Link>
              <Link
                href="/portal/glucosas"
                className="portal-medical-button portal-medical-button-secondary"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  padding: "20px",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: "18px", marginBottom: "8px" }}>📊</div>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>Controles de glucosa</div>
                <div style={{ fontSize: "13px", color: "#64748b" }}>
                  Registre y revise sus controles
                </div>
              </Link>
              <a
                href={appointmentUrl}
                target="_blank"
                rel="noreferrer"
                className="portal-medical-button portal-medical-button-secondary"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  padding: "20px",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: "18px", marginBottom: "8px" }}>📅</div>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>Solicitar cita</div>
                <div style={{ fontSize: "13px", color: "#64748b" }}>
                  Coordine su próxima atención
                </div>
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
          <button
            type="button"
            onClick={() => logout(router)}
            style={{
              background: "#fee2e2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
