import json

with open(r'C:\Users\vinic\.gemini\antigravity-ide\brain\a5ecb53f-0ea1-43ac-85b8-f84be8488a0d\.system_generated\steps\276\output.txt', 'r', encoding='utf-8') as f:
    data = json.load(f)

res = data['result']
pos = res.find('[{"pg_get_viewdef"')
end_pos = res.rfind('}]') + 2
view_json = res[pos:end_pos]
parsed = json.loads(view_json)
def_str = parsed[0]['pg_get_viewdef']

full_sql = f"CREATE OR REPLACE VIEW public.vw_mt_faturamento_por_hora_ocupada AS\n{def_str}"

with open('scratch/restore_faturamento_por_hora_ocupada.sql', 'w', encoding='utf-8') as f_out:
    f_out.write(full_sql)

print("Saved dependent view definition to scratch/restore_faturamento_por_hora_ocupada.sql")
