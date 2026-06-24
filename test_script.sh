#!/bin/bash
set -e

# Run the swagger 2.0 to_server test
echo "Generating Server for Swagger 2.0..."
node dist/cli.js from_openapi to_server -i ../petstore.json -o .test_out_server_swagger --orm typeorm
cd .test_out_server_swagger
npm install
npm run build
cd ..

# Run the openapi 3.2 to_server test
echo "Generating Server for OpenAPI 3.2..."
node dist/cli.js from_openapi to_server -i ../petstore_oas3.json -o .test_out_server_openapi --orm typeorm
cd .test_out_server_openapi
npm install
npm run build
cd ..

echo "Done"
