# Phase 2 — SQL Editor, Connections CRUD, Işgärler bölümi

Bu arhiwdäki faýllary öz `electron-admin-app` proýektiňdäki **şol bir ýoldaky**
faýllaryň üstünden göçürip goý (üstüni ýaz). Täze faýllar hem bar — olary hem
görkezilen ýerlere goş.

## 1. Näme üýtgedi

### A) SQL editor: Monaco → CodeMirror
- `src/components/ApiBuilder/MonacoSqlEditor.tsx` faýlyny **poz** (indi
  ulanylmaýar).
- Ýerine `src/components/ApiBuilder/SqlEditor.tsx` (täze) goşuldy — CodeMirror
  bilen, öňki "linear-dark" tema meňzeş reňkler bilen, `@param` ýazanyňda
  awtomatik toldurma (autocomplete) öňki ýaly işleýär.
- `EndpointEditor.tsx` indi `SqlEditor`-i import edýär.
- `package.json`-dan `@monaco-editor/react` aýryldy, ýerine
  `@uiw/react-codemirror`, `@codemirror/lang-sql`, `@codemirror/autocomplete`,
  `@codemirror/view` goşuldy.

### B) Company içinde Connections CRUD
- `TenantConfig` görnüşine (`src/types/endpoint.types.ts`) täze
  `connections: TenantConnection[]` meýdany goşuldy. Bir kompaniýanyň birnäçe
  baglanyşygy (mysal: production + reporting replica) bolup biler, olaryň
  biri hemişe **primary** (esasy) bolýar — API sorag we "Sync to VPS" şony
  ulanýar.
- `useTenantStore.ts`-e `addConnection`, `updateConnection`,
  `removeConnection`, `setPrimaryConnection` funksiýalary goşuldy.
- Täze `TenantConnectionsPanel.tsx` — kompaniýa saýlanaňda (Companies
  sahypasynda) sag tarapda görünýär: goşmak, ýazgy üýtgetmek, primary
  belgilemek, barlamak (Test), pozmak.
- `TenantForm.tsx` indi diňe ilkinji (primary) baglanyşygy soraýar; galanlaryny
  kompaniýa dörediensoň Connections panelinden goşup bolýar.
- `Tenants.tsx` üýtgedi: kompaniýa saýlansa Connections panel görkezilýär,
  saýlanmasa — täze kompaniýa goşmak formasy.

### C) Täze bölüm: Işgärler (Staff)
- Nawigasiýada **Companies** bilen **API Builder**-iň arasynda **"Işgärler"**
  tab goşuldy (`src/App.tsx`).
- Täze faýllar:
  - `src/types/staff.types.ts` — `StaffMember` (fullName, username,
    passwordHash, role: admin/editor/viewer, tenantIds — haýsy
    kompaniýalara elýeterlidigi, active).
  - `src/store/useStaffStore.ts` — CRUD (goş/üýtget/poz).
  - `src/components/StaffManager/StaffForm.tsx` — işgär goşmak/üýtgetmek
    formasy: ady, ulanyjy ady, parol, orun (rol), haýsy kompaniýalara
    elýeterli bolmaly (togglable badge-ler), aktiw/passiw.
  - `src/components/StaffManager/StaffList.tsx` — işgärleriň sanawy, haýsy
    kompaniýalara baglydygyny görkezýär, pozmak düwmesi bar.
  - `src/pages/Staff.tsx` — sahypanyň özi.
- **Parollar** renderer-de asla açyk ýagdaýda saklanmaýar — Electron main
  process-de (`electron/main.ts`) `scrypt` bilen hashlanýar
  (`staff:hashPassword` / `staff:verifyPassword` IPC), `preload.ts` arkaly
  `window.staffAPI` hökmünde açylýar. Diňe `"salt:hash"` setiri saklanýar.

## 2. Haýsy faýllary göçürmeli

**Üstüni ýazmaly (üýtgedi):**
```
package.json
electron/main.ts
electron/preload.ts
src/types/global.d.ts
src/types/endpoint.types.ts
src/store/useTenantStore.ts
src/components/ApiBuilder/EndpointEditor.tsx
src/components/TenantManager/TenantForm.tsx
src/pages/Tenants.tsx
src/App.tsx
```

**Täze goşulmaly:**
```
src/types/staff.types.ts
src/store/useStaffStore.ts
src/components/ApiBuilder/SqlEditor.tsx
src/components/TenantManager/TenantConnectionsPanel.tsx
src/components/StaffManager/StaffForm.tsx
src/components/StaffManager/StaffList.tsx
src/pages/Staff.tsx
```

**Pozmaly (indi ulanylmaýar):**
```
src/components/ApiBuilder/MonacoSqlEditor.tsx
```

## 3. Gurnama

Faýllary göçüreniňden soň:

```bash
npm install
npm run dev
```

`npm install` `@monaco-editor/react`-i aýryp, CodeMirror paketlerini
ýükleýär — internet gerek (npm registry).

## 4. Barlamaly zatlar

1. **API Builder** → bir endpoint saýla → SQL editor indi CodeMirror bilen
   açylmaly, `@` ýazanyňda parametrleriň sanawy çykmaly.
2. **Companies** → bar bolan kompaniýa saýla → sag tarapda "Connections"
   paneli görünmeli, "+" bilen täze baglanyşyk goş, "Make primary" bilen
   esasy edip bilýändigiňi barla, Test/Edit/Delete işlemeli.
3. **Işgärler** tab → täze işgär goş (ady, ulanyjy ady, parol, rol,
   kompaniýalar), sanawda görünmeli, basyp üýtgedip bolmaly, pozup bolmaly.

## 5. Entek edilmedik (indiki tapgyrlarda)

- Işgärleriň hakyky **login ekrany** (bu tapgyrda diňe admin CRUD paneli —
  işgär girip bolýan aýratyn giriş görnüşi ýok).
- Işgärleriň orunlaryna (admin/editor/viewer) görä UI-da hakyky
  çäklendirme (häzir diňe maglumat hökmünde saklanýar).
- Connection Test düwmesi henizem stub (öňki ýaly, hakyky IPC/`mssql`
  barlagy ýok) — muny `electron/ipc/db.ipc.ts` görnüşinde aýratyn goşup
  bolar.
- Işgärler we baglanyşyklar diskde saklanmaýar (beýleki tenant/endpoint
  maglumatlary ýaly, diňe sessiýa dowamynda ýady saklanýar) — hakyky
  persistence (mysal: local encrypted store ýa-da backend DB) indiki
  tapgyrda goşulmaly.
