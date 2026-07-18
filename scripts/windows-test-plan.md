# Windows Installation & Upgrade Test Plan

Covers P6-09 through P6-12. Execute each section in order on a clean test machine or VM.

## P6-09: Authenticode Signing & Trusted Timestamp

- [ ] Build release unsigned installer: `pnpm build:win`
- [ ] Sign with EV code-signing certificate using `signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256`
- [ ] Verify signature: `signtool verify /pa BidLens-Setup-x.y.z.exe`
- [ ] Check certificate chain includes trusted root CA
- [ ] Confirm timestamp countersignature is present (long-term validity)
- [ ] Verify signed installer shows publisher name in UAC prompt (no "Unknown publisher")
- [ ] Test unsigned installer is flagged by SmartScreen (negative control)

## P6-10: Clean Non-Admin Install on Windows 10

Target OS: Windows 10 22H2 (build 19045+), non-admin user account.

- [ ] Install to default path (`%LOCALAPPDATA%\Programs\BidLens`)
- [ ] Install to custom path (e.g., `D:\Tools\BidLens`)
- [ ] Install to Chinese character path (e.g., `D:\软件\招标工具\BidLens`)
- [ ] Install to path with spaces (e.g., `C:\My Programs\BidLens`)
- [ ] Verify no admin/UAC prompt appears during install
- [ ] Launch app and verify main window renders correctly
- [ ] Run installer with network disconnected (offline install)
- [ ] Uninstall via Windows Settings > Apps, confirm clean removal
- [ ] Verify uninstall removes Start Menu shortcut, desktop shortcut, and install directory
- [ ] Check no residual registry keys remain under `HKCU\Software\BidLens`

## P6-11: Windows 11 & Windows Defender Testing

Target OS: Windows 11 23H2+ with default Windows Defender settings.

- [ ] Install and launch — verify Defender does not block or quarantine
- [ ] Check Security Center shows no warnings for BidLens
- [ ] Run full Defender scan after install — no detections
- [ ] Verify Controlled Folder Access does not block app data writes
- [ ] Test with SmartScreen enabled — confirm reputation warning does not appear for signed build
- [ ] Verify app works with Windows 11 Snap Layouts (hover maximize button)
- [ ] Confirm system tray icon and notifications render on Windows 11

## P6-12: In-Place Upgrade Testing

Starting from previous release version installed.

- [ ] Install previous version (e.g., v0.2.1), create sample comparison history
- [ ] Run new version installer over existing installation
- [ ] Verify migration backup is created at `<install>/backup/<old-version>/`
- [ ] Confirm comparison history and user settings are preserved after upgrade
- [ ] Verify database schema migration runs without errors (check logs)
- [ ] Test rollback: uninstall new version, reinstall old version, confirm data intact
- [ ] Test upgrade skipping one version (N-2 to N) if applicable
- [ ] Verify Start Menu and desktop shortcuts are updated to new version
- [ ] Check Add/Remove Programs shows correct new version number
