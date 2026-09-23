import json

with open(r'C:\Users\vinic\.gemini\antigravity-ide\brain\a5ecb53f-0ea1-43ac-85b8-f84be8488a0d\.system_generated\logs\transcript_full.jsonl', 'r', encoding='utf-8') as f:
    for line_no, line in enumerate(f):
        if 'vw_mt_comissoes_detalhadas' in line:
            data = json.loads(line)
            step_idx = data.get('step_index')
            stype = data.get('type')
            print(f"Line {line_no} Step {step_idx} Type {stype}")
