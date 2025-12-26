import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Navigation from "../../../../components/Navigation";
import { api } from "../../../../lib/api";

const emptyItem = {
  medication_id: "",
  medication_nombre: "",
  medicamento_texto: "",
  dosis: "",
  horario: "",
  via: "",
  duracion: "",
  instrucciones: ""
};

export default function NewVisit() {
  const router = useRouter();
  const { id } = router.query;
  const [visit, setVisit] = useState({ fecha_consulta: "", diagnostico: "", notas_medico: "" });
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [meds, setMeds] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = api.getToken("admin");
    if (!token) {
      router.replace("/admin/login");
      return;
    }

    api
      .request("/admin/medications", { token })
      .then(setMeds)
      .catch((err) => setError(err.message));
  }, [router]);

  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleCatalogInput = (index, value) => {
    const match = meds.find((med) => med.nombre_generico === value);
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              medication_nombre: value,
              medication_id: match ? match.id : ""
            }
          : item
      )
    );
  };

  const addItem = () => setItems((prev) => [...prev, { ...emptyItem }]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const payload = {
        ...visit,
        items: items.map((item) => ({
          medication_id: item.medication_id || null,
          medicamento_texto: item.medicamento_texto || null,
          dosis: item.dosis,
          horario: item.horario,
          via: item.via,
          duracion: item.duracion,
          instrucciones: item.instrucciones || null
        }))
      };
      await api.request(`/admin/patients/${id}/visits`, {
        method: "POST",
        token: api.getToken("admin"),
        body: payload
      });
      router.push("/admin/patients");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <Navigation
        title="Nueva visita"
        links={[
          { href: "/admin/patients", label: "Pacientes" }
        ]}
      />
      <section className="panel">
        <h1>Crear consulta</h1>
        {error && <div className="error">{error}</div>}
        <form onSubmit={onSubmit} className="form">
          <label>
            Fecha consulta
            <input
              type="date"
              value={visit.fecha_consulta}
              onChange={(e) => setVisit({ ...visit, fecha_consulta: e.target.value })}
              required
            />
          </label>
          <label>
            Diagnostico
            <textarea
              value={visit.diagnostico}
              onChange={(e) => setVisit({ ...visit, diagnostico: e.target.value })}
              required
            />
          </label>
          <label>
            Notas medicas
            <textarea
              value={visit.notas_medico}
              onChange={(e) => setVisit({ ...visit, notas_medico: e.target.value })}
            />
          </label>
          <h2>Medicamentos</h2>
          {items.map((item, index) => (
            <div key={index} className="item-block">
              <label>
                Catalogo (autocompletar)
                <input
                  list={`meds-${index}`}
                  value={item.medication_nombre}
                  onChange={(e) => handleCatalogInput(index, e.target.value)}
                  placeholder="Buscar medicamento"
                />
                <datalist id={`meds-${index}`}>
                  {meds.map((med) => (
                    <option key={med.id} value={med.nombre_generico} />
                  ))}
                </datalist>
              </label>
              <label>
                Medicamento (texto)
                <input
                  value={item.medicamento_texto}
                  onChange={(e) => updateItem(index, "medicamento_texto", e.target.value)}
                />
              </label>
              <label>
                Dosis
                <input value={item.dosis} onChange={(e) => updateItem(index, "dosis", e.target.value)} required />
              </label>
              <label>
                Horario
                <input value={item.horario} onChange={(e) => updateItem(index, "horario", e.target.value)} required />
              </label>
              <label>
                Via
                <input value={item.via} onChange={(e) => updateItem(index, "via", e.target.value)} required />
              </label>
              <label>
                Duracion
                <input value={item.duracion} onChange={(e) => updateItem(index, "duracion", e.target.value)} required />
              </label>
              <label>
                Instrucciones
                <input
                  value={item.instrucciones}
                  onChange={(e) => updateItem(index, "instrucciones", e.target.value)}
                />
              </label>
            </div>
          ))}
          <button type="button" className="ghost" onClick={addItem}>
            Agregar medicamento
          </button>
          <button type="submit">Guardar visita</button>
        </form>
      </section>
    </div>
  );
}
