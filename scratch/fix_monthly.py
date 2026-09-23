with open('scratch/fixed_current_view_3.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

fixed_sql = sql.replace(
    'pre_result.booking_value_monthly,',
    'pre_result.schedule_monthly_value_monthly AS booking_value_monthly,'
).replace(
    'pre_result.booking_commission_base_monthly,',
    'pre_result.schedule_monthly_commission_base_monthly AS booking_commission_base_monthly,'
)

with open('scratch/fixed_current_view_4.sql', 'w', encoding='utf-8') as f_out:
    f_out.write(fixed_sql)

print("Saved scratch/fixed_current_view_4.sql")
