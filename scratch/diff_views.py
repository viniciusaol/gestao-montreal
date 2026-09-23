import difflib

with open('scratch/perfect_view.sql', 'r', encoding='utf-8') as f1:
    lines1 = f1.readlines()

with open('scratch/perfect_view_cash_basis_fix.sql', 'r', encoding='utf-8') as f2:
    lines2 = f2.readlines()

diff = list(difflib.unified_diff(lines1, lines2, fromfile='perfect_view.sql', tofile='perfect_view_cash_basis_fix.sql'))
for line in diff:
    print(line, end='')
