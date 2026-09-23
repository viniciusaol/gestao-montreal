import urllib.request
import json

def exec_sql(query):
    req = urllib.request.Request(
        "https://ehhjnwosqcrfwonqhfoz.supabase.co/rest/v1/rpc/execute_sql",
        data=json.dumps({"project_id": "ehhjnwosqcrfwonqhfoz", "query": query}).encode('utf-8'),
        headers={"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaGpud29zcWNyZndvbnFoaG96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzNTQ5MTMsImV4cCI6MjA1NTkzMDkxM30.75m_Gg_34191m_5x1_55x1_55x1_55x1_55x1_55x1_55"}
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        return json.loads(res['result'].split('<untrusted-data-')[1].split('>\n')[1].split('\n</untrusted-data-')[0])

# Let's inspect perfect_view.sql vs perfect_view_cash_basis_fix.sql for João and Leandro!
with open('scratch/perfect_view.sql', 'r', encoding='utf-8') as f:
    sql1 = f.read()

# Let's check what sql1 produces for João and Leandro when created as a temp view or executed!
