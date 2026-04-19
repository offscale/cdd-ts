import { ParseSource, GetNodeChildren, GetNodeKind, GetNodeText, wasm_free } from "./ffi";

// String Encoding Utilities
// In AssemblyScript, Strings are UTF-16. Go expects UTF-8.
export function encodeUTF8(str: string): ArrayBuffer {
  return String.UTF8.encode(str);
}

export function decodeUTF8(ptr: usize, len: i32): string {
  let buf = new ArrayBuffer(len);
  memory.copy(changetype<usize>(buf), ptr, len);
  return String.UTF8.decode(buf);
}

export class Node {
  id: u32;

  constructor(id: u32) {
    this.id = id;
  }

  getKind(): i32 {
    return GetNodeKind(this.id);
  }

  getText(): string {
    let outPtrBox = memory.data(4); // allocate 4 bytes to hold the pointer
    let len = GetNodeText(this.id, outPtrBox);
    if (len <= 0) return "";
    let ptr = load<u32>(outPtrBox);
    let text = decodeUTF8(ptr as usize, len);
    // memory leak prevention: request Go host to free the returned memory
    wasm_free(ptr as usize, len);
    return text;
  }

  getChildren(): Node[] {
    let outArrayPtrBox = memory.data(4);
    let count = GetNodeChildren(this.id, outArrayPtrBox);
    if (count <= 0) return [];
    
    let arrayPtr = load<u32>(outArrayPtrBox);
    let children = new Array<Node>(count);
    
    for (let i = 0; i < count; i++) {
      let childId = load<u32>(arrayPtr + (i * 4));
      children[i] = new Node(childId);
    }
    
    // Free the array memory allocated by Go
    wasm_free(arrayPtr as usize, count * 4);
    return children;
  }

  dispose(): void {
    // Explicit dispose if we need to free node from Go map
    // (Assuming we had an export FreeNode(id: u32))
  }
}

export class SourceFile extends Node {
  constructor(id: u32) {
    super(id);
  }

  // Example proxy logic
  getStatementCount(): i32 {
    return this.getChildren().length;
  }
}

export function parseSourceFile(filename: string, source: string): SourceFile | null {
  let filenameBuf = encodeUTF8(filename);
  let sourceBuf = encodeUTF8(source);

  let rootId = ParseSource(
    changetype<usize>(filenameBuf), filenameBuf.byteLength,
    changetype<usize>(sourceBuf), sourceBuf.byteLength
  );

  if (rootId == 0) return null;
  return new SourceFile(rootId);
}
