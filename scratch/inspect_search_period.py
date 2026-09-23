import json

with open('workflows/Relatório de Vendas (12).json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

for node in wf.get('nodes', []):
    name = node.get('name')
    if name in ['Definir período de busca1', 'Busca vendas1', 'Existem novidades para enviar?']:
        print("=== Node:", name, "===")
        print(json.dumps(node.get('parameters'), indent=2))
