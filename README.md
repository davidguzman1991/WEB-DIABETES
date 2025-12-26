# WEB DIABETES

Monorepo con backend (FastAPI + PostgreSQL + Alembic) y frontend (Next.js) para el modulo Receta (Fase 1).

## Estructura
- backend: API FastAPI + modelos + Alembic
- frontend: UI Next.js
- infra: infraestructura (placeholders)
- docs: documentacion de endpoints y reglas

## Backend
1) Crear y activar entorno virtual
2) Instalar dependencias
3) Configurar variables de entorno
4) Ejecutar migraciones
5) Levantar API

Ejemplo (PowerShell):
```powershell
cd backend
python -m venv .venv
. .venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# editar .env
alembic revision --autogenerate -m "init"
alembic upgrade head
uvicorn app.main:app --reload
```

## Frontend
```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
# editar .env.local
npm run dev
```

Variables requeridas (frontend):
- `NEXT_PUBLIC_API_BASE_URL` (base URL del backend, ejemplo: `http://127.0.0.1:8000`)

## Scripts rapidos
```powershell
./scripts/run_backend.ps1
./scripts/run_frontend.ps1
```

## Railway Postgres
- Crear base en Railway y copiar el connection string.
- Asignar `DATABASE_URL` en `backend/.env`.
- Si Railway requiere SSL, usar `?sslmode=require` al final de la URL.

## Reglas de login
- Paciente: usuario = cedula, password temporal = apellidos + nombres (sin espacios, en minusculas).
- Admin: credenciales en `ADMIN_USERNAME` y `ADMIN_PASSWORD` o `ADMIN_PASSWORD_HASH`.
