/**
 * Ejemplo por defecto del HTML Card: panel HVAC mínimo que consume la API
 * `imind.*` (telemetría en vivo + acción por token). Plantilla de arranque
 * del editor. JS clásico (viaja como string serializable en el modelo).
 */

export const HTML_CARD_DEFAULT_HTML = '<div class="panel">' +
  '<span class="label">Temperatura</span>' +
  '<span class="value" id="temp">--</span>' +
  '<button id="btn" class="btn">Encender</button>' +
  "</div>";

export const HTML_CARD_DEFAULT_CSS =
  ".panel{display:flex;flex-direction:column;gap:6px;align-items:flex-start;}" +
  ".label{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;}" +
  ".value{font-size:30px;font-weight:700;color:#0e7490;}" +
  ".btn{margin-top:4px;padding:6px 14px;border:0;border-radius:8px;" +
  "background:#0e7490;color:#fff;font-size:13px;cursor:pointer;}" +
  ".btn:hover{background:#155e75;}";

export const HTML_CARD_DEFAULT_JS = [
  "// Telemetría en vivo (suscripción cancelable):",
  "var temp = document.getElementById('temp');",
  "var off = imind.telemetry.subscribe(['temperature'], function (values) {",
  "  if (typeof values.temperature === 'number' && temp) {",
  "    temp.textContent = values.temperature.toFixed(1) + ' °C';",
  "  }",
  "});",
  "",
  "// Acción configurada en el editor con token 'encender':",
  "document.getElementById('btn').addEventListener('click', function () {",
  "  imind.actions.send('encender').then(function (res) {",
  "    if (!res.ok) console.warn(res.message);",
  "  });",
  "});",
  "",
  "// off() cancela la suscripción (llámalo si el widget se descarga).",
].join("\n");

export const HTML_CARD_FORMAT_VERSION = 1;
