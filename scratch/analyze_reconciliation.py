import json, re

erp_file = r'C:\Users\vinic\.gemini\antigravity-ide\brain\a5ecb53f-0ea1-43ac-85b8-f84be8488a0d\.system_generated\steps\1560\output.txt'
view_file = r'C:\Users\vinic\.gemini\antigravity-ide\brain\a5ecb53f-0ea1-43ac-85b8-f84be8488a0d\.system_generated\steps\1562\output.txt'

def parse_mcp_output(path):
    with open(path, 'r', encoding='utf-8') as f:
        raw = f.read()
    # The MCP output JSON string has result field containing untrusted-data
    mcp_obj = json.loads(raw)
    res_str = mcp_obj['result']
    match = re.search(r'\[\s*\{.*\}\s*\]', res_str, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    return []

erp_items = parse_mcp_output(erp_file)
view_items = parse_mcp_output(view_file)

print(f"Loaded {len(erp_items)} ERP items, {len(view_items)} View items.")

sum_erp = sum(float(x['valor_faturamento']) for x in erp_items)
sum_view = sum(float(x['booking_value']) for x in view_items)

print(f"Total ERP: {sum_erp:.2f}")
print(f"Total View: {sum_view:.2f}")
print(f"Diff (ERP - View): {sum_erp - sum_view:.2f}")

# Group ERP items by customer_code
erp_by_code = {}
for item in erp_items:
    code = item['customer_code']
    val = float(item['valor_faturamento'])
    if code not in erp_by_code:
        erp_by_code[code] = {'name': item['customer_name'], 'val': 0.0, 'items': []}
    erp_by_code[code]['val'] += val
    erp_by_code[code]['items'].append(item)

# Group View items by customer_code
view_by_code = {}
for item in view_items:
    code = item['customer_code']
    val = float(item['booking_value'])
    if code not in view_by_code:
        view_by_code[code] = {'name': item['participant_name'], 'val': 0.0, 'items': []}
    view_by_code[code]['val'] += val
    view_by_code[code]['items'].append(item)

all_codes = set(erp_by_code.keys()).union(set(view_by_code.keys()))

results = []
for code in all_codes:
    e_info = erp_by_code.get(code, {'name': 'N/A', 'val': 0.0, 'items': []})
    v_info = view_by_code.get(code, {'name': 'N/A', 'val': 0.0, 'items': []})
    diff = round(e_info['val'] - v_info['val'], 2)
    if abs(diff) > 0.01:
        results.append({
            'code': code,
            'erp_name': e_info['name'],
            'erp_val': e_info['val'],
            'view_name': v_info['name'],
            'view_val': v_info['val'],
            'diff': diff,
            'erp_items': e_info['items'],
            'view_items': v_info['items']
        })

results.sort(key=lambda x: abs(x['diff']), reverse=True)

# Now let's try matching parent (ERP positive diff) with child (View negative diff)
positive_diffs = [r for r in results if r['diff'] > 0]
negative_diffs = [r for r in results if r['diff'] < 0]

print("\n--- POSITIVE DIFFERENCES (ERP > View) ---")
for r in positive_diffs:
    print(f"Code: {r['code']} | ERP Name: {r['erp_name']} (ERP Val: {r['erp_val']:.2f}) | View Val: {r['view_val']:.2f} | Diff: +{r['diff']:.2f}")

print("\n--- NEGATIVE DIFFERENCES (View > ERP) ---")
for r in negative_diffs:
    print(f"Code: {r['code']} | View Name: {r['view_name']} (View Val: {r['view_val']:.2f}) | ERP Val: {r['erp_val']:.2f} | Diff: {r['diff']:.2f}")

