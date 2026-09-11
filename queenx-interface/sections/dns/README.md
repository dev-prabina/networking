# 🔒 DNS Section

## Overview
The **DNS** module provides fine-grained control over OpenWrt's `dnsmasq` resolver, upstream servers, rebinding protection, and client query redirection.

![DNS Management](../../docs/images/dns/dns.png)

## Features
- **Pure Automatic Mode**: Uses real upstream DNS negotiated by the active WAN ISP link without dummy fallbacks.
- **Manual Static Mode**: Configure custom resolvers with 1-click presets (Cloudflare `1.1.1.1`, Google `8.8.8.8`, Quad9 `9.9.9.9`, AdGuard `94.140.14.14`).
- **Security Switches**:
  - **DNS Rebinding Attack Protection**: Controls `rebind_protection` in `dnsmasq`.
  - **Override DNS Settings of All Clients**: Creates firewall port 53 DNAT rules to force router DNS.
  - **VPN DNS Override**: Context-aware priority toggle.
- **Static Host Records**: Full CRUD editor modal for local domain mappings in `/etc/config/dhcp`.

## Files
- `dns.js`: LuCI frontend view (`/www/luci-static/resources/view/queenx/dns.js`).
- `luci.dns`: RPCD ucode backend (`/usr/libexec/rpcd/luci.dns`).
