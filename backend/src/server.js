import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { query } from "./db.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get("/health", (_, res) => res.json({ ok: true }));

app.post("/auth/login", asyncHandler(async (req, res) => {
  const { email, role = "ops" } = req.body;
  if (!email) return res.status(400).json({ message: "email is required" });

  const upsert = await query(
    `INSERT INTO users (email, role_tag)
     VALUES ($1, $2)
     ON CONFLICT (email)
     DO UPDATE SET role_tag = EXCLUDED.role_tag
     RETURNING id, email, role_tag`,
    [email, role],
  );

  res.json({
    user: upsert.rows[0],
    token: Buffer.from(`${email}:${Date.now()}`).toString("base64"),
  });
}));

app.get("/vehicles", asyncHandler(async (req, res) => {
  const { city, vehicle_type, status, client_id } = req.query;
  const params = [];
  const where = [];

  if (city) { params.push(city); where.push(`city = $${params.length}`); }
  if (vehicle_type) { params.push(vehicle_type); where.push(`vehicle_type = $${params.length}`); }
  if (status) { params.push(status); where.push(`status = $${params.length}`); }
  if (client_id) { params.push(client_id); where.push(`client_id = $${params.length}`); }

  const sql = `SELECT * FROM vehicles ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`;
  const result = await query(sql, params);
  res.json(result.rows);
}));

app.post("/vehicles", asyncHandler(async (req, res) => {
  const { registration_number, vehicle_type, make_model, city, status = "AVAILABLE", client_id = null } = req.body;
  const result = await query(
    `INSERT INTO vehicles (registration_number, vehicle_type, make_model, city, status, client_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [registration_number, vehicle_type, make_model, city, status, client_id],
  );
  res.status(201).json(result.rows[0]);
}));

app.get("/demand", asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT d.*, COALESCE(df.fulfilled_count, 0) AS fulfilled_count,
    ROUND((COALESCE(df.fulfilled_count, 0)::numeric / NULLIF(d.quantity_required, 0)) * 100, 2) AS fulfillment_pct
    FROM demand d
    LEFT JOIN (
      SELECT demand_id, COUNT(*) AS fulfilled_count
      FROM deployments
      WHERE action = 'DEPLOYED'
      GROUP BY demand_id
    ) df ON df.demand_id = d.id
    ORDER BY d.created_at DESC`,
  );
  res.json(result.rows);
}));

app.post("/demand", asyncHandler(async (req, res) => {
  const { client_name, city, vehicle_type, quantity_required, start_date, deployment_deadline, status = "OPEN" } = req.body;
  const result = await query(
    `INSERT INTO demand (client_name, city, vehicle_type, quantity_required, start_date, deployment_deadline, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [client_name, city, vehicle_type, quantity_required, start_date, deployment_deadline, status],
  );
  res.status(201).json(result.rows[0]);
}));

app.post("/deployments", asyncHandler(async (req, res) => {
  const { date, vehicle_id, client_name, city, action, demand_id = null } = req.body;
  const vehicleRes = await query(`SELECT * FROM vehicles WHERE id = $1`, [vehicle_id]);
  if (!vehicleRes.rows.length) return res.status(404).json({ message: "Vehicle not found" });

  const vehicle = vehicleRes.rows[0];
  if (action === "DEPLOYED" && vehicle.status !== "AVAILABLE") {
    return res.status(400).json({ message: "Only AVAILABLE vehicles can be deployed" });
  }
  if (action === "RETURNED" && vehicle.status !== "DEPLOYED") {
    return res.status(400).json({ message: "Only DEPLOYED vehicles can be returned" });
  }

  const deployment = await query(
    `INSERT INTO deployments (date, vehicle_id, client_name, city, action, demand_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [date, vehicle_id, client_name, city, action, demand_id],
  );

  const status = action === "DEPLOYED" ? "DEPLOYED" : "AVAILABLE";
  const clientIdForVehicle = action === "DEPLOYED" ? client_name : null;
  await query(`UPDATE vehicles SET status = $1, client_id = $2 WHERE id = $3`, [status, clientIdForVehicle, vehicle_id]);

  if (demand_id && action === "DEPLOYED") {
    await query(
      `UPDATE demand d SET status =
        CASE
          WHEN sub.fulfilled_count >= d.quantity_required THEN 'FULFILLED'
          WHEN sub.fulfilled_count > 0 THEN 'PARTIAL'
          ELSE 'OPEN'
        END
      FROM (
        SELECT demand_id, COUNT(*) AS fulfilled_count
        FROM deployments WHERE action = 'DEPLOYED' GROUP BY demand_id
      ) sub
      WHERE d.id = sub.demand_id AND d.id = $1`,
      [demand_id],
    );
  }

  res.status(201).json(deployment.rows[0]);
}));

app.get("/deployments/today", asyncHandler(async (_, res) => {
  const result = await query(
    `SELECT d.*, v.registration_number, v.vehicle_type
     FROM deployments d
     JOIN vehicles v ON v.id = d.vehicle_id
     WHERE d.date = CURRENT_DATE
     ORDER BY d.created_at DESC`,
  );
  res.json(result.rows);
}));

app.get("/maintenance", asyncHandler(async (_, res) => {
  const result = await query(
    `SELECT m.*, v.registration_number,
      (CURRENT_DATE - m.start_date) AS days_in_maintenance
     FROM maintenance m
     JOIN vehicles v ON v.id = m.vehicle_id
     ORDER BY m.created_at DESC`,
  );
  res.json(result.rows);
}));

app.post("/maintenance", asyncHandler(async (req, res) => {
  const { vehicle_id, issue, start_date, expected_completion_date, status = "IN_PROGRESS" } = req.body;

  const vehicleRes = await query(`SELECT status FROM vehicles WHERE id = $1`, [vehicle_id]);
  if (!vehicleRes.rows.length) return res.status(404).json({ message: "Vehicle not found" });
  if (vehicleRes.rows[0].status === "DEPLOYED") {
    return res.status(400).json({ message: "Return vehicle before maintenance" });
  }

  const result = await query(
    `INSERT INTO maintenance (vehicle_id, issue, start_date, expected_completion_date, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [vehicle_id, issue, start_date, expected_completion_date, status],
  );

  await query(`UPDATE vehicles SET status = 'MAINTENANCE', client_id = NULL WHERE id = $1`, [vehicle_id]);
  res.status(201).json(result.rows[0]);
}));

app.patch("/maintenance/:id/complete", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `UPDATE maintenance SET status = 'COMPLETED', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id],
  );

  if (!result.rows.length) return res.status(404).json({ message: "Maintenance record not found" });

  await query(`UPDATE vehicles SET status = 'AVAILABLE' WHERE id = $1`, [result.rows[0].vehicle_id]);
  res.json(result.rows[0]);
}));

app.get("/procurement", asyncHandler(async (_, res) => {
  const result = await query(`SELECT * FROM procurement ORDER BY created_at DESC`);
  res.json(result.rows);
}));

app.post("/procurement", asyncHandler(async (req, res) => {
  const { vehicle_type, quantity, city, expected_arrival_date, status = "ORDERED" } = req.body;
  const result = await query(
    `INSERT INTO procurement (vehicle_type, quantity, city, expected_arrival_date, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [vehicle_type, quantity, city, expected_arrival_date, status],
  );
  res.status(201).json(result.rows[0]);
}));

app.patch("/procurement/:id/receive", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { make_model = "TBD" } = req.body;

  const procRes = await query(
    `UPDATE procurement SET status = 'RECEIVED', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id],
  );

  if (!procRes.rows.length) return res.status(404).json({ message: "Procurement record not found" });

  const { vehicle_type, quantity, city } = procRes.rows[0];
  for (let i = 1; i <= quantity; i += 1) {
    const reg = `NEW-${city.slice(0, 3).toUpperCase()}-${vehicle_type}-${Date.now()}-${i}`;
    await query(
      `INSERT INTO vehicles (registration_number, vehicle_type, make_model, city, status)
       VALUES ($1, $2, $3, $4, 'AVAILABLE')`,
      [reg, vehicle_type, make_model, city],
    );
  }

  res.json(procRes.rows[0]);
}));

app.get("/dashboard/summary", asyncHandler(async (_, res) => {
  const result = await query(
    `WITH totals AS (
      SELECT
      COALESCE(SUM(quantity_required), 0) AS total_demand,
      COALESCE((SELECT COUNT(*) FROM vehicles WHERE status = 'DEPLOYED'), 0) AS total_deployed
      FROM demand
    )
    SELECT
      total_demand,
      total_deployed,
      (total_demand - total_deployed) AS pending_deployment,
      ROUND((total_deployed::numeric / NULLIF(total_demand, 0)) * 100, 2) AS fulfillment_pct
    FROM totals`,
  );
  res.json(result.rows[0]);
}));

app.get("/dashboard/client-status", asyncHandler(async (_, res) => {
  const result = await query(
    `SELECT d.client_name, d.city, d.vehicle_type, d.quantity_required,
      COALESCE(dep.fulfilled, 0) AS deployed,
      (d.quantity_required - COALESCE(dep.fulfilled, 0)) AS gap,
      ROUND((COALESCE(dep.fulfilled, 0)::numeric / NULLIF(d.quantity_required, 0)) * 100, 2) AS fulfillment_pct
     FROM demand d
     LEFT JOIN (
      SELECT demand_id, COUNT(*) AS fulfilled
      FROM deployments
      WHERE action = 'DEPLOYED'
      GROUP BY demand_id
     ) dep ON dep.demand_id = d.id
     ORDER BY d.created_at DESC`,
  );
  res.json(result.rows);
}));

app.get("/dashboard/inventory", asyncHandler(async (_, res) => {
  const result = await query(
    `SELECT city, vehicle_type,
      COUNT(*) FILTER (WHERE status = 'AVAILABLE') AS available,
      COUNT(*) FILTER (WHERE status = 'DEPLOYED') AS deployed,
      COUNT(*) FILTER (WHERE status = 'MAINTENANCE') AS maintenance,
      COALESCE((
        SELECT SUM(p.quantity) FROM procurement p
        WHERE p.city = v.city AND p.vehicle_type = v.vehicle_type AND p.status IN ('ORDERED', 'IN_TRANSIT')
      ), 0) AS incoming
    FROM vehicles v
    GROUP BY city, vehicle_type
    ORDER BY city, vehicle_type`,
  );
  res.json(result.rows);
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error", detail: err.message });
});

app.listen(PORT, () => {
  console.log(`Fleet MVP backend running on port ${PORT}`);
});
