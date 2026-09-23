import json

# Read output.txt JSON directly
with open(r"C:\Users\vinic\.gemini\antigravity-ide\brain\a5ecb53f-0ea1-43ac-85b8-f84be8488a0d\.system_generated\steps\2689\output.txt", "r", encoding="utf-8") as f:
    data = json.load(f)

# data["result"] contains markdown + JSON snippet:
raw_result = data["result"]
json_str = raw_result.split("[{\"view_definition\":\"")[1].split("\"}]")[0]
# json_str has escaped quotes and newlines like \n
# Let's wrap in JSON array string to decode safely with json.loads
decoded_view_def = json.loads('"' + json_str + '"')

target = """                ), resolved_faturamento AS MATERIALIZED (
                 SELECT i.item_key,
                        CASE
                            WHEN ((v.customer_code IS NOT NULL) AND (v.customer_code <> ''::text)) THEN v.customer_code
                            ELSE COALESCE(( SELECT p_1.customer_code
                               FROM unique_participants p_1
                              WHERE (i.description ~~* (('%'::text || p_1.participant_name) || '%'::text))
                             LIMIT 1), v.customer_code)
                        END AS customer_code,"""

replacement = """                ), resolved_faturamento AS MATERIALIZED (
                 SELECT i.item_key,
                        COALESCE(
                            CASE
                                WHEN (i.categoria = 'Aulas'::text OR i.description ~~* '%AULA%'::text OR i.description ~~* '%TÊNIS%'::text OR i.description ~~* '%KIDS%'::text) THEN
                                    (SELECT p_1.customer_code FROM unique_participants p_1 WHERE (i.description ~~* (('%'::text || p_1.participant_name) || '%'::text)) LIMIT 1)
                                ELSE NULL::text
                            END,
                            v.customer_code
                        ) AS customer_code,"""

if target in decoded_view_def:
    print("Found target string with perfect encoding!")
    new_view_sql = "CREATE OR REPLACE VIEW public.vw_mt_comissoes_detalhadas AS\n" + decoded_view_def.replace(target, replacement)
    with open("scratch/fixed_live_view.sql", "w", encoding="utf-8") as f_out:
        f_out.write(new_view_sql)
    print("Saved scratch/fixed_live_view.sql successfully!")
else:
    print("Target string NOT found! Let's print snippet:")
    idx = decoded_view_def.find("resolved_faturamento")
    print(repr(decoded_view_def[idx-50:idx+300]))
