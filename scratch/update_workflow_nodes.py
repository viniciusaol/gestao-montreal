import json
import os

workflow_files = [
    'workflows/Relatório de Vendas (12).json',
    'workflows/Relatório de Vendas - Híbrido (Automático + Manual).json',
    'workflows/Relatório de Vendas (11).json'
]

for filepath in workflow_files:
    if not os.path.exists(filepath):
        print("File not found:", filepath)
        continue

    with open(filepath, 'r', encoding='utf-8') as f:
        wf = json.load(f)

    updated = False
    for node in wf.get('nodes', []):
        if node.get('name') == 'Buscar vendas no Supabase':
            print(f"Updating node in {filepath}")
            node['parameters']['method'] = 'POST'
            node['parameters']['url'] = 'https://ehhjnwosqcrfwonqhfoz.supabase.co/rest/v1/rpc/mt_buscar_vendas_existentes_json'

            # Ensure headerParameters has Content-Type
            headers = node['parameters'].setdefault('headerParameters', {}).setdefault('parameters', [])
            has_ct = any(h.get('name') == 'Content-Type' for h in headers)
            if not has_ct:
                headers.append({
                    "name": "Content-Type",
                    "value": "application/json"
                })

            node['parameters']['sendBody'] = True
            node['parameters']['specifyBody'] = 'json'
            node['parameters']['jsonBody'] = '={ "p_data_inicial": "2026-01-01" }'
            updated = True

    if updated:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(wf, f, indent=2, ensure_ascii=False)
        print(f"Successfully updated {filepath}")
