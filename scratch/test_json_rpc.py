import json
import urllib.request

url = "https://ehhjnwosqcrfwonqhfoz.supabase.co/rest/v1/rpc/mt_buscar_vendas_existentes_json"
payload = json.dumps({"p_data_inicial": "2026-01-01"}).encode('utf-8')

req = urllib.request.Request(url, data=payload, headers={
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaGpud29zcWNyZndvbnFoZm96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjg5Nzg2OSwiZXhwIjoyMDc4NDczODY5fQ.9NEyAQd203dXiyOyxC2wXvUZJ4Loo_Kn2_-EEmLvx3M",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaGpud29zcWNyZndvbnFoZm96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjg5Nzg2OSwiZXhwIjoyMDc4NDczODY5fQ.9NEyAQd203dXiyOyxC2wXvUZJ4Loo_Kn2_-EEmLvx3M",
    "Content-Type": "application/json"
})

import time
start = time.time()
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode('utf-8'))
    elapsed = time.time() - start
    print(f"Fetched ALL {len(data)} sales from RPC mt_buscar_vendas_existentes_json in {elapsed:.2f} seconds!")
