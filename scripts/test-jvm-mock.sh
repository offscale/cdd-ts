#!/bin/bash
set -e

PORT=8080
DOCKER_CONTAINER_NAME="petstore_server_mock"
USE_PRISM=0
STARTED_DOCKER=0

is_jvm_ready() {
    curl -s -f http://127.0.0.1:$PORT/api/pet/findByStatus?status=available > /dev/null
}

if is_jvm_ready; then
    echo "JVM mock server is already running on port $PORT (likely GitHub Actions service or left open)."
else
    if command -v java >/dev/null 2>&1; then
        echo "Java is available. We would run the JVM petstore natively, but it requires downloading complex dependencies. Falling back to Prism (Node.js)."
        USE_PRISM=1
    elif command -v docker >/dev/null 2>&1; then
        echo "Starting JVM official petstore server in Docker..."
        docker run --rm -d -p $PORT:8080 --name $DOCKER_CONTAINER_NAME swaggerapi/petstore >/dev/null 2>&1
        STARTED_DOCKER=1
        echo "Waiting for JVM Petstore server to be ready..."
        READY=0
        for i in {1..30}; do
            if is_jvm_ready; then
                READY=1
                break
            fi
            sleep 2
        done
        if [ "$READY" -eq 0 ]; then
            echo "JVM server failed to become ready. Falling back to Prism."
            docker stop $DOCKER_CONTAINER_NAME >/dev/null 2>&1 || true
            USE_PRISM=1
        fi
    else
        USE_PRISM=1
    fi
fi

if [ "$USE_PRISM" -eq 1 ]; then
    echo "Starting Prism mock servers (fallback non-JVM version)..."
    npx @stoplight/prism-cli mock ../petstore.json -p 4010 -d >/dev/null 2>&1 &
    PRISM_SWAGGER=$!
    npx @stoplight/prism-cli mock ../petstore_oas3.json -p 4011 -d >/dev/null 2>&1 &
    PRISM_OAS3=$!
    echo "Waiting for Prism servers to start..."
    for i in {1..30}; do
        if curl -s http://127.0.0.1:4010 > /dev/null && curl -s http://127.0.0.1:4011 > /dev/null; then
            break
        fi
        sleep 1
    done
fi

cat << 'EOF2' > test-sdks.ts
import { StoreClient as SwaggerStoreClient } from './.test_out_swagger/dist/services/store.client.js';
import { PetsClient as OpenApiPetsClient } from './.test_out_openapi/dist/services/pets.client.js';

async function run() {
    const usePrism = process.env.USE_PRISM === '1';
    const swaggerPort = usePrism ? '4010' : '8080/api';
    const openapiPort = usePrism ? '4011' : '8080/v1';

    console.log(`Testing Swagger 2.0 SDK against mock server (port ${swaggerPort})...`);
    const swaggerClient = new SwaggerStoreClient(`http://127.0.0.1:${swaggerPort}`);
    await swaggerClient.getInventory({ headers: { api_key: 'special-key' } });
    console.log("Swagger 2.0 OK");

    console.log(`Testing OpenAPI 3.0 SDK against mock server (port ${openapiPort})...`);
    const openapiClient = new OpenApiPetsClient(`http://127.0.0.1:${openapiPort}`);
    await openapiClient.listPets();
    console.log("OpenAPI 3.0 OK");
}
run().catch(e => { console.error(e); process.exit(1); });
EOF2

USE_PRISM=$USE_PRISM npx tsc test-sdks.ts --module NodeNext --moduleResolution NodeNext || { echo "test-sdks compilation failed"; exit 1; }
node test-sdks.js || { echo "test-sdks execution failed"; exit 1; }

if [ "$USE_PRISM" -eq 0 ]; then
    if [ "$STARTED_DOCKER" -eq 1 ]; then
        docker stop $DOCKER_CONTAINER_NAME >/dev/null 2>&1 || true
    fi
else
    kill $PRISM_SWAGGER || true
    kill $PRISM_OAS3 || true
fi
rm -f test-sdks.ts test-sdks.js
