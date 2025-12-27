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
            {medications.map((med) => (
              <div key={med.id} className="item-block">
                <div className="form two">
                  <label>
                    Medicamento
                    <input
                      value={med.drug_name}
                      onChange={(e) => updateMedication(med.id, "drug_name", e.target.value)}
                    />
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
