import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chiaro — gestione delle finanze personali in euro" },
      {
        name: "description",
        content:
          "Chiaro tiene insieme conti, spese, entrate, budget e obiettivi di risparmio, con numeri leggibili e nessun giudizio.",
      },
      { property: "og:title", content: "Chiaro — le tue finanze, in ordine" },
      {
        property: "og:description",
        content: "Conti, spese, entrate, budget e obiettivi di risparmio in un unico posto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [verificato, setVerificato] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/pannello", replace: true });
      else setVerificato(true);
    });
  }, [navigate]);

  if (!verificato) return <div className="min-h-screen bg-background" />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <h1 className="text-5xl font-semibold tracking-tightest md:text-6xl">Chiaro</h1>
      <p className="mt-4 max-w-md text-balance text-muted-foreground">
        Conti, spese, entrate, budget e obiettivi di risparmio in un unico posto. Numeri leggibili,
        nessun giudizio.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild size="lg">
          <Link to="/accedi">Inizia</Link>
        </Button>
      </div>
    </div>
  );
}
