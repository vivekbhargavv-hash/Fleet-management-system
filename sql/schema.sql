CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_status') THEN
    CREATE TYPE vehicle_status AS ENUM ('AVAILABLE', 'DEPLOYED', 'MAINTENANCE', 'PROCUREMENT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'demand_status') THEN
    CREATE TYPE demand_status AS ENUM ('OPEN', 'PARTIAL', 'FULFILLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deployment_action') THEN
    CREATE TYPE deployment_action AS ENUM ('DEPLOYED', 'RETURNED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'maintenance_status') THEN
    CREATE TYPE maintenance_status AS ENUM ('IN_PROGRESS', 'COMPLETED', 'DELAYED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'procurement_status') THEN
    CREATE TYPE procurement_status AS ENUM ('ORDERED', 'IN_TRANSIT', 'RECEIVED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role_tag TEXT NOT NULL DEFAULT 'ops',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT UNIQUE NOT NULL,
  vehicle_type TEXT NOT NULL,
  make_model TEXT NOT NULL,
  city TEXT NOT NULL,
  status vehicle_status NOT NULL DEFAULT 'AVAILABLE',
  client_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demand (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  city TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  quantity_required INTEGER NOT NULL CHECK (quantity_required > 0),
  start_date DATE NOT NULL,
  deployment_deadline DATE NOT NULL,
  status demand_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  demand_id UUID NULL REFERENCES demand(id),
  client_name TEXT NOT NULL,
  city TEXT NOT NULL,
  action deployment_action NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  issue TEXT NOT NULL,
  start_date DATE NOT NULL,
  expected_completion_date DATE NOT NULL,
  status maintenance_status NOT NULL DEFAULT 'IN_PROGRESS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procurement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  city TEXT NOT NULL,
  expected_arrival_date DATE NOT NULL,
  status procurement_status NOT NULL DEFAULT 'ORDERED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_city_type_status ON vehicles(city, vehicle_type, status);
CREATE INDEX IF NOT EXISTS idx_demand_city_type ON demand(city, vehicle_type);
CREATE INDEX IF NOT EXISTS idx_deployments_vehicle_date ON deployments(vehicle_id, date);
