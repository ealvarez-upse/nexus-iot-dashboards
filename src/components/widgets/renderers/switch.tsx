import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { describeTargetLabel, useActionExecutor } from "@/lib/dashboard/actions";
import type { Action } from "@/lib/dashboard/model";
import { cn } from "@/lib/utils";
import {
  WidgetCard,
  WidgetHeader,
  cfgBool,
  cfgString,
} from "./shared";
import { iconByName, useWidgetAction } from "./button";
import type { WidgetRendererProps } from "@/lib/dashboard/widget-def";

/**
 * Switch: dos acciones del documento (ON / OFF) vía on_change.
 * El estado visual es local (simulado); en Fase 5 el estado real llegará
 * por el provider MQTT/HTTP sin cambiar este renderer.
 */
export function SwitchRenderer({ widget, config, data, actionsById }: WidgetRendererProps) {
  const color = cfgString(config, "color", "#0d9488");
  const icon = iconByName(cfgString(config, "icon", "toggle"));
  const confirmEnabled = cfgBool(config, "confirmEnabled", false);
  const confirmMessage = cfgString(config, "confirmMessage", "");
  const onAction = actionsById[widget.actionIds[0] ?? ""];
  const offAction = actionsById[widget.actionIds[1] ?? ""];
  const { run, pending } = useWidgetAction();
  const [on, setOn] = useState(false);
  const [ask, setAsk] = useState<{ action: Action; next: boolean } | null>(null);

  const targetName = data.device?.name || onAction?.target?.entityId || offAction?.target?.entityId;

  const applyToggle = (next: boolean, action: Action | undefined) => {
    if (!action) {
      toast.error(`Configura la acción ${next ? "ON" : "OFF"} para este widget`);
      return;
    }
    if (confirmEnabled) {
      setAsk({ action, next });
      return;
    }
    setOn(next);
    void run(action, targetName);
  };

  const handleToggle = (next: boolean) => {
    applyToggle(next, next ? onAction : offAction);
  };

  const Icon = icon;

  return (
    <WidgetCard className="justify-center">
      <WidgetHeader
        widget={widget}
        icon={Icon}
        color={color}
        subtitle={on ? "ENCENDIDO" : "APAGADO"}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <div
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
            on ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
          )}
        >
          {pending ? "Enviando…" : on ? "ON" : "OFF"}
        </div>
        <Switch
          checked={on}
          onCheckedChange={handleToggle}
          disabled={pending}
          aria-label={widget.title}
        />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {describeTargetLabel(onAction ?? offAction, targetName)}
      </p>

      <AlertDialog open={ask !== null} onOpenChange={(o) => !o && setAsk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmMessage || "¿Confirmar el cambio de estado?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Destino: {targetName ?? "sin destino"} · Payload:{" "}
              <span className="font-mono">{JSON.stringify(ask?.action.payload ?? {})}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (ask) {
                  setOn(ask.next);
                  void run(ask.action, targetName);
                }
                setAsk(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WidgetCard>
  );
}
