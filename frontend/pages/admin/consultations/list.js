import { useState } from "react";
import Navigation from "../../../components/Navigation";
import { useAdminGuard } from "../../../hooks/useAdminGuard";
import {
  adminRequest,
  adminRequestHtml,
  getAdminToken,
} from "../../../lib/adminApi";

export default function AdminConsultationsList() {
  const { loading } = useAdminGuard();
  const [cedula, setCedula] = useState("");
  const [consultations, setConsultations] = useState([]);
  const [error, setError] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [printError, setPrintError] = useState("");

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

  const onSearch = async (event) => {
    event.preventDefault();
    setError("");
    setPrintError("");
    setConsultations([]);
    if (!cedula.trim()) {
      setError("Cedula requerida");
      return;
    }
    setLoadingList(true);
    try {
      const data = await adminRequest(
        `/admin/consultations?cedula=${encodeURIComponent(cedula.trim())}`,
        { token: getAdminToken() }
      );
      setConsultations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "No se pudo cargar consultas");
    } finally {
      setLoadingList(false);
    }
  };

  const onPrint = async (id) => {
    setPrintError("");
    try {
      const html = await adminRequestHtml(`/admin/consultations/${id}/print`, {
        token: getAdminToken(),
      });
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setPrintError(err.message || "No se pudo imprimir");
    }
  };

  return (
    <div className="page">
      <Navigation
        title="Consultas"
        links={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/consultations", label: "Nueva consulta" },
        ]}
      />
      <section className="panel">
        <h1>Buscar consultas por cedula</h1>
        <form onSubmit={onSearch} className="form">
          <label>
            Cedula
            <input value={cedula} onChange={(e) => setCedula(e.target.value)} />
          </label>
          <button type="submit" disabled={loadingList}>
            {loadingList ? "Buscando..." : "Buscar"}
          </button>
        </form>
        {error && <div className="error">{error}</div>}
        {printError && <div className="error">{printError}</div>}
        <div className="list">
          {consultations.map((item) => (
            <div key={item.id} className="list-item">
              <div>
                <div className="list-title">
                  {new Date(item.created_at).toLocaleDateString()}
                </div>
                {item.diagnosis && <div className="list-meta">{item.diagnosis}</div>}
              </div>
              <div className="row-actions">
                <button type="button" className="button small" onClick={() => onPrint(item.id)}>
                  Imprimir
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
