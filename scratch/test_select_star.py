import urllib.request
import json
import time

SUPABASE_URL = 'https://ehhjnwosqcrfwonqhfoz.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaGpud29zcWNyZndvbnFoZm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTc4NjksImV4cCI6MjA3ODQ3Mzg2OX0.qxbGgdq3lOiOmXuY8fMok7xlNluKPQIKoC3zQroUYSQ'

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Accept': 'application/json'
}

def test(path):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    print(f"Testing {path[:100]}...")
    t0 = time.time()
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"  SUCCESS! returned {len(data)} items in {time.time()-t0:.3f}s")
    except Exception as e:
        print(f"  FAILED in {time.time()-t0:.3f}s: {e}")
        if hasattr(e, 'read'):
            print("  Body:", e.read().decode('utf-8'))

test("vw_mt_comissoes_detalhadas?select=*&booking_date=gte.2026-09-01&booking_date=lte.2026-09-30")
test("vw_mt_comissoes_detalhadas?select=*&or=(and(booking_date.gte.2026-09-01,booking_date.lte.2026-09-30),and(pay_date.gte.2026-09-01,pay_date.lt.2026-10-01))")
