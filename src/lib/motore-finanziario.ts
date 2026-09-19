/**
 * Motore finanziario di Flowra — funzioni PURE, senza side effect.
 *
 * Principio guida: tutte le metriche nascono qui e solo qui.
 * Nessuna schermata ricalcola un totale per conto proprio, e nessun
 * numero mostrato all'utente viene prodotto da un modello linguistico.
 *
 * Compatibilità: il campo `kind` arriva con la migrazione 003. Finché
 * non c'è, viene trattato come 'standard' — queste funzioni si possono
 * quindi caricare prima della migrazione senza rompere nulla.
 */

// ============================================================
// TIPI
// ============================================================

export type TransactionKind =
  "standard" | "transfer" | "credit_card_payment" | "loan_payment" | "one_time";

export type MovimentoLike = {
  amount: number | string;
  date: string; // ISO, data pura (gg non datetime)
  status?: string | null;
  kind?: TransactionKind | null;
  category_id?: string | null;
};

export type RicorrenzaLike = {
  amount: number | string;
  amount_min?: number | string | null;
  amount_max?: number | string | null;
  amount_variable?: boolean | null;
  frequency: "weekly" | "monthly" | "yearly";
  next_due_date: string;
  is_active?: boolean | null;
  /** true = entrata, false/assente = uscita */
  is_income?: boolean | null;
};

// ============================================================
// 1. IL FILTRO CENTRALE — l'unico punto che decide cosa entra nei report
// ============================================================

/**
 * Quali `kind` entrano nei report entrate/uscite.
 *
 * ATTENZIONE — la distinzione controintuitiva:
 *   - il SALDO di un conto include i trasferimenti (il denaro si muove davvero)
 *   - i REPORT entrate/uscite li escludono (non sono né guadagno né spesa)
 *
 * Un trasferimento di 500 € dal conto al deposito, se contato nei report,
 * gonfia di 500 sia le entrate sia le uscite e falsa tasso di risparmio,
 * cash flow e Health Score. Questa funzione è l'unico posto dove quella
 * regola vive: non duplicarla altrove.
 */
export function entraNeiReport(m: MovimentoLike): boolean {
  const kind = m.kind ?? "standard";
  return kind === "standard" || kind === "loan_payment";
}

/** Come sopra, ma esclude anche gli eventi eccezionali: per le MEDIE storiche. */
export function entraNelleMedie(m: MovimentoLike): boolean {
  return entraNeiReport(m) && (m.kind ?? "standard") !== "one_time";
}

const num = (v: number | string | null | undefined): number =>
  v == null ? 0 : typeof v === "number" ? v : Number(v) || 0;

const arrotonda = (v: number): number => Math.round(v * 100) / 100;

// ============================================================
// 2. PROIEZIONE DEL SALDO
// ============================================================

export type PuntoProiezione = {
  data: string;
  saldo: number;
  /** false solo per il primo punto (oggi, dato reale) */
  previsto: boolean;
};

export type Proiezione = {
  serie: PuntoProiezione[];
  /** Il punto più basso della curva: da qui nasce l'allerta più utile dell'app. */
  minimo: { data: string; saldo: number };
  /** Le ricorrenze che pesano di più sul minimo, per spiegare il perché. */
  causePrincipali: { nome: string; importo: number }[];
};

function aggiungiGiorni(iso: string, giorni: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

function scadeIlGiorno(r: RicorrenzaLike, giorno: string, partenza: string): boolean {
  if (r.is_active === false) return false;
  if (r.next_due_date > giorno) return false;

  const passo = r.frequency === "weekly" ? 7 : r.frequency === "monthly" ? 30 : 365;
  let cursore = r.next_due_date;
  // avanza dal primo giorno utile fino a superare `giorno`
  while (cursore < partenza) cursore = aggiungiGiorni(cursore, passo);
  while (cursore < giorno) cursore = aggiungiGiorni(cursore, passo);
  return cursore === giorno;
}

/** Importo atteso: per le ricorrenze variabili usa il centro del range. */
function importoAtteso(r: RicorrenzaLike): number {
  if (r.amount_variable && r.amount_min != null && r.amount_max != null) {
    return (num(r.amount_min) + num(r.amount_max)) / 2;
  }
  return num(r.amount);
}

/**
 * Espande le ricorrenze su N giorni e restituisce la curva del saldo.
 *
 * Da questa singola funzione derivano gratis: allerta "sotto zero",
 * safe-to-spend, calendario delle uscite e scenari what-if.
 *
 * @param saldoLiquido somma dei saldi dei conti LIQUIDI (esclusi
 *        investimenti e carte di credito: il loro saldo non è cassa)
 */
export function proiettaSaldo(
  saldoLiquido: number,
  ricorrenze: (RicorrenzaLike & { name?: string })[],
  oggi: string,
  giorni = 90,
): Proiezione {
  const serie: PuntoProiezione[] = [
    { data: oggi, saldo: arrotonda(saldoLiquido), previsto: false },
  ];
  const impatti = new Map<string, number>();

  let saldo = saldoLiquido;

  for (let g = 1; g <= giorni; g++) {
    const giorno = aggiungiGiorni(oggi, g);
    for (const r of ricorrenze) {
      if (!scadeIlGiorno(r, giorno, oggi)) continue;
      const importo = importoAtteso(r);
      const delta = r.is_income ? importo : -importo;
      saldo += delta;
      if (delta < 0) {
        const nome = r.name ?? "Spesa ricorrente";
        impatti.set(nome, (impatti.get(nome) ?? 0) + Math.abs(delta));
      }
    }
    serie.push({ data: giorno, saldo: arrotonda(saldo), previsto: true });
  }

  // serie[0] esiste sempre (il punto di partenza è inserito qui sopra), ma va
  // estratto esplicitamente perché il progetto usa noUncheckedIndexedAccess.
  const partenza = serie[0]!;
  const minimo = serie.reduce((min, p) => (p.saldo < min.saldo ? p : min), partenza);

  const causePrincipali = [...impatti.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([nome, importo]) => ({ nome, importo: arrotonda(importo) }));

  return {
    serie,
    minimo: { data: minimo.data, saldo: minimo.saldo },
    causePrincipali,
  };
}

/**
 * L'allerta preventiva più preziosa del prodotto: arriva quando c'è
 * ancora tempo per reagire, non dopo lo sforamento.
 */
export function allertaSottoSoglia(
  p: Proiezione,
  soglia = 0,
): { attiva: boolean; data: string; mancante: number; cause: { nome: string; importo: number }[] } {
  const attiva = p.minimo.saldo < soglia;
  return {
    attiva,
    data: p.minimo.data,
    mancante: attiva ? arrotonda(soglia - p.minimo.saldo) : 0,
    cause: p.causePrincipali,
  };
}

// ============================================================
// 3. SAFE TO SPEND — ispezionabile, mai un numero opaco
// ============================================================

export type VoceSafeToSpend = {
  etichetta: string;
  importo: number; // negativo = sottratto
  escludibile: boolean;
};

export type SafeToSpend = {
  totale: number;
  giornaliero: number;
  giorniRimanenti: number;
  /** Il dettaglio è parte del risultato, non un extra: un numero
   *  che non si può ispezionare distrugge la fiducia al primo errore. */
  voci: VoceSafeToSpend[];
};

export function calcolaSafeToSpend(input: {
  saldoLiquido: number;
  entratePreviste: number;
  usciteRicorrentiPreviste: number;
  accantonamentiObiettivi: number;
  cuscinetto: number;
  giorniRimanenti: number;
}): SafeToSpend {
  const voci: VoceSafeToSpend[] = [
    {
      etichetta: "Saldo disponibile oggi",
      importo: arrotonda(input.saldoLiquido),
      escludibile: false,
    },
    {
      etichetta: "Entrate previste nel periodo",
      importo: arrotonda(input.entratePreviste),
      escludibile: true,
    },
    {
      etichetta: "Spese ricorrenti previste",
      importo: -arrotonda(input.usciteRicorrentiPreviste),
      escludibile: true,
    },
    {
      etichetta: "Accantonamenti per obiettivi",
      importo: -arrotonda(input.accantonamentiObiettivi),
      escludibile: true,
    },
    {
      etichetta: "Cuscinetto di sicurezza",
      importo: -arrotonda(input.cuscinetto),
      escludibile: true,
    },
  ];

  const totale = arrotonda(voci.reduce((s, v) => s + v.importo, 0));
  const giorni = Math.max(1, input.giorniRimanenti);

  return { totale, giornaliero: arrotonda(totale / giorni), giorniRimanenti: giorni, voci };
}

// ============================================================
// 4. OBIETTIVI — inclusa la funzione che quasi nessuno implementa
// ============================================================

/** Ricalcolata ogni mese, non fissata all'inizio: se salti un mese, la rata sale e lo vedi. */
export function versamentoMensileNecessario(
  importoObiettivo: number,
  saldoAttuale: number,
  mesiRimanenti: number,
): number {
  const mesi = Math.max(1, mesiRimanenti);
  return arrotonda(Math.max(0, importoObiettivo - saldoAttuale) / mesi);
}

/**
 * "Ce la fai?" — confronta la somma delle rate con il margine reale.
 * Costo: una sottrazione. Quasi nessun prodotto sul mercato lo fa, ed è
 * la differenza tra un'app che ti lascia impostare obiettivi impossibili
 * e una che ti dice la verità.
 */
export function obiettiviSostenibili(
  rateMensiliTotali: number,
  entrateMedie: number,
  usciteRicorrentiMedie: number,
): { sostenibile: boolean; margine: number; richiesto: number; scoperto: number } {
  const margine = arrotonda(entrateMedie - usciteRicorrentiMedie);
  const richiesto = arrotonda(rateMensiliTotali);
  return {
    sostenibile: richiesto <= margine,
    margine,
    richiesto,
    scoperto: richiesto > margine ? arrotonda(richiesto - margine) : 0,
  };
}

/** Il fondo emergenza è solo un obiettivo dimensionato sui dati reali. */
export function targetFondoEmergenza(spesaMensileMedia: number, mesi = 3): number {
  return arrotonda(spesaMensileMedia * mesi);
}

// ============================================================
// 5. SPESE ANOMALE — statistica robusta, non ML
// ============================================================

function mediana(valori: number[]): number {
  if (valori.length === 0) return 0;
  const s = [...valori].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * z-score modificato su MAD: mediana e MAD sono robuste agli outlier
 * stessi, a differenza di media e deviazione standard.
 * Servono almeno 8 occorrenze: sotto, le soglie non sono affidabili.
 */
export function eAnomala(valore: number, storico: number[], soglia = 3.5): boolean {
  if (storico.length < 8) return false;
  const med = mediana(storico);
  const mad = mediana(storico.map((v) => Math.abs(v - med)));
  if (mad === 0) return false;
  const mz = (0.6745 * (valore - med)) / mad;
  return Math.abs(mz) > soglia;
}

// ============================================================
// 6. FINANCIAL HEALTH SCORE — denominatore dinamico
// ============================================================

export const VERSIONE_SCORE = "flowra-1.0";

export type ComponenteScore = {
  id: string;
  etichetta: string;
  peso: number;
  /** null = non calcolabile con i dati disponibili: viene ESCLUSO,
   *  e il suo peso si redistribuisce invece di penalizzare l'utente. */
  punti: number | null;
  spiegazione: string;
};

export type RisultatoScore = {
  punteggio: number | null;
  fascia: string | null;
  versione: string;
  componenti: ComponenteScore[];
  provvisorio: boolean;
};

/** Interpolazione lineare tra soglie: evita salti bruschi da un mese all'altro. */
function interpola(valore: number, punti: [number, number][]): number {
  const ord = [...punti].sort((a, b) => a[0] - b[0]);
  const primo = ord[0];
  const ultimo = ord[ord.length - 1];
  if (!primo || !ultimo) return 0;
  if (valore <= primo[0]) return primo[1];
  if (valore >= ultimo[0]) return ultimo[1];
  for (let i = 0; i < ord.length - 1; i++) {
    const [x1, y1] = ord[i]!;
    const [x2, y2] = ord[i + 1]!;
    if (valore >= x1 && valore <= x2) {
      return y1 + ((valore - x1) / (x2 - x1)) * (y2 - y1);
    }
  }
  return 0;
}

/** Etichette mai giudicanti: niente "vulnerabile", "insufficiente", "scarso". */
export function fasciaScore(punteggio: number): string {
  if (punteggio < 40) return "In costruzione";
  if (punteggio < 60) return "In equilibrio";
  if (punteggio < 80) return "Solido";
  return "In forma";
}

export function calcolaHealthScore(input: {
  /** (entrate − uscite) / entrate, media mobile 3 mesi. null se non calcolabile. */
  tassoRisparmio: number | null;
  /** liquidità / spesa media mensile su 6 mesi */
  mesiFondoEmergenza: number | null;
  /** % di mesi osservati SENZA sforamento sugli essenziali */
  regolaritaBudget: number | null;
  /** rate mensili / entrate nette. null = nessun debito → componente esclusa */
  incidenzaDebito: number | null;
  /** (abitazione + fissi) / entrate */
  incidenzaCostiFissi: number | null;
  /** versato YTD / pianificato YTD. null = nessun obiettivo → esclusa */
  continuitaObiettivi: number | null;
  /** dati insufficienti: sotto ~30 giorni o ~20 transazioni categorizzate */
  datiSufficienti: boolean;
}): RisultatoScore {
  const componenti: ComponenteScore[] = [
    {
      id: "risparmio",
      etichetta: "Capacità di risparmio",
      peso: 25,
      punti:
        input.tassoRisparmio == null
          ? null
          : interpola(input.tassoRisparmio, [
              [-0.1, 0],
              [0, 10],
              [0.05, 30],
              [0.1, 50],
              [0.15, 70],
              [0.2, 100],
            ]),
      spiegazione: "Quanta parte delle tue entrate resta da parte ogni mese.",
    },
    {
      id: "fondo_emergenza",
      etichetta: "Fondo di emergenza",
      peso: 20,
      punti:
        input.mesiFondoEmergenza == null
          ? null
          : interpola(input.mesiFondoEmergenza, [
              [0, 0],
              [1, 30],
              [3, 60],
              [6, 100],
            ]),
      spiegazione: "Per quanti mesi la tua liquidità coprirebbe le spese abituali.",
    },
    {
      id: "regolarita_budget",
      etichetta: "Regolarità",
      peso: 15,
      punti:
        input.regolaritaBudget == null
          ? null
          : interpola(input.regolaritaBudget, [
              [0, 0],
              [100, 100],
            ]),
      spiegazione: "Con quanta costanza resti dentro i budget che hai impostato.",
    },
    {
      id: "debito",
      etichetta: "Sostenibilità delle rate",
      peso: 20,
      punti:
        input.incidenzaDebito == null
          ? null
          : interpola(input.incidenzaDebito, [
              [0, 100],
              [0.2, 90],
              [0.3, 60],
              [0.35, 30],
              [0.5, 0],
            ]),
      spiegazione: "Quanta parte delle entrate è già impegnata in rate.",
    },
    {
      id: "costi_fissi",
      etichetta: "Peso dei costi fissi",
      peso: 10,
      punti:
        input.incidenzaCostiFissi == null
          ? null
          : interpola(input.incidenzaCostiFissi, [
              [0, 100],
              [0.3, 100],
              [0.4, 50],
              [0.6, 0],
            ]),
      spiegazione: "Quanto del tuo reddito va in spese che non puoi ridurre nel breve.",
    },
    {
      id: "obiettivi",
      etichetta: "Continuità sugli obiettivi",
      peso: 10,
      punti:
        input.continuitaObiettivi == null
          ? null
          : interpola(input.continuitaObiettivi, [
              [0, 0],
              [1, 100],
            ]),
      spiegazione: "Quanto stai rispettando i versamenti che ti eri dato.",
    },
  ];

  if (!input.datiSufficienti) {
    return {
      punteggio: null,
      fascia: null,
      versione: VERSIONE_SCORE,
      componenti,
      provvisorio: true,
    };
  }

  const calcolabili = componenti.filter((c) => c.punti != null);
  const pesoTotale = calcolabili.reduce((s, c) => s + c.peso, 0);
  if (pesoTotale === 0) {
    return {
      punteggio: null,
      fascia: null,
      versione: VERSIONE_SCORE,
      componenti,
      provvisorio: true,
    };
  }

  // Denominatore dinamico: le componenti non applicabili non penalizzano.
  const punteggio = Math.round(
    calcolabili.reduce((s, c) => s + (c.punti as number) * c.peso, 0) / pesoTotale,
  );

  return {
    punteggio,
    fascia: fasciaScore(punteggio),
    versione: VERSIONE_SCORE,
    componenti,
    provvisorio: false,
  };
}

// ============================================================
// 7. NORMALIZZAZIONE DEL BENEFICIARIO
// ============================================================

/**
 * "PAGAMENTO POS 12/03 NETFLIX.COM 866-579 AMSTERDAM NL" -> "NETFLIX"
 *
 * Conserva SEMPRE la descrizione originale accanto a questa: è ciò che
 * ha scritto la banca, e serve per la riconciliazione e per correggere
 * la pipeline senza perdere l'informazione di partenza.
 */
export function normalizzaBeneficiario(descrizione: string): string {
  return descrizione
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accenti
    .replace(/\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/g, " ") // date
    .replace(
      /\b(PAGAMENTO|POS|CARTA|ADDEBITO|BONIFICO|SEPA|PREAUTORIZZATO|ACQUISTO|OPERAZIONE|DISPOSIZIONE)\b/g,
      " ",
    )
    .replace(/\b[A-Z0-9]{8,}\b/g, " ") // ID autorizzazione e codici
    .replace(/\b\d{3}-?\d{3,}\b/g, " ") // numeri di telefono nei merchant
    .replace(/\b[A-Z]{2}\b$/g, " ") // sigla paese finale
    .replace(/[^A-Z0-9&.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
