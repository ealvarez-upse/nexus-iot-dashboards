/**
 * ============================================================
 *  PRUEBAS DEL HTML CARD AVANZADO — Fase 2 (bun test)
 * ============================================================
 * Verifica COMPORTAMIENTO REAL (no solo atributos):
 *  - El runtime del sandbox se ejecuta con un `window` falso SIN `document`
 *    y se comprueba: validación de remitente, whitelist de tipos, API
 *    congelada, suscripciones cancelables, acciones con requestId y
 *    reporte de errores.
 *  - El protocolo host⇄sandbox valida forma y longitud en ambos sentidos.
 *  - El snapshot es una lista blanca (sin credenciales ni campos extra).
 *  - Persistencia y duplicado conservan el código y remapean acciones.
 *
 * Ejecutar:  bun test src/lib/dashboard/__tests__/htmlcard.test.ts
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { SANDBOX_RUNTIME_JS } from "../htmlcard/runtime";
import {
  SANDBOX_ATTR,
  SANDBOX_CSP,
  buildSandboxDoc,
  escapeClosingTags,
} from "../htmlcard/srcdoc";
import {
  SERIES_PREVIEW_LIMIT,
  buildSnapshot,
  parseAllowedActions,
  parseSandboxMessage,
  resolveAllowedAction,
} from "../htmlcard/protocol";
import { HTML_CARD_FORMAT_VERSION } from "../htmlcard/defaults";
import {
  DEFAULT_SETTINGS,
  cloneModel,
  newId,
  type ImindDashboard,
} from "../model";
import { normalizeDashboardDoc } from "../normalize";
import { duplicateWidget, removeWidget } from "../ops";
import { configWithDefaults, getWidgetDefinition, libraryTypes } from "../registry";
import type { WidgetData } from "../datasource";

const REPO_ROOT = process.cwd();
function src(rel: string): string {
  return readFileSync(`${REPO_ROOT}/${rel}`, "utf8");
}

/* ------------------------------------------------------------------ */
/* Harness: ejecuta el runtime del sandbox con un window falso         */
/* ------------------------------------------------------------------ */

interface FakeWindow extends Record<string, unknown> {
  parent: { postMessage: (msg: unknown, origin: string) => void };
  addEventListener: (type: string, fn: (ev: unknown) => void) => void;
  removeEventListener: (type: string, fn: (ev: unknown) => void) => void;
  onerror?: ((msg: string, src: string, line: number) => boolean) | null;
  imind?: unknown;
}

interface SandboxApi {
  version: string;
  telemetry: {
    get: (key: string) => number | undefined;
    list: () => string[];
    subscribe: (keys: string[], cb: (values: Record<string, number | undefined>, meta: { loading: boolean }) => void) => () => void;
    getSeries: (key: string, max?: number) => { ts: number; value: number }[];
  };
  device: { getState: () => unknown; getName: () => string };
  actions: { send: (token: string) => Promise<{ ok: boolean; message: string }> };
}

/** Crea el entorno: window SIN document, mensajes del host y salida capturada. */
function makeSandbox() {
  const outgoing: unknown[] = [];
  const listeners: Array<(ev: { source: unknown; data: unknown }) => void> = [];
  const foreignSource = { postMessage: () => undefined };
  const win: FakeWindow = {
    parent: { postMessage: (msg: unknown) => void outgoing.push(msg) },
    addEventListener: (type, fn) => {
      if (type === "message") listeners.push(fn as never);
    },
    removeEventListener: () => undefined,
  };
  // SIN `document` en el entorno: si el runtime lo tocara, explota aquí.
  new Function("window", SANDBOX_RUNTIME_JS)(win as unknown as Window);

  const postFromHost = (data: unknown, fromHost = true) => {
    const ev = { source: fromHost ? win.parent : foreignSource, data };
    for (const fn of listeners) fn(ev);
  };
  const triggerError = (msg: string) => {
    const onerror = win.onerror;
    if (typeof onerror === "function") onerror(msg, "prueba", 7);
  };
  return {
    outgoing,
    postFromHost,
    triggerError,
    api: win.imind as SandboxApi,
    win,
  };
}

const SNAPSHOT = {
  loading: false,
  latest: { temperature: 21.5, humidity: 44 },
  series: { temperature: [{ ts: 1, value: 20 }, { ts: 2, value: 21.5 }] },
  device: { id: "dev1", name: "AC Sala", label: "Sala 1" },
};

function widgetData(overrides?: Partial<WidgetData>): WidgetData {
  return {
    loading: false,
    series: {},
    latest: {},
    alarms: [],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* 1 · Persistencia: guardar y restaurar HTML/CSS/JS                   */
/* ------------------------------------------------------------------ */

describe("persistencia del HTML Card", () => {
  const configuration = {
    html: "<div id=\"a\">x</div>",
    css: "#a{color:#0e7490;}",
    javascript: "console.log('hola');",
    allowedActions: [{ token: "encender", index: 0, confirm: true }],
    formatVersion: HTML_CARD_FORMAT_VERSION,
  };

  it("el código sobrevive a guardar → recargar (JSON + normalize v2)", () => {
    const model: ImindDashboard = {
      schemaVersion: 2,
      metadata: { name: "HVAC" },
      settings: { ...DEFAULT_SETTINGS },
      widgets: [],
      datasources: [],
      actions: [],
    };
    const draft = cloneModel(model);
    const actionId = newId("act");
    draft.actions.push({
      id: actionId,
      trigger: "on_click",
      type: "send_command",
      target: { entityType: "device", entityId: "dev1" },
      payload: { command: "ON" },
    });
    draft.widgets.push({
      id: "w-html",
      type: "html_card",
      title: "Panel AC",
      position: { x: 0, y: 0, w: 6, h: 3 },
      datasourceIds: [],
      actionIds: [actionId],
      configuration,
    });
    const stored = JSON.parse(JSON.stringify({ ...draft, metadata: { name: "HVAC" } }));
    const reloaded = normalizeDashboardDoc({ name: "HVAC", model: stored });
    const w = reloaded.widgets.find((x) => x.id === "w-html")!;
    expect(w.type).toBe("html_card");
    expect(w.configuration.html).toBe(configuration.html);
    expect(w.configuration.css).toBe(configuration.css);
    expect(w.configuration.javascript).toBe(configuration.javascript);
    expect(w.configuration.formatVersion).toBe(HTML_CARD_FORMAT_VERSION);
    expect(w.actionIds).toEqual([actionId]);
    const allowed = w.configuration.allowedActions as { token: string; index: number; confirm?: boolean }[];
    expect(allowed).toEqual([{ token: "encender", index: 0, confirm: true }]);
  });

  it("configWithDefaults NO pisa el código guardado y aporta defaults", () => {
    const merged = configWithDefaults("html_card", { html: "<b>guardado</b>" });
    expect(merged.html).toBe("<b>guardado</b>");
    expect(merged.formatVersion).toBe(HTML_CARD_FORMAT_VERSION);
    expect(typeof merged.css).toBe("string");
  });

  it("parseAllowedActions descarta entradas malformadas", () => {
    expect(parseAllowedActions("no")).toEqual([]);
    expect(
      parseAllowedActions([
        { token: "a", index: 0 },
        { token: "", index: 1 },
        { token: "b", index: -1 },
        { token: "c" },
        null,
        { token: "d", index: 1.5 },
        { token: "ok", index: 2, confirm: true },
      ]),
    ).toEqual([{ token: "a", index: 0 }, { token: "ok", index: 2, confirm: true }]);
  });
});

/* ------------------------------------------------------------------ */
/* 2 · Documento del sandbox (render HTML/CSS)                         */
/* ------------------------------------------------------------------ */

describe("buildSandboxDoc", () => {
  const doc = buildSandboxDoc({
    html: '<div class="panel">21.5 °C</div>',
    css: ".panel{color:#0e7490;}",
    javascript: "var x = '</script> cuidado';",
  });

  it("compone CSP primero, estilos, HTML y scripts en orden", () => {
    expect(doc.startsWith("<!DOCTYPE html>")).toBe(true);
    const cspAt = doc.indexOf(SANDBOX_CSP);
    expect(cspAt).toBeGreaterThan(0);
    expect(doc.indexOf("<style>")!).toBeLessThan(doc.indexOf('<div class="panel">')!);
    // runtime ANTES del código del usuario; ready al final
    expect(doc.indexOf(SANDBOX_RUNTIME_JS)).toBeGreaterThan(0);
    expect(doc.indexOf(SANDBOX_RUNTIME_JS)).toBeLessThan(doc.indexOf("var x ="));
    expect(doc.indexOf("imind:ready")).toBeGreaterThan(doc.indexOf("var x ="));
  });

  it("escapa cierres de etiqueta que romperían los bloques", () => {
    expect(doc.includes("</script> cuidado")).toBe(false);
    expect(doc.includes("<\\/script> cuidado")).toBe(true);
    const styleDoc = buildSandboxDoc({ html: "", css: ".a{}</style", javascript: "" });
    expect(styleDoc.includes("<\\/style")).toBe(true);
  });

  it("escapeClosingTags es una función pura case-insensitive", () => {
    expect(escapeClosingTags("</SCRIPT>")).toBe("<\\/SCRIPT>");
    expect(escapeClosingTags("sin cierre")).toBe("sin cierre");
  });

  it("el atributo sandbox es EXACTAMENTE allow-scripts (origen opaco)", () => {
    expect(SANDBOX_ATTR).toBe("allow-scripts");
    expect(SANDBOX_ATTR.includes("allow-same-origin")).toBe(false);
    expect(SANDBOX_ATTR.includes("allow-top-navigation")).toBe(false);
    expect(SANDBOX_ATTR.includes("allow-popups")).toBe(false);
    expect(SANDBOX_ATTR.includes("allow-forms")).toBe(false);
    expect(SANDBOX_ATTR.includes("allow-modals")).toBe(false);
  });

  it("la CSP bloquea red, plugins y navegación", () => {
    for (const directive of [
      "default-src 'none'",
      "connect-src 'none'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ]) {
      expect(SANDBOX_CSP.includes(directive)).toBe(true);
    }
    // sin fuentes de scripts/styles externas: solo inline
    expect(SANDBOX_CSP.includes("script-src 'unsafe-inline'")).toBe(true);
    expect(/script-src[^;]*https?:/.test(SANDBOX_CSP)).toBe(false);
    expect(/connect-src[^;]*https?:/.test(SANDBOX_CSP)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 3 · Protocolo host ⇄ sandbox (validación de mensajes)               */
/* ------------------------------------------------------------------ */

describe("parseSandboxMessage (host valida lo que llega del iframe)", () => {
  it("acepta los tres tipos de la whitelist con forma correcta", () => {
    expect(parseSandboxMessage({ __imind: true, type: "imind:ready" })).toEqual({ type: "imind:ready" });
    expect(parseSandboxMessage({ __imind: true, type: "imind:error", message: "boom" })).toEqual({
      type: "imind:error",
      message: "boom",
    });
    expect(
      parseSandboxMessage({ __imind: true, type: "imind:action", token: "encender", requestId: 3 }),
    ).toEqual({ type: "imind:action", token: "encender", requestId: 3 });
  });

  it("rechaza mensajes sin marca, malformados o de tipo desconocido", () => {
    expect(parseSandboxMessage(null)).toBeNull();
    expect(parseSandboxMessage("imind:ready")).toBeNull();
    expect(parseSandboxMessage([1, 2])).toBeNull();
    expect(parseSandboxMessage({ type: "imind:ready" })).toBeNull(); // sin marca
    expect(parseSandboxMessage({ __imind: true, type: "imind:hack" })).toBeNull();
    expect(parseSandboxMessage({ __imind: false, type: "imind:ready" })).toBeNull();
    expect(parseSandboxMessage({ __imind: true, type: "imind:error" })).toBeNull(); // sin message
    expect(parseSandboxMessage({ __imind: true, type: "imind:error", message: 42 })).toBeNull();
    expect(parseSandboxMessage({ __imind: true, type: "imind:action", token: "", requestId: 1 })).toBeNull();
    expect(parseSandboxMessage({ __imind: true, type: "imind:action", token: "x".repeat(65), requestId: 1 })).toBeNull();
    expect(
      parseSandboxMessage({ __imind: true, type: "imind:action", token: "x", requestId: "1" }),
    ).toBeNull();
  });

  it("recorta mensajes de error a 500 caracteres", () => {
    const parsed = parseSandboxMessage({ __imind: true, type: "imind:error", message: "x".repeat(900) });
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe("imind:error");
    expect((parsed as { message: string }).message.length).toBe(500);
  });
});

/* ------------------------------------------------------------------ */
/* 4 · Runtime del sandbox: COMPORTAMIENTO REAL (window sin document)  */
/* ------------------------------------------------------------------ */

describe("runtime del sandbox (ejecutado con window falso)", () => {
  it("expone la API imind congelada sin necesitar document", () => {
    const env = makeSandbox();
    expect(env.api.version).toBe("1");
    expect(Object.isFrozen(env.api)).toBe(true);
    expect(Object.isFrozen(env.api.telemetry)).toBe(true);
    expect(Object.isFrozen(env.api.actions)).toBe(true);
    expect(() => {
      (env.api.telemetry as unknown as Record<string, unknown>).get = () => 1;
    }).toThrow();
  });

  it("aplica snapshots SOLO de mensajes válidos del host (remitente + tipo)", () => {
    const env = makeSandbox();
    env.postFromHost({ __imind: true, type: "imind:init", snapshot: SNAPSHOT });
    expect(env.api.telemetry.get("temperature")).toBe(21.5);
    expect(env.api.device.getName()).toBe("AC Sala");

    // snapshot de fuente AJENA (no es window.parent): ignorado
    env.postFromHost(
      { __imind: true, type: "imind:data", snapshot: { ...SNAPSHOT, latest: { temperature: 999 } } },
      false,
    );
    expect(env.api.telemetry.get("temperature")).toBe(21.5);

    // sin marca __imind: ignorado
    env.postFromHost({ type: "imind:data", snapshot: { ...SNAPSHOT, latest: { temperature: 888 } } });
    expect(env.api.telemetry.get("temperature")).toBe(21.5);

    // tipo desconocido con marca: ignorado
    env.postFromHost({ __imind: true, type: "imind:hack", snapshot: { ...SNAPSHOT, latest: { temperature: 777 } } });
    expect(env.api.telemetry.get("temperature")).toBe(21.5);

    // snapshot con forma inválida: ignorado
    env.postFromHost({ __imind: true, type: "imind:data", snapshot: "inyectado" });
    expect(env.api.telemetry.get("temperature")).toBe(21.5);

    // data posterior del host SÍ actualiza
    env.postFromHost({ __imind: true, type: "imind:data", snapshot: { ...SNAPSHOT, latest: { temperature: 22 } } });
    expect(env.api.telemetry.get("temperature")).toBe(22);
  });

  it("suscripciones: emisión inmediata, updates y cancelación", () => {
    const env = makeSandbox();
    const received: Record<string, number | undefined>[] = [];
    const unsub = env.api.telemetry.subscribe(["temperature", "humidity"], (values) => {
      received.push(values);
    });
    expect(received).toHaveLength(1); // emisión inmediata (vacía)
    env.postFromHost({ __imind: true, type: "imind:data", snapshot: SNAPSHOT });
    expect(received).toHaveLength(2);
    expect(received[1]).toEqual({ temperature: 21.5, humidity: 44 });

    expect(typeof unsub).toBe("function");
    unsub();
    env.postFromHost({ __imind: true, type: "imind:data", snapshot: { ...SNAPSHOT, latest: { temperature: 30 } } });
    expect(received).toHaveLength(2); // sin más emisiones tras cancelar
  });

  it("subscribe valida el callback, filtra claves y acota a 12", () => {
    const env = makeSandbox();
    expect(() => env.api.telemetry.subscribe(["a"], "no-soy-funcion" as never)).toThrow();
    const seen: string[][] = [];
    // claves no-string se descartan y duplicados se eliminan
    env.api.telemetry.subscribe(
      ["temperature", 5 as unknown as string, "temperature"],
      (values) => seen.push(Object.keys(values)),
    );
    expect(seen[0]).toEqual([]); // emisión inmediata: snapshot aún vacío
    env.postFromHost({ __imind: true, type: "imind:data", snapshot: SNAPSHOT });
    expect(seen[1].sort()).toEqual(["temperature"]); // solo la suscrita existe en el snapshot

    // tope de 12 claves por suscripción
    const keys15 = Array.from({ length: 15 }, (_, i) => "k" + i);
    const latest15: Record<string, number> = {};
    for (const k of keys15) latest15[k] = 1;
    let count = -1;
    env.api.telemetry.subscribe(keys15, (values) => {
      count = Object.keys(values).length;
    });
    env.postFromHost({
      __imind: true,
      type: "imind:data",
      snapshot: { loading: false, latest: latest15, series: {}, device: null },
    });
    expect(count).toBe(12);
  });

  it("getSeries entrega la serie autorizada y respeta el recorte", () => {
    const env = makeSandbox();
    env.postFromHost({ __imind: true, type: "imind:init", snapshot: SNAPSHOT });
    expect(env.api.telemetry.getSeries("temperature")).toEqual(SNAPSHOT.series.temperature);
    expect(env.api.telemetry.getSeries("temperature", 1)).toEqual([{ ts: 2, value: 21.5 }]);
    expect(env.api.telemetry.getSeries("desconocida")).toEqual([]);
    expect(env.api.telemetry.getSeries("")).toEqual([]);
  });

  it("errores de ejecución del usuario se reportan al host", () => {
    const env = makeSandbox();
    env.triggerError("ReferenceError: x is not defined");
    const errors = env.outgoing.filter(
      (m) => (m as { type?: string }).type === "imind:error",
    );
    expect(errors).toHaveLength(1);
    expect((errors[0] as { message: string }).message).toContain("ReferenceError");
    expect((errors[0] as { message: string }).message).toContain("línea 7");
  });

  it("errores en callbacks de suscripción no rompen el resto", () => {
    const env = makeSandbox();
    let buenas = 0;
    // al suscribirse hay emisión inmediata: el callback roto lanza YA (capturado)
    env.api.telemetry.subscribe(["temperature"], () => {
      throw new Error("callback roto");
    });
    env.api.telemetry.subscribe(["temperature"], () => {
      buenas += 1;
    });
    expect(buenas).toBe(1); // el callback sano recibió su emisión inmediata
    env.postFromHost({ __imind: true, type: "imind:data", snapshot: SNAPSHOT });
    expect(buenas).toBe(2); // y también la emisión por datos
    const errors = env.outgoing.filter((m) => (m as { type?: string }).type === "imind:error");
    expect(errors.length).toBeGreaterThanOrEqual(2); // inmediata + data
  });
});

/* ------------------------------------------------------------------ */
/* 5 · Acciones: whitelist en el host + roundtrip con requestId        */
/* ------------------------------------------------------------------ */

describe("acciones del HTML Card", () => {
  it("resolveAllowedAction aplica la whitelist y valida el destino", () => {
    const action = {
      id: "act-1",
      trigger: "on_click" as const,
      type: "send_command" as const,
      target: { entityType: "device" as const, entityId: "dev1" },
      payload: { command: "ON" },
    };
    const byId = { "act-1": action };
    const allowed = [{ token: "encender", index: 0 }];
    expect(resolveAllowedAction(allowed, "encender", ["act-1"], byId)).toEqual({
      ok: true,
      action,
      confirm: false,
    });
    expect(resolveAllowedAction(undefined, "encender", ["act-1"], byId).ok).toBe(false);
    expect(resolveAllowedAction([], "encender", ["act-1"], byId).ok).toBe(false);
    expect(resolveAllowedAction(allowed, "formatear", ["act-1"], byId).ok).toBe(false);
    expect(resolveAllowedAction(allowed, "encender", [], byId).ok).toBe(false);
    expect(resolveAllowedAction(allowed, "encender", ["act-1"], {}).ok).toBe(false);
    expect(resolveAllowedAction(allowed, "encender", ["act-1"], { "act-1": { ...action, target: undefined } }).ok).toBe(false);
    const confirmed = [{ token: "encender", index: 0, confirm: true }];
    expect(resolveAllowedAction(confirmed, "encender", ["act-1"], byId)).toEqual({
      ok: true,
      action,
      confirm: true,
    });
  });

  it("el sandbox publica imind:action con requestId y resuelve la promesa", async () => {
    const env = makeSandbox();
    const pending = env.api.actions.send("encender");
    const sent = env.outgoing.find((m) => (m as { type?: string }).type === "imind:action") as
      | { token: string; requestId: number }
      | undefined;
    expect(sent).toBeDefined();
    expect(sent!.token).toBe("encender");
    expect(typeof sent!.requestId).toBe("number");

    // resultado del host con el MISMO requestId → resuelve la promesa
    env.postFromHost({ __imind: true, type: "imind:action_result", requestId: sent!.requestId, ok: true, message: "AC Sala → ON" });
    await expect(pending).resolves.toEqual({ ok: true, message: "AC Sala → ON" });

    // requestId desconocido: ignorado sin colgar nada
    env.postFromHost({ __imind: true, type: "imind:action_result", requestId: 9999, ok: false, message: "x" });
  });

  it("tokens inválidos NO llegan al host y devuelven error", async () => {
    const env = makeSandbox();
    const before = env.outgoing.length;
    await expect(env.api.actions.send("")).resolves.toMatchObject({ ok: false });
    await expect(env.api.actions.send(undefined as unknown as string)).resolves.toMatchObject({ ok: false });
    await expect(env.api.actions.send("t".repeat(65))).resolves.toMatchObject({ ok: false });
    expect(env.outgoing.length).toBe(before);
  });
});

/* ------------------------------------------------------------------ */
/* 6 · Snapshot: lista blanca SIN credenciales                         */
/* ------------------------------------------------------------------ */

describe("snapshot autorizado (sin credenciales)", () => {
  it("solo expone id/name/label/battery/lastSeenAt del device", () => {
    const data = widgetData({
      latest: { temperature: 4.01 },
      series: { temperature: [{ ts: 1, value: 4.01 }] },
      device: Object.assign(
        { _id: "dev1", name: "Sensor Frío", label: "Cámara 1", battery: 88, lastSeenAt: 123456 },
        // campos internos que NO deben viajar al sandbox:
        { token: "secreto", thresholds: { temperature: { max: 8 } }, ownerId: "user-1" },
      ),
    });
    const snap = buildSnapshot(data);
    expect(snap.device).toEqual({
      id: "dev1",
      name: "Sensor Frío",
      label: "Cámara 1",
      battery: 88,
      lastSeenAt: 123456,
    });
    const json = JSON.stringify(snap);
    expect(json.includes("secreto")).toBe(false);
    expect(json.includes("ownerId")).toBe(false);
    expect(json.includes("thresholds")).toBe(false);
    expect(json.includes("token")).toBe(false);
  });

  it("recorta series al límite de preview y respeta loading/null", () => {
    const points = Array.from({ length: 400 }, (_, i) => ({ ts: i, value: i }));
    const snap = buildSnapshot(widgetData({ series: { temperature: points }, loading: true }));
    expect(snap.series.temperature).toHaveLength(SERIES_PREVIEW_LIMIT);
    expect(snap.series.temperature[0].ts).toBe(400 - SERIES_PREVIEW_LIMIT);
    expect(snap.loading).toBe(true);
    expect(buildSnapshot(widgetData()).device).toBeNull();
    expect(buildSnapshot(widgetData({ device: { _id: "", name: "x" } })).device).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* 7 · Duplicar / eliminar / integración con el builder                */
/* ------------------------------------------------------------------ */

describe("HTML Card en el builder", () => {
  function modelWithHtmlCard() {
    const model: ImindDashboard = {
      schemaVersion: 2,
      metadata: { name: "HVAC" },
      settings: { ...DEFAULT_SETTINGS },
      widgets: [],
      datasources: [],
      actions: [],
    };
    const actionId = newId("act");
    model.actions.push({
      id: actionId,
      trigger: "on_click",
      type: "send_command",
      target: { entityType: "device", entityId: "dev1" },
      payload: { command: "ON" },
    });
    model.widgets.push({
      id: "w-html",
      type: "html_card",
      title: "Panel AC",
      position: { x: 0, y: 0, w: 6, h: 3 },
      datasourceIds: [],
      actionIds: [actionId],
      configuration: {
        html: "<div>original</div>",
        css: ".a{}",
        javascript: "// js original",
        allowedActions: [{ token: "encender", index: 0 }],
        formatVersion: HTML_CARD_FORMAT_VERSION,
      },
    });
    return { model, actionId };
  }

  it("duplicar conserva el código y remapea la acción exclusiva", () => {
    const { model, actionId } = modelWithHtmlCard();
    const res = duplicateWidget(model, "w-html");
    expect(res.newWidgetId).not.toBeNull();
    const original = res.model.widgets.find((w) => w.id === "w-html")!;
    const copy = res.model.widgets.find((w) => w.id === res.newWidgetId)!;
    expect(copy.type).toBe("html_card");
    expect(copy.configuration.html).toBe("<div>original</div>");
    expect(copy.configuration.javascript).toBe("// js original");
    expect(copy.configuration.allowedActions).toEqual([{ token: "encender", index: 0 }]);
    // acción exclusiva CLONADA: la copia apunta al clon, el original al suyo
    expect(copy.actionIds[0]).not.toBe(actionId);
    expect(original.actionIds[0]).toBe(actionId);
    expect(res.model.actions).toHaveLength(2);
    // el original queda intacto
    expect(original.configuration.html).toBe("<div>original</div>");
  });

  it("eliminar limpia el widget y su acción exclusiva", () => {
    const { model } = modelWithHtmlCard();
    const after = removeWidget(model, "w-html");
    expect(after.widgets).toHaveLength(0);
    expect(after.actions).toHaveLength(0);
  });

  it("los demás tipos siguen registrados y html_card está en la biblioteca", () => {
    expect(Object.keys(getWidgetDefinition("html_card"))).toBeTruthy();
    expect(libraryTypes()).toContain("html_card");
    // defaults de los otros tipos intactos (muestra representativa)
    expect(getWidgetDefinition("numeric_card").defaults.decimals).toBe(2);
    expect(getWidgetDefinition("button").defaults.confirmEnabled).toBe(true);
    expect(getWidgetDefinition("gauge").defaults.max).toBe(100);
  });

  it("guard-rails de fuente: el bridge no importa Convex y el runtime no usa eval", () => {
    const bridge = src("src/components/widgets/renderers/htmlcard/use-imind-sandbox.ts");
    expect(bridge.includes("convex")).toBe(false);
    expect(bridge.includes("useQuery")).toBe(false);
    expect(bridge.includes("useMutation")).toBe(false);
    expect(bridge.includes("ev.source !== iframe.contentWindow")).toBe(true);
    const runtime = SANDBOX_RUNTIME_JS;
    expect(runtime.includes("eval(")).toBe(false);
    expect(runtime.includes("Function(")).toBe(false);
    expect(runtime.includes("import(")).toBe(false);
    // el runtime solo habla con window.parent por postMessage
    expect(runtime.includes("window.parent.postMessage")).toBe(true);
    expect(runtime.includes("ev.source !== window.parent")).toBe(true);
  });
});
