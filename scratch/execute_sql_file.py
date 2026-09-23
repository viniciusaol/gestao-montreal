import json
import urllib.request
import os

view_sql_path = r"c:\Users\vinic\.antigravity-ide\Gestão Montreal\scratch\perfect_view.sql"
with open(view_sql_path, "r", encoding="utf-8") as f:
    sql_query = f.read()

print(f"Loaded SQL query, length: {len(sql_query)}")
