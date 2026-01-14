export interface WasmSimdBackend {
  hash(data: Float32Array): number;
}

export interface WasmSimdBackendHandle {
  backend: WasmSimdBackend;
  instance: WebAssembly.Instance;
  memory: WebAssembly.Memory;
}

export async function loadWasmSimdBackend(bytes: ArrayBuffer): Promise<WasmSimdBackendHandle> {
  const module = await WebAssembly.compile(bytes);
  const memory = new WebAssembly.Memory({ initial: 1 });
  const instance = await WebAssembly.instantiate(module, { env: { memory } });

  if (typeof instance.exports.hash !== "function") {
    throw new Error("WASM backend missing hash export");
  }

  const hashExport = instance.exports.hash as (ptr: number, len: number) => number;
  const hashSimdExport = typeof instance.exports.hash_simd === "function"
    ? (instance.exports.hash_simd as (ptr: number, len: number) => number)
    : null;

  const backend: WasmSimdBackend = {
    hash(data: Float32Array): number {
      const byteLength = data.byteLength;
      const ptr = 0;
      const bytes = new Uint8Array(memory.buffer, ptr, byteLength);
      bytes.set(new Uint8Array(data.buffer, data.byteOffset, byteLength));
      if (hashSimdExport) {
        return hashSimdExport(ptr, byteLength) >>> 0;
      }
      return hashExport(ptr, byteLength) >>> 0;
    }
  };

  return { backend, instance, memory };
}
