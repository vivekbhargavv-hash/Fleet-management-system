import { useEffect, useMemo, useState } from 'react';

const API = import.meta.env.VITE_API_URL || '/api';

const badgeClass = (value) => {
  if (value < 50) return 'bg-red-100 text-red-700';
  if (value < 80) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
};

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const Card = ({ label, value }) => (
  <div className="rounded-lg bg-white p-4 shadow">
    <div className="text-sm text-slate-500">{label}</div>
    <div className="text-2xl font-bold text-slate-800">{value ?? '-'}</div>
  </div>
);

const Table = ({ title, children }) => (
  <section className="rounded-lg bg-white p-4 shadow">
    <h2 className="mb-3 text-lg font-semibold">{title}</h2>
    <div className="overflow-x-auto">{children}</div>
  </section>
);

export default function App() {
  const [summary, setSummary] = useState({});
  const [clientStatus, setClientStatus] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [demand, setDemand] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [procurement, setProcurement] = useState([]);
  const [filters, setFilters] = useState({ city: '', vehicle_type: '', client: '' });

  const [demandForm, setDemandForm] = useState({ client_name: '', city: '', vehicle_type: '3W', quantity_required: 1, start_date: '', deployment_deadline: '' });
  const [deploymentForm, setDeploymentForm] = useState({ date: new Date().toISOString().slice(0, 10), vehicle_id: '', client_name: '', city: '', action: 'DEPLOYED', demand_id: '' });
  const [maintenanceForm, setMaintenanceForm] = useState({ vehicle_id: '', issue: '', start_date: new Date().toISOString().slice(0, 10), expected_completion_date: '' });
  const [procurementForm, setProcurementForm] = useState({ vehicle_type: '3W', quantity: 1, city: '', expected_arrival_date: '' });

  const refresh = async () => {
    const [s, cs, inv, d, v, m, p] = await Promise.all([
      api('/dashboard/summary'),
      api('/dashboard/client-status'),
      api('/dashboard/inventory'),
      api('/demand'),
      api('/vehicles'),
      api('/maintenance'),
      api('/procurement'),
    ]);
    setSummary(s);
    setClientStatus(cs);
    setInventory(inv);
    setDemand(d);
    setVehicles(v);
    setMaintenance(m);
    setProcurement(p);
  };

  useEffect(() => { refresh(); }, []);

  const filteredClientStatus = useMemo(() => clientStatus.filter((row) =>
    (!filters.city || row.city === filters.city)
    && (!filters.vehicle_type || row.vehicle_type === filters.vehicle_type)
    && (!filters.client || row.client_name?.toLowerCase().includes(filters.client.toLowerCase()))
  ), [clientStatus, filters]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <h1 className="text-2xl font-bold text-slate-900">Fleet Deployment Management MVP</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <Card label="Total Demand" value={summary.total_demand} />
        <Card label="Total Deployed" value={summary.total_deployed} />
        <Card label="Pending Deployment" value={summary.pending_deployment} />
        <Card label="Fulfillment %" value={`${summary.fulfillment_pct || 0}%`} />
      </div>

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="mb-2 text-lg font-semibold">Filters</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input className="rounded border p-2" placeholder="City" value={filters.city} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))} />
          <input className="rounded border p-2" placeholder="Vehicle Type" value={filters.vehicle_type} onChange={(e) => setFilters((f) => ({ ...f, vehicle_type: e.target.value }))} />
          <input className="rounded border p-2" placeholder="Client" value={filters.client} onChange={(e) => setFilters((f) => ({ ...f, client: e.target.value }))} />
        </div>
      </section>

      <Table title="Client-wise Deployment Status">
        <table className="min-w-full text-sm">
          <thead><tr className="border-b text-left"><th>Client</th><th>City</th><th>Type</th><th>Demand</th><th>Deployed</th><th>Gap</th><th>Status</th></tr></thead>
          <tbody>
            {filteredClientStatus.map((row, i) => (
              <tr key={i} className="border-b">
                <td>{row.client_name}</td><td>{row.city}</td><td>{row.vehicle_type}</td><td>{row.quantity_required}</td><td>{row.deployed}</td><td>{row.gap}</td>
                <td><span className={`rounded px-2 py-1 ${badgeClass(Number(row.fulfillment_pct || 0))}`}>{row.fulfillment_pct || 0}%</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Table>

      <Table title="City-wise Inventory & Incoming Procurement">
        <table className="min-w-full text-sm">
          <thead><tr className="border-b text-left"><th>City</th><th>Type</th><th>Available</th><th>Deployed</th><th>Maintenance</th><th>Incoming</th></tr></thead>
          <tbody>{inventory.map((row, i) => <tr key={i} className="border-b"><td>{row.city}</td><td>{row.vehicle_type}</td><td>{row.available}</td><td>{row.deployed}</td><td>{row.maintenance}</td><td>{row.incoming}</td></tr>)}</tbody>
        </table>
      </Table>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg bg-white p-4 shadow space-y-2">
          <h2 className="text-lg font-semibold">Sales / Demand Entry</h2>
          {Object.keys(demandForm).map((k) => <input key={k} className="w-full rounded border p-2" placeholder={k} value={demandForm[k]} onChange={(e) => setDemandForm((f) => ({ ...f, [k]: e.target.value }))} />)}
          <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={async () => { await api('/demand', { method: 'POST', body: JSON.stringify(demandForm) }); await refresh(); }}>Create Demand</button>
          <div className="max-h-40 overflow-auto text-xs">{demand.map((d) => <div key={d.id}>#{d.id} {d.client_name} {d.fulfillment_pct || 0}%</div>)}</div>
        </section>

        <section className="rounded-lg bg-white p-4 shadow space-y-2">
          <h2 className="text-lg font-semibold">Assign / Return Vehicle</h2>
          <select className="w-full rounded border p-2" value={deploymentForm.vehicle_id} onChange={(e) => setDeploymentForm((f) => ({ ...f, vehicle_id: e.target.value }))}>
            <option value="">Select vehicle</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registration_number} ({v.status})</option>)}
          </select>
          {['date', 'client_name', 'city', 'demand_id'].map((k) => <input key={k} className="w-full rounded border p-2" placeholder={k} value={deploymentForm[k]} onChange={(e) => setDeploymentForm((f) => ({ ...f, [k]: e.target.value }))} />)}
          <select className="w-full rounded border p-2" value={deploymentForm.action} onChange={(e) => setDeploymentForm((f) => ({ ...f, action: e.target.value }))}>
            <option>DEPLOYED</option><option>RETURNED</option>
          </select>
          <button className="rounded bg-emerald-600 px-3 py-2 text-white" onClick={async () => { await api('/deployments', { method: 'POST', body: JSON.stringify({ ...deploymentForm, demand_id: deploymentForm.demand_id || null }) }); await refresh(); }}>Submit Action</button>
        </section>

        <section className="rounded-lg bg-white p-4 shadow space-y-2">
          <h2 className="text-lg font-semibold">Maintenance Module</h2>
          {['vehicle_id', 'issue', 'start_date', 'expected_completion_date'].map((k) => <input key={k} className="w-full rounded border p-2" placeholder={k} value={maintenanceForm[k]} onChange={(e) => setMaintenanceForm((f) => ({ ...f, [k]: e.target.value }))} />)}
          <button className="rounded bg-amber-600 px-3 py-2 text-white" onClick={async () => { await api('/maintenance', { method: 'POST', body: JSON.stringify(maintenanceForm) }); await refresh(); }}>Add to Maintenance</button>
          <div className="max-h-40 overflow-auto text-xs space-y-1">
            {maintenance.map((m) => <div key={m.id} className="flex items-center justify-between"><span>#{m.id} V{m.vehicle_id} {m.status} ({m.days_in_maintenance} days)</span>{m.status !== 'COMPLETED' && <button className="rounded bg-slate-700 px-2 py-1 text-white" onClick={async () => { await api(`/maintenance/${m.id}/complete`, { method: 'PATCH' }); await refresh(); }}>Complete</button>}</div>)}
          </div>
        </section>

        <section className="rounded-lg bg-white p-4 shadow space-y-2">
          <h2 className="text-lg font-semibold">Procurement Module</h2>
          {['vehicle_type', 'quantity', 'city', 'expected_arrival_date'].map((k) => <input key={k} className="w-full rounded border p-2" placeholder={k} value={procurementForm[k]} onChange={(e) => setProcurementForm((f) => ({ ...f, [k]: e.target.value }))} />)}
          <button className="rounded bg-purple-600 px-3 py-2 text-white" onClick={async () => { await api('/procurement', { method: 'POST', body: JSON.stringify(procurementForm) }); await refresh(); }}>Add Procurement</button>
          <div className="max-h-40 overflow-auto text-xs space-y-1">
            {procurement.map((p) => <div key={p.id} className="flex items-center justify-between"><span>#{p.id} {p.vehicle_type} x{p.quantity} {p.status}</span>{p.status !== 'RECEIVED' && <button className="rounded bg-slate-700 px-2 py-1 text-white" onClick={async () => { await api(`/procurement/${p.id}/receive`, { method: 'PATCH' }); await refresh(); }}>Mark Received</button>}</div>)}
          </div>
        </section>
      </div>
    </div>
  );
}
