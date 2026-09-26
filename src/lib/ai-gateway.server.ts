import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const RUN_ID = "X-Lovable-AIG-Run-ID";

function runIdFetch() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has(RUN_ID)) headers.set(RUN_ID, runId);
    const res = await fetch(input, { ...init, headers });
    runId ??= res.headers.get(RUN_ID)?.trim() || undefined;
    return res;
  };
}

/** Chiamata one-shot in streaming, consumata lato server. */
export async function chiediAlModello(system: string, prompt: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Servizio AI non configurato.");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch(),
  });
  let errore: unknown;
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system,
    prompt,
    onError: ({ error }) => {
      errore = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const testo = await result.text;
  if (errore) throw traduciErrore(errore);
  return testo;
}

function traduciErrore(e: unknown): Error {
  const status = (e as { statusCode?: number })?.statusCode;
  if (status === 429) return new Error("Troppe richieste, riprova tra qualche minuto.");
  if (status === 402) return new Error("Crediti AI esauriti: ricaricali dalle impostazioni dello spazio di lavoro.");
  if (status === 403) return new Error("Analisi AI non disponibile al momento per questo spazio di lavoro.");
  return new Error("L'analisi non è riuscita. Riprova più tardi.");
}
