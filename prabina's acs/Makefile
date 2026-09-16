include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-prabina-acs
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Prabina Kumar Sahu

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-prabina-acs
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=prabina's acs - Access Control Server & Network Topology Manager
  DEPENDS:=+luci-base +sshpass +coreutils-timeout
  PKGARCH:=all
endef

define Package/luci-app-prabina-acs/description
  Lightweight graphical Access Control Server (ACS) and topology management interface for OpenWrt.
endef

define Build/Compile
endef

define Package/luci-app-prabina-acs/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./etc/config/prabina_acs $(1)/etc/config/prabina_acs
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./usr/bin/prabina-acs-* $(1)/usr/bin/
	$(INSTALL_DIR) $(1)/usr/libexec/rpcd
	$(INSTALL_BIN) ./usr/libexec/rpcd/luci.prabina_acs $(1)/usr/libexec/rpcd/
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./usr/share/rpcd/acl.d/* $(1)/usr/share/rpcd/acl.d/
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./usr/share/luci/menu.d/* $(1)/usr/share/luci/menu.d/
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/controller
	$(INSTALL_DATA) ./usr/lib/lua/luci/controller/* $(1)/usr/lib/lua/luci/controller/
	$(INSTALL_DIR) $(1)/www/luci-static/resources/prabina-acs
	$(INSTALL_DATA) ./www/luci-static/resources/prabina-acs/* $(1)/www/luci-static/resources/prabina-acs/
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/prabina-acs
	$(INSTALL_DATA) ./www/luci-static/resources/view/prabina-acs/* $(1)/www/luci-static/resources/view/prabina-acs/
	$(INSTALL_DIR) $(1)/www/prabina-acs
	$(INSTALL_DATA) ./www/prabina-acs/* $(1)/www/prabina-acs/
endef

$(eval $(call BuildPackage,luci-app-prabina-acs))
