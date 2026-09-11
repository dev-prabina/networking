# Compatibility Matrix

## Tested Hardware Platforms
| Platform | Architecture | SoC / Chipset | Wi-Fi Radios | Status |
| :--- | :--- | :--- | :--- | :---: |
| **MediaTek Filogic** | `aarch64_cortex-a53` | MT7986 / MT7988 | MT7976C / MT7975 (Wi-Fi 6 AX6000) | ✅ **Verified** |
| **x86_64 Generic** | `x86_64` | Intel / AMD | PCIe Wi-Fi / Intel AX200/AX210 | ✅ **Supported** |
| **Qualcomm IPQ** | `arm_cortex-a7` / `a53` | IPQ4019 / IPQ807x | Qualcomm ath10k / ath11k | ✅ **Supported** |

## Tested OpenWrt Releases
| Version | Package Manager | Firewall Subsystem | Status |
| :--- | :---: | :---: | :---: |
| **OpenWrt 25.12.x** (Snapshot / Release) | `apk` | `fw4` (nftables) | ✅ **Verified** |
| **OpenWrt 24.10.x** | `opkg` | `fw4` (nftables) | ✅ **Supported** |
