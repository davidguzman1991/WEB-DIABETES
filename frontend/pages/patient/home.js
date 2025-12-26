import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Navigation from "../../components/Navigation";
import { api } from "../../lib/api";

export default function PatientHome() {
  const router = useRouter();
  const [visit, setVisit] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = api.getToken("patient");
    if (!token) {
      router.replace("/login");
      return;
    }

    api
      .request("/patient/me/current-medication", { token })
      .then(setVisit)
      .catch((err) => setError(err.message));
  }, [router]);

  return (
    <div className="page">
      <Navigation
        title="Paciente"
        links={[
          { href: "/patient/history", label: "Historial" }
        ]}
      />
      <section className="panel">
        <h1>Medicacion actual</h1>
        {error && <div className="error">{error}</div>}
        {!visit && <p className="muted">No hay visitas registradas.</p>}
        {visit && (
          <div className="list">
            {visit.items.map((item) => (
              <div key={item.id} className="list-item">
                <div className="list-title">
                  {item.medicamento_texto || item.medication_nombre || item.medication_id}
                </div>
                <div className="list-meta">
                  {item.dosis} | {item.horario} | {item.via} | {item.duracion}
                </div>
              </div>
            ))}
          </div>
        )}
        <Link className="button" href="/patient/history">
          Ver historial
        </Link>
      </section>
    </div>
  );
}
