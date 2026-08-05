# API Builder crash fix

## Sebäp (root cause)

`src/components/ApiBuilder/EndpointEditor.tsx` faýlynda şu setir bardy:

```tsx
<span className="font-mono text-neutral-500">/api/v1/{companySlug}/{dbKey}{path}</span>
```

JSX içinde `{companySlug}`, `{dbKey}`, `{path}` **JavaScript üýtgeýjisi** hökmünde hasaplanýar.
Bu üýtgeýjiler ýok, şonuň üçin React `ReferenceError: companySlug is not defined` berýär.
Netijede API saýlananda ýa-da täze endpoint goşulanda ähli UI ýitýär / "duryar".

## Näme üýtgedildi

1. **EndpointEditor.tsx**
   - `{companySlug}` ýaly ýalňyş JSX aňlatmalary düzedildi → `{'/api/v1/{companySlug}/{dbKey}{path}'}`
   - `paramsSchema` üçin howpsuz fallback goşuldy
   - Debug `console.log` goşuldy

2. **Endpoints.tsx**
   - Select / Add / Update / Delete üçin `console.log` goşuldy
   - connectionId auto-set useEffect hasaplanýan baglylyklary gowulaşdyryldy (loop howpy azaltmak)
   - Select üçin aýratyn `handleSelectEndpoint` (try/catch + log)

## Nädip gurnamaly

Proýektiň kökünden:

```bash
# Göçürip goý (üstüne ýaz)
cp fix-api-builder/src/components/ApiBuilder/EndpointEditor.tsx src/components/ApiBuilder/EndpointEditor.tsx
cp fix-api-builder/src/pages/Endpoints.tsx src/pages/Endpoints.tsx
```

Soň:

```bash
npm run dev
```

## Barlamak

1. Companies-de azyndan 1 kompaniýa + 1 DB baglanyşygy bolsun
2. API Builder-e geç
3. «Täze» bas — editor açylmaly, ekran ýitmeli däl
4. Endpoint-e bas — sag tarapda editor görünmeli
5. DevTools Console-da şu loglar görünmeli:
   - `[EndpointsPage] select endpoint ...`
   - `[EndpointEditor] render ...`

Eger ýene-de bozulsa, Console-daky **gyzyl error** setirini we loglary maňa iber.
