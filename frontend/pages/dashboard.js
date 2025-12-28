import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { apiFetch, logout } from "../lib/auth";
import { useAuthGuard } from "../hooks/useAuthGuard";

const LAB_VALUE_EMPTY = "";

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

export default function Dashboard() {
  const router = useRouter();
  const { user, loading, error: authError } = useAuthGuard();
  const [form, setForm] = useState({
    cedula: "",
    password: "",
    nombres: "",
    apellidos: "",
    fecha_nacimiento: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [age, setAge] = useState(null);
  const [dateError, setDateError] = useState("");
  const [consultaForm, setConsultaForm] = useState({
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
  });
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
  const [consultas, setConsultas] = useState([]);
  const [labCatalog, setLabCatalog] = useState([]);
  const [labCatalogError, setLabCatalogError] = useState("");
  const [labs, setLabs] = useState([]);
  const [labsError, setLabsError] = useState("");
  const [labsMessage, setLabsMessage] = useState("");
  const [labRowErrors, setLabRowErrors] = useState({});
  const [sectionsOpen, setSectionsOpen] = useState({
    createPatient: false,
    searchPatient: false,
    createConsultation: false,
  });
  const labIdRef = useRef(0);

  useEffect(() => {
    if (!user) return;
    if (String(user.role).toLowerCase() !== "admin") {
      logout(router, "/login?type=admin");
    }
  }, [router, user]);

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

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <h1>Dashboard</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="page">
        <div className="card">
          <h1>Dashboard</h1>
          <div className="error">{authError}</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

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
    setMedicamentos([...medicamentos, createMedicamento()]);
  };

  const removeMedicamento = (index) => {
    if (medicamentos.length === 1) return;
    setMedicamentos(medicamentos.filter((_, i) => i !== index));
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
    setLabs((prev) => prev.filter((_, i) => i !== index));
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
        const match = labCatalog.find((lab) => String(lab.id) === String(value));
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

  const validateLabs = (rows) => {
    const payload = [];
    const errors = {};
    rows.forEach((row) => {
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

      if (res.status === 401 || res.status === 403) {
        logout(router, "/login?type=admin");
        return;
      }

      if (res.status === 409) {
        setError("El paciente ya existe");
        return;
      }

      if (res.status >= 400) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Error al crear paciente");
        return;
      }

      setForm({ cedula: "", password: "", nombres: "", apellidos: "", fecha_nacimiento: "" });
      setSuccess("Paciente creado");
      setAge(null);
      setDateError("");
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
    const normalizedMeds = medicamentos.map((med) => ({
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

      setConsultaSuccess("Consulta creada correctamente");
      setConsultaForm({
        patient_username: patientUsername,
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
      });
      setMedicamentos([createMedicamento()]);
      setLabs([]);
      await loadConsultas();
    } catch (err) {
      setConsultaError("No se pudo crear la consulta");
    }
  };

  const toggleSection = (key) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="page">
      <div className="card admin-shell">
        <header className="admin-header">
          <div>
            <h1>Bienvenido Dr. Guzman - Portal de gestion medica</h1>
            <p className="muted">Sesion iniciada como {user.username}</p>
            <div className="admin-meta">
              Rol: {user.role} | Activo: {user.activo ? "Si" : "No"}
            </div>
          </div>
          <button type="button" onClick={() => logout(router)}>
            Cerrar sesion
          </button>
        </header>
        <div className="admin-actions">
          <button
            type="button"
            className={`admin-toggle ${sectionsOpen.createPatient ? "is-open" : ""}`}
            onClick={() => toggleSection("createPatient")}
            aria-expanded={sectionsOpen.createPatient}
          >
            Crear paciente
          </button>
          <button
            type="button"
            className={`admin-toggle ${sectionsOpen.searchPatient ? "is-open" : ""}`}
            onClick={() => toggleSection("searchPatient")}
            aria-expanded={sectionsOpen.searchPatient}
          >
            Buscar paciente
          </button>
          <button
            type="button"
            className={`admin-toggle ${sectionsOpen.createConsultation ? "is-open" : ""}`}
            onClick={() => toggleSection("createConsultation")}
            aria-expanded={sectionsOpen.createConsultation}
          >
            Crear consulta
          </button>
        </div>
      </div>

      {sectionsOpen.createPatient && (
        <section className="card admin-section">
          <h2>Crear paciente</h2>
          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}
          <form onSubmit={onSubmit} className="form">
            <label>
              Cedula
              <input name="cedula" value={form.cedula} onChange={onChange} required />
            </label>
            <label>
              Password
              <input type="password" name="password" value={form.password} onChange={onChange} />
            </label>
            <label>
              Nombres
              <input name="nombres" value={form.nombres} onChange={onChange} />
            </label>
            <label>
              Apellidos
              <input name="apellidos" value={form.apellidos} onChange={onChange} />
            </label>
            <label>
              Fecha de nacimiento
              <input
                type="date"
                name="fecha_nacimiento"
                value={form.fecha_nacimiento}
                onChange={onChange}
                required
              />
            </label>
            {dateError && <div className="error">{dateError}</div>}
            {!dateError && age !== null && <div className="muted">Edad: {age} anos</div>}
            {!dateError && age === null && form.fecha_nacimiento && <div className="muted">Edad: -</div>}
            <button type="submit" disabled={!canSubmit(form, dateError)}>
              Crear
            </button>
          </form>
        </section>
      )}

      {sectionsOpen.searchPatient && (
        <section className="card admin-section">
          <h2>Buscar paciente</h2>
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
          <button type="button" onClick={loadConsultas}>
            Consultas recientes del paciente
          </button>
          {consultaError && <div className="error">{consultaError}</div>}
          <div className="list">
            {consultas.map((item) => (
              <div key={item.id} className="list-item">
                <div className="list-title">{new Date(item.created_at).toLocaleDateString()}</div>
                {item.diagnosis && <div className="list-meta">{item.diagnosis}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {sectionsOpen.createConsultation && (
        <section className="card admin-section">
          <h2>Crear consulta</h2>
          {consultaError && <div className="error">{consultaError}</div>}
          {consultaSuccess && <div className="success">{consultaSuccess}</div>}
          <form onSubmit={onSubmitConsulta} className="form">
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
                  {medicamentos.map((med, index) => (
                    <div key={med.id} className="item-block">
                      <div className="form two">
                        <label>
                          Medicamento
                          <input
                            name="nombre"
                            value={med.nombre}
                            onChange={(e) => onMedicamentoChange(index, e)}
                          />
                        </label>
                        <label>
                          Cantidad
                          <input
                            type="number"
                            name="cantidad"
                            value={med.cantidad}
                            onChange={(e) => onMedicamentoChange(index, e)}
                          />
                        </label>
                        <label>
                          Descripcion
                          <textarea
                            name="descripcion"
                            value={med.descripcion}
                            onChange={(e) => onMedicamentoChange(index, e)}
                          />
                        </label>
                        <label>
                          Duracion (dias)
                          <input
                            type="number"
                            name="duracion_dias"
                            value={med.duracion_dias}
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
                  ))}
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
                  {labs.map((row, index) => (
                    <div key={row.id} className="list-item">
                      <label>
                        Laboratorio
                        <select
                          name="lab_id"
                          value={row.lab_id}
                          onChange={(e) => handleLabChange(index, e)}
                        >
                          <option value="">Seleccionar</option>
                          {labCatalog.map((lab) => (
                            <option key={lab.id} value={lab.id}>
                              {lab.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Valor
                        <input
                          type="number"
                          step="any"
                          name="valor"
                          value={row.valor}
                          onChange={(e) => handleLabChange(index, e)}
                        />
                      </label>
                      {labRowErrors[row.id] && <div className="error">{labRowErrors[row.id]}</div>}
                      <div className="list-meta">
                        {row.unidad_snapshot && `Unidad: ${row.unidad_snapshot}`}
                        {row.unidad_snapshot && row.rango_ref_snapshot ? " | " : ""}
                        {row.rango_ref_snapshot && `Rango: ${row.rango_ref_snapshot}`}
                      </div>
                      <button type="button" onClick={() => removeLabRow(index)}>
                        Quitar
                      </button>
                    </div>
                  ))}
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
            <button type="submit" disabled={patientLookupStatus !== "found"}>
              Guardar consulta
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
