/**
 * ============================================================
 *  DOCUMENTO DEL SANDBOX — composición del srcDoc del iframe
 * ============================================================
 *
 * Orden del documento: CSP (primero) → estilos base + CSS del
 * usuario → HTML del usuario → runtime IMIND → código del usuario
 * → script de "ready". El escape de `</script` evita que el código
 * del usuario rompa los límites de los bloques <script>.
 *
 * La política bloquea TODA la red (connect-src 'none'), recursos
 * externos y plugins; solo se permiten inline e imágenes data:/blob:.
 */

import { SANDBOX_RUNTIME_JS } from "./runtime";

/**
 * CSP del sandbox. `connect-src 'none'` impide fetch/XHR/WebSocket;
 * `frame-src 'none'`, `object-src 'none'`, `base-uri 'none'` y
 * `form-action 'none'` cierran el resto de vectores.
 */
export const SANDBOX_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; " +
  "img-src data: blob:; font-src data:; media-src 'none'; connect-src 'none'; " +
  "frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

/** Valor EXACTO del atributo sandbox: solo ejecución de scripts (origen opaco). */
export const SANDBOX_ATTR = "allow-scripts";

/** Escapa cierres de script/style (conservando el caso) sin romper bloques. */
export function escapeClosingTags(code: string): string {
  return code.replace(/<\/(script|style)/gi, (_match, tag: string) => "<\\/" + tag);
}

const BASE_CSS =
  "html,body{margin:0;padding:10px;font-family:Inter,system-ui,sans-serif;" +
  "background:transparent;color:#0f172a;box-sizing:border-box;}" +
  "*,*::before,*::after{box-sizing:inherit;}";

const READY_JS =
  'window.parent.postMessage({ __imind: true, type: "imind:ready" }, "*");';

export interface SandboxSources {
  html: string;
  css: string;
  javascript: string;
}

/** Compone el documento completo que se inyecta en el iframe sandbox. */
export function buildSandboxDoc(sources: SandboxSources): string {
  const html = typeof sources.html === "string" ? sources.html : "";
  const css = typeof sources.css === "string" ? sources.css : "";
  const js = typeof sources.javascript === "string" ? sources.javascript : "";
  return (
    "<!DOCTYPE html>\n<html>\n<head>\n" +
    '<meta charset="utf-8" />\n' +
    '<meta http-equiv="Content-Security-Policy" content="' +
    SANDBOX_CSP +
    '" />\n' +
    "<style>" +
    BASE_CSS +
    escapeClosingTags(css) +
    "</style>\n" +
    "</head>\n<body>\n" +
    html +
    "\n<script>" +
    SANDBOX_RUNTIME_JS +
    "</script>\n<script>" +
    escapeClosingTags(js) +
    "</script>\n<script>" +
    READY_JS +
    "</script>\n" +
    "</body>\n</html>"
  );
}
