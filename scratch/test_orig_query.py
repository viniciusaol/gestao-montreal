import urllib.request
import json
import time
import urllib.parse

SUPABASE_URL = 'https://ehhjnwosqcrfwonqhfoz.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaGpud29zcWNyZndvbnFoZm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTc4NjksImV4cCI6MjA3ODQ3Mzg2OX0.qxbGgdq3lOiOmXuY8fMok7xlNluKPQIKoC3zQroUYSQ'

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Accept': 'application/json'
}

professor = 'Rodrigo Assunção'
profEncoded = urllib.parse.quote(professor)
monthStart = '2026-09-01'
monthEnd = '2026-09-30'

# Test original fast query
url = f"{SUPABASE_URL}/rest/v1/vw_mt_comissoes_detalhadas?select=*&booking_date=gte.{monthStart}&booking_date=lte.{monthEnd}&professor=eq.{profEncoded}"
print("Testing original fast query:", url)
t0 = time.time()
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print(f"SUCCESS! Returned {len(data)} items for {professor} in {time.time()-t0:.3f}s")
except Exception as e:
    print("FAILED:", e)
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
