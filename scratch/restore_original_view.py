import json
import re

with open(r'C:\Users\vinic\.gemini\antigravity-ide\brain\a5ecb53f-0ea1-43ac-85b8-f84be8488a0d\.system_generated\steps\49\output.txt', 'r', encoding='utf-8') as f:
    raw = f.read()

data = json.loads(raw)
res_str = data['result']

pos = res_str.find('[{"view_definition":')
if pos != -1:
    end_pos = res_str.rfind('}]') + 2
    view_json = res_str[pos:end_pos]
    parsed = json.loads(view_json)
    original_view_def = parsed[0]['view_definition']
    print("Parsed original view_def successfully! Length:", len(original_view_def))

    sql = f"CREATE OR REPLACE VIEW public.vw_mt_comissoes_detalhadas AS\n{original_view_def}"

    with open('scratch/restore_original_view.sql', 'w', encoding='utf-8') as f_out:
        f_out.write(sql)

    print("Saved scratch/restore_original_view.sql successfully.")
else:
    print("Failed to find view definition in step 49 output.")
