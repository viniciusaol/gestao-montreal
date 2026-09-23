import glob
import os

sql_files = glob.glob("scratch/*.sql")
print("Found sql files in scratch:")
for f in sql_files:
    print(f, os.path.getsize(f))
