import json

with open('scratch/step49_clean_no_semi.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Fix b.title to b.description AS title in schedules CTE
sql_fixed = sql.replace("b.title,\n", "b.description AS title,\n")
sql_fixed = sql_fixed.replace("b.title,", "b.description AS title,")

# Add MATERIALIZED hints for performance
sql_fixed = sql_fixed.replace("unique_participants AS (", "unique_participants AS MATERIALIZED (")
sql_fixed = sql_fixed.replace("schedules AS (", "schedules AS MATERIALIZED (")
sql_fixed = sql_fixed.replace("plan_items_raw AS (", "plan_items_raw AS MATERIALIZED (")
sql_fixed = sql_fixed.replace("resolved_faturamento AS (", "resolved_faturamento AS MATERIALIZED (")

# Ensure proper DROP statements
full_sql = """DROP VIEW IF EXISTS public.vw_mt_faturamento_por_hora_ocupada CASCADE;
DROP VIEW IF EXISTS public.vw_mt_comissoes_detalhadas CASCADE;

""" + sql_fixed

with open('scratch/real_step49_business_rules_fixed.sql', 'w', encoding='utf-8') as f:
    f.write(full_sql)

print("Saved scratch/real_step49_business_rules_fixed.sql! Length:", len(full_sql))
