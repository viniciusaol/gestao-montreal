import json

with open('workflows/Relatório de Vendas (12).json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

for node in wf.get('nodes', []):
    if 'Enviar faturamento' in node.get('name', ''):
        print("Node name:", node.get('name'))
        print("Parameters:", json.dumps(node.get('parameters'), indent=2))
