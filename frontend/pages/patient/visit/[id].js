import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Navigation from "../../../components/Navigation";
import { api } from "../../../lib/api";

export default function PatientVisit() {
  const router = useRouter();
  const { id } = router.query;
  const [visit, setVisit] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = api.getToken("patient");
    if (!token) {
      router.replace("/login");
      return;
    }

    if (!id) return;

    api
      .request(`/patient/me/visits/${id}`, { token })
      .then(setVisit)
      .catch((err) => setError(err.message));
  }, [id, router]);

  return (
    <div className="page">
      <Navigation
        title="Detalle consulta"
        links={[
          { href: "/patient/history", label: "Historial" }
        ]}
      />
      <section className="panel printable">
        {error && <div className="error">{error}</div>}
        {!visit && <p className="muted">Cargando...</p>}
        {visit && (
          <>
            <div className="visit-header">
              <div>
                <h1>{visit.fecha_consulta}</h1>
                <p className="muted">{visit.diagnostico}</p>
              </div>
              <button className="ghost" onClick={() => window.print()}>
                Imprimir
              </button>
            </div>
            <div className="list">
              {visit.items.map((item) => (
                <div key={item.id} className="list-item">
                  <div className="list-title">
                    {item.medicamento_texto || item.medication_nombre || item.medication_id}
                  </div>
                  <div className="list-meta">
                    {item.dosis} | {item.horario} | {item.via} | {item.duracion}
                  </div>
                  {item.instrucciones && (
                    <div className="list-meta">{item.instrucciones}</div>
                  )}
                </div>
              ))}
            </div>
            {visit.notas_medico && (
              <div className="note">
                <h3>Notas medicas</h3>
                <p>{visit.notas_medico}</p>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
