import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type Profilo = Tables<"profiles">;
export type Impostazioni = Tables<"settings">;
export type Conto = Tables<"accounts">;
export type Categoria = Tables<"categories">;
export type Transazione = Tables<"transactions">;
export type Budget = Tables<"budgets">;
export type Entrata = Tables<"income">;
export type Obiettivo = Tables<"savings_goals">;

async function ottieniProfiloId(): Promise<string> {
  const { data, error } = await supabase.rpc("bootstrap_profile");
  if (error) throw error;
  return data as string;
}

export function useProfiloId() {
  return useQuery({
    queryKey: ["profilo-id"],
    queryFn: ottieniProfiloId,
    staleTime: Infinity,
  });
}

export function useProfilo() {
  return useQuery({
    queryKey: ["profilo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useImpostazioni() {
  return useQuery({
    queryKey: ["impostazioni"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useConti() {
  return useQuery({
    queryKey: ["conti"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCategorie() {
  return useQuery({
    queryKey: ["categorie"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTransazioni() {
  return useQuery({
    queryKey: ["transazioni"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBudget() {
  return useQuery({
    queryKey: ["budget"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEntrate() {
  return useQuery({
    queryKey: ["entrate"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useObiettivi() {
  return useQuery({
    queryKey: ["obiettivi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_goals")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

type Tabella =
  | "accounts"
  | "categories"
  | "transactions"
  | "budgets"
  | "income"
  | "savings_goals"
  | "settings";

const chiaviCorrelate: Record<Tabella, string[]> = {
  accounts: ["conti"],
  categories: ["categorie"],
  transactions: ["transazioni", "conti"],
  budgets: ["budget"],
  income: ["entrate", "transazioni", "conti"],
  savings_goals: ["obiettivi"],
  settings: ["impostazioni"],
};


export function useSalva<T extends Tabella>(tabella: T, messaggio: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (valori: TablesInsert<T> | (TablesUpdate<T> & { id?: string })) => {
      const record = valori as Record<string, unknown>;
      if (record.id) {
        const { id, ...resto } = record;
        const { error } = await supabase
          .from(tabella)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(resto as any)
          .eq("id", id as string);
        if (error) throw error;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.from(tabella).insert(record as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      for (const k of chiaviCorrelate[tabella]) qc.invalidateQueries({ queryKey: [k] });
      toast.success(messaggio);
    },
    onError: (e: Error) => toast.error(`Non è stato possibile salvare: ${e.message}`),
  });
}

export function useElimina(tabella: Tabella, messaggio: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tabella).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      for (const k of chiaviCorrelate[tabella]) qc.invalidateQueries({ queryKey: [k] });
      toast.success(messaggio);
    },
    onError: (e: Error) => toast.error(`Non è stato possibile eliminare: ${e.message}`),
  });
}
