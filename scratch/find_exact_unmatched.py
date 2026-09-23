import urllib.request
import json

SUPABASE_URL = 'https://ehhjnwosqcrfwonqhfoz.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaGpud29zcWNyZndvbnFoZm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTc4NjksImV4cCI6MjA3ODQ3Mzg2OX0.qxbGgdq3lOiOmXuY8fMok7xlNluKPQIKoC3zQroUYSQ'

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Range-Unit': 'items',
    'Prefer': 'count=exact'
}

def fetch_all(endpoint):
    results = []
    offset = 0
    limit = 1000
    while True:
        req_headers = dict(headers)
        req_headers['Range'] = f'{offset}-{offset+limit-1}'
        url = f'{SUPABASE_URL}/rest/v1/{endpoint}'
        req = urllib.request.Request(url, headers=req_headers)
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            results.extend(data)
            if len(data) < limit:
                break
            offset += limit
    return results

print("1. Carregando vendas de setembro...")
vendas = fetch_all('mt_faturamento_vendas?paid=eq.true&is_canceled=eq.false&pay_date=gte.2026-09-01T00:00:00&pay_date=lt.2026-10-01T00:00:00')

print("2. Carregando itens...")
itens = fetch_all('mt_faturamento_itens?is_canceled=eq.false')
itens_by_venda = {}
for i in itens:
    vid = i['venda_external_id']
    if vid not in itens_by_venda:
        itens_by_venda[vid] = []
    itens_by_venda[vid].append(i)

caixa_lessons = []
for v in vendas:
    for i in itens_by_venda.get(v['external_id'], []):
        desc = (i.get('description') or '').lower()
        cat = (i.get('categoria') or '').lower()
        sub = (i.get('subcategoria') or '').lower()
        prod = (i.get('produto_padronizado') or '').lower()
        val = float(i.get('valor_faturamento') or 0.0)

        is_intensivao = 'intensiv' in desc
        is_lesson = is_intensivao or cat == 'aulas' or 'aula' in desc or 'tênis' in desc or 'tenis' in desc or 'kids' in desc or 'baby' in desc or 'tênis' in prod or 'aula' in prod
        if is_lesson:
            caixa_lessons.append({
                'external_id': v['external_id'],
                'item_key': i.get('item_key'),
                'customer_code': v['customer_code'],
                'description': i.get('description'),
                'valor': val,
                'categoria': i.get('categoria'),
                'subcategoria': i.get('subcategoria')
            })

total_caixa = sum(x['valor'] for x in caixa_lessons)
print(f"Total Caixa (app.js): R$ {total_caixa:.2f} ({len(caixa_lessons)} itens)")

print("\n3. Carregando view vw_mt_comissoes_detalhadas...")
# Fetch view via SQL API to get all records for Sept 2026
sql_query = """
SELECT 
    booking_id,
    customer_code,
    participant_name,
    professor,
    description,
    booking_value,
    booking_commission_base,
    booking_type,
    booking_date,
    pay_date
FROM vw_mt_comissoes_detalhadas
WHERE is_paid = true
  AND (
      (booking_date >= '2026-09-01' AND booking_date < '2026-10-01')
      OR (pay_date >= '2026-09-01' AND pay_date < '2026-10-01')
  )
"""

req_sql = urllib.request.Request(
    f'{SUPABASE_URL}/rest/v1/rpc/execute_sql',
    headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json'},
    data=json.dumps({'query': sql_query}).encode('utf-8')
)

try:
    with urllib.request.urlopen(req_sql) as resp:
        view_items = json.loads(resp.read().decode('utf-8'))
except Exception as e:
    # Query view directly via REST
    view_items = fetch_all('vw_mt_comissoes_detalhadas?is_paid=eq.true&booking_date=gte.2026-09-01&booking_date=lt.2026-10-01')

print(f"Total itens na view: {len(view_items)}")
total_view = sum(float(x.get('booking_value') or 0.0) for x in view_items)
print(f"Total booking_value na View: R$ {total_view:.2f}")

print(f"\nDiferença Global: R$ {total_caixa - total_view:.2f}")

# Now let's find item_keys in resolved_faturamento that enter plan_items_raw / unallocated_payments
print("\n--- ANALISANDO OS ITENS INDIVIDUAIS DO CAIXA ---")
# Group caixa_lessons by categoria/subcategoria/description type
cat_summary = {}
for item in caixa_lessons:
    key = f"{item.get('categoria') or 'N/A'} | {item.get('subcategoria') or 'N/A'}"
    if key not in cat_summary:
        cat_summary[key] = {'count': 0, 'sum': 0.0, 'items': []}
    cat_summary[key]['count'] += 1
    cat_summary[key]['sum'] += item['valor']
    cat_summary[key]['items'].append(item)

for k, v in sorted(cat_summary.items(), key=lambda x: x[1]['sum'], reverse=True):
    print(f"Categorização: {k:45s} | Qtd: {v['count']:3d} | Total: R$ {v['sum']:10.2f}")

