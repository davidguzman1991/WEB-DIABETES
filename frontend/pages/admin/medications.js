import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Navigation from "../../components/Navigation";
import { api } from "../../lib/api";

const emptyForm = {
  nombre_generico: "",
  presentacion: "",
  forma: ""
};

export default function AdminMedications() {
  const router = useRouter();
  const [meds, setMeds] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  const load = async () => {
    const token = api.getToken("admin");
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    try {
      const data = await api.request("/admin/medications", { token });
      setMeds(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await api.request("/admin/medications", {
        method: "POST",
        token: api.getToken("admin"),
        body: { ...form, activo: true }
      });
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <Navigation
        title="Medicamentos"
        links={[
          { href: "/admin", label: "Dashboard" }
        ]}
      />
      <section className="panel">
        <h1>Catalogo</h1>
        {error && <div className="error">{error}</div>}
        <div className="list">
          {meds.map((med) => (
            <div key={med.id} className="list-item">
              <div className="list-title">{med.nombre_generico}</div>
              <div className="list-meta">{med.presentacion || "-"} | {med.forma || "-"}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Agregar medicamento</h2>
        <form onSubmit={onSubmit} className="form two">
          <label>
            Nombre generico
            <input name="nombre_generico" value={form.nombre_generico} onChange={onChange} required />
          </label>
          <label>
            Presentacion
            <input name="presentacion" value={form.presentacion} onChange={onChange} />
          </label>
          <label>
            Forma
            <input name="forma" value={form.forma} onChange={onChange} />
          </label>
          <button type="submit">Guardar</button>
        </form>
      </section>
    </div>
  );
}
