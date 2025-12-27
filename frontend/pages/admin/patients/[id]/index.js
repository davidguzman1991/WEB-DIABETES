import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Navigation from "../../../../components/Navigation";
import { api } from "../../../../lib/api";

export default function EditPatient() {
  const router = useRouter();
  const { id } = router.query;
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [consultations, setConsultations] = useState([]);
  const [consultationError, setConsultationError] = useState("");
  const [consultationMessage, setConsultationMessage] = useState("");
  const [labsByConsultation, setLabsByConsultation] = useState({});
  const [latestLabs, setLatestLabs] = useState([]);
  const [labsMessage, setLabsMessage] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    const token = api.getToken("admin");
    if (!token) {
      router.replace("/admin/login");
      return;
    }

    if (!id) return;

    api
      .request(`/admin/patients/${id}`, { token })
      .then((data) => {
        setForm(data);
        return data;
      })
      .then((data) => {
        if (!data?.cedula) return;
        return loadConsultations(data.cedula);
      })
      .catch((err) => setError(err.message));
  }, [id, router]);

  const loadConsultations = async (cedula) => {
    setConsultationError("");
    setConsultationMessage("");
    try {
      const data = await api.request(`/admin/consultations?cedula=${encodeURIComponent(cedula)}`, {
        token: api.getToken("admin")
      });
      setConsultations(Array.isArray(data) ? data : []);
      if (!data?.length) {
        setConsultationMessage("No existen consultas registradas");
        setLabsByConsultation({});
        setLatestLabs([]);
        setLabsMessage("No existen laboratorios registrados");
        return;
      }
      await loadConsultationLabs(Array.isArray(data) ? data : []);
    } catch (err) {
      setConsultations([]);
      setConsultationError(err.message || "No se pudo cargar las consultas");
    }
  };

  const loadConsultationLabs = async (items) => {
    const token = api.getToken("admin");
    const map = {};
    const latestMap = new Map();
    const ordered = [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    await Promise.all(
      ordered.map(async (consulta) => {
        try {
          const labs = await api.request(`/consultas/${consulta.id}/labs`, { token });
          const list = Array.isArray(labs) ? labs : [];
          map[consulta.id] = list;
          list.forEach((lab) => {
            if (!latestMap.has(lab.lab_nombre)) {
              latestMap.set(lab.lab_nombre, { ...lab, consulta_id: consulta.id });
            }
          });
        } catch {
          map[consulta.id] = [];
        }
      })
    );
    setLabsByConsultation(map);
    const important = ["HbA1c", "Glucosa ayunas", "Creatinina", "TFG", "UACR"];
    const latestList = [];
    important.forEach((name) => {
      const item = latestMap.get(name);
      if (item) latestList.push(item);
    });
    setLatestLabs(latestList);
    setLabsMessage(latestList.length ? "" : "No existen laboratorios registrados");
  };

  const onChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await api.request(`/admin/patients/${id}`, {
        method: "PUT",
        token: api.getToken("admin"),
        body: {
          apellidos: form.apellidos,
          nombres: form.nombres,
          fecha_nacimiento: form.fecha_nacimiento,
          email: form.email || null,
          activo: form.activo
        }
      });
      router.push("/admin/patients");
    } catch (err) {
      setError(err.message);
    }
  };

  const onOpenResetModal = () => {
    setResetPassword("");
    setResetError("");
    setResetSuccess("");
    setShowResetModal(true);
  };

  const onCloseResetModal = () => {
    if (resetLoading) return;
    setShowResetModal(false);
  };

  const onResetPassword = async (event) => {
    event.preventDefault();
    setResetError("");
    setResetSuccess("");
    const value = resetPassword.trim();
    if (value.length < 8) {
      setResetError("La nueva contrasena debe tener al menos 8 caracteres");
      return;
    }
    setResetLoading(true);
    try {
      await api.request(`/admin/patients/${id}/reset-password`, {
        method: "POST",
        token: api.getToken("admin"),
        body: { new_password: value }
      });
      setResetSuccess("Contrasena actualizada correctamente");
      setResetPassword("");
    } catch (err) {
      setResetError(err.message || "No se pudo actualizar la contrasena");
    } finally {
      setResetLoading(false);
    }
  };

  if (!form) {
    return (
      <div className="page">
        <Navigation
          title="Editar paciente"
          links={[
            { href: "/admin/patients", label: "Pacientes" }
          ]}
        />
        <section className="panel">
          {error && <div className="error">{error}</div>}
          <p className="muted">Cargando...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <Navigation
        title="Editar paciente"
        links={[
          { href: "/admin/patients", label: "Pacientes" }
        ]}
      />
      <section className="panel">
        <h1>Editar paciente</h1>
        {error && <div className="error">{error}</div>}
        <div className="row-actions">
          <button type="button" className="button" onClick={onOpenResetModal}>
            Resetear contrasena
          </button>
        </div>
        <form onSubmit={onSubmit} className="form two">
          <label>
            Cedula
            <input value={form.cedula} disabled />
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
            <input type="date" name="fecha_nacimiento" value={form.fecha_nacimiento} onChange={onChange} required />
          </label>
          <label>
            Email
            <input type="email" name="email" value={form.email || ""} onChange={onChange} />
          </label>
          <label className="checkbox">
            <input type="checkbox" name="activo" checked={form.activo} onChange={onChange} />
            Activo
          </label>
          <button type="submit">Guardar cambios</button>
        </form>
      </section>
      {showResetModal && (
        <div
          className="page"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50
          }}
        >
          <div className="card" style={{ maxWidth: 480, width: "100%" }}>
            <h2>Resetear contrasena</h2>
            {resetError && <div className="error">{resetError}</div>}
            {resetSuccess && <div className="success">{resetSuccess}</div>}
            <form onSubmit={onResetPassword} className="form">
              <label>
                Nueva contrasena
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </label>
              <div className="row-actions">
                <button type="button" className="ghost" onClick={onCloseResetModal}>
                  Cancelar
                </button>
                <button type="submit" disabled={resetLoading}>
                  {resetLoading ? "Guardando..." : "Confirmar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <section className="panel">
        <h2>Historial de Laboratorios</h2>
        {labsMessage && <div className="muted">{labsMessage}</div>}
        <div className="list">
          {latestLabs.map((lab) => (
            <div key={lab.id} className="list-item">
              <div className="list-title">{lab.lab_nombre}</div>
              <div className="list-meta">
                {lab.valor_num ?? lab.valor_texto}
                {lab.unidad_snapshot ? ` ${lab.unidad_snapshot}` : ""}
              </div>
              {lab.rango_ref_snapshot && (
                <div className="list-meta">Rango: {lab.rango_ref_snapshot}</div>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Consultas</h2>
        {consultationError && <div className="error">{consultationError}</div>}
        {consultationMessage && <div className="muted">{consultationMessage}</div>}
        <div className="list">
          {consultations.map((item) => (
            <div key={item.id} className="list-item">
              <div className="list-title">
                {new Date(item.created_at).toLocaleDateString()}
              </div>
              {item.diagnosis && <div className="list-meta">{item.diagnosis}</div>}
              <div className="list">
                {(labsByConsultation[item.id] || []).map((lab) => (
                  <div key={lab.id} className="list-item">
                    <div className="list-title">{lab.lab_nombre}</div>
                    <div className="list-meta">
                      {lab.valor_num ?? lab.valor_texto}
                      {lab.unidad_snapshot ? ` ${lab.unidad_snapshot}` : ""}
                    </div>
                    {lab.rango_ref_snapshot && (
                      <div className="list-meta">Rango: {lab.rango_ref_snapshot}</div>
                    )}
                  </div>
                ))}
              </div>
              <div className="row-actions">
                <Link className="button small" href={`/admin/patients/${id}/consultations/${item.id}`}>
                  Ver medicamentos
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
