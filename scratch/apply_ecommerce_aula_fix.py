import json, re

# Read current perfect_view_final_saturday_fix.sql
with open('scratch/perfect_view_final_saturday_fix.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Update loose_class_matches categoria filter to include items with description LIKE '%AULA%'
sql = sql.replace(
    "(fi.categoria = ANY (ARRAY['Aulas'::text, 'Outros'::text]))",
    "(fi.categoria = ANY (ARRAY['Aulas'::text, 'Outros'::text, 'Locação'::text]))"
)

# Update unallocated_payments categoria filter to accept items with description LIKE '%AULA%' even if categoria is 'Locação'
old_unalloc_cat_filter = "AND ((rf.categoria = 'Aulas'::text) OR ((rf.categoria = 'Outros'::text) AND ((rf.description ~~* '%TÊNIS%'::text) OR (rf.description ~~* '%AULA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text)) AND ((rf.description ~~* '%ADULTO%'::text) OR (rf.description ~~* '%KIDS%'::text) OR (rf.description ~~* '%AVULSA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text)))))"

new_unalloc_cat_filter = "AND ((rf.categoria = 'Aulas'::text) OR (rf.description ~~* '%AULA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text) OR ((rf.categoria = 'Outros'::text) AND ((rf.description ~~* '%TÊNIS%'::text) OR (rf.description ~~* '%AULA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text)) AND ((rf.description ~~* '%ADULTO%'::text) OR (rf.description ~~* '%KIDS%'::text) OR (rf.description ~~* '%AVULSA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text)))))"

sql = sql.replace(old_unalloc_cat_filter, new_unalloc_cat_filter)

with open('scratch/perfect_view_ecommerce_fix.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

print("Saved scratch/perfect_view_ecommerce_fix.sql")
