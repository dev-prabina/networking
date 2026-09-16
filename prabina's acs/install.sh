#!/bin/sh
# prabina's acs - Production Installation Script
# Installs all required files, checks dependencies, registers LuCI menus & ACLs

set -e

echo "=== Installing prabina's acs ==="

BASE_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
RAW_BASE="https://raw.githubusercontent.com/dev-prabina/networking/main/prabina%27s%20acs"

if [ -d "$BASE_DIR/usr/bin" ] && [ -f "$BASE_DIR/usr/bin/prabina-acs-status" ]; then
	SRC_MODE="local"
else
	SRC_MODE="remote"
	echo "Downloading prabina's acs files from GitHub..."
fi

# Helper to fetch or copy files
get_file() {
	local rel_path="$1"
	local dest_path="$2"
	local perm="$3"

	if [ "$SRC_MODE" = "local" ]; then
		cp "$BASE_DIR/$rel_path" "$dest_path"
	else
		if which wget >/dev/null 2>&1; then
			wget -q --no-check-certificate -O "$dest_path" "${RAW_BASE}/${rel_path}"
		elif which uclient-fetch >/dev/null 2>&1; then
			uclient-fetch -q --no-check-certificate -O "$dest_path" "${RAW_BASE}/${rel_path}"
		elif which curl >/dev/null 2>&1; then
			curl -skL -o "$dest_path" "${RAW_BASE}/${rel_path}"
		else
			echo "Error: no download tool (wget, uclient-fetch, curl) available." >&2
			exit 1
		fi
	fi

	if [ -n "$perm" ]; then
		chmod "$perm" "$dest_path"
	fi
}

# 1. Check and install dependencies (sshpass & coreutils-timeout)
if ! which sshpass >/dev/null 2>&1; then
	echo "Installing sshpass dependency..."
	if which apk >/dev/null 2>&1; then
		apk add sshpass || true
	elif which opkg >/dev/null 2>&1; then
		opkg update && opkg install sshpass || true
	fi
fi

if ! which timeout >/dev/null 2>&1; then
	echo "Installing coreutils-timeout dependency..."
	if which apk >/dev/null 2>&1; then
		apk add coreutils-timeout || true
	elif which opkg >/dev/null 2>&1; then
		opkg update && opkg install coreutils-timeout || true
	fi
fi

# 2. Create required system directories
mkdir -p /etc/config
mkdir -p /usr/bin
mkdir -p /usr/libexec/rpcd
mkdir -p /usr/share/rpcd/acl.d
mkdir -p /usr/share/luci/menu.d
mkdir -p /usr/lib/lua/luci/controller
mkdir -p /www/luci-static/resources/prabina-acs
mkdir -p /www/luci-static/resources/view/prabina-acs
mkdir -p /www/prabina-acs

# 3. Copy configuration (preserve existing config if present)
if [ ! -f /etc/config/prabina_acs ]; then
	echo "Installing default configuration..."
	get_file "etc/config/prabina_acs" "/etc/config/prabina_acs" "0600"
else
	echo "Existing /etc/config/prabina_acs preserved."
fi
chmod 0600 /etc/config/prabina_acs

# 4. Copy backend executables
echo "Installing backend CLI utilities..."
get_file "usr/bin/prabina-acs-status" "/usr/bin/prabina-acs-status" "0755"
get_file "usr/bin/prabina-acs-mac" "/usr/bin/prabina-acs-mac" "0755"
get_file "usr/bin/prabina-acs-ssh" "/usr/bin/prabina-acs-ssh" "0755"
get_file "uninstall.sh" "/usr/bin/prabina-acs-uninstall" "0755"

# 5. Copy rpcd plugin
echo "Installing rpcd ucode plugin..."
get_file "usr/libexec/rpcd/luci.prabina_acs" "/usr/libexec/rpcd/luci.prabina_acs" "0755"

# 6. Copy ACL and menu registrations
echo "Installing LuCI ACL & menu definitions..."
get_file "usr/share/rpcd/acl.d/luci-app-prabina-acs.json" "/usr/share/rpcd/acl.d/luci-app-prabina-acs.json" "0644"
get_file "usr/share/luci/menu.d/luci-app-prabina-acs.json" "/usr/share/luci/menu.d/luci-app-prabina-acs.json" "0644"
if which lua >/dev/null 2>&1; then
	get_file "usr/lib/lua/luci/controller/prabina_acs.lua" "/usr/lib/lua/luci/controller/prabina_acs.lua" "0644"
fi

# 7. Copy frontend views & assets
echo "Installing frontend views and assets..."
get_file "www/luci-static/resources/prabina-acs/style.css" "/www/luci-static/resources/prabina-acs/style.css" "0644"
get_file "www/luci-static/resources/prabina-acs/topology-canvas.js" "/www/luci-static/resources/prabina-acs/topology-canvas.js" "0644"
get_file "www/luci-static/resources/view/prabina-acs/topology.js" "/www/luci-static/resources/view/prabina-acs/topology.js" "0644"
get_file "www/luci-static/resources/view/prabina-acs/macfilter.js" "/www/luci-static/resources/view/prabina-acs/macfilter.js" "0644"
get_file "www/prabina-acs/index.html" "/www/prabina-acs/index.html" "0644"

# 8. Reload rpcd and clear LuCI caches
echo "Reloading rpcd service..."
/etc/init.d/rpcd restart >/dev/null 2>&1 || true

echo "Clearing LuCI cache..."
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache*

echo "=== prabina's acs installation complete! ==="
echo "Access via LuCI Menu: 'prabina\'s acs' -> 'Topology'"
