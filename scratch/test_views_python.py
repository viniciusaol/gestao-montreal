import glob

for f in glob.glob("scratch/*.sql"):
    text = open(f, encoding='utf-8', errors='ignore').read()
    if 'participant_key' in text:
        print("MATCH participant_key:", f)
