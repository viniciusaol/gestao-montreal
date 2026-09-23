import json

with open(r'C:\Users\vinic\.gemini\antigravity-ide\brain\a5ecb53f-0ea1-43ac-85b8-f84be8488a0d\.system_generated\steps\71\output.txt', 'r', encoding='utf-8') as f:
    raw = f.read()

obj = json.loads(raw)
result_val = obj['result']
# result_val has "<untrusted-data-xxx>\n[{\"pg_get_viewdef\":\"...\"}]\n</untrusted-data-xxx>"
import re
match = re.search(r'\[\s*\{\s*"pg_get_viewdef"\s*:\s*".*?"\s*\}\s*\]', result_val, re.DOTALL)
if match:
    rows = json.loads(match.group(0))
    view_def = rows[0]['pg_get_viewdef']
    print(f"Success! Length: {len(view_def)}")

    new_view_def = view_def.replace(
        "fi.description ~~* '%Leandro Bonete%'::text",
        "(fi.description ~~* '%Leandro Bonete%'::text OR fi.description ~~* '%Leandro B.%'::text OR fi.description ~~* '%Leandro%'::text)"
    ).replace(
        "b.description ~~* '%Leandro Bonete%'::text",
        "(b.description ~~* '%Leandro Bonete%'::text OR b.description ~~* '%Leandro B.%'::text OR b.description ~~* '%Leandro%'::text)"
    ).replace(
        "b_sub.description ~~* '%Leandro Bonete%'::text",
        "(b_sub.description ~~* '%Leandro Bonete%'::text OR b_sub.description ~~* '%Leandro B.%'::text OR b_sub.description ~~* '%Leandro%'::text)"
    ).replace(
        "rf.description ~~* '%Leandro Bonete%'::text",
        "(rf.description ~~* '%Leandro Bonete%'::text OR rf.description ~~* '%Leandro B.%'::text OR rf.description ~~* '%Leandro%'::text)"
    )

    sql = f"CREATE OR REPLACE VIEW public.vw_mt_comissoes_detalhadas AS\n{new_view_def}"
    with open('scratch/update_view.sql', 'w', encoding='utf-8') as f_out:
        f_out.write(sql)
    print("Saved scratch/update_view.sql successfully.")
else:
    print("Regex match failed. Print sample:")
    print(result_val[:200])
