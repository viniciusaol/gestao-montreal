import json

with open(r'C:\Users\vinic\.gemini\antigravity-ide\brain\a5ecb53f-0ea1-43ac-85b8-f84be8488a0d\.system_generated\steps\49\output.txt', 'r', encoding='utf-8') as f:
    raw = f.read()

data = json.loads(raw)
res_str = data['result']

pos = res_str.find('[{"view_definition":')
end_pos = res_str.rfind('}]') + 2
view_json = res_str[pos:end_pos]
parsed = json.loads(view_json)
def_str = parsed[0]['view_definition']

print(f"Original view def length: {len(def_str)}")

outer_select_idx = def_str.rfind(' SELECT view_base.booking_id,')

base_cte_part = def_str[:outer_select_idx]

final_sql = f"""CREATE OR REPLACE VIEW public.vw_mt_comissoes_detalhadas AS
{base_cte_part}
 SELECT view_base.booking_id,
    view_base.booking_date,
    view_base.booking_type,
    view_base.start_time,
    view_base.venue,
    view_base.resource_name,
    view_base.description,
    view_base.professor,
    view_base.customer_code,
    view_base.participant_name,
    view_base.payment_value AS booking_value,
    view_base.payment_value_comissao AS booking_commission_base,
    view_base.is_socio AS is_socio_benefit,
    view_base.is_paid,
    view_base.pay_date,
    view_base.schedule_monthly_value_monthly AS booking_value_monthly,
    view_base.schedule_monthly_commission_base_monthly AS booking_commission_base_monthly,
    view_base.is_avulsa,
    view_base.is_avulsa_grupo_fixo
   FROM view_base;"""

with open('scratch/exact_original_restore.sql', 'w', encoding='utf-8') as f_out:
    f_out.write(final_sql)

print("Generated scratch/exact_original_restore.sql successfully.")
