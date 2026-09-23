import json

with open('scratch/optimized_view_test.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Add MATERIALIZED to plan_items
sql_mat = sql.replace("plan_items AS (", "plan_items AS MATERIALIZED (")
sql_mat = sql_mat.replace("target_bookings AS (", "target_bookings AS MATERIALIZED (")

with open('scratch/optimized_view_test_mat.sql', 'w', encoding='utf-8') as f:
    f.write(sql_mat)

print("Saved scratch/optimized_view_test_mat.sql")
