import json
import re

with open(r'C:\Users\vinic\.gemini\antigravity-ide\brain\a5ecb53f-0ea1-43ac-85b8-f84be8488a0d\.system_generated\steps\71\output.txt', 'r', encoding='utf-8') as f:
    raw = f.read()

obj = json.loads(raw)
result_val = obj['result']

match = re.search(r'\[\s*\{\s*"pg_get_viewdef"\s*:\s*".*?"\s*\}\s*\]', result_val, re.DOTALL)
if match:
    rows = json.loads(match.group(0))
    view_def = rows[0]['pg_get_viewdef']
    print("Found view_def from step 71. Length:", len(view_def))
    full_sql = f"CREATE OR REPLACE VIEW public.vw_mt_comissoes_detalhadas AS\n{view_def}"
    with open('scratch/original_step71_view.sql', 'w', encoding='utf-8') as f_out:
        f_out.write(full_sql)
    print("Saved scratch/original_step71_view.sql")
else:
    print("No match found in step 71 output.")
