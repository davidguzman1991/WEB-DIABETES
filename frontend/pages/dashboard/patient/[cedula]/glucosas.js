import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import { apiFetch, logout } from "../../../../lib/auth";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";

const FILTERS = [
  { key: "7", label: "Ultimos 7 dias", days: 7 },
  { key: "30", label: "Ultimos 30 dias", days: 30 },
  { key: "90", label: "Ultimos 90 dias", days: 90 },
  { key: "all", label: "Todos", days: null },
];

const CHART_WIDTH = 720;
const CHART_HEIGHT = 280;
const CHART_PADDING = { top: 18, right: 20, bottom: 58, left: 52 };
const NORMAL_MIN = 70;
const NORMAL_MAX = 180;
const ELEVATED_MAX = 240;

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

const formatShortDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit" });
};

const formatType = (value) => {
  if (value === "postprandial") return "Post";
  if (value === "ayuno") return "Ayuno";
  return "Sin tipo";
};

export default function PatientGlucoseHistory() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthGuard({ redirectTo: "/login?type=admin" });
  const [patient, setPatient] = useState(null);
  const [patientLoading, setPatientLoading] = useState(false);
  const [glucoseLogs, setGlucoseLogs] = useState([]);
  const [glucoseLoading, setGlucoseLoading] = useState(false);
  const [glucoseMessage, setGlucoseMessage] = useState("");
  const [error, setError] = useState("");
  const [rangeKey, setRangeKey] = useState("30");

  const cedulaParam = Array.isArray(router.query.cedula)
    ? router.query.cedula[0]
    : router.query.cedula;
  const cedula = typeof cedulaParam === "string" ? cedulaParam.trim() : "";

  useEffect(() => {
    if (!user || !cedula) return;
    if (String(user.role || "").toLowerCase() !== "admin") {
      logout(router, "/login?type=admin");
      return;
    }
    let active = true;
    setPatientLoading(true);
    setError("");
    apiFetch(`/admin/patients?cedula=${encodeURIComponent(cedula)}`)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login?type=admin");
          return;
        }
        if (res.status === 404) {
          if (active) {
            setPatient(null);
            setGlucoseLogs([]);
            setGlucoseMessage("");
            setError("Paciente no existe");
          }
          return;
        }
        if (!res.ok) {
          if (active) {
            setPatient(null);
            setError("No se pudo cargar el paciente");
          }
          return;
        }
        const data = await res.json().catch(() => null);
        if (active) setPatient(data);
      })
      .catch(() => {
        if (active) {
          setPatient(null);
          setError("No se pudo cargar el paciente");
        }
      })
      .finally(() => {
        if (active) setPatientLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cedula, router, user]);

  useEffect(() => {
    if (!patient?.id) return;
    let active = true;
    setGlucoseLoading(true);
    setGlucoseMessage("");
    setError("");
    apiFetch(`/glucoses/patient/${patient.id}`)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login?type=admin");
          return;
        }
        if (res.status === 404) {
          if (active) {
            setGlucoseLogs([]);
            setGlucoseMessage("Paciente sin registros de glucosa");
          }
          return;
        }
        if (!res.ok) {
          if (active) setError("No se pudo cargar el historial de glucosas");
          return;
        }
        const data = await res.json().catch(() => []);
        if (active) {
          const list = Array.isArray(data) ? data : [];
          setGlucoseLogs(list);
          if (!list.length) {
            setGlucoseMessage("Paciente sin registros de glucosa");
          }
        }
      })
      .catch(() => {
        if (active) setError("No se pudo cargar el historial de glucosas");
      })
      .finally(() => {
        if (active) setGlucoseLoading(false);
      });

    return () => {
      active = false;
    };
  }, [patient?.id, router]);

  const orderedLogs = useMemo(() => {
    const list = Array.isArray(glucoseLogs) ? glucoseLogs : [];
    return list.slice().sort((a, b) => {
      const aTime = new Date(a?.taken_at || a?.created_at || 0).getTime();
      const bTime = new Date(b?.taken_at || b?.created_at || 0).getTime();
      return bTime - aTime;
    });
  }, [glucoseLogs]);

  const activeFilter = FILTERS.find((item) => item.key === rangeKey) || FILTERS[1];

  const filteredLogs = useMemo(() => {
    if (!Array.isArray(orderedLogs)) return [];
    if (!activeFilter.days) return orderedLogs;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - activeFilter.days);
    const cutoffTime = cutoff.getTime();
    return orderedLogs.filter((log) => {
      const time = new Date(log?.taken_at || log?.created_at || 0).getTime();
      return Number.isFinite(time) && time >= cutoffTime;
    });
  }, [activeFilter.days, orderedLogs]);

  const chartData = useMemo(() => {
    const points = filteredLogs
      .slice()
      .reverse()
      .map((log) => {
        const value = Number(log?.value);
        const dateValue = log?.taken_at || log?.created_at;
        const date = new Date(dateValue || 0);
        if (!Number.isFinite(value) || Number.isNaN(date.getTime())) return null;
        return {
          value,
          label: `${formatShortDate(dateValue)} - ${formatType(log?.type)}`,
        };
      })
      .filter(Boolean);
    if (points.length < 2) return null;
    const values = points.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const chartMin = Math.min(minValue, NORMAL_MIN - 10);
    const chartMax = Math.max(maxValue, ELEVATED_MAX + 20);
    const range = Math.max(chartMax - chartMin, 1);
    const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
    const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
    const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0;
    const valueToY = (value) => {
      const normalized = (value - chartMin) / range;
      return CHART_HEIGHT - CHART_PADDING.bottom - normalized * plotHeight;
    };
    const path = points
      .map((point, index) => {
        const x = CHART_PADDING.left + index * xStep;
        const y = valueToY(point.value);
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
    return { points, chartMin, chartMax, range, plotWidth, plotHeight, xStep, path, valueToY };
  }, [filteredLogs]);

  const yTicks = chartData
    ? Array.from({ length: 5 }, (_, index) =>
        Math.round(chartData.chartMin + (chartData.range * index) / 4)
      )
    : [];

  if (authLoading) {
    return (
      <div className="page">
        <div className="card">
          <h1>Historial de glucosas</h1>
          <p className="muted">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <div className="history-header">
          <div>
            <h1>Historial de glucosas</h1>
            <div className="muted">
              {patient?.nombres || patient?.apellidos
                ? `${patient?.nombres || ""} ${patient?.apellidos || ""}`.trim()
                : "Paciente"}
              {cedula ? ` | Cedula ${cedula}` : ""}
            </div>
          </div>
          <Link className="button button-secondary" href="/dashboard">
            Volver
          </Link>
        </div>

        {patientLoading && <div className="muted">Cargando paciente...</div>}
        {error && <div className="error">{error}</div>}
        {!error && glucoseMessage && <div className="muted">{glucoseMessage}</div>}

        <div className="filter-row">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`filter-button${rangeKey === filter.key ? " is-active" : ""}`}
              onClick={() => setRangeKey(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <div className="section-title">Tendencia de glucosa</div>
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-swatch target" />
                Rango objetivo
              </span>
              <span className="legend-item">
                <span className="legend-swatch elevated" />
                Elevado
              </span>
              <span className="legend-item">
                <span className="legend-swatch high" />
                Alto
              </span>
            </div>
          </div>
          {chartData ? (
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              width="100%"
              height={CHART_HEIGHT}
              role="img"
              aria-label="Tendencia de glucosa"
            >
              <rect
                x={CHART_PADDING.left}
                y={chartData.valueToY(NORMAL_MAX)}
                width={chartData.plotWidth}
                height={chartData.valueToY(NORMAL_MIN) - chartData.valueToY(NORMAL_MAX)}
                fill="#dcfce7"
              />
              <rect
                x={CHART_PADDING.left}
                y={chartData.valueToY(ELEVATED_MAX)}
                width={chartData.plotWidth}
                height={chartData.valueToY(NORMAL_MAX) - chartData.valueToY(ELEVATED_MAX)}
                fill="#fef3c7"
              />
              <rect
                x={CHART_PADDING.left}
                y={chartData.valueToY(chartData.chartMax)}
                width={chartData.plotWidth}
                height={chartData.valueToY(ELEVATED_MAX) - chartData.valueToY(chartData.chartMax)}
                fill="#fee2e2"
              />

              <line
                x1={CHART_PADDING.left}
                y1={CHART_PADDING.top}
                x2={CHART_PADDING.left}
                y2={CHART_HEIGHT - CHART_PADDING.bottom}
                stroke="#cbd5f5"
                strokeWidth="1"
              />
              <line
                x1={CHART_PADDING.left}
                y1={CHART_HEIGHT - CHART_PADDING.bottom}
                x2={CHART_WIDTH - CHART_PADDING.right}
                y2={CHART_HEIGHT - CHART_PADDING.bottom}
                stroke="#cbd5f5"
                strokeWidth="1"
              />

              {yTicks.map((tick) => {
                const y = chartData.valueToY(tick);
                return (
                  <g key={`tick-${tick}`}>
                    <line
                      x1={CHART_PADDING.left}
                      y1={y}
                      x2={CHART_WIDTH - CHART_PADDING.right}
                      y2={y}
                      stroke="#e5e7eb"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={CHART_PADDING.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="10"
                      fill="#6b7280"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              <path d={chartData.path} fill="none" stroke="#1e3a5f" strokeWidth="2" />

              {chartData.points.map((point, index) => {
                const x = CHART_PADDING.left + index * chartData.xStep;
                const y = chartData.valueToY(point.value);
                return (
                  <g key={`${point.label}-${index}`}>
                    <circle cx={x} cy={y} r="3" fill="#1e3a5f" />
                    <text
                      transform={`translate(${x}, ${CHART_HEIGHT - 22}) rotate(-30)`}
                      textAnchor="end"
                      fontSize="9"
                      fill="#6b7280"
                    >
                      {point.label}
                    </text>
                  </g>
                );
              })}

              <text
                x={CHART_WIDTH / 2}
                y={CHART_HEIGHT - 6}
                textAnchor="middle"
                fontSize="11"
                fill="#475569"
              >
                Fecha y tipo
              </text>
              <text
                transform={`translate(14, ${CHART_HEIGHT / 2}) rotate(-90)`}
                textAnchor="middle"
                fontSize="11"
                fill="#475569"
              >
                Glucosa (mg/dL)
              </text>
            </svg>
          ) : (
            <div className="muted">No hay suficientes datos para el grafico.</div>
          )}
        </div>

        <div className="list">
          {glucoseLoading && <div className="muted">Cargando historial...</div>}
          {!glucoseLoading && !filteredLogs.length && (
            <div className="muted">Sin registros para el filtro seleccionado.</div>
          )}
          {!glucoseLoading &&
            filteredLogs.map((log, index) => {
              if (!log || typeof log !== "object") return null;
              const logId =
                log.id || `${log.taken_at || log.created_at || "glucose"}-${index}`;
              const logDate = formatDate(log.taken_at || log.created_at);
              const logValue =
                log.value !== null && log.value !== undefined
                  ? `${log.value} mg/dL`
                  : "Sin valor";
              const logType = formatType(log.type);
              return (
                <div key={logId} className="list-item">
                  <div className="list-title">
                    {logDate} - {logType}
                  </div>
                  <div className="list-meta">{logValue}</div>
                </div>
              );
            })}
        </div>
      </div>
      <style jsx>{`
        .history-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 12px 0 20px;
        }

        .filter-button {
          border: 1px solid #e5e7eb;
          background: #ffffff;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 13px;
          cursor: pointer;
        }

        .filter-button.is-active {
          border-color: #0f766e;
          background: #ecfdf5;
          color: #0f766e;
          font-weight: 600;
        }

        .chart-card {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .chart-legend {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 12px;
          color: #475569;
        }

        .legend-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .legend-swatch {
          width: 12px;
          height: 12px;
          border-radius: 4px;
          display: inline-block;
        }

        .legend-swatch.target {
          background: #dcfce7;
        }

        .legend-swatch.elevated {
          background: #fef3c7;
        }

        .legend-swatch.high {
          background: #fee2e2;
        }
      `}</style>
    </div>
  );
}
