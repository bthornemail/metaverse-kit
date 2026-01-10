import type { Basis32FeatureName, Basis32FeatureVector, Basis32Input } from "./types.js";

export const BASIS32_VERSION = "BASIS32.v1";

export const BASIS32_FEATURES: Basis32FeatureName[] = [
  "node_count_log",
  "link_count_log",
  "component_count",
  "churn_rate",
  "edit_entropy",
  "merge_frequency",
  "tile_hop_spread",
  "authority_source_ratio",
  "boundary_strictness",
  "policy_privacy_level",
  "federation_size_log",
  "witness_density",
  "intent_emergency",
  "intent_logistics",
  "intent_chat",
  "intent_mapping",
  "intent_commerce",
  "intent_art",
  "intent_simulation",
  "intent_sensor",
  "geo_present",
  "geo_accuracy_bucket",
  "ble_rssi_bucket",
  "wifi_rssi_bucket",
  "lora_snr_bucket",
  "peer_density",
  "broker_hops",
  "avg_velocity_bucket",
  "collision_rate_bucket",
  "stability_score",
  "anomaly_score_rule",
  "recency_decay",
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function bucketLog2(value: number | undefined, maxBucket: number): number {
  const v = Math.max(0, value ?? 0);
  const b = Math.floor(Math.log2(v + 1));
  return clamp(b, 0, maxBucket);
}

function bucket01(value: number | undefined, buckets: number): number {
  const v = clamp01(value ?? 0);
  const idx = Math.floor(v * buckets);
  return clamp(idx, 0, buckets - 1);
}

function bucketRssi(value: number | undefined): number {
  if (value === undefined || value === null) return 0;
  if (value >= -40) return 3;
  if (value >= -70) return 2;
  if (value >= -90) return 1;
  return 0;
}

function bucketSnr(value: number | undefined): number {
  if (value === undefined || value === null) return 0;
  if (value >= 10) return 3;
  if (value >= 0) return 2;
  if (value >= -10) return 1;
  return 0;
}

function bucketAccuracyMeters(value: number | undefined): number {
  if (value === undefined || value === null) return 0;
  if (value <= 20) return 3;
  if (value <= 100) return 2;
  if (value <= 500) return 1;
  return 0;
}

function bucketVelocity(value: number | undefined): number {
  const v = Math.max(0, value ?? 0);
  if (v >= 10) return 3;
  if (v >= 3) return 2;
  if (v > 0) return 1;
  return 0;
}

export function computeBasis32(input: Basis32Input): Basis32FeatureVector {
  const intent = input.intent ?? {};

  const features: Basis32FeatureVector = [
    bucketLog2(input.nodeCount, 3),
    bucketLog2(input.linkCount, 3),
    bucketLog2(input.componentCount, 3),
    bucket01(input.churnRate, 4),
    bucket01(input.editEntropy, 4),
    bucketLog2(input.mergeFrequency, 3),
    bucket01(input.tileHopSpread, 4),
    bucket01(input.authoritySourceRatio, 4),
    bucket01(input.boundaryStrictness, 4),
    bucket01(input.policyPrivacyLevel, 4),
    bucketLog2(input.federationSize, 3),
    bucket01(input.witnessDensity, 4),
    intent.emergency ? 1 : 0,
    intent.logistics ? 1 : 0,
    intent.chat ? 1 : 0,
    intent.mapping ? 1 : 0,
    intent.commerce ? 1 : 0,
    intent.art ? 1 : 0,
    intent.simulation ? 1 : 0,
    intent.sensor ? 1 : 0,
    input.geoPresent ? 1 : 0,
    bucketAccuracyMeters(input.geoAccuracyM),
    bucketRssi(input.bleRssi),
    bucketRssi(input.wifiRssi),
    bucketSnr(input.loraSnr),
    bucketLog2(input.peerDensity, 3),
    bucketLog2(input.brokerHops, 3),
    bucketVelocity(input.avgVelocity),
    bucket01(input.collisionRate, 4),
    bucket01(input.stabilityScore, 4),
    bucket01(input.anomalyScore, 4),
    bucket01(input.recencyDecay, 4),
  ];

  return features;
}

export function packBasis32To64(features: Basis32FeatureVector): string {
  if (features.length !== 32) {
    throw new Error("BASIS32 pack64 requires 32 features");
  }

  let acc = 0n;
  for (let i = 0; i < 32; i++) {
    const v = BigInt(features[i] & 0x3);
    acc |= v << BigInt(i * 2);
  }

  return `0x${acc.toString(16).padStart(16, "0")}`;
}

export function packBasis32To128(features: Basis32FeatureVector): [string, string] {
  if (features.length !== 32) {
    throw new Error("BASIS32 pack128 requires 32 features");
  }

  let low = 0n;
  let high = 0n;

  for (let i = 0; i < 16; i++) {
    const v = BigInt(features[i] & 0xf);
    low |= v << BigInt(i * 4);
  }

  for (let i = 16; i < 32; i++) {
    const v = BigInt(features[i] & 0xf);
    high |= v << BigInt((i - 16) * 4);
  }

  return [
    `0x${low.toString(16).padStart(16, "0")}`,
    `0x${high.toString(16).padStart(16, "0")}`,
  ];
}

export type { Basis32FeatureName, Basis32FeatureVector, Basis32Input };
