/**
 * Register File Abstraction for State256 VM
 *
 * Maps symbolic atoms to hardware SIMD registers:
 * - ARM64 (NEON): 32×128-bit registers (V0-V31)
 * - x86-64 (AVX-512): 16×512-bit registers (ZMM0-ZMM15)
 * - ESP32 (ULP): 4×16-bit registers (R0-R3)
 *
 * Key concept: Float registers store geometric positions (on spheres),
 * not numeric measurements. The FPU performs symbolic geometry.
 */

import { NodeId } from "@metaverse-kit/protocol";
import type { WasmSimdBackend } from "../wasm/simd-backend.js";

// ============================================================================
// Architecture Detection
// ============================================================================

export enum Architecture {
  ESP32 = "esp32",
  ARM64 = "arm64",
  X86_64 = "x86_64",
  GENERIC = "generic"
}

export interface ArchitectureInfo {
  arch: Architecture;
  simdWidth: number;      // Bits per SIMD lane
  registerCount: number;  // Number of SIMD registers
  maxAtoms: number;       // Max atoms that fit in register file
}

const ARCH_SPECS: Record<Architecture, ArchitectureInfo> = {
  [Architecture.ESP32]: {
    arch: Architecture.ESP32,
    simdWidth: 16,
    registerCount: 4,
    maxAtoms: 4  // Logic4 level only
  },
  [Architecture.ARM64]: {
    arch: Architecture.ARM64,
    simdWidth: 128,
    registerCount: 32,
    maxAtoms: 256  // Full State256 (32 regs × 8 floats = 256)
  },
  [Architecture.X86_64]: {
    arch: Architecture.X86_64,
    simdWidth: 512,
    registerCount: 16,
    maxAtoms: 256  // Full State256 (16 regs × 16 floats = 256)
  },
  [Architecture.GENERIC]: {
    arch: Architecture.GENERIC,
    simdWidth: 32,
    registerCount: 1,
    maxAtoms: 256  // Fallback to flat array
  }
};

export function detectArchitecture(): ArchitectureInfo {
  // Simple heuristic based on platform
  if (typeof process !== "undefined") {
    const arch = process.arch;
    if (arch === "arm64") return ARCH_SPECS[Architecture.ARM64];
    if (arch === "x64") return ARCH_SPECS[Architecture.X86_64];
  }
  return ARCH_SPECS[Architecture.GENERIC];
}

// ============================================================================
// Symbolic Atom (32-bit packed representation)
// ============================================================================

/**
 * A symbolic atom packed into 32 bits:
 * - Bits 0-23: NodeId hash (24 bits)
 * - Bits 24-27: Dimension level (0-8)
 * - Bits 28-30: Slot within level (0-7)
 * - Bit 31: Orientation flag (forward/backward)
 */
export class SymbolicAtom {
  private readonly value: number;

  constructor(
    nodeIdHash: number,
    dimension: number,
    slot: number,
    orientation: boolean
  ) {
    this.value =
      ((nodeIdHash & 0xFFFFFF) << 0) |
      ((dimension & 0xF) << 24) |
      ((slot & 0x7) << 28) |
      ((orientation ? 1 : 0) << 31);
  }

  static fromNodeId(nodeId: NodeId): SymbolicAtom {
    const hash = hashNodeId(nodeId);
    return new SymbolicAtom(hash, 0, 0, true);
  }

  get nodeIdHash(): number {
    return (this.value >>> 0) & 0xFFFFFF;
  }

  get dimension(): number {
    return (this.value >>> 24) & 0xF;
  }

  get slot(): number {
    return (this.value >>> 28) & 0x7;
  }

  get orientation(): boolean {
    return ((this.value >>> 31) & 0x1) === 1;
  }

  toFloat(): number {
    // Reinterpret 32-bit int as float (IEEE 754)
    const buffer = new ArrayBuffer(4);
    new Int32Array(buffer)[0] = this.value;
    return new Float32Array(buffer)[0];
  }

  static fromFloat(f: number): SymbolicAtom {
    const buffer = new ArrayBuffer(4);
    new Float32Array(buffer)[0] = f;
    const value = new Int32Array(buffer)[0];
    return Object.create(SymbolicAtom.prototype, {
      value: { value, writable: false }
    });
  }

  toString(): string {
    return `Atom<hash:0x${this.nodeIdHash.toString(16)},dim:${this.dimension},slot:${this.slot},orient:${this.orientation}>`;
  }
}

function hashNodeId(nodeId: NodeId): number {
  let hash = 0;
  for (let i = 0; i < nodeId.length; i++) {
    hash = ((hash << 5) - hash + nodeId.charCodeAt(i)) | 0;
  }
  return hash >>> 0; // Ensure unsigned
}

// ============================================================================
// Register File (Hardware Abstraction)
// ============================================================================

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * RegisterFile provides a hardware-aware abstraction over SIMD registers.
 *
 * Key operations:
 * - load(): Pack atoms into registers
 * - store(): Unpack atoms from registers
 * - transform(): Apply geometric transformations (Möbius)
 * - hash(): Compute register file hash for verification
 */
export class RegisterFile {
  private readonly arch: ArchitectureInfo;
  private readonly data: Float32Array;
  private readonly atomMap: Map<NodeId, number>; // NodeId → register slot
  private wasmBackend?: WasmSimdBackend;

  constructor(arch?: ArchitectureInfo, wasmBackend?: WasmSimdBackend) {
    this.arch = arch || detectArchitecture();
    this.data = new Float32Array(this.arch.maxAtoms);
    this.atomMap = new Map();
    this.wasmBackend = wasmBackend;
  }

  // ========================================================================
  // Load Operations (Symbolic → Hardware)
  // ========================================================================

  /**
   * Load a single atom into the register file
   */
  loadAtom(nodeId: NodeId, slot: number): void {
    if (slot >= this.arch.maxAtoms) {
      throw new Error(`Slot ${slot} exceeds max atoms ${this.arch.maxAtoms}`);
    }

    const atom = SymbolicAtom.fromNodeId(nodeId);
    this.data[slot] = atom.toFloat();
    this.atomMap.set(nodeId, slot);
  }

  /**
   * Load atoms in batch (optimized for SIMD)
   */
  loadBatch(nodeIds: NodeId[], startSlot: number = 0): void {
    for (let i = 0; i < nodeIds.length; i++) {
      this.loadAtom(nodeIds[i], startSlot + i);
    }
  }

  /**
   * Load Logic4 (4 atoms) - maps to single SIMD register on ARM64
   */
  loadLogic4(atoms: [NodeId, NodeId, NodeId, NodeId]): void {
    if (atoms.length !== 4) {
      throw new Error("Logic4 requires exactly 4 atoms");
    }
    this.loadBatch(atoms, 0);
  }

  /**
   * Load Record16 (16 atoms) - maps to S^15 sphere
   */
  loadRecord16(atoms: NodeId[]): void {
    if (atoms.length !== 16) {
      throw new Error("Record16 requires exactly 16 atoms");
    }
    this.loadBatch(atoms, 0);
  }

  /**
   * Load Context64 (64 atoms) - maps to S^63 sphere
   */
  loadContext64(atoms: NodeId[]): void {
    if (atoms.length !== 64) {
      throw new Error("Context64 requires exactly 64 atoms");
    }
    this.loadBatch(atoms, 0);
  }

  /**
   * Load State256 (256 atoms) - full register file
   */
  loadState256(atoms: NodeId[]): void {
    if (atoms.length > this.arch.maxAtoms) {
      throw new Error(`Cannot load ${atoms.length} atoms, max is ${this.arch.maxAtoms}`);
    }
    this.loadBatch(atoms, 0);
  }

  // ========================================================================
  // Store Operations (Hardware → Symbolic)
  // ========================================================================

  /**
   * Get atom at specific slot
   */
  getAtom(slot: number): SymbolicAtom {
    if (slot >= this.arch.maxAtoms) {
      throw new Error(`Slot ${slot} out of bounds`);
    }
    return SymbolicAtom.fromFloat(this.data[slot]);
  }

  /**
   * Get NodeId for slot (reverse lookup)
   */
  getNodeId(slot: number): NodeId | undefined {
    for (const [nodeId, mappedSlot] of this.atomMap.entries()) {
      if (mappedSlot === slot) {
        return nodeId;
      }
    }
    return undefined;
  }

  /**
   * Get all atoms in canonical order
   */
  getAllAtoms(): SymbolicAtom[] {
    const atoms: SymbolicAtom[] = [];
    for (let i = 0; i < this.arch.maxAtoms; i++) {
      atoms.push(this.getAtom(i));
    }
    return atoms;
  }

  // ========================================================================
  // Geometric Operations (Symbolic Geometry via FPU)
  // ========================================================================

  /**
   * Interpret register slot as 3D position on sphere
   */
  getPosition(slot: number): Vec3 {
    // Decode geometric position from float register
    // This is where "numbers are geometric positions, not measurements"
    const f = this.data[slot];

    // Use IEEE 754 bit pattern to derive position on unit sphere
    const buffer = new ArrayBuffer(4);
    new Float32Array(buffer)[0] = f;
    const bits = new Uint32Array(buffer)[0];

    // Spherical coordinates from bit pattern
    const theta = ((bits >>> 0) & 0xFFFF) / 0xFFFF * Math.PI * 2;
    const phi = ((bits >>> 16) & 0xFFFF) / 0xFFFF * Math.PI;

    return {
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.sin(phi) * Math.sin(theta),
      z: Math.cos(phi)
    };
  }

  /**
   * Set position as geometric point on sphere
   */
  setPosition(slot: number, pos: Vec3): void {
    // Convert 3D position to spherical coordinates
    const r = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
    const theta = Math.atan2(pos.y, pos.x);
    const phi = Math.acos(pos.z / r);

    // Pack into IEEE 754 bit pattern
    const thetaBits = Math.floor((theta / (Math.PI * 2)) * 0xFFFF) & 0xFFFF;
    const phiBits = Math.floor((phi / Math.PI) * 0xFFFF) & 0xFFFF;
    const bits = (phiBits << 16) | thetaBits;

    const buffer = new ArrayBuffer(4);
    new Uint32Array(buffer)[0] = bits;
    this.data[slot] = new Float32Array(buffer)[0];
  }

  /**
   * Compute centroid of all atoms (center of mass)
   */
  computeCentroid(): Vec3 {
    let sumX = 0, sumY = 0, sumZ = 0;
    let count = 0;

    for (let i = 0; i < this.arch.maxAtoms; i++) {
      const pos = this.getPosition(i);
      sumX += pos.x;
      sumY += pos.y;
      sumZ += pos.z;
      count++;
    }

    return {
      x: sumX / count,
      y: sumY / count,
      z: sumZ / count
    };
  }

  /**
   * Translate all positions by offset (Möbius: translation component)
   */
  translate(offset: Vec3): void {
    for (let i = 0; i < this.arch.maxAtoms; i++) {
      const pos = this.getPosition(i);
      this.setPosition(i, {
        x: pos.x + offset.x,
        y: pos.y + offset.y,
        z: pos.z + offset.z
      });
    }
  }

  /**
   * Scale all positions by factor (Möbius: dilation component)
   */
  scale(factor: number): void {
    for (let i = 0; i < this.arch.maxAtoms; i++) {
      const pos = this.getPosition(i);
      this.setPosition(i, {
        x: pos.x * factor,
        y: pos.y * factor,
        z: pos.z * factor
      });
    }
  }

  /**
   * Rotate all positions by quaternion (Möbius: rotation component)
   */
  rotate(quat: Vec4): void {
    for (let i = 0; i < this.arch.maxAtoms; i++) {
      const pos = this.getPosition(i);
      const rotated = rotateByQuaternion(pos, quat);
      this.setPosition(i, rotated);
    }
  }

  // ========================================================================
  // Verification (Merkle Anchor)
  // ========================================================================

  /**
   * Hash the entire register file for verification
   * Uses SIMD-optimized hashing where available
   */
  hash(): number {
    if (this.wasmBackend) {
      return this.wasmBackend.hash(this.data);
    }

    let h = 0x811c9dc5; // FNV-1a offset basis

    for (let i = 0; i < this.arch.maxAtoms; i++) {
      const buffer = new ArrayBuffer(4);
      new Float32Array(buffer)[0] = this.data[i];
      const bytes = new Uint8Array(buffer);

      for (let j = 0; j < 4; j++) {
        h ^= bytes[j];
        h = Math.imul(h, 0x01000193); // FNV-1a prime
      }
    }

    return h >>> 0; // Unsigned 32-bit
  }

  /**
   * Get register file as hex string for verification
   */
  toHex(): string {
    return this.hash().toString(16).padStart(8, '0');
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  get architecture(): ArchitectureInfo {
    return this.arch;
  }

  get capacity(): number {
    return this.arch.maxAtoms;
  }

  get size(): number {
    return this.atomMap.size;
  }

  clear(): void {
    this.data.fill(0);
    this.atomMap.clear();
  }

  setWasmBackend(backend: WasmSimdBackend | undefined): void {
    this.wasmBackend = backend;
  }

  clone(): RegisterFile {
    const clone = new RegisterFile(this.arch, this.wasmBackend);
    clone.data.set(this.data);
    for (const [nodeId, slot] of this.atomMap.entries()) {
      clone.atomMap.set(nodeId, slot);
    }
    return clone;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function rotateByQuaternion(v: Vec3, q: Vec4): Vec3 {
  // Quaternion rotation: v' = q * v * q^-1
  const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
  const vx = v.x, vy = v.y, vz = v.z;

  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);

  // v' = v + q.w * t + cross(q.xyz, t)
  return {
    x: vx + qw * tx + (qy * tz - qz * ty),
    y: vy + qw * ty + (qz * tx - qx * tz),
    z: vz + qw * tz + (qx * ty - qy * tx)
  };
}
