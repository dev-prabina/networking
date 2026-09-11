# 🌐 Internet Section

## Overview
The **Internet** module provides a high-level network topology visualization and uplink management dashboard for OpenWrt.

![Internet Dashboard](../../docs/images/internet/dashboard.png)

## Features
- **Hero Unit**: Compact router identity card (`primeNet AX6000`) with real-time physical Ethernet port link-state indicators (WAN, LAN1, LAN2, LAN3).
- **4-Card Uplink Topology**:
  1. **Ethernet (WAN)**: DHCP, Static IP, or PPPoE uplink state.
  2. **USB Cellular Tethering**: Auto-detects RNDIS/NCM 4G/5G phone tethering (`usb0`).
  3. **Wi-Fi Repeater (WWAN)**: Multi-band wireless station client manager with live scanning modal.
  4. **Cellular Modem**: Direct QMI/MBIM/PPP 4G/5G modem monitoring.
- **Dynamic Connection Reporting**: Displays real IP, Gateway, and DNS addresses; renders clean `—` when unlinked.

## Files
- `internet.js`: LuCI frontend view (`/www/luci-static/resources/view/queenx/internet.js`).
- `luci.internet`: RPCD ucode backend (`/usr/libexec/rpcd/luci.internet`).
