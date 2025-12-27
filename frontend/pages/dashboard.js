import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { apiFetch, logout } from "../lib/auth";
import { useAuthGuard } from "../hooks/useAuthGuard";

const LAB_VALUE_EMPTY = "";
const MEDICATION_OPTIONS = ["Metformina", "Atorvastatina", "Losartan", "AAS", "Omeprazol"];

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
  const [activeMedId, setActiveMedId] = useState(null);
  const [activeMedIndex, setActiveMedIndex] = useState(-1);
  const [labCatalog, setLabCatalog] = useState([]);
  const [labCatalogError, setLabCatalogError] = useState("");
  const [labs, setLabs] = useState([]);
  const [labsError, setLabsError] = useState("");
  const [labsMessage, setLabsMessage] = useState("");
  const [labRowErrors, setLabRowErrors] = useState({});
  const [medsOpen, setMedsOpen] = useState(true);
  const [labsOpen, setLabsOpen] = useState(true);
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
    if (name === "nombre") {
      setActiveMedId(medicamentos[index]?.id);
      setActiveMedIndex(-1);
    }
  };

  const getMedicationMatches = (value) => {
    const term = (value || "").trim().toLowerCase();
    if (!term) return MEDICATION_OPTIONS;
    return MEDICATION_OPTIONS.filter((option) => option.toLowerCase().includes(term));
  };

  const handleMedicationKeyDown = (event, index, med) => {
    const matches = getMedicationMatches(med.nombre);
    if (!matches.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveMedId(med.id);
      setActiveMedIndex((prev) => {
        if (prev < 0) return 0;
        return (prev + 1) % matches.length;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveMedId(med.id);
      setActiveMedIndex((prev) => {
        if (prev <= 0) return matches.length - 1;
        return prev - 1;
      });
      return;
    }

    if (event.key === "Enter" && activeMedId === med.id && activeMedIndex >= 0) {
      event.preventDefault();
      const selected = matches[activeMedIndex];
      updateMedicamentoField(index, "nombre", selected);
      setActiveMedId(null);
      setActiveMedIndex(-1);
      return;
    }

    if (event.key === "Escape") {
      setActiveMedId(null);
      setActiveMedIndex(-1);
    }
  };

  const handleMedicationSelect = (index, option) => {
    updateMedicamentoField(index, "nombre", option);
    setActiveMedId(null);
    setActiveMedIndex(-1);
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
          medications: touchedMeds.map((med, index) => {
            const detail = [
              `Cantidad: ${med.cantidad}`,
              med.descripcion ? `Descripcion: ${med.descripcion}` : null,
              med.duracion_dias ? `Duracion: ${med.duracion_dias} dias` : null,
            ]
              .filter(Boolean)
              .join(" | ");
            return {
              drug_name: med.nombre,
              dose: med.cantidad,
              route: null,
              frequency: null,
              duration: med.duracion_dias ? `${med.duracion_dias} dias` : null,
              indications: detail || null,
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
      });
      setMedicamentos([createMedicamento()]);
      setLabs([]);
      await loadConsultas();
    } catch (err) {
      setConsultaError("No se pudo crear la consulta");
    }
  };

  return (
    <div className="page">
      <div className="card">
        <h1>Dashboard</h1>
        <p className="muted">Sesion iniciada</p>
        <div>Usuario: {user.username}</div>
        <div>Rol: {user.role}</div>
        <div>Activo: {user.activo ? "Si" : "No"}</div>
        <button type="button" onClick={() => logout(router)}>
          Cerrar sesion
        </button>
      </div>
      <div className="card">
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
          {!dateError && age !== null && <div className="muted">Edad: {age} años</div>}
          {!dateError && age === null && form.fecha_nacimiento && <div className="muted">Edad: -</div>}
          <button type="submit" disabled={!canSubmit(form, dateError)}>
            Crear
          </button>
        </form>
      </div>
      <div className="card">
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
          <label>
            Indicaciones generales
            <textarea
              name="indicaciones_generales"
              value={consultaForm.indicaciones_generales}
              onChange={onConsultaChange}
            />
          </label>
          <div className="row-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => setMedsOpen((prev) => !prev)}
              aria-expanded={medsOpen}
              aria-controls="meds-section"
            >
              {medsOpen ? "Ocultar medicamentos" : "Mostrar medicamentos"}
            </button>
          </div>
          {medsOpen && (
            <div id="meds-section">
              <div className="list">
                {medicamentos.map((med, index) => (
                  <div key={med.id} className="list-item">
                    <label>
                      Medicamento
                      <input
                        name="nombre"
                        value={med.nombre}
                        onChange={(e) => onMedicamentoChange(index, e)}
                        onFocus={() => {
                          setActiveMedId(med.id);
                          setActiveMedIndex(-1);
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setActiveMedId((current) => (current === med.id ? null : current));
                            setActiveMedIndex(-1);
                          }, 100);
                        }}
                        onKeyDown={(event) => handleMedicationKeyDown(event, index, med)}
                      />
                      {activeMedId === med.id && getMedicationMatches(med.nombre).length > 0 && (
                        <div className="list">
                          {getMedicationMatches(med.nombre).map((option, optionIndex) => (
                            <button
                              type="button"
                              key={option}
                              className="list-item"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                handleMedicationSelect(index, option);
                              }}
                              onMouseEnter={() => setActiveMedIndex(optionIndex)}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}
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
                    <button type="button" onClick={() => removeMedicamento(index)}>
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addMedicamento}>
                Agregar medicamento
              </button>
            </div>
          )}
          <h3>Laboratorios</h3>
          <div className="row-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => setLabsOpen((prev) => !prev)}
              aria-expanded={labsOpen}
              aria-controls="labs-section"
            >
              {labsOpen ? "Ocultar laboratorios" : "Mostrar laboratorios"}
            </button>
          </div>
          {labsOpen && (
            <div id="labs-section">
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
          )}
          <button type="submit" disabled={patientLookupStatus !== "found"}>
            Guardar consulta
          </button>
        </form>
        <button type="button" onClick={loadConsultas}>
          Consultas recientes del paciente
        </button>
        <div className="list">
          {consultas.map((item) => (
            <div key={item.id} className="list-item">
              <div className="list-title">{new Date(item.created_at).toLocaleDateString()}</div>
              {item.diagnosis && <div className="list-meta">{item.diagnosis}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
