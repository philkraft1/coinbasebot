export const BASE_APP_ID = "6a8a941d39d7d26f4bad1867";

type MetaNode = { setAttribute(name: string, value: string): void };

type HeadDoc = {
  head: {
    appendChild(node: MetaNode): unknown;
    removeChild(node: MetaNode): unknown;
  };
  querySelector(selector: string): MetaNode | null;
  createElement(tag: string): MetaNode;
};

export function isHomePath(pathname: string) {
  return pathname === "/";
}

/** Base.dev ownership tag — homepage only. */
export function ensureBaseAppIdMeta(doc: HeadDoc = document as unknown as HeadDoc) {
  let tag = doc.querySelector('meta[name="base:app_id"]');
  if (!tag) {
    tag = doc.createElement("meta");
    doc.head.appendChild(tag);
  }
  tag.setAttribute("name", "base:app_id");
  tag.setAttribute("content", BASE_APP_ID);
  return tag;
}

export function removeBaseAppIdMeta(doc: HeadDoc = document as unknown as HeadDoc) {
  const tag = doc.querySelector('meta[name="base:app_id"]');
  if (tag) doc.head.removeChild(tag);
  return tag;
}

/** Keep the ownership tag on `/` and strip it from every other route. */
export function syncBaseAppIdMeta(
  pathname: string,
  doc: HeadDoc = document as unknown as HeadDoc,
) {
  if (isHomePath(pathname)) return ensureBaseAppIdMeta(doc);
  return removeBaseAppIdMeta(doc);
}
