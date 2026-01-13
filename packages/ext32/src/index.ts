export type Ext32FeatureSpec = {
  id: string;
  type: "enum" | "float" | "int" | "bool" | "string";
  values?: string[];
  range?: [number, number];
};

export type Ext32Pack = {
  pack_id: string;
  namespace: string;
  version: string;
  description?: string;
  features: Ext32FeatureSpec[];
  projections?: string[];
  authority?: "proposal";
  assets?: {
    default?: Ext32Assets;
    roles?: Record<string, Ext32Assets>;
  };
  interactions?: Ext32Interaction[] | Record<string, Ext32InteractionAction[]>;
  schema?: Record<string, unknown>;
};

export type Ext32Assets = {
  svg?: string;
  glb?: string;
  obj?: string;
  mtl?: string;
  wav?: string;
  mp4?: string;
  voxel?: string;
};

export type Ext32InteractionAction =
  | { operation: "set_properties"; properties: Record<string, unknown> }
  | { operation: "merge_properties"; properties: Record<string, unknown> }
  | { operation: "toggle_property"; path: string }
  | { operation: "increment_property"; path: string; value: number }
  | { operation: "push_array"; path: string; value: unknown }
  | { operation: "remove_array_item"; path: string; value: unknown }
  | { operation: "set_geometry"; geometry: { kind: "svg" | "obj" | "glb"; ref: string; units?: "m" | "cm" | "px" } }
  | { operation: "set_media"; media: { kind: "svg" | "obj" | "mtl" | "glb" | "wav" | "mp4"; ref: string } }
  | { operation: "set_transform"; transform: Partial<{ x: number; y: number; z: number }> }
  | { operation: "translate"; delta: Partial<{ dx: number; dy: number; dz: number }> }
  | { operation: "rotate"; rotation: Partial<{ yaw: number; pitch: number; roll: number }> }
  | { operation: "scale"; scale: Partial<{ x: number; y: number; z: number }> }
  | { operation: "create_node"; node: { kind: string; ext32_pack?: string; properties?: Record<string, unknown> } }
  | { operation: "delete_node"; target: "self" | string }
  | { operation: "link_nodes"; link: { from: "self" | string; to: "target" | string; relation: string } }
  | { operation: "unlink_nodes"; link: { from: "self" | string; to: "target" | string; relation?: string } }
  | { operation: "set_keyframe"; keyframe: { prop: string; value: unknown; time: number } }
  | { operation: "play_animation"; name: string }
  | { operation: "stop_animation"; name: string }
  | { operation: "scrub_timeline"; time: number }
  | { operation: "play_media"; ref: string }
  | { operation: "pause_media"; ref: string }
  | { operation: "stop_media"; ref: string }
  | { operation: "set_volume"; ref: string; volume: number }
  | { operation: "emit_event"; event: Record<string, unknown> }
  | { operation: "if"; condition: string; then: Ext32InteractionAction[]; else?: Ext32InteractionAction[] };

export type Ext32Trigger =
  | "click"
  | "hover_start"
  | "hover_end"
  | "drag_start"
  | "drag_move"
  | "drag_end"
  | "key_down"
  | "key_up"
  | "timeline_enter"
  | "timeline_exit";

export type Ext32Interaction = {
  name?: string;
  trigger: Ext32Trigger;
  conditions?: string[];
  range?: { start: number; end: number; unit?: "pct" | "ms" };
  key?: string;
  actions: Ext32InteractionAction[];
};

export class Ext32Registry {
  private packs = new Map<string, Ext32Pack>();

  register(pack: Ext32Pack) {
    this.packs.set(pack.pack_id, pack);
  }

  unregister(packId: string) {
    this.packs.delete(packId);
  }

  get(packId: string): Ext32Pack | undefined {
    return this.packs.get(packId);
  }

  list(): Ext32Pack[] {
    return Array.from(this.packs.values());
  }

  resolveAssets(packId: string, role?: string): Ext32Assets | null {
    const pack = this.packs.get(packId);
    if (!pack) return null;
    if (role && pack.assets?.roles?.[role]) return pack.assets.roles[role] ?? null;
    return pack.assets?.default ?? null;
  }

  resolveInteractions(packId: string): Ext32Interaction[] {
    const pack = this.packs.get(packId);
    if (!pack) return [];
    if (Array.isArray(pack.interactions)) return pack.interactions as Ext32Interaction[];
    if (pack.interactions && typeof pack.interactions === "object") {
      const legacy = pack.interactions as Record<string, Ext32InteractionAction[]>;
      return Object.entries(legacy).flatMap(([trigger, actions]) => {
        if (!Array.isArray(actions)) return [];
        return [{ trigger: trigger as Ext32Trigger, actions }];
      });
    }
    return [];
  }

  loadFromJson(json: string) {
    const parsed = JSON.parse(json) as Ext32Pack | Ext32Pack[];
    if (Array.isArray(parsed)) {
      parsed.forEach((p) => this.register(p));
      return;
    }
    this.register(parsed);
  }

  toJson(): string {
    return JSON.stringify(this.list(), null, 2);
  }
}
