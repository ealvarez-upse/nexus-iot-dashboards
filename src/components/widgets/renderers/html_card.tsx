import { Info } from "lucide-react";
import { WidgetCard, WidgetHeader, cfgString, cfgStringSafe } from "./shared";
import type { WidgetRendererProps } from "@/lib/dashboard/widget-def";

/**
 * HTML Card (Fase 1: estructura preparada, render seguro).
 *
 * Arquitectura de seguridad desde el día uno:
 *  - El HTML/CSS del usuario se renderiza en un <iframe sandbox> SIN
 *    `allow-scripts`: no hay ejecución de JavaScript en el DOM de IMIND.
 *  - El campo `javascript` se guarda en configuración (serializable) pero es
 *    INERTE; en Fase 2 se ejecutará dentro de este mismo iframe aislado con
 *    un contexto de datos y APIs explícitamente permitidas (postMessage).
 *  - Los datasources y acciones del widget ya quedan referenciados en el
 *    modelo, listos para inyectarse al sandbox.
 */
export function HtmlCardRenderer({ widget, config, data, editMode }: WidgetRendererProps) {
  const html = cfgString(config, "html", "");
  const css = cfgString(config, "css", "");
  const javascript = cfgString(config, "javascript", "");
  const color = cfgStringSafe(config);
  const hasJs = javascript.trim().length > 0;

  const srcDoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html,body{margin:0;padding:12px;font-family:Inter,system-ui,sans-serif;background:transparent;}
  ${css}
</style>
</head>
<body>${html}</body>
</html>`;

  return (
    <WidgetCard className="p-3">
      <div className="flex items-center justify-between gap-2">
        <WidgetHeader
          widget={widget}
          icon={Info}
          color={color}
          subtitle="html_card"
        />
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-hidden rounded-lg border border-border/60 bg-white">
        <iframe
          title={widget.title}
          srcDoc={srcDoc}
          sandbox=""
          className="h-full w-full"
        />
      </div>
      {hasJs && !editMode ? (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          JavaScript definido: se ejecutará en Fase 2 dentro de este iframe aislado.
        </p>
      ) : null}
      {data.error ? (
        <p className="mt-1.5 text-[10px] text-destructive">{data.error}</p>
      ) : null}
    </WidgetCard>
  );
}

