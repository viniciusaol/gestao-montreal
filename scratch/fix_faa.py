with open('scratch/fixed_current_view.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

fixed_sql = sql.replace('FROM faa\n', 'FROM faturamento_avulso_agrupado faa\n')

with open('scratch/fixed_current_view_2.sql', 'w', encoding='utf-8') as f_out:
    f_out.write(fixed_sql)

print("Saved scratch/fixed_current_view_2.sql")
