import os, re

pattern = re.compile(r'(set.*Error|set.*Message|detail)')
for root, dirs, files in os.walk('frontend/src'):
    for f in files:
        if f.endswith(('.tsx', '.ts')):
            p = os.path.join(root, f).replace('\\', '/')
            with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                for idx, line in enumerate(file, 1):
                    if 'err.response?.data?.detail' in line or 'error?.response?.data?.detail' in line or 'res.data.detail' in line:
                        print(f"{p}:{idx}:{line.strip()}")
