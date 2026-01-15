import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { apiFetch, logout } from "../../../lib/auth";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";
import SectionTitle from "../../../components/ui/SectionTitle";

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

const formatConsultationDate = (item) => {
  if (!item || typeof item !== "object") return "";
  return formatDate(item.consultation_date || item.created_at);
};

export default function AdminConsultationDetail() {
  const router = useRouter();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!router.isReady) return;
    const consultationId = Array.isArray(router.query.id)
      ? router.query.id[0]
      : router.query.id;

    if (!consultationId) return;

    let active = true;
    setLoading(true);
    setError("");

    apiFetch(`/admin/consultations/${consultationId}`)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout(router, "/login?type=admin");
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (active) {
            setError(data?.detail || "No se pudo cargar la consulta");
            setLoading(false);
          }
          return;
        }
        const data = await res.json().catch(() => null);
        if (active) {
          if (data && !data.consultation_date) {
            console.warn("Consulta sin consultation_date en detalle", data);
          }
          setDetail(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError("No se pudo cargar la consulta");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router, router.isReady, router.query.id]);

  const medications = Array.isArray(detail?.medications) ? detail.medications : [];
  const labs = Array.isArray(detail?.labs) ? detail.labs : [];
  const formattedDate = formatConsultationDate(detail);
  const patientName = detail?.patient_full_name || "";
  const patientCedula =
    detail?.patient_cedula || detail?.patient_username || detail?.cedula || "";
  const diagnosisText = String(detail?.diagnosis || "").trim();
  const indicationsText = String(detail?.indications || "").trim();
  const requestedExamsText = String(detail?.requested_exams || "").trim();
  const reasonText = String(detail?.reason_for_visit || "").trim();
  const currentIllnessText = String(detail?.current_illness || "").trim();
  const physicalExamText = String(detail?.physical_exam || "").trim();
  const vitals = [
    { label: "Peso (kg)", value: detail?.weight },
    { label: "Talla (cm)", value: detail?.height },
    { label: "Presion arterial", value: detail?.blood_pressure },
    { label: "Frecuencia cardiaca", value: detail?.heart_rate },
    { label: "Saturacion O2", value: detail?.oxygen_saturation },
    { label: "Circunferencia abdominal", value: detail?.abdominal_circumference },
  ];
  const hasVitals = vitals.some(
    (item) => item.value !== null && item.value !== undefined && String(item.value).trim() !== ""
  );

  if (loading) {
    return (
      <div className="page admin-page">
        <div className="admin-shell">
          <div className="mx-auto w-full max-w-4xl px-4 pb-12 pt-6">
            <Card className="p-6 md:p-8">
              <div className="space-y-4">
                <div className="h-5 w-32 rounded-full bg-slate-100" />
                <div className="h-8 w-40 rounded-lg bg-slate-100" />
                <div className="h-4 w-56 rounded-lg bg-slate-100" />
                <div className="h-24 w-full rounded-2xl bg-slate-50" />
                <p className="muted text-sm">Cargando...</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page admin-page">
      <div className="admin-shell">
        <div className="mx-auto w-full max-w-4xl px-4 pb-12 pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Consulta clínica</Badge>
                {formattedDate && (
                  <span className="text-sm font-medium text-slate-700">
                    {formattedDate}
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-semibold text-slate-900">Consulta</h1>
              {patientName && <div className="text-base text-slate-700">{patientName}</div>}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full md:w-auto"
              onClick={() => router.push("/dashboard")}
            >
              Volver al dashboard
            </Button>
          </div>

          {error && <div className="error mt-6">{error}</div>}

          {!detail && !error && (
            <div className="mt-6">
              <EmptyState
                title="Consulta"
                description="No hay informacion para mostrar."
              />
            </div>
          )}

          {detail && (
            <div className="mt-6 space-y-6">
              <Card className="p-5">
                <SectionTitle title="Paciente" subtitle="Ficha del paciente" />
                <div className="mt-4 space-y-3">
                  <div className="text-lg font-semibold text-slate-900">
                    {patientName || "-"}
                  </div>
                  <div className="text-sm text-slate-500">
                    Cedula: {patientCedula || "-"}
                  </div>
                  {formattedDate && (
                    <div className="text-sm text-slate-600">
                      Consulta {formattedDate}
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-5">
                <SectionTitle title="Diagnostico" />
                <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                  {diagnosisText || "Sin registro"}
                </div>
              </Card>

              <Card className="p-5">
                <SectionTitle title="Motivo e historia actual" />
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Motivo de consulta
                    </div>
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                      {reasonText || "Sin registro"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Historia actual
                    </div>
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                      {currentIllnessText || "Sin registro"}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <SectionTitle title="Signos vitales" />
                {hasVitals ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {vitals.map((item) => {
                      const valueText =
                        item.value !== null &&
                        item.value !== undefined &&
                        String(item.value).trim() !== ""
                          ? item.value
                          : "Sin registro";
                      return (
                        <div
                          key={item.label}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                        >
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {item.label}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {valueText}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-500">Sin registro</div>
                )}
              </Card>

              <Card className="p-5">
                <SectionTitle title="Examen fisico" />
                <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                  {physicalExamText || "Sin registro"}
                </div>
              </Card>

              <Card className="p-5">
                <SectionTitle title="Indicaciones y examenes solicitados" />
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Indicaciones
                    </div>
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                      {indicationsText || "Sin registro"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Examenes solicitados
                    </div>
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                      {requestedExamsText || "Sin registro"}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <SectionTitle title="Medicacion" />
                <div className="mt-4 space-y-3">
                  {medications.length === 0 && (
                    <EmptyState title="No hay medicacion registrada." />
                  )}
                  {medications.map((med, index) => {
                    if (!med || typeof med !== "object") return null;
                    const quantityValue = med.quantity ?? "";
                    const durationValue = med.duration_days ?? "";
                    const descriptionValue = med.description ?? "";
                    const medKey = `${med.drug_name || "med"}-${index}`;
                    const chips = [];
                    if (quantityValue !== "") chips.push(`Cantidad: ${quantityValue}`);
                    if (durationValue !== "") chips.push(`Duracion: ${durationValue} dias`);
                    return (
                      <details
                        key={medKey}
                        className="group rounded-xl border border-slate-200 bg-white shadow-sm"
                      >
                        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-slate-900">
                          <span className="font-semibold">
                            {med.drug_name || "Medicamento"}
                          </span>
                          <span className="text-xs font-medium text-slate-500">
                            Ver detalle
                          </span>
                        </summary>
                        <div className="px-4 pb-4">
                          {chips.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {chips.map((chip) => (
                                <span
                                  key={chip}
                                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                                >
                                  {chip}
                                </span>
                              ))}
                            </div>
                          )}
                          {descriptionValue && (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                              {descriptionValue}
                            </div>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </Card>

              <Card className="p-5">
                <SectionTitle title="Laboratorios" />
                <div className="mt-4 space-y-3">
                  {labs.length === 0 && (
                    <EmptyState title="No hay resultados registrados." />
                  )}
                  {labs.map((lab, index) => {
                    if (!lab || typeof lab !== "object") return null;
                    const resultValue = lab.valor_num ?? lab.valor_texto ?? "";
                    const resultLabel = resultValue !== "" ? resultValue : "Sin resultado";
                    const unit = lab.unidad_snapshot ? ` ${lab.unidad_snapshot}` : "";
                    const labKey = `${lab.lab_nombre || "lab"}-${index}`;
                    return (
                      <div
                        key={labKey}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          {lab.lab_nombre || "Examen"}
                        </div>
                        <div className="mt-2 text-sm text-slate-700">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Resultado
                          </span>
                          <div className="mt-1 font-semibold text-slate-900">
                            {resultLabel}
                            {resultValue !== "" ? unit : ""}
                          </div>
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
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
