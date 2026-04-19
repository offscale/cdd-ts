// @external imports matching Go's C-ABI exports
@external("env", "ParseSource")
export declare function ParseSource(filenamePtr: usize, filenameLen: usize, sourcePtr: usize, sourceLen: usize): u32;

@external("env", "GetNodeChildren")
export declare function GetNodeChildren(nodeId: u32, outArrayPtr: usize): i32;

@external("env", "GetNodeKind")
export declare function GetNodeKind(nodeId: u32): i32;

@external("env", "GetNodeText")
export declare function GetNodeText(nodeId: u32, outPtr: usize): i32;

@external("env", "wasm_free")
export declare function wasm_free(ptr: usize, size: i32): void;
