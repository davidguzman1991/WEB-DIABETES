import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { apiFetch, logout } from "../lib/auth";
import { useAuthGuard } from "../hooks/useAuthGuard";

export default function Portal() {
  const router = useRouter();
  const { user, loading } = useAuthGuard({ redirectTo: "/login" });
  const [current, setCurrent] = useState(null);
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [patientName, setPatientName] = useState("");
  const [planDetail, setPlanDetail] = useState(null);

  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  useEffect(() => {
    if (!user) return;
    if (String(user.role).toLowerCase() !== "patient") {
      logout(router, "/login");
      return;
    }
    setLoadingCurrent(true);
    setMessage("");
    setError("");
    apiFetch("/patient/medication/current")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) {
          setError("No se pudo cargar la informacion");
          return;
        }
        const data = await res.json().catch(() => null);
        if (!data) {
          setCurrent(null);
          setMessage("No existen consultas registradas");
          return;
        }
        setCurrent(data);
        setPlanDetail(null);
      })
      .catch(() => {
        setError("No se pudo cargar la informacion");
      })
      .finally(() => {
        setLoadingCurrent(false);
      });
  }, [router, user]);

  useEffect(() => {
    if (!current?.id) return;
    let active = true;
    apiFetch(`/consultations/${current.id}/print`)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!active || !data) return;
        setPlanDetail(data);
        if (!data.patient) return;
        const fullName = [data.patient.nombres, data.patient.apellidos]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (fullName) {
          setPatientName(fullName);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [current?.id, router]);

  const planConsultation = planDetail?.consultation || current || null;
  const planMedications = planDetail?.medications || current?.medications || [];
  const planLabs = planDetail?.labs || [];

  const formatLabDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (loading || loadingCurrent) {
    return (
      <div className="page">
        <div className="card">
          <h1>Portal</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <h1>Portal</h1>
        <div className="portal-welcome">
          <div className="portal-welcome-line">
            Bienvenido/a{" "}
            <span className="portal-welcome-name">
              {patientName || user?.username || ""}
            </span>
          </div>
          <div className="portal-welcome-subtitle">
            Este es su plan de tratamiento actual basado en su ultima consulta medica.
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        {message && <div className="muted">{message}</div>}
        <div className="section-title">Tratamiento o plan actual</div>
        {current && (
          <div className="consultation-card portal-plan-card">
            <div className="consultation-date">
              Consulta {formatDate(planConsultation?.created_at || current.created_at)}
            </div>
          </div>
        )}
        {current && (
          <>
            <div className="section-title">Medicamentos</div>
            <p className="portal-helper">
              A continuacion se muestran los medicamentos indicados. Puede tocar cada uno para ver los detalles.
            </p>
            <div className="medications-list">
              {!planMedications.length && (
                <div className="muted">No hay medicacion registrada.</div>
              )}
              {planMedications.map((med, index) => {
                const doseValue = med.dose ?? "";
                const quantityValue = med.quantity ?? "";
                const durationValue = med.duration_days ?? "";
                const descriptionValue = med.description ?? med.indications ?? "";
                const notesValue = med.notes ?? "";
                const medKey = `${med.drug_name}-${index}`;
                return (
                  <details key={medKey} className="accordion">
                    <summary className="accordion-title">
                      <span className="medication-name">{med.drug_name}</span>
                    </summary>
                    <div className="accordion-content">
                      {quantityValue !== "" && (
                        <div className="detail-row">
                          <span className="detail-label">Cantidad</span>
                          <span className="detail-value">{quantityValue}</span>
                        </div>
                      )}
                      {doseValue && (
                        <div className="detail-row">
                          <span className="detail-label">Dosis</span>
                          <span className="detail-value">{doseValue}</span>
                        </div>
                      )}
                      {descriptionValue && (
                        <div className="detail-row detail-block">
                          <span className="detail-label">Como tomarlo</span>
                          <span className="detail-value">{descriptionValue}</span>
                        </div>
                      )}
                      {durationValue !== "" && (
                        <div className="detail-row">
                          <span className="detail-label">Duracion</span>
                          <span className="detail-value">{durationValue} dias</span>
                        </div>
                      )}
                      {notesValue && (
                        <div className="detail-row detail-block">
                          <span className="detail-label">Notas</span>
                          <span className="detail-value">{notesValue}</span>
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </>
        )}
        {current && planLabs.length > 0 && (
          <>
            <div className="section-title">Laboratorios</div>
            <div className="medications-list">
              {planLabs.map((lab, index) => {
                const resultValue = lab.valor_num ?? lab.valor_texto ?? "";
                const resultLabel = resultValue !== "" ? resultValue : "Sin resultado";
                const unit = lab.unidad_snapshot ? ` ${lab.unidad_snapshot}` : "";
                const dateValue = lab.fecha || lab.created_at || lab.creado_en || "";
                const formattedDate = formatLabDate(dateValue);
                const commentValue = lab.comentario || "";
                return (
                  <details key={`${lab.lab_nombre}-${index}`} className="accordion">
                    <summary className="accordion-title">
                      <span className="medication-name">{lab.lab_nombre}</span>
                    </summary>
                    <div className="accordion-content">
                      <div className="detail-row">
                        <span className="detail-label">Resultado</span>
                        <span className="detail-value">
                          {resultLabel}
                          {resultValue !== "" ? unit : ""}
                        </span>
                      </div>
                      {formattedDate && (
                        <div className="detail-row">
                          <span className="detail-label">Fecha</span>
                          <span className="detail-value">{formattedDate}</span>
                        </div>
                      )}
                      {commentValue && (
                        <div className="detail-row detail-block">
                          <span className="detail-label">Comentario</span>
                          <span className="detail-value">{commentValue}</span>
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </>
        )}
        <div className="portal-helper portal-disclaimer">
          No modifique ni suspenda su tratamiento sin indicacion medica. Ante dudas o nuevos sintomas, comuniquese con su medico.
        </div>
        <Link className="button" href="/portal/historial">
          Ver historial
        </Link>
        <button type="button" onClick={() => logout(router)}>
          Cerrar sesion
        </button>
      </div>
    </div>
  );
}
