# 🎨 Argon Theme & Queen Integration

## Overview
Queen is visually optimized for the **Argon** theme (`luci-theme-argon`), featuring clean teal primary tones, high-legibility glassmorphism, dynamic Bing daily wallpaper, and dark mode support.

## Packages
- `luci-theme-argon`: Base modern responsive theme.
- `luci-app-argon-config`: LuCI settings module for Argon theme customization.

## Tailored Theme Settings (`/etc/config/argon`)
```uci
config global
	option primary '#0F766E'
	option dark_primary '#81C784'
	option blur '16'
	option blur_dark '16'
	option transparency '0.9'
	option transparency_dark '0.8'
	option mode 'light'
	option online_wallpaper 'bing'
```

## Applying Theme Settings via Command Line
```sh
uci set luci.main.mediaurlbase='/luci-static/argon'
uci set argon.@global[0].primary='#0F766E'
uci set argon.@global[0].dark_primary='#81C784'
uci set argon.@global[0].blur='16'
uci set argon.@global[0].blur_dark='16'
uci set argon.@global[0].transparency='0.9'
uci set argon.@global[0].transparency_dark='0.8'
uci set argon.@global[0].mode='light'
uci set argon.@global[0].online_wallpaper='bing'
uci commit argon
uci commit luci
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache*
```
