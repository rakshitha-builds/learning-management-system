import * as Y from "yjs";
import { prisma } from "../db";

export const FRAGMENT = "default"; // TipTap's Collaboration extension default field name

const toBuf = (u: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(u);
const toU8 = (b: Uint8Array | Buffer) => new Uint8Array(b.buffer, b.byteOffset, b.byteLength);

export interface LoadedDoc {
  doc: Y.Doc;
  updateCount: number;
}

/** Rebuild a Y.Doc from compacted state + incremental updates. Returns null when the document doesn't exist. */
export async function loadDoc(documentId: string, origin: unknown): Promise<LoadedDoc | null> {
  const row = await prisma.document.findUnique({ where: { id: documentId }, select: { ydocState: true } });
  if (!row) return null;
  const updates = await prisma.documentUpdate.findMany({
    where: { documentId },
    orderBy: { id: "asc" },
    select: { data: true },
  });
  const doc = new Y.Doc();
  doc.transact(() => {
    if (row.ydocState) Y.applyUpdate(doc, toU8(row.ydocState));
    for (const u of updates) Y.applyUpdate(doc, toU8(u.data));
  }, origin);
  return { doc, updateCount: updates.length };
}

export async function appendUpdate(documentId: string, update: Uint8Array) {
  await prisma.documentUpdate.create({ data: { documentId, data: toBuf(update) } });
}

/**
 * Merge all stored incremental updates into Document.ydocState.
 * Safe across multiple server instances: guarded by an optimistic `stateVersion` check, and only
 * updates that were part of the merge (id <= maxId) are deleted.
 */
export async function compact(documentId: string): Promise<boolean> {
  const row = await prisma.document.findUnique({
    where: { id: documentId },
    select: { ydocState: true, stateVersion: true },
  });
  if (!row) return false;
  const updates = await prisma.documentUpdate.findMany({
    where: { documentId },
    orderBy: { id: "asc" },
    select: { id: true, data: true },
  });
  if (updates.length === 0) return false;
  const parts = [...(row.ydocState ? [toU8(row.ydocState)] : []), ...updates.map((u) => toU8(u.data))];
  const merged = Y.mergeUpdates(parts);
  const maxId = updates[updates.length - 1].id;
  return prisma.$transaction(async (tx) => {
    const res = await tx.document.updateMany({
      where: { id: documentId, stateVersion: row.stateVersion },
      data: { ydocState: toBuf(merged), stateVersion: { increment: 1 } },
    });
    if (res.count !== 1) return false; // someone else compacted concurrently; they will delete their ids
    await tx.documentUpdate.deleteMany({ where: { documentId, id: { lte: maxId } } });
    return true;
  });
}

/** Plain text projection of the rich-text fragment. */
export function extractText(doc: Y.Doc): string {
  const frag = doc.getXmlFragment(FRAGMENT);
  const out: string[] = [];
  const walk = (node: any) => {
    if (node instanceof Y.XmlText) {
      out.push(
        node
          .toDelta()
          .map((d: any) => (typeof d.insert === "string" ? d.insert : ""))
          .join("")
      );
    } else if (node instanceof Y.XmlElement) {
      node.toArray().forEach(walk);
      out.push("\n");
    }
  };
  frag.toArray().forEach(walk);
  return out.join("").replace(/\n{3,}/g, "\n\n").trim();
}

export async function persistMeta(documentId: string, doc: Y.Doc) {
  const plainText = extractText(doc).slice(0, 200_000);
  await prisma.document.updateMany({ where: { id: documentId }, data: { plainText } });
}

export async function createVersion(
  documentId: string,
  doc: Y.Doc,
  opts: { label?: string | null; auto?: boolean; userId?: string | null }
) {
  const d = await prisma.document.findUnique({ where: { id: documentId }, select: { title: true } });
  if (!d) return null;
  return prisma.documentVersion.create({
    data: {
      documentId,
      title: d.title,
      label: opts.label ?? null,
      auto: !!opts.auto,
      createdById: opts.userId ?? null,
      snapshot: toBuf(Y.encodeStateAsUpdate(doc)),
      plainText: extractText(doc).slice(0, 200_000),
    },
    select: { id: true, label: true, auto: true, createdAt: true, title: true },
  });
}

/** Replace the live content of `doc` with the content stored in `snapshot` (as a normal CRDT edit). */
export function applySnapshotContent(doc: Y.Doc, snapshot: Uint8Array, origin: unknown) {
  const tmp = new Y.Doc();
  Y.applyUpdate(tmp, snapshot);
  const src = tmp.getXmlFragment(FRAGMENT);
  const dst = doc.getXmlFragment(FRAGMENT);
  doc.transact(() => {
    if (dst.length > 0) dst.delete(0, dst.length);
    dst.insert(
      0,
      src.toArray().map((n: any) => n.clone())
    );
  }, origin);
  tmp.destroy();
}

export { toU8 };
