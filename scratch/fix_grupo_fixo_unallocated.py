import json
import urllib.request
import re

with open('scratch/perfect_view_fabio_fixed.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# 1. Broaden is_avulsa and is_avulsa_grupo_fixo in resolved_faturamento
sql = sql.replace(
    "COALESCE(i.description ~~* '%AULA AVULSA%'::text OR i.subcategoria = 'Avulsa - Grupo Fixo'::text OR i.subcategoria = 'Avulsa - Particular'::text, false) AS is_avulsa",
    "COALESCE(i.description ~~* '%AVULSA%'::text OR i.description ~~* '%GRUPO%FIXO%'::text OR i.subcategoria ~~* '%Avulsa%'::text OR i.subcategoria ~~* '%Grupo Fixo%'::text, false) AS is_avulsa"
).replace(
    "COALESCE(i.description ~~* '%AULA AVULSA - GRUPO FIXO%'::text OR i.subcategoria = 'Avulsa - Grupo Fixo'::text, false) AS is_avulsa_grupo_fixo",
    "COALESCE(i.description ~~* '%GRUPO%FIXO%'::text OR i.subcategoria ~~* '%Grupo Fixo%'::text, false) AS is_avulsa_grupo_fixo"
)

# 2. Allow is_avulsa items in unallocated_payments even if customer has monthly bookings
target_unallocated_where = "WHERE ((rf.paid = true) AND (NOT (EXISTS ( SELECT 1\n                           FROM final_bookings fb\n                          WHERE ((fb.customer_code = rf.customer_code) AND (date_trunc('month'::text, (fb.booking_date)::timestamp without time zone) = date_trunc('month'::text, COALESCE(rf.pay_date, (rf.data_venda)::timestamp without time zone))))))) AND (NOT (EXISTS ( SELECT 1"
replacement_unallocated_where = "WHERE ((rf.paid = true) AND ((rf.is_avulsa = true) OR (NOT (EXISTS ( SELECT 1\n                           FROM final_bookings fb\n                          WHERE ((fb.customer_code = rf.customer_code) AND (date_trunc('month'::text, (fb.booking_date)::timestamp without time zone) = date_trunc('month'::text, COALESCE(rf.pay_date, (rf.data_venda)::timestamp without time zone)))))))) AND (NOT (EXISTS ( SELECT 1"

if target_unallocated_where in sql:
    sql = sql.replace(target_unallocated_where, replacement_unallocated_where)
    print("Replaced unallocated WHERE clause successfully!")
else:
    print("WARNING: target_unallocated_where not found directly, trying regex or partial match!")
    # try single line regex
    pattern = r"WHERE \(\(rf\.paid = true\) AND \(NOT \(EXISTS \( SELECT 1\s+FROM final_bookings fb\s+WHERE \(\(fb\.customer_code = rf\.customer_code\) AND \(date_trunc\('month'::text, \(fb\.booking_date\)::timestamp without time zone\) = date_trunc\('month'::text, COALESCE\(rf\.pay_date, \(rf\.data_venda\)::timestamp without time zone\)\)\)\)\)\)\) AND \(NOT \(EXISTS \( SELECT 1"
    sub_repl = "WHERE ((rf.paid = true) AND ((rf.is_avulsa = true) OR (NOT (EXISTS ( SELECT 1 FROM final_bookings fb WHERE ((fb.customer_code = rf.customer_code) AND (date_trunc('month'::text, (fb.booking_date)::timestamp without time zone) = date_trunc('month'::text, COALESCE(rf.pay_date, (rf.data_venda)::timestamp without time zone)))))))) AND (NOT (EXISTS ( SELECT 1"
    sql, count = re.subn(pattern, sub_repl, sql)
    print(f"Regex replacement count: {count}")

with open('scratch/perfect_view_grupo_fixo_fixed.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

with open('backups/vw_mt_comissoes_detalhadas.sql', 'w', encoding='utf-8') as f_bak:
    f_bak.write(sql)

print("Saved scratch/perfect_view_grupo_fixo_fixed.sql and backups/vw_mt_comissoes_detalhadas.sql")
