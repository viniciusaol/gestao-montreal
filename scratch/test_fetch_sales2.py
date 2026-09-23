import json
import urllib.request

url = "https://ehhjnwosqcrfwonqhfoz.supabase.co/rest/v1/mt_faturamento_vendas?select=external_id,paid,is_canceled,total,pay_date,cancel_date&limit=10000"
req = urllib.request.Request(url, headers={
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaGpud29zcWNyZndvbnFoZm96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjg5Nzg2OSwiZXhwIjoyMDc4NDczODY5fQ.9NEyAQd203dXiyOyxC2wXvUZJ4Loo_Kn2_-EEmLvx3M",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaGpud29zcWNyZndvbnFoZm96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjg5Nzg2OSwiZXhwIjoyMDc4NDczODY5fQ.9NEyAQd203dXiyOyxC2wXvUZJ4Loo_Kn2_-EEmLvx3M"
})

with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode('utf-8'))
    print(f"Fetched {len(data)} sales from Supabase!")
