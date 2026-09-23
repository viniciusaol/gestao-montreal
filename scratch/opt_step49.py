import json

with open('scratch/step49_clean_no_semi.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Add MATERIALIZED to heavy CTEs in step49
sql_opt = sql.replace("schedules AS (", "schedules AS MATERIALIZED (")
sql_opt = sql_opt.replace("plan_items_raw AS (", "plan_items_raw AS MATERIALIZED (")
sql_opt = sql_opt.replace("resolved_faturamento AS (", "resolved_faturamento AS MATERIALIZED (")

with open('scratch/step49_opt.sql', 'w', encoding='utf-8') as f:
    f.write(sql_opt)

print("Saved scratch/step49_opt.sql")
