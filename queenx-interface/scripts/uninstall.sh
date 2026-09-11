#!/bin/sh
# Queen Suite — Safe Uninstaller & Rollback Script
set -e

echo "=================================================="
echo "  👑 Uninstalling Queen Management Suite          "
echo "=================================================="

# 1. Restore standard network interfaces if modified
echo "[1/4] Restoring network interface configuration..."
uci -q batch <<EOF
del network.wan2
set network.@device[0].ports='lan1' 'lan2' 'lan3' 'lan4'
commit network
EOF
/etc/init.d/network reload 2>/dev/null || true

# 2. Remove frontend views and backend plugins
echo "[2/4] Removing Queen frontend views and RPCD backend plugins..."
rm -rf /www/luci-static/resources/view/queenx
rm -f /usr/libexec/rpcd/luci.internet
rm -f /usr/libexec/rpcd/luci.wireless
rm -f /usr/libexec/rpcd/luci.clients
rm -f /usr/libexec/rpcd/luci.macfilter
rm -f /usr/libexec/rpcd/luci.dns
rm -f /usr/libexec/rpcd/luci.loadbalance
rm -f /etc/config/loadbalance
rm -f /etc/loadbalance_usage.json
rm -f /www/luci-static/resources/primenet_router.png

# 3. Remove Menu & ACL
echo "[3/4] Removing Menu and ACL entries..."
rm -f /usr/share/luci/menu.d/luci-app-queenx.json
rm -f /usr/share/rpcd/acl.d/luci-app-queenx.json

# 4. Reload RPCD & Clear LuCI Cache
echo "[4/4] Reloading daemons and flushing LuCI cache..."
/etc/init.d/rpcd reload
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache*

echo "=================================================="
echo "  ✅ Queen Suite Uninstalled Successfully!        "
echo "  Standard LuCI interface has been restored.      "
echo "=================================================="
