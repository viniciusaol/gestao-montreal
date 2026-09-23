import json
import urllib.request

with open('scratch/perfect_view_fabio_fixed.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

old_bp_block = """                        ( SELECT bp.plan_class_type
                          FROM ( VALUES ('INDIVIDUAL'::text, 720.00), ('DUPLA'::text, 430.00), ('TRIO'::text, 395.00), ('GRUPO'::text, 335.00), ('GRUPO'::text, 245.00) ) bp(plan_class_type, base_value)
                          WHERE abs(COALESCE(rf.valor_bruto, rf.valor_faturamento) - bp.base_value) <= 50.00
                             OR abs(COALESCE(rf.valor_bruto, rf.valor_faturamento) - (2.0 * bp.base_value)) <= 50.00
                          ORDER BY abs(COALESCE(rf.valor_bruto, rf.valor_faturamento) - bp.base_value)
                          LIMIT 1
                        )"""

new_bp_block = """                        ( SELECT bp.plan_class_type
                          FROM ( VALUES ('INDIVIDUAL'::text, 720.00), ('DUPLA'::text, 430.00), ('TRIO'::text, 395.00), ('GRUPO'::text, 335.00), ('GRUPO'::text, 245.00) ) bp(plan_class_type, base_value)
                          WHERE abs(COALESCE(rf.valor_bruto, rf.valor_faturamento) - bp.base_value) <= 150.00
                             OR abs(COALESCE(rf.valor_bruto, rf.valor_faturamento) - (2.0 * bp.base_value)) <= 200.00
                          ORDER BY LEAST(abs(COALESCE(rf.valor_bruto, rf.valor_faturamento) - bp.base_value), abs(COALESCE(rf.valor_bruto, rf.valor_faturamento) - (2.0 * bp.base_value))) ASC
                          LIMIT 1
                        )"""

if old_bp_block in sql:
    sql = sql.replace(old_bp_block, new_bp_block)
    print("Replaced bp block successfully!")
else:
    print("ERROR: old_bp_block not found in sql!")

with open('scratch/perfect_view_fabio_fixed.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

# Also update backups/vw_mt_comissoes_detalhadas.sql
with open('backups/vw_mt_comissoes_detalhadas.sql', 'w', encoding='utf-8') as f_bak:
    f_bak.write(sql)

print("Updated scratch/perfect_view_fabio_fixed.sql and backups/vw_mt_comissoes_detalhadas.sql")
