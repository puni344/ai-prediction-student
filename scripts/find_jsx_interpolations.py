import os, re

# Look for {variable} where variable might be an error or message or object with {code, message}
pattern = re.compile(r'\{([a-zA-Z0-9_\.]+)\}')
results = []
for root, dirs, files in os.walk('frontend/src'):
    for f in files:
        if f.endswith(('.tsx', '.jsx')):
            p = os.path.join(root, f).replace('\\', '/')
            with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                lines = file.readlines()
                for idx, line in enumerate(lines, 1):
                    # ignore imports, comments, style, className
                    if 'className=' in line or 'import ' in line or '//' in line:
                        continue
                    matches = pattern.findall(line)
                    for m in matches:
                        if any(k in m.lower() for k in ['error', 'msg', 'message', 'detail', 'code', 'status', 'notice', 'alert', 'submit', 'warn']):
                            print(f"{p}:{idx}: {{{m}}} in: {line.strip()}")
