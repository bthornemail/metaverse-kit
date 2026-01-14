import fs from "fs/promises";
import { loadWasmSimdBackend, type WasmSimdBackend } from "./simd-backend.js";

const DEFAULT_WASM_PATH = new URL("../../wasm/hash-kernel.wasm", import.meta.url);

export async function loadWasmHashBackend(): Promise<WasmSimdBackend> {
  const bytes = await fs.readFile(DEFAULT_WASM_PATH);
  const { backend } = await loadWasmSimdBackend(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return backend;
}
