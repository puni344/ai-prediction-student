import os, re

for root, dirs, files in os.walk('frontend/src'):
    for f in files:
        if f.endswith(('.tsx', '.ts')):
            p = os.path.join(root, f).replace('\\', '/')
            with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                lines = file.readlines()
                for idx, line in enumerate(lines, 1):
                    if 'code' in line and 'message' in line:
                        print(f"{p}:{idx}:{line.strip()}")
