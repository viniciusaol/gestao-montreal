import json
import urllib.request
import os

with open(r"c:\Users\vinic\.antigravity-ide\Gestão Montreal\scratch\perfect_view_fabio_fixed.sql", "r", encoding="utf-8") as f:
    sql_query = f.read()

print(f"Loaded perfect_view_fabio_fixed.sql, length: {len(sql_query)}")
