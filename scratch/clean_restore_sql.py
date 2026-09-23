import json

with open('scratch/exact_original_restore.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Replace any internal trailing semicolons before UNION or FROM
lines = sql.split('\n')
cleaned_lines = []
for i, line in enumerate(lines):
    # If not the very last line and ends with semicolon, strip it
    if i < len(lines) - 1 and line.rstrip().endswith(';'):
        cleaned_lines.append(line.rstrip()[:-1])
    else:
        cleaned_lines.append(line)

cleaned_sql = '\n'.join(cleaned_lines)

with open('scratch/exact_original_restore_clean.sql', 'w', encoding='utf-8') as f:
    f.write(cleaned_sql)

print("Saved scratch/exact_original_restore_clean.sql")
