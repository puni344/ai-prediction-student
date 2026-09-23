import os, re

for root, dirs, files in os.walk('frontend/src'):
    for f in files:
        if f.endswith(('.tsx', '.ts')):
            p = os.path.join(root, f).replace('\\', '/')
            with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
                if 'err.response?.data?.detail' in content:
                    lines = content.split('\n')
                    for idx, line in enumerate(lines, 1):
                        if 'err.response?.data?.detail' in line:
                            print(f"{p}:{idx}:{line.strip()}")
