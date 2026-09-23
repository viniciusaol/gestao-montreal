import urllib.request
import json
import urllib.parse

SUPABASE_URL = 'https://ehhjnwosqcrfwonqhfoz.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaGpud29zcWNyZndvbnFoZm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTc4NjksImV4cCI6MjA3ODQ3Mzg2OX0.qxbGgdq3lOiOmXuY8fMok7xlNluKPQIKoC3zQroUYSQ'

monthStart = '2026-09-01'
monthEnd = '2026-09-30'
nextMonthStart = '2026-10-01'
professor = 'Rodrigo Assunção'

queries = {
    'classesData': f"vw_mt_comissoes_detalhadas?select=*,pay_date&or=(and(booking_date.gte.{monthStart},booking_date.lte.{monthEnd}),and(pay_date.gte.{monthStart},pay_date.lt.{nextMonthStart}))",
    'payoutsData': f"mt_pagamentos_professores?select=*&professor=eq.{urllib.parse.quote(professor)}&reference_period=eq.{monthStart}&order=payout_date.desc",
    'salesData': f"vw_mt_faturamento_itens_pago?select=item_key,valor_faturamento,categoria,subcategoria,produto_padronizado,item_description,pay_date&pay_date=gte.{monthStart}&pay_date=lt.{nextMonthStart}&order=item_key.asc",
    'extraRevenuesData': "mt_receitas_extras"
}

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Accept': 'application/json'
}

for name, path in queries.items():
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    print(f"Testing {name}: {url}")
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"  SUCCESS! {name} returned {len(data)} items")
    except Exception as e:
        print(f"  FAILED! {name}: {e}")
        if hasattr(e, 'read'):
            print("  Error body:", e.read().decode('utf-8'))
