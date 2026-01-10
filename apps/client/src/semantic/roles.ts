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
  roleToAsset: Record<SemanticRole, { svg?: string; glb?: string; voxel?: string }>;
};

export const DEFAULT_ASSET_PACKS: AssetPack[] = [
  {
    id: "minimal",
    label: "Minimal",
    roleToAsset: {
      law: { svg: "symbol:law", glb: "gltf-sample:BoxAnimated@glb", voxel: "voxel:block" },
      wisdom: { svg: "symbol:wisdom", glb: "gltf-sample:Avocado@glb", voxel: "voxel:cluster" },
      identity: { svg: "symbol:identity", glb: "gltf-sample:DamagedHelmet@glb", voxel: "voxel:cluster" },
      witness: { svg: "symbol:witness", glb: "gltf-sample:Fox@glb", voxel: "voxel:block" },
      boundary: { svg: "symbol:boundary", glb: "gltf-sample:Box@glb", voxel: "voxel:plane" },
      gate: { svg: "symbol:gate", glb: "gltf-sample:BoxTextured@glb", voxel: "voxel:gate" },
      tower: { svg: "symbol:tower", glb: "gltf-sample:Box@glb", voxel: "voxel:tower" },
      flood: { svg: "symbol:flood", glb: "gltf-sample:WaterBottle@glb", voxel: "voxel:flow" },
      ark: { svg: "symbol:ark", glb: "gltf-sample:Box@glb", voxel: "voxel:cluster" },
      conversation: { svg: "symbol:conversation", glb: "gltf-sample:OrientationTest@glb", voxel: "voxel:pair" },
      alignment: { svg: "symbol:alignment", glb: "gltf-sample:BoxAnimated@glb", voxel: "voxel:line" },
    },
  },
  {
    id: "monument",
    label: "Monument",
    roleToAsset: {
      law: { svg: "symbol:law", glb: "gltf-sample:BoxTextured@glb", voxel: "voxel:block" },
      wisdom: { svg: "symbol:wisdom", glb: "gltf-sample:BoxTextured@glb", voxel: "voxel:cluster" },
      identity: { svg: "symbol:identity", glb: "gltf-sample:BoxTextured@glb", voxel: "voxel:cluster" },
      witness: { svg: "symbol:witness", glb: "gltf-sample:Fox@glb", voxel: "voxel:block" },
      boundary: { svg: "symbol:boundary", glb: "gltf-sample:BoxTextured@glb", voxel: "voxel:plane" },
      gate: { svg: "symbol:gate", glb: "gltf-sample:Box@glb", voxel: "voxel:gate" },
      tower: { svg: "symbol:tower", glb: "gltf-sample:BoxAnimated@glb", voxel: "voxel:tower" },
      flood: { svg: "symbol:flood", glb: "gltf-sample:WaterBottle@glb", voxel: "voxel:flow" },
      ark: { svg: "symbol:ark", glb: "gltf-sample:Box@glb", voxel: "voxel:cluster" },
      conversation: { svg: "symbol:conversation", glb: "gltf-sample:OrientationTest@glb", voxel: "voxel:pair" },
      alignment: { svg: "symbol:alignment", glb: "gltf-sample:BoxAnimated@glb", voxel: "voxel:line" },
    },
  },
];

export function getAssetForRole(packId: string, role: SemanticRole, packs: AssetPack[] = DEFAULT_ASSET_PACKS) {
  const pack = packs.find((p) => p.id === packId) ?? packs[0];
  return pack.roleToAsset[role];
}
