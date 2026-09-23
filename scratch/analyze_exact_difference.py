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

print("Fetching mt_faturamento_vendas...")
vendas = fetch_all('mt_faturamento_vendas?paid=eq.true&is_canceled=eq.false&pay_date=gte.2026-09-01T00:00:00&pay_date=lt.2026-10-01T00:00:00')
print(f"Total sales in Sept 2026: {len(vendas)}")

print("Fetching mt_faturamento_itens...")
itens = fetch_all('mt_faturamento_itens?is_canceled=eq.false')
itens_by_venda = {}
for item in itens:
    vid = item['venda_external_id']
    if vid not in itens_by_venda:
        itens_by_venda[vid] = []
    itens_by_venda[vid].append(item)

print("Fetching vw_mt_comissoes_detalhadas...")
# Get paid view items in September 2026
view_items = fetch_all('vw_mt_comissoes_detalhadas?is_paid=eq.true&pay_date=gte.2026-09-01T00:00:00&pay_date=lt.2026-10-01T00:00:00')
print(f"Total view items paid in Sept 2026: {len(view_items)}")

# 1. Calculate conciliation revenue as app.js does
aulas_items = []
locacao_items = []
lanchonete_items = []

for v in vendas:
    v_itens = itens_by_venda.get(v['external_id'], [])
    for i in v_itens:
        desc = (i.get('description') or '').lower()
        cat = (i.get('categoria') or '').lower()
        sub = (i.get('subcategoria') or '').lower()
        prod = (i.get('produto_padronizado') or '').lower()
        val = float(i.get('valor_faturamento') or 0.0)

        is_intensivao = 'intensiv' in desc
        is_lesson = is_intensivao or cat == 'aulas' or 'aula' in desc or 'tênis' in desc or 'tenis' in desc or 'kids' in desc or 'baby' in desc or 'tênis' in prod or 'aula' in prod
        is_rental = not is_lesson and (cat == 'locação' or 'reserva mensal' in sub or 'reserva mensal' in prod or 'vouchers desconto 1º reserva' in desc or 'voucher desconto 1º reserva' in desc or 'locação' in desc or 'reserva' in desc)

        row_info = {
            'external_id': v['external_id'],
            'customer_code': v['customer_code'],
            'description': i.get('description'),
            'categoria': i.get('categoria'),
            'subcategoria': i.get('subcategoria'),
            'valor_faturamento': val,
            'pay_date': v.get('pay_date')
        }

        if is_lesson:
            aulas_items.append(row_info)
        elif is_rental:
            locacao_items.append(row_info)
        else:
            lanchonete_items.append(row_info)

total_aulas_box = sum(i['valor_faturamento'] for i in aulas_items)
print(f"\n--- CONCILIAÇÃO CAIXA (app.js) ---")
print(f"Total Aulas/Planos no Caixa: R$ {total_aulas_box:.2f}")

# Group view items by customer_code / professor / booking_id
view_by_customer = {}
total_view_booking_value = 0.0
for vi in view_items:
    cc = vi.get('customer_code')
    val = float(vi.get('booking_value') or 0.0)
    total_view_booking_value += val
    if cc not in view_by_customer:
        view_by_customer[cc] = []
    view_by_customer[cc].append(vi)

print(f"Total View Booking Value: R$ {total_view_booking_value:.2f}")
print(f"Diferença Bruta (Caixa - View Total): R$ {total_aulas_box - total_view_booking_value:.2f}")

# Let's compare per customer_code!
aulas_by_customer = {}
for i in aulas_items:
    cc = i['customer_code']
    if cc not in aulas_by_customer:
        aulas_by_customer[cc] = []
    aulas_by_customer[cc].append(i)

all_customers = set(aulas_by_customer.keys()).union(set(view_by_customer.keys()))

print("\n--- DIFERENÇAS POR CLIENTE (Caixa vs View) ---")
diffs = []
for cc in sorted(all_customers):
    caixa_val = sum(i['valor_faturamento'] for i in aulas_by_customer.get(cc, []))
    view_val = sum(float(vi.get('booking_value') or 0.0) for vi in view_by_customer.get(cc, []))
    diff = round(caixa_val - view_val, 2)
    if abs(diff) > 0.01:
        sample_i = aulas_by_customer.get(cc, [{}])[0] if cc in aulas_by_customer else {}
        sample_v = view_by_customer.get(cc, [{}])[0] if cc in view_by_customer else {}
        desc = sample_i.get('description') or sample_v.get('description') or ''
        prof = sample_v.get('professor') or 'Sem prof'
        diffs.append((cc, caixa_val, view_val, diff, desc, prof))

print(f"Total de clientes com divergência: {len(diffs)}\n")
for cc, c_val, v_val, diff, desc, prof in sorted(diffs, key=lambda x: abs(x[3]), reverse=True):
    print(f"Cliente {cc} | Prof: {prof:18s} | Caixa: R$ {c_val:8.2f} | View: R$ {v_val:8.2f} | Dif: R$ {diff:8.2f} | Desc: {desc[:50]}")

with open('scratch/reconciliation_results.json', 'w', encoding='utf-8') as f:
    json.dump({'total_aulas_box': total_aulas_box, 'total_view_val': total_view_booking_value, 'diffs': diffs}, f, indent=2, ensure_ascii=False)
