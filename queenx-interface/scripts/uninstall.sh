#!/bin/sh
# ================================================================
# Queen Management Suite — Safe Uninstaller & Rollback Script
#
# GitHub:
# https://github.com/dev-prabina/networking
# ================================================================

echo "================================================================="
echo "  👑 Uninstalling Queen Management Suite"
echo "================================================================="

# ------------------------------------------------
# Step 1 - Revert network interface if modified
# ------------------------------------------------
echo "[1/4] Restoring network interface configuration..."
if command -v uci >/dev/null 2>&1; then
    if uci -q get network.wan2 >/dev/null 2>&1; then
        echo "  -> Removing WAN2 secondary uplink configuration..."
        uci -q delete network.wan2 || true
        uci -q commit network || true
        if [ -x "/etc/init.d/network" ]; then
            /etc/init.d/network reload 2>/dev/null || true
        fi
    fi

    # Reset LuCI theme back to default Bootstrap
    echo "  -> Restoring standard LuCI theme..."
    uci -q set luci.main.mediaurlbase='/luci-static/bootstrap' 2>/dev/null || true
    uci -q commit luci 2>/dev/null || true
fi

# ------------------------------------------------
# Step 2 - Remove frontend views & backend plugins
# ------------------------------------------------
echo "[2/4] Removing Queen frontend views and RPCD backend plugins..."

# Frontend views
rm -rf /www/luci-static/resources/view/queenx 2>/dev/null || true

# Backend plugins
rm -f /usr/libexec/rpcd/luci.internet 2>/dev/null || true
rm -f /usr/libexec/rpcd/luci.wireless 2>/dev/null || true
rm -f /usr/libexec/rpcd/luci.clients 2>/dev/null || true
rm -f /usr/libexec/rpcd/luci.macfilter 2>/dev/null || true
rm -f /usr/libexec/rpcd/luci.dns 2>/dev/null || true
rm -f /usr/libexec/rpcd/luci.loadbalance 2>/dev/null || true

# Configurations and runtime data
rm -f /etc/config/loadbalance 2>/dev/null || true
rm -f /etc/loadbalance_usage.json 2>/dev/null || true
rm -f /www/luci-static/resources/primenet_router.png 2>/dev/null || true

# ------------------------------------------------
# Step 3 - Remove Menu & ACL registrations
# ------------------------------------------------
echo "[3/4] Removing Menu and ACL registrations..."
rm -f /usr/share/luci/menu.d/luci-app-queenx.json 2>/dev/null || true
rm -f /usr/share/rpcd/acl.d/luci-app-queenx.json 2>/dev/null || true

# ------------------------------------------------
# Step 4 - Reload daemons & flush LuCI cache
# ------------------------------------------------
echo "[4/4] Reloading system services and flushing cache..."

if [ -x "/etc/init.d/rpcd" ]; then
    /etc/init.d/rpcd restart 2>/dev/null || /etc/init.d/rpcd reload 2>/dev/null || true
fi

if [ -x "/etc/init.d/uhttpd" ]; then
    /etc/init.d/uhttpd restart 2>/dev/null || /etc/init.d/uhttpd reload 2>/dev/null || true
fi

if [ -x "/etc/init.d/nginx" ]; then
    /etc/init.d/nginx restart 2>/dev/null || /etc/init.d/nginx reload 2>/dev/null || true
fi

# Clear LuCI cache
rm -rf \
    /tmp/luci-indexcache* \
    /tmp/luci-modulecache* \
    /var/luci-indexcache* \
    /var/luci-modulecache* \
    /tmp/queenx_installer_* \
    2>/dev/null || true

echo ""
echo "================================================================="
echo "  ✅ Queen Suite Uninstalled Successfully!"
echo "  Standard LuCI interface has been restored."
echo "================================================================="
exit 0
