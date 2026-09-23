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

def test_url(name, path):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    print(f"Testing {name}...")
    t0 = time.time()
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            dt = time.time() - t0
            print(f"  SUCCESS! {name} returned {len(data)} items in {dt:.3f}s")
            return data
    except Exception as e:
        dt = time.time() - t0
        print(f"  FAILED! {name} in {dt:.3f}s: {e}")
        if hasattr(e, 'read'):
            print("  Error body:", e.read().decode('utf-8'))
        return None

test_url("Query A (booking_date)", "vw_mt_comissoes_detalhadas?booking_date=gte.2026-09-01&booking_date=lte.2026-09-30")
test_url("Query B (pay_date)", "vw_mt_comissoes_detalhadas?pay_date=gte.2026-09-01&pay_date=lt.2026-10-01")
