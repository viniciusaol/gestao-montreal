import json

with open(r'C:\Users\vinic\.gemini\antigravity-ide\brain\a5ecb53f-0ea1-43ac-85b8-f84be8488a0d\.system_generated\steps\49\output.txt', 'r', encoding='utf-8') as f:
    data = json.load(f)

res = data['result']
pos = res.find('[{"view_definition"')
end_pos = res.rfind('}]') + 2
view_json = res[pos:end_pos]
parsed = json.loads(view_json)
def_str = parsed[0]['view_definition'].strip()

if def_str.endswith(';'):
    def_str = def_str[:-1].strip()

full_sql = f"CREATE OR REPLACE VIEW public.vw_mt_comissoes_detalhadas AS\n{def_str}"

with open('scratch/no_semi_view.sql', 'w', encoding='utf-8') as f_out:
    f_out.write(full_sql)

print("Saved scratch/no_semi_view.sql. Ends with:", repr(full_sql[-50:]))
