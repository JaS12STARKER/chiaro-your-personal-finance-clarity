import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, X } from "lucide-react";
import { useBudget, useCategorie, useElimina, useSalva, useTransazioni, type Budget } from "@/lib/db";
import { formatCurrency, formatPercent, todayISO } from "@/lib/format";
import { coloreBudget, periodoMese, spesePerCategoria, statoBudget } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/budget")({
  head: () => ({
    meta: [
      { title: "Budget — Chiaro" },
      { name: "description", content: "Imposta budget per categoria e segui quanto hai speso." },
      { property: "og:title", content: "Budget — Chiaro" },
      { property: "og:description", content: "Budget e soglie di avviso personalizzabili." },
    ],
  }),
  component: Budgets,
});

const GENERALE = "generale";

function Budgets() {
  const categorie = useCategorie();
  const budget = useBudget();
  const transazioni = useTransazioni();
  const salva = useSalva("budgets", "Budget salvato.");
  const elimina = useElimina("budgets", "Budget eliminato.");

  const [modifica, setModifica] = useState<Budget | null>(null);
  const [categoriaId, setCategoriaId] = useState(GENERALE);
  const [importo, setImporto] = useState("");
  const [periodo, setPeriodo] = useState<"weekly" | "monthly">("monthly");
  const [soglia, setSoglia] = useState("80");

  const oggi = todayISO();
  const mese = periodoMese(new Date());
  const spese = spesePerCategoria(transazioni.data ?? [], mese, oggi);
  const speseTotali = Array.from(spese.values()).reduce((s, v) => s + v, 0);

  const nomeCategoria = (id: string) =>
    (categorie.data ?? []).find((c) => c.id === id)?.name ?? "Senza categoria";

  function azzera() {
    setModifica(null);
    setCategoriaId(GENERALE);
    setImporto("");
    setPeriodo("monthly");
    setSoglia("80");
  }

  function apriModifica(b: Budget) {
    setModifica(b);
    setCategoriaId(b.category_id ?? GENERALE);
    setImporto(String(b.amount));
    setPeriodo(b.period as "weekly" | "monthly");
    setSoglia(String(b.warning_threshold));
  }

  function invia(e: React.FormEvent) {
    e.preventDefault();
    const valore = Math.abs(Number(importo.replace(",", ".")));
    if (!valore) return;
    salva.mutate(
      {
        ...(modifica ? { id: modifica.id } : {}),
        category_id: categoriaId === GENERALE ? null : categoriaId,
        amount: valore,
        period: periodo,
        warning_threshold: Number(soglia) || 80,
      },
      { onSuccess: azzera },
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tightest">Budget</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {modifica ? "Modifica budget" : "Nuovo budget"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={invia} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GENERALE}>Budget generale</SelectItem>
                  {(categorie.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="importo">Importo (€)</Label>
              <Input
                id="importo"
                inputMode="decimal"
                value={importo}
                onChange={(e) => setImporto(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Periodo</Label>
              <Select value={periodo} onValueChange={(v) => setPeriodo(v as "weekly" | "monthly")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensile</SelectItem>
                  <SelectItem value="weekly">Settimanale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="soglia">Soglia di avviso (%)</Label>
              <Input
                id="soglia"
                type="number"
                min={1}
                max={100}
                value={soglia}
                onChange={(e) => setSoglia(e.target.value)}
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={salva.isPending}>
                {modifica ? "Salva modifiche" : "Aggiungi budget"}
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
          <CardTitle className="text-base">Stato del mese</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(budget.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Non hai ancora impostato budget.</p>
          ) : (
            (budget.data ?? []).map((b) => {
              const speso = b.category_id ? (spese.get(b.category_id) ?? 0) : speseTotali;
              const perc = Number(b.amount) > 0 ? (speso / Number(b.amount)) * 100 : 0;
              const stato = statoBudget(speso, Number(b.amount), b.warning_threshold);
              const colori = coloreBudget[stato];
              return (
                <div key={b.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">
                      {b.category_id ? nomeCategoria(b.category_id) : "Budget generale"}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {b.period === "weekly" ? "settimanale" : "mensile"}
                      </span>
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
                  <div className="mt-1 flex items-center justify-between">
                    <p className={`text-xs ${colori.testo}`}>
                      {formatPercent(perc, 0)} utilizzato · avviso al {b.warning_threshold}%
                    </p>
                    <div className="flex gap-2">
                      <button
                        aria-label="Modifica budget"
                        onClick={() => apriModifica(b)}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        aria-label="Elimina budget"
                        onClick={() => elimina.mutate(b.id)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
