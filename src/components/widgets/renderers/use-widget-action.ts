/**
 * Hook de ejecución de acciones de widget (confirmación y toasts aparte).
 * Archivo separado del renderer Button para cumplir react-refresh
 * (los archivos de componentes solo exportan componentes).
 */

import { useState } from "react";
import { toast } from "sonner";
import { describeTargetLabel, useActionExecutor } from "@/lib/dashboard/actions";
import type { Action } from "@/lib/dashboard/model";

/** Ejecuta una acción del documento con toasts de éxito/error. */
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
