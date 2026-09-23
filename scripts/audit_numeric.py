import os, re

pattern = re.compile(r'(inputMode|type=[\"\']number[\"\'])')
for root, dirs, files in os.walk('frontend/src'):
    for f in files:
        if f.endswith(('.tsx', '.ts')):
            p = os.path.join(root, f)
            with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                for idx, line in enumerate(file, 1):
                    if pattern.search(line):
                        print(f"{p}:{idx}:{line.strip()}")
