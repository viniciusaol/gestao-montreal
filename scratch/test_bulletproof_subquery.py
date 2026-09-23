import urllib.request
import json

with open('scratch/perfect_view.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# 1. Update e-commerce category filter in loose_class_matches to include 'Locação'
sql = sql.replace(
    "(fi.categoria = ANY (ARRAY['Aulas'::text, 'Outros'::text]))",
    "(fi.categoria = ANY (ARRAY['Aulas'::text, 'Outros'::text, 'Locação'::text]))"
)

# 2. Update plan_class_type COALESCE to fallback to customer's active schedule class type from mt_bookings
old_coalesce_end = "'GRUPO'::text\n                    ) AS plan_class_type"
new_coalesce_end = """( SELECT CASE
                             WHEN (b_sub.description ~ '\\(\\s*\\d+\\s*/\\s*1\\s*\\)'::text) THEN 'INDIVIDUAL'::text
                             WHEN (b_sub.description ~ '\\(\\s*\\d+\\s*/\\s*2\\s*\\)'::text) THEN 'DUPLA'::text
                             WHEN (b_sub.description ~ '\\(\\s*\\d+\\s*/\\s*3\\s*\\)'::text) THEN 'TRIO'::text
                             WHEN (b_sub.description ~ '\\(\\s*\\d+\\s*/\\s*[456789]\\d*\\s*\\)'::text) THEN 'GRUPO'::text
                             ELSE 'GRUPO'::text
                           END
                         FROM (mt_booking_participantes p_sub
                           JOIN mt_bookings b_sub ON ((b_sub.booking_id = p_sub.booking_id)))
                        WHERE ((p_sub.customer_code = rf.customer_code) AND (b_sub.status = 'ACTIVE'::text) AND (b_sub.booking_type = 'clase_colectiva'::text))
                       LIMIT 1),
                        'GRUPO'::text
                    ) AS plan_class_type"""

sql = sql.replace(old_coalesce_end, new_coalesce_end)

# 3. Update Kids Saturday 10h split logic in kids_saturday_split and pre_result
sql = sql.replace(
    "WHERE ((EXTRACT(isodow FROM c.booking_date) = (6)::numeric) AND (c.start_time = '10:00:00'::time without time zone) AND (c.professor = 'Leandro Bonete'::text))",
    "WHERE (c.start_time IS NOT NULL AND (EXTRACT(isodow FROM c.booking_date) = (6)::numeric) AND (c.start_time = '10:00:00'::time without time zone) AND (c.professor = 'Leandro Bonete'::text))"
).replace(
    "WHERE (NOT ((EXTRACT(isodow FROM c.booking_date) = (6)::numeric) AND (c.start_time = '10:00:00'::time without time zone) AND (c.professor = 'Leandro Bonete'::text)))",
    "WHERE (c.start_time IS NULL OR NOT ((EXTRACT(isodow FROM c.booking_date) = (6)::numeric) AND (c.start_time = '10:00:00'::time without time zone) AND (c.professor = 'Leandro Bonete'::text)))"
)

# 4. Update unallocated_payments to include e-commerce avulsas tagged as Locação if description has AULA or GRUPO FIXO
sql = sql.replace(
    "((rf.categoria = 'Aulas'::text) OR ((rf.categoria = 'Outros'::text) AND ((rf.description ~~* '%TÊNIS%'::text) OR (rf.description ~~* '%AULA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text)) AND ((rf.description ~~* '%ADULTO%'::text) OR (rf.description ~~* '%KIDS%'::text) OR (rf.description ~~* '%AVULSA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text))))",
    "((rf.categoria = 'Aulas'::text) OR (rf.description ~~* '%AULA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text) OR ((rf.categoria = 'Outros'::text) AND ((rf.description ~~* '%TÊNIS%'::text) OR (rf.description ~~* '%AULA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text)) AND ((rf.description ~~* '%ADULTO%'::text) OR (rf.description ~~* '%KIDS%'::text) OR (rf.description ~~* '%AVULSA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text))))"
)

with open('scratch/perfect_view_bulletproof.sql', 'w', encoding='utf-8') as f_out:
    f_out.write(sql)

print("Saved scratch/perfect_view_bulletproof.sql successfully")
