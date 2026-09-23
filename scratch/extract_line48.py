import json

with open(r'C:\Users\vinic\.gemini\antigravity-ide\brain\a5ecb53f-0ea1-43ac-85b8-f84be8488a0d\.system_generated\logs\transcript_full.jsonl', 'r', encoding='utf-8') as f:
    for line_no, line in enumerate(f):
        if line_no == 48:
            data = json.loads(line)
            print("Type:", data.get('type'))
            print("Content:", str(data.get('content'))[:500])
            with open('scratch/step49_mcp_output.txt', 'w', encoding='utf-8') as out:
                out.write(json.dumps(data, indent=2))
