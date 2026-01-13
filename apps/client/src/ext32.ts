import {
  Ext32Registry,
  type Ext32Pack,
  type Ext32Assets,
  type Ext32Interaction,
} from "@metaverse-kit/ext32";

export const ext32Registry = new Ext32Registry();

export async function loadExt32Packs() {
  const res = await fetch("/ext32/packs");
  if (!res.ok) return;
  const data = await res.json();
  if (Array.isArray(data?.packs)) {
    data.packs.forEach((pack: Ext32Pack) => ext32Registry.register(pack));
  }
}

export async function registerExt32Pack(pack: Ext32Pack) {
  const res = await fetch("/ext32/packs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pack }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to register pack");
  }
}

function mergeAssets(base: Ext32Assets | null, next: Ext32Assets | null): Ext32Assets | null {
  if (!base && !next) return null;
  return { ...(base ?? {}), ...(next ?? {}) };
}

function assetsForPack(packId: string, role?: string): Ext32Assets | null {
  const pack = ext32Registry.get(packId);
  if (!pack) return null;
  if (role && pack.assets?.roles?.[role]) {
    return mergeAssets(pack.assets.default ?? null, pack.assets.roles[role] ?? null);
  }
  return pack.assets?.default ?? null;
}

export function resolveExt32Assets(
  packId: string,
  role?: string,
  featureIds: string[] = []
): Ext32Assets | null {
  let resolved = assetsForPack(packId, role);
  for (const featureId of featureIds) {
    const next = assetsForPack(featureId, role);
    resolved = mergeAssets(resolved, next);
  }
  return resolved;
}

export function resolveExt32InteractionList(packId: string, featureIds: string[] = []): Ext32Interaction[] {
  const base = ext32Registry.resolveInteractions(packId);
  if (!featureIds.length) return base;
  const extras = featureIds.flatMap((featureId) => ext32Registry.resolveInteractions(featureId));
  return [...base, ...extras];
}
