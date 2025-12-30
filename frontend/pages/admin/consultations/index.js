import { useRef, useState } from "react";
import Navigation from "../../../components/Navigation";
import { useAdminGuard } from "../../../hooks/useAdminGuard";
import { adminRequest, getAdminToken } from "../../../lib/adminApi";

const emptyMedication = (seed) => ({
  id: `${Date.now()}-${seed}`,
  drug_name: "",
  quantity: "",
  description: "",
  duration_days: "",
});

const MEDICATION_CATALOG = [
  "Jardiance Duo 850/12.5 mg",
  "Jardiance Duo 1000/12.5 mg",
  "Jardiance 10 mg",
  "Fanter 10 mg",
  "Glicenex SR 500 mg",
  "Glicenex SR 750 mg",
  "Glicenex SR 1000 mg",
  "Galvus 50 mg",
  "Galvus Met 500 / 50 mg",
  "Galvus Met 850 / 50 mg",
  "Galvus Met 1000 / 50 mg",
  "Trayenta 5 mg",
  "Trayenta Duo 2.5 / 500 mg",
  "Trayenta Duo 2.5 / 850 mg",
  "Trayenta Duo 2.5 / 1000 mg",
  "GenneoS XR 500 / 50 mg",
  "GenneoS XR 850 / 50 mg",
  "GenneoS XR 1000 / 50 mg",
  "GenneoS XR 1000 / 100 mg",
  "Ozempic Dual Dose 2 mg / 1.5 ml",
  "Ozempic Fix Dose 4 mg / 3 ml",
  "Tresiba Flextouch",
  "Apidra Solostar",
  "Humalog KwikPen",
  "Lantus Solostar",
  "Toujeo",
  "Firialta 10 mg",
  "Firialta 20 mg",
  "Indivan 40 mg",
  "Indivan Forte 80 mg",
  "Telsar 40 mg",
  "Telsar AM 80 / 5 mg",
  "Telsar HC 80 / 12.5 mg",
  "Colesta 10 mg",
  "Colesta 20 mg",
  "Rumada 10 / 10",
  "Rumada 20 / 10",
  "Palexis 50 mg",
  "Palexis Retard 50 mg",
  "Palexis Retard 100 mg",
  "Prestat 50 mg",
  "Prestat 75 mg",
  "Prestat 150 mg",
  "Realta 30 mg",
  "Realta 60 mg",
  "Celtium 10 mg",
  "Celtium 20 mg",
  "Gabapentina 300 mg",
  "Analgan Rapid 500 mg",
  "Ibuprofeno 400 mg",
  "Ibuprofeno 600 mg",
  "Dolo Neurobion Forte",
  "Milpax",
  "Endial Digest",
  "Ulcozol Rapid sobres",
  "Ulcozol Rapid cápsulas",
  "Fontactiv Diabest",
  "Nepro BP Vainilla",
  "Nepro AP Vainilla",
  "Vitamina B12 1000 mcg",
  "Urea 10%",
  "Amoxicilina + Ácido clavulánico 875 / 125 mg",
  "Doxiciclina 100 mg",
  "Ceftriaxona 1 g",
  "Piperacilina / Tazobactam 4.5 g",
  "Cloruro de sodio 0.9% 250 ml",
  "Cloruro de sodio 0.9% 500 ml",
  "Cloruro de sodio 0.9% 1000 ml",
  "Eutirox 50 mcg",
  "Eutirox 75 mcg",
  "Eutirox 88 mcg",
  "Eutirox 100 mcg",
  "Eutirox 112 mcg",
  "Eutirox 125 mcg",
  "Tioctan 600 mg"
];

const PRIORITY_MEDICATIONS = [
  "Jardiance Duo 850/12.5 mg",
  "Jardiance 10 mg",
  "Ozempic Dual Dose 2 mg / 1.5 ml",
  "Lantus Solostar",
  "Humalog KwikPen",
  "Telsar 40 mg",
];

const highlightMatch = (text, query) => {
  const safeText = text || "";
  const safeQuery = (query || "").trim();
  if (!safeQuery) return safeText;
  const lowerText = safeText.toLowerCase();
  const lowerQuery = safeQuery.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return safeText;
  const before = safeText.slice(0, index);
  const match = safeText.slice(index, index + safeQuery.length);
  const after = safeText.slice(index + safeQuery.length);
  return (
    <>
      {before}
      <span className="medication-suggestion-highlight">{match}</span>
      {after}
    </>
  );
};

const getMedicationSuggestions = (value) => {
  const query = (value || "").trim().toLowerCase();
  if (query.length < 2) return [];
  const matches = MEDICATION_CATALOG.filter((item) =>
    item.toLowerCase().includes(query)
  );
  if (!matches.length) return [];
  const matchSet = new Set(matches);
  const prioritized = PRIORITY_MEDICATIONS.filter((item) => matchSet.has(item));
  const prioritySet = new Set(prioritized);
  const rest = matches.filter((item) => !prioritySet.has(item));
  return [...prioritized, ...rest].slice(0, 6);
};

export default function AdminConsultations() {
  const { loading } = useAdminGuard();
  const [form, setForm] = useState({
    cedula: "",
    fecha: "",
    diagnosis: "",
    notes: "",
    indications: "",
  });
  const [medications, setMedications] = useState([emptyMedication(0)]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeMedicationId, setActiveMedicationId] = useState(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const idSeed = useRef(0);

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <h1>Consultas</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  const onFormChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const updateMedication = (id, field, value) => {
    setMedications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const selectSuggestion = (id, suggestion) => {
    updateMedication(id, "drug_name", suggestion);
    setActiveSuggestionIndex(-1);
    setActiveMedicationId(null);
  };

  const handleSuggestionMouseDown = (event, id, suggestion) => {
    event.preventDefault();
    selectSuggestion(id, suggestion);
  };

  const handleMedicationKeyDown = (event, id, suggestions) => {
    if (!suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveMedicationId(id);
      setActiveSuggestionIndex((prev) =>
        prev >= suggestions.length - 1 ? 0 : prev + 1
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveMedicationId(id);
      setActiveSuggestionIndex((prev) =>
        prev <= 0 ? suggestions.length - 1 : prev - 1
      );
      return;
    }
    if (event.key === "Enter" && activeMedicationId === id && activeSuggestionIndex >= 0) {
      event.preventDefault();
      selectSuggestion(id, suggestions[activeSuggestionIndex]);
      return;
    }
    if (event.key === "Escape") {
      setActiveMedicationId(null);
      setActiveSuggestionIndex(-1);
    }
  };

  const handleMedicationBlur = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setActiveMedicationId(null);
    setActiveSuggestionIndex(-1);
  };

  const addMedication = () => {
    idSeed.current += 1;
    setMedications((prev) => [...prev, emptyMedication(idSeed.current)]);
  };

  const removeMedication = (id) => {
    setMedications((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
  };

  const validatePayload = () => {
    if (!form.cedula.trim()) return "Cedula requerida";
    const cleaned = medications
      .map((med) => ({
        ...med,
        drug_name: med.drug_name.trim(),
        quantity: String(med.quantity || "").trim(),
        description: (med.description || "").trim(),
        duration_days: String(med.duration_days || "").trim(),
      }))
      .filter((med) => med.drug_name || med.quantity);

    if (!cleaned.length) return "Agrega al menos un medicamento";

    for (const med of cleaned) {
      if (!med.drug_name) return "Medicamento es obligatorio";
      if (!med.quantity) return "Cantidad es obligatoria";
      const quantity = Number(med.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return "Cantidad debe ser un numero entero positivo";
      }
      if (med.duration_days) {
        const duration = Number(med.duration_days);
        if (!Number.isInteger(duration) || duration <= 0) {
          return "Duracion debe ser un numero entero positivo";
        }
      }
    }
    return null;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    const validationError = validatePayload();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        cedula: form.cedula.trim(),
        fecha: form.fecha || null,
        diagnosis: form.diagnosis || null,
        notes: form.notes || null,
        indications: form.indications || null,
        medications: medications
          .filter((med) => med.drug_name.trim() || String(med.quantity || "").trim())
          .map((med, index) => ({
            drug_name: med.drug_name.trim(),
            quantity: Number(med.quantity),
            description: med.description.trim() || null,
            duration_days: med.duration_days ? Number(med.duration_days) : null,
            sort_order: index + 1,
          })),
      };

      await adminRequest("/admin/consultations", {
        method: "POST",
        body: payload,
        token: getAdminToken(),
      });
      setSuccess("Consulta creada");
      setForm({
        cedula: form.cedula,
        fecha: "",
        diagnosis: "",
        notes: "",
        indications: "",
      });
      idSeed.current += 1;
      setMedications([emptyMedication(idSeed.current)]);
    } catch (err) {
      setError(err.message || "Error al crear consulta");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <Navigation
        title="Consultas"
        links={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/consultations/list", label: "Listado" },
        ]}
      />
      <section className="panel">
        <h1>Nueva consulta</h1>
        {error && <div className="error">{error}</div>}
        {success && <div className="muted">{success}</div>}
        <form onSubmit={onSubmit} className="form">
          <label>
            Cedula
            <input name="cedula" value={form.cedula} onChange={onFormChange} required />
          </label>
          <label>
            Fecha
            <input type="date" name="fecha" value={form.fecha} onChange={onFormChange} />
          </label>
          <label>
            Diagnosis
            <textarea name="diagnosis" value={form.diagnosis} onChange={onFormChange} />
          </label>
          <label>
            Notes
            <textarea name="notes" value={form.notes} onChange={onFormChange} />
          </label>
          <label>
            Indications
            <textarea name="indications" value={form.indications} onChange={onFormChange} />
          </label>

          <h2>Medicamentos</h2>
          <div className="list">
            {medications.map((med) => {
              const suggestions = getMedicationSuggestions(med.drug_name);
              const showSuggestions =
                activeMedicationId === med.id && suggestions.length > 0;
              const listId = `medication-suggestions-${med.id}`;
              const highlightQuery = med.drug_name;

              return (
              <div key={med.id} className="item-block">
                <div className="form two">
                  <label>
                    Medicamento
                    <div
                      className="medication-input"
                      onFocus={() => {
                        setActiveMedicationId(med.id);
                        setActiveSuggestionIndex(-1);
                      }}
                      onBlur={handleMedicationBlur}
                    >
                      <input
                        value={med.drug_name}
                        onChange={(e) => {
                          updateMedication(med.id, "drug_name", e.target.value);
                          setActiveMedicationId(med.id);
                          setActiveSuggestionIndex(-1);
                        }}
                        onKeyDown={(e) =>
                          handleMedicationKeyDown(e, med.id, suggestions)
                        }
                        aria-autocomplete="list"
                        aria-expanded={showSuggestions}
                        aria-controls={showSuggestions ? listId : undefined}
                      />
                      {showSuggestions && (
                        <ul className="medication-suggestions" role="listbox" id={listId}>
                          {suggestions.map((item, index) => (
                            <li
                              key={`${med.id}-${item}`}
                              role="option"
                              aria-selected={
                                activeMedicationId === med.id &&
                                activeSuggestionIndex === index
                              }
                            >
                              <button
                                type="button"
                                className={`medication-suggestion${
                                  activeMedicationId === med.id &&
                                  activeSuggestionIndex === index
                                    ? " is-active"
                                    : ""
                                }`}
                                onMouseDown={(event) =>
                                  handleSuggestionMouseDown(event, med.id, item)
                                }
                                onClick={() => selectSuggestion(med.id, item)}
                              >
                                {highlightMatch(item, highlightQuery)}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </label>
                  <label>
                    Cantidad
                    <input
                      type="number"
                      value={med.quantity}
                      onChange={(e) => updateMedication(med.id, "quantity", e.target.value)}
                    />
                  </label>
                  <label>
                    Descripcion
                    <textarea
                      value={med.description}
                      onChange={(e) => updateMedication(med.id, "description", e.target.value)}
                    />
                  </label>
                  <label>
                    Duracion (dias)
                    <input
                      type="number"
                      value={med.duration_days}
                      onChange={(e) => updateMedication(med.id, "duration_days", e.target.value)}
                    />
                  </label>
                </div>
                <div className="row-actions">
                  <button type="button" className="ghost" onClick={() => removeMedication(med.id)}>
                    Eliminar medicamento
                  </button>
                </div>
              </div>
            );
            })}
          </div>
          <button type="button" className="ghost" onClick={addMedication}>
            Agregar medicamento
          </button>

          <button type="submit" disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </section>
      <style jsx>{`
        .medication-input {
          position: relative;
          width: 100%;
        }

        .medication-suggestions {
          position: absolute;
          z-index: 20;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          list-style: none;
          margin: 0;
          padding: 6px;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid #e1dcd2;
          box-shadow: 0 12px 20px rgba(15, 23, 42, 0.12);
          max-height: 220px;
          overflow-y: auto;
        }

        .medication-suggestions li {
          margin: 0;
        }

        .medication-suggestion {
          width: 100%;
          text-align: left;
          border: none;
          background: transparent;
          color: #1f2421;
          padding: 8px 10px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
        }

        .medication-suggestion:hover,
        .medication-suggestion.is-active {
          background: rgba(15, 118, 110, 0.12);
          color: #0b5f59;
        }

        .medication-suggestion-highlight {
          font-weight: 700;
          color: #0f766e;
        }
      `}</style>
    </div>
  );
}
