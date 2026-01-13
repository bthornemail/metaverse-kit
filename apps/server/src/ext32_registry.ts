import fs from "fs";
import path from "path";
import { Ext32Registry, type Ext32Pack } from "@metaverse-kit/ext32";

export const ext32Registry = new Ext32Registry();
let storagePath = "";

export function initExt32Registry(rootDir: string) {
  storagePath = path.join(rootDir, "ext32_packs.json");
  if (!fs.existsSync(storagePath)) return;
  try {
    const raw = fs.readFileSync(storagePath, "utf-8");
    ext32Registry.loadFromJson(raw);
  } catch {
    // ignore load errors
  }
}

function persist() {
  if (!storagePath) return;
  try {
    fs.writeFileSync(storagePath, ext32Registry.toJson(), "utf-8");
  } catch {
    // ignore persistence errors
  }
}

export function registerExt32Pack(pack: Ext32Pack) {
  ext32Registry.register(pack);
  persist();
}

export function listExt32Packs() {
  return ext32Registry.list();
}

export function validateExt32Pack(pack: unknown): string[] {
  const problems: string[] = [];
  const obj = pack as Record<string, unknown>;

  if (!obj || typeof obj !== "object") {
    return ["pack must be an object"];
  }
  if (typeof obj.pack_id !== "string") problems.push("pack_id must be a string");
  if (typeof obj.namespace !== "string") problems.push("namespace must be a string");
  if (typeof obj.version !== "string") problems.push("version must be a string");
  if (!Array.isArray(obj.features)) problems.push("features must be an array");

  const allowedTypes = new Set(["enum", "float", "int", "bool", "string"]);
  if (Array.isArray(obj.features)) {
    obj.features.forEach((feature, idx) => {
      if (!feature || typeof feature !== "object") {
        problems.push(`features[${idx}] must be an object`);
        return;
      }
      const f = feature as Record<string, unknown>;
      if (typeof f.id !== "string") problems.push(`features[${idx}].id must be a string`);
      if (typeof f.type !== "string" || !allowedTypes.has(f.type)) {
        problems.push(`features[${idx}].type must be enum|float|int|bool|string`);
      }
      if (f.type === "enum" && !Array.isArray(f.values)) {
        problems.push(`features[${idx}].values must be an array for enum`);
      }
    });
  }

  if (obj.assets && typeof obj.assets !== "object") {
    problems.push("assets must be an object");
  }
  if (obj.interactions) {
    const isObj = typeof obj.interactions === "object";
    const isArr = Array.isArray(obj.interactions);
    if (!isObj && !isArr) {
      problems.push("interactions must be an array or object");
    }
  }

  return problems;
}
