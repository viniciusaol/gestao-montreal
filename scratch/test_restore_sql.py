import json
import urllib.request

with open('scratch/exact_original_restore.sql', 'r', encoding='utf-8') as f:
    sql_text = f.read()

print("SQL length:", len(sql_text))
