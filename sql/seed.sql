INSERT INTO vehicles (registration_number, vehicle_type, make_model, city, status)
VALUES
('KA01AB1234', '3W', 'Bajaj RE', 'Bengaluru', 'AVAILABLE'),
('KA01AB5678', '4W', 'Tata Ace EV', 'Bengaluru', 'AVAILABLE'),
('MH02CD1111', '3W', 'Mahindra Treo', 'Mumbai', 'DEPLOYED')
ON CONFLICT (registration_number) DO NOTHING;

INSERT INTO demand (client_name, city, vehicle_type, quantity_required, start_date, deployment_deadline, status)
VALUES
('Client A', 'Bengaluru', '3W', 5, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 day', 'OPEN'),
('Client B', 'Mumbai', '4W', 3, CURRENT_DATE, CURRENT_DATE + INTERVAL '5 day', 'PARTIAL')
ON CONFLICT DO NOTHING;
