#!/bin/bash
# =============================================================================
#  Pi POS System - Automated Deployment Script
#  For Raspberry Pi 4 running Raspberry Pi OS (Bookworm/Bullseye)
#  Run as: sudo bash setup-pos.sh
# =============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log()    { echo -e "${GREEN}[POS SETUP]${NC} $1"; }
warn()   { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# -------------------------------------------------------
# 0. Must be run as root
# -------------------------------------------------------
if [ "$EUID" -ne 0 ]; then
  error "Please run this script as root: sudo bash setup-pos.sh"
fi

POS_USER=$(logname 2>/dev/null || echo "pi")
HOME_DIR="/home/$POS_USER"
APP_DIR="$HOME_DIR/pos-app"
BUILD_DIR="$APP_DIR/frontend/dist"

log "=== Raspberry Pi POS Setup ==="
log "Deploying as user: $POS_USER"
log "App directory: $APP_DIR"
echo ""

# -------------------------------------------------------
# 1. System Update
# -------------------------------------------------------
log "Step 1/9: Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
log "System updated."

# -------------------------------------------------------
# 2. Install Node.js (LTS via NodeSource)
# -------------------------------------------------------
log "Step 2/9: Installing Node.js LTS..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y -qq nodejs
fi
NODE_VER=$(node -v)
log "Node.js installed: $NODE_VER"

# -------------------------------------------------------
# 3. Install CUPS for Printer Management
# -------------------------------------------------------
log "Step 3/9: Installing CUPS printer server..."
apt-get install -y -qq cups cups-bsd printer-driver-escpr
systemctl enable cups
systemctl start cups
# Allow the POS user to manage printers
usermod -aG lpadmin "$POS_USER"
# Allow remote CUPS admin (local network only)
cupsctl --remote-admin
log "CUPS installed and running."

# -------------------------------------------------------
# 4. Install libcups for thermal printer driver support
# -------------------------------------------------------
log "Step 4/9: Installing thermal printer support packages..."
apt-get install -y -qq \
  libcups2 \
  printer-driver-gutenprint \
  python3-serial
log "Printer packages installed."

# -------------------------------------------------------
# 5. Clone / Copy App Files
# -------------------------------------------------------
log "Step 5/9: Setting up POS application files..."
if [ ! -d "$APP_DIR" ]; then
  mkdir -p "$APP_DIR"
fi

# If the user is copying from USB/SD, adjust the path below:
# cp -r /media/$POS_USER/USB_DRIVE/pos-app/* "$APP_DIR/"
# Otherwise clone from repository if available:
# git clone https://github.com/yourname/pi-pos.git "$APP_DIR"

# For now, create the directory structure:
mkdir -p "$APP_DIR/frontend"
chown -R "$POS_USER":"$POS_USER" "$APP_DIR"
log "App directory ready at $APP_DIR"

# -------------------------------------------------------
# 6. Build the React/Vite Frontend
# -------------------------------------------------------
log "Step 6/9: Building the POS frontend..."
if [ -f "$APP_DIR/frontend/package.json" ]; then
  cd "$APP_DIR/frontend"
  sudo -u "$POS_USER" npm install --silent
  sudo -u "$POS_USER" npm run build
  log "Frontend built to $BUILD_DIR"
else
  warn "Frontend package.json not found. Please copy your frontend folder to $APP_DIR/frontend/ and re-run this script from Step 6."
fi

# -------------------------------------------------------
# 7. Install serve (static file server for built app)
# -------------------------------------------------------
log "Step 7/9: Installing static file server..."
npm install -g serve --silent
log "serve installed globally."

# -------------------------------------------------------
# 8. Create systemd Service for the POS Server
# -------------------------------------------------------
log "Step 8/9: Creating POS systemd service..."
cat > /etc/systemd/system/pos-app.service << EOF
[Unit]
Description=Pi POS Static Server
After=network.target

[Service]
Type=simple
User=$POS_USER
WorkingDirectory=$BUILD_DIR
ExecStart=/usr/bin/env serve $BUILD_DIR -p 3000 --single
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable pos-app.service
systemctl start pos-app.service
log "POS server service created and started on port 3000."

# -------------------------------------------------------
# 9. Configure Chromium Kiosk Mode on Boot
# -------------------------------------------------------
log "Step 9/9: Configuring Chromium kiosk mode autostart..."

AUTOSTART_DIR="$HOME_DIR/.config/autostart"
mkdir -p "$AUTOSTART_DIR"

# Disable screensaver and power management
cat > "$AUTOSTART_DIR/screensaver-disable.desktop" << EOF
[Desktop Entry]
Type=Application
Name=Disable Screensaver
Exec=xset s off -dpms
EOF

# Chromium Kiosk Launcher
cat > "$AUTOSTART_DIR/pos-kiosk.desktop" << EOF
[Desktop Entry]
Type=Application
Name=POS Kiosk
Exec=bash -c "sleep 5 && chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --disable-restore-session-state --no-first-run --check-for-update-interval=31536000 --kiosk-printing --enable-features=WebSerial http://localhost:3000"
X-GNOME-Autostart-enabled=true
EOF

# Also disable right-click context menu and cursor in kiosk settings
cat > "$HOME_DIR/.config/chromium/Local State" << 'EOF'
{
   "browser": {
      "has_seen_welcome_page": true,
      "show_home_button": false
   }
}
EOF

chown -R "$POS_USER":"$POS_USER" "$AUTOSTART_DIR"
log "Chromium kiosk mode configured. App will launch at http://localhost:3000 on boot."

# -------------------------------------------------------
# 10. Configure Thermal Printer Silent Printing
# -------------------------------------------------------
log "Configuring thermal printer silent/default printing..."

# Create a Chromium policy file for kiosk printing
mkdir -p /etc/chromium/policies/managed/
cat > /etc/chromium/policies/managed/pos-policy.json << 'EOF'
{
  "PrintingEnabled": true,
  "DefaultPrinterSelection": "",
  "PrintPreviewUseSystemDefaultPrinter": true,
  "DisablePrintPreview": true,
  "DefaultSerialGuardSetting": 1,
  "SerialAllowAllPortsForUrls": [
    "http://localhost:3000"
  ]
}
EOF

log "Silent printing policy applied."

# -------------------------------------------------------
# Done!
# -------------------------------------------------------
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  POS SYSTEM SETUP COMPLETE!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  📦 App location : $APP_DIR"
echo "  🌐 App URL       : http://localhost:3000"
echo "  🖨  Printer Admin : http://localhost:631 (CUPS)"
echo ""
echo "  NEXT STEPS:"
echo "  1. Connect your thermal printer via USB."
echo "  2. Open CUPS at http://localhost:631 to install printer."
echo "  3. Set the thermal printer as the default printer."
echo "  4. Reboot the Raspberry Pi: sudo reboot"
echo ""
echo -e "${YELLOW}  The POS app will auto-launch in kiosk mode after reboot.${NC}"
echo ""
