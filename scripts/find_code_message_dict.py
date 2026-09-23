import os, re

for root, dirs, files in os.walk('.'):
    if any(x in root for x in ['node_modules', '.git', '.pytest_cache', 'dist']):
        continue
    for f in files:
        if f.endswith(('.py', '.ts', '.tsx')):
            p = os.path.join(root, f).replace('\\', '/')
            with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                lines = file.readlines()
                for i in range(len(lines) - 5):
                    window = "".join(lines[i:i+6])
                    if '"code"' in window and '"message"' in window:
                        print(f"{p}:{i+1}:\n{window.strip()}\n---")
