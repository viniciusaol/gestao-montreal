with open('scratch/fixed_current_view_2.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

fixed_sql = sql.replace(
    'pre_result.booking_value / 2::numeric',
    'pre_result.payment_value / 2::numeric'
).replace(
    'pre_result.booking_commission_base / 2::numeric',
    'pre_result.payment_value_comissao / 2::numeric'
).replace(
    'ELSE pre_result.booking_value\n',
    'ELSE pre_result.payment_value\n'
).replace(
    'ELSE pre_result.booking_commission_base\n',
    'ELSE pre_result.payment_value_comissao\n'
).replace(
    'pre_result.booking_value AS booking_value',
    'pre_result.payment_value AS booking_value'
).replace(
    'pre_result.booking_commission_base AS booking_commission_base',
    'pre_result.payment_value_comissao AS booking_commission_base'
)

with open('scratch/fixed_current_view_3.sql', 'w', encoding='utf-8') as f_out:
    f_out.write(fixed_sql)

print("Saved scratch/fixed_current_view_3.sql")
