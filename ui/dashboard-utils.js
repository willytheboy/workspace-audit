// @ts-check

/**
 * @param {number} score
 */
export function getColor(score) {
  if (score >= 65) return "var(--success)";
  if (score >= 40) return "var(--warning)";
  return "var(--danger)";
}

/**
 * @param {unknown} value
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * @param {unknown} value
 */
export function encodeAppId(value) {
  return encodeURIComponent(String(value ?? ""));
}

/**
 * @param {ParentNode} container
 * @param {(id: string) => void} onOpen
 */
export function bindAppLaunchers(container, onOpen) {
  container.querySelectorAll("[data-open-app-id]").forEach((element) => {
    if (!(element instanceof HTMLElement)) return;
    element.onclick = () => onOpen(decodeURIComponent(element.dataset.openAppId ?? ""));
  });
}
