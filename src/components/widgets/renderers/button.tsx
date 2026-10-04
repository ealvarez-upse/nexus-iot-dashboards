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
import {
  WidgetCard,
  WidgetLoading,
} from "./shared";
import { cfgBool, cfgString, iconByName } from "./widget-utils";
import { useWidgetAction } from "./use-widget-action";
import type { WidgetRendererProps } from "@/lib/dashboard/widget-def";

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
