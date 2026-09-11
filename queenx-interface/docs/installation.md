# Installation & Deployment Guide

This guide provides detailed, reproducible installation instructions for deploying **Queen** and the tailored **Argon Theme** onto an OpenWrt router.

---

## ⚡ Quick Copy-Paste Install (1-Line)

SSH into your router terminal and paste:

```sh
sh -c "$(wget -qO- https://raw.githubusercontent.com/dev-prabina/openWRT/main/scripts/install.sh || curl -sSL https://raw.githubusercontent.com/dev-prabina/openWRT/main/scripts/install.sh)"
```

---

## 🎨 Argon Theme & Custom Configuration

Queen is designed to harmonize with the **Argon Theme**. The installer automatically applies the following tailored styling:

```uci
config global
	option primary '#0F766E'
	option dark_primary '#81C784'
	option blur '16'
	option blur_dark '16'
	option transparency '0.9'
	option transparency_dark '0.8'
	option mode 'light'
	option online_wallpaper 'bing'
```

### Standalone Argon Theme Setup (Copy & Paste)
```sh
# 1. Install packages
apk add luci-theme-argon luci-app-argon-config 2>/dev/null || (opkg update && opkg install luci-theme-argon luci-app-argon-config)

# 2. Configure colors & wallpaper
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

# 3. Clear cache
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache*
```

---

## 📂 Methodical Step-by-Step Installation

If you prefer to manually place and configure each component:

### 1. Install Package Dependencies
```sh
# If on OpenWrt 25.x (apk):
apk add ucode ucode-mod-fs ucode-mod-uci ucode-mod-ubus iwinfo mwan3 luci-theme-argon luci-app-argon-config curl wget tar

# If on OpenWrt 24.x (opkg):
opkg update && opkg install ucode ucode-mod-fs ucode-mod-uci ucode-mod-ubus iwinfo mwan3 luci-theme-argon luci-app-argon-config curl wget tar
```

### 2. Create Target Directories
```sh
mkdir -p /usr/libexec/rpcd
mkdir -p /www/luci-static/resources/view/queenx
mkdir -p /usr/share/luci/menu.d
mkdir -p /usr/share/rpcd/acl.d
```

### 3. Copy RPCD Backend Handlers
```sh
cp sections/internet/luci.internet         /usr/libexec/rpcd/luci.internet
cp sections/wireless/luci.wireless         /usr/libexec/rpcd/luci.wireless
cp sections/clients/luci.clients           /usr/libexec/rpcd/luci.clients
cp sections/mac-filter/luci.macfilter     /usr/libexec/rpcd/luci.macfilter
cp sections/dns/luci.dns                   /usr/libexec/rpcd/luci.dns
cp sections/loadbalance/luci.loadbalance   /usr/libexec/rpcd/luci.loadbalance
chmod 0755 /usr/libexec/rpcd/luci.*
```

### 4. Copy Frontend JavaScript Views
```sh
cp sections/internet/internet.js           /www/luci-static/resources/view/queenx/internet.js
cp sections/wireless/wireless.js           /www/luci-static/resources/view/queenx/wireless.js
cp sections/clients/clients.js             /www/luci-static/resources/view/queenx/clients.js
cp sections/mac-filter/macfilter.js       /www/luci-static/resources/view/queenx/macfilter.js
cp sections/dns/dns.js                     /www/luci-static/resources/view/queenx/dns.js
cp sections/loadbalance/loadbalance.js     /www/luci-static/resources/view/queenx/loadbalance.js
chmod 0644 /www/luci-static/resources/view/queenx/*.js
```

### 5. Copy Menu Routing, ACLs & Static Assets
```sh
cp components/menu.json /usr/share/luci/menu.d/luci-app-queenx.json
cp components/acl.json  /usr/share/rpcd/acl.d/luci-app-queenx.json
cp assets/primenet_router.png /www/luci-static/resources/primenet_router.png
chmod 0644 /usr/share/luci/menu.d/luci-app-queenx.json
chmod 0644 /usr/share/rpcd/acl.d/luci-app-queenx.json
```

### 6. Reload Services & Clear Template Caches
```sh
/etc/init.d/rpcd reload
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache*
```

---

## 🔍 Verification

Run these verification commands to ensure all endpoints responded successfully:

```sh
# Verify RPCD backend endpoints
ubus list luci.*

# Test JSON-RPC responses
ubus call luci.internet get_network_info
ubus call luci.wireless get_wireless_info
ubus call luci.clients get_clients_info
ubus call luci.macfilter get_macfilter_info
ubus call luci.dns get_dns_info
ubus call luci.loadbalance get_status

# Verify Argon configuration
uci show argon
```

Open your browser and navigate to:
👉 **[http://192.168.1.1/cgi-bin/luci/admin/queenx/internet](http://192.168.1.1/cgi-bin/luci/admin/queenx/internet)**

---

## 🗑️ Complete Uninstallation & Rollback

To remove Queen, restore standard Bootstrap theme, and clean up:

```sh
uci set luci.main.mediaurlbase='/luci-static/bootstrap'
uci commit luci

rm -rf /www/luci-static/resources/view/queenx
rm -f /usr/libexec/rpcd/luci.internet
rm -f /usr/libexec/rpcd/luci.wireless
rm -f /usr/libexec/rpcd/luci.clients
rm -f /usr/libexec/rpcd/luci.macfilter
rm -f /usr/libexec/rpcd/luci.dns
rm -f /usr/libexec/rpcd/luci.loadbalance
rm -f /etc/config/loadbalance
rm -f /etc/loadbalance_usage.json
rm -f /usr/share/luci/menu.d/luci-app-queenx.json
rm -f /usr/share/rpcd/acl.d/luci-app-queenx.json
/etc/init.d/rpcd reload
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache*
```
