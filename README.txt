Dynamic API Admin — feature update

1) Single instance
   - Ikinji açylyşda Windows dialog: "Eýýäm işleýär"
   - Bar bolan penjirä focus

2) Giriş paroly
   - Settings → "App giriş paroly" bilen parol goý
   - Dogry parol → ähli menýu
   - Parolsyz / nädogry / "Parolsyz — diňe Dashboard" → diňe Dashboard

3) App icon (installer + taskbar)
   electron/assets/icons/icon.ico
   Multi-size: 16,24,32,48,64,128,256
   See README-ICONS.txt

4) Tray status icons
   tray-ok.ico       — VPS + DB OK
   tray-partial.ico  — diňe biri
   tray-offline.ico  — hiç biri / internet ýok
   Size: 16x16 or 32x32 .ico

Copy files into project (same paths), put real .ico files,
then: npm run build
