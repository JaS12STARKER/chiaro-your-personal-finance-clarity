import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { leggiImporto, importoPerModifica } from "@/lib/importo";
import { AnteprimaImporto } from "@/components/AnteprimaImporto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, X } from "lucide-react";
import { useConti, useElimina, useEntrate, useSalva, type Entrata } from "@/lib/db";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/entrate")({
  head: () => ({
    meta: [
      { title: "Entrate — Flowra" },
      { name: "description", content: "Registra stipendi, bonus e altre entrate sui tuoi conti." },
      { property: "og:title", content: "Entrate — Flowra" },
      { property: "og:description", content: "Tutte le tue entrate in un unico elenco." },
    ],
  }),
  component: Entrate,
});

const FONTI = [
  { v: "salary", l: "Stipendio" },
  { v: "bonus", l: "Bonus" },
  { v: "overtime", l: "Straordinari" },
  { v: "freelance", l: "Lavoro autonomo" },
  { v: "rental", l: "Affitti" },
  { v: "reimbursement", l: "Rimborso" },
  { v: "other", l: "Altro" },
] as const;

type Fonte = (typeof FONTI)[number]["v"];

const etichettaFonte = (v: string) => FONTI.find((f) => f.v === v)?.l ?? "Altro";

function Entrate() {
  const conti = useConti();
  const entrate = useEntrate();
  const salva = useSalva("income", "Entrata salvata.");
  const elimina = useElimina("income", "Entrata eliminata.");

  const [modifica, setModifica] = useState<Entrata | null>(null);
  const [fonte, setFonte] = useState<Fonte>("salary");
  const [importo, setImporto] = useState("");
  const [data, setData] = useState(todayISO());
  const [contoId, setContoId] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [ricorrente, setRicorrente] = useState(false);

  const contoSelezionato = contoId || conti.data?.[0]?.id || "";

  function azzera() {
    setModifica(null);
    setFonte("salary");
    setImporto("");
    setData(todayISO());
    setContoId("");
    setDescrizione("");
    setRicorrente(false);
  }

  function apriModifica(e: Entrata) {
    setModifica(e);
    setFonte(e.source_type as Fonte);
    setImporto(importoPerModifica(e.amount));
    setData(e.date);
    setContoId(e.account_id ?? "");
    setDescrizione(e.description ?? "");
    setRicorrente(e.is_recurring);
  }

  function invia(ev: React.FormEvent) {
    ev.preventDefault();
    const letto = leggiImporto(importo);
    if (!contoSelezionato || letto === null) return;
    const valore = Math.abs(letto);
    if (!valore) return;
    salva.mutate(
      {
        ...(modifica ? { id: modifica.id } : {}),
        source_type: fonte,
        amount: valore,
        date: data,
        account_id: contoSelezionato,
        description: descrizione || null,
        is_recurring: ricorrente,
      },
      { onSuccess: azzera },
    );
  }

  const nomeConto = (id: string | null) =>
    conti.data?.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tightest">Entrate</h1>
        <p className="text-sm text-muted-foreground">
          Ogni entrata registrata qui compare anche tra i movimenti del conto scelto.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {modifica ? "Modifica entrata" : "Nuova entrata"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(conti.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Prima aggiungi un conto nella sezione Conti.
            </p>
          ) : (
            <form onSubmit={invia} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo di fonte</Label>
                <Select value={fonte} onValueChange={(v) => setFonte(v as Fonte)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTI.map((f) => (
                      <SelectItem key={f.v} value={f.v}>
                        {f.l}
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
                <AnteprimaImporto testo={importo} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="data">Data</Label>
                <Input
                  id="data"
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Conto</Label>
                <Select value={contoSelezionato} onValueChange={setContoId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(conti.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="descrizione">Descrizione</Label>
                <Input
                  id="descrizione"
                  value={descrizione}
                  onChange={(e) => setDescrizione(e.target.value)}
                  placeholder="Facoltativa"
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch id="ricorrente" checked={ricorrente} onCheckedChange={setRicorrente} />
                <Label htmlFor="ricorrente">Entrata ricorrente</Label>
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={salva.isPending}>
                  {modifica ? "Salva modifiche" : "Aggiungi entrata"}
                </Button>
                {modifica && (
                  <Button type="button" variant="ghost" onClick={azzera}>
                    <X className="size-4" aria-hidden /> Annulla
                  </Button>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{(entrate.data ?? []).length} entrate</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {(entrate.data ?? []).map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-6 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {e.description || etichettaFonte(e.source_type)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(e.date)} · {nomeConto(e.account_id)} ·{" "}
                  {etichettaFonte(e.source_type)}
                  {e.is_recurring ? " · ricorrente" : ""}
                </p>
              </div>
              <span className="numeri-tabellari text-sm font-semibold text-positive">
                {formatCurrency(Number(e.amount))}
              </span>
              <button
                aria-label="Modifica entrata"
                onClick={() => apriModifica(e)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Pencil className="size-4" />
              </button>
              <button
                aria-label="Elimina entrata"
                onClick={() => elimina.mutate(e.id)}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {(entrate.data ?? []).length === 0 && (
            <p className="px-6 py-6 text-sm text-muted-foreground">
              Non hai ancora registrato entrate.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
