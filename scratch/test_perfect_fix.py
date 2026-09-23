import urllib.request
import json

with open('scratch/perfect_view.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# 1. Update e-commerce category filter in loose_class_matches to include 'Locação'
sql = sql.replace(
    "(fi.categoria = ANY (ARRAY['Aulas'::text, 'Outros'::text]))",
    "(fi.categoria = ANY (ARRAY['Aulas'::text, 'Outros'::text, 'Locação'::text]))"
)

# 2. Update plan_class_type COALESCE to fallback to customer's schedule class type before defaulting to 'GRUPO'
old_coalesce_end = "'GRUPO'::text\n                    ) AS plan_class_type"
new_coalesce_end = """( SELECT s_cust.booking_class_type
                           FROM schedules s_cust
                          WHERE ((s_cust.customer_code = rf.customer_code) AND (s_cust.plan_month = (date_trunc('month'::text, COALESCE(rf.pay_date, (rf.data_venda)::timestamp without time zone)))::date))
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
