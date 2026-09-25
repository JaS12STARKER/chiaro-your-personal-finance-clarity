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
import { useConti, useElimina, useSalva, type Conto } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { saldoTotaleEUR } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/conti")({
  head: () => ({
    meta: [
      { title: "Conti — Flowra" },
      { name: "description", content: "Gestisci i tuoi conti e controlla il saldo complessivo." },
      { property: "og:title", content: "Conti — Flowra" },
      { property: "og:description", content: "Saldo per conto e totale in euro." },
    ],
  }),
  component: Conti,
});

const TIPI = [
  { v: "checking", l: "Conto corrente" },
  { v: "savings", l: "Conto risparmio" },
  { v: "credit_card", l: "Carta di credito" },
  { v: "debit_card", l: "Carta di debito" },
  { v: "cash", l: "Contanti" },
  { v: "investment", l: "Investimenti" },
  { v: "other", l: "Altro" },
] as const;

type TipoConto = (typeof TIPI)[number]["v"];

const etichettaTipo = (v: string) => TIPI.find((t) => t.v === v)?.l ?? "Altro";

function Conti() {
  const conti = useConti();
  const salva = useSalva("accounts", "Conto salvato.");
  const elimina = useElimina("accounts", "Conto eliminato.");

  const [modifica, setModifica] = useState<Conto | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoConto>("checking");
  const [valuta, setValuta] = useState("EUR");
  const [saldoIniziale, setSaldoIniziale] = useState("0");
  const [iban, setIban] = useState("");
  const [attivo, setAttivo] = useState(true);

  function azzera() {
    setModifica(null);
    setNome("");
    setTipo("checking");
    setValuta("EUR");
    setSaldoIniziale("0");
    setIban("");
    setAttivo(true);
  }

  function apriModifica(c: Conto) {
    setModifica(c);
    setNome(c.name);
    setTipo(c.type as TipoConto);
    setValuta(c.currency);
    setSaldoIniziale(importoPerModifica(c.initial_balance));
    setIban(c.iban_masked ?? "");
    setAttivo(c.is_active);
  }

  function invia(e: React.FormEvent) {
    e.preventDefault();
    const saldo = saldoIniziale.trim() ? leggiImporto(saldoIniziale) : 0;
    if (saldo === null) return;
    salva.mutate(
      {
        ...(modifica ? { id: modifica.id } : {}),
        name: nome,
        type: tipo,
        currency: valuta.toUpperCase(),
        initial_balance: saldo,
        iban_masked: iban || null,
        is_active: attivo,
      },
      { onSuccess: azzera },
    );
  }

  const elenco = conti.data ?? [];
  const inEuro = elenco.filter((c) => c.currency === "EUR");
  const altreValute = elenco.filter((c) => c.currency !== "EUR");
  const totale = saldoTotaleEUR(elenco);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tightest">Conti</h1>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Totale dei conti attivi in euro</p>
          <p className="numero-grande mt-1 text-2xl md:text-3xl">{formatCurrency(totale)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{modifica ? "Modifica conto" : "Nuovo conto"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={invia} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoConto)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPI.map((t) => (
                    <SelectItem key={t.v} value={t.v}>
                      {t.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valuta">Valuta</Label>
              <Input
                id="valuta"
                value={valuta}
                onChange={(e) => setValuta(e.target.value)}
                maxLength={3}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="saldo">Saldo iniziale</Label>
              <Input
                id="saldo"
                inputMode="decimal"
                value={saldoIniziale}
                onChange={(e) => setSaldoIniziale(e.target.value)}
              />
              <AnteprimaImporto testo={saldoIniziale} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iban">Ultime cifre IBAN (facoltativo)</Label>
              <Input
                id="iban"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="•••• 1234"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch id="attivo" checked={attivo} onCheckedChange={setAttivo} />
              <Label htmlFor="attivo">Conto attivo</Label>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={salva.isPending}>
                {modifica ? "Salva modifiche" : "Aggiungi conto"}
              </Button>
              {modifica && (
                <Button type="button" variant="ghost" onClick={azzera}>
                  <X className="size-4" aria-hidden /> Annulla
                </Button>
              )}
            </div>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Il saldo attuale si aggiorna da solo in base ai movimenti registrati: non è modificabile
            a mano.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conti in euro</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {inEuro.map((c) => (
            <RigaConto
              key={c.id}
              conto={c}
              onModifica={() => apriModifica(c)}
              onElimina={() => elimina.mutate(c.id)}
            />
          ))}
          {inEuro.length === 0 && (
            <p className="px-6 py-6 text-sm text-muted-foreground">Nessun conto in euro.</p>
          )}
        </CardContent>
      </Card>

      {altreValute.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conti in altre valute</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <p className="px-6 pb-3 text-sm text-muted-foreground">
              Questi conti non sono inclusi nel totale in euro, perché usano una valuta diversa.
            </p>
            <div className="divide-y divide-border">
              {altreValute.map((c) => (
                <RigaConto
                  key={c.id}
                  conto={c}
                  onModifica={() => apriModifica(c)}
                  onElimina={() => elimina.mutate(c.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RigaConto({
  conto,
  onModifica,
  onElimina,
}: {
  conto: Conto;
  onModifica: () => void;
  onElimina: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-6 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {conto.name}
          {!conto.is_active && (
            <span className="ml-2 text-xs text-muted-foreground">non attivo</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {etichettaTipo(conto.type)}
          {conto.iban_masked ? ` · ${conto.iban_masked}` : ""} · {conto.currency}
        </p>
      </div>
      <span className="numeri-tabellari text-sm font-semibold">
        {formatCurrency(Number(conto.current_balance), conto.currency)}
      </span>
      <button
        aria-label="Modifica conto"
        onClick={onModifica}
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        <Pencil className="size-4" />
      </button>
      <button
        aria-label="Elimina conto"
        onClick={onElimina}
        className="text-muted-foreground transition-colors hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
