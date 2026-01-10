import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { apiFetch, logout } from "../lib/auth";
import { useAuthGuard } from "../hooks/useAuthGuard";

const LAB_VALUE_EMPTY = "";
const GLUCOSE_MAX_RECORDS = 10;
const GLUCOSE_TREND_THRESHOLD = 5;
const GLUCOSE_HYPO_THRESHOLD = 70;
const GLUCOSE_HYPER_THRESHOLD = 180;
const GLUCOSE_CHART_HEIGHT = 200;
const GLUCOSE_CHART_PADDING = 24;
const GLUCOSE_CHART_WIDTH = 600;
const NAME_SEARCH_DEBOUNCE_MS = 400;
const CONSULTA_DRAFT_KEY = "draft_consultation_admin";
const CONSULTA_DRAFT_DEBOUNCE_MS = 2500;

const DEFAULT_CONSULTA_FORM = {
  patient_username: "",
  diagnostico: "",
  notas_medicas: "",
  indicaciones_generales: "",
  weight: "",
  height: "",
  blood_pressure: "",
  heart_rate: "",
  oxygen_saturation: "",
  abdominal_circumference: "",
  reason_for_visit: "",
  current_illness: "",
  physical_exam: "",
  requested_exams: "",
  next_visit_date: "",
};

const hasDraftValue = (value) => String(value ?? "").trim().length > 0;

const hasDraftContent = (draft) => {
  if (!draft || typeof draft !== "object") return false;
  const formValues = Object.values(draft.consultaForm || {});
  if (formValues.some(hasDraftValue)) return true;
  const meds = Array.isArray(draft.medicamentos) ? draft.medicamentos : [];
  if (
    meds.some((med) => {
      if (!med || typeof med !== "object") return false;
      return ["nombre", "cantidad", "descripcion", "duracion_dias"].some((key) =>
        hasDraftValue(med[key])
      );
    })
  ) {
    return true;
  }
  const labs = Array.isArray(draft.labs) ? draft.labs : [];
  if (
    labs.some((row) => {
      if (!row || typeof row !== "object") return false;
      return ["lab_id", "valor"].some((key) => hasDraftValue(row[key]));
    })
  ) {
    return true;
  }
  return false;
};

const getMaxNumericId = (items) => {
  const list = Array.isArray(items) ? items : [];
  let maxId = 0;
  list.forEach((item) => {
    const value = Number(item?.id);
    if (Number.isFinite(value) && value > maxId) {
      maxId = value;
    }
  });
  return maxId;
};

const formatShortDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit" });
};

const computeAge = (dateStr) => {
  if (!dateStr) return { age: null, error: null };
  const birthDate = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return { age: null, error: null };

  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (birthDate > todayDate) {
    return { age: null, error: "La fecha no puede ser futura" };
  }

  let age = todayDate.getFullYear() - birthDate.getFullYear();
  const monthDelta = todayDate.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && todayDate.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return { age, error: null };
};

const canSubmit = (form, dateError) => {
  if (dateError) return false;
  if (!form.cedula.trim()) return false;
  if (!form.nombres.trim()) return false;
  if (!form.apellidos.trim()) return false;
  if (!form.fecha_nacimiento) return false;
  return true;
};

const usePatientNameSearch = (router) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const cleaned = query.trim();
    if (!cleaned) {
      setResults([]);
      setStatus("idle");
      setError("");
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setStatus("loading");
      setError("");
      apiFetch(`/admin/patients/search?q=${encodeURIComponent(cleaned)}`)
        .then(async (res) => {
          if (res.status === 401 || res.status === 403) {
            logout(router, "/login?type=admin");
            return;
          }
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            if (!active) return;
            setResults([]);
            setStatus("error");
            setError(data.detail || "No se pudo buscar pacientes");
            return;
          }
          const data = await res.json().catch(() => []);
          if (!active) return;
          const list = Array.isArray(data) ? data : [];
          setResults(list);
          setStatus("done");
          if (!list.length) {
            setError("Sin resultados");
          }
        })
        .catch(() => {
          if (!active) return;
          setResults([]);
          setStatus("error");
          setError("No se pudo buscar pacientes");
        });
    }, NAME_SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, router]);

  const clear = () => {
    setQuery("");
    setResults([]);
    setStatus("idle");
    setError("");
  };

  return { query, setQuery, results, status, error, clear };
};

export default function Dashboard() {
  const router = useRouter();
  const { user, loading, error: authError } = useAuthGuard();
  const [form, setForm] = useState({
    cedula: "",
    password: "",
    confirmPassword: "",
    nombres: "",
    apellidos: "",
    fecha_nacimiento: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [age, setAge] = useState(null);
  const [dateError, setDateError] = useState("");
  const [consultaForm, setConsultaForm] = useState(DEFAULT_CONSULTA_FORM);
  const [patientInfo, setPatientInfo] = useState(null);
  const [patientLookupStatus, setPatientLookupStatus] = useState("idle");
  const [patientLookupMessage, setPatientLookupMessage] = useState("");
  const medIdRef = useRef(0);
  const createMedicamento = () => {
    const id = String((medIdRef.current += 1));
    return { id, nombre: "", cantidad: "", descripcion: "", duracion_dias: "" };
  };
  const [medicamentos, setMedicamentos] = useState(() => [createMedicamento()]);
  const [consultaError, setConsultaError] = useState("");
  const [consultaSuccess, setConsultaSuccess] = useState("");
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [animatedPatients, setAnimatedPatients] = useState(0);
  const [animatedConsultations, setAnimatedConsultations] = useState(0);
  const [consultas, setConsultas] = useState([]);
  const [glucoseLogs, setGlucoseLogs] = useState([]);
  const [glucoseLoading, setGlucoseLoading] = useState(false);
  const [glucoseError, setGlucoseError] = useState("");
  const [glucoseMessage, setGlucoseMessage] = useState("");
  const [labCatalog, setLabCatalog] = useState([]);
  const [labCatalogError, setLabCatalogError] = useState("");
  const [labs, setLabs] = useState([]);
  const [labsError, setLabsError] = useState("");
  const [labsMessage, setLabsMessage] = useState("");
  const [labRowErrors, setLabRowErrors] = useState({});
  const draftRef = useRef({ consultaForm: DEFAULT_CONSULTA_FORM, medicamentos: [], labs: [] });
  const draftReadyRef = useRef(false);
  const draftRestoredRef = useRef(false);
  const [sectionsOpen, setSectionsOpen] = useState({
    createPatient: false,
    searchPatient: false,
    createConsultation: false,
  });
  const labIdRef = useRef(0);
  const searchPatient = usePatientNameSearch(router);
  const consultationSearch = usePatientNameSearch(router);

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(CONSULTA_DRAFT_KEY);
    } catch {
      // Ignore sessionStorage failures.
    }
  };

  const persistDraft = (state) => {
    if (!draftReadyRef.current) return;
    if (!hasDraftContent(state)) {
      clearDraft();
      return;
    }
    try {
      sessionStorage.setItem(CONSULTA_DRAFT_KEY, JSON.stringify(state));
    } catch {
      // Ignore sessionStorage failures.
    }
  };

  useEffect(() => {
    if (!user) return;
    if (String(user.role).toLowerCase() !== "admin") {
      logout(router, "/login?type=admin");
    }
  }, [router, user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setStatsLoading(true);
    setStatsError("");
    apiFetch("/admin/stats")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login?type=admin");
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (active) setStatsError(data.detail || "No se pudo cargar los indicadores.");
          return;
        }
        const data = await res.json().catch(() => null);
        if (active) setStats(data);
      })
      .catch(() => {
        if (active) setStatsError("No se pudo cargar los indicadores.");
      })
      .finally(() => {
        if (active) setStatsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router, user]);

  useEffect(() => {
    if (!stats) {
      setAnimatedPatients(0);
      setAnimatedConsultations(0);
      return;
    }
    if (typeof window === "undefined") return;
    const targetPatients = Number(stats.total_patients) || 0;
    const targetConsultations = Number(stats.total_consultations) || 0;
    const durationMs = 760;
    const start = window.performance?.now?.() || Date.now();
    const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
    let frameId = 0;

    const animate = (now) => {
      const current = now || Date.now();
      const elapsed = Math.min((current - start) / durationMs, 1);
      const eased = easeOutQuad(elapsed);
      setAnimatedPatients(Math.round(targetPatients * eased));
      setAnimatedConsultations(Math.round(targetConsultations * eased));
      if (elapsed < 1) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    frameId = window.requestAnimationFrame(animate);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [stats]);

  useEffect(() => {
    draftRef.current = { consultaForm, medicamentos, labs };
  }, [consultaForm, medicamentos, labs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (draftRestoredRef.current) return;
    draftRestoredRef.current = true;
    let raw = null;
    try {
      raw = sessionStorage.getItem(CONSULTA_DRAFT_KEY);
    } catch {
      draftReadyRef.current = true;
      return;
    }
    if (!raw) {
      draftReadyRef.current = true;
      return;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      clearDraft();
      draftReadyRef.current = true;
      return;
    }
    if (!hasDraftContent(parsed)) {
      clearDraft();
      draftReadyRef.current = true;
      return;
    }
    const shouldRestore = window.confirm(
      "Se detecto una consulta sin guardar. Deseas continuar?"
    );
    if (!shouldRestore) {
      clearDraft();
      draftReadyRef.current = true;
      return;
    }

    const restoredForm = {
      ...DEFAULT_CONSULTA_FORM,
      ...(parsed.consultaForm || {}),
    };
    const restoredMeds = Array.isArray(parsed.medicamentos) ? parsed.medicamentos : [];
    const restoredLabs = Array.isArray(parsed.labs) ? parsed.labs : [];
    const maxMedId = getMaxNumericId(restoredMeds);
    const maxLabId = getMaxNumericId(restoredLabs);
    if (maxMedId) medIdRef.current = maxMedId;
    if (maxLabId) labIdRef.current = maxLabId;
    setConsultaForm(restoredForm);
    setMedicamentos(restoredMeds.length ? restoredMeds : [createMedicamento()]);
    setLabs(restoredLabs);
    draftReadyRef.current = true;
  }, []);

  useEffect(() => {
    if (!draftReadyRef.current) return;
    const timer = setTimeout(() => {
      persistDraft(draftRef.current);
    }, CONSULTA_DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [consultaForm, medicamentos, labs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        persistDraft(draftRef.current);
      }
    };
    const handlePageHide = () => {
      persistDraft(draftRef.current);
    };
    const handleBeforeUnload = () => {
      persistDraft(draftRef.current);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    const cedula = consultaForm.patient_username.trim();
    if (!cedula) {
      setPatientInfo(null);
      setPatientLookupStatus("idle");
      setPatientLookupMessage("");
      return;
    }
    const timer = setTimeout(() => {
      setPatientLookupStatus("loading");
      setPatientLookupMessage("");
      apiFetch(`/admin/patients?cedula=${encodeURIComponent(cedula)}`)
        .then(async (res) => {
          if (res.status === 401 || res.status === 403) {
            logout(router, "/login?type=admin");
            return;
          }
          if (res.status === 404) {
            setPatientInfo(null);
            setPatientLookupStatus("missing");
            setPatientLookupMessage("Paciente no existe. Debe crearlo primero.");
            return;
          }
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setPatientInfo(null);
            setPatientLookupStatus("error");
            setPatientLookupMessage(data.detail || "No se pudo validar el paciente.");
            return;
          }
          const data = await res.json().catch(() => null);
          setPatientInfo(data);
          setPatientLookupStatus("found");
          setPatientLookupMessage("Paciente encontrado");
        })
        .catch(() => {
          setPatientInfo(null);
          setPatientLookupStatus("error");
          setPatientLookupMessage("No se pudo validar el paciente.");
        });
    }, 400);

    return () => {
      clearTimeout(timer);
    };
  }, [consultaForm.patient_username, router]);

  useEffect(() => {
    if (!patientInfo?.id) {
      setGlucoseLogs([]);
      setGlucoseError("");
      setGlucoseMessage("");
      return;
    }
    let active = true;
    setGlucoseLoading(true);
    setGlucoseError("");
    setGlucoseMessage("");
    apiFetch(`/glucoses/patient/${patientInfo.id}`)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login?type=admin");
          return;
        }
        if (res.status === 404) {
          if (active) {
            setGlucoseLogs([]);
            setGlucoseMessage("Paciente sin registros de glucosa");
          }
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (active) {
            setGlucoseLogs([]);
            setGlucoseError(data.detail || "No se pudo cargar el historial de glucosas");
          }
          return;
        }
        const data = await res.json().catch(() => []);
        if (active) {
          const list = Array.isArray(data) ? data : [];
          setGlucoseLogs(list);
          if (!list.length) {
            setGlucoseMessage("Paciente sin registros de glucosa");
          }
        }
      })
      .catch(() => {
        if (active) {
          setGlucoseLogs([]);
          setGlucoseError("No se pudo cargar el historial de glucosas");
        }
      })
      .finally(() => {
        if (active) setGlucoseLoading(false);
      });

    return () => {
      active = false;
    };
  }, [patientInfo?.id, router]);

  useEffect(() => {
    if (!user) return;
    const endpoint =
      process.env.NODE_ENV === "development" ? "/labs/catalogo" : "/labs/catalog";
    apiFetch(endpoint)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login?type=admin");
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const detail = data?.detail || "No se pudo cargar catalogo de laboratorios.";
          setLabCatalog([]);
          setLabCatalogError(detail);
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setLabCatalog(list);
        if (!list.length) {
          setLabCatalogError(
            "Catalogo de laboratorios vacio. Ejecuta alembic upgrade head."
          );
        } else {
          setLabCatalogError("");
        }
      })
      .catch(() => {
        setLabCatalog([]);
        setLabCatalogError("No se pudo cargar catalogo de laboratorios.");
      });
  }, [router, user]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
    if (name === "fecha_nacimiento") {
      const result = computeAge(value);
      setAge(result.age);
      setDateError(result.error || "");
    }
  };

  const onConsultaChange = (event) => {
    setConsultaForm({ ...consultaForm, [event.target.name]: event.target.value });
  };

  const discardDraft = () => {
    const shouldDiscard =
      typeof window === "undefined" ||
      window.confirm("Deseas descartar la consulta en curso?");
    if (!shouldDiscard) return;
    clearDraft();
    setConsultaForm({ ...DEFAULT_CONSULTA_FORM });
    setMedicamentos([createMedicamento()]);
    setLabs([]);
    setLabRowErrors({});
    setLabsError("");
    setLabsMessage("");
    setConsultaError("");
    setConsultaSuccess("");
    setPatientInfo(null);
    setPatientLookupStatus("idle");
    setPatientLookupMessage("");
  };

  const updateMedicamentoField = (index, name, value) => {
    setMedicamentos((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [name]: value };
      return next;
    });
  };

  const onMedicamentoChange = (index, event) => {
    const { name, value } = event.target;
    updateMedicamentoField(index, name, value);
  };

  const addMedicamento = () => {
    setMedicamentos((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return [...list, createMedicamento()];
    });
  };

  const removeMedicamento = (index) => {
    const list = Array.isArray(medicamentos) ? medicamentos : [];
    if (list.length === 1) return;
    setMedicamentos(list.filter((_, i) => i !== index));
  };

  const createLabRow = () => {
    const id = String((labIdRef.current += 1));
    return {
      id,
      lab_id: "",
      valor: LAB_VALUE_EMPTY,
      unidad_snapshot: "",
      rango_ref_snapshot: "",
    };
  };

  const addLabRow = () => {
    setLabs((prev) => [...prev, createLabRow()]);
  };

  const removeLabRow = (index) => {
    setLabs((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.filter((_, i) => i !== index);
    });
  };

  const formatRango = (minValue, maxValue) => {
    if (minValue === null || minValue === undefined) {
      if (maxValue === null || maxValue === undefined) return "";
      return `<= ${maxValue}`;
    }
    if (maxValue === null || maxValue === undefined) {
      return `>= ${minValue}`;
    }
    return `${minValue} - ${maxValue}`;
  };

  const handleLabChange = (index, event) => {
    const { name, value } = event.target;
    const rowId = labs[index]?.id;
    setLabs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [name]: value };
      if (name === "lab_id") {
        const catalog = Array.isArray(labCatalog) ? labCatalog : [];
        const match = catalog.find((lab) => String(lab.id) === String(value));
        if (match) {
          next[index].unidad_snapshot = match.unidad || "";
          next[index].rango_ref_snapshot = formatRango(match.rango_ref_min, match.rango_ref_max);
        } else {
          next[index].unidad_snapshot = "";
          next[index].rango_ref_snapshot = "";
        }
      }
      return next;
    });
    if (rowId) {
      setLabRowErrors((prev) => {
        if (!prev[rowId]) return prev;
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
    }
  };

  const applyPatientSelection = (patient, clearSearch) => {
    if (!patient?.cedula) return;
    setConsultaForm((prev) => ({
      ...prev,
      patient_username: patient.cedula,
    }));
    setPatientInfo({
      cedula: patient.cedula,
      nombres: patient.nombres || "",
      apellidos: patient.apellidos || "",
    });
    setPatientLookupStatus("loading");
    setPatientLookupMessage("");
    if (typeof clearSearch === "function") {
      clearSearch();
    }
  };

  const renderPatientSearchResults = (searchState, onSelect) => {
    const results = Array.isArray(searchState.results) ? searchState.results : [];
    return (
      <>
        {searchState.status === "loading" && (
          <div className="muted">Buscando pacientes...</div>
        )}
        {searchState.status !== "loading" && searchState.error && (
          <div className="muted">{searchState.error}</div>
        )}
        {results.length > 0 && (
          <div className="list">
            {results.map((patient, index) => {
              if (!patient || typeof patient !== "object") return null;
              const patientId = patient.cedula || `patient-${index}`;
              return (
                <div
                  key={patientId}
                  className="list-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(patient)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(patient);
                    }
                  }}
                >
                  <div className="list-title">
                    {patient.apellidos || ""} {patient.nombres || ""}
                  </div>
                  <div className="list-meta">Cedula: {patient.cedula}</div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  };

  const validateLabs = (rows) => {
    const payload = [];
    const errors = {};
    const safeRows = Array.isArray(rows) ? rows : [];
    safeRows.forEach((row) => {
      const value = String(row.valor || "").trim();
      if (!row.lab_id && !value) {
        errors[row.id] = "Completa la fila o elimina el laboratorio";
        return;
      }
      if (!row.lab_id) {
        errors[row.id] = "Selecciona un laboratorio del catalogo";
        return;
      }
      if (!value) {
        errors[row.id] = "El valor es requerido";
        return;
      }
      const numericText = value.replace(",", ".");
      const numericValue = Number(numericText);
      const isNumeric = Number.isFinite(numericValue) && /^-?\d+(\.\d+)?$/.test(numericText);
      if (!isNumeric) {
        errors[row.id] = "El valor debe ser numerico";
        return;
      }
      payload.push({
        lab_id: row.lab_id,
        valor_num: numericValue,
      });
    });
    return { payload, errors };
  };

  const toNumberOrNull = (value) => {
    const cleaned = String(value || "").trim();
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };

  const toIntOrNull = (value) => {
    const cleaned = String(value || "").trim();
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isInteger(num) ? num : null;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (dateError) {
      setError(dateError);
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    try {
      const body = {
        cedula: form.cedula.trim(),
        password: form.password || null,
        nombres: form.nombres || null,
        apellidos: form.apellidos || null,
        fecha_nacimiento: form.fecha_nacimiento,
      };
      const res = await apiFetch("/admin/patients", {
        method: "POST",
        body,
      });

      const data = await res.json().catch(() => ({}));

      if (data?.success === true) {
        setForm({
          cedula: "",
          password: "",
          confirmPassword: "",
          nombres: "",
          apellidos: "",
          fecha_nacimiento: "",
        });
        setSuccess("Paciente guardado con éxito");
        setAge(null);
        setDateError("");
        return;
      }

      if (res.status === 401 || res.status === 403) {
        logout(router, "/login?type=admin");
        return;
      }

      if (res.status === 409) {
        setError("El paciente ya existe");
        return;
      }

      if (!res.ok || data?.success === false) {
        setError(data.detail || "Error al crear paciente");
        return;
      }
    } catch (err) {
      setError("Error al crear paciente");
    }
  };

  const loadConsultas = async () => {
    setConsultaError("");
    if (!consultaForm.patient_username.trim()) return;
    try {
      const cedula = consultaForm.patient_username.trim();
      const res = await apiFetch(`/admin/consultations?cedula=${encodeURIComponent(cedula)}`);
      if (res.status === 401 || res.status === 403) {
        logout(router, "/login?type=admin");
        return;
      }
      if (res.status === 404) {
        setConsultas([]);
        setConsultaError("Paciente no existe");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setConsultaError(data.detail || "No se pudo cargar las consultas");
        return;
      }
      const data = await res.json();
      setConsultas(Array.isArray(data) ? data : []);
    } catch (err) {
      setConsultaError("No se pudo cargar las consultas");
    }
  };

  const onSubmitConsulta = async (event) => {
    event.preventDefault();
    setConsultaError("");
    setConsultaSuccess("");
    setLabsError("");
    setLabsMessage("");
    setLabRowErrors({});
    const patientUsername = consultaForm.patient_username.trim();
    if (!patientUsername) {
      setConsultaError("Cedula requerida");
      return;
    }
    if (patientLookupStatus !== "found") {
      setConsultaError(patientLookupMessage || "Paciente no existe. Debe crearlo primero.");
      return;
    }
    const baseMeds = Array.isArray(medicamentos) ? medicamentos : [];
    const normalizedMeds = baseMeds.map((med) => ({
      ...med,
      nombre: med.nombre.trim(),
      cantidad: String(med.cantidad || "").trim(),
      descripcion: (med.descripcion || "").trim(),
      duracion_dias: String(med.duracion_dias || "").trim(),
    }));
    const touchedMeds = normalizedMeds.filter(
      (med) => med.nombre || med.cantidad || med.descripcion || med.duracion_dias
    );
    if (!touchedMeds.length) {
      setConsultaError("Agrega al menos un medicamento");
      return;
    }
    const invalidMed = touchedMeds.find((med) => !med.nombre || !med.cantidad);
    if (invalidMed) {
      setConsultaError("Completa medicamento y cantidad en cada fila");
      return;
    }
    const invalidQuantity = touchedMeds.find((med) => {
      const quantity = Number(med.cantidad);
      return !Number.isInteger(quantity) || quantity <= 0;
    });
    if (invalidQuantity) {
      setConsultaError("Cantidad debe ser un numero entero positivo");
      return;
    }
    const invalidDuration = touchedMeds.find((med) => {
      if (!med.duracion_dias) return false;
      const duration = Number(med.duracion_dias);
      return !Number.isInteger(duration) || duration <= 0;
    });
    if (invalidDuration) {
      setConsultaError("Duracion debe ser un numero entero positivo");
      return;
    }
    try {
      if (labs.length && !labCatalog.length) {
        setLabsError("No se pudo cargar catalogo de laboratorios");
        return;
      }
      const { payload: labsPayload, errors } = validateLabs(labs);
      if (Object.keys(errors).length) {
        setLabRowErrors(errors);
        setLabsError("Corrige los laboratorios marcados");
        return;
      }
      const res = await apiFetch("/admin/consultations", {
        method: "POST",
        body: {
          cedula: patientUsername,
          diagnosis: consultaForm.diagnostico || null,
          notes: consultaForm.notas_medicas || null,
          indications: consultaForm.indicaciones_generales || null,
          weight: toNumberOrNull(consultaForm.weight),
          height: toNumberOrNull(consultaForm.height),
          blood_pressure: consultaForm.blood_pressure.trim() || null,
          heart_rate: toIntOrNull(consultaForm.heart_rate),
          oxygen_saturation: toIntOrNull(consultaForm.oxygen_saturation),
          abdominal_circumference: toNumberOrNull(consultaForm.abdominal_circumference),
          reason_for_visit: consultaForm.reason_for_visit.trim() || null,
          current_illness: consultaForm.current_illness.trim() || null,
          physical_exam: consultaForm.physical_exam.trim() || null,
          requested_exams: consultaForm.requested_exams.trim() || null,
          next_visit_date: consultaForm.next_visit_date || null,
          medications: touchedMeds.map((med, index) => {
            const quantity = Number(med.cantidad);
            const durationDays = med.duracion_dias ? Number(med.duracion_dias) : null;
            return {
              drug_name: med.nombre,
              quantity,
              description: med.descripcion || null,
              duration_days: durationDays,
              sort_order: index,
            };
          }),
        },
      });

      if (res.status === 401 || res.status === 403) {
        logout(router, "/login?type=admin");
        return;
      }
      if (res.status === 404) {
        setConsultaError("Paciente no existe");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setConsultaError(data.detail || "No se pudo crear la consulta");
        return;
      }
      const created = await res.json().catch(() => null);
      if (!created?.id) {
        setConsultaError("No se pudo crear la consulta");
        return;
      }
      if (labsPayload.length) {
        const labsRes = await apiFetch(`/consultas/${created.id}/labs`, {
          method: "POST",
          body: labsPayload,
        });
        if (labsRes.status === 401 || labsRes.status === 403) {
          logout(router, "/login?type=admin");
          return;
        }
        if (!labsRes.ok) {
          const data = await labsRes.json().catch(() => ({}));
          setLabsError(data.detail || "No se pudieron guardar los laboratorios");
          return;
        }
        setLabsMessage("Laboratorios guardados");
      }

      clearDraft();
      setConsultaSuccess("Consulta creada correctamente");
      setConsultaForm({
        ...DEFAULT_CONSULTA_FORM,
        patient_username: patientUsername,
      });
      setMedicamentos([createMedicamento()]);
      setLabs([]);
      await loadConsultas();
    } catch (err) {
      setConsultaError("No se pudo crear la consulta");
    }
  };

  const toggleSection = (key) => {
    setSectionsOpen((prev) => ({
      createPatient: key === "createPatient" ? !prev.createPatient : false,
      searchPatient: key === "searchPatient" ? !prev.searchPatient : false,
      createConsultation: key === "createConsultation" ? !prev.createConsultation : false,
    }));
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

  const safeConsultas = Array.isArray(consultas) ? consultas : [];
  const safeMedicamentos = Array.isArray(medicamentos) ? medicamentos : [];
  const safeLabs = Array.isArray(labs) ? labs : [];
  const safeLabCatalog = Array.isArray(labCatalog) ? labCatalog : [];
  const safeLabRowErrors =
    labRowErrors && typeof labRowErrors === "object" ? labRowErrors : {};
  const patientCedula = String(
    patientInfo?.cedula || consultaForm.patient_username || ""
  ).trim();

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
  const glucoseTrend = useMemo(() => {
    if (!Array.isArray(orderedGlucoseLogs) || orderedGlucoseLogs.length < 2) return null;
    const latestValue = Number(orderedGlucoseLogs[0]?.value);
    const previousValue = Number(orderedGlucoseLogs[1]?.value);
    if (!Number.isFinite(latestValue) || !Number.isFinite(previousValue)) return null;
    const delta = latestValue - previousValue;
    if (Math.abs(delta) <= GLUCOSE_TREND_THRESHOLD) {
      return { icon: "→", color: "#6b7280" };
    }
    if (delta > 0) {
      return { icon: "↑", color: "#dc2626" };
    }
    return { icon: "↓", color: "#16a34a" };
  }, [orderedGlucoseLogs]);
  const glucoseAlert = useMemo(() => {
    if (!Array.isArray(orderedGlucoseLogs) || !orderedGlucoseLogs.length) return null;
    const latestValue = Number(orderedGlucoseLogs[0]?.value);
    if (!Number.isFinite(latestValue)) return null;
    if (latestValue < GLUCOSE_HYPO_THRESHOLD) {
      return { text: "Riesgo de hipoglucemia", color: "#991b1b", background: "#fee2e2" };
    }
    if (latestValue > GLUCOSE_HYPER_THRESHOLD) {
      return { text: "Hiperglucemia", color: "#92400e", background: "#fffbeb" };
    }
    return null;
  }, [orderedGlucoseLogs]);
  const glucoseChart = useMemo(() => {
    if (!Array.isArray(orderedGlucoseLogs) || orderedGlucoseLogs.length < 2) return null;
    const points = orderedGlucoseLogs
      .slice(0, GLUCOSE_MAX_RECORDS)
      .reverse()
      .map((log) => ({
        value: Number(log?.value),
        label: formatShortDate(log?.taken_at || log?.created_at),
      }))
      .filter((point) => Number.isFinite(point.value));
    if (points.length < 2) return null;
    const values = points.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = Math.max(maxValue - minValue, 1);
    const width = GLUCOSE_CHART_WIDTH;
    const height = GLUCOSE_CHART_HEIGHT;
    const padding = GLUCOSE_CHART_PADDING;
    const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
    const plotHeight = height - padding * 2;
    const path = points
      .map((point, index) => {
        const x = padding + index * xStep;
        const normalized = (point.value - minValue) / range;
        const y = height - padding - normalized * plotHeight;
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
    return { points, path, minValue, maxValue };
  }, [orderedGlucoseLogs]);

  const glucoseChartPoints = Array.isArray(glucoseChart?.points) ? glucoseChart.points : [];

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="page">
        <div className="card">
          <div className="error">{authError}</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <div className="card">
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card admin-shell space-y-4">
        <header className="admin-header flex flex-col gap-3 md:flex-row md:items-center md:justify-between !bg-white !border-slate-200/70 !shadow-sm !rounded-2xl">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-slate-900">Portal administrativo clinico</h1>
            <p className="muted text-sm">Sesion activa: {user.username}</p>
            <div className="admin-meta text-sm">
              Rol: {user.role} | Activo: {user.activo ? "Si" : "No"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout(router)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-700 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/60"
          >
            Cerrar sesion
          </button>
        </header>
        <div className="admin-actions !flex !flex-wrap !gap-2 rounded-xl border border-slate-200/70 bg-slate-50 p-2">
          <button
            type="button"
            className={`admin-toggle ${sectionsOpen.createPatient ? "is-open" : ""} flex-1 rounded-lg text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/60 ${
              sectionsOpen.createPatient
                ? "!bg-white !border-slate-200/70 text-slate-900 shadow-sm"
                : "!bg-transparent !border-transparent text-slate-500 hover:text-slate-700 hover:!bg-white/70"
            }`}
            onClick={() => toggleSection("createPatient")}
            aria-expanded={sectionsOpen.createPatient}
          >
            Registrar paciente
          </button>
          <button
            type="button"
            className={`admin-toggle ${sectionsOpen.searchPatient ? "is-open" : ""} flex-1 rounded-lg text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/60 ${
              sectionsOpen.searchPatient
                ? "!bg-white !border-slate-200/70 text-slate-900 shadow-sm"
                : "!bg-transparent !border-transparent text-slate-500 hover:text-slate-700 hover:!bg-white/70"
            }`}
            onClick={() => toggleSection("searchPatient")}
            aria-expanded={sectionsOpen.searchPatient}
          >
            Buscar y abrir ficha
          </button>
          <button
            type="button"
            className={`admin-toggle ${sectionsOpen.createConsultation ? "is-open" : ""} flex-1 rounded-lg text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/60 ${
              sectionsOpen.createConsultation
                ? "!bg-white !border-slate-200/70 text-slate-900 shadow-sm"
                : "!bg-transparent !border-transparent text-slate-500 hover:text-slate-700 hover:!bg-white/70"
            }`}
            onClick={() => toggleSection("createConsultation")}
            aria-expanded={sectionsOpen.createConsultation}
          >
            Abrir nueva consulta
          </button>
          <button
            type="button"
            className="admin-toggle flex-1 rounded-lg text-sm font-semibold text-slate-500 transition hover:text-slate-700 hover:!bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/60 !bg-transparent !border-transparent"
            onClick={() => router.push("/admin/consultations/list")}
          >
            Ver consultas
          </button>
        </div>
        <div className="consultation-card !rounded-2xl !border-slate-200/70 !bg-slate-50/70 !shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Indicadores globales
            </span>
            {!statsLoading && !statsError && stats && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600">
                Actualizado
              </span>
            )}
            {statsError && (
              <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-600">
                Sin conexion
              </span>
            )}
          </div>
          {statsLoading && (
            <>
              <div className="muted text-sm">Cargando indicadores...</div>
              <div className="kpi-grid mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-hidden="true">
                <div className="kpi-skeleton">
                  <div className="kpi-skeleton-line kpi-skeleton-label" />
                  <div className="kpi-skeleton-line kpi-skeleton-value" />
                </div>
                <div className="kpi-skeleton">
                  <div className="kpi-skeleton-line kpi-skeleton-label" />
                  <div className="kpi-skeleton-line kpi-skeleton-value" />
                </div>
              </div>
            </>
          )}
          {statsError && <div className="error">{statsError}</div>}
          {!statsLoading && !statsError && !stats && (
            <div className="muted">Sin datos disponibles.</div>
          )}
          {!statsLoading && !statsError && stats && (
            <div className="kpi-grid mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="kpi-card flex items-center justify-between rounded-xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div>
                  <div className="kpi-label text-xs font-medium uppercase tracking-wide text-slate-500">
                    Pacientes registrados
                  </div>
                  <div className="kpi-value text-2xl font-semibold text-slate-900 tabular-nums">
                    {animatedPatients}
                  </div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
                    <path d="M5 21a7 7 0 0 1 14 0" />
                  </svg>
                </div>
              </div>
              <div className="kpi-card flex items-center justify-between rounded-xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div>
                  <div className="kpi-label text-xs font-medium uppercase tracking-wide text-slate-500">
                    Consultas realizadas
                  </div>
                  <div className="kpi-value text-2xl font-semibold text-slate-900 tabular-nums">
                    {animatedConsultations}
                  </div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 7h8" />
                    <path d="M8 11h8" />
                    <path d="M8 15h5" />
                    <path d="M6 3h9l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {sectionsOpen.createPatient && (
        <section className="card admin-section rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Registro de paciente</h2>
            <p className="text-sm text-slate-500">
              Complete los datos para crear un nuevo paciente
            </p>
          </div>
          {error && (
            <div className="error rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          {success && (
            <div className="success rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </div>
          )}
          <form onSubmit={onSubmit} className="form grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Cedula
              <input
                name="cedula"
                value={form.cedula}
                onChange={onChange}
                required
                placeholder="Ingrese la cedula"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Password
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={onChange}
                placeholder="Ingrese un password"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Confirmar password
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={onChange}
                placeholder="Repita el password"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Nombres
              <input
                name="nombres"
                value={form.nombres}
                onChange={onChange}
                placeholder="Ingrese los nombres"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Apellidos
              <input
                name="apellidos"
                value={form.apellidos}
                onChange={onChange}
                placeholder="Ingrese los apellidos"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Fecha de nacimiento
              <input
                type="date"
                name="fecha_nacimiento"
                value={form.fecha_nacimiento}
                onChange={onChange}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
              />
            </label>
            {dateError && (
              <div className="error rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 md:col-span-2">
                {dateError}
              </div>
            )}
            {!dateError && age !== null && (
              <div className="muted text-sm md:col-span-2">Edad: {age} anos</div>
            )}
            {!dateError && age === null && form.fecha_nacimiento && (
              <div className="muted text-sm md:col-span-2">Edad: -</div>
            )}
            <button
              type="submit"
              className="button-primary w-full rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-300/60 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2"
              disabled={!canSubmit(form, dateError)}
            >
              Registrar paciente
            </button>
          </form>
        </section>
      )}

      {sectionsOpen.searchPatient && (
        <section className="card admin-section">
          <h2>Acceso a ficha del paciente</h2>
          <div className="consultation-card">
            <div className="section-title">Ficha del paciente</div>
            <div className="form">
              <label>
                Cedula paciente
                <input
                  name="patient_username"
                  value={consultaForm.patient_username}
                  onChange={onConsultaChange}
                  placeholder="Ingrese la cedula"
                />
              </label>
              <label>
                Buscar por nombre o apellido (opcional)
                <input
                  name="patient_name_search"
                  value={searchPatient.query}
                  onChange={(event) => searchPatient.setQuery(event.target.value)}
                  placeholder="Ingrese nombres o apellidos"
                />
              </label>
              {renderPatientSearchResults(searchPatient, (patient) =>
                applyPatientSelection(patient, searchPatient.clear)
              )}
              {patientLookupStatus === "loading" && (
                <div className="muted">Validando paciente...</div>
              )}
              {patientLookupStatus === "found" && (
                <div className="success">{patientLookupMessage}</div>
              )}
              {patientLookupStatus !== "found" && patientLookupMessage && (
                <div className="error">{patientLookupMessage}</div>
              )}
              <label>
                Nombres
                <input value={patientInfo?.nombres || ""} disabled readOnly />
              </label>
              <label>
                Apellidos
                <input value={patientInfo?.apellidos || ""} disabled readOnly />
              </label>
            </div>
          </div>
          <div className="consultation-card">
            <div className="section-title">Consultas recientes del paciente</div>
            <button type="button" className="button-primary" onClick={loadConsultas}>
              Ver consultas recientes
            </button>
          </div>
          <div className="consultation-card">
            {consultaError && <div className="error">{consultaError}</div>}
            <div className="list">
              {safeConsultas.map((item, index) => {
                if (!item || typeof item !== "object") return null;
                const itemId = item.id || `consulta-${index}`;
                const createdAt = item.created_at
                  ? new Date(item.created_at).toLocaleDateString()
                  : "";
                const diagnosisText = item.diagnosis || "";
                const canNavigate = Boolean(item.id);
                const handleOpen = () => {
                  if (!item.id) return;
                  router.push(`/dashboard/consultas/${item.id}`);
                };
                return (
                  <div
                    key={itemId}
                    className={`list-item${canNavigate ? " clickable-consultation" : ""}`}
                    onClick={canNavigate ? handleOpen : undefined}
                    onKeyDown={
                      canNavigate
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleOpen();
                            }
                          }
                        : undefined
                    }
                    role={canNavigate ? "button" : undefined}
                    tabIndex={canNavigate ? 0 : undefined}
                  >
                    <div className="list-title">{createdAt}</div>
                    {diagnosisText && <div className="list-meta">{diagnosisText}</div>}
                  </div>
                );
                })}
            </div>
          </div>
          <div className="consultation-card">
            <div className="section-title">
              Alertas y seguimiento de glucosa{" "}
              {glucoseTrend && (
                <span style={{ color: glucoseTrend.color, fontWeight: 700 }}>
                  {glucoseTrend.icon}
                </span>
              )}
            </div>
            <div className="list">
              {glucoseLoading && <div className="muted">Cargando historial...</div>}
              {glucoseError && <div className="error">{glucoseError}</div>}
              {!glucoseLoading && !glucoseError && glucoseMessage && (
                <div className="muted">{glucoseMessage}</div>
              )}
              {!glucoseLoading &&
                !glucoseError &&
                glucoseSummaryLogs.map((log, index) => {
                  if (!log || typeof log !== "object") return null;
                  const logId =
                    log.id ||
                    `${log.taken_at || log.created_at || "glucose"}-${index}`;
                  const logDate = formatDate(log.taken_at || log.created_at);
                  const logType =
                    log.type === "postprandial"
                      ? "Postprandial"
                      : log.type === "ayuno"
                        ? "Ayuno"
                        : "Sin tipo";
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
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                if (!patientCedula) return;
                router.push(
                  `/dashboard/patient/${encodeURIComponent(patientCedula)}/glucosas`
                );
              }}
              disabled={!patientCedula}
            >
              Ver registros de glucosa
            </button>
          </div>
        </section>
      )}

      {sectionsOpen.createConsultation && (
        <section className="card admin-section">
          <h2>Nueva consulta clinica</h2>
          {consultaError && <div className="error">{consultaError}</div>}
          {consultaSuccess && <div className="success">{consultaSuccess}</div>}
          <form onSubmit={onSubmitConsulta} className="form">
            <label>
              Buscar por nombre o apellido (opcional)
              <input
                name="consultation_name_search"
                value={consultationSearch.query}
                onChange={(event) => consultationSearch.setQuery(event.target.value)}
                placeholder="Ingrese nombres o apellidos"
              />
            </label>
            {renderPatientSearchResults(consultationSearch, (patient) =>
              applyPatientSelection(patient, consultationSearch.clear)
            )}
            <label>
              Cedula paciente
              <input
                name="patient_username"
                value={consultaForm.patient_username}
                onChange={onConsultaChange}
                required
              />
            </label>
            {patientLookupStatus === "loading" && (
              <div className="muted">Validando paciente...</div>
            )}
            {patientLookupStatus === "found" && (
              <div className="success">{patientLookupMessage}</div>
            )}
            {patientLookupStatus !== "found" && patientLookupMessage && (
              <div className="error">{patientLookupMessage}</div>
            )}
            <label>
              Nombres
              <input value={patientInfo?.nombres || ""} disabled readOnly />
            </label>
            <label>
              Apellidos
              <input value={patientInfo?.apellidos || ""} disabled readOnly />
            </label>
            <details className="admin-section-group">
              <summary className="admin-section-title">Signos vitales</summary>
              <div className="admin-section-content form two">
                <label>
                  Peso (kg)
                  <input
                    type="number"
                    step="any"
                    name="weight"
                    value={consultaForm.weight}
                    onChange={onConsultaChange}
                  />
                </label>
                <label>
                  Talla (cm)
                  <input
                    type="number"
                    step="any"
                    name="height"
                    value={consultaForm.height}
                    onChange={onConsultaChange}
                  />
                </label>
                <label>
                  Presion arterial
                  <input
                    name="blood_pressure"
                    value={consultaForm.blood_pressure}
                    onChange={onConsultaChange}
                  />
                </label>
                <label>
                  Frecuencia cardiaca
                  <input
                    type="number"
                    name="heart_rate"
                    value={consultaForm.heart_rate}
                    onChange={onConsultaChange}
                  />
                </label>
                <label>
                  Saturacion O2
                  <input
                    type="number"
                    name="oxygen_saturation"
                    value={consultaForm.oxygen_saturation}
                    onChange={onConsultaChange}
                  />
                </label>
                <label>
                  Circunferencia abdominal
                  <input
                    type="number"
                    step="any"
                    name="abdominal_circumference"
                    value={consultaForm.abdominal_circumference}
                    onChange={onConsultaChange}
                  />
                </label>
              </div>
            </details>

            <details className="admin-section-group">
              <summary className="admin-section-title">Motivo de consulta</summary>
              <div className="admin-section-content">
                <label>
                  Motivo de consulta
                  <textarea
                    name="reason_for_visit"
                    value={consultaForm.reason_for_visit}
                    onChange={onConsultaChange}
                  />
                </label>
              </div>
            </details>

            <details className="admin-section-group">
              <summary className="admin-section-title">Historia actual</summary>
              <div className="admin-section-content">
                <label>
                  Historia actual
                  <textarea
                    name="current_illness"
                    value={consultaForm.current_illness}
                    onChange={onConsultaChange}
                  />
                </label>
              </div>
            </details>

            <details className="admin-section-group">
              <summary className="admin-section-title">Examen fisico</summary>
              <div className="admin-section-content">
                <label>
                  Examen fisico
                  <textarea
                    name="physical_exam"
                    value={consultaForm.physical_exam}
                    onChange={onConsultaChange}
                  />
                </label>
              </div>
            </details>

            <details className="admin-section-group" open>
              <summary className="admin-section-title">Diagnostico</summary>
              <div className="admin-section-content">
                <label>
                  Diagnostico
                  <textarea
                    name="diagnostico"
                    value={consultaForm.diagnostico}
                    onChange={onConsultaChange}
                  />
                </label>
                <label>
                  Notas medicas
                  <textarea
                    name="notas_medicas"
                    value={consultaForm.notas_medicas}
                    onChange={onConsultaChange}
                  />
                </label>
              </div>
            </details>

            <details className="admin-section-group" open>
              <summary className="admin-section-title">Tratamiento</summary>
              <div className="admin-section-content">
                <label>
                  Indicaciones generales
                  <textarea
                    name="indicaciones_generales"
                    value={consultaForm.indicaciones_generales}
                    onChange={onConsultaChange}
                  />
                </label>
                <div className="list">
                  {safeMedicamentos.map((med, index) => {
                    if (!med || typeof med !== "object") return null;
                    const medId = med.id || `med-${index}`;
                    return (
                      <div key={medId} className="item-block">
                        <div className="form two">
                          <label>
                            Medicamento
                            <input
                              name="nombre"
                              value={med.nombre || ""}
                              onChange={(e) => onMedicamentoChange(index, e)}
                            />
                          </label>
                          <label>
                            Cantidad
                            <input
                              type="number"
                              name="cantidad"
                              value={med.cantidad || ""}
                              onChange={(e) => onMedicamentoChange(index, e)}
                            />
                          </label>
                          <label>
                            Descripcion
                            <textarea
                              name="descripcion"
                              value={med.descripcion || ""}
                              onChange={(e) => onMedicamentoChange(index, e)}
                            />
                          </label>
                          <label>
                            Duracion (dias)
                            <input
                              type="number"
                              name="duracion_dias"
                              value={med.duracion_dias || ""}
                              onChange={(e) => onMedicamentoChange(index, e)}
                            />
                          </label>
                        </div>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => removeMedicamento(index)}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={addMedicamento}>
                  Agregar medicamento
                </button>
              </div>
            </details>

            <details className="admin-section-group">
              <summary className="admin-section-title">Laboratorios</summary>
              <div className="admin-section-content">
                {labsError && <div className="error">{labsError}</div>}
                {labsMessage && <div className="muted">{labsMessage}</div>}
                <div className="list">
                  {safeLabs.map((row, index) => {
                    if (!row || typeof row !== "object") return null;
                    const rowId = row.id || `lab-${index}`;
                    return (
                      <div key={rowId} className="list-item">
                        <label>
                          Laboratorio
                          <select
                            name="lab_id"
                            value={row.lab_id || ""}
                            onChange={(e) => handleLabChange(index, e)}
                          >
                            <option value="">Seleccionar</option>
                            {safeLabCatalog.map((lab, labIndex) => {
                              if (!lab || typeof lab !== "object") return null;
                              const labId = lab.id || `lab-${labIndex}`;
                              return (
                                <option key={labId} value={lab.id}>
                                  {lab.nombre}
                                </option>
                              );
                            })}
                          </select>
                        </label>
                        <label>
                          Valor
                          <input
                            type="number"
                            step="any"
                            name="valor"
                            value={row.valor ?? ""}
                            onChange={(e) => handleLabChange(index, e)}
                          />
                        </label>
                        {safeLabRowErrors[rowId] && (
                          <div className="error">{safeLabRowErrors[rowId]}</div>
                        )}
                        <div className="list-meta">
                          {row.unidad_snapshot && `Unidad: ${row.unidad_snapshot}`}
                          {row.unidad_snapshot && row.rango_ref_snapshot ? " | " : ""}
                          {row.rango_ref_snapshot && `Rango: ${row.rango_ref_snapshot}`}
                        </div>
                        <button type="button" onClick={() => removeLabRow(index)}>
                          Quitar
                        </button>
                      </div>
                    );
                  })}
                </div>
                {labCatalogError && <div className="error">{labCatalogError}</div>}
                <button type="button" onClick={addLabRow}>
                  Agregar laboratorio
                </button>
              </div>
            </details>

            <details className="admin-section-group">
              <summary className="admin-section-title">Examenes solicitados</summary>
              <div className="admin-section-content">
                <label>
                  Examenes solicitados
                  <textarea
                    name="requested_exams"
                    value={consultaForm.requested_exams}
                    onChange={onConsultaChange}
                  />
                </label>
              </div>
            </details>

            <details className="admin-section-group">
              <summary className="admin-section-title">Proxima cita</summary>
              <div className="admin-section-content">
                <label>
                  Proxima cita
                  <input
                    type="date"
                    name="next_visit_date"
                    value={consultaForm.next_visit_date}
                    onChange={onConsultaChange}
                  />
                </label>
              </div>
            </details>
            <button
              type="submit"
              className="button-primary"
              disabled={patientLookupStatus !== "found"}
            >
              Guardar consulta
            </button>
            <button type="button" className="button-secondary" onClick={discardDraft}>
              Descartar borrador
            </button>
          </form>
        </section>
      )}
      <style jsx>{`
        .clickable-consultation {
          cursor: pointer;
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }

        .clickable-consultation:hover {
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.12);
          transform: translateY(-1px);
        }

        .kpi-skeleton {
          position: relative;
          overflow: hidden;
          border-radius: 16px;
          border: 1px solid rgba(226, 232, 240, 0.7);
          background: #f1f5f9;
          padding: 14px 16px;
          min-height: 84px;
        }

        .kpi-skeleton::after {
          content: "";
          position: absolute;
          top: 0;
          left: -60%;
          width: 60%;
          height: 100%;
          background: linear-gradient(
            90deg,
            rgba(241, 245, 249, 0) 0%,
            rgba(255, 255, 255, 0.6) 50%,
            rgba(241, 245, 249, 0) 100%
          );
          animation: kpi-shimmer 1.2s ease-in-out infinite;
        }

        .kpi-skeleton-line {
          height: 12px;
          border-radius: 999px;
          background: #e2e8f0;
        }

        .kpi-skeleton-label {
          width: 55%;
          margin-bottom: 12px;
        }

        .kpi-skeleton-value {
          width: 35%;
          height: 20px;
        }

        @keyframes kpi-shimmer {
          0% {
            transform: translateX(-60%);
          }
          100% {
            transform: translateX(220%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .kpi-skeleton::after {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
