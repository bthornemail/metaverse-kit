export type Basis32FeatureName =
  | "node_count_log"
  | "link_count_log"
  | "component_count"
  | "churn_rate"
  | "edit_entropy"
  | "merge_frequency"
  | "tile_hop_spread"
  | "authority_source_ratio"
  | "boundary_strictness"
  | "policy_privacy_level"
  | "federation_size_log"
  | "witness_density"
  | "intent_emergency"
  | "intent_logistics"
  | "intent_chat"
  | "intent_mapping"
  | "intent_commerce"
  | "intent_art"
  | "intent_simulation"
  | "intent_sensor"
  | "geo_present"
  | "geo_accuracy_bucket"
  | "ble_rssi_bucket"
  | "wifi_rssi_bucket"
  | "lora_snr_bucket"
  | "peer_density"
  | "broker_hops"
  | "avg_velocity_bucket"
  | "collision_rate_bucket"
  | "stability_score"
  | "anomaly_score_rule"
  | "recency_decay";

export type Basis32FeatureVector = number[]; // 32 buckets (0..15)

export interface Basis32IntentFlags {
  emergency?: boolean;
  logistics?: boolean;
  chat?: boolean;
  mapping?: boolean;
  commerce?: boolean;
  art?: boolean;
  simulation?: boolean;
  sensor?: boolean;
}

export interface Basis32Input {
  nodeCount?: number;
  linkCount?: number;
  componentCount?: number;
  churnRate?: number; // 0..1
  editEntropy?: number; // 0..1
  mergeFrequency?: number; // merges per window
  tileHopSpread?: number; // 0..1
  authoritySourceRatio?: number; // 0..1
  boundaryStrictness?: number; // 0..1
  policyPrivacyLevel?: number; // 0..1
  federationSize?: number;
  witnessDensity?: number; // 0..1
  intent?: Basis32IntentFlags;
  geoPresent?: boolean;
  geoAccuracyM?: number; // meters
  bleRssi?: number; // dBm
  wifiRssi?: number; // dBm
  loraSnr?: number; // dB
  peerDensity?: number; // peers per area
  brokerHops?: number;
  avgVelocity?: number;
  collisionRate?: number; // 0..1
  stabilityScore?: number; // 0..1
  anomalyScore?: number; // 0..1
  recencyDecay?: number; // 0..1
}
