/**
 * Flowra — Import CSV da estratti conto italiani.
 *
 * Progettato per il caos, non per lo standard: le banche italiane non
 * seguono un formato comune. Questo parser gestisce:
 *   - separatore ";" (quasi sempre, non ",")
 *   - encoding Windows-1252 oltre a UTF-8
 *   - numeri "1.234,56" (punto migliaia, virgola decimali)
 *   - date "gg/mm/aaaa"
 *   - DUE schemi: colonna unica con segno, oppure due colonne Dare/Avere
 *
 * Principio: nessun import parziale silenzioso. Si valida tutto, si
 * mostra un'anteprima con gli errori, e solo dopo si scrive.
 *
 * Funzioni pure: nessuna chiamata al database qui dentro.
 */

// ============================================================
// TIPI
// ============================================================

/** Mappatura salvabile e riutilizzabile: al secondo import non si rifà nulla. */
export type ProfiloBanca = {
  nome: string;
  separatore: ";" | "," | "\t";
  encoding: "utf-8" | "windows-1252";
  /** Righe da saltare prima dell'intestazione (molte banche mettono un preambolo). */
  righeDaSaltare: number;
  /** Indice colonna (0-based) o nome dell'intestazione. */
  colonne: {
    data: string | number;
    descrizione: string | number;
    /** Schema A: una sola colonna con il segno. */
    importo?: string | number;
    /** Schema B: due colonne separate. */
    dare?: string | number; // uscite
    avere?: string | number; // entrate
  };
  formatoData: "gg/mm/aaaa" | "aaaa-mm-gg" | "gg-mm-aaaa";
};

export type RigaImportata = {
  numeroRiga: number;
  data: string; // ISO, data pura
  descrizione: string; // originale, mai modificata
  importo: number; // negativo = uscita
  fingerprint: string;
};

export type ErroreRiga = {
  numeroRiga: number;
  contenuto: string;
  motivo: string;
};

export type RisultatoParsing = {
  righe: RigaImportata[];
  errori: ErroreRiga[];
  intestazioni: string[];
  /** true se nessuna riga è valida: non procedere all'import. */
  fallito: boolean;
};

/** Versione della logica di hash. Se cambia la normalizzazione, i
 *  vecchi fingerprint non corrispondono più: va salvata accanto all'hash. */
export const VERSIONE_FINGERPRINT = 2;

// ============================================================
// DECODIFICA
// ============================================================

/**
 * Legge il file provando l'encoding indicato. Se non specificato,
 * rileva Windows-1252 dalla presenza di byte non validi in UTF-8
 * (tipico degli estratti italiani con accenti).
 */
export async function leggiFile(
  file: File,
  encoding?: "utf-8" | "windows-1252",
): Promise<{ testo: string; encodingUsato: "utf-8" | "windows-1252" }> {
  const buffer = await file.arrayBuffer();

  if (encoding) {
    return { testo: new TextDecoder(encoding).decode(buffer), encodingUsato: encoding };
  }

  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  // U+FFFD = carattere di sostituzione: segnala byte non decodificabili in UTF-8
  if (utf8.includes("\uFFFD")) {
    return {
      testo: new TextDecoder("windows-1252").decode(buffer),
      encodingUsato: "windows-1252",
    };
  }
  return { testo: utf8, encodingUsato: "utf-8" };
}

// ============================================================
// RILEVAMENTO AUTOMATICO
// ============================================================

export function rilevaSeparatore(testo: string): ";" | "," | "\t" {
  const righe = testo
    .split(/\r?\n/)
    .filter((r) => r.trim())
    .slice(0, 10);
  const conteggi: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  for (const r of righe) {
    for (const sep of Object.keys(conteggi)) {
      conteggi[sep] = (conteggi[sep] ?? 0) + (r.split(sep).length - 1);
    }
  }
  const vincente = Object.entries(conteggi).sort((a, b) => b[1] - a[1])[0];
  return (vincente && vincente[1] > 0 ? vincente[0] : ";") as ";" | "," | "\t";
}

/** Trova la riga di intestazione saltando l'eventuale preambolo della banca. */
export function trovaIntestazione(
  testo: string,
  separatore: string,
): { indice: number; intestazioni: string[] } {
  const righe = testo.split(/\r?\n/);
  const parole = /data|descrizione|importo|causale|dare|avere|entrate|uscite|valuta|operazione/i;

  for (let i = 0; i < Math.min(righe.length, 30); i++) {
    const campi = dividiRiga(righe[i] ?? "", separatore);
    if (campi.length >= 3 && campi.filter((c) => parole.test(c)).length >= 2) {
      return { indice: i, intestazioni: campi.map((c) => c.trim()) };
    }
  }
  return { indice: 0, intestazioni: dividiRiga(righe[0] ?? "", separatore).map((c) => c.trim()) };
}

/** Divide rispettando le virgolette (una descrizione può contenere il separatore). */
function dividiRiga(riga: string, separatore: string): string[] {
  const campi: string[] = [];
  let corrente = "";
  let dentroVirgolette = false;

  for (let i = 0; i < riga.length; i++) {
    const c = riga[i];
    if (c === '"') {
      if (dentroVirgolette && riga[i + 1] === '"') {
        corrente += '"';
        i++;
      } else {
        dentroVirgolette = !dentroVirgolette;
      }
    } else if (c === separatore && !dentroVirgolette) {
      campi.push(corrente);
      corrente = "";
    } else {
      corrente += c;
    }
  }
  campi.push(corrente);
  return campi;
}

// ============================================================
// CONVERSIONI ITALIANE
// ============================================================

/**
 * "1.234,56" -> 1234.56 · "-45,90" -> -45.9 · "1,234.56" -> 1234.56
 *
 * Distingue i due formati guardando quale separatore appare per ultimo:
 * quello è il decimale. Gestisce anche il segno posposto ("45,90-")
 * e gli importi tra parentesi, usati da alcune banche per le uscite.
 */
export function importoItaliano(raw: string): number | null {
  let s = raw.trim().replace(/[€\s\u00a0]/g, "");
  if (!s) return null;

  let negativo = false;

  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    negativo = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-")) {
    negativo = true;
    s = s.slice(1);
  }
  if (s.startsWith("+")) s = s.slice(1);

  const ultimaVirgola = s.lastIndexOf(",");
  const ultimoPunto = s.lastIndexOf(".");

  if (ultimaVirgola > ultimoPunto) {
    // formato italiano: il punto è separatore di migliaia
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (ultimoPunto > ultimaVirgola) {
    s = s.replace(/,/g, "");
  } else {
    s = s.replace(/[.,]/g, "");
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/** Converte in data ISO pura. Nessun orario, nessun fuso: una
 *  transazione ha una data valuta, non un istante. */
export function dataIso(raw: string, formato: ProfiloBanca["formatoData"]): string | null {
  const s = raw.trim();
  if (!s) return null;

  const numeri = s.match(/(\d{1,4})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (!numeri) return null;

  let giorno: number, mese: number, anno: number;

  // I tre gruppi esistono per costruzione della regex, ma con
  // noUncheckedIndexedAccess vanno comunque estratti con un default.
  const [, g1 = "", g2 = "", g3 = ""] = numeri;

  if (formato === "aaaa-mm-gg") {
    [anno, mese, giorno] = [+g1, +g2, +g3];
  } else {
    [giorno, mese, anno] = [+g1, +g2, +g3];
  }

  if (anno < 100) anno += anno < 70 ? 2000 : 1900;
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;

  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  // verifica che la data esista davvero (31 febbraio -> scartata)
  if (d.getUTCMonth() !== mese - 1 || d.getUTCDate() !== giorno) return null;

  return d.toISOString().slice(0, 10);
}

// ============================================================
// FINGERPRINT PER LA DEDUPLICA
// ============================================================

/**
 * CSV e QIF non hanno un ID transazione stabile (a differenza di
 * OFX/CAMT.053 con il FITID), quindi la deduplica passa da un hash.
 *
 * IMPORTANTE: questo è il livello "debole". Il livello fuzzy (stesso
 * importo, data ±1-2 giorni, descrizione simile) va SEGNALATO
 * all'utente, non cancellato: comprare due caffè identici nello stesso
 * giorno è un caso reale.
 */
export async function calcolaFingerprint(
  contoId: string,
  data: string,
  importo: number,
  descrizione: string,
): Promise<string> {
  const centesimi = Math.round(importo * 100);
  const descNorm = descrizione.toUpperCase().replace(/\s+/g, " ").trim();
  const base = `${contoId}|${data}|${centesimi}|${descNorm}|v${VERSIONE_FINGERPRINT}`;

  const bytes = new TextEncoder().encode(base);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================
// PARSING
// ============================================================

function valoreColonna(
  campi: string[],
  intestazioni: string[],
  rif: string | number | undefined,
): string {
  if (rif == null) return "";
  if (typeof rif === "number") return campi[rif] ?? "";
  const i = intestazioni.findIndex((h) => h.toLowerCase().trim() === rif.toLowerCase().trim());
  return i >= 0 ? (campi[i] ?? "") : "";
}

export async function analizzaCsv(
  testo: string,
  profilo: ProfiloBanca,
  contoId: string,
): Promise<RisultatoParsing> {
  const tutteLeRighe = testo.split(/\r?\n/);
  const { indice, intestazioni } = trovaIntestazione(testo, profilo.separatore);
  const inizio = Math.max(indice + 1, profilo.righeDaSaltare);

  const righe: RigaImportata[] = [];
  const errori: ErroreRiga[] = [];

  for (let i = inizio; i < tutteLeRighe.length; i++) {
    const grezza = tutteLeRighe[i] ?? "";
    if (!grezza.trim()) continue;

    const numeroRiga = i + 1;
    const campi = dividiRiga(grezza, profilo.separatore);

    const data = dataIso(
      valoreColonna(campi, intestazioni, profilo.colonne.data),
      profilo.formatoData,
    );
    if (!data) {
      errori.push({ numeroRiga, contenuto: grezza.slice(0, 120), motivo: "Data non leggibile" });
      continue;
    }

    let importo: number | null = null;

    if (profilo.colonne.importo != null) {
      // Schema A: colonna unica con segno
      importo = importoItaliano(valoreColonna(campi, intestazioni, profilo.colonne.importo));
    } else {
      // Schema B: Dare/Avere su due colonne
      const dare = importoItaliano(valoreColonna(campi, intestazioni, profilo.colonne.dare));
      const avere = importoItaliano(valoreColonna(campi, intestazioni, profilo.colonne.avere));
      if (dare != null && dare !== 0) importo = -Math.abs(dare);
      else if (avere != null && avere !== 0) importo = Math.abs(avere);
    }

    if (importo == null || importo === 0) {
      errori.push({
        numeroRiga,
        contenuto: grezza.slice(0, 120),
        motivo: "Importo non leggibile o nullo",
      });
      continue;
    }

    const descrizione = valoreColonna(campi, intestazioni, profilo.colonne.descrizione).trim();

    righe.push({
      numeroRiga,
      data,
      descrizione,
      importo,
      fingerprint: await calcolaFingerprint(contoId, data, importo, descrizione),
    });
  }

  return { righe, errori, intestazioni, fallito: righe.length === 0 };
}

// ============================================================
// DUPLICATI SOSPETTI — si segnalano, non si cancellano
// ============================================================

export type Sospetto = {
  riga: RigaImportata;
  motivo: string;
};

/**
 * Livello fuzzy: stesso importo, data entro ±2 giorni, descrizione
 * simile. Serve a MOSTRARE all'utente cosa potrebbe essere un
 * doppione, lasciandogli la decisione.
 */
export function trovaSospetti(
  nuove: RigaImportata[],
  esistenti: { date: string; amount: number | string; description?: string | null }[],
): Sospetto[] {
  const sospetti: Sospetto[] = [];

  for (const riga of nuove) {
    const simile = esistenti.find((e) => {
      const importoUguale = Math.abs(Number(e.amount) - riga.importo) < 0.01;
      if (!importoUguale) return false;
      const giorni =
        Math.abs(
          new Date(`${e.date}T00:00:00Z`).getTime() - new Date(`${riga.data}T00:00:00Z`).getTime(),
        ) / 86_400_000;
      return giorni <= 2;
    });

    if (simile) {
      sospetti.push({
        riga,
        motivo: `Esiste già un movimento da ${riga.importo.toFixed(2).replace(".", ",")} € intorno al ${riga.data}`,
      });
    }
  }

  return sospetti;
}

// ============================================================
// PROFILI PREDEFINITI
// ============================================================

/**
 * Punto di partenza, NON una promessa: i formati cambiano nel tempo e
 * variano tra i tracciati della stessa banca. Il parser rileva
 * separatore, encoding e intestazione da solo, e l'utente conferma la
 * mappatura nell'anteprima — il profilo salvato serve a non rifarla
 * al secondo import.
 */
export const PROFILO_GENERICO: ProfiloBanca = {
  nome: "Rilevamento automatico",
  separatore: ";",
  encoding: "utf-8",
  righeDaSaltare: 0,
  colonne: { data: "Data", descrizione: "Descrizione", importo: "Importo" },
  formatoData: "gg/mm/aaaa",
};

export const PROFILO_DARE_AVERE: ProfiloBanca = {
  nome: "Due colonne (Entrate / Uscite)",
  separatore: ";",
  encoding: "windows-1252",
  righeDaSaltare: 0,
  colonne: { data: "Data", descrizione: "Descrizione", dare: "Uscite", avere: "Entrate" },
  formatoData: "gg/mm/aaaa",
};
