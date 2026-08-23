export const BASE_APP_ID = "6a8a941d39d7d26f4bad1867";

type MetaNode = { setAttribute(name: string, value: string): void };

type HeadDoc = {
  head: { appendChild(node: MetaNode): unknown };
  querySelector(selector: string): MetaNode | null;
  createElement(tag: string): MetaNode;
};

/** Keep Base.dev ownership on every route, including client-side navigations. */
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
