import json
import urllib.request

# 1. Fetch sales from Supabase via RPC
url_sp = "https://ehhjnwosqcrfwonqhfoz.supabase.co/rest/v1/rpc/mt_buscar_vendas_existentes_json"
payload_sp = json.dumps({"p_data_inicial": "2026-01-01"}).encode('utf-8')
req_sp = urllib.request.Request(url_sp, data=payload_sp, headers={
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaGpud29zcWNyZndvbnFoZm96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjg5Nzg2OSwiZXhwIjoyMDc4NDczODY5fQ.9NEyAQd203dXiyOyxC2wXvUZJ4Loo_Kn2_-EEmLvx3M",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaGpud29zcWNyZndvbnFoZm96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjg5Nzg2OSwiZXhwIjoyMDc4NDczODY5fQ.9NEyAQd203dXiyOyxC2wXvUZJ4Loo_Kn2_-EEmLvx3M",
    "Content-Type": "application/json"
})

with urllib.request.urlopen(req_sp) as resp:
    supabase_sales = json.loads(resp.read().decode('utf-8'))

print(f"Supabase returned {len(supabase_sales)} sales.")
existentes_map = {int(s['external_id']): s for s in supabase_sales if s.get('external_id')}

# 2. Fetch sales from Matchpoint for last 7 days
url_mp = "https://montrealtenisclubeltda-br.matchpoint.com.es/api/query/sales?dateFrom=2026-09-15&dateTo=2026-09-22"
req_mp = urllib.request.Request(url_mp, headers={
    "X-Api-Token": "hNffXWhfyEy3F5eLNrQzGMWmdPD4XFJF8dfpS30LKQxQbMhH",
    "Accept": "application/json"
})

with urllib.request.urlopen(req_mp) as resp:
    raw_mp = json.loads(resp.read().decode('utf-8'))

mp_sales = raw_mp.get('Data', []) if isinstance(raw_mp, dict) else raw_mp
print(f"Matchpoint returned {len(mp_sales)} sales for 15-22 Sept.")

# Compare
novas = 0
alteradas = 0
ignoradas = 0

for sale in mp_sales:
    ext_id = int(sale.get('Id', 0))
    if not ext_id:
        continue
    ex = existentes_map.get(ext_id)
    if not ex:
        novas += 1
    else:
        ignoradas += 1

print(f"Resultado da comparação: Novas: {novas} | Ignoradas: {ignoradas} | Alteradas: {alteradas}")
