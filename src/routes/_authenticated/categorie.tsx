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
import { ArrowDown, ArrowUp, Pencil, Trash2, X } from "lucide-react";
import {
  useBudget,
  useCategorie,
  useElimina,
  useSalva,
  useTransazioni,
  type Categoria,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/categorie")({
  head: () => ({
    meta: [
      { title: "Categorie — Flowra" },
      {
        name: "description",
        content: "Organizza le categorie di spesa e indica quali sono necessarie o riducibili.",
      },
      { property: "og:title", content: "Categorie — Flowra" },
      { property: "og:description", content: "Le tue categorie di spesa, come le pensi tu." },
    ],
  }),
  component: Categorie,
});

const LIVELLI = [
  { v: "necessario", l: "Necessario" },
  { v: "importante", l: "Importante" },
  { v: "discrezionale", l: "Discrezionale" },
  { v: "altro", l: "Altro" },
] as const;

type Livello = (typeof LIVELLI)[number]["v"];

const etichettaLivello = (v: string) => LIVELLI.find((l) => l.v === v)?.l ?? "Altro";

function Categorie() {
  const categorie = useCategorie();
  const transazioni = useTransazioni();
  const budget = useBudget();
  const salva = useSalva("categories", "Categoria salvata.");
  const elimina = useElimina("categories", "Categoria eliminata.");

  const [modifica, setModifica] = useState<Categoria | null>(null);
  const [nome, setNome] = useState("");
  const [livello, setLivello] = useState<Livello>("importante");

  const elenco = [...(categorie.data ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  function azzera() {
    setModifica(null);
    setNome("");
    setLivello("importante");
  }

  function apriModifica(c: Categoria) {
    setModifica(c);
    setNome(c.name);
    setLivello(c.essential_level as Livello);
  }

  function invia(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    const prossimoOrdine = elenco.length > 0 ? Math.max(...elenco.map((c) => c.sort_order)) + 1 : 1;
    salva.mutate(
      {
        ...(modifica
          ? { id: modifica.id, sort_order: modifica.sort_order }
          : { sort_order: prossimoOrdine }),
        name: nome.trim(),
        essential_level: livello,
      },
      { onSuccess: azzera },
    );
  }

  /** Scambia l'ordine con la categoria adiacente. */
  function sposta(indice: number, direzione: -1 | 1) {
    const corrente = elenco[indice];
    const vicina = elenco[indice + direzione];
    if (!corrente || !vicina) return;
    salva.mutate({ id: corrente.id, sort_order: vicina.sort_order });
    salva.mutate({ id: vicina.id, sort_order: corrente.sort_order });
  }

  /** Quante volte una categoria è già usata: serve ad avvisare prima di eliminarla. */
  function utilizzi(id: string) {
    const movimenti = (transazioni.data ?? []).filter((t) => t.category_id === id).length;
    const budgets = (budget.data ?? []).filter((b) => b.category_id === id).length;
    return { movimenti, budgets };
  }

  function chiediEdElimina(c: Categoria) {
    const { movimenti, budgets } = utilizzi(c.id);
    if (movimenti > 0 || budgets > 0) {
      const parti: string[] = [];
      if (movimenti > 0) parti.push(`${movimenti} ${movimenti === 1 ? "movimento" : "movimenti"}`);
      if (budgets > 0) parti.push(`${budgets} ${budgets === 1 ? "budget" : "budget"}`);
      const ok = window.confirm(
        `"${c.name}" è usata da ${parti.join(" e ")}. Eliminandola, quei movimenti resteranno senza categoria e i budget collegati verranno eliminati. Vuoi procedere?`,
      );
      if (!ok) return;
    }
    elimina.mutate(c.id);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tightest">Categorie</h1>
        <p className="text-sm text-muted-foreground">
          Il livello di essenzialità distingue le spese difficilmente eliminabili da quelle che
          potresti ridurre. Serve per capire dove hai davvero margine, non per giudicare le tue
          scelte.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {modifica ? "Modifica categoria" : "Nuova categoria"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={invia} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Es. Palestra"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Livello di essenzialità</Label>
              <Select value={livello} onValueChange={(v) => setLivello(v as Livello)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIVELLI.map((l) => (
                    <SelectItem key={l.v} value={l.v}>
                      {l.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={salva.isPending}>
                {modifica ? "Salva modifiche" : "Aggiungi categoria"}
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
          <CardTitle className="text-base">{elenco.length} categorie</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {elenco.map((c, i) => {
            const { movimenti } = utilizzi(c.id);
            return (
              <div key={c.id} className="flex items-center gap-2 px-6 py-3">
                <div className="flex flex-col">
                  <button
                    aria-label="Sposta in alto"
                    disabled={i === 0}
                    onClick={() => sposta(i, -1)}
                    className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    aria-label="Sposta in basso"
                    disabled={i === elenco.length - 1}
                    onClick={() => sposta(i, 1)}
                    className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {etichettaLivello(c.essential_level)}
                    {movimenti > 0
                      ? ` · ${movimenti} ${movimenti === 1 ? "movimento" : "movimenti"}`
                      : ""}
                  </p>
                </div>
                <button
                  aria-label="Modifica categoria"
                  onClick={() => apriModifica(c)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  aria-label="Elimina categoria"
                  onClick={() => chiediEdElimina(c)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
          {elenco.length === 0 && (
            <p className="px-6 py-6 text-sm text-muted-foreground">
              Non hai ancora categorie. Aggiungine una qui sopra.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
