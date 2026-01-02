import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { getToken, logout } from "../../lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not set");
}
const GLUCOSE_HYPO_THRESHOLD = 70;
const GLUCOSE_HYPER_THRESHOLD = 180;
const GLUCOSE_TREND_THRESHOLD = 0;
const FILTERS = [
  { key: "7", label: "Ultimos 7 dias", days: 7 },
  { key: "30", label: "Ultimos 30 dias", days: 30 },
  { key: "90", label: "Ultimos 90 dias", days: 90 },
  { key: "all", label: "Todos", days: null },
];
const CHART_HEIGHT = 260;
const CHART_WIDTH = 720;
const CHART_PADDING = { top: 18, right: 20, bottom: 58, left: 52 };
const FASTING_BANDS = {
  targetMin: 70,
  targetMax: 130,
  elevatedMax: 180,
};
const POSTPRANDIAL_BANDS = {
  targetMin: 70,
  targetMax: 180,
  elevatedMax: 240,
};

const SkeletonLine = ({ width = "100%", height = 12, style = {} }) => (
  <div
    aria-hidden="true"
    style={{
      backgroundColor: "#e5e7eb",
      borderRadius: 8,
      width,
      height,
      marginBottom: 10,
      ...style,
    }}
  />
);

const SkeletonBlock = () => (
  <div className="list">
    <SkeletonLine width="60%" height={16} />
    <SkeletonLine width="80%" height={14} />
    <SkeletonLine width="70%" height={14} />
    <SkeletonLine width="90%" height={14} />
    <SkeletonLine width="65%" height={14} />
  </div>
);

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

const getLogTypeKey = (log) => {
  const raw = String(log?.type || log?.measurement_type || "").toLowerCase();
  if (raw === "postprandial") return "postprandial";
  if (raw === "ayuno" || raw === "fasting") return "ayuno";
  return "";
};

const buildChartData = (logs, bands) => {
  if (!Array.isArray(logs) || logs.length < 2) return null;
  const points = logs
    .slice()
    .reverse()
    .map((log) => {
      const value = Number(log?.value);
      const dateValue = log?.taken_at || log?.created_at;
      const date = new Date(dateValue || 0);
      if (!Number.isFinite(value) || Number.isNaN(date.getTime())) return null;
      return {
        value,
        label: formatShortDate(dateValue),
      };
    })
    .filter(Boolean);
  if (points.length < 2) return null;
  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const chartMin = Math.min(minValue, bands.targetMin - 10);
  const chartMax = Math.max(maxValue, bands.elevatedMax + 20);
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
  return {
    points,
    chartMin,
    chartMax,
    range,
    plotWidth,
    plotHeight,
    xStep,
    path,
    valueToY,
    bands,
  };
};

const getInformativeBadge = (logs, bands) => {
  if (!Array.isArray(logs) || !logs.length) return null;
  const values = logs
    .map((log) => Number(log?.value))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  const withinTarget = values.filter(
    (value) => value >= bands.targetMin && value <= bands.targetMax
  ).length;
  const ratio = withinTarget / values.length;
  if (ratio >= 0.7) return { text: "Dentro de meta", tone: "ok" };
  if (ratio >= 0.4) return { text: "Valores variables", tone: "warn" };
  return { text: "Frecuentemente elevado", tone: "high" };
};

const ChartCard = ({ title, subtitle, chartData, yTicks, emptyTitle, emptyHint, badge }) => (
  <div className="chart-card">
    <div className="chart-header">
      <div>
        <div className="section-title">{title}</div>
        {subtitle && <div className="chart-subtitle">{subtitle}</div>}
      </div>
      <div className="chart-legend">
        {badge && (
          <div className={`info-badge info-badge-${badge.tone}`}>
            <span className="info-badge-text">{badge.text}</span>
            <span className="info-badge-note">Informativo</span>
          </div>
        )}
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
        aria-label={title}
      >
        <rect
          x={CHART_PADDING.left}
          y={chartData.valueToY(chartData.bands.targetMax)}
          width={chartData.plotWidth}
          height={
            chartData.valueToY(chartData.bands.targetMin) -
            chartData.valueToY(chartData.bands.targetMax)
          }
          fill="#dcfce7"
        />
        <rect
          x={CHART_PADDING.left}
          y={chartData.valueToY(chartData.bands.elevatedMax)}
          width={chartData.plotWidth}
          height={
            chartData.valueToY(chartData.bands.targetMax) -
            chartData.valueToY(chartData.bands.elevatedMax)
          }
          fill="#fef3c7"
        />
        <rect
          x={CHART_PADDING.left}
          y={chartData.valueToY(chartData.chartMax)}
          width={chartData.plotWidth}
          height={
            chartData.valueToY(chartData.bands.elevatedMax) -
            chartData.valueToY(chartData.chartMax)
          }
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
            <g key={`${title}-tick-${tick}`}>
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
            <g key={`${title}-${point.label}-${index}`}>
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
          Fecha
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
      <div className="muted">
        <div>{emptyTitle}</div>
        <div>{emptyHint}</div>
      </div>
    )}
  </div>
);

const getTrend = (currentValue, previousValue) => {
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) return null;
  const delta = currentValue - previousValue;
  if (Math.abs(delta) <= GLUCOSE_TREND_THRESHOLD) {
    return { key: "flat", color: "#6b7280" };
  }
  if (delta > 0) {
    return { key: "up", color: "#dc2626" };
  }
  return { key: "down", color: "#16a34a" };
};

const renderTrendIcon = (trend) => {
  if (!trend) return null;
  if (trend.key === "up") {
    return <span style={{ color: trend.color }}>&uarr;</span>;
  }
  if (trend.key === "down") {
    return <span style={{ color: trend.color }}>&darr;</span>;
  }
  return <span style={{ color: trend.color }}>&rarr;</span>;
};

export default function PortalGlucosas() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [glucoseLogs, setGlucoseLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rangeKey, setRangeKey] = useState("30");

  const authFetch = async (path, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body && !headers["Content-Type"] && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    const body =
      options.body && headers["Content-Type"] === "application/json"
        ? JSON.stringify(options.body)
        : options.body;
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      body,
    });
  };

  useEffect(() => {
    const storedToken = getToken();
    setToken(storedToken);
    setAuthReady(true);
    if (!storedToken) {
      setLoading(false);
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    setError("");
    setMessage("");
    authFetch("/glucoses")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (res.status === 404) {
          if (active) {
            setGlucoseLogs([]);
            setMessage("No hay registros de glucosa");
          }
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (active) setError(data.detail || "No se pudo cargar el historial");
          return;
        }
        const data = await res.json().catch(() => []);
        const list = Array.isArray(data) ? data : [];
        if (active) {
          setGlucoseLogs(list);
          if (!list.length) {
            setMessage("No hay registros de glucosa");
          }
        }
      })
      .catch(() => {
        if (active) setError("No se pudo cargar el historial");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router, token]);

  const orderedLogs = useMemo(() => {
    if (!Array.isArray(glucoseLogs)) return [];
    return glucoseLogs.slice().sort((a, b) => {
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

  const alertBadge = useMemo(() => {
    if (!orderedLogs.length) return null;
    const value = Number(orderedLogs[0]?.value);
    if (!Number.isFinite(value)) return null;
    if (value < GLUCOSE_HYPO_THRESHOLD) {
      return { text: "Hipoglucemia", color: "#991b1b", background: "#fee2e2" };
    }
    if (value >= GLUCOSE_HYPER_THRESHOLD) {
      return { text: "Hiperglucemia", color: "#92400e", background: "#fffbeb" };
    }
    return { text: "Normal", color: "#166534", background: "#dcfce7" };
  }, [orderedLogs]);

  const fastingLogs = useMemo(
    () => filteredLogs.filter((log) => getLogTypeKey(log) === "ayuno"),
    [filteredLogs]
  );
  const postprandialLogs = useMemo(
    () => filteredLogs.filter((log) => getLogTypeKey(log) === "postprandial"),
    [filteredLogs]
  );

  const fastingChartData = useMemo(
    () => buildChartData(fastingLogs, FASTING_BANDS),
    [fastingLogs]
  );
  const postprandialChartData = useMemo(
    () => buildChartData(postprandialLogs, POSTPRANDIAL_BANDS),
    [postprandialLogs]
  );
  const fastingBadge = useMemo(
    () => getInformativeBadge(fastingLogs, FASTING_BANDS),
    [fastingLogs]
  );
  const postprandialBadge = useMemo(
    () => getInformativeBadge(postprandialLogs, POSTPRANDIAL_BANDS),
    [postprandialLogs]
  );

  const fastingTicks = fastingChartData
    ? Array.from({ length: 5 }, (_, index) =>
        Math.round(
          fastingChartData.chartMin + (fastingChartData.range * index) / 4
        )
      )
    : [];
  const postprandialTicks = postprandialChartData
    ? Array.from({ length: 5 }, (_, index) =>
        Math.round(
          postprandialChartData.chartMin +
            (postprandialChartData.range * index) / 4
        )
      )
    : [];

  if (!authReady || loading) {
    return (
      <div className="page">
        <div className="card portal-shell">
          <div className="portal-dashboard">
            <SkeletonLine width="50%" height={20} />
            <SkeletonLine width="35%" height={12} />
            <SkeletonBlock />
            <SkeletonLine width="100%" height={CHART_HEIGHT} />
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return null;
  }

  return (
    <div className="page">
      <div className="card portal-shell">
        <div className="portal-dashboard">
          <div>
            <Link href="/portal" className="button button-secondary">
              &larr; Volver al portal
            </Link>
          </div>
          <header className="portal-header">
            <h1 className="portal-title">Historial de glucosas</h1>
          </header>
          {alertBadge && (
            <div
              style={{
                background: alertBadge.background,
                color: alertBadge.color,
                padding: "8px 12px",
                borderRadius: 12,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {alertBadge.text}
            </div>
          )}
          {!error && (
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
          )}
          {error && <div className="error">{error}</div>}
          {!error && message && <div className="muted">{message}</div>}
          {!error && !message && (
            <>
              <ChartCard
                title="Glucosa en ayuno"
                subtitle="Meta habitual en ayuno: 80–130 mg/dL"
                chartData={fastingChartData}
                yTicks={fastingTicks}
                emptyTitle="Aún no tienes registros de glucosa en ayuno"
                emptyHint="Registra una medición para ver tu evolución"
                badge={fastingBadge}
              />
              <ChartCard
                title="Glucosa postprandial"
                subtitle="Meta postprandial (2 horas): <180 mg/dL"
                chartData={postprandialChartData}
                yTicks={postprandialTicks}
                emptyTitle="Aún no tienes registros posprandiales"
                emptyHint="Registra una medición para ver tu evolución"
                badge={postprandialBadge}
              />
              <div className="chart-disclaimer">
                Esta visualización es informativa y no reemplaza la evaluación médica.
              </div>

              <div className="list">
                {!filteredLogs.length && (
                  <div className="muted">Sin registros para el filtro seleccionado.</div>
                )}
                {filteredLogs.map((log, index) => {
                  if (!log || typeof log !== "object") return null;
                  const logId =
                    log.id || `${log.taken_at || log.created_at || "glucose"}-${index}`;
                  const logValue = Number(log.value);
                  const logTypeRaw = log.type || log.measurement_type;
                  const logType =
                    logTypeRaw === "postprandial"
                      ? "Despues de comer"
                      : logTypeRaw === "fasting" || logTypeRaw === "ayuno"
                        ? "Ayuno"
                        : "Sin tipo";
                  const previousValue = Number(filteredLogs[index + 1]?.value);
                  const trend = getTrend(logValue, previousValue);
                  return (
                    <div key={logId} className="list-item">
                      <div>
                        <div className="list-title">
                          {formatDate(log.taken_at || log.created_at)} - {logType} -{" "}
                          <strong>
                            {Number.isFinite(logValue) ? logValue : "Sin valor"} mg/dL
                          </strong>
                        </div>
                      </div>
                      {renderTrendIcon(trend)}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
      <style jsx>{`
        .filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 12px 0 16px;
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
          margin: 8px 0 16px;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .chart-subtitle {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
        }

        .chart-legend {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 12px;
          color: #475569;
        }

        .info-badge {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 6px 10px;
          border-radius: 10px;
          border: 1px solid transparent;
          font-size: 11px;
        }

        .info-badge-text {
          font-weight: 600;
        }

        .info-badge-note {
          font-size: 10px;
          color: #64748b;
        }

        .info-badge-ok {
          background: #ecfdf5;
          border-color: #bbf7d0;
          color: #166534;
        }

        .info-badge-warn {
          background: #fffbeb;
          border-color: #fde68a;
          color: #92400e;
        }

        .info-badge-high {
          background: #fef2f2;
          border-color: #fecaca;
          color: #991b1b;
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

        .chart-disclaimer {
          margin: 8px 0 16px;
          font-size: 12px;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}
