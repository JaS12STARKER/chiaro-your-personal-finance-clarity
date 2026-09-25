import { formatCurrency } from "@/lib/format";

/** Legge un importo scritto in formato italiano. Restituisce null se non valido. */
export function leggiImporto(testo: string): number | null {
  let s = (testo ?? "").replace(/[\s\u00a0€]/g, "");
  if (!s) return null;
  let segno = 1;
  if (s.startsWith("-")) {
    segno = -1;
    s = s.slice(1);
  }
  if (!/^[0-9.,]+$/.test(s)) return null;
  const haPunto = s.includes(".");
  const haVirgola = s.includes(",");
  let intera: string;
  let decimali = "";
  if (haPunto && haVirgola) {
    const dec = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    const mig = dec === "." ? "," : ".";
    const parti = s.split(dec);
    if (parti.length !== 2) return null;
    if (!/^\d{1,3}(\\d{3})*$/.test(parti[0]!) && !new RegExp(`^\\d{1,3}(\\${mig}\\d{3})*$`).test(parti[0]!)) return null;
    intera = parti[0]!.split(mig).join("");
    decimali = parti[1]!;
  } else if (haVirgola) {
    const parti = s.split(",");
    if (parti.length !== 2) return null;
    intera = parti[0]!;
    decimali = parti[1]!;
  } else if (haPunto) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      intera = s.split(".").join("");
    } else if (/^\d+\.\d{1,2}$/.test(s)) {
      [intera, decimali] = s.split(".") as [string, string];
    } else return null;
  } else {
    intera = s;
  }
  if (!/^\d+$/.test(intera) || !/^\d{0,2}$/.test(decimali)) return null;
  if (s.endsWith(",") || s.endsWith(".")) return null;
  return segno * Number(`${intera}.${decimali || "0"}`);
}

/** Numero -> testo italiano per precompilare i campi (1234.5 -> "1234,50"). */
export function importoPerModifica(valore: number | string | null | undefined): string {
  if (valore === null || valore === undefined || valore === "") return "";
  return Number(valore).toFixed(2).replace(".", ",");
}

export const MESSAGGIO_IMPORTO = "Importo non valido, es. 1.234,56";

/** Anteprima / errore sotto un campo importo. */
export function AnteprimaImporto({ testo, errore }: { testo: string; errore?: boolean }) {
  if (!testo.trim()) return null;
  const v = leggiImporto(testo);
  if (v === null)
    return errore ? <p className="text-xs text-destructive">{MESSAGGIO_IMPORTO}</p> : (
      <p className="text-xs text-destructive">{MESSAGGIO_IMPORTO}</p>
    );
  return <p className="text-xs text-muted-foreground">= {formatCurrency(v)}</p>;
}
