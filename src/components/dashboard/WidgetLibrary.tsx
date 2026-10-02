import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  WIDGET_CATEGORY_LABEL,
  WIDGET_CATEGORY_ORDER,
  WIDGET_REGISTRY,
  libraryTypes,
} from "@/lib/dashboard/registry";
import type { WidgetType } from "@/lib/dashboard/model";

interface WidgetLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (type: WidgetType) => void;
}

/**
 * Biblioteca de widgets para "Agregar widget". Los tipos se leen SIEMPRE del
 * registry (agregar un widget nuevo aquí no requiere tocar este archivo):
 * se agrupan por categoría en el orden de WIDGET_CATEGORY_ORDER.
 */
export function WidgetLibrary({ open, onOpenChange, onPick }: WidgetLibraryProps) {
  const allTypes = libraryTypes();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar widget</DialogTitle>
          <DialogDescription>
            Elige un tipo; se colocará en el primer espacio libre del canvas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {WIDGET_CATEGORY_ORDER.map((category) => {
            const types = allTypes.filter((t) => WIDGET_REGISTRY[t].category === category);
            if (types.length === 0) return null;
            return (
              <section key={category} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {WIDGET_CATEGORY_LABEL[category]}
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {types.map((type) => {
                    const def = WIDGET_REGISTRY[type];
                    const Icon = def.icon;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          onOpenChange(false);
                          onPick(type);
                        }}
                        className="group flex items-start gap-3 rounded-xl border bg-background/60 p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                      >
                        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                          <Icon className="size-4.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium leading-tight">{def.label}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {def.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

