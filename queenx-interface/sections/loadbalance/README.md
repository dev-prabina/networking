# ⚖️ Load Balancing & Dual-WAN Section

## Overview
The **Load Balancing** module delivers enterprise-grade Dual-WAN networking for OpenWrt powered by the production **mwan3** subsystem with conntrack sticky session tracking and persistent flash data-usage accounting. It allows converting physical **LAN1** into **WAN2**, dynamically distributing multi-connection traffic across both WAN connections via customizable weights (e.g. 50/50, 70/30, 80/20) with active ICMP Internet health monitoring and sub-second automatic failover.

## Features
- **Master Dual-WAN Switch**: One-click conversion of physical `LAN1` port between local LAN bridge (`br-lan`) and second WAN uplink (`wan2`).
- **Real-Time Traffic Distribution**: Interactive slider with live percentage calculations (0–100%) and 1-click presets (`50/50 Balanced`, `70/30 Priority`, `80/20 Backup`, `100/0 Primary Only`, `0/100 Secondary Only`).
- **Production Multi-WAN Engine (mwan3)**:
  - Kernel statistical probability packet marking (`statistic mode random probability`).
  - Independent routing tables (`table 1` for WAN1, `table 2` for WAN2).
  - Sticky HTTPS session tracking (`mwan3_rule_ipv4_https`) preventing banking and auth session drops.
- **Active Health Monitoring**:
  - Periodic multi-target ICMP probing (1.1.1.1, 8.8.8.8, 9.9.9.9).
  - Measures real-time latency (ms) and packet loss (%).
  - Configurable check intervals, timeouts, and failure/recovery thresholds.
- **Persistent Flash Data Usage Accounting**:
  - Accumulated historical byte tracking saved to `/etc/loadbalance_usage.json`.
  - Survives reboots, interface reconnects, and Dual-WAN toggles.
  - Reset-safe delta accounting with an explicit **Reset Data Usage** safety modal.
- **Automatic Failover**:
  - If WAN1 drops $\rightarrow$ 100% traffic to WAN2.
  - If WAN2 drops $\rightarrow$ 100% traffic to WAN1.
  - Automatic recovery to configured weights when the link recovers.
- **Built-in Diagnostics**: 1-click self-test verifying PHY carrier, ping probes, DNS resolution, routing rules, and NAT masquerade.

## Files
- `loadbalance.js`: LuCI frontend view (`/www/luci-static/resources/view/queenx/loadbalance.js`).
- `luci.loadbalance`: RPCD ucode backend (`/usr/libexec/rpcd/luci.loadbalance`).
