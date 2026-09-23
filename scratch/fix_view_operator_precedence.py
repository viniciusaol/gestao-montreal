import json
import urllib.request

with open('scratch/perfect_view_cash_basis_fix.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Fix line 431: remove "(rf.is_avulsa = true) OR " from unallocated_payments WHERE clause
sql_fixed = sql.replace(
    "WHERE ((rf.paid = true) AND ((rf.is_avulsa = true) OR (NOT (EXISTS ( SELECT 1 FROM final_bookings fb",
    "WHERE ((rf.paid = true) AND (NOT (EXISTS ( SELECT 1 FROM final_bookings fb"
)

with open('scratch/fixed_view_corrected.sql', 'w', encoding='utf-8') as f:
    f.write(sql_fixed)

print("Saved scratch/fixed_view_corrected.sql")
