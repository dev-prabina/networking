#!/bin/sh
# ================================================================
# Queen Management Suite & Argon Theme
# Complete Automated OpenWrt Installer
#
# GitHub:
# https://github.com/dev-prabina/networking
#
# Queen source:
# https://github.com/dev-prabina/networking/tree/main/queenx-interface
#
# Supports:
# - OpenWrt 24.x (opkg)
# - OpenWrt 25.x (apk)
# - ARM / ARM64 / x86 / MIPS
# ================================================================

REPO_USER="dev-prabina"
REPO_NAME="networking"
REPO_BRANCH="main"

GITHUB_REPO="https://github.com/$REPO_USER/$REPO_NAME"
GITHUB_ARCHIVE="https://github.com/$REPO_USER/$REPO_NAME/archive/refs/heads/$REPO_BRANCH.tar.gz"
CODELOAD_ARCHIVE="https://codeload.github.com/$REPO_USER/$REPO_NAME/tar.gz/refs/heads/$REPO_BRANCH"

WORK_DIR=""
SRC_DIR=""

echo "================================================================="
echo "  👑 Queen Management Suite Installer"
echo "================================================================="
echo "  Repository : $GITHUB_REPO"
echo "  Branch     : $REPO_BRANCH"
echo "================================================================="
echo ""

# ------------------------------------------------
# Helper: download file
# Tries wget first, then uclient-fetch, then curl
# ------------------------------------------------
download_file() {
    _url="$1"
    _dest="$2"

    rm -f "$_dest" 2>/dev/null || true

    if command -v wget >/dev/null 2>&1; then
        if wget -q --no-check-certificate -O "$_dest" "$_url" 2>/dev/null; then
            [ -s "$_dest" ] && return 0
        elif wget -q -O "$_dest" "$_url" 2>/dev/null; then
            [ -s "$_dest" ] && return 0
        fi
    fi

    if command -v uclient-fetch >/dev/null 2>&1; then
        if uclient-fetch --no-check-certificate -q -O "$_dest" "$_url" 2>/dev/null; then
            [ -s "$_dest" ] && return 0
        elif uclient-fetch -q -O "$_dest" "$_url" 2>/dev/null; then
            [ -s "$_dest" ] && return 0
        fi
    fi

    if command -v curl >/dev/null 2>&1; then
        if curl -fsSL -k -o "$_dest" "$_url" 2>/dev/null; then
            [ -s "$_dest" ] && return 0
        fi
    fi

    return 1
}

# ------------------------------------------------
# Helper: cleanup temporary files
# ------------------------------------------------
cleanup() {
    if [ -n "$WORK_DIR" ] && [ -d "$WORK_DIR" ]; then
        rm -rf "$WORK_DIR" 2>/dev/null || true
    fi
}

trap cleanup EXIT INT TERM HUP

# ------------------------------------------------
# Step 1 - Detect Queen source directory
# ------------------------------------------------
echo "[1/6] Locating Queen source files..."

# Check if script is run locally from an existing filesystem path
if [ -n "$0" ] && [ -f "$0" ]; then
    _script_dir="$(cd "$(dirname "$0")" 2>/dev/null && pwd || true)"
    if [ -n "$_script_dir" ]; then
        if [ -d "$_script_dir/../sections" ] && [ -f "$_script_dir/../sections/internet/luci.internet" ]; then
            SRC_DIR="$(cd "$_script_dir/.." 2>/dev/null && pwd || true)"
        elif [ -d "$_script_dir/sections" ] && [ -f "$_script_dir/sections/internet/luci.internet" ]; then
            SRC_DIR="$_script_dir"
        elif [ -d "$_script_dir/queenx-interface/sections" ] && [ -f "$_script_dir/queenx-interface/sections/internet/luci.internet" ]; then
            SRC_DIR="$(cd "$_script_dir/queenx-interface" 2>/dev/null && pwd || true)"
        fi
    fi
fi

# If not found via $0, inspect current working directory
if [ -z "$SRC_DIR" ]; then
    if [ -d "./sections" ] && [ -f "./sections/internet/luci.internet" ]; then
        SRC_DIR="$(pwd)"
    elif [ -d "./queenx-interface/sections" ] && [ -f "./queenx-interface/sections/internet/luci.internet" ]; then
        SRC_DIR="$(cd "./queenx-interface" 2>/dev/null && pwd || true)"
    fi
fi

# Remote installation mode (piped via wget/curl | sh)
if [ -z "$SRC_DIR" ]; then
    echo "  -> Remote execution detected."
    echo "  -> Downloading networking repository archive..."

    WORK_DIR="/tmp/queenx_installer_$$"
    rm -rf "$WORK_DIR" 2>/dev/null || true
    mkdir -p "$WORK_DIR"

    ARCHIVE_FILE="$WORK_DIR/networking.tar.gz"

    DOWNLOAD_SUCCESS=0
    if download_file "$GITHUB_ARCHIVE" "$ARCHIVE_FILE"; then
        DOWNLOAD_SUCCESS=1
    elif download_file "$CODELOAD_ARCHIVE" "$ARCHIVE_FILE"; then
        DOWNLOAD_SUCCESS=1
    fi

    if [ "$DOWNLOAD_SUCCESS" -ne 1 ]; then
        echo ""
        echo "================================================================="
        echo "  ❌ ERROR: Could not download repository archive."
        echo "================================================================="
        echo "  Attempted URLs:"
        echo "  - $GITHUB_ARCHIVE"
        echo "  - $CODELOAD_ARCHIVE"
        echo ""
        echo "  Please check your router's Internet connection, DNS, and SSL support."
        echo "================================================================="
        exit 1
    fi

    echo "  -> Extracting repository archive..."
    if ! tar -xzf "$ARCHIVE_FILE" -C "$WORK_DIR" 2>/dev/null; then
        if command -v gzip >/dev/null 2>&1; then
            if ! (gzip -dc "$ARCHIVE_FILE" | tar -xf - -C "$WORK_DIR" 2>/dev/null); then
                echo "  ❌ ERROR: Failed to extract archive with gzip/tar."
                exit 1
            fi
        else
            echo "  ❌ ERROR: Failed to extract repository archive."
            exit 1
        fi
    fi

    # Automatically and dynamically locate queenx-interface
    for cand in \
        "$WORK_DIR"/*/queenx-interface \
        "$WORK_DIR"/*/*/queenx-interface \
        "$WORK_DIR"/queenx-interface \
        "$WORK_DIR"/*; do
        if [ -d "$cand/sections" ] && [ -f "$cand/sections/internet/luci.internet" ]; then
            SRC_DIR="$cand"
            break
        fi
    done

    # Fallback recursive search if directory nesting varies
    if [ -z "$SRC_DIR" ]; then
        _cand="$(find "$WORK_DIR" -type f -name "luci.internet" 2>/dev/null | head -n 1)"
        if [ -n "$_cand" ]; then
            _cand_dir="$(cd "$(dirname "$_cand")/../.." 2>/dev/null && pwd || true)"
            if [ -d "$_cand_dir/sections" ]; then
                SRC_DIR="$_cand_dir"
            fi
        fi
    fi
fi

# Verify Queen source directory was resolved
if [ -z "$SRC_DIR" ] || [ ! -d "$SRC_DIR/sections" ]; then
    echo ""
    echo "================================================================="
    echo "  ❌ ERROR: Queen source directory could not be located."
    echo "================================================================="
    echo "  Expected repository structure:"
    echo "  networking/"
    echo "  └── queenx-interface/"
    echo "      ├── sections/"
    echo "      ├── components/"
    echo "      ├── assets/"
    echo "      ├── theme/"
    echo "      └── examples/"
    echo "================================================================="
    exit 1
fi

echo "  -> Queen source package located at:"
echo "     $SRC_DIR"

# Verify all required repository files exist before modifying system
MISSING_SOURCE_FILES=0
check_source_file() {
    _rel="$1"
    if [ ! -f "$SRC_DIR/$_rel" ]; then
        echo "  ❌ MISSING REQUIRED SOURCE: $SRC_DIR/$_rel"
        MISSING_SOURCE_FILES=1
    fi
}

check_source_file "sections/internet/luci.internet"
check_source_file "sections/wireless/luci.wireless"
check_source_file "sections/clients/luci.clients"
check_source_file "sections/mac-filter/luci.macfilter"
check_source_file "sections/dns/luci.dns"
check_source_file "sections/loadbalance/luci.loadbalance"

check_source_file "sections/internet/internet.js"
check_source_file "sections/wireless/wireless.js"
check_source_file "sections/clients/clients.js"
check_source_file "sections/mac-filter/macfilter.js"
check_source_file "sections/dns/dns.js"
check_source_file "sections/loadbalance/loadbalance.js"

check_source_file "components/menu.json"
check_source_file "components/acl.json"

if [ "$MISSING_SOURCE_FILES" -ne 0 ]; then
    echo ""
    echo "================================================================="
    echo "  ❌ ERROR: One or more required Queen source files are missing!"
    echo "  Aborting installation."
    echo "================================================================="
    exit 1
fi

echo ""

# ------------------------------------------------
# Step 2 - Package manager & dependencies
# ------------------------------------------------
echo "[2/6] Detecting package manager and installing dependencies..."

if command -v apk >/dev/null 2>&1; then
    echo "  -> OpenWrt 25.x (apk) detected."
    echo "  -> Updating package lists..."
    apk update >/dev/null 2>&1 || true

    echo "  -> Installing core dependencies..."
    apk add \
        ucode \
        ucode-mod-fs \
        ucode-mod-uci \
        ucode-mod-ubus \
        iwinfo \
        wget \
        tar \
        gzip \
        ca-certificates \
        >/dev/null 2>&1 || true

    # Optional packages
    apk add curl >/dev/null 2>&1 || true

    echo "  -> Checking optional multi-WAN support (mwan3)..."
    apk add mwan3 >/dev/null 2>&1 || true
    if command -v mwan3 >/dev/null 2>&1 || [ -x /usr/sbin/mwan3 ] || [ -f /etc/init.d/mwan3 ]; then
        echo "  -> [OK] mwan3 installed successfully."
    else
        echo "  -> Notice: mwan3 package unavailable or not installed (optional)."
    fi

elif command -v opkg >/dev/null 2>&1; then
    echo "  -> OpenWrt 24.x (opkg) detected."
    echo "  -> Updating package lists..."
    opkg update >/dev/null 2>&1 || true

    echo "  -> Installing core dependencies..."
    opkg install \
        ucode \
        ucode-mod-fs \
        ucode-mod-uci \
        ucode-mod-ubus \
        iwinfo \
        wget \
        tar \
        gzip \
        ca-certificates \
        >/dev/null 2>&1 || true

    # Optional packages
    opkg install curl >/dev/null 2>&1 || true

    echo "  -> Checking optional multi-WAN support (mwan3)..."
    opkg install mwan3 >/dev/null 2>&1 || true
    if command -v mwan3 >/dev/null 2>&1 || [ -x /usr/sbin/mwan3 ] || [ -f /etc/init.d/mwan3 ]; then
        echo "  -> [OK] mwan3 installed successfully."
    else
        echo "  -> Notice: mwan3 package unavailable or not installed (optional)."
    fi
else
    echo "  ⚠️ Warning: Neither apk nor opkg package manager found."
fi

echo ""

# ------------------------------------------------
# Step 3 - Prepare destination directories
# ------------------------------------------------
echo "[3/6] Preparing destination directories..."

mkdir -p /usr/libexec/rpcd
mkdir -p /usr/libexec/argon
mkdir -p /www/luci-static/resources/view/queenx
mkdir -p /www/luci-static/argon
mkdir -p /usr/share/luci/menu.d
mkdir -p /usr/share/rpcd/acl.d
mkdir -p /etc/config

echo ""

# ------------------------------------------------
# Step 4 - Install bundled Argon theme & styling
# ------------------------------------------------
echo "[4/6] Installing Argon theme and styling..."

if [ -d "$SRC_DIR/theme/argon" ]; then
    echo "  -> Copying bundled Argon theme assets..."
    if [ -d "$SRC_DIR/theme/argon/www" ]; then
        cp -rf "$SRC_DIR/theme/argon/www/." /www/
    fi
    if [ -d "$SRC_DIR/theme/argon/usr" ]; then
        cp -rf "$SRC_DIR/theme/argon/usr/." /usr/
    fi
    if [ -d "$SRC_DIR/theme/argon/etc" ]; then
        cp -rf "$SRC_DIR/theme/argon/etc/." /etc/
    fi

    if [ -f "/usr/libexec/argon/online_wallpaper" ]; then
        chmod 0755 /usr/libexec/argon/online_wallpaper 2>/dev/null || true
    fi
    if [ -f "/etc/uci-defaults/30_luci-theme-argon" ]; then
        chmod 0755 /etc/uci-defaults/30_luci-theme-argon 2>/dev/null || true
    fi
    if [ -f "/etc/uci-defaults/luci-argon-config" ]; then
        chmod 0755 /etc/uci-defaults/luci-argon-config 2>/dev/null || true
    fi
else
    echo "  -> Notice: Bundled Argon theme not found; skipping theme file copy."
fi

# Apply tailored Queen Argon theme configuration
if command -v uci >/dev/null 2>&1; then
    echo "  -> Applying Queen Argon theme configuration..."

    [ -f /etc/config/luci ] || touch /etc/config/luci
    if [ ! -f /etc/config/argon ]; then
        cat <<'EOF' > /etc/config/argon
config global
EOF
    elif ! grep -q "config global" /etc/config/argon 2>/dev/null; then
        echo "config global" >> /etc/config/argon
    fi

    uci -q batch <<'EOF'
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
fi

echo ""

# ------------------------------------------------
# Step 5 - Install Queen backend plugins and views
# ------------------------------------------------
echo "[5/6] Installing Queen backend plugins, views, and components..."

# Backend RPCD plugins -> /usr/libexec/rpcd/
cp -f "$SRC_DIR/sections/internet/luci.internet" /usr/libexec/rpcd/luci.internet
chmod 0755 /usr/libexec/rpcd/luci.internet
echo "  -> Installed luci.internet"

cp -f "$SRC_DIR/sections/wireless/luci.wireless" /usr/libexec/rpcd/luci.wireless
chmod 0755 /usr/libexec/rpcd/luci.wireless
echo "  -> Installed luci.wireless"

cp -f "$SRC_DIR/sections/clients/luci.clients" /usr/libexec/rpcd/luci.clients
chmod 0755 /usr/libexec/rpcd/luci.clients
echo "  -> Installed luci.clients"

cp -f "$SRC_DIR/sections/mac-filter/luci.macfilter" /usr/libexec/rpcd/luci.macfilter
chmod 0755 /usr/libexec/rpcd/luci.macfilter
echo "  -> Installed luci.macfilter"

cp -f "$SRC_DIR/sections/dns/luci.dns" /usr/libexec/rpcd/luci.dns
chmod 0755 /usr/libexec/rpcd/luci.dns
echo "  -> Installed luci.dns"

cp -f "$SRC_DIR/sections/loadbalance/luci.loadbalance" /usr/libexec/rpcd/luci.loadbalance
chmod 0755 /usr/libexec/rpcd/luci.loadbalance
echo "  -> Installed luci.loadbalance"

# Frontend views -> /www/luci-static/resources/view/queenx/
cp -f "$SRC_DIR/sections/internet/internet.js" /www/luci-static/resources/view/queenx/internet.js
chmod 0644 /www/luci-static/resources/view/queenx/internet.js
echo "  -> Installed internet.js"

cp -f "$SRC_DIR/sections/wireless/wireless.js" /www/luci-static/resources/view/queenx/wireless.js
chmod 0644 /www/luci-static/resources/view/queenx/wireless.js
echo "  -> Installed wireless.js"

cp -f "$SRC_DIR/sections/clients/clients.js" /www/luci-static/resources/view/queenx/clients.js
chmod 0644 /www/luci-static/resources/view/queenx/clients.js
echo "  -> Installed clients.js"

cp -f "$SRC_DIR/sections/mac-filter/macfilter.js" /www/luci-static/resources/view/queenx/macfilter.js
chmod 0644 /www/luci-static/resources/view/queenx/macfilter.js
echo "  -> Installed macfilter.js"

cp -f "$SRC_DIR/sections/dns/dns.js" /www/luci-static/resources/view/queenx/dns.js
chmod 0644 /www/luci-static/resources/view/queenx/dns.js
echo "  -> Installed dns.js"

cp -f "$SRC_DIR/sections/loadbalance/loadbalance.js" /www/luci-static/resources/view/queenx/loadbalance.js
chmod 0644 /www/luci-static/resources/view/queenx/loadbalance.js
echo "  -> Installed loadbalance.js"

# Menu -> /usr/share/luci/menu.d/luci-app-queenx.json
cp -f "$SRC_DIR/components/menu.json" /usr/share/luci/menu.d/luci-app-queenx.json
chmod 0644 /usr/share/luci/menu.d/luci-app-queenx.json
echo "  -> Installed Queen menu configuration."

# ACL -> /usr/share/rpcd/acl.d/luci-app-queenx.json
cp -f "$SRC_DIR/components/acl.json" /usr/share/rpcd/acl.d/luci-app-queenx.json
chmod 0644 /usr/share/rpcd/acl.d/luci-app-queenx.json
echo "  -> Installed Queen ACL configuration."

# Router hardware visualizer asset
if [ -f "$SRC_DIR/assets/primenet_router.png" ]; then
    cp -f "$SRC_DIR/assets/primenet_router.png" /www/luci-static/resources/primenet_router.png
    chmod 0644 /www/luci-static/resources/primenet_router.png
    echo "  -> Installed router hardware asset."
fi

# Multi-WAN example configuration
if [ -f "$SRC_DIR/examples/mwan3.example" ] && [ ! -f "/etc/config/mwan3" ]; then
    cp -f "$SRC_DIR/examples/mwan3.example" /etc/config/mwan3
    chmod 0644 /etc/config/mwan3
    echo "  -> Installed mwan3 example configuration."
fi

echo ""

# ------------------------------------------------
# Step 6 - Reload services and clear cache
# ------------------------------------------------
echo "[6/6] Reloading system services and clearing LuCI cache..."

if [ -x "/etc/init.d/rpcd" ]; then
    /etc/init.d/rpcd restart 2>/dev/null || /etc/init.d/rpcd reload 2>/dev/null || true
fi

if [ -x "/etc/init.d/uhttpd" ]; then
    /etc/init.d/uhttpd restart 2>/dev/null || /etc/init.d/uhttpd reload 2>/dev/null || true
fi

if [ -x "/etc/init.d/nginx" ]; then
    /etc/init.d/nginx restart 2>/dev/null || /etc/init.d/nginx reload 2>/dev/null || true
fi

# Clear LuCI template and module cache
rm -rf \
    /tmp/luci-indexcache* \
    /tmp/luci-modulecache* \
    /var/luci-indexcache* \
    /var/luci-modulecache* \
    2>/dev/null || true

# ------------------------------------------------
# Strong Post-Installation Verification
# ------------------------------------------------
echo ""
echo "================================================================="
echo "  Queen Installation Verification"
echo "================================================================="

ALL_OK=1

check_target_executable() {
    _file="$1"
    _name="$2"
    if [ -x "$_file" ]; then
        echo "  [OK] $_name"
    else
        echo "  [FAIL] $_name ($_file missing or not executable)"
        ALL_OK=0
    fi
}

check_target_file() {
    _file="$1"
    _name="$2"
    if [ -f "$_file" ]; then
        echo "  [OK] $_name"
    else
        echo "  [FAIL] $_name ($_file missing)"
        ALL_OK=0
    fi
}

# Backends
check_target_executable "/usr/libexec/rpcd/luci.internet" "Internet backend"
check_target_executable "/usr/libexec/rpcd/luci.wireless" "Wireless backend"
check_target_executable "/usr/libexec/rpcd/luci.clients" "Clients backend"
check_target_executable "/usr/libexec/rpcd/luci.macfilter" "MAC Filter backend"
check_target_executable "/usr/libexec/rpcd/luci.dns" "DNS backend"
check_target_executable "/usr/libexec/rpcd/luci.loadbalance" "Load Balancing backend"

# Frontend views
check_target_file "/www/luci-static/resources/view/queenx/internet.js" "Internet view"
check_target_file "/www/luci-static/resources/view/queenx/wireless.js" "Wireless view"
check_target_file "/www/luci-static/resources/view/queenx/clients.js" "Clients view"
check_target_file "/www/luci-static/resources/view/queenx/macfilter.js" "MAC Filter view"
check_target_file "/www/luci-static/resources/view/queenx/dns.js" "DNS view"
check_target_file "/www/luci-static/resources/view/queenx/loadbalance.js" "Load Balancing view"

# Menu & ACL
check_target_file "/usr/share/luci/menu.d/luci-app-queenx.json" "Queen menu"
check_target_file "/usr/share/rpcd/acl.d/luci-app-queenx.json" "Queen ACL"

# Argon theme stylesheet
if [ -f "/www/luci-static/argon/css/cascade.css" ]; then
    echo "  [OK] Argon theme stylesheet"
else
    echo "  [FAIL] Argon theme stylesheet (/www/luci-static/argon/css/cascade.css missing)"
    ALL_OK=0
fi

echo ""

if [ "$ALL_OK" -eq 1 ]; then
    echo "================================================================="
    echo "  ✅ Queen installed successfully!"
    echo "================================================================="
    echo ""
    echo "  Access Queen interface in your browser at:"
    echo "  http://192.168.1.1/cgi-bin/luci/admin/queenx/internet"
    echo ""
    echo "================================================================="
    exit 0
else
    echo "================================================================="
    echo "  ❌ Queen installation finished with errors."
    echo "================================================================="
    echo "  Source used: $SRC_DIR"
    echo "  Please check the failed components above."
    echo "================================================================="
    exit 1
fi
