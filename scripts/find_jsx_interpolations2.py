import os, re

pattern = re.compile(r'\{([a-zA-Z0-9_\.]+)\}')
results = []
for root, dirs, files in os.walk('frontend/src'):
    for f in files:
        if f.endswith(('.tsx', '.jsx')):
            p = os.path.join(root, f).replace('\\', '/')
            with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                lines = file.readlines()
                for idx, line in enumerate(lines, 1):
                    if 'className=' in line or 'import ' in line or '//' in line:
                        continue
                    matches = pattern.findall(line)
                    for m in matches:
                        if any(k in m.lower() for k in ['error', 'msg', 'message', 'detail', 'code', 'status', 'notice', 'alert', 'submit', 'warn']):
                            results.append(f"{p}:{idx}: {{{m}}} in: {line.strip()}")

with open("scripts/jsx_results.txt", "w", encoding="utf-8") as out:
    out.write("\n".join(results))
print(f"Wrote {len(results)} matches.")
