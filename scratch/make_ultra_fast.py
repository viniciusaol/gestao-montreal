import json

with open('scratch/optimized_view_super_fast.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Replace Regex in target_bookings booking_class_type with fast LIKE / position checks
old_class_type_case = """                CASE
                    WHEN b.description ~ '\(\s*\d+\s*/\s*1\s*\)'::text THEN 'INDIVIDUAL'::text
                    WHEN b.description ~ '\(\s*\d+\s*/\s*2\s*\)'::text THEN 'DUPLA'::text
                    WHEN b.description ~ '\(\s*\d+\s*/\s*3\s*\)'::text THEN 'TRIO'::text
                    WHEN b.description ~ '\(\s*\d+\s*/\s*[456789]\d*\s*\)'::text THEN 'GRUPO'::text
                    WHEN b.booking_type = 'clase_suelta'::text THEN 'INDIVIDUAL'::text
                    ELSE 'GRUPO'::text
                END AS booking_class_type"""

new_class_type_case = """                CASE
                    WHEN b.description LIKE '%/1)%' OR b.description LIKE '%/ 1)%' OR b.description LIKE '%/1 %' THEN 'INDIVIDUAL'::text
                    WHEN b.description LIKE '%/2)%' OR b.description LIKE '%/ 2)%' OR b.description LIKE '%/2 %' THEN 'DUPLA'::text
                    WHEN b.description LIKE '%/3)%' OR b.description LIKE '%/ 3)%' OR b.description LIKE '%/3 %' THEN 'TRIO'::text
                    WHEN b.description LIKE '%/%' AND b.description LIKE '%)%' THEN 'GRUPO'::text
                    WHEN b.booking_type = 'clase_suelta'::text THEN 'INDIVIDUAL'::text
                    ELSE 'GRUPO'::text
                END AS booking_class_type"""

sql_ultra = sql.replace(old_class_type_case, new_class_type_case)

# Replace Regex in plan_items item_start_date & item_end_date
old_dates = """                CASE
                    WHEN rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text THEN to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)
                    ELSE NULL::date
                END AS item_start_date,
                CASE
                    WHEN rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text THEN to_date((regexp_match(rf.description, '\d{2}/\d{2}/\d{4}-(\d{2}/\d{2}/\d{4})'::text))[1], 'DD/MM/YYYY'::text)
                    ELSE NULL::date
                END AS item_end_date"""

new_dates = """                CASE
                    WHEN rf.description LIKE '%/%/----%/%/%' OR rf.description LIKE '%/%/20%-%/%/20%' THEN to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)
                    ELSE NULL::date
                END AS item_start_date,
                CASE
                    WHEN rf.description LIKE '%/%/----%/%/%' OR rf.description LIKE '%/%/20%-%/%/20%' THEN to_date((regexp_match(rf.description, '\d{2}/\d{2}/\d{4}-(\d{2}/\d{2}/\d{4})'::text))[1], 'DD/MM/YYYY'::text)
                    ELSE NULL::date
                END AS item_end_date"""

sql_ultra = sql_ultra.replace(old_dates, new_dates)

with open('scratch/optimized_view_ultra_fast.sql', 'w', encoding='utf-8') as f:
    f.write(sql_ultra)

print("Saved scratch/optimized_view_ultra_fast.sql")
