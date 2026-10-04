/**
 * ============================================================
 *  RUNTIME DEL SANDBOX — bootstrap inyectado en el iframe
 * ============================================================
 *
 * JS clásico que IMIND antepone al código del usuario dentro del
 * iframe aislado:
 *  - Valida el remitente (`ev.source === window.parent`), el tipo y la
 *    forma de cada mensaje antes de aplicar nada.
 *  - Define `imind` como objeto CONGELADO con la API controlada.
 *  - Captura errores (window.onerror / unhandledrejection) → imind:error.
 *
 * No usa `document` (testeable con bun test sin DOM) y no contiene
 * template literals ni backticks (viaja dentro de un template TS).
 */

export const SANDBOX_RUNTIME_JS = String.raw`
(function () {
  "use strict";
  var MARK = "__imind";
  var latest = {};
  var series = {};
  var device = null;
  var loading = true;
  var subs = [];
  var pending = {};
  var reqSeq = 0;

  function post(msg) {
    try { window.parent.postMessage(msg, "*"); } catch (e) { /* sandbox */ }
  }
  function postError(message) {
    post({ __imind: true, type: "imind:error", message: String(message).slice(0, 500) });
  }
  function clone(v) {
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; }
  }
  function isKey(k) {
    return typeof k === "string" && k.length > 0 && k.length <= 64;
  }

  window.onerror = function (msg, source, lineno) {
    var where = typeof lineno === "number" ? " (línea " + lineno + ")" : "";
    postError(String(msg) + where);
    return true;
  };
  window.addEventListener("unhandledrejection", function (ev) {
    var r = ev && ev.reason;
    var m = r && typeof r.message === "string" ? r.message : String(r);
    postError("Promesa rechazada: " + m);
  });

  function applySnapshot(s) {
    if (!s || typeof s !== "object") return;
    latest = s.latest && typeof s.latest === "object" ? s.latest : {};
    series = s.series && typeof s.series === "object" ? s.series : {};
    device = s.device || null;
    loading = s.loading === true;
    for (var i = 0; i < subs.length; i++) {
      var sub = subs[i];
      var out = {};
      for (var j = 0; j < sub.keys.length; j++) {
        var k = sub.keys[j];
        if (k in latest) out[k] = latest[k];
      }
      try { sub.cb(out, { loading: loading }); }
      catch (e) { postError("Error en callback de suscripción: " + e); }
    }
  }

  window.addEventListener("message", function (ev) {
    if (ev.source !== window.parent) return;
    var d = ev.data;
    if (!d || typeof d !== "object" || d[MARK] !== true) return;
    if (d.type === "imind:init" || d.type === "imind:data") {
      applySnapshot(d.snapshot);
    } else if (d.type === "imind:action_result") {
      if (typeof d.requestId !== "number") return;
      var resolve = pending[d.requestId];
      if (!resolve) return;
      delete pending[d.requestId];
      resolve({
        ok: d.ok === true,
        message: typeof d.message === "string" ? d.message : ""
      });
    }
  });

  function emitNow(sub) {
    var out = {};
    for (var j = 0; j < sub.keys.length; j++) {
      var k = sub.keys[j];
      if (k in latest) out[k] = latest[k];
    }
    try { sub.cb(out, { loading: loading }); }
    catch (e) { postError("Error en callback de suscripción: " + e); }
  }

  var telemetry = {
    get: function (key) {
      if (!isKey(key)) return undefined;
      return clone(latest[key]);
    },
    list: function () { return Object.keys(latest); },
    subscribe: function (keys, cb) {
      if (typeof cb !== "function") throw new Error("imind.telemetry.subscribe: callback requerido");
      if (!Array.isArray(keys)) keys = [keys];
      var clean = [];
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (isKey(k) && clean.indexOf(k) < 0 && clean.length < 12) clean.push(k);
      }
      var sub = { keys: clean, cb: cb };
      subs.push(sub);
      emitNow(sub);
      return function () {
        var idx = subs.indexOf(sub);
        if (idx >= 0) subs.splice(idx, 1);
      };
    },
    getSeries: function (key, max) {
      if (!isKey(key)) return [];
      var arr = series[key];
      if (!Array.isArray(arr)) return [];
      if (typeof max === "number" && max > 0 && max < arr.length) {
        return arr.slice(arr.length - max);
      }
      return arr.slice(0);
    }
  };

  var deviceApi = {
    getState: function () { return clone(device); },
    getName: function () { return device ? String(device.name || "") : ""; }
  };

  var actions = {
    send: function (token) {
      if (!isKey(token)) return Promise.resolve({ ok: false, message: "imind.actions.send: token inválido" });
      reqSeq += 1;
      var id = reqSeq;
      return new Promise(function (resolve) {
        pending[id] = resolve;
        post({ __imind: true, type: "imind:action", token: token, requestId: id });
      });
    }
  };

  var api = { version: "1", telemetry: telemetry, device: deviceApi, actions: actions };
  var frozen = {
    version: api.version,
    telemetry: Object.freeze(telemetry),
    device: Object.freeze(deviceApi),
    actions: Object.freeze(actions)
  };
  try {
    Object.defineProperty(window, "imind", { value: Object.freeze(frozen) });
  } catch (e) {
    window.imind = Object.freeze(frozen);
  }
})();
`;
