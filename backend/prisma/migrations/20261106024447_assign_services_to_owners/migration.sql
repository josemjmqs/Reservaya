-- Asigna todos los servicios existentes a los dueños de cada negocio
INSERT INTO "MemberService" ("memberId", "serviceId")
SELECT m.id, s.id
FROM "Member" m
JOIN "Service" s ON s."businessId" = m."businessId"
WHERE m.role = 'OWNER'
ON CONFLICT DO NOTHING;