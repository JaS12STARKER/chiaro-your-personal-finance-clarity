import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Download, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useImpostazioni, useSalva, raccogliDatiUtente } from "@/lib/db";
import { applicaTema, type Tema } from "@/lib/tema";

export const Route = createFileRoute("/_authenticated/impostazioni")({
  head: () => ({
    meta: [
      { title: "Impostazioni — Flowra" },
      {
        name: "description",
        content: "Tema, valuta, esportazione dei tuoi dati ed eliminazione dell'account.",
      },
      { property: "og:title", content: "Impostazioni — Flowra" },
      { property: "og:description", content: "Preferenze e gestione dei tuoi dati." },
    ],
  }),
  component: Impostazioni,
});

const TEMI = [
  { v: "light", l: "Chiaro" },
  { v: "dark", l: "Scuro" },
  { v: "system", l: "Come il sistema" },
] as const;

function Impostazioni() {
  const navigate = useNavigate();
  const impostazioni = useImpostazioni();
  const salva = useSalva("settings", "Impostazioni salvate.");

  const [valuta, setValuta] = useState("EUR");
  const [conferma, setConferma] = useState("");
  const [esportazioneInCorso, setEsportazioneInCorso] = useState(false);
  const [eliminazioneInCorso, setEliminazioneInCorso] = useState(false);

  const tema = (impostazioni.data?.theme ?? "system") as Tema;

  useEffect(() => {
    if (impostazioni.data) {
      setValuta(impostazioni.data.currency_default ?? "EUR");
      applicaTema((impostazioni.data.theme ?? "system") as Tema);
    }
  }, [impostazioni.data]);

  function cambiaTema(nuovo: Tema) {
    applicaTema(nuovo);
    if (!impostazioni.data) return;
    salva.mutate({ id: impostazioni.data.id, theme: nuovo });
  }

  function salvaValuta(e: React.FormEvent) {
    e.preventDefault();
    if (!impostazioni.data) return;
    salva.mutate({ id: impostazioni.data.id, currency_default: valuta.toUpperCase() });
  }

  async function esporta() {
    setEsportazioneInCorso(true);
    try {
      const dati = await raccogliDatiUtente();
      const blob = new Blob([JSON.stringify(dati, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flowra-dati-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Dati esportati.");
    } catch (err) {
      toast.error(`Esportazione non riuscita: ${(err as Error).message}`);
    } finally {
      setEsportazioneInCorso(false);
    }
  }

  async function eliminaAccount() {
    if (conferma.trim().toUpperCase() !== "ELIMINA") return;
    const sicuro = window.confirm(
      "Ultima conferma: tutti i tuoi conti, movimenti, budget e obiettivi verranno eliminati definitivamente. L'operazione non è annullabile.",
    );
    if (!sicuro) return;

    setEliminazioneInCorso(true);
    try {
      const { error } = await supabase.rpc("delete_my_data");
      if (error) throw error;
      await supabase.auth.signOut();
      navigate({ to: "/accedi", replace: true });
    } catch (err) {
      toast.error(`Eliminazione non riuscita: ${(err as Error).message}`);
      setEliminazioneInCorso(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tightest">Impostazioni</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aspetto</CardTitle>
        </CardHeader>
        <CardContent className="max-w-xs space-y-1.5">
          <Label>Tema</Label>
          <Select value={tema} onValueChange={(v) => cambiaTema(v as Tema)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMI.map((t) => (
                <SelectItem key={t.v} value={t.v}>
                  {t.l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Valuta</CardTitle>
          <CardDescription>
            Usata per i totali complessivi. I conti in valuta diversa restano mostrati a parte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={salvaValuta} className="flex max-w-xs items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="valuta">Codice valuta</Label>
              <Input
                id="valuta"
                value={valuta}
                onChange={(e) => setValuta(e.target.value)}
                maxLength={3}
              />
            </div>
            <Button type="submit" disabled={salva.isPending}>
              Salva
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">I tuoi dati</CardTitle>
          <CardDescription>
            Scarica una copia completa di tutto ciò che Flowra ha registrato su di te, in formato
            JSON.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={esporta} disabled={esportazioneInCorso}>
            <Download className="size-4" aria-hidden />
            {esportazioneInCorso ? "Esportazione…" : "Esporta tutti i miei dati"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <TriangleAlert className="size-4" aria-hidden />
            Elimina il mio account
          </CardTitle>
          <CardDescription>
            Vengono eliminati definitivamente conti, movimenti, entrate, categorie, budget e
            obiettivi. L&apos;operazione non è annullabile: se ti servono i dati, esportali prima.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="conferma">Scrivi ELIMINA per confermare</Label>
            <Input
              id="conferma"
              value={conferma}
              onChange={(e) => setConferma(e.target.value)}
              placeholder="ELIMINA"
            />
          </div>
          <Button
            variant="destructive"
            onClick={eliminaAccount}
            disabled={conferma.trim().toUpperCase() !== "ELIMINA" || eliminazioneInCorso}
          >
            {eliminazioneInCorso ? "Eliminazione…" : "Elimina definitivamente"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
