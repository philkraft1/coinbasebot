/** Drop the homepage-only Base.dev ownership tag from a copied HTML shell. */
export function stripBaseAppIdHtml(html: string) {
  return html.replace(/\s*<meta\s+name="base:app_id"[^>]*>/i, "\n    ");
}
