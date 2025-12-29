import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { getToken, logout } from "../../lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const GLUCOSE_HYPO_THRESHOLD = 70;
const GLUCOSE_HYPER_THRESHOLD = 180;
const GLUCOSE_TREND_THRESHOLD = 0;
const CHART_HEIGHT = 200;
const CHART_WIDTH = 640;
const CHART_PADDING = 24;

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

  const chartData = useMemo(() => {
    if (orderedLogs.length < 2) return null;
    const points = orderedLogs
      .slice()
      .reverse()
      .map((log) => ({
        value: Number(log?.value),
        label: formatShortDate(log?.taken_at || log?.created_at),
      }))
      .filter((point) => Number.isFinite(point.value));
    if (points.length < 2) return null;
    const values = points.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = Math.max(maxValue - minValue, 1);
    const xStep =
      points.length > 1 ? (CHART_WIDTH - CHART_PADDING * 2) / (points.length - 1) : 0;
    const plotHeight = CHART_HEIGHT - CHART_PADDING * 2;
    const path = points
      .map((point, index) => {
        const x = CHART_PADDING + index * xStep;
        const normalized = (point.value - minValue) / range;
        const y = CHART_HEIGHT - CHART_PADDING - normalized * plotHeight;
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
    return { points, minValue, maxValue, path };
  }, [orderedLogs]);

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
          {error && <div className="error">{error}</div>}
          {!error && message && <div className="muted">{message}</div>}
          {!error && !message && (
            <div className="list">
              {orderedLogs.map((log, index) => {
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
                const previousValue = Number(orderedLogs[index + 1]?.value);
                const trend = getTrend(logValue, previousValue);
                return (
                  <div key={logId} className="list-item">
                    <div>
                      <div className="list-title">
                        {formatDate(log.taken_at || log.created_at)} - {logType} -{" "}
                        <strong>{Number.isFinite(logValue) ? logValue : "Sin valor"} mg/dL</strong>
                      </div>
                    </div>
                    {renderTrendIcon(trend)}
                  </div>
                );
              })}
            </div>
          )}
          {!error && !message && chartData && (
            <div style={{ marginTop: 16 }}>
              <svg
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                width="100%"
                height={CHART_HEIGHT}
                role="img"
                aria-label="Grafico de glucosa"
              >
                <path d={chartData.path} fill="none" stroke="#1e3a5f" strokeWidth="2" />
                {chartData.points.map((point, index) => {
                  const xStep =
                    chartData.points.length > 1
                      ? (CHART_WIDTH - CHART_PADDING * 2) /
                        (chartData.points.length - 1)
                      : 0;
                  const x = CHART_PADDING + index * xStep;
                  const plotHeight = CHART_HEIGHT - CHART_PADDING * 2;
                  const range = Math.max(chartData.maxValue - chartData.minValue, 1);
                  const normalized = (point.value - chartData.minValue) / range;
                  const y = CHART_HEIGHT - CHART_PADDING - normalized * plotHeight;
                  return (
                    <g key={`${point.label}-${index}`}>
                      <circle cx={x} cy={y} r="3" fill="#1e3a5f" />
                      <text
                        x={x}
                        y={CHART_HEIGHT - 6}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#6b7280"
                      >
                        {point.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
