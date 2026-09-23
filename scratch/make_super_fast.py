import json

with open('scratch/optimized_view_test_mat_fixed.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Pre-filter plan_items in booking_plan_priority
old_bpp = """), booking_plan_priority AS (
         SELECT tb.booking_id,
            tb.customer_code,
            pi.item_key,
            row_number() OVER (PARTITION BY tb.booking_id, tb.customer_code ORDER BY pi.item_start_date DESC, (abs(pi.valor_bruto / NULLIF((pi.item_end_date - pi.item_start_date + 1)::numeric, 0::numeric) * 30::numeric -
                CASE tb.booking_class_type
                    WHEN 'INDIVIDUAL'::text THEN 720
                    WHEN 'DUPLA'::text THEN 430
                    WHEN 'TRIO'::text THEN 395
                    ELSE 335
                END::numeric))) AS rn
           FROM target_bookings tb
             JOIN plan_items pi ON pi.customer_code = tb.customer_code AND tb.booking_date >= pi.item_start_date AND tb.booking_date <= pi.item_end_date
          WHERE tb.booking_type = 'clase_colectiva'::text AND pi.item_start_date IS NOT NULL
        ),"""

new_bpp = """), booking_plan_priority AS (
         SELECT tb.booking_id,
            tb.customer_code,
            pi.item_key,
            row_number() OVER (PARTITION BY tb.booking_id, tb.customer_code ORDER BY pi.item_start_date DESC, (abs(pi.valor_bruto / NULLIF((pi.item_end_date - pi.item_start_date + 1)::numeric, 0::numeric) * 30::numeric -
                CASE tb.booking_class_type
                    WHEN 'INDIVIDUAL'::text THEN 720
                    WHEN 'DUPLA'::text THEN 430
                    WHEN 'TRIO'::text THEN 395
                    ELSE 335
                END::numeric))) AS rn
           FROM target_bookings tb
             JOIN (SELECT * FROM plan_items WHERE item_start_date IS NOT NULL) pi ON pi.customer_code = tb.customer_code AND tb.booking_date >= pi.item_start_date AND tb.booking_date <= pi.item_end_date
          WHERE tb.booking_type = 'clase_colectiva'::text
        ),"""

print("old_bpp in sql:", old_bpp in sql)
sql_fast = sql.replace(old_bpp, new_bpp)

with open('scratch/optimized_view_super_fast.sql', 'w', encoding='utf-8') as f:
    f.write(sql_fast)

print("Saved scratch/optimized_view_super_fast.sql")
