import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { timeAgo } from "@/lib/format";
import { WidgetCard, WidgetHeader, WidgetLoading } from "./shared";
import {
  cfgNumber,
  cfgStringSafe,
  formatValue,
  keyIconFor,
  suggestUnit,
} from "./widget-utils";
import type { WidgetRendererProps } from "@/lib/dashboard/widget-def";

/** Data Table: una fila por clave del datasource con su último valor. */
export function DataTableRenderer({ widget, config, data }: WidgetRendererProps) {
  const decimals = cfgNumber(config, "decimals", 2);
  const color = cfgStringSafe(config);
  const keys = Object.keys(data.series);

  return (
    <WidgetCard>
      <WidgetHeader
        widget={widget}
        icon={keyIconFor(keys[0] ?? "")}
        color={color}
        subtitle={data.device?.name}
      />
      <div className="mt-2 min-h-0 flex-1 overflow-auto">
        {data.loading ? (
          <WidgetLoading />
        ) : keys.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Sin claves de datos configuradas
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 text-xs">Clave</TableHead>
                <TableHead className="h-8 text-right text-xs">Último valor</TableHead>
                <TableHead className="h-8 text-right text-xs">Actualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => {
                const points = data.series[key] ?? [];
                const last = points.length > 0 ? points[points.length - 1] : undefined;
                return (
                  <TableRow key={key}>
                    <TableCell className="py-1.5 font-mono text-xs">{key}</TableCell>
                    <TableCell className="py-1.5 text-right font-mono text-xs font-semibold">
                      {formatValue(last?.value, decimals, suggestUnit(key))}
                    </TableCell>
                    <TableCell className="py-1.5 text-right text-xs text-muted-foreground">
                      {last ? timeAgo(last.ts) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </WidgetCard>
  );
}

