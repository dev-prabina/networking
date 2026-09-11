# Command Line Reference

Useful commands for administering and diagnosing Queen modules on OpenWrt:

### System & RPCD Inspection
```sh
# List all active Queen RPCD endpoints
ubus list luci.*

# Test Internet status endpoint
ubus call luci.internet get_network_info

# Test Wireless radios and interfaces
ubus call luci.wireless get_wireless_info

# Test Connected Clients collector
ubus call luci.clients get_clients_info

# Test MAC Filter rules
ubus call luci.macfilter get_macfilter_info

# Test DNS resolver status
ubus call luci.dns get_dns_info
```

### Wi-Fi Subsystem
```sh
# View all physical and virtual Wi-Fi interfaces
iw dev

# Reload wireless subsystem safely
wifi reload
```

### Firewall & Interception
```sh
# Inspect active NAT redirect rules (DNS interception)
uci show firewall | grep Redirect-DNS
nft list table inet fw4
```
