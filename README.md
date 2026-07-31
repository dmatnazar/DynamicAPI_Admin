# Dynamic API Admin — Desktop Programma (Electron + React)

Bu, kompaniýaňyzyň MSSQL maglumat binýatlaryny wizual API-lere öwürmek üçin
ulanylýan Electron desktop programmasydyr. Şu programmadan gurlan API-leri
bir gezek basyp VPS Gateway'e ugradyp bolýar.

## 1. Talap edilýän programmalar

- **Node.js** (18 ýa-da 20 wersiýa) — https://nodejs.org

```bash
node -v
npm -v
```

## 2. Gurnama ädimleri

1. `electron-admin-app` papkasyny aç.
2. Terminaly şol ýerde açyp:

```bash
npm install
```

Bu birazajyk uzak dowam edip biler (~1-2 minut), sebäbi Electron-yň özi hem
ýüklenýär (~100 MB golaý).

## 3. Işe girizmek (dev tertibi)

```bash
npm run dev
```

Bu buýruk:
- Vite dev serwerini başladýar (React interfeýsi üçin)
- Electron penjiresini awtomatik açýar
- Kod üýtgände penjire özi täzelenýär (hot reload)

Birnäçe sekuntdan soň garaňky temaly "Dynamic API Admin" atly desktop
penjire açylmaly. Eger açylmasa, terminaldaky ýalňyşlyk ýazgylaryny barlaň.

## 4. Programmany ulanmak tertibi

1. **Tenants** sahypasyna geçiň → "New Tenant" bölüminde kompaniýaňyzyň adyny,
   slug-yny (mysal: `demo-company`) we MSSQL connection string-ini ýazyň →
   "Test Connection" → "Add Tenant".
2. **API Builder** (Endpoints) sahypasyna geçiň → "+ New" basyp täze endpoint
   dörediň → HTTP usulyny (GET/POST/...), ýoluny (`/branches/:branchId/sales`
   ýaly), SQL soragyny (Monaco editor içinde) we parametrlerini ýazyň.
3. Çep tarapdaky "One-Click Sync to VPS" düwmesini basyň — bu, gurlan
   endpoint-i işleýän VPS Gateway serwerine ugradýar.

## 5. VPS Gateway bilen baglanyşyk

`src/pages/Endpoints.tsx` faýlynyň başynda şu iki üýtgeýji bar:

```ts
const GATEWAY_URL = 'http://localhost:4000';
const ADMIN_SYNC_SECRET = 'test_admin_secret_1234567890';
```

- `GATEWAY_URL` — gateway proýektiňiziň işleýän salgysy
- `ADMIN_SYNC_SECRET` — gateway-daky `.env` faýlyndaky `ADMIN_SYNC_SECRET`
  bilen **hökman gabat gelmeli**

Önümçilikde bularyň ikisini-de Settings sahypasyndan sazlamak we vault
(`window.vaultAPI`) arkaly howpsuz saklamak maslahat berilýär — häzir demo
üçin gönümel kod içinde goýlan.

## 6. Auto-Updater (awtomatik täzelenme)

`electron/updater.ts` faýlynda `electron-updater` arkaly GitHub Releases-e
birikmek üçin infrastruktura taýýar. Ony hakyky ulanmak üçin:

1. `electron-builder.yml` faýlyndaky `publish.owner` we `publish.repo`
   meýdanlaryny öz GitHub repo-ňyza üýtgediň.
2. `npm run build` bilen wersiýany build edip, GitHub Releases-e ýükläň.
3. Programma her 4 sagatdan we açylanda awtomatik täzelenme barlar, tapsa
   ekranyň sag ýokarky burçunda bildiriş peýda bolar.

## 7. Önümçilik üçin build (.exe / .dmg / .AppImage)

```bash
npm run build
```

Bu buýruk:
- TypeScript-i barlaýar (typecheck)
- React kodyny build edýär
- Electron-builder arkaly platforma degişli gurnama faýlyny (`.exe`, `.dmg`,
  ýa-da `.AppImage`) `release/` papkasyna çykarýar

Diňe build netijesini synap görmek (gurnama faýlyny döretmezden) üçin:

```bash
npm run build:dir
```

## Meseleler bolsa

- `npm install` wagtynda ýalňyşlyk — Node.js wersiýasyny täzeläň (18+)
- Penjire açylmasa — terminaldaky gyzyl ýazgylary (error) barlaň
- "Sync failed" ýalňyşlygy — VPS Gateway proýektiniň işleýändigini
  (`http://localhost:4000/health`) we iki tarapdaky syýanyň (secret) gabat
  gelýändigini barlaň
# DynamicAPI_Admin
# DynamicAPI_Admin
