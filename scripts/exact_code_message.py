import os, json, re

for root, dirs, files in os.walk('.'):
    if any(x in root for x in ['node_modules', '.git', '.pytest_cache', 'dist', '__pycache__']):
        continue
    for f in files:
        if f.endswith(('.py', '.ts', '.tsx', '.json', '.js')):
            p = os.path.join(root, f).replace('\\', '/')
            with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                lines = file.readlines()
                for i in range(len(lines)):
                    chunk = "".join(lines[max(0, i-5):min(len(lines), i+6)])
                    if 'code' in chunk and 'message' in chunk:
                        # Check if there are keys code and message
                        if re.search(r'[\'"]code[\'"]\s*:', chunk) and re.search(r'[\'"]message[\'"]\s*:', chunk):
                            print(f"{p}:{i+1}:\n{chunk.strip()}\n======")
                            break
