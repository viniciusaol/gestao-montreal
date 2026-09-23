import urllib.request
import json

with open('scratch/perfect_view.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# 1. Include 'Locação' in loose_class_matches category filter for e-commerce avulsas
sql = sql.replace(
    "(fi.categoria = ANY (ARRAY['Aulas'::text, 'Outros'::text]))",
    "(fi.categoria = ANY (ARRAY['Aulas'::text, 'Outros'::text, 'Locação'::text]))"
)

# 2. In fallback_schedule_allocations, remove (sws.exact_match_count = 0) so unmatched items in fallback_plan_totals (like Claudemir/Felipe pro-ratas) allocate to the customer's active schedule
sql = sql.replace(
    "WHERE (sws.exact_match_count = 0)",
    "-- Allow unmatched items in fallback_plan_totals to allocate to active schedules"
)

# 3. Fix Kids Saturday 10h split logic in kids_saturday_split and pre_result
sql = sql.replace(
    "WHERE ((EXTRACT(isodow FROM c.booking_date) = (6)::numeric) AND (c.start_time = '10:00:00'::time without time zone) AND (c.professor = 'Leandro Bonete'::text))",
    "WHERE (c.start_time IS NOT NULL AND (EXTRACT(isodow FROM c.booking_date) = (6)::numeric) AND (c.start_time = '10:00:00'::time without time zone) AND (c.professor = 'Leandro Bonete'::text))"
).replace(
    "WHERE (NOT ((EXTRACT(isodow FROM c.booking_date) = (6)::numeric) AND (c.start_time = '10:00:00'::time without time zone) AND (c.professor = 'Leandro Bonete'::text)))",
    "WHERE (c.start_time IS NULL OR NOT ((EXTRACT(isodow FROM c.booking_date) = (6)::numeric) AND (c.start_time = '10:00:00'::time without time zone) AND (c.professor = 'Leandro Bonete'::text)))"
)

# 4. Update unallocated_payments to accept e-commerce avulsas tagged as Locação if description contains AULA or GRUPO FIXO
sql = sql.replace(
    "((rf.categoria = 'Aulas'::text) OR ((rf.categoria = 'Outros'::text) AND ((rf.description ~~* '%TÊNIS%'::text) OR (rf.description ~~* '%AULA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text)) AND ((rf.description ~~* '%ADULTO%'::text) OR (rf.description ~~* '%KIDS%'::text) OR (rf.description ~~* '%AVULSA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text))))",
    "((rf.categoria = 'Aulas'::text) OR (rf.description ~~* '%AULA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text) OR ((rf.categoria = 'Outros'::text) AND ((rf.description ~~* '%TÊNIS%'::text) OR (rf.description ~~* '%AULA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text)) AND ((rf.description ~~* '%ADULTO%'::text) OR (rf.description ~~* '%KIDS%'::text) OR (rf.description ~~* '%AVULSA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text))))"
)

with open('scratch/perfect_master_view.sql', 'w', encoding='utf-8') as f_out:
    f_out.write(sql)

print("Saved scratch/perfect_master_view.sql successfully")
