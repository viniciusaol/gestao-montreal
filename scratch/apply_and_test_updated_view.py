import json
import urllib.request
import re

# Read perfect_view.sql
with open('scratch/perfect_view.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Make is_avulsa and is_avulsa_grupo_fixo regex replacement in resolved_faturamento
sql = sql.replace(
    "COALESCE(i.description ~~* '%AULA AVULSA%'::text OR i.subcategoria = 'Avulsa - Grupo Fixo'::text OR i.subcategoria = 'Avulsa - Particular'::text, false) AS is_avulsa",
    "COALESCE(i.description ~~* '%AVULSA%'::text OR i.description ~~* '%GRUPO%FIXO%'::text OR i.subcategoria ~~* '%Avulsa%'::text OR i.subcategoria ~~* '%Grupo Fixo%'::text, false) AS is_avulsa"
).replace(
    "COALESCE(i.description ~~* '%AULA AVULSA - GRUPO FIXO%'::text OR i.subcategoria = 'Avulsa - Grupo Fixo'::text, false) AS is_avulsa_grupo_fixo",
    "COALESCE(i.description ~~* '%GRUPO%FIXO%'::text OR i.subcategoria ~~* '%Grupo Fixo%'::text, false) AS is_avulsa_grupo_fixo"
)

# Update unallocated_payments WHERE clause so is_avulsa items flow to unallocated_payments even if customer has bookings
old_where_pattern = r"WHERE \(\(rf\.paid = true\) AND \(NOT \(EXISTS \( SELECT 1\s+FROM final_bookings fb"
new_where_replacement = "WHERE ((rf.paid = true) AND ((rf.is_avulsa = true) OR (NOT (EXISTS ( SELECT 1 FROM final_bookings fb"

sql = re.sub(old_where_pattern, new_where_replacement, sql)

with open('scratch/perfect_view_final.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

print("Saved scratch/perfect_view_final.sql")
