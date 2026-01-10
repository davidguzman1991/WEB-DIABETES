import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { apiFetch, logout } from "../../lib/auth";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import SectionTitle from "../../components/ui/SectionTitle";

export default function PortalHistorial() {
  const router = useRouter();
  const { user, loading } = useAuthGuard({ redirectTo: "/login" });
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
    setMessage("");
    setError("");
    apiFetch("/patient/consultations")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) {
          setItems([]);
          setError("No se pudo cargar la informacion");
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setItems(list);
        if (!list.length) {
          setMessage("No existen consultas registradas");
        }
      })
      .catch(() => {
        setItems([]);
        setError("No se pudo cargar la informacion");
      });
  }, [router, user]);

  const patientName = items?.[0]?.patient
    ? [items[0].patient.nombres, items[0].patient.apellidos].filter(Boolean).join(" ")
    : "";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
          <Card className="p-5 sm:p-8">
            <SectionTitle
              title="Historial clinico"
              subtitle="Revise sus consultas anteriores"
              rightSlot={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/portal")}
                >
                  Volver al portal
                </Button>
              }
            />
            <p className="mt-6 text-sm text-slate-500">Cargando...</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
        <Card className="p-5 sm:p-8">
          <SectionTitle
            title="Historial clinico"
            subtitle="Revise sus consultas anteriores"
            rightSlot={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push("/portal")}
              >
                Volver al portal
              </Button>
            }
          />
          {patientName && (
            <p className="mt-2 text-sm text-slate-500">{patientName}</p>
          )}

          <div className="mt-6 space-y-4">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {message && !error && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                {message}
              </div>
            )}

            {!message && !error && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="divide-y divide-slate-200">
                  {items.map((item) => {
                    const diagnosisText =
                      item.diagnosis || item.indications || "Consulta registrada";
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 px-4 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="text-xs font-medium text-slate-500">
                            Consulta {formatDate(item.created_at)}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {diagnosisText}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/portal/consultas/${item.id}`)}
                        >
                          Ver consulta
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
