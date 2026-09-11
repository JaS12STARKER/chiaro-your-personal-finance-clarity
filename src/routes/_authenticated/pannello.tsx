import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBudget, useCategorie, useConti, useObiettivi, useTransazioni } from "@/lib/db";
import {
  calcolaTotali,
  coloreBudget,
  frasiConfronto,
  giorniDiStorico,
  periodoMese,
  periodoMesePrecedente,
  saldoTotaleEUR,
  spesePerCategoria,
  statoBudget,
} from "@/lib/finance";
import { formatCurrency, formatPercent, nomeMese, todayISO } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/pannello")({
  head: () => ({
    meta: [
      { title: "Panoramica — Chiaro" },
      { name: "description", content: "Entrate, spese, risparmio e budget del mese corrente." },
      { property: "og:title", content: "Panoramica — Chiaro" },
      { property: "og:description", content: "Il riepilogo del mese in numeri chiari." },
    ],
  }),
  component: Pannello,
});

function Numero({
  etichetta,
  valore,
  tono,
}: {
  etichetta: string;
  valore: string;
  tono?: "positivo" | "negativo";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{etichetta}</p>
        <p
          className={`numero-grande mt-1 text-2xl md:text-3xl ${
            tono === "positivo" ? "text-positive" : tono === "negativo" ? "text-negative" : ""
          }`}
        >
          {valore}
        </p>
      </CardContent>
    </Card>
  );
}

function Pannello() {
  const oggi = todayISO();
  const adesso = new Date();
  const mese = periodoMese(adesso);
  const mesePrec = periodoMesePrecedente(adesso);

  const transazioni = useTransazioni();
  const entrate = useEntrate();
  const conti = useConti();
  const categorie = useCategorie();
  const budget = useBudget();
  const obiettivi = useObiettivi();

  const tx = transazioni.data ?? [];
  const inc = entrate.data ?? [];

  const totali = calcolaTotali(tx, inc, mese, oggi);
  const totaliPrec = calcolaTotali(tx, inc, mesePrec, oggi);
  const saldo = saldoTotaleEUR(conti.data ?? []);

  const spese = spesePerCategoria(tx, mese, oggi);
  const spesePrec = spesePerCategoria(tx, mesePrec, oggi);
  const nomeCategoria = (id: string) =>
    (categorie.data ?? []).find((c) => c.id === id)?.name ?? "Senza categoria";

  const variazioni = Array.from(new Set([...spese.keys(), ...spesePrec.keys()])).map((id) => ({
    nome: nomeCategoria(id),
    delta: (spese.get(id) ?? 0) - (spesePrec.get(id) ?? 0),
  }));

  const giorni = giorniDiStorico(
    [...tx.map((t) => t.date), ...inc.map((e) => e.date)].filter((d) => d <= oggi),
    oggi,
  );
  const datiSufficienti = giorni >= 30;

  const caricamento = transazioni.isLoading || entrate.isLoading || conti.isLoading;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tightest">Panoramica</h1>
        <p className="text-sm capitalize text-muted-foreground">{nomeMese(adesso)}</p>
      </header>

      {caricamento ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Numero etichetta="Entrate del mese" valore={formatCurrency(totali.entrate)} tono="positivo" />
          <Numero etichetta="Spese del mese" valore={formatCurrency(totali.spese)} tono="negativo" />
          <Numero
            etichetta="Risparmio netto"
            valore={formatCurrency(totali.risparmio)}
            tono={totali.risparmio >= 0 ? "positivo" : "negativo"}
          />
          <Numero etichetta="Saldo dei conti in euro" valore={formatCurrency(saldo)} />
          <Numero etichetta="Tasso di risparmio" valore={formatPercent(totali.tassoRisparmio)} />
        </div>
      )}

      {!caricamento && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confronto con il mese scorso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {datiSufficienti ? (
              frasiConfronto(totali, totaliPrec, variazioni).map((f, i) => <p key={i}>{f}</p>)
            ) : (
              <p>
                Hai {giorni} giorni di dati registrati. Servono almeno 30 giorni prima che il
                confronto tra periodi diventi indicativo, quindi per ora non mostriamo variazioni.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stato dei budget</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(budget.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Non hai ancora impostato budget.{" "}
              <Link to="/budget" className="text-primary underline-offset-4 hover:underline">
                Creane uno
              </Link>
              .
            </p>
          ) : (
            (budget.data ?? []).map((b) => {
              const speso = b.category_id ? (spese.get(b.category_id) ?? 0) : totali.spese;
              const perc = b.amount > 0 ? (speso / Number(b.amount)) * 100 : 0;
              const stato = statoBudget(speso, Number(b.amount), b.warning_threshold);
              const colori = coloreBudget[stato];
              return (
                <div key={b.id}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">
                      {b.category_id ? nomeCategoria(b.category_id) : "Budget generale"}
                    </span>
                    <span className="numeri-tabellari text-muted-foreground">
                      {formatCurrency(speso)} di {formatCurrency(Number(b.amount))}
                    </span>
                  </div>
                  <div className={`mt-2 h-2 w-full overflow-hidden rounded-full ${colori.sfondo}`}>
                    <div
                      className={`h-full rounded-full ${colori.barra}`}
                      style={{ width: `${Math.min(100, perc)}%` }}
                    />
                  </div>
                  <p className={`mt-1 text-xs ${colori.testo}`}>{formatPercent(perc, 0)} utilizzato</p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Obiettivi di risparmio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(obiettivi.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessun obiettivo attivo.{" "}
              <Link to="/obiettivi" className="text-primary underline-offset-4 hover:underline">
                Aggiungine uno
              </Link>
              .
            </p>
          ) : (
            (obiettivi.data ?? []).map((o) => {
              const perc =
                Number(o.target_amount) > 0
                  ? (Number(o.current_amount) / Number(o.target_amount)) * 100
                  : 0;
              return (
                <div key={o.id}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{o.name}</span>
                    <span className="numeri-tabellari text-muted-foreground">
                      {formatCurrency(Number(o.current_amount))} di{" "}
                      {formatCurrency(Number(o.target_amount))}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, perc)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatPercent(perc, 0)} completato
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
