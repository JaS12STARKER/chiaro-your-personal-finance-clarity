/*
 * Service worker di Flowra.
 *
 * Serve a due cose: rendere l'app installabile (Chrome mostra "Installa"
 * solo se esiste un service worker con un gestore fetch) e far sopravvivere
 * lo scheletro dell'interfaccia a una connessione assente.
 *
 * REGOLA NON NEGOZIABILE PER UN'APP FINANZIARIA: qui dentro non finisce
 * MAI un dato dell'utente. Si mette in cache solo ciò che è statico e
 * pubblico — JS, CSS, icone. Tutto ciò che va verso Supabase passa dalla
 * rete e basta: un saldo servito da una cache vecchia sarebbe peggio di un
 * errore di rete, perché sembrerebbe vero.
 */

const CACHE = "flowra-statici-v1";

// Estensioni considerate statiche e quindi memorizzabili.
const STATICI = /\.(?:js|mjs|css|woff2?|ttf|otf|png|jpe?g|svg|webp|avif|ico)$/i;

self.addEventListener("install", (event) => {
  // Attiva subito la nuova versione invece di aspettare la chiusura delle schede.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomi = await caches.keys();
      await Promise.all(nomi.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Solo GET: mai intercettare scritture.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Altra origine (Supabase, API esterne): lascia passare senza toccare nulla.
  if (url.origin !== self.location.origin) return;

  // Richieste autenticate o con credenziali: fuori dalla cache.
  if (req.headers.has("authorization") || req.credentials === "include") return;

  // Navigazione fra pagine: prima la rete, la cache solo se la rete manca.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cached = await caches.match(req);
          return cached ?? (await caches.match("/")) ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Asset statici: prima la cache, con aggiornamento in sottofondo.
  if (STATICI.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req);
        const dallaRete = fetch(req)
          .then((res) => {
            if (res && res.status === 200 && res.type === "basic") cache.put(req, res.clone());
            return res;
          })
          .catch(() => undefined);
        return cached ?? (await dallaRete) ?? Response.error();
      })(),
    );
  }

  // Tutto il resto: comportamento normale del browser.
});
