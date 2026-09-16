module("luci.controller.prabina_acs", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/prabina_acs") then
		return
	end

	local page
	page = entry({"admin", "prabina_acs"}, firstchild(), _("prabina's acs"), 10)
	page.dependent = false
	page.acl_depends = { "luci-app-prabina-acs" }

	entry({"admin", "prabina_acs", "topology"}, view("prabina-acs/topology"), _("Topology"), 1)
	entry({"admin", "prabina_acs", "mac_control"}, view("prabina-acs/macfilter"), _("MAC Access Control"), 2)
end
