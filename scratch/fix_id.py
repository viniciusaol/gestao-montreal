with open('scratch/current_view.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

fixed_sql = sql.replace('p.id', 'p.participant_key')

full_query = f"CREATE OR REPLACE VIEW public.vw_mt_comissoes_detalhadas AS\n{fixed_sql}"

with open('scratch/fixed_current_view.sql', 'w', encoding='utf-8') as f_out:
    f_out.write(full_query)

print("Saved scratch/fixed_current_view.sql")
