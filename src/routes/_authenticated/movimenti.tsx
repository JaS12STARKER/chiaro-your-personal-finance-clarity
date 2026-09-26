import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { leggiImporto, importoPerModifica } from "@/lib/importo";
import { AnteprimaImporto } from "@/components/AnteprimaImporto";
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
import { Lock, Pencil, Trash2, X } from "lucide-react";
import {
  useCategorie,
  useConti,
  useElimina,
  useSalva,
  useTransazioni,
  type Transazione,
} from "@/lib/db";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/movimenti")({
  head: () => ({
    meta: [
      { title: "Movimenti — Flowra" },
      { name: "description", content: "Registra e filtra spese ed entrate dei tuoi conti." },
      { property: "og:title", content: "Movimenti — Flowra" },
      { property: "og:description", content: "Registra e filtra spese ed entrate." },
    ],
  }),
  component: Movimenti,
});

const TUTTI = "tutti";

function Movimenti() {
  const conti = useConti();
  const categorie = useCategorie();
  const transazioni = useTransazioni();
  const salva = useSalva("transactions", "Movimento salvato.");
  const elimina = useElimina("transactions", "Movimento eliminato.");
  const formRef = useRef<HTMLDivElement>(null);

  const [modifica, setModifica] = useState<Transazione | null>(null);
  const [tipo, setTipo] = useState<"spesa" | "entrata">("spesa");
  const [importo, setImporto] = useState("");
  const [data, setData] = useState(todayISO());
  const [descrizione, setDescrizione] = useState("");
  const [contoId, setContoId] = useState("");
  const [categoriaId, setCategoriaId] = useState(TUTTI);

  const [filtroConto, setFiltroConto] = useState(TUTTI);
  const [filtroCategoria, setFiltroCategoria] = useState(TUTTI);
  const [da, setDa] = useState("");
  const [a, setA] = useState("");

  const contoSelezionato = contoId || conti.data?.[0]?.id || "";

  const elenco = useMemo(() => {
    return (transazioni.data ?? []).filter((t) => {
      if (filtroConto !== TUTTI && t.account_id !== filtroConto) return false;
      if (filtroCategoria !== TUTTI && t.category_id !== filtroCategoria) return false;
      if (da && t.date < da) return false;
      if (a && t.date > a) return false;
      return true;
    });
  }, [transazioni.data, filtroConto, filtroCategoria, da, a]);

  const nomeConto = (id: string) => conti.data?.find((c) => c.id === id)?.name ?? "—";
  const nomeCategoria = (id: string | null) =>
    id ? (categorie.data?.find((c) => c.id === id)?.name ?? "—") : "Senza categoria";

  function azzera() {
    setModifica(null);
    setTipo("spesa");
    setImporto("");
    setData(todayISO());
    setDescrizione("");
    setContoId("");
    setCategoriaId(TUTTI);
  }

  function apriModifica(t: Transazione) {
    setModifica(t);
    setTipo(Number(t.amount) < 0 ? "spesa" : "entrata");
    setImporto(importoPerModifica(Math.abs(Number(t.amount))));
    setData(t.date.slice(0, 10));
    setContoId(t.account_id);
    setCategoriaId(t.category_id ?? TUTTI);
    setDescrizione(t.description ?? "");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function chiediElimina(t: Transazione) {
    const nome = t.description || nomeCategoria(t.category_id);
    const ok = window.confirm(
      `Eliminare il movimento «${nome}» di ${formatCurrency(Number(t.amount), t.currency)} del ${formatDate(t.date)}? L'operazione non è annullabile.`,
    );
    if (!ok) return;
    elimina.mutate(t.id, {
      onSuccess: () => {
        if (modifica?.id === t.id) azzera();
      },
    });
  }

  function invia(e: React.FormEvent) {
    e.preventDefault();
    const valore = leggiImporto(importo);
    if (!contoSelezionato || valore === null || valore === 0) return;
    salva.mutate(
      {
        ...(modifica ? { id: modifica.id } : {}),
        account_id: contoSelezionato,
        category_id: categoriaId === TUTTI ? null : categoriaId,
        amount: tipo === "spesa" ? -Math.abs(valore) : Math.abs(valore),
        date: data,
        description: descrizione || null,
      },
      { onSuccess: azzera },
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tightest">Movimenti</h1>

      <Card ref={formRef} className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">
            {modifica ? "Modifica movimento" : "Aggiungi rapidamente"}
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
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as "spesa" | "entrata")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spesa">Spesa</SelectItem>
                    <SelectItem value="entrata">Entrata</SelectItem>
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
                <Label>Categoria</Label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TUTTI}>Senza categoria</SelectItem>
                    {(categorie.data ?? []).map((c) => (
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
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" className="flex-1 sm:flex-none" disabled={salva.isPending}>
                  {modifica ? "Salva modifiche" : "Registra movimento"}
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
          <CardTitle className="text-base">Filtri</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="da">Dal</Label>
            <Input id="da" type="date" value={da} onChange={(e) => setDa(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="al">Al</Label>
            <Input id="al" type="date" value={a} onChange={(e) => setA(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Conto</Label>
            <Select value={filtroConto} onValueChange={setFiltroConto}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TUTTI}>Tutti i conti</SelectItem>
                {(conti.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TUTTI}>Tutte le categorie</SelectItem>
                {(categorie.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{elenco.length} movimenti</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {elenco.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-6 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {t.description || nomeCategoria(t.category_id)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(t.date)} · {nomeConto(t.account_id)} · {nomeCategoria(t.category_id)}
                  {t.income_id ? " · da Entrate" : ""}
                </p>
              </div>
              <span
                className={`numeri-tabellari text-sm font-semibold ${
                  Number(t.amount) < 0 ? "text-negative" : "text-positive"
                }`}
              >
                {formatCurrency(Number(t.amount), t.currency)}
              </span>
              {t.income_id ? (
                <span className="p-2 text-xs text-muted-foreground" title="Si modifica dalla pagina Entrate">
                  <Lock className="size-4" aria-hidden />
                </span>
              ) : (
                <>
                  <button
                    aria-label="Modifica movimento"
                    onClick={() => apriModifica(t)}
                    className="-m-1 p-2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    aria-label="Elimina movimento"
                    onClick={() => chiediElimina(t)}
                    className="-m-1 p-2 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </>
              )}

            </div>
          ))}
          {elenco.length === 0 && (
            <p className="px-6 py-6 text-sm text-muted-foreground">
              Nessun movimento con questi filtri.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
