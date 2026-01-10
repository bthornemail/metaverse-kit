import fs from "fs/promises";
import path from "path";
import { makeHdPath, sidFromPath, stableStringify, type HashRef } from "@metaverse-kit/addr";

export async function writePointer(opts: {
  rootDir: string;
  space_id: string;
  tid: string;
  role: string; // "head" | "index" | "manifest" | "snapshot/<event>"
  points_to: HashRef;
}) {
  const hdPath = makeHdPath(opts.space_id, opts.tid, opts.role);
  const sid = sidFromPath(hdPath);

  const pdir = path.join(opts.rootDir, "spaces", opts.space_id, "pointers");
  await fs.mkdir(pdir, { recursive: true });

  const pfile = path.join(pdir, `${sid.split(":")[1]}.json`);

  const rec = {
    sid,
    path: hdPath,
    role: opts.role,
    points_to: opts.points_to,
    updated_at: Date.now(),
  };

  await fs.writeFile(pfile, stableStringify(rec), "utf8");
  return { sid, path: hdPath };
}
