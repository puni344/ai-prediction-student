import os, re

pattern = re.compile(r'["\']code["\']\s*:\s*.*["\']message["\']|["\']message["\']\s*:\s*.*["\']code["\']')
for root, dirs, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root or '.pytest_cache' in root:
        continue
    for f in files:
        if f.endswith(('.py', '.ts', '.tsx', '.json')):
            p = os.path.join(root, f).replace('\\', '/')
            with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
                if ('code' in content and 'message' in content):
                    lines = content.split('\n')
                    for idx, line in enumerate(lines, 1):
                        if pattern.search(line):
                            print(f"{p}:{idx}:{line.strip()}")
