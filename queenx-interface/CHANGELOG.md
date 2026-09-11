# Changelog

All notable changes to the **Queen** router management suite will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-16
### Added
- **Dedicated Top-Level Category**: Clean `Controls` sidebar node housing the complete suite.
- **Internet Control Center**:
  - Compact Hero section with dynamic multi-port Ethernet link visualizer.
  - 4-Card Uplink Topology: Ethernet WAN, USB Cellular Tethering, Wi-Fi Repeater (WWAN), and Cellular Modem.
  - Interactive Wi-Fi Repeater modal with live 2.4G/5G SSID scanner, BSSID selection, and WPA key configuration.
- **Wireless Management Suite**:
  - Independent 4-tab Wi-Fi manager (`5 GHz Wi-Fi`, `5 GHz Guest`, `2.4 GHz Wi-Fi`, `2.4 GHz Guest`).
  - Hardware transmission power (TX Power up to 30 dBm / 1000 mW).
  - Bandwidth selector (`160 MHz`, `80 MHz`, `40 MHz`, `20 MHz`), channel selector, and security dropdown (`WPA2-PSK`, `WPA3-SAE`, Mixed, Open).
  - Instant camera Wi-Fi QR-code generator modal.
  - Isolated guest virtual AP lifecycle provisioning with client isolation (`isolate '1'`).
- **Clients Management & Bandwidth Control**:
  - Live Online Client Tracking (`ubus`, `ip neigh`, `dhcp.leases`, `hostapd`, `/proc/net/arp`).
  - MAC-persistent cumulative traffic accounting and byte counters.
  - Per-client Rate Limiter (QoS download/upload bandwidth throttling).
  - Offline Client Management with individual and bulk deletion capabilities.
- **MAC Filtering Suite**:
  - Whitelist (Allow Only) & Blacklist (Block) modes with direct `hostapd` ACL binding (`macfilter '1'` / `macfilter '2'`).
  - Quick-Add modal from active client leases and bulk MAC paste import.
- **DNS Management Section**:
  - Automatic ISP DNS detection with zero hardcoded public DNS fallbacks.
  - Manual Static DNS mode with 1-click presets (Cloudflare, Google, Quad9, Family, AdGuard).
  - DNS Rebinding Attack Protection toggle (`rebind_protection`).
  - Client DNS Interception (Firewall port 53 DNAT redirection).
  - Local Host Records editor modal with atomic `/etc/config/dhcp` persistence.
