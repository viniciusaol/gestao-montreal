import json
import glob
import os

workflow_files = glob.glob(r"c:\Users\vinic\.antigravity-ide\Gestão Montreal\workflows\*.json")

for filepath in workflow_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    modified = False
    for node in data.get('nodes', []):
        if node.get('name') in ['Enviar faturamento ao Supabase1', 'Enviar faturamento ao Supabase']:
            options = node.setdefault('parameters', {}).setdefault('options', {})
            options['timeout'] = 120000
            modified = True
            print(f"Updated node {node['name']} in {os.path.basename(filepath)} with 120s timeout")
    
    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

print("All workflow files updated.")
