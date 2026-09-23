import os, re

for root, dirs, files in os.walk('frontend/src'):
    for f in files:
        if f.endswith(('.tsx', '.ts')):
            p = os.path.join(root, f).replace('\\', '/')
            with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
                # Find all occurrences where an object is created with code and message, or destructuring
                matches = re.findall(r'\{[^}]*code[^}]*message[^}]*\}|\{[^}]*message[^}]*code[^}]*\}', content)
                if matches:
                    print(f"File {p}:")
                    for m in matches:
                        print("  ", m.strip().replace('\n', ' '))
