import { memo, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import Navigation from "../../../../../components/Navigation";
import { api } from "../../../../../lib/api";

const emptyMedication = {
  drug_name: "",
  dose: "",
  route: "",
  frequency: "",
  duration: "",
  indications: "",
  sort_order: ""
};

const MedicationRow = memo(function MedicationRow({ item, onSave, onDelete }) {
  const [form, setForm] = useState({ ...item });

  useEffect(() => {
    setForm({ ...item });
  }, [item]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="list-item">
      <label>
        Medicamento
        <input name="drug_name" value={form.drug_name || ""} onChange={onChange} />
      </label>
      <label>
        Dosis
        <input name="dose" value={form.dose || ""} onChange={onChange} />
      </label>
      <label>
        Via
        <input name="route" value={form.route || ""} onChange={onChange} />
      </label>
      <label>
        Frecuencia
        <input name="frequency" value={form.frequency || ""} onChange={onChange} />
      </label>
      <label>
        Duracion
        <input name="duration" value={form.duration || ""} onChange={onChange} />
      </label>
      <label>
        Indicaciones
        <input name="indications" value={form.indications || ""} onChange={onChange} />
      </label>
      <label>
        Orden
        <input
          type="number"
          name="sort_order"
          value={form.sort_order ?? ""}
          onChange={onChange}
        />
      </label>
      <div className="row-actions">
        <button type="button" className="button small" onClick={() => onSave(item, form)}>
          Guardar
        </button>
        <button type="button" className="button small ghost" onClick={() => onDelete(item)}>
          Eliminar
        </button>
      </div>
    </div>
  );
});

export default function ConsultationMedications() {
  const router = useRouter();
  const { id, consultationId } = router.query;
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const tempIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!id || !consultationId) return;
    setError("");
    setMessage("");
    try {
      const data = await api.request(
        `/patients/${id}/consultations/${consultationId}/medications`,
        { token: api.getToken("admin") }
      );
      setItems(Array.isArray(data) ? data : []);
      if (!data?.length) {
        setMessage("No existen medicamentos registrados");
      }
    } catch (err) {
      setError(err.message || "No se pudo cargar la informacion");
    }
  }, [consultationId, id]);

  useEffect(() => {
    const token = api.getToken("admin");
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    load();
  }, [load, router]);

  const addRow = () => {
    tempIdRef.current += 1;
    setItems((prev) => [
      ...prev,
      { ...emptyMedication, temp_id: `temp-${tempIdRef.current}` }
    ]);
  };

  const handleSave = useCallback(async (item, form) => {
    setError("");
    setMessage("");
    const drugName = (form.drug_name || "").trim();
    if (!drugName) {
      setError("Medicamento requerido");
      return;
    }
    const sortOrder =
      form.sort_order === "" || form.sort_order === null || form.sort_order === undefined
        ? null
        : Number(form.sort_order);
    const payload = {
      drug_name: drugName,
      dose: form.dose || null,
      route: form.route || null,
      frequency: form.frequency || null,
      duration: form.duration || null,
      indications: form.indications || null,
      sort_order: Number.isNaN(sortOrder) ? null : sortOrder
    };

    try {
      if (item.id) {
        const updated = await api.request(`/medications/${item.id}`, {
          method: "PUT",
          token: api.getToken("admin"),
          body: payload
        });
        setItems((prev) => prev.map((row) => (row.id === item.id ? updated : row)));
        setMessage("Medicamento actualizado");
        return;
      }

      const created = await api.request(
        `/patients/${id}/consultations/${consultationId}/medications`,
        {
          method: "POST",
          token: api.getToken("admin"),
          body: payload
        }
      );
      const first = Array.isArray(created) ? created[0] : created;
      setItems((prev) =>
        prev.map((row) => (row.temp_id === item.temp_id ? first : row))
      );
      setMessage("Medicamento creado");
    } catch (err) {
      setError(err.message || "No se pudo guardar el medicamento");
    }
  }, [consultationId, id]);

  const handleDelete = useCallback(async (item) => {
    setError("");
    setMessage("");
    if (!item.id) {
      setItems((prev) => prev.filter((row) => row.temp_id !== item.temp_id));
      return;
    }
    try {
      await api.request(`/medications/${item.id}`, {
        method: "DELETE",
        token: api.getToken("admin")
      });
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      setMessage("Medicamento eliminado");
    } catch (err) {
      setError(err.message || "No se pudo eliminar el medicamento");
    }
  }, []);

  return (
    <div className="page">
      <Navigation
        title="Medicamentos"
        links={[
          { href: "/admin/patients", label: "Pacientes" },
          { href: `/admin/patients/${id}`, label: "Ficha" }
        ]}
      />
      <section className="panel">
        <h1>Medicamentos de consulta</h1>
        {error && <div className="error">{error}</div>}
        {message && <div className="muted">{message}</div>}
        <div className="list">
          {items.map((item) => (
            <MedicationRow
              key={item.id || item.temp_id}
              item={item}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          ))}
        </div>
        <button type="button" className="ghost" onClick={addRow}>
          Agregar medicamento
        </button>
        <Link className="button" href={`/admin/patients/${id}`}>
          Volver
        </Link>
      </section>
    </div>
  );
}
