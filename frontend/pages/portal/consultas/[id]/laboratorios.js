import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { apiFetch, logout } from "../../../../lib/auth";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";
import Button from "../../../../components/ui/Button";
import Card from "../../../../components/ui/Card";
import SectionTitle from "../../../../components/ui/SectionTitle";

export default function LaboratoriosConsulta() {
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
  const labs = Array.isArray(detail?.labs) ? detail.labs : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
          <Card className="p-5 sm:p-8">
            <SectionTitle
              title="Resultados de laboratorio"
              subtitle="Resultados actuales"
              rightSlot={
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
            title="Resultados de laboratorio"
            subtitle="Resultados actuales"
            rightSlot={
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
            }
          />

          <div className="mt-6 space-y-4">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {labs.length === 0 && !error && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                No hay resultados registrados.
              </div>
            )}

            {labs.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="divide-y divide-slate-200">
                  {labs.map((lab, index) => {
                    if (!lab || typeof lab !== "object") return null;
                    const resultValue = lab.valor_num ?? lab.valor_texto ?? "";
                    const resultLabel = resultValue !== "" ? resultValue : "Sin resultado";
                    const unit = lab.unidad_snapshot ? ` ${lab.unidad_snapshot}` : "";
                    const labKey = `${lab.lab_nombre || "lab"}-${index}`;
                    return (
                      <div key={labKey} className="px-4 py-4">
                        <div className="text-sm font-semibold text-slate-900">
                          {lab.lab_nombre || "Examen"}
                        </div>
                        <div className="mt-2 text-xs font-medium text-slate-500">
                          Resultado
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          {resultLabel}
                          {resultValue !== "" ? unit : ""}
                        </div>
                        {lab.rango_ref_snapshot && (
                          <div className="mt-2 text-xs text-slate-500">
                            Rango: {lab.rango_ref_snapshot}
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
