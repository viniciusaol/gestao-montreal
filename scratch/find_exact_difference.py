import json
import urllib.request

# Query Supabase via MCP/execute_sql or HTTP to analyze the exact items
# Let's write a SQL query to fetch all cash sales items that match categorizeFaturamentoItem in September 2026
# and match them against vw_mt_comissoes_detalhadas
query = """
WITH erp_cash_items AS (
    SELECT 
        v.external_id AS venda_id,
        i.item_key,
        v.customer_code,
        v.customer_name,
        v.pay_date,
        i.description AS item_description,
        i.categoria,
        i.subcategoria,
        i.produto_padronizado,
        i.valor_faturamento
    FROM mt_faturamento_vendas v
    JOIN mt_faturamento_itens i ON v.external_id = i.venda_external_id
    WHERE v.paid = true 
      AND v.is_canceled = false 
      AND i.is_canceled = false 
      AND COALESCE(v.tipo, '') <> 'refund'
      AND i.valor_faturamento > 0
      AND v.pay_date >= '2026-09-01' AND v.pay_date < '2026-10-01'
      AND (
        i.categoria ILIKE 'aulas'
        OR i.description ILIKE '%aula%'
        OR i.description ILIKE '%tênis%'
        OR i.description ILIKE '%tenis%'
        OR i.description ILIKE '%kids%'
        OR i.description ILIKE '%baby%'
        OR i.description ILIKE '%intensiv%'
        OR COALESCE(i.produto_padronizado, '') ILIKE '%tênis%'
        OR COALESCE(i.produto_padronizado, '') ILIKE '%aula%'
      )
),
view_september_items AS (
    SELECT 
        customer_code,
        participant_name,
        professor,
        booking_type,
        booking_value,
        pay_date,
        description
    FROM vw_mt_comissoes_detalhadas
    WHERE is_paid = true 
      AND pay_date >= '2026-09-01' AND pay_date < '2026-10-01'
)
SELECT 
    ci.venda_id,
    ci.customer_code,
    ci.customer_name,
    ci.pay_date,
    ci.item_description,
    ci.categoria,
    ci.subcategoria,
    ci.valor_faturamento,
    vi.professor,
    vi.booking_value,
    vi.booking_type
FROM erp_cash_items ci
LEFT JOIN view_september_items vi ON ci.customer_code = vi.customer_code 
                                AND abs(ci.valor_faturamento - vi.booking_value) < 0.01;
"""

print("Query built successfully")
