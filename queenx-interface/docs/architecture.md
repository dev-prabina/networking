# Architecture Overview

Queen follows a clean, decoupled 3-tier architecture optimized for OpenWrt's embedded environment:

```
 ┌────────────────────────────────────────────────────────┐
 │                      BROWSER UI                        │
 │  LuCI JavaScript Views (view.extend / DOM builder)     │
 │  - Non-destructive polling via poll.add                │
 │  - Reactive input state binding                        │
 └──────────────────────────┬─────────────────────────────┘
                            │ JSON-RPC (HTTP /ubus)
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │                   RPCD / UBUS LAYER                    │
 │  Modular ucode Backend Plugins (/usr/libexec/rpcd/*)   │
 │  - luci.internet  - luci.wireless  - luci.clients      │
 │  - luci.macfilter - luci.dns                           │
 │  - ACL validation (/usr/share/rpcd/acl.d/*)            │
 └──────────────────────────┬─────────────────────────────┘
                            │ System Calls & UCI
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │              OPENWRT SYSTEM & SUBSYSTEMS               │
 │  - UCI Cursor (/etc/config/network, dhcp, wireless)    │
 │  - netifd (Interface states, WAN DNS, DHCP leases)     │
 │  - hostapd (Wi-Fi APs, station dumps, MAC ACLs)        │
 │  - dnsmasq (DNS resolver, static hosts, rebinding)     │
 │  - fw4 / nftables (Port 53 DNAT interception, QoS)     │
 └──────────────────────────┬─────────────────────────────┘
                            │ Kernel Drivers
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │                  LINUX KERNEL & HW                     │
 │  mac80211 / mt76 / Ethernet PHYs / Conntrack / QoS     │
 └────────────────────────────────────────────────────────┘
```

## Core Architectural Guarantees
1. **Non-Destructive Polling**: Live polling loops only update dynamic text/badges (e.g. signal strength, online client counts). Active user inputs and form fields are never wiped or reset during editing.
2. **Independent Radio Isolation**: Virtual Wi-Fi interfaces (such as Guest networks) can be enabled or disabled without resetting or disabling the physical hardware chip (`wifi-device`).
3. **Atomic UCI Transactions**: Configuration writes preserve rollback backups (`/tmp/*.bak`) and restore previous settings if service reloads fail.
