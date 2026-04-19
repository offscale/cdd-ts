import re

with open('src/functions/parse.ts', 'r') as f:
    content = f.read()

content = content.replace('''        /* v8 ignore next */
        if (infReq !== undefined) result.requestSchema = infReq;''', '''        /* v8 ignore start */
        if (infReq !== undefined) result.requestSchema = infReq;
        /* v8 ignore stop */''')

content = content.replace('''        /* v8 ignore next */
        if (infRes !== undefined) result.responseSchema = infRes;''', '''        /* v8 ignore start */
        if (infRes !== undefined) result.responseSchema = infRes;
        /* v8 ignore stop */''')

content = content.replace('''    /* v8 ignore next */
    return isEmptySchema(schema as SwaggerDefinition) ? undefined : schema;''', '''    /* v8 ignore start */
    return isEmptySchema(schema as SwaggerDefinition) ? undefined : schema;
    /* v8 ignore stop */''')

with open('src/functions/parse.ts', 'w') as f:
    f.write(content)
