# -*- coding: utf-8 -*-
client_path = 'backend/ai/client.py'
with open(client_path, 'r', encoding='utf-8') as f:
    code = f.read()

# Fix RECOMMENDATION_METHOD period
code = code.replace(
    'for each area The system assigns',
    'for each area. The system assigns'
)

# Fix WHY_PREDICTION closing
code = code.replace(
    'These factors are currently the strongest contributors to your model prediction.',
    'These factors are currently contributing to your prediction.'
)

# Fix EXPLAIN_SHAP closing
code = code.replace(
    'These values explain how the model reached your predicted score',
    'This factor is currently contributing to your prediction. These values explain how the model reached your predicted score'
)

with open(client_path, 'w', encoding='utf-8') as f:
    f.write(code)
print('Polished client.py text successfully!')
