import json, re

with open('scratch/perfect_view_final.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Replace the saturday split WHERE clauses to handle NULL start_time properly
old_split_where = "WHERE ((EXTRACT(isodow FROM c.booking_date) = (6)::numeric) AND (c.start_time = '10:00:00'::time without time zone) AND (c.professor = 'Leandro Bonete'::text))"
new_split_where = "WHERE (c.start_time IS NOT NULL AND (EXTRACT(isodow FROM c.booking_date) = (6)::numeric) AND (c.start_time = '10:00:00'::time without time zone) AND (c.professor = 'Leandro Bonete'::text))"

old_not_split_where = "WHERE (NOT ((EXTRACT(isodow FROM c.booking_date) = (6)::numeric) AND (c.start_time = '10:00:00'::time without time zone) AND (c.professor = 'Leandro Bonete'::text)))"
new_not_split_where = "WHERE (c.start_time IS NULL OR NOT ((EXTRACT(isodow FROM c.booking_date) = (6)::numeric) AND (c.start_time = '10:00:00'::time without time zone) AND (c.professor = 'Leandro Bonete'::text)))"

sql_updated = sql.replace(old_split_where, new_split_where).replace(old_not_split_where, new_not_split_where)

with open('scratch/perfect_view_final_saturday_fix.sql', 'w', encoding='utf-8') as f:
    f.write(sql_updated)

print("Saturday split fix written to scratch/perfect_view_final_saturday_fix.sql")
