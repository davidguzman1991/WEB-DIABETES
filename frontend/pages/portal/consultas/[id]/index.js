import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { apiFetch, logout } from "../../../../lib/auth";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";
import Button from "../../../../components/ui/Button";
import Card from "../../../../components/ui/Card";
import SectionTitle from "../../../../components/ui/SectionTitle";

function computeAge(dateStr) {
  if (!dateStr) return null;
  const birth = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age < 0 ? null : age;
}

export default function ConsultaDetalle() {
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
  const patient = detail?.patient || null;
  const consultation = detail?.consultation || null;
  const diagnosisText = (consultation?.diagnosis || "").trim();
  const indicationsText = (consultation?.indications || "").trim();
  const age = computeAge(patient?.fecha_nacimiento);
  const patientName = patient
    ? [patient.nombres, patient.apellidos].filter(Boolean).join(" ")
    : "";
  const headerDiagnosis = diagnosisText || "Diagnostico no registrado";
  const consultationDate = consultation?.created_at
    ? new Date(consultation.created_at).toLocaleDateString("es-EC", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";
  const headerSubtitle = consultationDate || headerDiagnosis;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
          <Card className="p-5 sm:p-8">
            <SectionTitle
              title="Consulta"
              subtitle={headerSubtitle || "Detalle de la consulta"}
              rightSlot={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/portal/historial")}
                >
                  Volver al historial
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
        <Card className="p-5 sm:p-8">
          <SectionTitle
            title="Consulta"
            subtitle={headerSubtitle || "Detalle de la consulta"}
            rightSlot={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push("/portal/historial")}
              >
                Volver al historial
              </Button>
            }
          />

          {(patientName || age !== null) && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              {patientName && (
                <span className="font-medium text-slate-900">{patientName}</span>
              )}
              {age !== null && <span>Edad: {age} anos</span>}
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!detail && !error && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              No se encontro informacion de la consulta.
            </div>
          )}

          {detail && (
            <div className="mt-6 space-y-5">
              <Card className="p-5">
                <SectionTitle title="Diagnostico / Motivo" />
                <div className="mt-3 text-sm text-slate-700">
                  {diagnosisText || "Diagnostico no registrado."}
                </div>
              </Card>

              {consultationId && (
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="p-5">
                    <SectionTitle
                      title="Tratamiento"
                      subtitle="Detalle de medicamentos"
                    />
                    <Button
                      className="mt-4 w-full"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(`/portal/consultas/${consultationId}/tratamiento`)
                      }
                    >
                      Ver tratamiento
                    </Button>
                  </Card>

                  <Card className="p-5">
                    <SectionTitle
                      title="Laboratorios"
                      subtitle="Resultados actuales"
                    />
                    <Button
                      className="mt-4 w-full"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(`/portal/consultas/${consultationId}/laboratorios`)
                      }
                    >
                      Ver laboratorios
                    </Button>
                  </Card>

                  {indicationsText && (
                    <Card className="p-5">
                      <SectionTitle
                        title="Indicaciones"
                        subtitle="Recomendaciones medicas"
                      />
                      <Button
                        className="mt-4 w-full"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/portal/consultas/${consultationId}/indicaciones`)
                        }
                      >
                        Ver indicaciones
                      </Button>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
