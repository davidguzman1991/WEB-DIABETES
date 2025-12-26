import { useState } from "react";
import Navigation from "../../../components/Navigation";
import { useAdminGuard } from "../../../hooks/useAdminGuard";
import { adminRequest, getAdminToken } from "../../../lib/adminApi";

const emptyForm = {
  cedula: "",
  apellidos: "",
  nombres: "",
  fecha_nacimiento: "",
  email: "",
};

export default function AdminPatients() {
  const { loading } = useAdminGuard();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchCedula, setSearchCedula] = useState("");
  const [currentConsultation, setCurrentConsultation] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <h1>Pacientes</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  const onChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const payload = { ...form, activo: true };
      await adminRequest("/admin/patients", {
        method: "POST",
        body: payload,
        token: getAdminToken(),
      });
      setForm(emptyForm);
      setSuccess("Paciente creado");
    } catch (err) {
      setError(err.message || "Error al crear paciente");
    }
  };

  const onSearch = async (event) => {
    event.preventDefault();
    setSearchError("");
    setCurrentConsultation(null);
    if (!searchCedula.trim()) {
      setSearchError("Cedula requerida");
      return;
    }
    setSearchLoading(true);
    try {
      const data = await adminRequest(
        `/admin/patients/${encodeURIComponent(searchCedula.trim())}/current-medications`,
        { token: getAdminToken() }
      );
      setCurrentConsultation(data);
    } catch (err) {
      setSearchError(err.message || "No se pudo cargar medicacion actual");
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="page">
      <Navigation
        title="Pacientes"
        links={[{ href: "/admin", label: "Dashboard" }]}
      />
      <section className="panel">
        <h1>Crear paciente</h1>
        {error && <div className="error">{error}</div>}
        {success && <div className="muted">{success}</div>}
        <form onSubmit={onSubmit} className="form two">
          <label>
            Cedula
            <input name="cedula" value={form.cedula} onChange={onChange} required />
          </label>
          <label>
            Apellidos
            <input name="apellidos" value={form.apellidos} onChange={onChange} required />
          </label>
          <label>
            Nombres
            <input name="nombres" value={form.nombres} onChange={onChange} required />
          </label>
          <label>
            Fecha nacimiento
            <input
              type="date"
              name="fecha_nacimiento"
              value={form.fecha_nacimiento}
              onChange={onChange}
              required
            />
          </label>
          <label>
            Email
            <input type="email" name="email" value={form.email} onChange={onChange} />
          </label>
          <button type="submit">Guardar</button>
        </form>
      </section>

      <section className="panel">
        <h2>Medicacion actual</h2>
        <form onSubmit={onSearch} className="form">
          <label>
            Cedula
            <input value={searchCedula} onChange={(e) => setSearchCedula(e.target.value)} />
          </label>
          <button type="submit" disabled={searchLoading}>
            {searchLoading ? "Buscando..." : "Buscar"}
          </button>
        </form>
        {searchError && <div className="error">{searchError}</div>}
        {currentConsultation && (
          <div className="list">
            <div className="list-item">
              <div className="list-title">
                {new Date(currentConsultation.created_at).toLocaleDateString()}
              </div>
              {currentConsultation.diagnosis && (
                <div className="list-meta">{currentConsultation.diagnosis}</div>
              )}
            </div>
            <div className="list">
              {currentConsultation.medications.map((med) => (
                <div key={med.id} className="list-item">
                  <div className="list-title">{med.drug_name}</div>
                  <div className="list-meta">
                    {[med.dose, med.frequency, med.route, med.duration]
                      .filter(Boolean)
                      .join(" / ")}
                  </div>
                  {med.indications && <div className="list-meta">{med.indications}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
