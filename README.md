# Flowra: Your Personal Finance Clarity

Crea "Flowra", un'app di gestione finanziaria personale in italiano (uso singolo utente). Interfaccia interamente in italiano, formato valuta EUR (es. €1.234,56), date in formato italiano (gg/mm/aaaa).

QUESTO PRIMO STEP: solo database, autenticazione, CRUD manuale e dashboard base. NON implementare Open Banking, NON implementare assistente AI conversazionale, NON implementare import CSV. Verranno dopo.

## 1. DATABASE (Supabase Postgres) — con Row Level Security su TUTTE le tabelle fin da subito

Ogni tabella ha RLS attiva con policy che consente accesso solo alle righe del proprio user_id (auth.uid()).

**profiles**: id uuid PK, auth_user_id uuid FK->auth.users unique, email text, full_name text, locale text default 'it-IT', created_at timestamptz default now()

**settings**: id uuid PK, user_id FK->profiles unique, currency_default text default 'EUR', locale text default 'it-IT', notification_preferences jsonb default '{}', theme enum(light,dark,system) default 'system'

**accounts**: id uuid PK, user_id FK->profiles, name text not null, type enum(checking,savings,credit_card,debit_card,cash,investment,other), currency text default 'EUR', initial_balance numeric(12,2) default 0, current_balance numeric(12,2) default 0, iban_masked text nullable, sync_status enum(active,consent_expired,disconnected,manual) default 'manual', is_active boolean default true, created_at timestamptz

IMPORTANTE: current_balance è una colonna cache, NON la fonte di verità. Deve essere ricalcolata da un trigger su insert/update/delete di transactions come: initial_balance + somma di tutti gli amount delle transazioni di quel conto con status='booked'.

**categories**: id uuid PK, user_id FK->profiles, name text not null, parent_category_id FK->categories nullable (self-reference), icon text nullable, sort_order integer default 0, essential_level enum(necessario,importante,discrezionale) default 'importante', is_default boolean default false

**transactions**: id uuid PK, account_id FK->accounts not null, category_id FK->categories nullable, amount numeric(12,2) not null (NEGATIVO = spesa, POSITIVO = entrata), currency text default 'EUR', date date not null, description text, payment_method enum(card,bank_transfer,cash,direct_debit,other), is_recurring boolean default false, recurring_expense_id FK->recurring_expenses nullable, external_transaction_id text nullable, source enum(manual,open_banking,csv_import) default 'manual', status enum(pending,booked) default 'booked', notes text nullable, created_at timestamptz
VINCOLO: unique(account_id, external_transaction_id) quando external_transaction_id non è null.

**budgets**: id uuid PK, user_id FK->profiles, category_id FK->categories nullable (null = budget generale), amount numeric(12,2) not null, period enum(weekly,monthly), warning_threshold integer default 80, start_date date

**income**: id uuid PK, user_id FK->profiles, account_id FK->accounts nullable, source_type enum(salary,bonus,overtime,freelance,rental,reimbursement,other), amount numeric(12,2), date date, description text, is_recurring boolean default false

**recurring_expenses**: id uuid PK, user_id FK->profiles, name text, category_id FK->categories nullable, amount numeric(12,2), frequency enum(weekly,monthly,yearly), next_due_date date, account_id FK->accounts nullable, is_active boolean default true

**savings_goals**: id uuid PK, user_id FK->profiles, name text, target_amount numeric(12,2), current_amount numeric(12,2) default 0, target_date date nullable, monthly_contribution numeric(12,2) nullable

**financial_snapshots**: id uuid PK, user_id FK->profiles, snapshot_date date not null, total_income numeric(12,2), total_expenses numeric(12,2), net_savings numeric(12,2), savings_rate numeric(5,2), financial_health_score integer nullable. VINCOLO unique(user_id, snapshot_date)

**notifications**: id uuid PK, user_id FK->profiles, type enum(budget_exceeded,budget_warning,recurring_due,anomaly,goal_progress,sync_failed,consent_expiring), message text, is_read boolean default false, created_at timestamptz

**ai_insights**: id uuid PK, user_id FK->profiles, type enum(saving_opportunity,anomaly,recommendation,health_score_explanation), content text, related_entity_type text nullable, related_entity_id uuid nullable, generated_at timestamptz, is_dismissed boolean default false. Append-only: nuova riga ad ogni generazione, mai overwrite.

## 2. AUTENTICAZIONE
Supabase Auth con email+password. Al primo login, crea automaticamente: riga profiles, riga settings, e queste categorie di default (is_default=true):
- necessario: Casa, Affitto, Bollette, Assicurazioni, Salute
- importante: Alimentari, Trasporti, Auto, Abbonamenti
- discrezionale: Ristoranti, Shopping, Intrattenimento, Viaggi
- altro: Investimenti, Risparmio, Altro

## 3. SCHERMATE

**Dashboard (home)** — caricamento progressivo, prima i numeri poi il resto:
- Riepilogo mese corrente in numeri grandi: Entrate, Spese, Risparmio netto (entrate−spese), Saldo totale conti, Tasso di risparmio (risparmio/entrate×100)
- Confronto col mese precedente, in linguaggio naturale italiano generato da REGOLE (non da AI): es. "Questo mese hai speso €115 in più rispetto al mese scorso. L'aumento principale viene da Ristoranti e Trasporti."
- Stato budget: barre di avanzamento per categoria. Verde = sotto soglia, ambra = oltre warning_threshold, rosso = oltre il 100%. Questo codice colore deve essere identico in tutta l'app.
- Obiettivi di risparmio con percentuale completata
- Se ci sono meno di 30 giorni di dati, mostra un avviso esplicito che i confronti non sono ancora significativi, invece di mostrare percentuali fuorvianti.

**Transazioni**: lista filtrabile per periodo/categoria/conto, con form di inserimento rapido. Su mobile il pulsante "Aggiungi spesa" deve essere raggiungibile a un tap dalla home.

**Conti**: CRUD conti, saldo per conto e totale complessivo. Conti in valuta diversa da EUR vanno mostrati separatamente ed esclusi dal totale aggregato.

**Categorie**: CRUD con riordino e modifica di essential_level.

**Budget**: CRUD budget con soglia di avviso configurabile.

**Entrate**: CRUD entrate con tipo di fonte.

**Obiettivi**: CRUD obiettivi con progresso.

**Impostazioni**: preferenze, più due funzioni importanti: "Esporta tutti i miei dati" (scarica JSON completo) e "Elimina il mio account" (con conferma e cancellazione a cascata).

## 4. STILE
Moderna, minimalista, leggibile. Priorità alla chiarezza dei numeri, non alla decorazione. Nessun termine tecnico visibile all'utente (mai "RLS", "PSD2", "ASPSP"). Responsive, funzionante bene su mobile come PWA installabile. Tono mai giudicante nei messaggi: descrivi i fatti, non valutare le scelte dell'utente.

## 5. REGOLE TECNICHE
- Nessuna API key o segreto nel frontend.
- I calcoli finanziari devono avere un'unica fonte di verità: mai duplicare la logica di calcolo del risparmio o del saldo in più punti.
- Le date "future" sono ammesse nelle transazioni ma escluse dai totali del mese corrente.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/514c8ca1-c6b6-41b8-9ba6-ce40c94dbd48).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
