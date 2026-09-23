import json
import urllib.request

with open('scratch/fixed_view_corrected.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

req = urllib.request.Request(
    "https://ehhjnwosqcrfwonqhfoz.supabase.co/rest/v1/rpc/execute_sql",
    data=json.dumps({"project_id": "ehhjnwosqcrfwonqhfoz", "query": sql}).encode('utf-8'),
    headers={"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaGpud29zcWNyZndvbnFoaG96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzNTQ5MTMsImV4cCI6MjA1NTkzMDkxM30.75m_Gg_34191m_5x1_55x1_55x1_55x1_55x1_55x1_55"}
)

with urllib.request.urlopen(req) as resp:
    print(resp.read().decode('utf-8'))
