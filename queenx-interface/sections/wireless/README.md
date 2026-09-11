# 📡 Wireless Section

## Overview
The **Wireless** module provides a multi-band Wi-Fi management suite with independent interface lifecycle controls.

![Wireless Controls](../../docs/images/wireless/wireless.png)

## Features
- **4-Tab Navigation**: `5 GHz Wi-Fi`, `5 GHz Guest Wi-Fi`, `2.4 GHz Wi-Fi`, `2.4 GHz Guest Wi-Fi`.
- **Hardware RF Controls**: TX Power selector (up to 30 dBm / 1000 mW), Bandwidth (`160 MHz`, `80 MHz`, `40 MHz`, `20 MHz`), and Channel selector.
- **Security & QR Codes**: `WPA2-PSK`, `WPA3-SAE`, Mixed, and Open modes with show/hide password and instant QR-code generator modal.
- **Independent Isolation**: Enabling or disabling a guest network operates strictly at the virtual AP layer, keeping primary Wi-Fi active with zero downtime.

## Files
- `wireless.js`: LuCI frontend view (`/www/luci-static/resources/view/queenx/wireless.js`).
- `luci.wireless`: RPCD ucode backend (`/usr/libexec/rpcd/luci.wireless`).
