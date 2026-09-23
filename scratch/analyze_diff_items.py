import json
import urllib.request

# Let's write a python script to query Supabase and extract the exact un-reconciled items for September 2026
script_content = """
import os, json
import urllib.request

# We will run a SQL query to isolate items in ERP that have no corresponding booking/commission in view, net of family pairings
query = '''
WITH erp_items AS (
    SELECT 
        v.external_id AS venda_id,
        i.item_key,
        v.customer_code,
        v.customer_name,
        v.pay_date,
        i.description,
        i.categoria,
        i.subcategoria,
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
)
SELECT * FROM erp_items;
'''
"""
print("Script written")
