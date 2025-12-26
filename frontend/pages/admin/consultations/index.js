import { useRef, useState } from "react";
import Navigation from "../../../components/Navigation";
import { useAdminGuard } from "../../../hooks/useAdminGuard";
import { adminRequest, getAdminToken } from "../../../lib/adminApi";

const emptyMedication = (seed) => ({
  id: `${Date.now()}-${seed}`,
  drug_name: "",
  dose: "",
  route: "",
  frequency: "",
  duration: "",
  indications: "",
});

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
        dose: med.dose.trim(),
      }))
      .filter((med) => med.drug_name || med.dose);

    if (!cleaned.length) return "Agrega al menos un medicamento";

    for (const med of cleaned) {
      if (!med.drug_name) return "drug_name es obligatorio";
      if (!med.dose) return "dose es obligatorio";
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
          .filter((med) => med.drug_name.trim() || med.dose.trim())
          .map((med, index) => ({
            drug_name: med.drug_name.trim(),
            dose: med.dose.trim(),
            route: med.route || null,
            frequency: med.frequency || null,
            duration: med.duration || null,
            indications: med.indications || null,
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
            {medications.map((med) => (
              <div key={med.id} className="list-item">
                <label>
                  Medicamento
                  <input
                    value={med.drug_name}
                    onChange={(e) => updateMedication(med.id, "drug_name", e.target.value)}
                  />
                </label>
                <label>
                  Dosis
                  <input
                    value={med.dose}
                    onChange={(e) => updateMedication(med.id, "dose", e.target.value)}
                  />
                </label>
                <label>
                  Via
                  <input
                    value={med.route}
                    onChange={(e) => updateMedication(med.id, "route", e.target.value)}
                  />
                </label>
                <label>
                  Frecuencia
                  <input
                    value={med.frequency}
                    onChange={(e) => updateMedication(med.id, "frequency", e.target.value)}
                  />
                </label>
                <label>
                  Duracion
                  <input
                    value={med.duration}
                    onChange={(e) => updateMedication(med.id, "duration", e.target.value)}
                  />
                </label>
                <label>
                  Indicaciones
                  <input
                    value={med.indications}
                    onChange={(e) => updateMedication(med.id, "indications", e.target.value)}
                  />
                </label>
                <button type="button" onClick={() => removeMedication(med.id)}>
                  Eliminar medicamento
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="ghost" onClick={addMedication}>
            Agregar medicamento
          </button>

          <button type="submit" disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </section>
    </div>
  );
}
