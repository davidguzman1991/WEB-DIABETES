import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { apiFetch, logout } from "../../../../lib/auth";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";
import Button from "../../../../components/ui/Button";
import Card from "../../../../components/ui/Card";

export default function TratamientoConsulta() {
  const router = useRouter();
  const { user, loading } = useAuthGuard({ redirectTo: "/login" });
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !router.query.id) return;
    if (String(user.role).toLowerCase() !== "patient") {
      logout(router, "/login");
      return;
    }
    apiFetch(`/consultations/${router.query.id}/print`)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login");
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.detail || "Error al cargar consulta");
          return;
        }
        const data = await res.json();
        setDetail(data);
      })
      .catch(() => {
        setError("Error al cargar consulta");
      });
  }, [router, user]);

  const consultationId = typeof router.query.id === "string" ? router.query.id : "";
  const medications = Array.isArray(detail?.medications) ? detail.medications : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
          <Card className="border-l-4 border-emerald-500 p-5 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  Consulta
                </div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  Tratamiento
                </h1>
                <p className="text-sm text-slate-600">
                  Como tomar sus medicamentos
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(
                    consultationId
                      ? `/portal/consultas/${consultationId}`
                      : "/portal/historial"
                  )
                }
              >
                Volver a consulta
              </Button>
            </div>
            <p className="mt-6 text-sm text-slate-500">Cargando...</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
        <Card className="border-l-4 border-emerald-500 p-5 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Consulta
              </div>
              <h1 className="text-2xl font-semibold text-slate-900">Tratamiento</h1>
              <p className="text-sm text-slate-600">Como tomar sus medicamentos</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(
                  consultationId
                    ? `/portal/consultas/${consultationId}`
                    : "/portal/historial"
                )
              }
            >
              Volver a consulta
            </Button>
          </div>

          <div className="mt-6 space-y-4">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {medications.length === 0 && !error && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                No hay medicacion registrada.
              </div>
            )}

            {medications.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="divide-y divide-slate-200">
                  {medications.map((med, index) => {
                    if (!med || typeof med !== "object") return null;
                    const quantityValue = med.quantity ?? "";
                    const durationValue = med.duration_days ?? "";
                    const descriptionValue = med.description ?? "";
                    const medKey = `${med.drug_name || "med"}-${index}`;
                    const chipItems = [];
                    if (quantityValue !== "") chipItems.push(`Dosis: ${quantityValue}`);
                    if (med.horario) chipItems.push(`Horario: ${med.horario}`);
                    if (med.via) chipItems.push(`Via: ${med.via}`);
                    if (durationValue !== "") {
                      chipItems.push(`Duracion: ${durationValue} dias`);
                    }
                    return (
                      <div
                        key={medKey}
                        className="flex flex-col gap-3 px-4 py-4"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          {med.drug_name || "Medicamento"}
                        </div>
                        {chipItems.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {chipItems.map((chip) => (
                              <span
                                key={chip}
                                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                              >
                                {chip}
                              </span>
                            ))}
                          </div>
                        )}
                        {descriptionValue && (
                          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-slate-700">
                            {descriptionValue}
                          </div>
                        )}
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
