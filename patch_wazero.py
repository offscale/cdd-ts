import re
with open('../ts-morph/packages/compiler-go-source/cmd/wasm-wasi/main.go', 'r') as f:
    code = f.read()

malloc = """
var memoryPool [][]byte

//go:wasmexport wasm_malloc
func wasm_malloc(size int32) int32 {
	b := make([]byte, size)
	memoryPool = append(memoryPool, b)
	ptr := &b[0]
	return int32(uintptr(unsafe.Pointer(ptr)))
}
"""
code = re.sub(r'//go:wasmexport wasm_malloc\nfunc wasm_malloc\(size int32\) int32 \{[\s\S]*?return int32\(uintptr\(unsafe\.Pointer\(ptr\)\)\)\n\}', malloc.strip(), code)

with open('../ts-morph/packages/compiler-go-source/cmd/wasm-wasi/main.go', 'w') as f:
    f.write(code)
