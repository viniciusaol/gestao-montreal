import json

with open('scratch/exact_original_restore_clean.sql', 'r', encoding='utf-8') as f:
    sql_query = f.read()

print(f"Clean SQL length: {len(sql_query)}")
