import Link from "next/link";
import Navigation from "../../components/Navigation";
import { useAdminGuard } from "../../hooks/useAdminGuard";

export default function AdminDashboard() {
  const { loading } = useAdminGuard();

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <h1>Admin</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Navigation
        title="Admin"
        links={[
          { href: "/admin/patients", label: "Pacientes" },
          { href: "/admin/consultations", label: "Consultas" }
        ]}
      />
      <section className="panel">
        <h1>Dashboard</h1>
        <p className="muted">Seleccione un modulo para comenzar.</p>
        <div className="grid">
          <Link className="tile" href="/admin/patients">Pacientes</Link>
          <Link className="tile" href="/admin/consultations">Nueva consulta</Link>
          <Link className="tile" href="/admin/consultations/list">Consultas por cedula</Link>
        </div>
      </section>
    </div>
  );
}
