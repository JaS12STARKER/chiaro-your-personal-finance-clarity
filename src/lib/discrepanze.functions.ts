import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RigaConto = {
  id: string;
  nome: string;
  valuta: string;
  iniziale: number;
  attuale: number;
  sommaContabilizzati: number;
  atteso: number;
  differenza: number;
};

export const analizzaDiscrepanze = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        contiIds: z.array(z.string().uuid()).min(1).max(50),
        movimentiIds: z.array(z.string().uuid()).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: conti, error: e1 } = await sb
      .from("accounts")
      .select("id,name,currency,initial_balance,current_balance")
      .in("id", data.contiIds);
    if (e1) throw new Error(e1.message);
    const { data: tutti, error: e2 } = await sb
      .from("transactions")
      .select("id,account_id,amount,date,status,description,income_id")
      .in("account_id", data.contiIds);
    if (e2) throw new Error(e2.message);

    const righe: RigaConto[] = (conti ?? []).map((c) => {
      const somma = (tutti ?? [])
        .filter((t) => t.account_id === c.id && t.status === "booked")
        .reduce((s, t) => s + Number(t.amount), 0);
      const atteso = Math.round((Number(c.initial_balance) + somma) * 100) / 100;
      return {
        id: c.id,
        nome: c.name,
        valuta: c.currency,
        iniziale: Number(c.initial_balance),
        attuale: Number(c.current_balance),
        sommaContabilizzati: Math.round(somma * 100) / 100,
        atteso,
        differenza: Math.round((Number(c.current_balance) - atteso) * 100) / 100,
      };
    });

    const scelti = new Set(data.movimentiIds);
    const movimenti = (tutti ?? [])
      .filter((t) => scelti.has(t.id))
      .map((t) => ({
        conto: righe.find((r) => r.id === t.account_id)?.nome,
        importo: Number(t.amount),
        data: t.date,
        stato: t.status === "booked" ? "contabilizzato" : "in attesa",
        descrizione: t.description,
        da_entrate: !!t.income_id,
      }));

    const { chiediAlModello } = await import("./ai-gateway.server");
    const analisi = await chiediAlModello(
      "Sei un assistente di finanza personale. Rispondi in italiano semplice, senza gergo tecnico, in massimo 200 parole con elenco puntato. " +
        "Regola: saldo attuale atteso = saldo iniziale + somma dei movimenti contabilizzati (quelli in attesa non contano). " +
        "Individua discrepanze tra saldo iniziale e attuale, movimenti sospetti (duplicati, importi anomali, date future, segni probabilmente sbagliati, movimenti in attesa). " +
        "Usa il formato euro italiano (1.234,56 €) e date gg/mm/aaaa. Non inventare dati. Tono descrittivo, mai giudicante.",
      JSON.stringify({ oggi: new Date().toISOString().slice(0, 10), conti: righe, movimenti_selezionati: movimenti }),
    );
    return { righe, analisi };
  });
