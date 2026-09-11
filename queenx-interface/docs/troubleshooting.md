# Troubleshooting Guide

### 1. The "Controls" menu node does not appear in LuCI
**Cause**: LuCI's module cache has not been flushed or RPCD ACLs are missing.
**Solution**:
```sh
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache*
/etc/init.d/rpcd reload
/etc/init.d/uhttpd restart
```

### 2. Backend RPC returns "Method not found" or "Access denied"
**Cause**: RPCD plugin permissions were not re-indexed.
**Solution**:
```sh
chmod +x /usr/libexec/rpcd/luci.*
/etc/init.d/rpcd restart
ubus list luci.*
```

### 3. Guest network does not broadcast over Wi-Fi
**Cause**: `hostapd` has not spawned the secondary virtual AP.
**Solution**:
```sh
uci show wireless.guest_radio1
wifi reload
iw dev
```
