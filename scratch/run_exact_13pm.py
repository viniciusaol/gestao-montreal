import json

with open('scratch/exact_13pm_clean.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

print("SQL length:", len(sql))
print("Last 200 chars:\n", sql[-200:])
