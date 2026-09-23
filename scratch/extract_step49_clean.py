import json

with open(r'C:\Users\vinic\.gemini\antigravity-ide\brain\a5ecb53f-0ea1-43ac-85b8-f84be8488a0d\.system_generated\steps\49\output.txt', 'r', encoding='utf-8') as f:
    data = json.load(f)

res = data['result']
print("Length of result:", len(res))

parsed = json.loads(res.split('<untrusted-data-e5882312-2471-4814-b785-16c0d752e470>\n')[1].split('\n</untrusted-data-e5882312-2471-4814-b785-16c0d752e470>')[0])

print("Number of items in step 49 output:", len(parsed))
for i, item in enumerate(parsed):
    print(f"Item {i} keys:", list(item.keys()))
    print(f"Item {i} view_definition len:", len(item.get('view_definition', '')))

with open('scratch/step49_exact_view_definition.sql', 'w', encoding='utf-8') as f_out:
    f_out.write("CREATE OR REPLACE VIEW public.vw_mt_comissoes_detalhadas AS\n" + parsed[0]['view_definition'].strip())

print("Saved scratch/step49_exact_view_definition.sql!")
