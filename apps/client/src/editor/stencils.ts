import type { SemanticRole } from '../semantic/roles';

export type StencilShape = 'rect' | 'ellipse' | 'diamond';

export type StencilField =
  | { id: 'label'; label: string; type: 'text' }
  | { id: 'semantic_role'; label: string; type: 'role' }
  | { id: 'narrative.actions'; label: string; type: 'actions' }
  | { id: 'narrative.intensity'; label: string; type: 'intensity' }
  | { id: 'relation'; label: string; type: 'relation' };

export type Stencil = {
  id: string;
  label: string;
  role: SemanticRole;
  shape: StencilShape;
  defaultSize: { w: number; h: number };
  allowedRelations?: string[];
  fields: StencilField[];
};

export type StencilGroup = {
  id: string;
  label: string;
  stencils: Stencil[];
};

export type StencilPack = {
  id: string;
  label: string;
  groups: StencilGroup[];
};

const BASE_FIELDS: StencilField[] = [
  { id: 'label', label: 'Label', type: 'text' },
  { id: 'semantic_role', label: 'Role', type: 'role' },
  { id: 'narrative.actions', label: 'Actions', type: 'actions' },
  { id: 'narrative.intensity', label: 'Intensity', type: 'intensity' },
];

export const STENCIL_PACKS: StencilPack[] = [
  {
    id: 'narrative-core',
    label: 'Narrative Core',
    groups: [
      {
        id: 'actors',
        label: 'Actors',
        stencils: [
          {
            id: 'role-law',
            label: 'Law',
            role: 'law',
            shape: 'rect',
            defaultSize: { w: 140, h: 80 },
            allowedRelations: ['guards', 'binds', 'frames'],
            fields: BASE_FIELDS,
          },
          {
            id: 'role-wisdom',
            label: 'Wisdom',
            role: 'wisdom',
            shape: 'ellipse',
            defaultSize: { w: 120, h: 120 },
            allowedRelations: ['guides', 'awakens'],
            fields: BASE_FIELDS,
          },
          {
            id: 'role-identity',
            label: 'Identity',
            role: 'identity',
            shape: 'diamond',
            defaultSize: { w: 130, h: 90 },
            allowedRelations: ['reflects', 'reveals'],
            fields: BASE_FIELDS,
          },
          {
            id: 'role-witness',
            label: 'Witness',
            role: 'witness',
            shape: 'rect',
            defaultSize: { w: 110, h: 70 },
            allowedRelations: ['records', 'echoes'],
            fields: BASE_FIELDS,
          },
        ],
      },
      {
        id: 'structures',
        label: 'Structures',
        stencils: [
          {
            id: 'role-boundary',
            label: 'Boundary',
            role: 'boundary',
            shape: 'rect',
            defaultSize: { w: 160, h: 50 },
            allowedRelations: ['separates', 'protects'],
            fields: BASE_FIELDS,
          },
          {
            id: 'role-gate',
            label: 'Gate',
            role: 'gate',
            shape: 'diamond',
            defaultSize: { w: 90, h: 90 },
            allowedRelations: ['permits', 'blocks'],
            fields: BASE_FIELDS,
          },
          {
            id: 'role-tower',
            label: 'Tower',
            role: 'tower',
            shape: 'rect',
            defaultSize: { w: 80, h: 140 },
            allowedRelations: ['observes', 'signals'],
            fields: BASE_FIELDS,
          },
        ],
      },
      {
        id: 'events',
        label: 'Events',
        stencils: [
          {
            id: 'role-flood',
            label: 'Flood',
            role: 'flood',
            shape: 'ellipse',
            defaultSize: { w: 150, h: 90 },
            allowedRelations: ['overwhelms', 'cleanses'],
            fields: BASE_FIELDS,
          },
          {
            id: 'role-ark',
            label: 'Ark',
            role: 'ark',
            shape: 'rect',
            defaultSize: { w: 160, h: 70 },
            allowedRelations: ['preserves', 'shelters'],
            fields: BASE_FIELDS,
          },
        ],
      },
    ],
  },
];

export function findStencil(packId: string, stencilId: string): Stencil | null {
  const pack = STENCIL_PACKS.find((p) => p.id === packId);
  if (!pack) return null;
  for (const group of pack.groups) {
    const found = group.stencils.find((s) => s.id === stencilId);
    if (found) return found;
  }
  return null;
}
