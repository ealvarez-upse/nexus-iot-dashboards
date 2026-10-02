import { useState } from "react";
import { toast } from "sonner";
import {
  DoorOpen,
  Droplets,
  Fan,
  Flame,
  Lightbulb,
  Play,
  Power,
  Snowflake,
  Square,
  Thermometer,
  ToggleLeft,
  Zap,
  type LucideIcon,
} from "lucide-react";
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
import { describeTargetLabel, useActionExecutor } from "@/lib/dashboard/actions";
import type { Action } from "@/lib/dashboard/model";
import {
  cfgBool,
  cfgString,
  WidgetCard,
  WidgetLoading,
} from "./shared";
import type { WidgetRendererProps } from "@/lib/dashboard/widget-def";

/** Catálogo de iconos ofrecidos para Button/Switch (nombre → icono). */
export const BUTTON_ICONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "power", label: "Encendido", icon: Power },
  { value: "play", label: "Iniciar", icon: Play },
  { value: "square", label: "Detener", icon: Square },
  { value: "fan", label: "Ventilador", icon: Fan },
  { value: "snowflake", label: "Frío", icon: Snowflake },
  { value: "flame", label: "Calor", icon: Flame },
  { value: "lightbulb", label: "Luz", icon: Lightbulb },
  { value: "door", label: "Puerta", icon: DoorOpen },
  { value: "droplets", label: "Humedad", icon: Droplets },
  { value: "thermometer", label: "Temperatura", icon: Thermometer },
  { value: "toggle", label: "Interruptor", icon: ToggleLeft },
  { value: "zap", label: "Energía", icon: Zap },
];

export function iconByName(name: string, fallback: LucideIcon = Power): LucideIcon {
  return BUTTON_ICONS.find((i) => i.value === name)?.icon ?? fallback;
}

/** Ejecuta una acción del documento con confirmación opcional y toasts. */
export function useWidgetAction() {
  const execute = useActionExecutor();
  const [pending, setPending] = useState(false);

  const run = async (action: Action | undefined, deviceName?: string) => {
    if (!action) {
      toast.error("Configura una acción para este widget");
      return;
    }
    setPending(true);
    try {
      const res = await execute(action);
      if (res.ok) {
        toast.success("Comando enviado", {
          description: `${describeTargetLabel(action, deviceName)} → ${JSON.stringify(action.payload ?? {})}`,
        });
      } else {
        toast.error(res.message);
      }
    } finally {
      setPending(false);
    }
  };

  return { run, pending };
}

/** Button: widget de control real (texto, icono, acción, confirmación). */
export function ButtonRenderer({ widget, config, data, actionsById }: WidgetRendererProps) {
  const color = cfgString(config, "color", "#0891b2");
  const icon = iconByName(cfgString(config, "icon", "power"));
  const confirmEnabled = cfgBool(config, "confirmEnabled", true);
  const confirmMessage = cfgString(config, "confirmMessage", "");
  const action = actionsById[widget.actionIds[0] ?? ""];
  const label = widget.title;
  const { run, pending } = useWidgetAction();
  const [askOpen, setAskOpen] = useState(false);

  const targetName = data.device?.name || action?.target?.entityId;

  const handleClick = () => {
    if (!action) {
      toast.error("Configura una acción para este widget");
      return;
    }
    if (confirmEnabled) setAskOpen(true);
    else void run(action, targetName);
  };

  return (
    <WidgetCard className="items-stretch justify-center p-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
        style={{ backgroundColor: `${color}1f`, color, border: `1px solid ${color}44` }}
      >
        {pending ? (
          <WidgetLoading label="Enviando…" />
        ) : (
          <>
            {(() => {
              const Icon = icon;
              return <Icon className="size-6" />;
            })()}
            <span className="text-sm uppercase tracking-wide">{label}</span>
          </>
        )}
      </button>

      <AlertDialog open={askOpen} onOpenChange={setAskOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmMessage || `¿Confirmar "${label}"?`}</AlertDialogTitle>
            <AlertDialogDescription>
              Destino: {targetName ?? "sin destino"} · Payload:{" "}
              <span className="font-mono">{JSON.stringify(action?.payload ?? {})}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void run(action, targetName)}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WidgetCard>
  );
}
