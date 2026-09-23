import json
import subprocess
import os

with open('scratch/update_view.sql', 'r', encoding='utf-8') as f:
    sql_text = f.read()

# Let's inspect if there's any syntax error before executing
print("First 100 chars:", sql_text[:100])
print("Last 100 chars:", sql_text[-100:])
