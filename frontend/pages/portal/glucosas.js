import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { API_URL } from "../../lib/config";


// =============================
// Helpers
// =============================
function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatDateShort(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("es-EC", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return String(value);
  }
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// =============================
// Page
// =============================
export default function GlucosasPage() {
  const router = useRouter();

  const [token, setToken] = useState(null);

  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [records, setRecords] = useState([]);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [tipo, setTipo] = useState("AYUNO");
  const [fecha, setFecha] = useState("");
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");

  // UI
  const lastRecord = useMemo(() => {
    if (!records?.length) return null;
    return records[0];
  }, [records]);
  const lastRecordDate = lastRecord
    ? formatDateShort(lastRecord?.date || lastRecord?.fecha || lastRecord?.created_at)
    : "";
  const lastRecordType = lastRecord ? String(lastRecord?.type || lastRecord?.tipo || "-") : "";
  const lastRecordValue =
    lastRecord && lastRecord?.value !== undefined && lastRecord?.value !== null
      ? String(lastRecord.value)
      : lastRecord?.valor !== undefined && lastRecord?.valor !== null
        ? String(lastRecord.valor)
        : "";
  const recordsCount = Array.isArray(records) ? records.length : 0;

  // =============================
  // Auth bootstrap
  // =============================
  useEffect(() => {
    // Tu portal paciente usa token almacenado
    const t =
      localStorage.getItem("patient_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("access_token");

    if (!t) {
      setAuthLoading(false);
      setToken(null);
      // Puedes redirigir si tu flujo lo necesita:
      // router.push("/portal/login");
      return;
    }
    setToken(t);
    setAuthLoading(false);
  }, [router]);

  // =============================
  // Fetch glucose records
  // =============================
  async function fetchGlucosas() {
    if (!token) return;
    setLoading(true);
    setError("");

    try {
      // ✅ Ajusta este endpoint SOLO si el tuyo difiere
      const res = await fetch(`${API_URL}/patient/glucose`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text();
        const j = safeJsonParse(txt);
        throw new Error(j?.detail || txt || "No se pudo cargar glucosas");
      }

      const data = await res.json();
      // Acepta array directo o {items: []}
      const items = Array.isArray(data) ? data : data?.items || [];
      // Ordenar desc por fecha si existe
      items.sort((a, b) => {
        const da = new Date(a?.date || a?.fecha || a?.created_at || 0).getTime();
        const db = new Date(b?.date || b?.fecha || b?.created_at || 0).getTime();
        return db - da;
      });
      setRecords(items);
    } catch (e) {
      setError(e?.message || "Error cargando glucosas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    fetchGlucosas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // =============================
  // Submit form
  // =============================
  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validaciones mínimas
    if (!fecha) return setError("Seleccione la fecha del control.");
    if (!valor) return setError("Ingrese un valor de glucosa.");
    const valNum = Number(valor);
    if (Number.isNaN(valNum)) return setError("El valor debe ser numérico.");

    try {
      const payload = {
        type: tipo,
        date: fecha,
        value: valNum,
        note: obs || "",
      };

      // ✅ Ajusta este endpoint SOLO si el tuyo difiere
      const res = await fetch(`${API_URL}/patient/glucose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text();
        const j = safeJsonParse(txt);
        throw new Error(j?.detail || txt || "No se pudo guardar el control.");
      }

      setSuccess("Registro actualizado hoy ✅");

      // Reset form
      setTipo("AYUNO");
      setFecha("");
      setValor("");
      setObs("");

      // Close form
      setFormOpen(false);

      // Refresh list
      await fetchGlucosas();
    } catch (e) {
      setError(e?.message || "Error guardando control");
    }
  }

  // =============================
  // UI
  // =============================
  if (authLoading) {
    return (
      <div className="page" style={{ background: "#f8fafc", minHeight: "100vh" }}>
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <section className="portal-medical-card">
            <div className="portal-medical-empty-state">
              <div className="portal-medical-empty-state-icon">...</div>
              <p className="portal-medical-empty-state-text">Cargando...</p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="page" style={{ background: "#f8fafc", minHeight: "100vh" }}>
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <section className="portal-medical-card">
            <div className="portal-medical-card-header">
              <div className="portal-medical-card-title-section">
                <div className="portal-medical-card-icon glucose">GL</div>
                <div className="portal-medical-card-title-group">
                  <h1 className="portal-medical-card-title">Sesion no iniciada</h1>
                  <p className="portal-medical-card-subtitle">
                    No se encontro token de paciente. Inicie sesion nuevamente.
                  </p>
                </div>
              </div>
            </div>
            <div className="portal-medical-card-content">
              <button
                type="button"
                onClick={() => router.push("/portal")}
                className="portal-medical-button portal-medical-button-primary"
              >
                Ir al portal
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="portal-medical-header">
          <h1>Control de glucosa</h1>
          <p className="portal-medical-header-subtitle">
            Seguimiento de glucosa indicado por su medico.
          </p>
          <div className="portal-medical-header-info">
            <div className="portal-medical-header-info-item">
              <span className="portal-medical-header-info-label">Ultimo registro</span>
              <span className="portal-medical-header-info-value">
                {lastRecordDate || "Sin registros"}
              </span>
            </div>
            <div className="portal-medical-header-info-item">
              <span className="portal-medical-header-info-label">Registros</span>
              <span className="portal-medical-header-info-value">{recordsCount}</span>
            </div>
          </div>
          <div className="portal-medical-header-actions">
            <button
              type="button"
              onClick={() => setFormOpen((s) => !s)}
              className={cx(
                "portal-medical-button portal-medical-button-small",
                formOpen
                  ? "portal-medical-button-secondary"
                  : "portal-medical-button-primary"
              )}
            >
              {formOpen ? "Cerrar formulario" : "Registrar control"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/portal")}
              className="portal-medical-button portal-medical-button-secondary portal-medical-button-small"
            >
              Volver al portal
            </button>
          </div>
        </header>

        {/* Alerts */}
        {(error || success) && (
          <section className="portal-medical-card">
            <div className="portal-medical-card-content">
              {error && (
                <div className="portal-medical-alert portal-medical-alert-error">
                  {error}
                </div>
              )}
              {success && (
                <div className="portal-medical-alert portal-medical-alert-success">
                  {success}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Last record summary */}
        <section className="portal-medical-card">
          <div className="portal-medical-card-header">
            <div className="portal-medical-card-title-section">
              <div className="portal-medical-card-icon glucose">GL</div>
              <div className="portal-medical-card-title-group">
                <h2 className="portal-medical-card-title">Estado del seguimiento</h2>
                <p className="portal-medical-card-subtitle">
                  Revise su ultimo control y el estado del registro.
                </p>
              </div>
            </div>
          </div>
          <div className="portal-medical-card-content">
            <div className="portal-medical-summary">
              <div className="portal-medical-summary-row">
                <span className="portal-medical-summary-label">Estado</span>
                <span className="portal-medical-summary-value">
                  {recordsCount === 0
                    ? "Sin registros"
                    : "Formulario listo para registrar su control"}
                </span>
              </div>
              <div className="portal-medical-summary-row">
                <span className="portal-medical-summary-label">Ultimo registro</span>
                <span className="portal-medical-summary-value">
                  {lastRecord
                    ? `${lastRecordDate || "Sin fecha"} - ${
                        lastRecordType || "Sin tipo"
                      } - ${lastRecordValue || "-"} mg/dL`
                    : "Sin registros"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Form */}
        {formOpen && (
          <section className="portal-medical-card">
            <div className="portal-medical-card-header">
              <div className="portal-medical-card-title-section">
                <div className="portal-medical-card-icon glucose">GL</div>
                <div className="portal-medical-card-title-group">
                  <h3 className="portal-medical-card-title">Registrar control de glucosa</h3>
                  <p className="portal-medical-card-subtitle">
                    Ingrese el control solicitado por su medico.
                  </p>
                </div>
              </div>
            </div>
            <div className="portal-medical-card-content">
              <form onSubmit={onSubmit} className="space-y-5">
              {/* Tipo control */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Tipo de control
                </label>

                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {[
                    { key: "AYUNO", label: "Ayuno / Antes de comer" },
                    { key: "POSPRANDIAL", label: "2 horas despues de comer" },
                  ].map((opt) => {
                    const active = tipo === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setTipo(opt.key)}
                        className={cx(
                          "flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition",
                          active
                            ? "border-teal-200 bg-teal-50 text-teal-900"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        )}
                      >
                        <span className="font-medium">{opt.label}</span>
                        <span
                          className={cx(
                            "h-4 w-4 rounded-full border",
                            active ? "border-teal-600 bg-teal-600" : "border-slate-300"
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fecha + valor */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Fecha del control
                  </label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Valor (mg/dL)
                  </label>
                  <input
                    inputMode="numeric"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="Ej: 120"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                  />
                </div>
              </div>

              {/* Observación */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Observacion adicional <span className="text-slate-400">(opcional)</span>
                </label>
                <textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Ej: Me senti mareada, comi menos."
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <button
                  type="submit"
                  className="portal-medical-button portal-medical-button-primary"
                >
                  Guardar control
                </button>

                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="portal-medical-button portal-medical-button-secondary"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </section>
        )}

        {/* Records list */}
        <section className="portal-medical-card">
          <div className="portal-medical-card-header">
            <div className="portal-medical-card-title-section">
              <div className="portal-medical-card-icon glucose">GL</div>
              <div className="portal-medical-card-title-group">
                <h3 className="portal-medical-card-title">Historial de glucosas</h3>
                <p className="portal-medical-card-subtitle">
                  Revise sus registros recientes de glucosa.
                </p>
              </div>
            </div>
            <div className="portal-medical-card-actions">
              <button
                type="button"
                onClick={fetchGlucosas}
                className="portal-medical-button portal-medical-button-secondary portal-medical-button-small"
              >
                Actualizar
              </button>
            </div>
          </div>

          <div className="portal-medical-card-content">
            {loading ? (
              <div className="portal-medical-empty-state">
                <div className="portal-medical-empty-state-icon">...</div>
                <p className="portal-medical-empty-state-text">Cargando registros...</p>
              </div>
            ) : recordsCount === 0 ? (
              <div className="portal-medical-empty-state">
                <div className="portal-medical-empty-state-icon">GL</div>
                <p className="portal-medical-empty-state-text">
                  Sin registros. Use "Registrar control" para agregar el primero.
                </p>
              </div>
            ) : (
              <div className="portal-medical-record-list">
                {records.map((r, idx) => {
                  const dateText = formatDateShort(r?.date || r?.fecha || r?.created_at);
                  const typeText = String(r?.type || r?.tipo || "-");
                  const valueText = String(r?.value ?? r?.valor ?? "-");
                  const noteText = r?.note || r?.observacion || r?.obs || "";

                  return (
                    <div
                      key={r?.id || `${dateText}-${idx}`}
                      className="portal-medical-record-item"
                    >
                      <div>
                        <div className="portal-medical-record-value">
                          {valueText} <span className="portal-medical-record-unit">mg/dL</span>
                        </div>
                        <div className="portal-medical-record-meta">
                          {dateText} - {typeText}
                        </div>
                      </div>

                      <div className="portal-medical-record-note">
                        {noteText ? String(noteText) : "Sin observacion"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Floating CTA */}
        <button
          type="button"
          onClick={() => {
            setFormOpen(true);
            setTimeout(() => {
              try {
                window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
              } catch {}
            }, 150);
          }}
          className="portal-medical-fab"
        >
          <span className="portal-medical-fab-icon">+</span>
          Registrar glucosa
        </button>
      </div>
    </div>
  );
}
