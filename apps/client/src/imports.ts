import type { Ext32Pack } from '@metaverse-kit/ext32';

const IMPORTS_DB = 'metaverse-kit-imports';
const IMPORTS_VERSION = 1;
const BLOBS_STORE = 'import_blobs';
const PACKS_STORE = 'import_packs';

type ImportBlobRecord = {
  id: string;
  name: string;
  type: string;
  blob: Blob;
};

function openImportsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IMPORTS_DB, IMPORTS_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PACKS_STORE)) {
        db.createObjectStore(PACKS_STORE, { keyPath: 'pack_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashBuffers(buffers: ArrayBuffer[]): Promise<string> {
  const total = buffers.reduce((acc, buf) => acc + buf.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const buf of buffers) {
    merged.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return hashBuffer(merged.buffer);
}

async function saveImportBlob(record: ImportBlobRecord): Promise<void> {
  const db = await openImportsDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BLOBS_STORE, 'readwrite');
    const store = tx.objectStore(BLOBS_STORE);
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function saveImportPack(pack: Ext32Pack): Promise<void> {
  const db = await openImportsDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PACKS_STORE, 'readwrite');
    const store = tx.objectStore(PACKS_STORE);
    store.put(pack);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listImportPacks(): Promise<Ext32Pack[]> {
  const db = await openImportsDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(PACKS_STORE, 'readonly');
    const store = tx.objectStore(PACKS_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result ?? []) as Ext32Pack[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getImportBlob(ref: string): Promise<Blob | null> {
  const db = await openImportsDb();
  return await new Promise((resolve) => {
    const tx = db.transaction(BLOBS_STORE, 'readonly');
    const store = tx.objectStore(BLOBS_STORE);
    const req = store.get(ref);
    req.onsuccess = () => {
      const result = req.result as ImportBlobRecord | undefined;
      resolve(result?.blob ?? null);
    };
    req.onerror = () => resolve(null);
  });
}

function classifyExtension(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ext;
}

function makePackId(hash: string) {
  return `sha256:${hash}`;
}

function makeLocalRef(hash: string) {
  return `local:${hash}`;
}

export async function importFiles(files: FileList | File[]): Promise<Ext32Pack[]> {
  const inputFiles = Array.from(files);
  const groups = new Map<string, { obj?: File; mtl?: File }>();
  const singleFiles: File[] = [];

  for (const file of inputFiles) {
    const ext = classifyExtension(file.name);
    if (ext === 'obj' || ext === 'mtl') {
      const base = file.name.replace(/\.[^.]+$/, '');
      const entry = groups.get(base) ?? {};
      if (ext === 'obj') entry.obj = file;
      if (ext === 'mtl') entry.mtl = file;
      groups.set(base, entry);
    } else {
      singleFiles.push(file);
    }
  }

  const packs: Ext32Pack[] = [];

  for (const file of singleFiles) {
    const buffer = await file.arrayBuffer();
    const hash = await hashBuffer(buffer);
    const ref = makeLocalRef(hash);
    const blob = new Blob([buffer], { type: file.type });
    await saveImportBlob({ id: ref, name: file.name, type: file.type, blob });

    const ext = classifyExtension(file.name);
    const assets: Record<string, string> = {};
    if (ext === 'svg') assets.svg = ref;
    if (ext === 'glb' || ext === 'gltf') assets.glb = ref;
    if (ext === 'wav') assets.wav = ref;
    if (ext === 'mp4') assets.mp4 = ref;

    if (Object.keys(assets).length) {
      const pack: Ext32Pack = {
        pack_id: makePackId(hash),
        namespace: 'import',
        version: '0.0.0',
        description: `Imported ${file.name}`,
        features: [],
        assets: { default: assets },
        projections: ['2d', '3d'],
        authority: 'proposal',
        schema: {
          import_meta: {
            rid: makePackId(hash),
            filename: file.name,
            size: blob.size,
            created_at: Date.now(),
            source: 'file',
          },
        },
      };

      await saveImportPack(pack);
      packs.push(pack);
    }
  }

  for (const [base, entry] of groups.entries()) {
    const assets: Record<string, string> = {};
    const buffers: ArrayBuffer[] = [];
    if (entry.obj) {
      const buffer = await entry.obj.arrayBuffer();
      const hash = await hashBuffer(buffer);
      const ref = makeLocalRef(hash);
      await saveImportBlob({
        id: ref,
        name: entry.obj.name,
        type: entry.obj.type,
        blob: new Blob([buffer], { type: entry.obj.type }),
      });
      assets.obj = ref;
      buffers.push(buffer);
    }
    if (entry.mtl) {
      const buffer = await entry.mtl.arrayBuffer();
      const hash = await hashBuffer(buffer);
      const ref = makeLocalRef(hash);
      await saveImportBlob({
        id: ref,
        name: entry.mtl.name,
        type: entry.mtl.type,
        blob: new Blob([buffer], { type: entry.mtl.type }),
      });
      assets.mtl = ref;
      buffers.push(buffer);
    }
    if (!Object.keys(assets).length) continue;
    const packHash = buffers.length ? await hashBuffers(buffers) : await hashBuffer(new TextEncoder().encode(base).buffer);
    const packId = makePackId(packHash);
    const pack: Ext32Pack = {
      pack_id: packId,
      namespace: 'import',
      version: '0.0.0',
      description: `Imported ${base}`,
      features: [],
      assets: { default: assets },
      projections: ['2d', '3d'],
      authority: 'proposal',
      schema: {
        import_meta: {
          rid: packId,
          filename: base,
          size: buffers.reduce((acc, buf) => acc + buf.byteLength, 0),
          created_at: Date.now(),
          source: 'file',
        },
      },
    };
    await saveImportPack(pack);
    packs.push(pack);
  }

  return packs;
}

function resolveImportUrl(input: string): string {
  if (input.startsWith('gltf-sample:') || input.startsWith('gltf-sample://')) {
    const raw = input.replace('gltf-sample://', '').replace('gltf-sample:', '');
    const [name, variant] = raw.split('@');
    const flavor = variant || 'glb';
    const base = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0';
    if (flavor === 'gltf') {
      return `${base}/${name}/glTF/${name}.gltf`;
    }
    if (flavor === 'gltf-embedded') {
      return `${base}/${name}/glTF-Embedded/${name}.gltf`;
    }
    return `${base}/${name}/glTF-Binary/${name}.glb`;
  }
  return input;
}

function filenameFromUrl(input: string): string {
  try {
    const url = new URL(input);
    const last = url.pathname.split('/').pop();
    return last || 'imported';
  } catch {
    return 'imported';
  }
}

export async function importFromUrl(input: string): Promise<Ext32Pack | null> {
  const url = resolveImportUrl(input);
  const res = await fetch(url);
  if (!res.ok) return null;
  const blob = await res.blob();
  const buffer = await blob.arrayBuffer();
  const hash = await hashBuffer(buffer);
  const ref = makeLocalRef(hash);
  const filename = filenameFromUrl(url);
  await saveImportBlob({ id: ref, name: filename, type: blob.type, blob });

  const ext = classifyExtension(filename);
  const assets: Record<string, string> = {};
  if (ext === 'svg') assets.svg = ref;
  if (ext === 'glb' || ext === 'gltf') assets.glb = ref;
  if (ext === 'wav') assets.wav = ref;
  if (ext === 'mp4') assets.mp4 = ref;
  if (!Object.keys(assets).length) return null;

  const pack: Ext32Pack = {
    pack_id: makePackId(hash),
    namespace: 'import',
    version: '0.0.0',
    description: `Imported ${filename}`,
    features: [],
    assets: { default: assets },
    projections: ['2d', '3d'],
    authority: 'proposal',
    schema: {
      import_meta: {
        rid: makePackId(hash),
        filename,
        size: blob.size,
        created_at: Date.now(),
        source: 'url',
        url: input,
      },
    },
  };

  await saveImportPack(pack);
  return pack;
}
