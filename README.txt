BI Platform Client — Desktop Programma
Developer: Matnazar Durdymyradov

Kärhananyň maglumat bazalaryny dolandyrmak we analitika
dashboard-laryny görkezmek üçin desktop programma.
MSSQL bilen işleýär, VPS Gateway arkaly uzakdan sinhronlaşdyrýar.

Minimum OS: Windows Server 2012 R2 / Windows 7 SP1
Electron: 22.x (Win7/8/Server 2012 R2 goldaw berýär)

================================================================

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

4) Tray status icons
   tray-ok.ico       — VPS + DB OK
   tray-partial.ico  — diňe biri
   tray-offline.ico  — hiç biri / internet ýok
   Size: 16x16 or 32x32 .ico

5) Build etmek
   npm install
   npm run build

   release/ papkasynda "BI Platform Client Setup 1.0.0.exe" dörediler.
