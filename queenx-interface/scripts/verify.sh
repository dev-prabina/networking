#!/bin/sh
# Queen Suite & Argon Theme — Verification & Health Check Script
echo "=================================================="
echo "  👑 Running Queen Management Suite Health Check  "
echo "=================================================="

# 1. Check RPCD Backend Plugins
echo -n "Checking RPCD backends: "
RPCD_ALL_OK=1
for b in internet wireless clients macfilter dns loadbalance; do
    if ubus list "luci.$b" >/dev/null 2>&1; then
        echo -n "$b [OK] "
    else
        echo -n "$b [FAIL] "
        RPCD_ALL_OK=0
    fi
done
echo ""

# 2. Check LuCI Frontend Views
echo -n "Checking LuCI Views: "
VIEW_ALL_OK=1
for v in internet wireless clients macfilter dns loadbalance; do
    if [ -f "/www/luci-static/resources/view/queenx/$v.js" ]; then
        echo -n "$v.js [OK] "
    else
        echo -n "$v.js [MISSING] "
        VIEW_ALL_OK=0
    fi
done
echo ""

# 3. Check Menu & ACL Registrations
echo -n "Checking Menu & ACL: "
if [ -f "/usr/share/luci/menu.d/luci-app-queenx.json" ] && [ -f "/usr/share/rpcd/acl.d/luci-app-queenx.json" ]; then
    echo "Menu & ACL [OK]"
else
    echo "Menu or ACL [MISSING]"
fi

# 4. Check Argon Theme
echo -n "Checking Argon Theme: "
if [ -f "/www/luci-static/argon/css/cascade.css" ] && uci -q get luci.main.mediaurlbase | grep -q 'argon'; then
    echo "Argon [ACTIVE & VERIFIED]"
else
    echo "Argon [NOT FOUND]"
fi

echo "=================================================="
if [ "$RPCD_ALL_OK" -eq 1 ] && [ "$VIEW_ALL_OK" -eq 1 ]; then
    echo "  ✅ All Queen suite components are operational! "
else
    echo "  ⚠️ Some Queen components require attention."
fi
echo "=================================================="
