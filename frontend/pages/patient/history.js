import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Navigation from "../../components/Navigation";
import { api } from "../../lib/api";

export default function PatientHistory() {
  const router = useRouter();
  const [visits, setVisits] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = api.getToken("patient");
    if (!token) {
      router.replace("/login");
      return;
    }

    api
      .request("/patient/me/visits", { token })
      .then(setVisits)
      .catch((err) => setError(err.message));
  }, [router]);

  return (
    <div className="page">
      <Navigation
        title="Historial"
        links={[
          { href: "/patient/home", label: "Inicio" }
        ]}
      />
      <section className="panel">
        <h1>Consultas</h1>
        {error && <div className="error">{error}</div>}
        {!visits.length && <p className="muted">No hay visitas.</p>}
        <div className="list">
          {visits.map((visit) => (
            <Link key={visit.id} className="list-item" href={`/patient/visit/${visit.id}`}>
              <div className="list-title">{visit.fecha_consulta}</div>
              <div className="list-meta">{visit.diagnostico}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
