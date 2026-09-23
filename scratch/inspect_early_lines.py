import json

with open(r'C:\Users\vinic\.gemini\antigravity-ide\brain\a5ecb53f-0ea1-43ac-85b8-f84be8488a0d\.system_generated\logs\transcript_full.jsonl', 'r', encoding='utf-8') as f:
    for line_no, line in enumerate(f):
        if line_no in [47, 48, 49, 50, 51, 52, 53, 54, 55]:
            data = json.loads(line)
            print(f"Line {line_no} step {data.get('step_index')}: {data.get('type')}")
            content_str = str(data)
            if 'view_definition' in content_str:
                print("FOUND view_definition in line", line_no)
                with open(f'scratch/line_{line_no}.json', 'w', encoding='utf-8') as out:
                    out.write(line)
