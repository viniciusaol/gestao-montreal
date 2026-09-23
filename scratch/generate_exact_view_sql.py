import json
import re

with open(r'C:\Users\vinic\.gemini\antigravity-ide\brain\a5ecb53f-0ea1-43ac-85b8-f84be8488a0d\.system_generated\steps\105\output.txt', 'r', encoding='utf-8') as f:
    raw = f.read()

data = json.loads(raw)
res_str = data['result']
print("res_str length:", len(res_str))
print("First 200 chars of res_str:", repr(res_str[:200]))

# find substring starting with [{"view_definition"
pos = res_str.find('[{"view_definition":')
print("pos:", pos)
if pos != -1:
    end_pos = res_str.rfind('}]') + 2
    view_json = res_str[pos:end_pos]
    parsed = json.loads(view_json)
    view_def = parsed[0]['view_definition']
    print("Parsed view_def successfully! Length:", len(view_def))

    new_view_def = view_def.replace(
        "WHEN (fi.description ~~* '%Leandro Bonete%'::text) THEN 'Leandro Bonete'::text",
        "WHEN ((fi.description ~~* '%Leandro Bonete%'::text) OR (fi.description ~~* '%Leandro B.%'::text) OR (fi.description ~~* '%Leandro%'::text)) THEN 'Leandro Bonete'::text"
    ).replace(
        "WHEN (b.description ~~* '%Leandro Bonete%'::text) THEN 'Leandro Bonete'::text",
        "WHEN ((b.description ~~* '%Leandro Bonete%'::text) OR (b.description ~~* '%Leandro B.%'::text) OR (b.description ~~* '%Leandro%'::text)) THEN 'Leandro Bonete'::text"
    ).replace(
        "WHEN (b_sub.description ~~* '%Leandro Bonete%'::text) THEN 'Leandro Bonete'::text",
        "WHEN ((b_sub.description ~~* '%Leandro Bonete%'::text) OR (b_sub.description ~~* '%Leandro B.%'::text) OR (b_sub.description ~~* '%Leandro%'::text)) THEN 'Leandro Bonete'::text"
    ).replace(
        "WHEN (rf.description ~~* '%Leandro Bonete%'::text) THEN 'Leandro Bonete'::text",
        "WHEN ((rf.description ~~* '%Leandro Bonete%'::text) OR (rf.description ~~* '%Leandro B.%'::text) OR (rf.description ~~* '%Leandro%'::text)) THEN 'Leandro Bonete'::text"
    )

    sql = f"CREATE OR REPLACE VIEW public.vw_mt_comissoes_detalhadas AS\n{new_view_def}"

    with open('scratch/exact_update_view.sql', 'w', encoding='utf-8') as f_out:
        f_out.write(sql)

    print("Saved scratch/exact_update_view.sql successfully.")
