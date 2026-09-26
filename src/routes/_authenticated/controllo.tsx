import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useConti, useTransazioni } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { analizzaDiscrepanze } from "@/lib/discrepanze.functions";

export const Route = createFileRoute("/_authenticated/controllo")({
  head: () => ({
    meta: [
      { title: "Controllo saldi — Flowra" },
      { name: "description", content: "Trova differenze tra saldo iniziale, movimenti e saldo attuale con l'AI." },
      { property: "og:title", content: "Controllo saldi — Flowra" },
      { property: "og:description", content: "Verifica dei saldi dei conti con l'aiuto dell'AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Controllo,
});

function Controllo() {
  const conti = useConti();
  const transazioni = useTransazioni();
  const analizza = useServerFn(analizzaDiscrepanze);
  const [contiSel, setContiSel] = useState<Set<string>>(new Set());
  const [movSel, setMovSel] = useState<Set<string>>(new Set());

  const movimenti = useMemo(
    () => (transazioni.data ?? []).filter((t) => contiSel.has(t.account_id)),
    [transazioni.data, contiSel],
  );
  const nomeConto = (id: string) => conti.data?.find((c) => c.id === id)?.name ?? "—";

  const esegui = useMutation({
    mutationFn: () =>
      analizza({
        data: {
          contiIds: [...contiSel],
          movimentiIds: movimenti.filter((m) => movSel.has(m.id)).map((m) => m.id),
        },
      }),
  });

  function commuta(set: Set<string>, id: string, fn: (s: Set<string>) => void) {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    fn(n);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tightest">Controllo saldi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scegli i conti e, se vuoi, i movimenti da esaminare. L'AI confronta saldo iniziale, movimenti e
          saldo attuale e ti segnala eventuali differenze.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Conti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(conti.data ?? []).map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 py-1.5">
              <Checkbox
                checked={contiSel.has(c.id)}
                onCheckedChange={() => commuta(contiSel, c.id, setContiSel)}
              />
              <span className="flex-1 text-sm">{c.name}</span>
              <span className="numeri-tabellari text-sm text-muted-foreground">
                {formatCurrency(Number(c.current_balance), c.currency)}
              </span>
            </label>
          ))}
          {(conti.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nessun conto da controllare.</p>
          )}
        </CardContent>
      </Card>

      {contiSel.size > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">2. Movimenti da esaminare (facoltativo)</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setMovSel(movSel.size === movimenti.length ? new Set() : new Set(movimenti.map((m) => m.id)))
              }
            >
              {movSel.size === movimenti.length && movimenti.length > 0 ? "Nessuno" : "Tutti"}
            </Button>
          </CardHeader>
          <CardContent className="max-h-80 divide-y divide-border overflow-y-auto p-0">
            {movimenti.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-3 px-6 py-2.5">
                <Checkbox checked={movSel.has(t.id)} onCheckedChange={() => commuta(movSel, t.id, setMovSel)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{t.description || "Movimento"}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(t.date)} · {nomeConto(t.account_id)}
                    {t.status === "pending" ? " · in attesa" : ""}
                  </span>
                </span>
                <span
                  className={`numeri-tabellari text-sm ${Number(t.amount) < 0 ? "text-negative" : "text-positive"}`}
                >
                  {formatCurrency(Number(t.amount), t.currency)}
                </span>
              </label>
            ))}
            {movimenti.length === 0 && (
              <p className="px-6 py-4 text-sm text-muted-foreground">Nessun movimento su questi conti.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Button disabled={contiSel.size === 0 || esegui.isPending} onClick={() => esegui.mutate()}>
        <Sparkles className="size-4" aria-hidden />
        {esegui.isPending ? "Analisi in corso…" : "Analizza con l'AI"}
      </Button>

      {esegui.error && <p className="text-sm text-destructive">{(esegui.error as Error).message}</p>}

      {esegui.data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Confronto dei saldi</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {esegui.data.righe.map((r) => (
                <div key={r.id} className="grid grid-cols-2 gap-1 px-6 py-3 text-sm sm:grid-cols-5">
                  <span className="col-span-2 font-medium sm:col-span-1">{r.nome}</span>
                  <span className="text-muted-foreground">Iniziale {formatCurrency(r.iniziale, r.valuta)}</span>
                  <span className="text-muted-foreground">
                    Movimenti {formatCurrency(r.sommaContabilizzati, r.valuta)}
                  </span>
                  <span>Attuale {formatCurrency(r.attuale, r.valuta)}</span>
                  <span className={r.differenza === 0 ? "text-positive" : "font-semibold text-negative"}>
                    {r.differenza === 0 ? "Tutto torna" : `Differenza ${formatCurrency(r.differenza, r.valuta)}`}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4" aria-hidden /> Cosa ha notato l'AI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{esegui.data.analisi}</div>
              <p className="mt-3 text-xs text-muted-foreground">
                Analisi generata automaticamente: verifica sempre i dati prima di modificarli.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
