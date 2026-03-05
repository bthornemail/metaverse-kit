import {
  detectArtifactVersion,
  validateWave27Residual,
  validateWave28PolyDecomp,
  validateWave28SignalPolyProjection,
  type Wave27Residual,
  type Wave28PolyDecomp,
  type Wave28SignalPolyProjection,
} from './validators';

export type Wave28PanelState = {
  projection: Wave28SignalPolyProjection | null;
  projectionName: string;
  decomp: Wave28PolyDecomp | null;
  decompName: string;
  residual: Wave27Residual | null;
  residualName: string;
  status: string;
  error: string | null;
  activeTab: 'signal' | 'decompose' | 'residual';
};

export function initialWave28PanelState(): Wave28PanelState {
  return {
    projection: null,
    projectionName: '',
    decomp: null,
    decompName: '',
    residual: null,
    residualName: '',
    status: 'Drop or select Wave28/Wave27 advisory artifacts',
    error: null,
    activeTab: 'signal',
  };
}

export function clearWave28PanelState(): Wave28PanelState {
  return {
    projection: null,
    projectionName: '',
    decomp: null,
    decompName: '',
    residual: null,
    residualName: '',
    status: 'Cleared loaded artifacts',
    error: null,
    activeTab: 'signal',
  };
}

export async function ingestWave28PanelArtifact(
  state: Wave28PanelState,
  data: unknown,
  sourceName: string
): Promise<Wave28PanelState> {
  const version = detectArtifactVersion(data);

  if (version === 'wave28.signal_poly_projection.v0') {
    const validated = await validateWave28SignalPolyProjection(data);
    if (!validated.ok) throw new Error(validated.error);
    return {
      ...state,
      projection: validated.value,
      projectionName: sourceName,
      status: `Loaded signal poly projection from ${sourceName}`,
      error: null,
      activeTab: 'signal',
    };
  }

  if (version === 'wave28.poly_decomp.v0') {
    const validated = await validateWave28PolyDecomp(data);
    if (!validated.ok) throw new Error(validated.error);
    return {
      ...state,
      decomp: validated.value,
      decompName: sourceName,
      status: `Loaded poly decomposition from ${sourceName}`,
      error: null,
      activeTab: 'decompose',
    };
  }

  if (version === 'wave27.pointer_sync_residual.v0') {
    const validated = await validateWave27Residual(data);
    if (!validated.ok) throw new Error(validated.error);
    return {
      ...state,
      residual: validated.value,
      residualName: sourceName,
      status: `Loaded residual artifact from ${sourceName}`,
      error: null,
      activeTab: 'residual',
    };
  }

  throw new Error(`unsupported artifact version: ${version || '<missing v>'}`);
}
