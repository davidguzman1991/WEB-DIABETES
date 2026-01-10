import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Navigation from "../../../components/Navigation";
import { useAdminGuard } from "../../../hooks/useAdminGuard";
import { apiFetch, logout } from "../../../lib/auth";

const MAX_PATIENTS = 50;
const DEFAULT_RANGE_DAYS = 7;

const toDateInputValue = (date) => date.toISOString().slice(0, 10);
const normalizeText = (value) => String(value ?? "").toLowerCase();

const buildPatientName = (patient) => {
  const fullName = [patient.nombres, patient.apellidos].filter(Boolean).join(" ").trim();
  return (
    fullName ||
    patient.nombre ||
    patient.name ||
    patient.username ||
    patient.cedula ||
    "Paciente"
  );
};

const getPatientCedula = (patient) =>
  String(patient.cedula || patient.username || patient.id || "").trim();

const parseConsultationDate = (item) => {
  const raw = item?.created_at || item?.fecha || item?.date || item?.createdAt;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export default function AdminConsultationsList() {
  const { loading } = useAdminGuard();
  const router = useRouter();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [query, setQuery] = useState("");
  const [consultations, setConsultations] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState("");
  const [debugError, setDebugError] = useState(null);
  const isDev = process.env.NODE_ENV === "development";

  const requestJson = async (endpoint) => {
    let res = null;
    try {
      res = await apiFetch(endpoint);
    } catch (err) {
      const networkError = new Error("Error de red / CORS / backend no disponible");
      networkError.endpoint = endpoint;
      networkError.isNetwork = true;
      throw networkError;
    }

    if (res.status === 401 || res.status === 403) {
      logout(router, "/admin/login");
      const authError = new Error("Unauthorized");
      authError.endpoint = endpoint;
      authError.status = res.status;
      authError.authFailure = true;
      throw authError;
    }

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const detail = data?.detail || `Error ${res.status}`;
      const apiError = new Error(detail);
      apiError.endpoint = endpoint;
      apiError.status = res.status;
      apiError.detail = data?.detail || "";
      throw apiError;
    }

    return data;
  };

  const reportError = (message, details) => {
    setError(message);
    if (isDev && details) {
      setDebugError(details);
    } else {
      setDebugError(null);
    }
  };

  const onClear = () => {
    setFromDate("");
    setToDate("");
    setQuery("");
    setConsultations([]);
    setError("");
    setDebugError(null);
  };

  const onSearch = async (event) => {
    event.preventDefault();
    setError("");
    setConsultations([]);
    setDebugError(null);

    const trimmedQuery = query.trim();
    let effectiveFrom = fromDate;
    let effectiveTo = toDate;

    if (!trimmedQuery && !effectiveFrom && !effectiveTo) {
      const today = new Date();
      const toValue = toDateInputValue(today);
      const fromDateObj = new Date(today);
      fromDateObj.setDate(today.getDate() - (DEFAULT_RANGE_DAYS - 1));
      const fromValue = toDateInputValue(fromDateObj);
      setFromDate(fromValue);
      setToDate(toValue);
      effectiveFrom = fromValue;
      effectiveTo = toValue;
    }

    if (effectiveFrom && effectiveTo) {
      const fromValue = new Date(`${effectiveFrom}T00:00:00`);
      const toValue = new Date(`${effectiveTo}T23:59:59`);
      if (fromValue > toValue) {
        setError("Rango de fechas invalido");
        return;
      }
    }

    setLoadingList(true);
    try {
      const data = await requestJson("/admin/patients");
      const patients = Array.isArray(data) ? data : [];
      const queryValue = normalizeText(trimmedQuery);
      const filtered = queryValue
        ? patients.filter((patient) => {
            const name = normalizeText(buildPatientName(patient));
            const cedula = normalizeText(getPatientCedula(patient));
            return name.includes(queryValue) || cedula.includes(queryValue);
          })
        : patients;
      const limitedPatients = filtered.slice(0, MAX_PATIENTS);
      let partialError = false;

      let lastDebug = null;
      const nestedConsultations = await Promise.all(
        limitedPatients.map(async (patient) => {
          const patientCedula = getPatientCedula(patient);
          const patientName = buildPatientName(patient);
          let list = [];
          let endpoint = "";
          try {
            if (patientCedula) {
              endpoint = `/admin/consultations?cedula=${encodeURIComponent(patientCedula)}`;
              list = await requestJson(endpoint);
            } else if (patient?.username || patient?.id) {
              const identifier = patient.username || patient.id;
              endpoint = `/admin/patients/${encodeURIComponent(identifier)}/consultas`;
              list = await requestJson(endpoint);
            }
          } catch (err) {
            console.error("Consultations list error", endpoint, err);
            if (err?.authFailure) throw err;
            partialError = true;
            if (isDev && endpoint) {
              lastDebug = {
                endpoint,
                status: err?.status,
                detail: err?.detail || err?.message || "",
              };
            }
            return [];
          }
          const items = Array.isArray(list) ? list : [];
          return items.map((item) => ({
            ...item,
            _patientName: patientName,
            _patientCedula: patientCedula,
            _dateValue: parseConsultationDate(item),
          }));
        })
      );

      const flattened = nestedConsultations.flat();
      const fromValue = effectiveFrom ? new Date(`${effectiveFrom}T00:00:00`) : null;
      const toValue = effectiveTo ? new Date(`${effectiveTo}T23:59:59`) : null;
      const filteredByDate = flattened.filter((item) => {
        if (!item._dateValue) return false;
        if (fromValue && item._dateValue < fromValue) return false;
        if (toValue && item._dateValue > toValue) return false;
        return true;
      });
      filteredByDate.sort(
        (a, b) => (b._dateValue?.getTime() || 0) - (a._dateValue?.getTime() || 0)
      );
      setConsultations(filteredByDate);
      if (partialError) {
        const partialMessage =
          lastDebug?.detail || "No se pudieron cargar algunas consultas.";
        reportError(partialMessage, lastDebug);
      }
    } catch (err) {
      console.error("Consultations list error", err?.endpoint, err);
      if (err?.authFailure) return;
      const message = err?.isNetwork
        ? "Error de red / CORS / backend no disponible"
        : err?.message || "No se pudieron cargar las consultas.";
      reportError(message, {
        endpoint: err?.endpoint,
        status: err?.status,
        detail: err?.detail || err?.message || "",
      });
    } finally {
      setLoadingList(false);
    }
  };

  const handleOpen = (item) => {
    if (!item) return;
    if (item.id && item._patientCedula) {
      router.push(
        `/admin/patients/${encodeURIComponent(item._patientCedula)}/consultations/${item.id}`
      );
      return;
    }
    if (item._patientCedula) {
      router.push(`/admin/patients/${encodeURIComponent(item._patientCedula)}`);
      return;
    }
    if (item.id) {
      router.push(`/dashboard/consultas/${item.id}`);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <h1>Consultas realizadas</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Navigation
        title="Consultas"
        links={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/consultations", label: "Nueva consulta" },
        ]}
      />
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Consultas realizadas</h1>
              <p className="text-sm text-slate-500">Filtra por fecha y paciente</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/consultations"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
            >
              Nueva consulta
            </Link>
          </div>
          <form onSubmit={onSearch} className="mt-4 grid gap-3 lg:grid-cols-12">
            <label className="flex flex-col gap-1 text-sm text-slate-600 lg:col-span-3">
              Fecha desde
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600 lg:col-span-3">
              Fecha hasta
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600 lg:col-span-4">
              Nombre o cedula
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ej: Maria Perez o 0102030405"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <div className="flex items-end gap-2 lg:col-span-2">
              <button
                type="submit"
                disabled={loadingList}
                className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {loadingList ? "Buscando..." : "Buscar"}
              </button>
              <button
                type="button"
                onClick={onClear}
                className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
              >
                Limpiar
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
              {isDev && debugError && (
                <div className="mt-2 text-xs text-rose-600">
                  {debugError.endpoint && <div>Endpoint: {debugError.endpoint}</div>}
                  {debugError.status && <div>Status: {debugError.status}</div>}
                  {debugError.detail && <div>Detail: {debugError.detail}</div>}
                </div>
              )}
            </div>
          )}

          {loadingList && (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="h-10 rounded bg-slate-200" />
              <div className="h-10 rounded bg-slate-200" />
              <div className="h-10 rounded bg-slate-200" />
            </div>
          )}

          {!loadingList && consultations.length === 0 && !error && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No se encontraron consultas
            </div>
          )}

          {!loadingList && consultations.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-slate-700">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-2">Fecha</th>
                    <th className="py-2">Paciente</th>
                    <th className="py-2">Cedula</th>
                    <th className="py-2">Diagnostico</th>
                    <th className="py-2 text-right">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {consultations.map((item, index) => {
                    const dateLabel = item._dateValue
                      ? item._dateValue.toLocaleDateString()
                      : "-";
                    const diagnosis = item.diagnosis || item.diagnostico || "";
                    const canOpen = Boolean(item.id || item._patientCedula);
                    const rowKey = item.id || `${item._patientCedula}-${index}`;
                    return (
                      <tr key={rowKey} className="hover:bg-slate-50">
                        <td className="py-3 pr-4">{dateLabel}</td>
                        <td className="py-3 pr-4 font-medium text-slate-900">
                          {item._patientName || "Paciente"}
                        </td>
                        <td className="py-3 pr-4">{item._patientCedula || "-"}</td>
                        <td className="py-3 pr-4">
                          {diagnosis ? (
                            <span className="text-slate-600">{diagnosis}</span>
                          ) : (
                            <span className="text-slate-400">Sin diagnostico</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpen(item)}
                            disabled={!canOpen}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Abrir
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
