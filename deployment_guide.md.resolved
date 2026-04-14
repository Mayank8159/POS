# 🍓 Raspberry Pi POS System — Deployment Guide

This guide walks you through deploying the POS billing system on a fresh Raspberry Pi 4. The result is a fully kiosk-locked, offline POS terminal that auto-launches on boot and silently prints to a USB thermal receipt printer.

---

## 🛒 Hardware Requirements

| Component | Recommendation |
|-----------|---------------|
| Raspberry Pi 4 | 2GB RAM or higher |
| MicroSD Card | 32GB+ (Class 10 / A2 rated for speed) |
| Power Supply | Official RPi 5V 3A USB-C |
| Display | Any HDMI monitor or RPi Official 7" Touchscreen |
| Thermal Printer | 58mm or 80mm USB thermal (e.g., EPSON TM-T20, Xprinter XP-58) |
| Keyboard + Mouse | Temp only (for initial setup) |

---

## 📥 Step 1: Flash Raspberry Pi OS

1. Download **Raspberry Pi Imager** from https://rptl.io/imager on your Windows machine.
2. Insert your microSD card.
3. Select:
   - **Device:** Raspberry Pi 4
   - **OS:** Raspberry Pi OS (64-bit) with Desktop *(Bookworm recommended)*
   - **Storage:** your SD card
4. Click the **gear icon** (⚙️) to pre-configure:
   - Set **hostname:** `pipos`
   - Set **username/password** (e.g., `pi` / your password)
   - Enable **SSH** if you want remote access
5. Click **Write** and wait for completion.
6. Insert the card into your Raspberry Pi and power it on.

---

## 📂 Step 2: Copy the POS App to the Pi

### Option A: Via USB Drive
1. Copy the entire `POS/frontend` folder onto a USB flash drive.
2. Plug the USB into the Raspberry Pi.
3. Open a terminal on the Pi and run:
```bash
mkdir -p ~/pos-app
cp -r /media/pi/YOUR_USB_DRIVE_NAME/frontend ~/pos-app/
```

### Option B: Via Network (Windows → Pi)
From your Windows machine, use **WinSCP** or PowerShell:
```powershell
# Replace PI_IP with your Pi's IP address
scp -r "C:\Users\MAYANK KUMAR SHARMA\Desktop\POS\frontend" pi@PI_IP:~/pos-app/frontend
```

---

## ⚙️ Step 3: Run the Automated Setup Script

Copy `setup-pos.sh` (in your `POS/` folder) to the Pi alongside the `frontend` folder, then run:

```bash
# On the Raspberry Pi terminal
sudo bash ~/pos-app/setup-pos.sh
```

The script will automatically:
- Update the OS
- Install Node.js LTS
- Install CUPS (printer management)
- Build the frontend (`npm run build`)
- Install a static file server on port **3000**
- Create a **systemd service** so the app starts on boot
- Configure **Chromium kiosk mode** to auto-launch the app
- Apply a **silent printing policy** to Chromium

---

## 🖨️ Step 4: Install the Thermal Printer

> [!IMPORTANT]
> Complete this step **after** running the setup script and **before** rebooting.

1. **Connect** your USB thermal printer to the Raspberry Pi.
2. Open a browser and navigate to the **CUPS admin panel**:
   ```
   http://localhost:631
   ```
3. Go to **Administration → Add Printer**.
4. Log in with your Pi username/password when prompted.
5. Select your **USB thermal printer** from the list.
6. Choose the correct **driver** (for generic thermal printers, use `Generic Text-Only Printer` or your brand-specific driver such as `Epson TM-T20`).
7. Click **Add Printer**, then click **Set As Server Default**.

### Verify Printer Works
```bash
# Print a test page from the terminal
echo "POS Printer Test - OK" | lp
```

---

## 🔐 Step 5: Configure Silent Printing in Chromium

For the POS app to print without showing a dialog box, you need to set the default printer as your thermal printer. The setup script already applies the `DisablePrintPreview` policy.

To verify:
```bash
cat /etc/chromium/policies/managed/pos-policy.json
```

Output should show `"DisablePrintPreview": true`.

You can also update the default printer name in that file:
```json
{
  "PrintingEnabled": true,
  "DefaultPrinterSelection": "YOUR_PRINTER_NAME",
  "DisablePrintPreview": true
}
```
Replace `YOUR_PRINTER_NAME` with the name shown in CUPS.

---

## 🚀 Step 6: Reboot and Test

```bash
sudo reboot
```

After reboot, the Pi will:
1. Boot into the Raspberry Pi OS desktop
2. Automatically launch **Chromium in kiosk/fullscreen mode**
3. Load the POS app at `http://localhost:3000`

> [!TIP]
> To exit kiosk mode temporarily (for maintenance), press **Alt + F4** to close Chromium, then use the desktop normally.

---

## 💾 Step 7: Data Backup (SD Card Data = IndexedDB)

The POS database (all products and orders) is stored in Chromium's IndexedDB, which lives on the SD card at:
```
~/.config/chromium/Default/IndexedDB/
```

### Backup Strategy
We recommend periodically backing this folder up to a USB drive:
```bash
# Create a backup script (save as ~/backup-pos.sh)
#!/bin/bash
DATE=$(date +%Y-%m-%d)
DEST="/media/pi/BACKUP_USB/pos-backups/$DATE"
mkdir -p "$DEST"
cp -r ~/.config/chromium/Default/IndexedDB/ "$DEST/IndexedDB/"
echo "Backup complete: $DEST"
```

Run weekly with a cron job:
```bash
crontab -e
# Add this line (every Sunday at 11 PM):
0 23 * * 0 bash ~/backup-pos.sh
```

---

## 🧰 Troubleshooting

| Issue | Fix |
|-------|-----|
| App doesn't launch on boot | Run `systemctl status pos-app` and check logs |
| Chromium doesn't open | Check `~/.config/autostart/pos-kiosk.desktop` exists |
| Printer not found in CUPS | Use `lpstat -p` to list detected printers |
| Print dialog still appears | Verify `/etc/chromium/policies/managed/pos-policy.json` is correct |
| White screen in Chromium | Wait 10s — app may still be starting; `systemctl restart pos-app` |
| Can't add products | Check browser console (F12 on external keyboard) for IndexedDB errors |

---

## 🏪 Commercial Deployment Checklist

Before delivering to a customer:

- [ ] Flash SD card with POS image
- [ ] Run `setup-pos.sh` on fresh OS
- [ ] Install and test thermal printer
- [ ] Add all customer's products via the Products screen
- [ ] Test a full checkout → receipt print cycle
- [ ] Set up weekly backup cron job
- [ ] Disable SSH and remove keyboard after handoff
- [ ] Label the SD card with the shop name and date

---

## 🔄 Updating the POS App

When you release a new version:
1. Copy the new `frontend/` folder to the Pi.
2. Navigate to `~/pos-app/frontend` and run:
```bash
npm install && npm run build
sudo systemctl restart pos-app
```
The updated app will be live immediately.
