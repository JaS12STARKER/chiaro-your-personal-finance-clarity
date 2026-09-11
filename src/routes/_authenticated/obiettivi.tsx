import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, X } from "lucide-react";
import { useElimina, useObiettivi, useSalva, type Obiettivo } from "@/lib/db";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/obiettivi")({
  head: () => ({
    meta: [
      { title: "Obiettivi — Chiaro" },
      { name: "description", content: "Definisci obiettivi di risparmio e segui i progressi." },
      { property: "og:title", content: "Obiettivi — Chiaro" },
      { property: "og:description", content: "Progresso dei tuoi obiettivi di risparmio." },
    ],
  }),
  component: Obiettivi,
});

function Obiettivi() {
  const obiettivi = useObiettivi();
  const salva = useSalva("savings_goals", "Obiettivo salvato.");
  const elimina = useElimina("savings_goals", "Obiettivo eliminato.");

  const [modifica, setModifica] = useState<Obiettivo | null>(null);
  const [nome, setNome] = useState("");
  const [target, setTarget] = useState("");
  const [attuale, setAttuale] = useState("0");
  const [dataObiettivo, setDataObiettivo] = useState("");
  const [contributo, setContributo] = useState("");

  function azzera() {
    setModifica(null);
    setNome("");
    setTarget("");
    setAttuale("0");
    setDataObiettivo("");
    setContributo("");
  }

  function apriModifica(o: Obiettivo) {
    setModifica(o);
    setNome(o.name);
    setTarget(String(o.target_amount));
    setAttuale(String(o.current_amount));
    setDataObiettivo(o.target_date ?? "");
    setContributo(o.monthly_contribution != null ? String(o.monthly_contribution) : "");
  }

  function invia(e: React.FormEvent) {
    e.preventDefault();
    const num = (v: string) => Number(v.replace(",", "."));
    salva.mutate(
      {
        ...(modifica ? { id: modifica.id } : {}),
        name: nome,
        target_amount: Math.abs(num(target)) || 0,
        current_amount: Math.abs(num(attuale)) || 0,
        target_date: dataObiettivo || null,
        monthly_contribution: contributo ? Math.abs(num(contributo)) : null,
      },
      { onSuccess: azzera },
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tightest">Obiettivi</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {modifica ? "Modifica obiettivo" : "Nuovo obiettivo"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={invia} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target">Importo da raggiungere (€)</Label>
              <Input
                id="target"
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attuale">Capitale attuale (€)</Label>
              <Input
                id="attuale"
                inputMode="decimal"
                value={attuale}
                onChange={(e) => setAttuale(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data">Data obiettivo (facoltativa)</Label>
              <Input
                id="data"
                type="date"
                value={dataObiettivo}
                onChange={(e) => setDataObiettivo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contributo">Contributo mensile (facoltativo)</Label>
              <Input
                id="contributo"
                inputMode="decimal"
                value={contributo}
                onChange={(e) => setContributo(e.target.value)}
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={salva.isPending}>
                {modifica ? "Salva modifiche" : "Aggiungi obiettivo"}
              </Button>
              {modifica && (
                <Button type="button" variant="ghost" onClick={azzera}>
                  <X className="size-4" aria-hidden /> Annulla
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">I tuoi obiettivi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {(obiettivi.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nessun obiettivo registrato.</p>
          )}
          {(obiettivi.data ?? []).map((o) => {
            const target = Number(o.target_amount);
            const attuale = Number(o.current_amount);
            const perc = target > 0 ? (attuale / target) * 100 : 0;
            const contributo = o.monthly_contribution ? Number(o.monthly_contribution) : 0;
            const mancante = Math.max(0, target - attuale);
            const mesi = contributo > 0 ? Math.ceil(mancante / contributo) : null;
            return (
              <div key={o.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{o.name}</span>
                  <span className="numeri-tabellari text-muted-foreground">
                    {formatCurrency(attuale)} di {formatCurrency(target)}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, perc)}%` }}
                  />
                </div>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {formatPercent(perc, 0)} completato
                    {o.target_date ? ` · data obiettivo ${formatDate(o.target_date)}` : ""}
                    {mesi !== null
                      ? ` · stima: circa ${mesi} ${mesi === 1 ? "mese" : "mesi"} al traguardo con ${formatCurrency(contributo)} al mese (è una stima, non una certezza)`
                      : ""}
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <button
                      aria-label="Modifica obiettivo"
                      onClick={() => apriModifica(o)}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      aria-label="Elimina obiettivo"
                      onClick={() => elimina.mutate(o.id)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
