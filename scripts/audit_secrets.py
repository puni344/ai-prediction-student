import os, sys

SECRET_KEYWORDS = [
    'SMTP_PASSWORD',
    'SMTP_PASS',
    'CALENDARIFIC_API_KEY',
    'TURNSTILE_SECRET_KEY',
    'TURNSTILE_SECRET',
    'SECRET_KEY',
    'GOOGLE_CLIENT_SECRET',
]

IGNORE_DIRS = {'node_modules', '.git', '.gemini', 'dist', '__pycache__', '.pytest_cache'}

findings = []
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
    for fn in files:
        if fn.endswith(('.env', '.env.example', '.py', '.ts', '.tsx', '.js', '.json', '.md', '.yml', '.yaml', '.log')):
            p = os.path.join(root, fn)
            try:
                with open(p, 'r', encoding='utf-8', errors='ignore') as fh:
                    for line_num, line in enumerate(fh, 1):
                        for kw in SECRET_KEYWORDS:
                            if kw in line.upper() and '=' in line:
                                is_ph = any(ph in line.lower() for ph in ['your_', 'placeholder', 'changeme', 'mock', 'dummy', 'xxxx', 'test', 'example', 'secret_key_change', '<'])
                                findings.append((p, line_num, kw, is_ph))
            except Exception:
                pass

print('Total potential matches:', len(findings))
for p, l_num, label, is_ph in findings:
    status = '[PLACEHOLDER/SAFE]' if is_ph else '[CONFIGURED/ENV]'
    print(status, p + ':' + str(l_num), '->', label)
