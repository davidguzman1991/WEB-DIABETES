import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import { apiFetch, logout } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";

const FILTERS = [
  { key: "6m", label: "Últimos 6 meses", months: 6 },
  { key: "1y", label: "Último año", months: 12 },
  { key: "all", label: "Todos", months: null },
];

const MAX_CONSULTATIONS = 12;
const TARGET_MAX = 7;
const CHART_WIDTH = 720;
const CHART_HEIGHT = 260;
const CHART_PADDING = { top: 18, right: 20, bottom: 52, left: 52 };

const normalizeLabName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const isHbA1cLabName = (value) => {
  const normalized = normalizeLabName(value);
  return normalized === "hba1c" || normalized === "hemoglobina glicosilada";
};

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

const formatHbA1cValue = (value) => {
  if (!Number.isFinite(value)) return "Sin resultado";
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}%`;
};

export default function HbA1cHistory() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthGuard({ redirectTo: "/login" });
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rangeKey, setRangeKey] = useState("6m");

  useEffect(() => {
    if (!user) return;
    if (String(user.role || "").toLowerCase() !== "patient") {
      logout(router, "/login");
      return;
    }
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      setMessage("");
      try {
        const res = await apiFetch("/patient/consultations");
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) {
          if (active) setError("No se pudo cargar resultados de laboratorio");
          return;
        }
        const data = await res.json().catch(() => []);
        const list = Array.isArray(data) ? data : [];
        if (!list.length) {
          if (active) {
            setSeries([]);
            setMessage("No hay resultados de HbA1c disponibles.");
          }
          return;
        }
        const ordered = list
          .slice()
          .sort((a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0));
        const limited = ordered.slice(0, MAX_CONSULTATIONS).filter((item) => item?.id);
        const entries = [];
        for (const item of limited) {
          if (!active) return;
          const detailRes = await apiFetch(`/consultations/${item.id}/print`);
          if (detailRes.status === 401 || detailRes.status === 403) {
            logout(router, "/login");
            return;
          }
          if (!detailRes.ok) {
            continue;
          }
          const detail = await detailRes.json().catch(() => null);
          const labs = Array.isArray(detail?.labs) ? detail.labs : [];
          const match = labs.find((lab) => {
            if (!isHbA1cLabName(lab?.lab_nombre)) return false;
            const value = Number(lab?.valor_num);
            return Number.isFinite(value);
          });
          if (match) {
            const value = Number(match.valor_num);
            const dateValue = detail?.consultation?.created_at || item.created_at;
            entries.push({ value, date: dateValue });
          }
        }
        if (!active) return;
        if (!entries.length) {
          setSeries([]);
          setMessage("No hay resultados de HbA1c disponibles.");
          return;
        }
        entries.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
        setSeries(entries);
      } catch (err) {
        if (active) setError("No se pudo cargar resultados de laboratorio");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [router, user]);

  const activeFilter = FILTERS.find((item) => item.key === rangeKey) || FILTERS[0];

  const filteredSeries = useMemo(() => {
    if (!Array.isArray(series)) return [];
    if (!activeFilter.months) return series;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - activeFilter.months);
    const cutoffTime = cutoff.getTime();
    return series.filter((entry) => {
      const time = new Date(entry?.date || 0).getTime();
      return Number.isFinite(time) && time >= cutoffTime;
    });
  }, [activeFilter.months, series]);

  const latestEntry = useMemo(() => {
    if (!series.length) return null;
    const ordered = series.slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return ordered[0] || null;
  }, [series]);

  const chartData = useMemo(() => {
    if (filteredSeries.length < 2) return null;
    const points = filteredSeries.map((entry) => ({
      value: Number(entry.value),
      label: formatShortDate(entry.date),
    }));
    const values = points.map((point) => point.value).filter((value) => Number.isFinite(value));
    if (values.length < 2) return null;
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const chartMin = Math.min(minValue, 4);
    const chartMax = Math.max(maxValue, 10, TARGET_MAX + 1);
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
    return { points, chartMin, chartMax, range, plotWidth, xStep, path, valueToY };
  }, [filteredSeries]);

  const yTicks = chartData
    ? Array.from({ length: 5 }, (_, index) =>
        Math.round(chartData.chartMin + (chartData.range * index) / 4)
      )
    : [];

  if (authLoading || loading) {
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

  return (
    <div className="page" style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="portal-medical-header">
          <h1>HbA1c</h1>
          <p className="portal-medical-header-subtitle">Evolución en el tiempo.</p>
          <div className="portal-medical-header-info">
            <div className="portal-medical-header-info-item">
              <span className="portal-medical-header-info-label">Último resultado</span>
              <span className="portal-medical-header-info-value">
                {latestEntry
                  ? `${formatHbA1cValue(latestEntry.value)} - ${formatDate(
                      latestEntry.date
                    )}`
                  : "Sin datos"}
              </span>
            </div>
            <div className="portal-medical-header-info-item">
              <span className="portal-medical-header-info-label">Rango</span>
              <span className="portal-medical-header-info-value">{activeFilter.label}</span>
            </div>
          </div>
          <div className="portal-medical-header-actions">
            <Link
              className="portal-medical-button portal-medical-button-secondary portal-medical-button-small"
              href="/portal"
            >
              Volver al portal
            </Link>
          </div>
        </header>

        {error && (
          <section className="portal-medical-card">
            <div className="portal-medical-card-content">
              <div className="portal-medical-alert portal-medical-alert-error">{error}</div>
            </div>
          </section>
        )}

        {!error && message && (
          <section className="portal-medical-card">
            <div className="portal-medical-empty-state">
              <div className="portal-medical-empty-state-icon">HB</div>
              <p className="portal-medical-empty-state-text">{message}</p>
            </div>
          </section>
        )}

        <section className="portal-medical-card">
          <div className="portal-medical-card-header">
            <div className="portal-medical-card-title-section">
              <div className="portal-medical-card-icon labs">HB</div>
              <div className="portal-medical-card-title-group">
                <h2 className="portal-medical-card-title">Tendencia HbA1c</h2>
                <p className="portal-medical-card-subtitle">
                  Seguimiento de resultados en el tiempo.
                </p>
              </div>
            </div>
          </div>
          <div className="portal-medical-card-content">
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
                <div className="section-title">Evolución HbA1c</div>
                <div className="chart-legend">
                  <span className="legend-item">
                    <span className="legend-swatch target" />
                    Meta (= 7%)
                  </span>
                </div>
              </div>
              {filteredSeries.length === 1 && (
                <div className="muted">
                  Se requieren al menos dos mediciones para mostrar la evolucion.
                </div>
              )}
              {filteredSeries.length > 1 && chartData && (
                <svg
                  viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                  width="100%"
                  height={CHART_HEIGHT}
                  role="img"
                  aria-label="Grafico HbA1c"
                >
                  <rect
                    x={CHART_PADDING.left}
                    y={chartData.valueToY(TARGET_MAX)}
                    width={chartData.plotWidth}
                    height={
                      chartData.valueToY(chartData.chartMin) -
                      chartData.valueToY(TARGET_MAX)
                    }
                    fill="#dcfce7"
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
                    Fecha
                  </text>
                  <text
                    transform={`translate(14, ${CHART_HEIGHT / 2}) rotate(-90)`}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#475569"
                  >
                    HbA1c (%)
                  </text>
                </svg>
              )}
              {filteredSeries.length === 0 && !message && !error && (
                <div className="muted">No hay resultados de HbA1c disponibles.</div>
              )}
            </div>

            <div className="chart-disclaimer">
              Esta visualización es informativa y no reemplaza la evaluación médica.
            </div>
          </div>
        </section>

        {filteredSeries.length > 0 && (
          <section className="portal-medical-card">
            <div className="portal-medical-card-header">
              <div className="portal-medical-card-title-section">
                <div className="portal-medical-card-icon labs">HB</div>
                <div className="portal-medical-card-title-group">
                  <h2 className="portal-medical-card-title">Resultados</h2>
                  <p className="portal-medical-card-subtitle">
                    Valores históricos de HbA1c.
                  </p>
                </div>
              </div>
            </div>
            <div className="portal-medical-card-content">
              <div className="portal-medical-list">
                {filteredSeries
                  .slice()
                  .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
                  .map((entry, index) => (
                    <div
                      key={`${entry.date || "entry"}-${index}`}
                      className="portal-medical-list-item"
                    >
                      <div>
                        <div className="portal-medical-list-title">
                          {formatDate(entry.date)}
                        </div>
                        <div className="portal-medical-list-meta">
                          {formatHbA1cValue(entry.value)}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        )}
      </div>
      <style jsx>{`
        .filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 16px 0;
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
          margin-bottom: 12px;
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

        .chart-disclaimer {
          margin: 8px 0 16px;
          font-size: 12px;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}
