#!/bin/sh
# ==============================================================================
# atherBasic — Uninstaller / Restore Script
# Restores original backup created during installation
# ==============================================================================

set -e

BACKUP_DIR="/root/theme_backup_original"

echo "=========================================================="
echo "  Restoring original OpenWrt LuCI Theme                   "
echo "=========================================================="

if [ -d "$BACKUP_DIR" ]; then
    echo "Restoring from $BACKUP_DIR..."
    [ -d "$BACKUP_DIR/bootstrap" ] && cp -r "$BACKUP_DIR/bootstrap/"* /www/luci-static/bootstrap/ 2>/dev/null || true
    [ -d "$BACKUP_DIR/templates/bootstrap" ] && cp -r "$BACKUP_DIR/templates/bootstrap/"* /usr/share/ucode/luci/template/themes/bootstrap/ 2>/dev/null || true
    [ -f "$BACKUP_DIR/menu-bootstrap.js" ] && cp "$BACKUP_DIR/menu-bootstrap.js" /www/luci-static/resources/menu-bootstrap.js 2>/dev/null || true
    [ -d "$BACKUP_DIR/dashboard" ] && cp -r "$BACKUP_DIR/dashboard/"* /www/luci-static/resources/view/dashboard/ 2>/dev/null || true
    echo "Restored original files."
else
    echo "Backup directory not found. Re-installing default luci-theme-bootstrap via opkg..."
    opkg update && opkg install --force-reinstall luci-theme-bootstrap
fi

uci set luci.main.mediaurlbase='/luci-static/bootstrap' 2>/dev/null || true
uci commit luci 2>/dev/null || true
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache* /tmp/luci-sessions* 2>/dev/null || true

echo "=========================================================="
echo "  Original theme restored successfully.                   "
echo "=========================================================="