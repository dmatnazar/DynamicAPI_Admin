# Phase 1 — Electron UI/UX düzedişleri

Bu arhiwdäki faýllary öz `electron-admin-app` proýektiňdäki **şol bir ýoldaky**
faýllaryň üstünden göçürip goý (üstüni ýaz). Täze faýllar hem bar (`tray.ts`,
`TitleBar.tsx`) — olary hem şol ýerlere goş.

## Näme üýtgedi

1. **Menu bar aýryldy** — `electron/main.ts`-de `Menu.setApplicationMenu(null)`.
   Indi ýokarda File/Edit/View/Window/Help görünmeýär.
2. **DevTools awtomatik açylmaýar** — diňe `OPEN_DEVTOOLS=1 npm run dev` bilen
   işledeniňde açylar, ýogsam hiç haçan.
3. **Responsive** — sidebar endi dar ekranda (< 860px) ikon-görnüşe geçýär,
   API Builder-daki param satyrlary, endpoint editor endi ýerleşmeýän ýerde
   satyrlara bölünýär, Dashboard/Settings hem kiçi ekrana uýgunlaşýar.
4. **"Tenants" → "Companies"** — nav, sahypa sözbaşylary, formalar üýtgedildi.
5. **Custom title bar** (`src/components/TitleBar.tsx`) — native menu/traffic
   light-lar gizlenensoň, minimize/maximize/close-to-tray/restart düwmeleri
   şu bar-da.
6. **System tray** (`electron/tray.ts`) — sag-basyş bilen menýu: Show/Hide
   window, Restart app, Quit. X (close) düwmesi indi programmany ýapman,
   trayda ýaşyryar (arkada sync dowam etsin diýip; hakyky çykmak diňe tray
   "Quit"-den ýa-da update gurnalanda).
7. **Settings** sahypasy düýpli täzelendi — Gateway URL + Admin secret indi
   kartoçkalarda, "Test connection" düwmesi, auto-sync ýygylygyny saýlamak
   (Manual/5 min/15 min/1 sagat). `src/pages/Endpoints.tsx` indi
   `GATEWAY_URL`/`ADMIN_SECRET`-i kod içinde ýazylan görnüşde däl-de, şu
   Settings-de ýazan zatlaryňdan (encrypted vault) okaýar.
8. **Dashboard** has köp maglumat berýär: Companies/Endpoints/Connected/Failed
   statistikasy, "Recent companies" sanawy.

## Entek edilmedik (indiki tapgyrlarda)

- SQL editor-y (Monaco → seniň CodeMirror faýllaryň) çalyşmak — **2-nji tapgyr**
- Company içinde Connections CRUD (goşmak/üýtgetmek/pozmak formalary) — **3-nji tapgyr**
- Admin panel, ishgärler, login/parol, local DB + offline sync — **4-nji tapgyr**
- VPS Gateway önümçilik taýýarlygy — **5-nji tapgyr**

## Ýene bir zat

`build/tray-icon.png` ýoluna öz 16×16 (we retina üçin 32×32) ikonyňy goý —
häzir onsuz-da işleýär (ownuk gök nokat bilen fallback bar), ýöne öz brendiň
bilen çalşyrsaň has gowy görner.

Indiki habarda 2-nji tapgyra (SQL editor) geçýärin.
