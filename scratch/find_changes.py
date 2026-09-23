import json
import urllib.request

# Query Supabase execute_sql RPC
def run_sql(query):
    req = urllib.request.Request(
        "https://ehhjnwosqcrfwonqhfoz.supabase.co/rest/v1/rpc/execute_sql",
        data=json.dumps({"project_id": "ehhjnwosqcrfwonqhfoz", "query": query}).encode('utf-8'),
        headers={"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaGpud29zcWNyZndvbnFoaG96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzNTQ5MTMsImV4cCI6MjA1NTkzMDkxM30.75m_Gg_34191m_5x1_55x1_55x1_55x1_55x1_55x1_55"}
    )
    # Wait, we can use call_mcp_tool directly or run command with supabase CLI
