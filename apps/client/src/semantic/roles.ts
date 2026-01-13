export const SEMANTIC_ROLES = [
  "law",
  "wisdom",
  "identity",
  "witness",
  "boundary",
  "gate",
  "tower",
  "flood",
  "ark",
  "conversation",
  "alignment",
] as const;

export type SemanticRole = (typeof SEMANTIC_ROLES)[number];

export type AssetPack = {
  id: string;
  label: string;
  roleToAsset: Record<SemanticRole, { svg?: string; glb?: string }>;
};

export const DEFAULT_ASSET_PACKS: AssetPack[] = [
  {
    id: "minimal",
    label: "Minimal",
    roleToAsset: {
      law: { svg: "symbol:law", glb: "gltf-sample:BoxAnimated@glb" },
      wisdom: { svg: "symbol:wisdom", glb: "gltf-sample:Avocado@glb" },
      identity: { svg: "symbol:identity", glb: "gltf-sample:DamagedHelmet@glb" },
      witness: { svg: "symbol:witness", glb: "gltf-sample:Fox@glb" },
      boundary: { svg: "symbol:boundary", glb: "gltf-sample:Box@glb" },
      gate: { svg: "symbol:gate", glb: "gltf-sample:BoxTextured@glb" },
      tower: { svg: "symbol:tower", glb: "gltf-sample:Box@glb" },
      flood: { svg: "symbol:flood", glb: "gltf-sample:WaterBottle@glb" },
      ark: { svg: "symbol:ark", glb: "gltf-sample:Box@glb" },
      conversation: { svg: "symbol:conversation", glb: "gltf-sample:OrientationTest@glb" },
      alignment: { svg: "symbol:alignment", glb: "gltf-sample:BoxAnimated@glb" },
    },
  },
  {
    id: "monument",
    label: "Monument",
    roleToAsset: {
      law: { svg: "symbol:law", glb: "gltf-sample:BoxTextured@glb" },
      wisdom: { svg: "symbol:wisdom", glb: "gltf-sample:BoxTextured@glb" },
      identity: { svg: "symbol:identity", glb: "gltf-sample:BoxTextured@glb" },
      witness: { svg: "symbol:witness", glb: "gltf-sample:Fox@glb" },
      boundary: { svg: "symbol:boundary", glb: "gltf-sample:BoxTextured@glb" },
      gate: { svg: "symbol:gate", glb: "gltf-sample:Box@glb" },
      tower: { svg: "symbol:tower", glb: "gltf-sample:BoxAnimated@glb" },
      flood: { svg: "symbol:flood", glb: "gltf-sample:WaterBottle@glb" },
      ark: { svg: "symbol:ark", glb: "gltf-sample:Box@glb" },
      conversation: { svg: "symbol:conversation", glb: "gltf-sample:OrientationTest@glb" },
      alignment: { svg: "symbol:alignment", glb: "gltf-sample:BoxAnimated@glb" },
    },
  },
];

export function getAssetForRole(packId: string, role: SemanticRole, packs: AssetPack[] = DEFAULT_ASSET_PACKS) {
  const pack = packs.find((p) => p.id === packId) ?? packs[0];
  return pack.roleToAsset[role];
}
