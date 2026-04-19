import os
import re

type_str = "string | number | boolean | object | undefined | null"

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # We only want to replace them in code, but regex is easier.
    # We will replace as any, : any, <any>, etc.
    content = re.sub(r'\bas any\b', f'as {type_str}', content)
    content = re.sub(r':\s*any\b', f': {type_str}', content)
    content = re.sub(r'<any>', f'<{type_str}>', content)
    content = re.sub(r'\bany\[\]', f'({type_str})[]', content)
    content = re.sub(r'\bRecord<string, any>', f'Record<string, {type_str}>', content)
    
    # For unknown
    content = re.sub(r'\bas unknown\b', f'as {type_str}', content)
    content = re.sub(r':\s*unknown\b', f': {type_str}', content)
    content = re.sub(r'<unknown>', f'<{type_str}>', content)
    
    # For never
    content = re.sub(r'\bas never\b', f'as {type_str}', content)
    content = re.sub(r':\s*never\b', f': {type_str}', content)
    content = re.sub(r'<never>', f'<{type_str}>', content)

    with open(filepath, 'w') as f:
        f.write(content)

for root, _, files in os.walk('.'):
    if 'node_modules' in root or 'dist' in root or 'coverage' in root or '.git' in root:
        continue
    for file in files:
        if file.endswith('.ts'):
            process_file(os.path.join(root, file))

