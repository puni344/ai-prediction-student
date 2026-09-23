# -*- coding: utf-8 -*-
client_path = 'backend/ai/client.py'
with open(client_path, 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    'score for each area The system assigns',
    'score for each area. The system assigns'
)

with open(client_path, 'w', encoding='utf-8') as f:
    f.write(code)
print('Fixed period in client.py')
