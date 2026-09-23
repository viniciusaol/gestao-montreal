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

print("Querying by pay_date:")
print(exec_sql("""
SELECT professor, COUNT(*), SUM(booking_value) 
FROM vw_mt_comissoes_detalhadas 
WHERE is_paid = true AND pay_date >= '2026-09-01' AND pay_date < '2026-10-01'
GROUP BY professor ORDER BY professor;
"""))

print("Querying by booking_date:")
print(exec_sql("""
SELECT professor, COUNT(*), SUM(booking_value) 
FROM vw_mt_comissoes_detalhadas 
WHERE is_paid = true AND booking_date >= '2026-09-01' AND booking_date < '2026-10-01'
GROUP BY professor ORDER BY professor;
"""))
