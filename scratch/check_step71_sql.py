import json

with open('scratch/original_step71_view.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

print("Original step 71 SQL ready. Length:", len(sql))
print("First 200 chars:")
print(sql[:200])
print("Last 200 chars:")
print(sql[-200:])
