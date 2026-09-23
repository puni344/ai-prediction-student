import os, re

pattern = re.compile(r'(\|\|\s*0|Number\(|parseInt\(|parseFloat\()')
for root, dirs, files in os.walk('frontend/src'):
    for f in files:
        if f.endswith(('.tsx', '.ts')):
            p = os.path.join(root, f).replace('\\', '/')
            with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                for idx, line in enumerate(file, 1):
                    if pattern.search(line):
                        print(f"{p}:{idx}:{line.strip()}")
