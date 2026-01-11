import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

// ✅ Ajusta esto SOLO si tu frontend ya usa otra base URL
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://web-diabetes-production.up.railway.app";

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
      <div className="min-h-screen bg-[#fbf6ef]">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Cargando…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#fbf6ef]">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold">Sesión no iniciada</h1>
            <p className="mt-2 text-sm text-gray-600">
              No se encontró token de paciente. Inicie sesión nuevamente.
            </p>
            <button
              onClick={() => router.push("/portal")}
              className="mt-4 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Ir al portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbf6ef]">
      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* Header */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 font-semibold">
                GL
              </div>
              <div>
                <h1 className="text-base font-semibold text-gray-900">
                  Seguimiento indicado por su médico
                </h1>
                <p className="text-sm text-gray-600">
                  Registre su glucosa cuando su médico se lo solicite.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFormOpen((s) => !s)}
                className={cx(
                  "rounded-xl px-4 py-2 text-sm font-medium transition",
                  formOpen
                    ? "border border-gray-200 bg-white hover:bg-gray-50"
                    : "bg-emerald-700 text-white hover:bg-emerald-800"
                )}
              >
                {formOpen ? "Cerrar formulario" : "Registrar control"}
              </button>

              <button
                onClick={() => router.push("/portal")}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Volver
              </button>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {(error || success) && (
          <div className="mt-4">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                {success}
              </div>
            )}
          </div>
        )}

        {/* Last record summary */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Estado del seguimiento</h2>
          <p className="mt-1 text-sm text-gray-600">
            {records.length === 0
              ? "Aún no tiene registros."
              : "Formulario listo para registrar su control."}
          </p>

          {lastRecord && (
            <div className="mt-4 rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Último registro</p>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {formatDateShort(lastRecord?.date || lastRecord?.fecha || lastRecord?.created_at)} ·{" "}
                {String(lastRecord?.type || lastRecord?.tipo || "—")} ·{" "}
                {String(lastRecord?.value ?? lastRecord?.valor ?? "—")} mg/dL
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        {formOpen && (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">
              Registre su control de glucosa
            </h3>

            <form onSubmit={onSubmit} className="mt-4 space-y-5">
              {/* Tipo control */}
              <div>
                <label className="block text-sm font-medium text-gray-900">
                  Tipo de control
                </label>

                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {[
                    { key: "AYUNO", label: "Ayuno / Antes de comer" },
                    { key: "POSPRANDIAL", label: "2 horas después de comer" },
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
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        )}
                      >
                        <span className="font-medium">{opt.label}</span>
                        <span
                          className={cx(
                            "h-4 w-4 rounded-full border",
                            active ? "border-emerald-700 bg-emerald-700" : "border-gray-300"
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
                  <label className="block text-sm font-medium text-gray-900">
                    Fecha del control
                  </label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900">
                    Valor (mg/dL)
                  </label>
                  <input
                    inputMode="numeric"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="Ej: 120"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              {/* Observación */}
              <div>
                <label className="block text-sm font-medium text-gray-900">
                  Observación adicional <span className="text-gray-400">(opcional)</span>
                </label>
                <textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Ej: Me sentí mareada, comí menos…"
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  Guardar control
                </button>

                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Records list */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-gray-900">Historial de glucosas</h3>
            <button
              onClick={fetchGlucosas}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Actualizar
            </button>
          </div>

          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-gray-500">Cargando registros…</p>
            ) : records.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
                Aún no hay registros. Presione <b>Registrar control</b> para agregar el primero.
              </div>
            ) : (
              <div className="space-y-3">
                {records.map((r, idx) => {
                  const dateText = formatDateShort(r?.date || r?.fecha || r?.created_at);
                  const typeText = String(r?.type || r?.tipo || "—");
                  const valueText = String(r?.value ?? r?.valor ?? "—");

                  return (
                    <div
                      key={r?.id || `${dateText}-${idx}`}
                      className="rounded-xl border border-gray-100 bg-white px-4 py-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {valueText} <span className="text-gray-500 font-medium">mg/dL</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {dateText} · {typeText}
                          </p>
                        </div>

                        {r?.note || r?.observacion || r?.obs ? (
                          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700 md:max-w-[50%]">
                            {String(r?.note || r?.observacion || r?.obs)}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400">Sin observación</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Floating CTA */}
        <button
          onClick={() => {
            setFormOpen(true);
            setTimeout(() => {
              try {
                window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
              } catch {}
            }, 150);
          }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-emerald-800"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white">
            +
          </span>
          Registra tu glucosa
        </button>
      </div>
    </div>
  );
}










