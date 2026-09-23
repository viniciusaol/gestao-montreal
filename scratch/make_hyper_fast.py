import json

with open('scratch/optimized_view_ultra_fast.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Replace booking_ranged_values CTE to remove redundant JOIN target_bookings
old_brv = """), booking_ranged_values AS (
         SELECT tb.booking_id,
            tb.customer_code,
                CASE
                    WHEN pi.paid = pi.has_paid_plan THEN pi.valor_faturamento / NULLIF(pirc.bookings_in_range, 0)::numeric
                    ELSE 0::numeric
                END AS booking_value,
                CASE
                    WHEN pi.paid = pi.has_paid_plan THEN
                    CASE
                        WHEN pi.is_socio THEN pi.valor_bruto
                        ELSE pi.valor_faturamento
                    END / NULLIF(pirc.bookings_in_range, 0)::numeric
                    ELSE 0::numeric
                END AS booking_commission_base,
                CASE
                    WHEN pi.paid = pi.has_paid_plan THEN pi.valor_faturamento_monthly / NULLIF(pirc.bookings_in_range, 0)::numeric
                    ELSE 0::numeric
                END AS booking_value_monthly,
                CASE
                    WHEN pi.paid = pi.has_paid_plan THEN
                    CASE
                        WHEN pi.is_socio THEN pi.valor_bruto_monthly
                        ELSE pi.valor_faturamento_monthly
                    END / NULLIF(pirc.bookings_in_range, 0)::numeric
                    ELSE 0::numeric
                END AS booking_commission_base_monthly,
            pi.is_socio,
            pi.paid AS is_paid,
            pi.pay_date,
            pi.is_avulsa AS has_avulsa,
            pi.is_avulsa_grupo_fixo AS has_avulsa_grupo_fixo
           FROM booking_plan_priority bpp
             JOIN plan_items pi ON pi.item_key = bpp.item_key
             JOIN target_bookings tb ON tb.booking_id = bpp.booking_id AND tb.customer_code = bpp.customer_code
             JOIN plan_item_ranged_counts pirc ON pirc.item_key = bpp.item_key AND pirc.customer_code = bpp.customer_code
          WHERE bpp.rn = 1
        ),"""

new_brv = """), booking_ranged_values AS (
         SELECT bpp.booking_id,
            bpp.customer_code,
                CASE
                    WHEN pi.paid = pi.has_paid_plan THEN pi.valor_faturamento / NULLIF(pirc.bookings_in_range, 0)::numeric
                    ELSE 0::numeric
                END AS booking_value,
                CASE
                    WHEN pi.paid = pi.has_paid_plan THEN
                    CASE
                        WHEN pi.is_socio THEN pi.valor_bruto
                        ELSE pi.valor_faturamento
                    END / NULLIF(pirc.bookings_in_range, 0)::numeric
                    ELSE 0::numeric
                END AS booking_commission_base,
                CASE
                    WHEN pi.paid = pi.has_paid_plan THEN pi.valor_faturamento_monthly / NULLIF(pirc.bookings_in_range, 0)::numeric
                    ELSE 0::numeric
                END AS booking_value_monthly,
                CASE
                    WHEN pi.paid = pi.has_paid_plan THEN
                    CASE
                        WHEN pi.is_socio THEN pi.valor_bruto_monthly
                        ELSE pi.valor_faturamento_monthly
                    END / NULLIF(pirc.bookings_in_range, 0)::numeric
                    ELSE 0::numeric
                END AS booking_commission_base_monthly,
            pi.is_socio,
            pi.paid AS is_paid,
            pi.pay_date,
            pi.is_avulsa AS has_avulsa,
            pi.is_avulsa_grupo_fixo AS has_avulsa_grupo_fixo
           FROM booking_plan_priority bpp
             JOIN plan_items pi ON pi.item_key = bpp.item_key
             JOIN plan_item_ranged_counts pirc ON pirc.item_key = bpp.item_key AND pirc.customer_code = bpp.customer_code
          WHERE bpp.rn = 1
        ),"""

print("old_brv in sql:", old_brv in sql)
sql_hyper = sql.replace(old_brv, new_brv)

with open('scratch/optimized_view_hyper_fast.sql', 'w', encoding='utf-8') as f:
    f.write(sql_hyper)

print("Saved scratch/optimized_view_hyper_fast.sql")
