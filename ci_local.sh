set -e
npm run lint
npm run check:types
npm run-script docs
npm run-script test:coverage
npm run-script build
make build_wasm
