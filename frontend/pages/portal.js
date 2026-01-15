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
    <div className="page portal-bg pb-24 bg-gradient-to-b from-slate-50 to-white">
      <div className="portal-bg-overlay" aria-hidden="true" />
      <div className="portal-bg-content mx-auto w-full max-w-5xl">
        <div className="card portal-shell portal-main-card w-full !max-w-5xl !mt-6 sm:!mt-10">
          <div className="portal-dashboard !gap-6 sm:!gap-8">
          <header
            id="inicio"
            className="portal-header rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                  Hola, <span className="portal-name">{getDisplayName(user)}</span> 👋
                </h1>
                <p className="portal-subtitle">
                  Revise su plan actual y su seguimiento
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <div>
                  <span className="font-semibold text-slate-700">
                    Ultima consulta:
                  </span>{" "}
                  {lastConsultationDate || "Sin registros"}
                </div>
                <div>
                  <span className="font-semibold text-slate-700">
                    Medico tratante:
                  </span>{" "}
                  Dr. David Guzman
                </div>
              </div>
            </div>
          </header>
          <nav
            className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white/90 p-2 text-sm shadow-sm"
            aria-label="Navegacion del portal"
          >
            <a
              href="#inicio"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            >
              Inicio
            </a>
            <a
              href="#tratamiento"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            >
              Tratamiento
            </a>
            <a
              href="#glucosas"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            >
              Glucosas
            </a>
            <a
              href="#laboratorios"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            >
              Laboratorios
            </a>
            <a
              href="#historial"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            >
              Historial
            </a>
          </nav>
          <div
            className={`portal-banner portal-banner-${nextVisitStatus} flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between`}
          >
            <div className="text-sm font-semibold text-slate-700">Proximo control</div>
            {nextVisitSummary ? (
              <div className="text-sm">
                <span>
                  Fecha: <strong>{nextVisitSummary.date}</strong>
                </span>
                <span className="mx-2 hidden sm:inline">|</span>
                <span>
                  <strong>{nextVisitSummary.days}</strong>
                </span>
              </div>
            ) : (
              <div className="text-sm">{nextVisitText}</div>
            )}
          </div>
          {error && <div className="error">{error}</div>}
          {message && <div className="muted">{message}</div>}
          <section
            id="tratamiento"
            className="portal-section rounded-2xl border border-slate-200/80 p-4 shadow-sm sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700">
                  Rx
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-900">
                    Tratamiento actual
                  </div>
                  <div className="text-sm text-slate-500">
                    Medicacion vigente e indicaciones principales.
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  className="button button-primary small"
                  href={current ? `/portal/consultas/${current.id}` : "/portal/historial"}
                >
                  Ver
                </Link>
                {current ? (
                  <Link
                    className="button button-secondary small"
                    href={`/portal/consultas/${current.id}`}
                  >
                    Ver historial de medicacion
                  </Link>
                ) : (
                  <Link className="button button-secondary small" href="/portal/historial">
                    Ver historial de medicacion
                  </Link>
                )}
              </div>
            </div>
            {loadingCurrent ? (
              <SkeletonCard style={{ marginTop: 8 }}>
                <SkeletonLine width="70%" height={16} />
                <SkeletonLine width="45%" height={12} />
              </SkeletonCard>
            ) : current ? (
              <>
                <div className="portal-card portal-card-highlight">
                  <div className="portal-card-title">Indicaciones generales</div>
                  <div className="portal-card-note">
                    {current.indications ||
                      current.notes ||
                      `Registradas en la consulta del ${formatDate(
                        current.consultation_date || current.created_at
                      )}.`}
                  </div>
                </div>
                {currentMedications.length ? (
                  <div className="rounded-2xl border border-slate-200/80 bg-white">
                    <ul className="divide-y divide-slate-200">
                      {currentMedications.map((med, index) => {
                        if (!med || typeof med !== "object") return null;
                        const medId = med.id || `${med.drug_name}-${index}`;
                        return (
                          <li
                            key={medId}
                            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {med.drug_name}
                              </div>
                              {med.description && (
                                <div className="text-xs text-slate-500">
                                  {med.description}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 sm:justify-end">
                              {med.quantity ? (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                                  Cantidad: {med.quantity}
                                </span>
                              ) : null}
                              {med.duration_days ? (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                                  Duracion: {med.duration_days} dias
                                </span>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <div className="portal-card">
                    <div className="portal-card-note">
                      Aun no hay medicacion registrada.
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="portal-card">
                <div className="portal-card-note">Aun no hay medicacion registrada.</div>
              </div>
            )}
          </section>

          <section
            id="glucosas"
            ref={glucoseSectionRef}
            className="portal-section rounded-2xl border border-slate-200/80 p-4 shadow-sm sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sm font-semibold text-sky-700">
                  GL
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-900">
                    Seguimiento indicado por su medico
                  </div>
                  <div className="text-sm text-slate-500">
                    Registre su glucosa cuando su medico se lo solicite.
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => router.push("/portal/glucosas")}
                >
                  Ver
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleGlucoseForm}
                >
                  {glucoseOpen ? "Cerrar formulario" : "Registrar control"}
                </Button>
              </div>
            </div>
            <div
              ref={glucoseFormRef}
              className={`portal-card glucose-card border-l-4 border-blue-500 transition ${
                glucoseHighlight
                  ? "ring-2 ring-emerald-300 ring-offset-2 ring-offset-white"
                  : ""
              }`}
              aria-busy={glucoseLoading ? "true" : "false"}
            >
              <div className="glucose-helper">
                Registre su control de glucosa cuando su medico se lo solicite
              </div>
              {!glucoseOpen && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
                  <div className="font-medium text-slate-700">
                    Formulario listo para registrar su control.
                  </div>
                  {(lastGlucoseDate || lastGlucoseValue) && (
                    <div className="mt-2 text-xs text-slate-500">
                      Ultimo registro:{" "}
                      {[lastGlucoseDate, lastGlucoseType, lastGlucoseValue]
                        .filter(Boolean)
                        .join(" | ")}
                    </div>
                  )}
                </div>
              )}
              {glucoseOpen && (
                <form
                  onSubmit={onGlucoseSubmit}
                  className="form glucose-form mt-5 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
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
          </section>

          <section
            id="laboratorios"
            className="portal-section rounded-2xl border border-slate-200/80 p-4 shadow-sm sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-sm font-semibold text-violet-700">
                  LAB
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-900">
                    Laboratorios
                  </div>
                  <div className="text-sm text-slate-500">
                    Resultados recientes solicitados por su medico.
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="button button-primary small" href="/portal/laboratorios/hba1c">
                  Ver
                </Link>
              </div>
            </div>
            <div className="portal-card">
              {(allLabsLoading || hba1cLoading) && (
                <div className="muted">Cargando resultados de laboratorio...</div>
              )}
              {(allLabsError || hba1cError) && (
                <div className="error">{allLabsError || hba1cError}</div>
              )}
              {!allLabsLoading && !hba1cLoading && !allLabsError && !hba1cError && allLabs.length === 0 && (
                <div className="muted">Aún no hay resultados de laboratorio registrados.</div>
              )}
              {!allLabsLoading && !hba1cLoading && !allLabsError && !hba1cError && allLabs.length > 0 && (
                <div className="list">
                  {allLabs.map((lab, index) => {
                    if (!lab || typeof lab !== "object") return null;
                    const resultValue = lab.valor_num ?? lab.valor_texto ?? "";
                    const resultLabel = resultValue !== "" ? resultValue : "Sin resultado";
                    const unit = lab.unidad_snapshot ? ` ${lab.unidad_snapshot}` : "";
                    const labKey = `${lab.lab_nombre || "lab"}-${index}`;
                    const labDate = lab.consulta_date ? formatDate(lab.consulta_date) : "";
                    return (
                      <div key={labKey} className="list-item">
                        <div className="list-title">{lab.lab_nombre || "Examen"}</div>
                        <div className="list-meta">
                          {resultLabel}
                          {unit}
                          {labDate && ` - ${labDate}`}
                        </div>
                        {lab.rango_ref_snapshot && (
                          <div className="list-meta">Rango: {lab.rango_ref_snapshot}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-4">
                <Link className="button button-secondary" href="/portal/laboratorios/hba1c">
                  Ver historial de HbA1c
                </Link>
                {allLabs.length > 0 && (
                  <Link
                    className="button button-secondary"
                    href={allLabs[0]?.consulta_id ? `/portal/consultas/${allLabs[0].consulta_id}/laboratorios` : "/portal/historial"}
                  >
                    Ver todos los laboratorios
                  </Link>
                )}
              </div>
            </div>
          </section>

          <section
            id="historial"
            className="portal-section rounded-2xl border border-slate-200/80 p-4 shadow-sm sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-700">
                  HIS
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-900">Historial</div>
                  <div className="text-sm text-slate-500">
                    Revise sus consultas y controles previos.
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="button button-primary small" href="/portal/historial">
                  Ver
                </Link>
                <Link className="button button-secondary small" href="/portal/glucosas">
                  Ver glucosas
                </Link>
              </div>
            </div>
            <div className="grid gap-4">
              <div className="portal-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="portal-card-title">Controles recientes de glucosa</div>
                  <Link className="button button-secondary small" href="/portal/glucosas">
                    Ver historial de controles de glucosa
                  </Link>
                </div>
                {glucoseLoading && (
                  <div className="muted">Cargando historial de controles...</div>
                )}
                {glucoseError && <div className="error">{glucoseError}</div>}
                {!glucoseLoading && !glucoseError && !glucoseSummaryLogs.length && (
                  <div className="muted">No hay registros de controles de glucosa.</div>
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
                          : "Sin valor registrado";
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
              </div>
              <div className="portal-actions !gap-4 sm:!gap-5">
                <Link className="portal-card portal-action" href="/portal/historial">
                  <div className="portal-card-title">Historial de consultas medicas</div>
                  <div className="portal-card-note">Solo lectura, sin cambios</div>
                </Link>
                <Link className="portal-card portal-action" href="/portal/glucosas">
                  <div className="portal-card-title">Historial de controles de glucosa</div>
                  <div className="portal-card-note">
                    Aqui podra registrar y revisar sus controles de glucosa cuando su
                    medico lo indique.
                  </div>
                </Link>
                <div className="portal-card portal-action portal-card-muted">
                  <div className="portal-card-title">Pendientes de seguimiento</div>
                  <div className="portal-card-note">
                    Cuestionarios o registros que su medico le solicite.
                  </div>
                </div>
                <a
                  className="portal-card portal-action"
                  href={appointmentUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="portal-card-title">Solicitar cita</div>
                  <div className="portal-card-note">
                    Se abrira un enlace externo para coordinar su atencion.
                  </div>
                </a>
              </div>
            </div>
          </section>

          <div className="portal-footer pt-2 sm:pt-4">
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
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        {!glucoseOpen && (
          <div className="max-w-[220px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg">
            <div className="font-semibold">{glucoseBubbleLines.primary}</div>
            {glucoseBubbleLines.secondary && (
              <div className="mt-0.5 text-[11px] text-slate-500">
                {glucoseBubbleLines.secondary}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className="flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-800"
          onClick={toggleGlucoseForm}
          aria-label="Registra tu glucosa"
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full bg-white/20 ${
              glucoseOpen ? "" : "animate-pulse"
            }`}
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-3 w-3"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 4v12m6-6H4" />
            </svg>
          </span>
          <span className="hidden sm:inline">Registra tu glucosa</span>
        </button>
      </div>
    </div>
  );
}

