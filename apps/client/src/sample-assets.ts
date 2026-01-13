export const SAMPLE_ASSETS = [
  {
    id: 'sample.phoenix',
    label: 'Phoenix Bird',
    pack_id: 'sample.phoenix',
    assets: {
      default: {
        glb: '/assets/imports/phoenix_bird.glb',
      },
    },
  },
  {
    id: 'sample.ophanim',
    label: 'Ophanim Angel',
    pack_id: 'sample.ophanim',
    assets: {
      default: {
        glb: '/assets/imports/ophanim_angel.glb',
      },
    },
  },
  {
    id: 'sample.brain',
    label: 'Brain Hologram',
    pack_id: 'sample.brain',
    assets: {
      default: {
        glb: '/assets/imports/brain_hologram.glb',
      },
    },
  },
  {
    id: 'sample.human.male',
    label: 'Human Base (Male)',
    pack_id: 'sample.human.male',
    assets: {
      default: {
        glb: '/assets/imports/human_malefemale_basemesh_rigged/human_malefemale_basemesh_rigged.glb',
      },
    },
    schema: {
      model_nodes: ['Object_720'],
    },
  },
  {
    id: 'sample.human.female',
    label: 'Human Base (Female)',
    pack_id: 'sample.human.female',
    assets: {
      default: {
        glb: '/assets/imports/human_malefemale_basemesh_rigged/human_malefemale_basemesh_rigged.glb',
      },
    },
    schema: {
      model_nodes: ['Object_9'],
    },
  },
] as const;
