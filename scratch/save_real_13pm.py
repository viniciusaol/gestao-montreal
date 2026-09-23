import json

with open(r'C:\Users\vinic\.gemini\antigravity-ide\brain\a5ecb53f-0ea1-43ac-85b8-f84be8488a0d\.system_generated\steps\49\output.txt', 'r', encoding='utf-8') as f:
    data = json.load(f)

res = data['result']
pos = res.find('[{"view_definition"')
end_pos = res.rfind('}]') + 2
view_json = res[pos:end_pos]
parsed = json.loads(view_json)

vdef = parsed[0]['view_definition'].strip()
if vdef.endswith(';'):
    vdef = vdef[:-1].strip()

full_sql = f"CREATE OR REPLACE VIEW public.vw_mt_comissoes_detalhadas AS\n{vdef}"

with open('scratch/real_13pm_original_view.sql', 'w', encoding='utf-8') as f_out:
    f_out.write(full_sql)

print("Saved scratch/real_13pm_original_view.sql successfully! Length:", len(full_sql))
print("Start:", full_sql[:200])
print("End:", full_sql[-200:])
