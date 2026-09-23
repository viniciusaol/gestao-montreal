import json
import urllib.request

# Read perfect_view.sql
with open('scratch/perfect_view.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Replace the unallocated_payments WHERE condition so that is_avulsa = true items are NOT blocked by final_bookings
old_unallocated_where = """                  WHERE ((rf.paid = true) AND (NOT (EXISTS ( SELECT 1
                           FROM final_bookings fb
                          WHERE ((fb.customer_code = rf.customer_code) AND (date_trunc('month'::text, (fb.booking_date)::timestamp with time zone) = date_trunc('month'::text, COALESCE(rf.pay_date, (rf.data_venda)::timestamp without time zone))))))) AND (NOT (EXISTS ( SELECT 1
                           FROM loose_class_matches lcm
                          WHERE (lcm.item_key = rf.item_key)))))"""

new_unallocated_where = """                  WHERE ((rf.paid = true) AND ((rf.is_avulsa = true) OR (NOT (EXISTS ( SELECT 1
                           FROM final_bookings fb
                          WHERE ((fb.customer_code = rf.customer_code) AND (date_trunc('month'::text, (fb.booking_date)::timestamp with time zone) = date_trunc('month'::text, COALESCE(rf.pay_date, (rf.data_venda)::timestamp without time zone)))))))) AND (NOT (EXISTS ( SELECT 1
                           FROM loose_class_matches lcm
                          WHERE (lcm.item_key = rf.item_key)))))"""

if old_unallocated_where in sql:
    print("Found exact unallocated WHERE block!")
    sql_updated = sql.replace(old_unallocated_where, new_unallocated_where)
else:
    print("Exact block not found by string replace, using regex/sub pattern...")
    import re
    pattern = r"WHERE \(\(rf\.paid = true\) AND \(NOT \(EXISTS \( SELECT 1\s+FROM final_bookings fb"
    replacement = "WHERE ((rf.paid = true) AND ((rf.is_avulsa = true) OR (NOT (EXISTS ( SELECT 1 FROM final_bookings fb"
    sql_updated = re.sub(pattern, replacement, sql)

with open('scratch/perfect_view_updated.sql', 'w', encoding='utf-8') as f:
    f.write(sql_updated)

print("Updated SQL written to scratch/perfect_view_updated.sql")
