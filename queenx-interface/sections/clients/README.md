# 👥 Clients Section

## Overview
The **Clients** module offers live tracking of connected devices, persistent MAC-level traffic accounting, per-device QoS bandwidth throttling, and offline device management.

![Clients Management](../../docs/images/clients/clients.png)

## Features
- **Comprehensive Discovery**: Aggregates `ubus`, `ip neigh`, `dhcp.leases`, `hostapd` station dumps, and `/proc/net/arp`.
- **Traffic Accounting**: Real-time upload/download speeds (KB/s) and MAC-persistent cumulative traffic counters (MB/GB).
- **Rate Limiter (QoS)**: Assigns bandwidth ceilings per MAC address using `nftables`.
- **Offline Devices**: Retains lease history for disconnected devices with individual and bulk deletion options.

## Files
- `clients.js`: LuCI frontend view (`/www/luci-static/resources/view/queenx/clients.js`).
- `luci.clients`: RPCD ucode backend (`/usr/libexec/rpcd/luci.clients`).
