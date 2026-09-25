import { formatCurrency } from "@/lib/format";
import { leggiImporto, MESSAGGIO_IMPORTO } from "@/lib/importo";

/** Anteprima del valore interpretato, o errore, sotto un campo importo. */
export function AnteprimaImporto({ testo }: { testo: string }) {
  if (!testo.trim()) return null;
  const v = leggiImporto(testo);
  if (v === null) return <p className="text-xs text-destructive">{MESSAGGIO_IMPORTO}</p>;
  return <p className="text-xs text-muted-foreground">= {formatCurrency(v)}</p>;
}
