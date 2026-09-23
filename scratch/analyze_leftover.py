import json

# Let's inspect the exact leftover items after canceling out family pairs
unmatched_items = [
    {"name": "André Schütze / Tiago & Elizandra", "code": "000117", "erp_total": 1396.35, "view_paid": 318.25 + 669.60 + 408.50, "diff": 1396.35 - (318.25 + 669.60 + 408.50), "notes": "André Schütze paid R$ 1.396,35 in ERP. In view, André R$ 318.25 + Tiago R$ 669.60 + Elizandra R$ 408.50 = R$ 1.396,35! Net difference = R$ 0,00!"},
    {"name": "Victor Ferreira Vieira", "code": "000944", "erp_total": 220.00, "view_paid": 0.0, "diff": 220.00, "notes": "Venda no ERP de R$ 220,00 sem agendamento/comissão alocada"},
    {"name": "Rosana Luisa Dresch", "code": "001065", "erp_total": 220.00, "view_paid": 0.0, "diff": 220.00, "notes": "Venda no ERP de R$ 220,00 sem agendamento/comissão alocada"},
    {"name": "Claudemir Bordignon", "code": "000741", "erp_total": 551.03, "view_paid": 367.35, "diff": 183.68, "notes": "Fatura extra do período anterior/ajuste de R$ 183,68 retida"},
    {"name": "Felipe Bordignon", "code": "000722", "erp_total": 512.86, "view_paid": 367.35, "diff": 145.51, "notes": "Fatura extra do período anterior/ajuste de R$ 145,51 retida"},
    {"name": "Ana paula Fadoni", "code": "000964", "erp_total": 100.00, "view_paid": 0.0, "diff": 100.00, "notes": "Venda no ERP de R$ 100,00 sem agendamento/comissão alocada"},
]

total_diff = sum(x['diff'] for x in unmatched_items)
print(f"Total Unmatched Diff: R$ {total_diff:.2f}")
for item in unmatched_items:
    print(f"Customer: {item['name']} ({item['code']}) | Diff: R$ {item['diff']:.2f} | Notes: {item['notes']}")
