import os
import re

type_str = "string | number | boolean | object | undefined | null"

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    content = re.sub(r'= unknown', f'= {type_str}', content)
    content = re.sub(r'unknown,', f'{type_str},', content)
    content = re.sub(r'<unknown', f'<{type_str}', content)
    content = re.sub(r'unknown>', f'{type_str}>', content)
    content = re.sub(r'unknown\s*\|', f'{type_str} |', content)
    content = re.sub(r'\|\s*unknown', f'| {type_str}', content)
    
    with open(filepath, 'w') as f:
        f.write(content)

for root, _, files in os.walk('.'):
    if 'node_modules' in root or 'dist' in root or 'coverage' in root or '.git' in root:
        continue
    for file in files:
        if file.endswith('.ts'):
            process_file(os.path.join(root, file))

