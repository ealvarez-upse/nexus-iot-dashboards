import { WidgetCard } from "./shared";

/** Placeholder para tipos de widget no registrados (docs corruptos/futuros). */
export function UnknownRenderer({
  widget,
}: {
  widget: { title: string; configuration?: Record<string, unknown> };
}) {
  return (
    <WidgetCard className="flex-col items-center justify-center text-center">
      <p className="text-sm font-semibold">{widget.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Este tipo de widget no está registrado en esta versión.
      </p>
    </WidgetCard>
  );
}
