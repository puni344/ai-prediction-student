import os, re

pattern = re.compile(r'raise\s+HTTPException\s*\(\s*status_code\s*=\s*[^,]+,\s*detail\s*=\s*\{')
for root, dirs, files in os.walk('backend'):
    for f in files:
        if f.endswith('.py'):
            p = os.path.join(root, f).replace('\\', '/')
            with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
                matches = re.finditer(r'raise\s+HTTPException\s*\([^)]*detail\s*=\s*\{[^}]*\}', content)
                for m in matches:
                    print(f"{p}:\n{m.group(0)}\n---")
