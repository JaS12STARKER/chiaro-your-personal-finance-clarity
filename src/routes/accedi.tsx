import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LogoFlowra } from "@/components/LogoFlowra";

export const Route = createFileRoute("/accedi")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Accedi a Flowra — gestione finanze personali" },
      {
        name: "description",
        content:
          "Accedi al tuo spazio Flowra per seguire entrate, spese, budget e obiettivi di risparmio in euro.",
      },
      { property: "og:title", content: "Accedi a Flowra" },
      {
        property: "og:description",
        content: "Entra nel tuo spazio personale per tenere in ordine i conti.",
      },
    ],
  }),
  component: Accedi,
});

function Accedi() {
  const navigate = useNavigate();
  const [modalita, setModalita] = useState<"accedi" | "registrati">("accedi");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [attesa, setAttesa] = useState(false);
  const [confermaInviata, setConfermaInviata] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/pannello", replace: true });
    });
  }, [navigate]);

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    setAttesa(true);
    try {
      if (modalita === "registrati") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: nome },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setConfermaInviata(true);
          return;
        }
        navigate({ to: "/pannello", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/pannello", replace: true });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAttesa(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoFlowra className="mb-3 size-14" />
          <h1 className="text-4xl font-semibold tracking-tightest">Flowra</h1>
          <p className="mt-1 text-sm text-muted-foreground">Le tue finanze, in ordine.</p>
        </div>

        {confermaInviata ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Controlla la posta</CardTitle>
              <CardDescription>
                Ti abbiamo inviato un messaggio a {email}. Apri il link di conferma per attivare
                l&apos;accesso.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {modalita === "accedi" ? "Accedi" : "Crea il tuo spazio"}
              </CardTitle>
              <CardDescription>
                {modalita === "accedi"
                  ? "Inserisci le tue credenziali per continuare."
                  : "Bastano un indirizzo email e una password."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={invia} className="space-y-4">
                {modalita === "registrati" && (
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome</Label>
                    <Input
                      id="nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Come ti chiami"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete={modalita === "accedi" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={attesa}>
                  {attesa ? "Un momento…" : modalita === "accedi" ? "Accedi" : "Crea il mio spazio"}
                </Button>
              </form>
              <button
                type="button"
                onClick={() => setModalita(modalita === "accedi" ? "registrati" : "accedi")}
                className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                {modalita === "accedi"
                  ? "Non hai ancora uno spazio? Registrati"
                  : "Hai già uno spazio? Accedi"}
              </button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
