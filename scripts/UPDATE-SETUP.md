# Auto-update via VPS (recommended)

Google Drive is **not** reliable for electron-updater (auth, direct links, latest.yml).
Use a static folder on your VPS (nginx/caddy/apache).

## Architecture

```
[Electron app]  --HTTPS GET-->  https://your-domain.com/updates/latest.yml
                --HTTPS GET-->  https://your-domain.com/updates/Dynamic-API-Admin-Setup-1.0.1.exe
```

`electron-updater` compares `latest.yml` version with app version.
If newer → UI shows update → download → "Restart & Install".

## Step 1 — nginx (VPS)

```nginx
server {
  listen 443 ssl;
  server_name your-domain.com;
  # ssl_certificate ...;

  location /updates/ {
    alias /var/www/updates/;
    autoindex off;
    add_header Cache-Control "no-cache";
    # allow .yml and .exe
    types {
      text/yaml yml yaml;
      application/octet-stream exe blockmap;
    }
  }
}
```

```bash
sudo mkdir -p /var/www/updates
sudo chown $USER:$USER /var/www/updates
```

Test: `curl -I https://your-domain.com/updates/latest.yml`

## Step 2 — App config

In `electron-builder.yml`:

```yaml
publish:
  provider: generic
  url: https://your-domain.com/updates
```

Or at runtime: **Settings → Auto-update (VPS)** → paste URL → Save.

Or env when packaging:
`UPDATE_FEED_URL=https://your-domain.com/updates`

## Step 3 — Release a new version

```bash
# 1. bump version
# package.json → "version": "1.0.1"

# 2. build installer (+ latest.yml)
npm run build

# 3. upload
RELEASE_NOTES="1.0.1 — tray icons, app lock, update feed" \
  ./scripts/publish-to-vps.sh user@your-vps:/var/www/updates
```

Files that must exist on VPS after upload:

- `latest.yml`          (metadata + sha512 + path)
- `*.exe`               (NSIS installer)
- `*.exe.blockmap`      (optional but recommended)

## Step 4 — Client behaviour

1. App starts (packaged only) → after ~4s checks feed
2. Every 4 hours re-checks
3. If new version → modal with version + release notes
4. User clicks download → progress bar
5. When ready → "Restart & Install" → quitAndInstall

## latest.yml example

```yaml
version: 1.0.1
files:
  - url: Dynamic-API-Admin-Setup-1.0.1.exe
    sha512: <hash>
    size: 12345678
path: Dynamic-API-Admin-Setup-1.0.1.exe
sha512: <hash>
releaseDate: '2026-08-11T12:00:00.000Z'
releaseNotes: |
  - Single instance lock
  - App password gate
  - Tray status icons
```

electron-builder generates most of this automatically into `release/latest.yml`.

## Why not Google Drive?

- No stable public URL for `latest.yml` without sharing quirks
- Download URLs often require cookies / change over time
- electron-updater expects plain HTTP(S) static files + correct sha512

If you only have Drive: put files on any static host (VPS, Cloudflare R2, S3, BunnyCDN).
