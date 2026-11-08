# Leapmotor Mate Card

[🇬🇧 English](README.md) · [🇮🇹 Italiano](README.it.md)

Una scheda Lovelace per Home Assistant che mostra la tua Leapmotor in modo
compatto: autonomia, batteria e stato delle serrature in alto, una riga di
pulsanti di azione e una griglia di gruppi — batteria e ricarica, stato, clima,
pneumatici, percorso e posizione — ognuno dei quali si apre al posto della
griglia.

È fatta per **[Leapmotor Mate](https://github.com/ProtossBlaster/leapmotor-mate)**
(il ponte MQTT → Home Assistant) e funziona con la **Leapmotor B10**.

È un fork di [fapgomes/ha-leapmotor-card](https://github.com/fapgomes/ha-leapmotor-card),
scritta per l'integrazione `kerniger/leapmotor-ha`. Il livello delle entità, le
azioni e il pannello del clima sono stati riscritti per Mate; l'aspetto
— impostazione, gruppi, disegni — è opera dell'autore originale. Licenza:
GPL-3.0, come l'originale.

## Requisiti

- **Leapmotor Mate**, collegato al tuo account Leapmotor, con
  **MQTT → Home Assistant** attivato.
- L'integrazione **MQTT** in Home Assistant, sullo stesso broker.
- Home Assistant 2025.1 o successivo.

Mate pubblica le entità in inglese qualunque sia la lingua di Mate o di Home
Assistant (`sensor.leapmotor_mate_5r1234_battery`, …), quindi la scheda
funziona in qualsiasi lingua.

## Installazione — HACS

1. HACS → ⋮ → **Repository personalizzati**.
2. Aggiungi `https://github.com/hubcasale/leapmotor-mate-card`, tipo **Dashboard**.
3. Cerca **Leapmotor Mate Card**, scaricala e ricarica la pagina.

HACS installa il file da una release con tag: installa una versione
(`v0.5.0` o successiva), non un commit qualsiasi.

### Manualmente

1. Scarica `leapmotor-mate-card.js` dalle
   [release](https://github.com/hubcasale/leapmotor-mate-card/releases).
2. Copialo in `config/www/leapmotor-mate-card/leapmotor-mate-card.js`.
3. **Impostazioni → Dashboard → ⋮ → Risorse → Aggiungi risorsa**:
   `/local/leapmotor-mate-card/leapmotor-mate-card.js`, tipo **Modulo JavaScript**.

Il tipo della scheda è `custom:leapmotor-mate-card`, diverso da quello
dell'originale: le due schede possono convivere.

## Configurazione

```yaml
type: custom:leapmotor-mate-card
```

Basta questo: la scheda trova l'auto da sola. Un esempio più completo:

```yaml
type: custom:leapmotor-mate-card
name: La mia B10
language: it
actions: [unlock, lock, trunk, windows, findVehicle, sunshade]
confirm_actions: [unlock]
grid: [charging, status, climate, tires, trip, location]
tire_range: [2.0, 2.6]
```

| Opzione | Predefinito | Descrizione |
| --- | --- | --- |
| `device` | *(automatico)* | L'id dell'auto — gli ultimi sei caratteri del VIN, come in `leapmotor_mate_5r1234_…` — oppure il prefisso intero, o una qualsiasi entità dell'auto. Serve solo con più di un'auto Leapmotor. |
| `name` | il nome del dispositivo | Nome mostrato nell'intestazione. |
| `language` | quella di Home Assistant | `en`, `it` o `pt`. |
| `image` | `auto` | `auto` mostra la sagoma disegnata (o un'entità immagine, se ne indichi una), `entity` solo un'immagine, `none` niente, oppure l'indirizzo della tua foto. |
| `actions` | `[unlock, lock, trunk, windows, findVehicle, sunshade]` | I pulsanti della riga di azioni — vedi sotto. |
| `confirm_actions` | `[unlock]` | Azioni che chiedono conferma prima. |
| `grid` | tutti i gruppi | Quali gruppi mostra la griglia e in che ordine. Una voce è il nome di un gruppo oppure `{group, icon, title, summary}`. |
| `tire_range` | `[2.0, 2.6]` | Pressione normale dei pneumatici, in bar; fuori da questo intervallo un pneumatico è segnalato. |
| `map_zoom` | `15` | Zoom della mappa della posizione. |
| `range_tap_action` | `more-info` | Cosa fa un tocco sull'autonomia (vocabolario delle azioni di Home Assistant). |
| `entities` | nessuno | Sostituisce l'entità usata da un nome logico — vedi sotto. |

### Azioni

`unlock`, `lock`, `trunk`, `windows`, `sunshade`, `findVehicle`,
`unlockCharger`, `quickCool`, `quickHeat`, `quickVentilation`, `defrost`,
`climate`, `climateOff`, `batteryPreheat`, `steeringWheelHeat`, `mirrorHeat`,
`driverSeatHeat`, `driverSeatVent`, `passengerSeatHeat`, `passengerSeatVent`.

Mate comanda la maggior parte delle funzioni con una coppia di pulsanti, quindi
la scheda trasforma un tocco nel pulsante che inverte quanto riferisce l'auto:
`trunk` apre o chiude, `sunshade` apre o chiude, `climate` preme *A/C Auto* o
*A/C Off*, la funzione di un sedile preme il suo *On* o *Off*. **Un pulsante che
Mate non pubblica non dà alcun controllo**: sulla B10 Mate nasconde i comandi
che l'auto accetta senza eseguire, e la scheda lo segue.

`unlock`, `lock`, `trunk`, `windows` e `sunshade` sono disattivate mentre l'auto
è in movimento.

### Gruppi

`charging` (batteria e limite di carica), `status` (serrature, porte,
finestrini, bagagliaio, tendina), `climate`, `tires`, `trip`, `location`. Ogni
tile mostra una riga; `summary:` sceglie quale — per la batteria `charge`
(predefinito), `battery`, `limit`, `phase`, `eta`.

### Cosa cambia dal punto di vista di Mate

- **La temperatura impostata è in sola lettura.** Mate la pubblica come sensore,
  non come regolazione; la scheda la mostra e il pannello del clima offre le
  modalità (Auto, Raffredda, Riscalda, Ventila, Sbrina, Spento), la velocità
  della ventola e il ricircolo.
- **I sedili sono acceso/spento**, con il livello riferito dall'auto accanto.
- **La tendina è apri/chiudi**, con la posizione in percentuale quando l'auto
  la comunica.
- **Percorso** mostra il contachilometri e la temperatura esterna. Viaggi e
  consumi sono nell'interfaccia web di Mate: non vengono pubblicati via MQTT.
- **Non c'è il pannello della programmazione di carica**: Mate espone il piano
  come entità di testo JSON pensata per le automazioni.
- **La posizione non indica una zona**: il tracker di Mate dice `home` ogni
  volta che ha delle coordinate, ovunque siano.
- I comandi non sono istantanei: l'auto deve svegliarsi e Mate interroga il
  cloud a intervalli, quindi il nuovo stato può richiedere un minuto.

### Sostituire le entità

`entities:` sostituisce l'entità dietro un nome logico, per un entity_id
rinominato o per un'auto che Mate pubblica in modo diverso:

```yaml
entities:
  battery: sensor.la_mia_b10_battery
  lock: lock.la_mia_b10_door_lock
```

I nomi sono le chiavi di `ENTITY_KEYS` in [`src/keys.ts`](src/keys.ts)
(`battery`, `range`, `lock`, `trunk`, `tireFL`, `doorDriver`, `openTrunk`, …).

### Toccare l'intestazione

Il numero dell'autonomia apre la finestra di dettaglio del sensore da cui
proviene (cambia con `range_tap_action`, oppure `none`). La pillola *Porte
bloccate* blocca o sblocca l'auto, sempre dopo una conferma.

## Sviluppo

```bash
npm ci
npm test          # test unitari e un test di rendering in un DOM
npm run typecheck
npm run build     # dist/leapmotor-mate-card.js
```

Le release sono costruite dal workflow `build` quando si carica un tag `v*`.

## Crediti e licenza

Scheda originale di [fapgomes](https://github.com/fapgomes/ha-leapmotor-card);
dati dell'auto da [Leapmotor Mate](https://github.com/ProtossBlaster/leapmotor-mate)
(ProtossBlaster). I disegni delle auto sono quelli della scheda originale e non usano
grafiche Leapmotor.

GPL-3.0-or-later — vedi [LICENSE](LICENSE).
