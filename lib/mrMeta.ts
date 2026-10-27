import type { MrMeta, MrMetaMap, MrOption } from './types';

export function mrMetaFor(meta: MrMetaMap | undefined, iid: number): MrMeta | undefined {
  return meta?.[String(iid)];
}

/** Pin 优先，其次有备注，最后按 MR 编号从高到低。 */
export function compareMrItems(a: MrOption, b: MrOption, meta?: MrMetaMap): number {
  const aMeta = mrMetaFor(meta, a.iid);
  const bMeta = mrMetaFor(meta, b.iid);
  const aPinned = aMeta?.pinned ? 1 : 0;
  const bPinned = bMeta?.pinned ? 1 : 0;
  if (aPinned !== bPinned) return bPinned - aPinned;

  const aNoted = aMeta?.note?.trim() ? 1 : 0;
  const bNoted = bMeta?.note?.trim() ? 1 : 0;
  if (aNoted !== bNoted) return bNoted - aNoted;

  return b.iid - a.iid;
}

export interface MrTagView {
  pinned: boolean;
  note: string;
  label: string;
  tooltip: string;
}

export function mrTagView(item: MrOption, meta?: MrMeta): MrTagView {
  const note = meta?.note?.trim() ?? '';
  const pinned = meta?.pinned === true;
  return {
    pinned,
    note,
    label: note || `!${item.iid}`,
    tooltip: note ? `!${item.iid}` : item.title || `!${item.iid}`,
  };
}
