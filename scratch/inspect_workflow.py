import json

with open('workflows/Relatório de Vendas (12).json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

nodes = wf.get('nodes', [])
print(f"Total nodes: {len(nodes)}")
for node in nodes:
    name = node.get('name')
    type_ = node.get('type')
    params = node.get('parameters', {})
    url = params.get('url', '')
    method = params.get('method', '')
    headers = params.get('headerParameters', {})
    print(f"Node: {name} | Type: {type_} | Method: {method} | URL: {url}")
