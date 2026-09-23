# -*- coding: utf-8 -*-
with open('backend/ai/client.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('score for each area "', 'score for each area. "')

with open('backend/ai/client.py', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed successfully!')
