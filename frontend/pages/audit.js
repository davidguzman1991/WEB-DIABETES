import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { apiFetch, logout } from "../lib/auth";
import { useAuthGuard } from "../hooks/useAuthGuard";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

const formatDateInput = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getToday = () => formatDateInput(new Date());

const getDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDateInput(date);
};

const getMonthStart = () => {
  const date = new Date();
  date.setDate(1);
  return formatDateInput(date);
};

const getYearStart = () => {
  const date = new Date();
  date.setMonth(0, 1);
  return formatDateInput(date);
};

export default function AuditMedications() {
  const router = useRouter();
  const { user, loading } = useAuthGuard();
  const [fromDate, setFromDate] = useState(() => getDaysAgo(30));
  const [toDate, setToDate] = useState(() => getToday());
  const [limit, setLimit] = useState(20);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const maxCount = useMemo(() => {
    return items.reduce((maxValue, item) => {
      const count = Number(item?.count) || 0;
      return count > maxValue ? count : maxValue;
    }, 0);
  }, [items]);

  const fetchTopMedications = async (range = {}) => {
    if (!user) return;
    const rangeFrom = range.from || fromDate;
    const rangeTo = range.to || toDate;
    if (!rangeFrom || !rangeTo) return;
    setStatus("loading");
    setError("");
    try {
      const res = await apiFetch(
        `/admin/audit/medications/top?from=${encodeURIComponent(
          rangeFrom
        )}&to=${encodeURIComponent(rangeTo)}&limit=${limit}`
      );
      if (res.status === 401 || res.status === 403) {
        logout(router, "/login?type=admin");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "No se pudo cargar la auditoría");
        setItems([]);
        setStatus("error");
        return;
      }
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data.items) ? data.items : [];
      setItems(list);
      setStatus("ready");
    } catch {
      setError("No se pudo cargar la auditoría");
      setItems([]);
      setStatus("error");
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchTopMedications();
  }, [user]);

  const applyQuickRange = (nextFrom, nextTo) => {
    setFromDate(nextFrom);
    setToDate(nextTo);
    fetchTopMedications({ from: nextFrom, to: nextTo });
  };

  if (loading) {
    return (
      <div className="page admin-page">
        <div className="card">
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page admin-page">
        <div className="card">
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page admin-page">
      <div className="card admin-shell space-y-4">
        <header className="admin-header flex flex-col gap-3 md:flex-row md:items-center md:justify-between !bg-white !border-slate-200/70 !shadow-sm !rounded-2xl">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-slate-900">
              Auditoría de medicamentos
            </h1>
            <p className="muted text-sm">Mostrando los más prescritos</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard")}
          >
            Volver al dashboard
          </Button>
        </header>

        <Card className="p-4 md:p-6">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => applyQuickRange(getDaysAgo(30), getToday())}
            >
              Últimos 30 días
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => applyQuickRange(getMonthStart(), getToday())}
            >
              Mes actual
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => applyQuickRange(getYearStart(), getToday())}
            >
              Año actual
            </Button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Desde
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/60"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Hasta
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/60"
              />
            </label>
            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={() => fetchTopMedications()}
              >
                Buscar
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-4 md:p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Top medicamentos
          </h2>
          {status === "loading" && <p className="muted mt-2">Cargando...</p>}
          {status === "error" && (
            <div className="error border border-red-200 text-sm">{error}</div>
          )}
          {status === "ready" && !items.length && (
            <p className="muted mt-2">Sin datos para el rango seleccionado.</p>
          )}
          {status === "ready" && items.length > 0 && (
            <div className="mt-3 space-y-4">
              <div className="space-y-2">
                {items.slice(0, 10).map((item) => {
                  const count = Number(item?.count) || 0;
                  const width = maxCount ? `${(count / maxCount) * 100}%` : "0%";
                  return (
                    <div key={item.nombre} className="space-y-1">
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span>{item.nombre}</span>
                        <span>{count}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-slate-800"
                          style={{ width }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="py-2">Medicamento</th>
                      <th className="py-2 text-right">Veces</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={`${item.nombre}-${item.count}`} className="border-t">
                        <td className="py-2 text-slate-700">{item.nombre}</td>
                        <td className="py-2 text-right text-slate-700">
                          {item.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
