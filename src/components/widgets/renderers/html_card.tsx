/**
 * ============================================================
 *  HTML CARD — render aislado con API controlada (Fase 2)
 * ============================================================
 *
 * El HTML/CSS/JS del usuario se ejecuta ÚNICAMENTE dentro de un
 * <iframe sandbox="allow-scripts"> (origen opaco, sin allow-same-origin)
 * con CSP sin red. La comunicación usa el protocolo `__imind`:
 *  - El snapshot de datos (buildSnapshot) viene de useWidgetData vía
 *    WidgetFrame: la capa de datos existente, sin Convex aquí.
 *  - Las acciones del sandbox se resuelven contra la whitelist
 *    `allowedActions` (resolveAllowedAction) y se ejecutan con el
 *    ActionExecutor existente (commands.simulate, autorización backend).
 *
 * Este renderer NO inyecta código del usuario en el DOM principal:
 * todo viaja dentro del srcDoc del iframe aislado.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import { WidgetCard, WidgetHeader } from "./shared";
import { cfgString, cfgStringSafe } from "./widget-utils";
import { useImindSandbox, type ImindSandboxHandlers } from "./htmlcard/use-imind-sandbox";
import { useActionExecutor } from "@/lib/dashboard/actions";
import { SANDBOX_ATTR, buildSandboxDoc } from "@/lib/dashboard/htmlcard/srcdoc";
import {
  buildSnapshot,
  parseAllowedActions,
  resolveAllowedAction,
} from "@/lib/dashboard/htmlcard/protocol";
import type { WidgetRendererProps } from "@/lib/dashboard/widget-def";

export function HtmlCardRenderer({
  widget,
  config,
  data,
  actionsById,
}: WidgetRendererProps) {
  const html = cfgString(config, "html", "");
  const css = cfgString(config, "css", "");
  const javascript = cfgString(config, "javascript", "");
  const color = cfgStringSafe(config);
  const allowed = useMemo(() => parseAllowedActions(config.allowedActions), [config]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [jsError, setJsError] = useState<string | null>(null);

  const execute = useActionExecutor();

  // Últimos datos/acciones para el handler (patrón latest-ref: identidad estable).
  const liveRef = useRef({ allowed, actionIds: widget.actionIds, actionsById });
  useEffect(() => {
    liveRef.current = { allowed, actionIds: widget.actionIds, actionsById };
  }, [allowed, widget.actionIds, actionsById]);

  const srcDoc = useMemo(() => buildSandboxDoc({ html, css, javascript }), [html, css, javascript]);
  const snapshot = useMemo(() => buildSnapshot(data), [data]);

  // Ajuste de estado durante el render (patrón React): un cambio de código
  // recarga el iframe; el error de la versión anterior deja de aplicar.
  const [lastDoc, setLastDoc] = useState(srcDoc);
  if (lastDoc !== srcDoc) {
    setLastDoc(srcDoc);
    if (jsError !== null) setJsError(null);
  }

  const handlers = useMemo<ImindSandboxHandlers>(
    () => ({
      onError: (message) => setJsError(message),
      onAction: (token, respond) => {
        const cur = liveRef.current;
        const res = resolveAllowedAction(cur.allowed, token, cur.actionIds, cur.actionsById);
        if (!res.ok) {
          respond(false, res.message);
          return;
        }
        if (res.confirm && !window.confirm(`¿Ejecutar la acción "${token}"?`)) {
          respond(false, "Acción cancelada por el usuario");
          return;
        }
        void execute(res.action).then((r) => respond(r.ok, r.message));
      },
    }),
    [execute],
  );

  useImindSandbox({ iframeRef, snapshot, handlers });

  return (
    <WidgetCard className="p-3">
      <div className="flex items-center justify-between gap-2">
        <WidgetHeader
          widget={widget}
          icon={Info}
          color={color}
          subtitle="html_card · sandbox"
        />
      </div>
      <div className="relative mt-2 min-h-0 flex-1 overflow-hidden rounded-lg border border-border/60 bg-white">
        <iframe
          ref={iframeRef}
          title={widget.title}
          srcDoc={srcDoc}
          sandbox={SANDBOX_ATTR}
          className="h-full w-full"
        />
      </div>
      {jsError ? (
        <p className="mt-1.5 truncate text-[10px] text-destructive" title={jsError}>
          Error JS: {jsError}
        </p>
      ) : null}
      {data.error ? (
        <p className="mt-1.5 truncate text-[10px] text-destructive" title={data.error}>
          {data.error}
        </p>
      ) : null}
    </WidgetCard>
  );
}
