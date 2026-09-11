```sh
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

set -e

REPO_USER="dev-prabina"
REPO_NAME="networking"
REPO_BRANCH="main"

GITHUB_REPO="https://github.com/$REPO_USER/$REPO_NAME"
GITHUB_ARCHIVE="$GITHUB_REPO/archive/refs/heads/$REPO_BRANCH.tar.gz"

WORK_DIR="/tmp/queenx_installer_$$"
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
# ------------------------------------------------
download_file() {
    URL="$1"
    DEST="$2"

    if command -v wget >/dev/null 2>&1; then
        wget -q --no-check-certificate -O "$DEST" "$URL"
        return $?
    fi

    if command -v uclient-fetch >/dev/null 2>&1; then
        uclient-fetch --no-check-certificate -q -O "$DEST" "$URL"
        return $?
    fi

    if command -v curl >/dev/null 2>&1; then
        curl -fsSL -k -o "$DEST" "$URL"
        return $?
    fi

    return 1
}

# ------------------------------------------------
# Helper: cleanup
# ------------------------------------------------
cleanup() {
    rm -rf "$WORK_DIR" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# ------------------------------------------------
# Step 1 - Detect package manager
# ------------------------------------------------
echo "[1/6] Detecting OpenWrt package manager..."

if command -v apk >/dev/null 2>&1; then
    PKG="apk"
    echo "  -> OpenWrt apk package manager detected."
elif command -v opkg >/dev/null 2>&1; then
    PKG="opkg"
    echo "  -> OpenWrt opkg package manager detected."
else
    echo "  ❌ ERROR: Could not find apk or opkg."
    exit 1
fi

# ------------------------------------------------
# Step 1B - Install required packages
# ------------------------------------------------
echo "  -> Installing required packages..."

if [ "$PKG" = "apk" ]; then

    apk update >/dev/null 2>&1 || true

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
    apk add mwan3 >/dev/null 2>&1 || true

else

    opkg update >/dev/null 2>&1 || true

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
    opkg install mwan3 >/dev/null 2>&1 || true

fi

# ------------------------------------------------
# Step 2 - Prepare directories
# ------------------------------------------------
echo "[2/6] Preparing Queen directories..."

mkdir -p /usr/libexec/rpcd
mkdir -p /usr/libexec/argon

mkdir -p /www/luci-static/resources/view/queenx
mkdir -p /www/luci-static/argon

mkdir -p /usr/share/luci/menu.d
mkdir -p /usr/share/rpcd/acl.d

mkdir -p /etc/config

# ------------------------------------------------
# Step 3 - Find local source or download repository
# ------------------------------------------------
echo "[3/6] Locating Queen source files..."

# ------------------------------------------------
# A. Check when installer is executed locally
# ------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd || true)"

if [ -n "$SCRIPT_DIR" ]; then

    # scripts -> queenx-interface
    POSSIBLE_DIR="$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd || true)"

    if [ -d "$POSSIBLE_DIR/sections" ]; then
        SRC_DIR="$POSSIBLE_DIR"
    fi

fi

# Check current directory
if [ -z "$SRC_DIR" ] && [ -d "./sections" ]; then
    SRC_DIR="$(pwd)"
fi

# ------------------------------------------------
# B. Remote installation mode
# ------------------------------------------------
if [ -z "$SRC_DIR" ]; then

    echo "  -> Remote installation detected."
    echo "  -> Downloading networking repository..."

    rm -rf "$WORK_DIR"
    mkdir -p "$WORK_DIR"

    ARCHIVE="$WORK_DIR/networking.tar.gz"

    if ! download_file "$GITHUB_ARCHIVE" "$ARCHIVE"; then
        echo ""
        echo "  ❌ ERROR: Could not download repository."
        echo ""
        echo "  Repository:"
        echo "  $GITHUB_REPO"
        echo ""
        echo "  Check that the router has internet access."
        exit 1
    fi

    echo "  -> Extracting repository..."

    if ! tar -xzf "$ARCHIVE" -C "$WORK_DIR" 2>/dev/null; then
        echo ""
        echo "  ❌ ERROR: Could not extract repository archive."
        exit 1
    fi

    # ------------------------------------------------
    # Search for queenx-interface
    #
    # Expected:
    # /tmp/.../networking-main/queenx-interface
    # ------------------------------------------------
    FOUND_DIR=""

    for TOP in "$WORK_DIR"/*; do

        if [ -d "$TOP/queenx-interface" ]; then

            if [ -d "$TOP/queenx-interface/sections" ]; then
                FOUND_DIR="$TOP/queenx-interface"
                break
            fi

        fi

        # Also support direct root layouts
        if [ -d "$TOP/sections" ]; then
            FOUND_DIR="$TOP"
            break
        fi

    done

    # Extra fallback search
    if [ -z "$FOUND_DIR" ]; then

        for D in "$WORK_DIR"/*/queenx-interface "$WORK_DIR"/*/Queen "$WORK_DIR"/*; do

            if [ -d "$D/sections" ]; then
                FOUND_DIR="$D"
                break
            fi

        done

    fi

    if [ -n "$FOUND_DIR" ]; then
        SRC_DIR="$FOUND_DIR"
    fi

fi

# ------------------------------------------------
# Verify source
# ------------------------------------------------
if [ -z "$SRC_DIR" ]; then

    echo ""
    echo "================================================================="
    echo "❌ ERROR: Queen source directory was not found."
    echo "================================================================="
    echo ""
    echo "Expected structure:"
    echo ""
    echo "networking/"
    echo "└── queenx-interface/"
    echo "    ├── sections/"
    echo "    ├── components/"
    echo "    ├── assets/"
    echo "    ├── theme/"
    echo "    └── scripts/"
    echo ""

    exit 1

fi

if [ ! -d "$SRC_DIR/sections" ]; then

    echo ""
    echo "❌ ERROR: sections directory is missing:"
    echo "$SRC_DIR/sections"
    exit 1

fi

echo "  -> Queen source found:"
echo "     $SRC_DIR"

echo ""

# ------------------------------------------------
# Step 4 - Install Argon theme
# ------------------------------------------------
echo "[4/6] Installing Argon theme..."

if [ -d "$SRC_DIR/theme/argon" ]; then

    # WWW
    if [ -d "$SRC_DIR/theme/argon/www" ]; then
        cp -rf "$SRC_DIR/theme/argon/www/." /www/
    fi

    # USR
    if [ -d "$SRC_DIR/theme/argon/usr" ]; then
        cp -rf "$SRC_DIR/theme/argon/usr/." /usr/
    fi

    # ETC
    if [ -d "$SRC_DIR/theme/argon/etc" ]; then
        cp -rf "$SRC_DIR/theme/argon/etc/." /etc/
    fi

else

    echo "  -> Bundled Argon source not found."
    echo "  -> Continuing without bundled Argon files."

fi

# ------------------------------------------------
# Argon configuration
# ------------------------------------------------
if command -v uci >/dev/null 2>&1; then

    echo "  -> Applying Queen Argon configuration..."

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

fi

# Argon wallpaper permission
if [ -f "/usr/libexec/argon/online_wallpaper" ]; then
    chmod 0755 /usr/libexec/argon/online_wallpaper 2>/dev/null || true
fi

# ------------------------------------------------
# Step 5 - Install Queen components
# ------------------------------------------------
echo "[5/6] Installing Queen interface..."

install_backend() {

    SOURCE="$1"
    DEST="$2"

    if [ -f "$SOURCE" ]; then

        cp -f "$SOURCE" "$DEST"
        chmod 0755 "$DEST"

        echo "  -> Installed $(basename "$DEST")"

    else

        echo "  ⚠️ Missing backend:"
        echo "     $SOURCE"

    fi
}

install_view() {

    SOURCE="$1"
    DEST="$2"

    if [ -f "$SOURCE" ]; then

        cp -f "$SOURCE" "$DEST"
        chmod 0644 "$DEST"

        echo "  -> Installed $(basename "$DEST")"

    else

        echo "  ⚠️ Missing view:"
        echo "     $SOURCE"

    fi
}

# ------------------------------------------------
# Backend RPCD plugins
# ------------------------------------------------
install_backend \
    "$SRC_DIR/sections/internet/luci.internet" \
    "/usr/libexec/rpcd/luci.internet"

install_backend \
    "$SRC_DIR/sections/wireless/luci.wireless" \
    "/usr/libexec/rpcd/luci.wireless"

install_backend \
    "$SRC_DIR/sections/clients/luci.clients" \
    "/usr/libexec/rpcd/luci.clients"

install_backend \
    "$SRC_DIR/sections/mac-filter/luci.macfilter" \
    "/usr/libexec/rpcd/luci.macfilter"

install_backend \
    "$SRC_DIR/sections/dns/luci.dns" \
    "/usr/libexec/rpcd/luci.dns"

install_backend \
    "$SRC_DIR/sections/loadbalance/luci.loadbalance" \
    "/usr/libexec/rpcd/luci.loadbalance"

# ------------------------------------------------
# Frontend views
# ------------------------------------------------
install_view \
    "$SRC_DIR/sections/internet/internet.js" \
    "/www/luci-static/resources/view/queenx/internet.js"

install_view \
    "$SRC_DIR/sections/wireless/wireless.js" \
    "/www/luci-static/resources/view/queenx/wireless.js"

install_view \
    "$SRC_DIR/sections/clients/clients.js" \
    "/www/luci-static/resources/view/queenx/clients.js"

install_view \
    "$SRC_DIR/sections/mac-filter/macfilter.js" \
    "/www/luci-static/resources/view/queenx/macfilter.js"

install_view \
    "$SRC_DIR/sections/dns/dns.js" \
    "/www/luci-static/resources/view/queenx/dns.js"

install_view \
    "$SRC_DIR/sections/loadbalance/loadbalance.js" \
    "/www/luci-static/resources/view/queenx/loadbalance.js"

# ------------------------------------------------
# Menu
# ------------------------------------------------
if [ -f "$SRC_DIR/components/menu.json" ]; then

    cp -f \
        "$SRC_DIR/components/menu.json" \
        "/usr/share/luci/menu.d/luci-app-queenx.json"

    chmod 0644 \
        "/usr/share/luci/menu.d/luci-app-queenx.json"

    echo "  -> Installed Queen menu."

else

    echo "  ⚠️ menu.json not found."

fi

# ------------------------------------------------
# ACL
# ------------------------------------------------
if [ -f "$SRC_DIR/components/acl.json" ]; then

    cp -f \
        "$SRC_DIR/components/acl.json" \
        "/usr/share/rpcd/acl.d/luci-app-queenx.json"

    chmod 0644 \
        "/usr/share/rpcd/acl.d/luci-app-queenx.json"

    echo "  -> Installed Queen ACL."

else

    echo "  ⚠️ acl.json not found."

fi

# ------------------------------------------------
# Router image
# ------------------------------------------------
if [ -f "$SRC_DIR/assets/primenet_router.png" ]; then

    cp -f \
        "$SRC_DIR/assets/primenet_router.png" \
        "/www/luci-static/resources/primenet_router.png"

    chmod 0644 \
        "/www/luci-static/resources/primenet_router.png"

    echo "  -> Installed router image."

fi

# ------------------------------------------------
# mwan3 example
# ------------------------------------------------
if [ -f "$SRC_DIR/examples/mwan3.example" ]; then

    if [ ! -f "/etc/config/mwan3" ]; then

        cp -f \
            "$SRC_DIR/examples/mwan3.example" \
            "/etc/config/mwan3"

        echo "  -> Installed mwan3 example configuration."

    fi

fi

# ------------------------------------------------
# Step 6 - Reload LuCI / RPCD
# ------------------------------------------------
echo "[6/6] Reloading LuCI and RPCD..."

if [ -x "/etc/init.d/rpcd" ]; then
    /etc/init.d/rpcd reload 2>/dev/null || true
fi

if [ -x "/etc/init.d/uhttpd" ]; then
    /etc/init.d/uhttpd reload 2>/dev/null || true
fi

# Clear LuCI cache
rm -rf \
    /tmp/luci-indexcache* \
    /tmp/luci-modulecache* \
    2>/dev/null || true

# ------------------------------------------------
# Verification
# ------------------------------------------------
echo ""
echo "================================================================="
echo "  Queen Installation Verification"
echo "================================================================="

ALL_OK=1

check_file() {

    FILE="$1"
    NAME="$2"

    if [ -f "$FILE" ]; then
        echo "  [OK] $NAME"
    else
        echo "  [FAIL] $NAME"
        ALL_OK=0
    fi

}

check_executable() {

    FILE="$1"
    NAME="$2"

    if [ -x "$FILE" ]; then
        echo "  [OK] $NAME"
    else
        echo "  [FAIL] $NAME"
        ALL_OK=0
    fi

}

# Backends
check_executable \
    "/usr/libexec/rpcd/luci.internet" \
    "Internet backend"

check_executable \
    "/usr/libexec/rpcd/luci.wireless" \
    "Wireless backend"

check_executable \
    "/usr/libexec/rpcd/luci.clients" \
    "Clients backend"

check_executable \
    "/usr/libexec/rpcd/luci.macfilter" \
    "MAC Filter backend"

check_executable \
    "/usr/libexec/rpcd/luci.dns" \
    "DNS backend"

check_executable \
    "/usr/libexec/rpcd/luci.loadbalance" \
    "Load Balancing backend"

# Frontend
check_file \
    "/www/luci-static/resources/view/queenx/internet.js" \
    "Internet view"

check_file \
    "/www/luci-static/resources/view/queenx/wireless.js" \
    "Wireless view"

check_file \
    "/www/luci-static/resources/view/queenx/clients.js" \
    "Clients view"

check_file \
    "/www/luci-static/resources/view/queenx/macfilter.js" \
    "MAC Filter view"

check_file \
    "/www/luci-static/resources/view/queenx/dns.js" \
    "DNS view"

check_file \
    "/www/luci-static/resources/view/queenx/loadbalance.js" \
    "Load Balancing view"

# Menu
check_file \
    "/usr/share/luci/menu.d/luci-app-queenx.json" \
    "Queen menu"

# ACL
check_file \
    "/usr/share/rpcd/acl.d/luci-app-queenx.json" \
    "Queen ACL"

# Argon
if [ -f "/www/luci-static/argon/css/cascade.css" ]; then
    echo "  [OK] Argon theme"
else
    echo "  [WARN] Argon theme stylesheet not found"
fi

echo ""

if [ "$ALL_OK" -eq 1 ]; then

    echo "================================================================="
    echo "  ✅ Queen installed successfully!"
    echo "================================================================="
    echo ""
    echo "  Open:"
    echo "  http://192.168.1.1/cgi-bin/luci/admin/queenx/internet"
    echo ""

else

    echo "================================================================="
    echo "  ⚠️ Queen installation finished with errors."
    echo "================================================================="
    echo ""
    echo "  Source used:"
    echo "  $SRC_DIR"
    echo ""

    exit 1

fi

exit 0
```
