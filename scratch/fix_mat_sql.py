import json

with open('scratch/optimized_view_test_mat.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

sql_fixed = sql.replace("plan_items.total_comissao_base_monthly", "plan_items.valor_bruto_monthly")

with open('scratch/optimized_view_test_mat_fixed.sql', 'w', encoding='utf-8') as f:
    f.write(sql_fixed)

print("Saved scratch/optimized_view_test_mat_fixed.sql")
