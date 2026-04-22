# Fleet Deployment Management MVP

Simple internal operations tool to manage demand, deployments, inventory, maintenance, and procurement with a single PostgreSQL source of truth.

## Structure

- `backend/` Express API
- `frontend/` React + Tailwind app
- `sql/schema.sql` PostgreSQL schema for Supabase/local Postgres
- `sql/seed.sql` optional starter data
- `docker-compose.yml` one-command local stack (frontend + backend + postgres)

## Fastest start (Docker Compose)

```bash
docker compose up --build
```

Access:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`
- Postgres: `localhost:5432`

The DB schema and seed run automatically from `sql/schema.sql` and `sql/seed.sql` on first startup.

Stop stack:
```bash
docker compose down
```

Reset DB volume:
```bash
docker compose down -v
```

## Non-Docker quick start

### 1) Database
Run schema and seed scripts in Supabase SQL editor or local Postgres.

### 2) Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### 3) Frontend
```bash
cd frontend
npm install
npm run dev
```

Set API URL if needed:
```bash
# frontend/.env
VITE_API_URL=http://localhost:4000
```

## API highlights

- `POST /auth/login` basic email login + role tag
- `GET/POST /demand`
- `GET/POST /vehicles`
- `POST /deployments` (enforces valid state transitions)
- `GET/POST /maintenance`, `PATCH /maintenance/:id/complete`
- `GET/POST /procurement`, `PATCH /procurement/:id/receive` (auto-add vehicles)
- Dashboard:
  - `GET /dashboard/summary`
  - `GET /dashboard/client-status`
  - `GET /dashboard/inventory`

## Business rules implemented

- Deploy: `AVAILABLE -> DEPLOYED`
- Return: `DEPLOYED -> AVAILABLE`
- Send to maintenance: vehicle status `MAINTENANCE`
- Complete maintenance: `MAINTENANCE -> AVAILABLE`
- Receive procurement: insert new `AVAILABLE` vehicles into inventory
- Demand fulfillment % calculated from deployed vehicle rows vs quantity required
