import json

with open(r'C:\Users\vinic\.gemini\antigravity-ide\brain\a5ecb53f-0ea1-43ac-85b8-f84be8488a0d\.system_generated\steps\49\output.txt', 'r', encoding='utf-8') as f:
    data = json.load(f)

res = data['result']
pos = res.find('[{"view_definition"')
end_pos = res.rfind('}]') + 2
view_json = res[pos:end_pos]
parsed = json.loads(view_json)
def_str = parsed[0]['view_definition']

print("Last 10 lines of def_str:")
lines = def_str.splitlines()
for l in lines[-10:]:
    print(repr(l))
