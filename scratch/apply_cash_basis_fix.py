import json, re

with open('scratch/perfect_view_ecommerce_fix.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Replace fallback_schedule_allocations WHERE condition (sws.exact_match_count = 0) -> remove or adjust so fallback items distribute across schedules
old_fallback_where = "WHERE (sws.exact_match_count = 0)"
new_fallback_where = "-- Removed exact_match_count = 0 to allow unmatched plan items (e.g. prorated tuition) to allocate to customer schedules"

sql_updated = sql.replace(old_fallback_where, new_fallback_where)

with open('scratch/perfect_view_cash_basis_fix.sql', 'w', encoding='utf-8') as f:
    f.write(sql_updated)

print("Saved scratch/perfect_view_cash_basis_fix.sql")
