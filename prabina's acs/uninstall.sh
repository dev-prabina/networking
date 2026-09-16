#!/bin/sh
# prabina's acs - Safe Uninstallation Script
# Removes ONLY prabina's acs files and configuration, leaves all router settings intact

echo "=== Uninstalling prabina's acs ==="

rm -f /etc/config/prabina_acs
rm -f /usr/bin/prabina-acs-status
rm -f /usr/bin/prabina-acs-mac
rm -f /usr/bin/prabina-acs-ssh
rm -f /usr/bin/prabina-acs-uninstall
rm -f /usr/libexec/rpcd/luci.prabina_acs
rm -f /usr/share/rpcd/acl.d/luci-app-prabina-acs.json
rm -f /usr/share/luci/menu.d/luci-app-prabina-acs.json
rm -f /usr/lib/lua/luci/controller/prabina_acs.lua
rm -rf /www/luci-static/resources/prabina-acs
rm -rf /www/luci-static/resources/view/prabina-acs
rm -rf /www/prabina-acs
rm -f /var/run/prabina_acs_*

/etc/init.d/rpcd restart >/dev/null 2>&1 || true
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache*

echo "=== prabina's acs uninstalled cleanly. ==="
