# Specifica Tecnica e Funzionale del Progetto: PlanIn / Group Event Planner

## 1. Visione Generale del Progetto
L'applicazione è una **Progressive Web App (PWA)** pensata per semplificare la pianificazione logistica e decisionale delle uscite di gruppo (es. gruppi WhatsApp/amici).

Risolve due problemi principali:
1. **Decisione del luogo:** Attraverso sondaggi strutturati e legati a luoghi/opzioni specifiche.
2. **Coordinamento logistico:** Attraverso una mappa dell'evento che mostra contemporaneamente il **Pin del luogo dell'evento** e i **Pin della posizione di partenza di ciascun partecipante confermato**, facilitando il carpooling e la valutazione delle distanze.

Il progetto è pensato per essere sviluppato e ospitato a **costo zero (100% Free Stack)**.

---

## 2. Requisiti Funzionali

### 2.1 Gestione Utenti & Profilo
* **Registrazione & Profilo:**
  * Campi obbligatori: Nome, Cognome, Username, Foto profilo (o avatar), Password, Indirizzo di casa predefinito.
* **Geocoding dell'indirizzo:**
  * L'indirizzo di casa viene convertito in coordinate geografiche (lat, lng) per il posizionamento sulla mappa tramite API Nominatim (OpenStreetMap).
* **Modifica Profilo:**
  * Ogni utente può accedere al proprio profilo per consultare e aggiornare i propri dati.
* **Foto profilo:**
  * Upload dell'immagine originale senza ottimizzazione server-side, salvata su bucket Supabase `avatars`.

### 2.2 Sondaggi di Gruppo
* **Creazione Sondaggio:**
  * Ogni utente del gruppo può creare un sondaggio indicando:
    * Titolo/Nome del sondaggio.
    * Data e ora di scadenza (`expires_at`).
    * Elenco di opzioni (ogni opzione include: Nome dell'opzione e Luogo/Indirizzo).
  * L'indirizzo di ogni opzione viene geocodificato automaticamente in coordinate (lat, lng).
* **Votazione & Commenti:**
  * Tutti gli utenti del gruppo possono votare **una o più opzioni** (checkbox, voto multiplo).
  * Visualizzazione in tempo reale delle percentuali e del numero di voti per ogni opzione.
  * Sezione commenti dedicata per ciascun sondaggio. **I commenti possono solo essere creati, non modificati o cancellati.**
* **Posizione di Partenza al Voto:**
  * Al momento del voto, il sistema chiede all'utente se la posizione di partenza per quell'eventuale uscita sia l'indirizzo di casa predefinito o una posizione temporanea diversa.
  * L'utente può scegliere tra: **GPS del browser** (geolocalizzazione) o **inserimento manuale dell'indirizzo**.
  * Se l'utente specifica un punto di partenza diverso, questo viene salvato **esclusivamente per quell'evento/sondaggio**, senza sovrascrivere l'indirizzo nel profilo principale.
* **Scadenza Sondaggio:**
  * Il sondaggio diventa `expired` (nascosto dalla UI) esattamente **24 ore dopo** `expires_at`.
  * Esempio: evento alle 20:00 del 29/07 → sondaggio nascosto alle 20:00 del 30/07.
  * Il record **non viene cancellato** dal database, solo escluso dalle query attive con filtro: `WHERE expires_at + INTERVAL '24 hours' > NOW()`.
  * Alla scadenza non viene generato alcun evento automaticamente.

### 2.3 Gestione Eventi
* **Creazione Evento:**
  * L'evento viene creato **sempre manualmente** dalla pagina di creazione evento del gruppo.
  * **Se ci sono sondaggi attivi** nel gruppo, viene mostrato un selettore a tendina con le loro opzioni.
  * Selezionando un'opzione dal selettore, i campi dell'evento vengono **pre-compilati** con:
    * Nome dell'evento = titolo dell'opzione scelta.
    * Luogo e coordinate (lat, lng) = dall'opzione scelta.
    * Partecipanti iniziali = tutti gli utenti che hanno votato quell'opzione.
  * L'utente può ignorare il selettore e **compilare tutto manualmente**.
  * **Campi dell'Evento:** Nome, Luogo/Indirizzo, Coordinate, Data/ora evento, Partecipanti, Foto/Allegati.
  * La foto evento viene caricata senza ottimizzazione su bucket Supabase `event-images`.
* **Dettagli Evento & Mappa Interattiva:**
  * Chiunque nel gruppo può accedere ai dettagli di qualsiasi evento.
  * Visualizzazione di foto, descrizione, lista partecipanti.
  * **Mappa Integrata (Leaflet + OpenStreetMap):**
    * **Pin Destinazione:** Posizione dell'evento (blu).
    * **Pin Partecipanti:** Posizione di partenza di ogni utente confermato (verdi, con nome e avatar).
    * **Clustering:** I pin vicini tra loro vengono raggruppati con un contatore (MarkerCluster).
    * La mappa è visibile a tutti i membri del gruppo.

### 2.4 Gestione Gruppi
* **Creazione Gruppo:**
  * Qualsiasi utente registrato può creare un gruppo.
* **Invito:**
  * I membri si uniscono tramite **link d'invito / codice condivisibile**.
  * Alla creazione del gruppo viene generato un codice univoco.
* **Ruoli:**
  * `admin`: chi crea il gruppo (può gestire membri).
  * `member`: tutti gli altri.

---

## 3. Schema del Database (PostgreSQL / Supabase)

### 3.1 Tabella `profiles`
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Identificativo utente (auth.users) |
| `username` | TEXT (UNIQUE) | Nome utente unico |
| `first_name` | TEXT | Nome |
| `last_name` | TEXT | Cognome |
| `avatar_url` | TEXT | URL foto profilo |
| `home_address` | TEXT | Indirizzo di casa testuale |
| `home_lat` | DOUBLE PRECISION | Latitudine indirizzo di casa |
| `home_lng` | DOUBLE PRECISION | Longitudine indirizzo di casa |
| `created_at` | TIMESTAMPTZ | Data di registrazione |

### 3.2 Tabella `groups`
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Identificativo gruppo |
| `name` | TEXT | Nome del gruppo (es. "Amici Calzetto") |
| `created_by` | UUID (FK -> profiles.id) | Creatore del gruppo |
| `created_at` | TIMESTAMPTZ | Data creazione |

### 3.3 Tabella `group_members`
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `group_id` | UUID (FK -> groups.id) | ID Gruppo |
| `user_id` | UUID (FK -> profiles.id) | ID Utente |
| `role` | TEXT | Ruolo ('admin', 'member') |
| `joined_at` | TIMESTAMPTZ | Data di ingresso |

### 3.4 Tabella `group_invites`
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | UUID (PK) | ID Invito |
| `group_id` | UUID (FK -> groups.id) | ID Gruppo |
| `code` | TEXT (UNIQUE) | Codice univoco per il link d'invito |
| `created_by` | UUID (FK -> profiles.id) | Creatore dell'invito |
| `created_at` | TIMESTAMPTZ | Data creazione |
| `expires_at` | TIMESTAMPTZ | Data scadenza invito (NULL = mai) |

### 3.5 Tabella `polls` (Sondaggi)
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | UUID (PK) | ID Sondaggio |
| `group_id` | UUID (FK -> groups.id) | ID Gruppo di appartenenza |
| `title` | TEXT | Titolo del sondaggio |
| `expires_at` | TIMESTAMPTZ | Data e ora evento (24h dopo diventa expired) |
| `created_by` | UUID (FK -> profiles.id) | Creatore |
| `created_at` | TIMESTAMPTZ | Data creazione |

### 3.6 Tabella `poll_options` (Opzioni Sondaggio)
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | UUID (PK) | ID Opzione |
| `poll_id` | UUID (FK -> polls.id) | ID Sondaggio |
| `title` | TEXT | Nome opzione (es. "Pizzeria Da Mario") |
| `location_name` | TEXT | Indirizzo o nome del luogo |
| `location_lat` | DOUBLE PRECISION | Latitudine luogo opzione |
| `location_lng` | DOUBLE PRECISION | Longitudine luogo opzione |

### 3.7 Tabella `poll_votes` (Voti Sondaggio)
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | UUID (PK) | ID Voto |
| `poll_id` | UUID (FK -> polls.id) | ID Sondaggio |
| `option_id` | UUID (FK -> poll_options.id) | ID Opzione votata |
| `user_id` | UUID (FK -> profiles.id) | ID Utente che vota |
| `start_location_name` | TEXT | Indirizzo partenza specifico per questo evento |
| `start_lat` | DOUBLE PRECISION | Latitudine partenza per questo evento |
| `start_lng` | DOUBLE PRECISION | Longitudine partenza per questo evento |
| `created_at` | TIMESTAMPTZ | Data voto |

### 3.8 Tabella `poll_comments` (Commenti Sondaggio)
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | UUID (PK) | ID Commento |
| `poll_id` | UUID (FK -> polls.id) | ID Sondaggio |
| `user_id` | UUID (FK -> profiles.id) | Utente autore |
| `content` | TEXT | Testo del commento |
| `created_at` | TIMESTAMPTZ | Data pubblicazione |

### 3.9 Tabella `events` (Eventi)
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | UUID (PK) | ID Evento |
| `group_id` | UUID (FK -> groups.id) | ID Gruppo |
| `source_poll_id` | UUID (FK -> polls.id, NULLABLE) | ID Sondaggio da cui è stato generato |
| `title` | TEXT | Nome evento |
| `location_name` | TEXT | Indirizzo/Luogo dell'evento |
| `maps_link` | TEXT | Link Google Maps / OpenStreetMap |
| `location_lat` | DOUBLE PRECISION | Latitudine evento |
| `location_lng` | DOUBLE PRECISION | Longitudine evento |
| `image_url` | TEXT | URL foto/allegato dell'evento |
| `event_date` | TIMESTAMPTZ | Data e ora dell'evento |
| `created_by` | UUID (FK -> profiles.id) | Creatore |
| `created_at` | TIMESTAMPTZ | Data creazione |

### 3.10 Tabella `event_participants` (Partecipanti Evento)
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | UUID (PK) | ID Registro |
| `event_id` | UUID (FK -> events.id) | ID Evento |
| `user_id` | UUID (FK -> profiles.id) | ID Utente partecipante |
| `status` | TEXT | Stato ('confirmed', 'declined', 'maybe') |
| `start_lat` | DOUBLE PRECISION | Latitudine di partenza per l'evento |
| `start_lng` | DOUBLE PRECISION | Longitudine di partenza per l'evento |
| `updated_at` | TIMESTAMPTZ | Ultimo aggiornamento |

---

## 4. Architettura Tecnica & Stack Gratuito

```
+-------------------------------------------------------+
|                    FRONTEND (PWA)                     |
|  React + Vite + Tailwind CSS + Leaflet.js (OpenStreetMap)
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|                BACKEND & STORAGE (Free)               |
|  Supabase (PostgreSQL DB, Auth, Storage Bucket, RLS)  |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|                   HOSTING (Free)                      |
|  Vercel / Cloudflare Pages                            |
+-------------------------------------------------------+
```

* **Frontend:**
  * **Framework:** React con Vite per build ultra-veloci e configurazione PWA (`vite-plugin-pwa`).
  * **Styling:** Tailwind CSS per UI reattiva, moderna e mobile-first.
  * **Componenti UI custom:** Ogni bottone è un componente indipendente con stile cyber-punk (vedi §4.1).
  * **Mappe:** `Leaflet.js` con `react-leaflet`, tile OpenStreetMap e `leaflet.markercluster` per il clustering dei pin.
  * **Icons:** `lucide-react`.
* **Backend & Database:**
  * **Supabase Free Tier:**
    * **Authentication:** Gestione login, password, JWT.
    * **Database PostgreSQL:** Tabelle relazionali con Row Level Security (RLS).
    * **Realtime:** Sottoscrizione ai cambiamenti dei voti per aggiornamento live delle percentuali.
    * **Storage Bucket:** `avatars` e `event-images` (pubblici in lettura, autenticati in scrittura).
    * **Geocoding API:** OpenStreetMap Nominatim API per il parsing gratuito degli indirizzi in coordinate (max 1 req/s).
* **Hosting & Deployment:**
  * **Vercel** o **Cloudflare Pages** con deployment automatico da repository GitHub.

---

## 5. Componenti UI

### 5.1 Button (`src/components/ui/Button.jsx` + `Button.css`)

Componente pulsante cyber-punk, riutilizzabile in tutta l'app.

**Props:**

| Prop | Tipo | Obbligatorio | Descrizione |
| :--- | :--- | :--- | :--- |
| `text` | `string` | No | Testo del pulsante |
| `img` | `string` (URL) | No | URL immagine icona |
| `bgcolor` | `string` | **Sì** | Colore di sfondo del layer interno |
| `height` | `string` | **Sì** | Altezza (es. `"40px"`, `"3rem"`) |
| `width` | `string` | **Sì** | Larghezza (es. `"120px"`, `"10rem"`) |

**Comportamento:**
- `text` + `img` entrambi assenti → rettangolo vuoto (solo bgcolor + dimensioni)
- Solo `text` → mostra il testo
- Solo `img` → mostra l'icona
- Entrambi → icona + testo affiancati (`gap: 8px`)
- Click → `transform: scale(0.95)`

**Struttura CSS:**
```
.cyber-btn               ← contenitore con dimensioni (--width, --height)
  .btn-content           ← layer interno con bgcolor (--bgcolor), testo/icona
  ::before               ← bordi orizzontali neri con interruzione centrale
  ::after                ← bordi verticali neri con interruzione centrale
```

**Posizionamento:**
```
src/components/ui/
├── Button.jsx
└── Button.css
```

---

## 6. Credenziali / Secrets

> ⚠️ Conservare al sicuro. Mai committare `SECRET_KEY` nel frontend.

| Chiave | Valore |
| :--- | :--- |
| DB Password | `***` (non committare) |
| SUPABASE_URL | `https://hzppcmlyblyvxtfunmjg.supabase.co` |
| SUPABASE_ANON_KEY | `***` (vedi .env locale) |
| SUPABASE_SECRET_KEY (service_role) | `***` (vedi dashboard Supabase) |
| JWKS_URL | `https://hzppcmlyblyvxtfunmjg.supabase.co/auth/v1/.well-known/jwks.json` |

---

## 7. Prossimi Passi per lo Sviluppo

### Fase 1 — Inizializzazione Progetto
- Inizializzare repository Git e progetto Vite + React. **[OK]**
- Installare dipendenze (Tailwind, react-router-dom, Supabase, Leaflet, lucide-react, vite-plugin-pwa). **[Parziale: React+Vite installato]**
- Creare componente base `Button` (src/components/ui/Button.jsx + Button.css). **[OK]**
- Configurare PWA (manifest, service worker base).
- Strutturare le cartelle del progetto.

### Fase 2 — Supabase (DB, Auth, Storage)
- Creare progetto Supabase.
- Eseguire migration SQL con tutte le tabelle (incluse `group_invites`).
- Abilitare Auth (email/password) e Storage buckets.
- Configurare RLS policies per ogni tabella.

### Fase 3 — Auth & Profilo
- Pagine Login e Registrazione.
- Creazione profilo utente con geocoding indirizzo.
- Modifica profilo e upload avatar.

### Fase 4 — Gestione Gruppi
- Dashboard con lista gruppi dell'utente.
- Creazione gruppo e generazione codice invito.
- Pagina gruppo (tab Sondaggi, Eventi, Membri).
- Unirsi a gruppo via link/codice.

### Fase 5 — Sondaggi
- Creazione sondaggio con opzioni e geocoding.
- Dettaglio sondaggio: voto multiplo (checkbox), posizione partenza (GPS o manuale), percentuali in tempo reale.
- Sezione commenti (solo creazione).

### Fase 6 — Eventi & Mappa
- Creazione evento: selettore con opzioni da sondaggi attivi (precompilazione) oppure inserimento manuale.
- Dettaglio evento: foto, lista partecipanti, pulsante partecipazione con posizione partenza.
- Mappa Leaflet con clustering (pin destinazione blu, pin partecipanti verdi con avatar/nome).

### Fase 7 — PWA & Rifiniture
- Completamento configurazione PWA.
- Test responsive mobile-first.
- Gestione loading, errori, toast notifiche.
