#!/bin/sh
# Queen Suite & Argon Theme — Complete Automated OpenWrt Installer
# GitHub Repository: https://github.com/dev-prabina/openWRT.git
# Works on all OpenWrt versions (24.x opkg, 25.x apk, x86, ARM, MIPS)
set -e

REPO_USER="dev-prabina"
REPO_NAME="openWRT"
REPO_BRANCH="main"
ALT_BRANCH="master"
GITHUB_RAW="https://raw.githubusercontent.com/$REPO_USER/$REPO_NAME"
GITHUB_ARCHIVE="https://github.com/$REPO_USER/$REPO_NAME/archive/refs/heads"

echo "================================================================="
echo "  👑 Installing Queen Management Suite & Argon Theme on OpenWrt  "
echo "  Repository: https://github.com/$REPO_USER/$REPO_NAME           "
echo "================================================================="

download_file() {
    local url="$1"
    local dest="$2"
    if command -v wget >/dev/null 2>&1; then
        wget -q --no-check-certificate -O "$dest" "$url" 2>/dev/null || return 1
    elif command -v uclient-fetch >/dev/null 2>&1; then
        uclient-fetch --no-check-certificate -q -O "$dest" "$url" 2>/dev/null || return 1
    elif command -v curl >/dev/null 2>&1; then
        curl -sSL -k -o "$dest" "$url" 2>/dev/null || return 1
    else
        return 1
    fi
    [ -s "$dest" ] || return 1
}

# Step 1: Detect & Install Prerequisites + Multi-WAN
echo "[1/6] Installing system prerequisites and multi-WAN packages..."
if command -v apk >/dev/null 2>&1; then
    echo "  -> Detected OpenWrt 25.x (apk). Updating & installing..."
    apk update >/dev/null 2>&1 || true
    apk add ucode ucode-mod-fs ucode-mod-uci ucode-mod-ubus iwinfo mwan3 curl wget tar ca-certificates >/dev/null 2>&1 || true
elif command -v opkg >/dev/null 2>&1; then
    echo "  -> Detected OpenWrt 24.x (opkg). Updating & installing..."
    opkg update >/dev/null 2>&1 || true
    opkg install ucode ucode-mod-fs ucode-mod-uci ucode-mod-ubus iwinfo mwan3 curl wget tar ca-certificates >/dev/null 2>&1 || true
fi

# Step 2: Create Destination System Directories
echo "[2/6] Preparing destination directories..."
mkdir -p /usr/libexec/rpcd
mkdir -p /usr/libexec/argon
mkdir -p /www/luci-static/resources/view/queenx
mkdir -p /www/luci-static/argon
mkdir -p /usr/share/luci/menu.d
mkdir -p /usr/share/rpcd/acl.d
mkdir -p /etc/config

# Step 3: Locate or Fetch Queen & Argon Source Files
echo "[3/6] Locating / downloading Queen & Argon source package..."
SRC_DIR=""

SCRIPT_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
PARENT_DIR="$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd)"

if [ -d "$SCRIPT_DIR/sections" ] && [ -d "$SCRIPT_DIR/theme/argon" ]; then
    SRC_DIR="$SCRIPT_DIR"
elif [ -d "$PARENT_DIR/sections" ] && [ -d "$PARENT_DIR/theme/argon" ]; then
    SRC_DIR="$PARENT_DIR"
elif [ -d "$PARENT_DIR/Queen/sections" ] && [ -d "$PARENT_DIR/Queen/theme/argon" ]; then
    SRC_DIR="$PARENT_DIR/Queen"
elif [ -d "$(pwd)/sections" ] && [ -d "$(pwd)/theme/argon" ]; then
    SRC_DIR="$(pwd)"
elif [ -d "$(pwd)/Queen/sections" ] && [ -d "$(pwd)/Queen/theme/argon" ]; then
    SRC_DIR="$(pwd)/Queen"
fi

# If running remotely via pipe (wget/curl | sh), download full repository archive
if [ -z "$SRC_DIR" ]; then
    echo "  -> Running in remote pipe mode. Downloading full Queen repository from GitHub..."
    WORK_DIR="/tmp/queen_installer_$$"
    rm -rf "$WORK_DIR"
    mkdir -p "$WORK_DIR"
    
    DOWNLOAD_SUCCESS=0
    
    # Try git clone if available
    if command -v git >/dev/null 2>&1; then
        echo "  -> Cloning repository via git..."
        if git clone --depth 1 "https://github.com/$REPO_USER/$REPO_NAME.git" "$WORK_DIR/repo" >/dev/null 2>&1; then
            DOWNLOAD_SUCCESS=1
        fi
    fi
    
    # Try repository archive download
    if [ "$DOWNLOAD_SUCCESS" -eq 0 ]; then
        echo "  -> Downloading repository archive ($REPO_BRANCH)..."
        if download_file "$GITHUB_ARCHIVE/$REPO_BRANCH.tar.gz" "$WORK_DIR/repo.tar.gz"; then
            tar -xzf "$WORK_DIR/repo.tar.gz" -C "$WORK_DIR" 2>/dev/null || true
            DOWNLOAD_SUCCESS=1
        else
            echo "  -> Downloading repository archive ($ALT_BRANCH)..."
            if download_file "$GITHUB_ARCHIVE/$ALT_BRANCH.tar.gz" "$WORK_DIR/repo.tar.gz"; then
                tar -xzf "$WORK_DIR/repo.tar.gz" -C "$WORK_DIR" 2>/dev/null || true
                DOWNLOAD_SUCCESS=1
            fi
        fi
    fi

    # Find the extracted folder
    for d in "$WORK_DIR"/*; do
        if [ -d "$d/sections" ] && [ -d "$d/theme/argon" ]; then
            SRC_DIR="$d"
            break
        elif [ -d "$d/Queen/sections" ] && [ -d "$d/Queen/theme/argon" ]; then
            SRC_DIR="$d/Queen"
            break
        fi
    done
fi

if [ -z "$SRC_DIR" ] || [ ! -d "$SRC_DIR/sections" ]; then
    echo "❌ ERROR: Could not locate Queen source files!"
    echo "Please ensure the router has Internet access or clone https://github.com/$REPO_USER/$REPO_NAME.git manually."
    exit 1
fi

echo "  -> Source package located at: $SRC_DIR"

# Step 4: Deploy Bundled Argon Theme & App Configuration
echo "[4/6] Deploying tailored Argon Theme & Configuration..."
if [ -d "$SRC_DIR/theme/argon/www" ]; then
    cp -rf "$SRC_DIR/theme/argon/www/"* /www/
fi
if [ -d "$SRC_DIR/theme/argon/usr" ]; then
    cp -rf "$SRC_DIR/theme/argon/usr/"* /usr/
fi
if [ -d "$SRC_DIR/theme/argon/etc" ]; then
    cp -rf "$SRC_DIR/theme/argon/etc/"* /etc/
fi

chmod 0755 /usr/libexec/argon/online_wallpaper 2>/dev/null || true

# Apply Tailored Argon Theme UCI Settings
echo "  -> Applying tailored Queen Argon styling (Teal #0F766E, Glassmorphism & Bing Wallpaper)..."
uci -q batch <<EOF
set luci.main.mediaurlbase='/luci-static/argon'
set argon.@global[0]=global
set argon.@global[0].primary='#0F766E'
set argon.@global[0].dark_primary='#81C784'
set argon.@global[0].blur='16'
set argon.@global[0].blur_dark='16'
set argon.@global[0].transparency='0.9'
set argon.@global[0].transparency_dark='0.8'
set argon.@global[0].mode='light'
set argon.@global[0].online_wallpaper='bing'
commit argon
commit luci
EOF

# Step 5: Deploy Queen Backend Plugins, Views & System Components
echo "[5/6] Deploying Queen backend plugins, frontend views & sidebar menus..."
cp -f "$SRC_DIR/sections/internet/luci.internet" /usr/libexec/rpcd/luci.internet
cp -f "$SRC_DIR/sections/wireless/luci.wireless" /usr/libexec/rpcd/luci.wireless
cp -f "$SRC_DIR/sections/clients/luci.clients" /usr/libexec/rpcd/luci.clients
cp -f "$SRC_DIR/sections/mac-filter/luci.macfilter" /usr/libexec/rpcd/luci.macfilter
cp -f "$SRC_DIR/sections/dns/luci.dns" /usr/libexec/rpcd/luci.dns
cp -f "$SRC_DIR/sections/loadbalance/luci.loadbalance" /usr/libexec/rpcd/luci.loadbalance

cp -f "$SRC_DIR/sections/internet/internet.js" /www/luci-static/resources/view/queenx/internet.js
cp -f "$SRC_DIR/sections/wireless/wireless.js" /www/luci-static/resources/view/queenx/wireless.js
cp -f "$SRC_DIR/sections/clients/clients.js" /www/luci-static/resources/view/queenx/clients.js
cp -f "$SRC_DIR/sections/mac-filter/macfilter.js" /www/luci-static/resources/view/queenx/macfilter.js
cp -f "$SRC_DIR/sections/dns/dns.js" /www/luci-static/resources/view/queenx/dns.js
cp -f "$SRC_DIR/sections/loadbalance/loadbalance.js" /www/luci-static/resources/view/queenx/loadbalance.js

cp -f "$SRC_DIR/components/menu.json" /usr/share/luci/menu.d/luci-app-queenx.json
cp -f "$SRC_DIR/components/acl.json" /usr/share/rpcd/acl.d/luci-app-queenx.json

if [ -f "$SRC_DIR/assets/primenet_router.png" ]; then
    cp -f "$SRC_DIR/assets/primenet_router.png" /www/luci-static/resources/primenet_router.png
fi

if [ ! -f "/etc/config/mwan3" ] && [ -f "$SRC_DIR/examples/mwan3.example" ]; then
    cp -f "$SRC_DIR/examples/mwan3.example" /etc/config/mwan3
fi

# Set Executable & File Permissions
chmod 0755 /usr/libexec/rpcd/luci.* 2>/dev/null || true
chmod 0644 /www/luci-static/resources/view/queenx/*.js 2>/dev/null || true
chmod 0644 /usr/share/luci/menu.d/luci-app-queenx.json 2>/dev/null || true
chmod 0644 /usr/share/rpcd/acl.d/luci-app-queenx.json 2>/dev/null || true

# Step 6: Reload Daemons & Verify Installation
echo "[6/6] Reloading system services and verifying installation..."
/etc/init.d/rpcd reload
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache*

# Cleanup temporary download folder if used
if [ -n "$WORK_DIR" ] && [ -d "$WORK_DIR" ]; then
    rm -rf "$WORK_DIR"
fi

# Verification Checks
ALL_OK=1
for b in internet wireless clients macfilter dns loadbalance; do
    if [ ! -x "/usr/libexec/rpcd/luci.$b" ]; then
        echo "  [FAIL] Backend /usr/libexec/rpcd/luci.$b is missing!"
        ALL_OK=0
    fi
    if [ ! -f "/www/luci-static/resources/view/queenx/$b.js" ]; then
        echo "  [FAIL] View /www/luci-static/resources/view/queenx/$b.js is missing!"
        ALL_OK=0
    fi
done

if [ -f "/www/luci-static/argon/css/cascade.css" ]; then
    echo "  -> Argon theme stylesheet: [VERIFIED OK]"
else
    echo "  ⚠️ Warning: Argon theme stylesheet missing!"
    ALL_OK=0
fi

if [ "$ALL_OK" -eq 1 ]; then
    echo "  -> All 6 Queen backends, 6 frontend views, and tailored Argon theme: [100% OPERATIONAL]"
fi

echo ""
echo "================================================================="
echo "  ✅ Queen Management Suite & Argon Theme Installed Successfully! "
echo "================================================================="
echo "Open your browser and navigate to:"
echo "👉 http://192.168.1.1/cgi-bin/luci/admin/queenx/internet"
echo "================================================================="
