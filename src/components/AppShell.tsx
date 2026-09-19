import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Tags,
  Target,
  PiggyBank,
  Settings as SettingsIcon,
  TrendingUp,
  Plus,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoFlowra } from "@/components/LogoFlowra";
import { cn } from "@/lib/utils";

const voci = [
  { to: "/pannello", label: "Panoramica", icon: LayoutDashboard },
  { to: "/movimenti", label: "Movimenti", icon: ArrowLeftRight },
  { to: "/conti", label: "Conti", icon: Wallet },
  { to: "/entrate", label: "Entrate", icon: TrendingUp },
  { to: "/budget", label: "Budget", icon: PiggyBank },
  { to: "/obiettivi", label: "Obiettivi", icon: Target },
  { to: "/categorie", label: "Categorie", icon: Tags },
  { to: "/impostazioni", label: "Impostazioni", icon: SettingsIcon },
] as const;

const vociMobile = voci.slice(0, 4);

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function esci() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/accedi", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar px-3 py-6 md:flex">
        <Link to="/pannello" className="mb-8 px-3">
          <span className="flex items-center gap-2">
            <LogoFlowra className="size-7" />
            <span className="text-2xl font-semibold tracking-tightest text-foreground">Flowra</span>
          </span>
          <p className="text-xs text-muted-foreground">Le tue finanze, in ordine</p>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {voci.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent",
                pathname === to && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <button
          onClick={esci}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent"
        >
          <LogOut className="size-4" aria-hidden />
          Esci
        </button>
      </aside>

      {/* Con la barra di stato traslucida di iOS il contenuto scorrerebbe
          sotto l'orologio: il padding superiore lo tiene sotto la tacca. */}
      <header
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
        className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 px-4 pb-3 backdrop-blur md:hidden"
      >
        <span className="flex items-center gap-2">
          <LogoFlowra className="size-6" />
          <span className="text-xl font-semibold tracking-tightest">Flowra</span>
        </span>
        <button onClick={esci} className="text-sm text-muted-foreground">
          Esci
        </button>
      </header>

      <main className="px-4 pb-32 pt-6 md:ml-60 md:px-8 md:pb-12">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>

      {/* Il bottone resta sopra la barra di navigazione anche sugli iPhone
          con la barra home, che "mangia" circa 34px in fondo allo schermo. */}
      <Link
        to="/movimenti"
        aria-label="Aggiungi spesa"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}
        className="fixed right-4 z-30 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform active:scale-95 md:hidden"
      >
        <Plus className="size-4" aria-hidden />
        Aggiungi spesa
      </Link>

      <nav
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-background/95 backdrop-blur md:hidden"
      >
        {vociMobile.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground",
              pathname === to && "text-primary",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
