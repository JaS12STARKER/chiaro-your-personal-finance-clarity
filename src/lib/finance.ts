/**
 * Unica fonte di verità per i calcoli finanziari dell'app.
 * Qualsiasi schermata che mostra entrate, spese, risparmio o stato budget
 * deve usare queste funzioni: non duplicare la logica altrove.
 */
import { toISODate, formatCurrencyAbs, elencoItaliano } from "./format";

export type TxLike = {
  amount: number;
  date: string;
  status: "pending" | "booked";
  category_id: string | null;
  account_id: string;
};

export type IncomeLike = {
  amount: number;
  date: string;
};

export type AccountLike = {
  id: string;
  currency: string;
  current_balance: number;
  is_active: boolean;
};

export type Periodo = { inizio: string; fine: string };

export function periodoMese(riferimento: Date): Periodo {
  const inizio = new Date(riferimento.getFullYear(), riferimento.getMonth(), 1);
  const fine = new Date(riferimento.getFullYear(), riferimento.getMonth() + 1, 0);
  return { inizio: toISODate(inizio), fine: toISODate(fine) };
}

export function periodoMesePrecedente(riferimento: Date): Periodo {
  return periodoMese(new Date(riferimento.getFullYear(), riferimento.getMonth() - 1, 1));
}

/** Le date future sono ammesse ma escluse dai totali del periodo. */
export function inPeriodo(dataISO: string, periodo: Periodo, oggi: string): boolean {
  const d = dataISO.slice(0, 10);
  return d >= periodo.inizio && d <= periodo.fine && d <= oggi;
}

export type Totali = {
  entrate: number;
  spese: number;
  risparmio: number;
  tassoRisparmio: number;
  numeroMovimenti: number;
};

export function calcolaTotali(
  transazioni: TxLike[],
  entrate: IncomeLike[],
  periodo: Periodo,
  oggi: string,
): Totali {
  let totEntrate = 0;
  let totSpese = 0;
  let n = 0;

  for (const t of transazioni) {
    if (t.status !== "booked") continue;
    if (!inPeriodo(t.date, periodo, oggi)) continue;
    n++;
    if (t.amount >= 0) totEntrate += t.amount;
    else totSpese += -t.amount;
  }
  for (const e of entrate) {
    if (!inPeriodo(e.date, periodo, oggi)) continue;
    totEntrate += e.amount;
  }

  const risparmio = totEntrate - totSpese;
  const tasso = totEntrate > 0 ? (risparmio / totEntrate) * 100 : 0;
  return {
    entrate: round2(totEntrate),
    spese: round2(totSpese),
    risparmio: round2(risparmio),
    tassoRisparmio: round2(tasso),
    numeroMovimenti: n,
  };
}

export function spesePerCategoria(
  transazioni: TxLike[],
  periodo: Periodo,
  oggi: string,
): Map<string, number> {
  const mappa = new Map<string, number>();
  for (const t of transazioni) {
    if (t.status !== "booked" || t.amount >= 0) continue;
    if (!inPeriodo(t.date, periodo, oggi)) continue;
    const key = t.category_id ?? "senza-categoria";
    mappa.set(key, round2((mappa.get(key) ?? 0) + -t.amount));
  }
  return mappa;
}

/** Saldo aggregato dei soli conti in EUR attivi. */
export function saldoTotaleEUR(conti: AccountLike[]): number {
  return round2(
    conti
      .filter((c) => c.is_active && c.currency === "EUR")
      .reduce((s, c) => s + Number(c.current_balance ?? 0), 0),
  );
}

export type StatoBudget = "ok" | "attenzione" | "superato";

export function statoBudget(speso: number, importo: number, soglia: number): StatoBudget {
  if (importo <= 0) return "ok";
  const perc = (speso / importo) * 100;
  if (perc >= 100) return "superato";
  if (perc >= soglia) return "attenzione";
  return "ok";
}

export const coloreBudget: Record<StatoBudget, { barra: string; testo: string; sfondo: string }> = {
  ok: { barra: "bg-positive", testo: "text-positive", sfondo: "bg-positive-soft" },
  attenzione: { barra: "bg-caution", testo: "text-caution", sfondo: "bg-caution-soft" },
  superato: { barra: "bg-negative", testo: "text-negative", sfondo: "bg-negative-soft" },
};

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Confronto in linguaggio naturale generato da regole (nessuna AI).
 * Tono descrittivo, mai valutativo.
 */
export function frasiConfronto(
  corrente: Totali,
  precedente: Totali,
  variazioniCategoria: { nome: string; delta: number }[],
): string[] {
  const frasi: string[] = [];
  const deltaSpese = round2(corrente.spese - precedente.spese);

  if (precedente.spese === 0 && corrente.spese === 0) {
    frasi.push("Non ci sono ancora spese registrate in questo mese o nel precedente.");
  } else if (Math.abs(deltaSpese) < 1) {
    frasi.push("Le spese di questo mese sono in linea con quelle del mese scorso.");
  } else if (deltaSpese > 0) {
    frasi.push(
      `Questo mese hai speso ${formatCurrencyAbs(deltaSpese)} in più rispetto al mese scorso.`,
    );
  } else {
    frasi.push(
      `Questo mese hai speso ${formatCurrencyAbs(deltaSpese)} in meno rispetto al mese scorso.`,
    );
  }

  const inCrescita = variazioniCategoria
    .filter((v) => v.delta > 1)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 2)
    .map((v) => v.nome);
  const inCalo = variazioniCategoria
    .filter((v) => v.delta < -1)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 2)
    .map((v) => v.nome);

  if (deltaSpese > 0 && inCrescita.length > 0) {
    frasi.push(`L'aumento principale viene da ${elencoItaliano(inCrescita)}.`);
  } else if (deltaSpese < 0 && inCalo.length > 0) {
    frasi.push(`La differenza maggiore riguarda ${elencoItaliano(inCalo)}.`);
  }

  const deltaEntrate = round2(corrente.entrate - precedente.entrate);
  if (Math.abs(deltaEntrate) >= 1) {
    frasi.push(
      deltaEntrate > 0
        ? `Le entrate registrate sono ${formatCurrencyAbs(deltaEntrate)} più alte del mese scorso.`
        : `Le entrate registrate sono ${formatCurrencyAbs(deltaEntrate)} più basse del mese scorso.`,
    );
  }

  return frasi;
}

/** Giorni di storico disponibili, a partire dalla prima data registrata. */
export function giorniDiStorico(date: string[], oggi: string): number {
  if (date.length === 0) return 0;
  const prima = date.map((d) => d.slice(0, 10)).sort()[0]!;
  const diff = (new Date(oggi).getTime() - new Date(prima).getTime()) / 86400000;
  return Math.max(0, Math.floor(diff));
}
