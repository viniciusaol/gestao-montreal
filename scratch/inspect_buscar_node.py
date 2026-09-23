import json

with open('workflows/Relatório de Vendas (12).json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

for node in wf.get('nodes', []):
    if node.get('name') == 'Buscar vendas no Supabase':
        print("Current node config:")
        print(json.dumps(node, indent=2))
