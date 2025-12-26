# Fase 1 - Modulo Receta

## Reglas
- Medicacion actual = items de la ultima visita del paciente.
- Historial = visitas del paciente en orden descendente por fecha.

## Endpoints (resumen)
- POST /auth/patient/login
- POST /auth/admin/login
- POST /auth/logout

Admin:
- GET/POST /admin/patients
- GET/PUT/DELETE /admin/patients/{patient_id}
- GET/POST /admin/medications
- PUT/DELETE /admin/medications/{med_id}
- GET/POST /admin/patients/{patient_id}/visits
- GET /admin/visits/{visit_id}

Paciente:
- GET /patient/me/current-medication
- GET /patient/me/visits
- GET /patient/me/visits/{visit_id}
