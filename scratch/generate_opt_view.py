import json

with open(r'C:\Users\vinic\.gemini\antigravity-ide\brain\a5ecb53f-0ea1-43ac-85b8-f84be8488a0d\.system_generated\steps\544\output.txt', 'r', encoding='utf-8') as f:
    data = json.load(f)

res = data['result']
parsed = json.loads(res.split('<untrusted-data-5964efc6-20ec-4642-a510-1a9c2c5e5c74>\n')[1].split('\n</untrusted-data-5964efc6-20ec-4642-a510-1a9c2c5e5c74>')[0])

vdef = parsed[0]['pg_get_viewdef']

# Replace the correlated subquery scanning mt_booking_participantes with unique_participants
old_sub = "COALESCE(( SELECT DISTINCT p.customer_code\n                   FROM mt_booking_participantes p\n                  WHERE p.participant_name IS NOT NULL AND length(p.participant_name) > 5 AND i.description ~~* (('%'::text || p.participant_name) || '%'::text)\n                 LIMIT 1), v.customer_code)"

new_sub = "COALESCE(( SELECT p.customer_code\n                   FROM unique_participants p\n                  WHERE i.description ~~* (('%'::text || p.participant_name) || '%'::text)\n                 LIMIT 1), v.customer_code)"

print("Old sub in vdef:", old_sub in vdef)
vdef_opt = vdef.replace(old_sub, new_sub)

# Also ensure unique_participants CTE exists at the beginning of vdef_opt
if "unique_participants AS" not in vdef_opt:
    vdef_opt = "WITH unique_participants AS MATERIALIZED (\n    SELECT DISTINCT ON (participant_name) participant_name, customer_code\n    FROM mt_booking_participantes\n    WHERE participant_name IS NOT NULL AND length(participant_name) > 5\n),\n" + vdef_opt[vdef_opt.find("target_bookings AS"):].strip()
    if not vdef_opt.startswith("WITH"):
        vdef_opt = "WITH " + vdef_opt

full_sql = "CREATE OR REPLACE VIEW public.vw_mt_comissoes_detalhadas AS\n" + vdef_opt

with open('scratch/optimized_view_test.sql', 'w', encoding='utf-8') as f:
    f.write(full_sql)

print("Generated scratch/optimized_view_test.sql! Length:", len(full_sql))
