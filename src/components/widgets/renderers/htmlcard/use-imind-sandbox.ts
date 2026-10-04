/**
 * ============================================================
 *  PUENTE HOST ⇄ SANDBOX (hook del lado host)
 * ============================================================
 *
 * - Valida cada mensaje: solo acepta los que provienen de LA ventana
 *   del iframe propio (`ev.source === iframe.contentWindow`) y pasan
 *   `parseSandboxMessage` (marca + tipo + forma).
 * - Publica el snapshot autorizado en cada cambio de datos.
 * - En `imind:ready` envía `imind:init` con el último snapshot.
 * - En `imind:action` aplica el tope en vuelo y entrega el token al
 *   handler con un `respond` con timeout (ACTION_TIMEOUT_MS).
 *
 * Sin setState en el cuerpo de efectos (solo en callbacks de eventos).
 */

import { useEffect, useRef, type RefObject } from "react";
import {
  ACTION_TIMEOUT_MS,
  MAX_IN_FLIGHT_ACTIONS,
  isSnapshotShape,
  parseSandboxMessage,
  type HostToSandboxMessage,
  type ImindSnapshot,
} from "@/lib/dashboard/htmlcard/protocol";

export interface ImindSandboxHandlers {
  onAction?: (token: string, respond: (ok: boolean, message: string) => void) => void;
  onError?: (message: string) => void;
}

function postTo(iframe: HTMLIFrameElement | null, msg: HostToSandboxMessage): void {
  iframe?.contentWindow?.postMessage(msg, "*");
}

export function useImindSandbox(params: {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  snapshot: ImindSnapshot;
  handlers: ImindSandboxHandlers;
}): void {
  const { iframeRef, snapshot, handlers } = params;
  const handlersRef = useRef(handlers);
  const snapshotRef = useRef(snapshot);
  const inFlightRef = useRef(0);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  // Oyente único mientras el componente vive; handlers vía ref.
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const iframe = iframeRef.current;
      if (!iframe || ev.source !== iframe.contentWindow) return;
      const msg = parseSandboxMessage(ev.data);
      if (!msg) return;
      const h = handlersRef.current;
      if (msg.type === "imind:ready") {
        postTo(iframe, { type: "imind:init", snapshot: snapshotRef.current });
        return;
      }
      if (msg.type === "imind:error") {
        h.onError?.(msg.message);
        return;
      }
      // msg.type === "imind:action"
      if (inFlightRef.current >= MAX_IN_FLIGHT_ACTIONS) {
        postTo(iframe, {
          type: "imind:action_result",
          requestId: msg.requestId,
          ok: false,
          message: "Demasiadas acciones en curso; espera a que termine una",
        });
        return;
      }
      inFlightRef.current += 1;
      let responded = false;
      const respond = (ok: boolean, message: string) => {
        if (responded) return;
        responded = true;
        inFlightRef.current = Math.max(0, inFlightRef.current - 1);
        postTo(iframeRef.current, { type: "imind:action_result", requestId: msg.requestId, ok, message });
      };
      const timer = window.setTimeout(() => {
        respond(false, "Tiempo de espera agotado al ejecutar la acción");
      }, ACTION_TIMEOUT_MS);
      h.onAction?.(msg.token, (ok, message) => {
        window.clearTimeout(timer);
        respond(ok, message);
      });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [iframeRef]);

  // Publica el snapshot en cada cambio de datos (el runtime filtra por suscripción).
  useEffect(() => {
    if (!isSnapshotShape(snapshot)) return;
    postTo(iframeRef.current, { type: "imind:data", snapshot });
  }, [iframeRef, snapshot]);
}
