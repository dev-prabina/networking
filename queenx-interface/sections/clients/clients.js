'use strict';
'require view';
'require ui';
'require rpc';
'require poll';
'require dom';

/*
 * Pixel-Perfect Live Clients Dashboard for OpenWrt LuCI (Argon Theme)
 * Features:
 * 1. Online Clients table (Strictly live state: Real 2.4G/5G band tags, live throughput, zero ghost clients)
 * 2. Persistent Cumulative Data Usage by MAC address (counts data usage across disconnects/reboots)
 * 3. Offline Clients table showing lifetime cumulative data usage per device
 * 4. Instant Manual Refresh button
 * 5. Individual "Delete Record" & Global "Clear All Records"
 * 6. Remove Speed Limit option in 3-dot menu
 * 7. Global Speed Limit control (All Devices / Wi-Fi Only / LAN Only)
 * 8. Instant IP reservation & Access toggles
 */

var callGetLiveClients = rpc.declare({
	object: 'luci.clients',
	method: 'get_clients',
	expect: { '': {} }
});

var callToggleReservedIp = rpc.declare({
	object: 'luci.clients',
	method: 'toggle_reserved_ip',
	params: ['mac', 'ip', 'name'],
	expect: { '': {} }
});

var callSetSpeedLimit = rpc.declare({
	object: 'luci.clients',
	method: 'set_speed_limit',
	params: ['mac', 'ip', 'down_mbps', 'up_mbps'],
	expect: { '': {} }
});

var callSetGlobalSpeedLimit = rpc.declare({
	object: 'luci.clients',
	method: 'set_global_speed_limit',
	params: ['scope', 'down_mbps', 'up_mbps', 'enabled'],
	expect: { '': {} }
});

var callDeleteOfflineClient = rpc.declare({
	object: 'luci.clients',
	method: 'delete_offline_client',
	params: ['mac', 'ip'],
	expect: { '': {} }
});

var callClearAllOfflineClients = rpc.declare({
	object: 'luci.clients',
	method: 'clear_all_offline_clients',
	expect: { '': {} }
});

var callApplyMacFilter = rpc.declare({
	object: 'luci.macfilter',
	method: 'apply_macfilter',
	params: ['mode', 'action', 'filename'],
	expect: { '': {} }
});

var callValidateMacFilter = rpc.declare({
	object: 'luci.macfilter',
	method: 'validate_maclist',
	params: ['content', 'filepath'],
	expect: { '': {} }
});

return view.extend({
	state: {
		clients: [],
		offlineClients: [],
		globalQos: { enabled: false, scope: 'both', down_mbps: 0, up_mbps: 0 },
		prevClients: {},
		lastTimestamp: 0,
		isOnlineCollapsed: false,
		isOfflineCollapsed: false,
		isRefreshing: false
	},

	load: function() {
		return L.resolveDefault(callGetLiveClients(), {});
	},

	formatBytes: function(bytes) {
		if (bytes == null || isNaN(bytes) || bytes === 0) return '0 B';
		var k = 1024;
		var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		var i = Math.floor(Math.log(bytes) / Math.log(k));
		if (i < 0) i = 0;
		if (i >= sizes.length) i = sizes.length - 1;
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	},

	formatSpeed: function(bytesPerSec) {
		if (bytesPerSec == null || isNaN(bytesPerSec) || bytesPerSec < 1) return '0.00 KB/s';
		var k = 1024;
		var sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
		var i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
		if (i < 1) i = 1;
		if (i >= sizes.length) i = sizes.length - 1;
		return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	},

	formatDuration: function(seconds) {
		if (!seconds || seconds <= 0) return _('Just now');
		var h = Math.floor(seconds / 3600);
		var m = Math.floor((seconds % 3600) / 60);
		var s = Math.floor(seconds % 60);
		if (h > 0) return h + 'h ' + m + 'm';
		if (m > 0) return m + 'm ' + s + 's';
		return s + 's';
	},

	updateClientsData: function(data) {
		var self = this;
		var now = (data && data.timestamp) ? data.timestamp : Math.floor(Date.now() / 1000);
		var dt = (self.state.lastTimestamp > 0) ? (now - self.state.lastTimestamp) : 2;
		if (dt <= 0) dt = 2;

		var newClients = (data && data.clients) ? data.clients : [];
		var currentMap = {};

		for (var i = 0; i < newClients.length; i++) {
			var c = newClients[i];
			currentMap[c.mac] = c;

			var prev = self.state.prevClients[c.mac];
			if (prev) {
				var drx = (c.rx_bytes || 0) - (prev.rx_bytes || 0);
				var dtx = (c.tx_bytes || 0) - (prev.tx_bytes || 0);

				c.rx_speed = (drx >= 0) ? (drx / dt) : 0;
				c.tx_speed = (dtx >= 0) ? (dtx / dt) : 0;
			} else {
				c.rx_speed = 0;
				c.tx_speed = 0;
			}
		}

		self.state.clients = newClients;
		self.state.offlineClients = (data && data.offline_clients) ? data.offline_clients : [];
		self.state.globalQos = (data && data.global_qos) ? data.global_qos : self.state.globalQos;
		self.state.prevClients = currentMap;
		self.state.lastTimestamp = now;
	},

	render: function(initialData) {
		var self = this;
		self.updateClientsData(initialData);

		var container = E('div', { 'class': 'cbi-map', 'id': 'clients-app-root' });

		// Argon Theme Styles
		var styleTag = E('style', {}, [
			'#clients-app-root { width: 100%; max-width: 100%; margin: 0; padding: 0; box-sizing: border-box; }',
			
			'#clients-app-root .qx-card { background: var(--menu-bg-color, #ffffff); border-radius: 0.6rem; box-shadow: 0 0 2rem 0 rgba(136, 152, 170, 0.15); padding: 1.25rem 1.5rem; border: 1px solid rgba(0, 0, 0, 0.05); width: 100%; box-sizing: border-box; margin-bottom: 1.8rem; }',
			'[data-theme="dark"] #clients-app-root .qx-card, [data-dark="true"] #clients-app-root .qx-card, @media (prefers-color-scheme: dark) { #clients-app-root .qx-card { background: rgba(255, 255, 255, 0.04); border-color: rgba(255, 255, 255, 0.08); box-shadow: 0 4px 20px rgba(0,0,0,0.25); backdrop-filter: blur(12px); } }',
			
			'#clients-app-root .qx-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 10px; }',
			'#clients-app-root .qx-title-area { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }',
			'#clients-app-root .qx-title { font-size: 1.05rem; font-weight: 700; color: inherit; display: flex; align-items: center; gap: 8px; margin: 0; }',
			'#clients-app-root .qx-count { font-size: 0.9rem; opacity: 0.7; font-weight: 500; }',
			'#clients-app-root .qx-chevron { font-size: 1rem; opacity: 0.6; transition: transform 0.2s ease; margin-left: 6px; }',
			'#clients-app-root .qx-chevron.collapsed { transform: rotate(180deg); }',
			
			/* HEADER ACTION BUTTONS */
			'#clients-app-root .qx-actions-group { display: flex; align-items: center; gap: 8px; }',
			'#clients-app-root .qx-header-btn { display: inline-flex; align-items: center; gap: 6px; border: 1.5px solid #5e72e4; background: transparent; color: #5e72e4; border-radius: 20px; padding: 4px 13px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; }',
			'#clients-app-root .qx-header-btn:hover { background: #5e72e4; color: white; box-shadow: 0 2px 8px rgba(94, 114, 228, 0.35); }',
			'[data-theme="dark"] #clients-app-root .qx-header-btn, [data-dark="true"] #clients-app-root .qx-header-btn, @media (prefers-color-scheme: dark) { #clients-app-root .qx-header-btn { border-color: #11cdef; color: #11cdef; } #clients-app-root .qx-header-btn:hover { background: #11cdef; color: #0f172a; box-shadow: 0 2px 8px rgba(17, 205, 239, 0.4); } }',
			'#clients-app-root .qx-btn-active-qos { border-color: #fb6340 !important; color: #fb6340 !important; }',
			'#clients-app-root .qx-btn-active-qos:hover { background: #fb6340 !important; color: white !important; }',
			'#clients-app-root .qx-btn-danger { border-color: rgba(245, 54, 92, 0.6) !important; color: #f5365c !important; }',
			'#clients-app-root .qx-btn-danger:hover { background: #f5365c !important; color: white !important; box-shadow: 0 2px 8px rgba(245, 54, 92, 0.4) !important; }',
			'#clients-app-root .qx-spin-icon { display: inline-block; transition: transform 0.4s; }',
			'#clients-app-root .qx-spin-active { animation: qx-spin-anim 0.6s linear infinite; }',
			'@keyframes qx-spin-anim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }',

			'#clients-app-root .qx-table-scroll { width: 100%; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; touch-action: pan-x pan-y; }',
			'#clients-app-root .qx-table { width: 100%; border-collapse: collapse; text-align: left; table-layout: auto; }',
			'#clients-app-root .qx-table th { padding: 12px 14px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.75; border-bottom: 1px solid rgba(0, 0, 0, 0.06); white-space: nowrap; color: inherit; }',
			'[data-theme="dark"] #clients-app-root .qx-table th, [data-dark="true"] #clients-app-root .qx-table th, @media (prefers-color-scheme: dark) { #clients-app-root .qx-table th { border-bottom-color: rgba(255, 255, 255, 0.08); } }',
			'#clients-app-root .qx-table td { padding: 14px 14px; border-bottom: 1px solid rgba(0, 0, 0, 0.04); vertical-align: middle; color: inherit; }',
			'[data-theme="dark"] #clients-app-root .qx-table td, [data-dark="true"] #clients-app-root .qx-table td, @media (prefers-color-scheme: dark) { #clients-app-root .qx-table td { border-bottom-color: rgba(255, 255, 255, 0.04); } }',
			'#clients-app-root .qx-table tr:last-child td { border-bottom: none; }',
			'#clients-app-root .qx-table tr:hover td { background: rgba(94, 114, 228, 0.03); }',
			'[data-theme="dark"] #clients-app-root .qx-table tr:hover td, [data-dark="true"] #clients-app-root .qx-table tr:hover td, @media (prefers-color-scheme: dark) { #clients-app-root .qx-table tr:hover td { background: rgba(255, 255, 255, 0.02); } }',
			
			'#clients-app-root .qx-name-cell { display: flex; align-items: center; gap: 10px; }',
			'#clients-app-root .qx-dev-icon-svg { width: 24px; height: 24px; stroke: currentColor; opacity: 0.85; fill: none; stroke-width: 1.8; flex-shrink: 0; }',
			'#clients-app-root .qx-dev-name { font-size: 0.92rem; font-weight: 600; color: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }',
			'#clients-app-root .qx-self-badge { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; background: rgba(94, 114, 228, 0.15); color: #5e72e4; padding: 2px 6px; border-radius: 4px; margin-left: 6px; }',
			'#clients-app-root .qx-qos-badge { font-size: 0.68rem; font-weight: 700; background: rgba(251, 99, 64, 0.15); color: #fb6340; border: 1px solid rgba(251, 99, 64, 0.4); padding: 1px 5px; border-radius: 4px; margin-left: 6px; white-space: nowrap; }',
			
			/* CONNECTION ICONS & BAND TAGS */
			'#clients-app-root .qx-wifi-icon { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; width: 34px; height: 34px; }',
			'#clients-app-root .qx-wifi-svg { width: 20px; height: 20px; stroke: #11cdef; fill: none; stroke-width: 2; }',
			'#clients-app-root .qx-band-5g { font-size: 8.5px; font-weight: 800; color: #11cdef; border: 1px solid #11cdef; background: rgba(17, 205, 239, 0.12); border-radius: 3px; padding: 0 3px; margin-top: -2px; line-height: 1.1; }',
			'#clients-app-root .qx-band-24g { font-size: 8.5px; font-weight: 800; color: #2dce89; border: 1px solid #2dce89; background: rgba(45, 206, 137, 0.12); border-radius: 3px; padding: 0 3px; margin-top: -2px; line-height: 1.1; }',
			'#clients-app-root .qx-eth-icon-svg { width: 22px; height: 22px; stroke: #5e72e4; fill: none; stroke-width: 2; }',
			
			'#clients-app-root .qx-ip { font-size: 0.88rem; font-weight: 600; color: inherit; }',
			'#clients-app-root .qx-mac { font-family: monospace; font-size: 0.78rem; opacity: 0.65; margin-top: 2px; }',
			
			'#clients-app-root .qx-speed-line { font-size: 0.82rem; color: inherit; display: flex; align-items: center; gap: 5px; margin: 1px 0; font-weight: 500; white-space: nowrap; }',
			'#clients-app-root .qx-arrow-down { color: #5e72e4; font-weight: 900; font-size: 0.85rem; }',
			'#clients-app-root .qx-arrow-up { color: #5e72e4; font-weight: 900; font-size: 0.85rem; }',
			'[data-theme="dark"] #clients-app-root .qx-arrow-down, [data-theme="dark"] #clients-app-root .qx-arrow-up, @media (prefers-color-scheme: dark) { #clients-app-root .qx-arrow-down, #clients-app-root .qx-arrow-up { color: #11cdef; } }',
			
			/* PILL SWITCH TOGGLES */
			'#clients-app-root .qx-toggle-switch { position: relative; display: inline-block; width: 42px; height: 22px; cursor: pointer; user-select: none; vertical-align: middle; }',
			'#clients-app-root .qx-toggle-track { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(140, 150, 170, 0.4); border-radius: 22px; transition: background-color 0.2s ease; }',
			'#clients-app-root .qx-toggle-track.active { background-color: #2dce89; }',
			'#clients-app-root .qx-toggle-thumb { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; border-radius: 50%; transition: transform 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.25); }',
			'#clients-app-root .qx-toggle-track.active .qx-toggle-thumb { transform: translateX(20px); }',
			
			/* STATUS PILL (OFFLINE) */
			'#clients-app-root .qx-offline-pill { font-size: 11px; font-weight: 700; background: rgba(140, 150, 170, 0.15); color: rgba(140, 150, 170, 0.85); padding: 3px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px; }',
			'#clients-app-root .qx-offline-dot { width: 6px; height: 6px; border-radius: 50%; background: #adb5bd; }',

			/* 3-DOT ACTION BUTTON */
			'#clients-app-root .qx-dots-btn { background: none; border: none; font-size: 20px; line-height: 1; color: inherit; opacity: 0.65; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: all 0.15s; letter-spacing: 1px; font-weight: bold; }',
			'#clients-app-root .qx-dots-btn:hover { opacity: 1; color: #5e72e4; background: rgba(94, 114, 228, 0.1); }',
			
			/* GLOBAL PORTAL DROPDOWN */
			'.qx-portal-dropdown { position: fixed; background: #ffffff; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 0.45rem; box-shadow: 0 10px 30px rgba(0,0,0,0.18); min-width: 195px; z-index: 9999999; padding: 6px 0; font-family: inherit; animation: qx-pop 0.12s ease-out; }',
			'[data-theme="dark"] .qx-portal-dropdown, [data-dark="true"] .qx-portal-dropdown, @media (prefers-color-scheme: dark) { .qx-portal-dropdown { background: #222736; border-color: rgba(255,255,255,0.12); box-shadow: 0 12px 35px rgba(0,0,0,0.6); } }',
			'@keyframes qx-pop { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }',
			'.qx-portal-item { padding: 9px 16px; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 9px; cursor: pointer; color: inherit; transition: background 0.15s; }',
			'.qx-portal-item:hover { background: rgba(94, 114, 228, 0.12); color: #5e72e4; }',
			'.qx-portal-divider { height: 1px; background: rgba(0, 0, 0, 0.08); margin: 4px 0; }',
			'[data-theme="dark"] .qx-portal-divider, [data-dark="true"] .qx-portal-divider, @media (prefers-color-scheme: dark) { .qx-portal-divider { background: rgba(255,255,255,0.08); } }',
			'.qx-portal-danger { color: #f5365c !important; }',
			'.qx-portal-danger:hover { background: rgba(245, 54, 92, 0.12) !important; color: #f5365c !important; }',
			'.qx-portal-warn { color: #fb6340 !important; }',
			'.qx-portal-warn:hover { background: rgba(251, 99, 64, 0.12) !important; color: #fb6340 !important; }',

			'#clients-app-root .qx-info-icon { display: inline-flex; align-items: center; justify-content: center; width: 13px; height: 13px; border-radius: 50%; background: rgba(140, 150, 170, 0.6); color: white; font-size: 9px; font-weight: bold; margin-left: 4px; vertical-align: middle; cursor: help; font-style: normal; }'
		]);
		container.appendChild(styleTag);

		var mainRoot = E('div', { 'id': 'cl-main-mount' });
		container.appendChild(mainRoot);

		self.buildDashboard(mainRoot);

		// Dismiss dropdown on outside click
		document.addEventListener('click', function(ev) {
			if (!ev.target.closest('.qx-dots-btn') && !ev.target.closest('.qx-portal-dropdown')) {
				var existing = document.getElementById('qx-active-portal');
				if (existing) existing.remove();
			}
		});

		// Live Polling every 2 seconds with Scroll Position Preservation
		poll.add(function() {
			return L.resolveDefault(callGetLiveClients(), {}).then(function(data) {
				self.updateClientsData(data);
				var mount = document.getElementById('cl-main-mount');
				if (mount) {
					// Capture horizontal scroll positions of all tables before re-rendering
					var scrolls = mount.querySelectorAll('.qx-table-scroll');
					var savedPos = [];
					for (var i = 0; i < scrolls.length; i++) {
						savedPos.push(scrolls[i].scrollLeft);
					}
					
					self.buildDashboard(mount);
					
					// Instantly restore scroll positions so mobile users never experience snapping
					var newScrolls = mount.querySelectorAll('.qx-table-scroll');
					for (var j = 0; j < newScrolls.length; j++) {
						if (savedPos[j] != null) {
							newScrolls[j].scrollLeft = savedPos[j];
						}
					}
				}
			});
		}, 2);

		return container;
	},

	refreshClients: function() {
		var self = this;
		self.state.isRefreshing = true;
		var mount = document.getElementById('cl-main-mount');
		if (mount) self.buildDashboard(mount);

		callGetLiveClients().then(function(data) {
			self.updateClientsData(data);
			self.state.isRefreshing = false;
			if (mount) self.buildDashboard(mount);
			ui.addNotification(null, E('p', _('Client list refreshed.')), 'info');
		}).catch(function(err) {
			self.state.isRefreshing = false;
			if (mount) self.buildDashboard(mount);
			ui.addNotification(null, E('p', _('Error refreshing clients: %s').format(err.message || err)), 'error');
		});
	},

	buildDashboard: function(root) {
		var self = this;
		root.innerHTML = '';

		var onlineClients = self.state.clients || [];
		var offlineClients = self.state.offlineClients || [];
		var globalQos = self.state.globalQos || {};

		// ==================== 1. ONLINE CLIENTS CARD ====================
		var onlineCard = E('div', { 'class': 'qx-card' });

		var chevronOnline = E('span', { 'class': 'qx-chevron ' + (self.state.isOnlineCollapsed ? 'collapsed' : '') }, '⌃');
		
		var titleAreaOnline = E('div', {
			'class': 'qx-title-area',
			'click': function() {
				self.state.isOnlineCollapsed = !self.state.isOnlineCollapsed;
				self.buildDashboard(root);
			}
		}, [
			E('h3', { 'class': 'qx-title' }, [
				_('Online Clients'),
				E('span', { 'class': 'qx-count' }, '(%d)'.format(onlineClients.length)),
				chevronOnline
			])
		]);

		var globalQosBtn = E('button', {
			'class': 'qx-header-btn ' + (globalQos.enabled ? 'qx-btn-active-qos' : ''),
			'title': globalQos.enabled ? _('Global Speed Limit is ON (↓ %dM / ↑ %dM)').format(globalQos.down_mbps, globalQos.up_mbps) : _('Configure Global Speed Limit for all devices'),
			'click': function(ev) {
				ev.stopPropagation();
				self.showGlobalSpeedLimitModal();
			}
		}, [
			'⚡',
			globalQos.enabled ? _('Global Limit: %dM'.format(globalQos.down_mbps)) : _('Global Speed Limit')
		]);

		var refreshBtn = E('button', {
			'class': 'qx-header-btn',
			'title': _('Click to immediately scan and refresh connected devices'),
			'click': function(ev) {
				ev.stopPropagation();
				self.refreshClients();
			}
		}, [
			E('span', { 'class': 'qx-spin-icon ' + (self.state.isRefreshing ? 'qx-spin-active' : '') }, '🔄'),
			_('Refresh')
		]);

		var headerActions = E('div', { 'class': 'qx-actions-group' }, [
			globalQosBtn,
			refreshBtn
		]);

		var headerOnline = E('div', { 'class': 'qx-header' }, [
			titleAreaOnline,
			headerActions
		]);
		onlineCard.appendChild(headerOnline);

		if (!self.state.isOnlineCollapsed) {
			if (onlineClients.length === 0) {
				var empty = E('div', { 'style': 'text-align: center; padding: 36px 0; opacity: 0.7; font-size: 13.5px;' }, [
					_('No active devices currently connected to the router.')
				]);
				onlineCard.appendChild(empty);
			} else {
				var tableScroll = E('div', { 'class': 'qx-table-scroll' });
				var table = E('table', { 'class': 'qx-table' });

				var thead = E('thead', {}, [
					E('tr', {}, [
						E('th', { 'style': 'min-width: 170px;' }, _('Name')),
						E('th', { 'style': 'width: 55px; text-align: center;' }, ''),
						E('th', { 'style': 'min-width: 170px;' }, _('IP + MAC')),
						E('th', { 'style': 'min-width: 140px;' }, [
							_('Speed'),
							E('span', { 'class': 'qx-info-icon', 'title': _('Real-time download (↓) and upload (↑) bandwidth rate') }, 'i')
						]),
						E('th', { 'style': 'min-width: 140px;' }, [
							_('Traffic'),
							E('span', { 'class': 'qx-info-icon', 'title': _('Persistent lifetime cumulative download (↓) and upload (↑) data usage') }, 'i')
						]),
						E('th', { 'style': 'min-width: 110px; text-align: center;' }, [
							_('Reserved IP'),
							E('span', { 'class': 'qx-info-icon', 'title': _('Bind this IP statically to the client MAC address in DHCP') }, 'i')
						]),
						E('th', { 'style': 'min-width: 90px; text-align: center;' }, _('Access')),
						E('th', { 'style': 'min-width: 70px; text-align: center;' }, _('Action'))
					])
				]);
				table.appendChild(thead);

				var tbody = E('tbody');

				onlineClients.forEach(function(c) {
					var isSelf = (c.ip === '192.168.1.150' || c.ip === window.location.hostname);
					var devName = c.hostname || _('Unknown Device');

					// Device Outline SVG
					var devIconSvg = '<svg class="qx-dev-icon-svg" viewBox="0 0 24 24"><rect x="2" y="5" width="14" height="10" rx="1.5"/><path d="M1 18h16"/><rect x="15" y="10" width="7" height="9" rx="1.5"/></svg>';

					var qosBadge = (c.qos && (c.qos.down_mbps > 0 || c.qos.up_mbps > 0)) ?
						E('span', { 'class': 'qx-qos-badge', 'title': _('Bandwidth Cap: ↓ %d Mbps / ↑ %d Mbps (Click 3-dots to remove)').format(c.qos.down_mbps, c.qos.up_mbps) }, '⚡ %dM'.format(c.qos.down_mbps)) : '';

					var nameCell = E('div', { 'class': 'qx-name-cell' }, [
						E('div', {}, []),
						E('div', { 'style': 'display: flex; align-items: center;' }, [
							E('span', { 'class': 'qx-dev-name' }, devName),
							isSelf ? E('span', { 'class': 'qx-self-badge' }, 'self') : '',
							qosBadge
						])
					]);
					nameCell.firstChild.innerHTML = devIconSvg;

					// Connection Icon (5G / 2.4G / Wired)
					var connCell = E('div', { 'style': 'display: flex; justify-content: center; align-items: center;' });
					if (c.conn_type === 'wifi') {
						var is5G = (c.radio === '5G' || (c.frequency && c.frequency > 4000));
						var bandClass = is5G ? 'qx-band-5g' : 'qx-band-24g';
						var bandText = is5G ? '5G' : '2.4G';
						var wifiColor = is5G ? '#11cdef' : '#2dce89';

						var wifiHtml = '<div class="qx-wifi-icon">' +
							'<svg class="qx-wifi-svg" viewBox="0 0 24 24" style="stroke: ' + wifiColor + '"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.5 16.5a6 6 0 0 1 7 0"/><circle cx="12" cy="20" r="1" fill="' + wifiColor + '"/></svg>' +
							'<span class="' + bandClass + '">' + bandText + '</span>' +
							'</div>';
						connCell.innerHTML = wifiHtml;
					} else {
						var ethHtml = '<div class="qx-wifi-icon">' +
							'<svg class="qx-eth-icon-svg" viewBox="0 0 24 24"><path d="M4 12h3m10 0h3M7 8l-4 4 4 4m10-8 4 4-4 4M9 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0m4 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0"/></svg>' +
							'</div>';
						connCell.innerHTML = ethHtml;
					}

					// IP + MAC
					var ipMacCell = E('div', {}, [
						E('div', { 'class': 'qx-ip' }, c.ip || _('—')),
						E('div', { 'class': 'qx-mac' }, c.mac)
					]);

					// Speed (↓ / ↑)
					var speedCell = E('div', {}, [
						E('div', { 'class': 'qx-speed-line' }, [
							E('span', { 'class': 'qx-arrow-down' }, '↓'),
							E('span', {}, self.formatSpeed(c.rx_speed))
						]),
						E('div', { 'class': 'qx-speed-line' }, [
							E('span', { 'class': 'qx-arrow-up' }, '↑'),
							E('span', {}, self.formatSpeed(c.tx_speed))
						])
					]);

					// Traffic (Persistent Total ↓ / ↑)
					var trafficCell = E('div', {}, [
						E('div', { 'class': 'qx-speed-line' }, [
							E('span', { 'class': 'qx-arrow-down' }, '↓'),
							E('span', {}, self.formatBytes(c.rx_bytes))
						]),
						E('div', { 'class': 'qx-speed-line' }, [
							E('span', { 'class': 'qx-arrow-up' }, '↑'),
							E('span', {}, self.formatBytes(c.tx_bytes))
						])
					]);

					// Reserved IP Switch
					var isReserved = c.is_reserved ? true : false;
					var reservedTrack = E('div', { 'class': 'qx-toggle-track ' + (isReserved ? 'active' : '') }, [
						E('div', { 'class': 'qx-toggle-thumb' })
					]);
					var reservedSwitch = E('div', {
						'class': 'qx-toggle-switch',
						'title': isReserved ? _('Static IP Reservation is ON (Click to disable)') : _('Static IP Reservation is OFF (Click to enable)'),
						'click': function(ev) {
							ev.stopPropagation();
							callToggleReservedIp(c.mac, c.ip, c.hostname).then(function(res) {
								if (res && res.success) {
									c.is_reserved = res.reserved;
									if (res.reserved) reservedTrack.classList.add('active');
									else reservedTrack.classList.remove('active');
									ui.addNotification(null, E('p', res.message), 'info');
								}
							});
						}
					}, [ reservedTrack ]);

					// Access Switch
					var isBlocked = c.is_blocked ? true : false;
					var accessTrack = E('div', { 'class': 'qx-toggle-track ' + (!isBlocked ? 'active' : '') }, [
						E('div', { 'class': 'qx-toggle-thumb' })
					]);
					var accessSwitch = E('div', {
						'class': 'qx-toggle-switch',
						'title': !isBlocked ? _('Network Access is ALLOWED (Click to block)') : _('Network Access is BLOCKED (Click to allow)'),
						'click': function(ev) {
							ev.stopPropagation();
							if (!isBlocked) {
								self.blockClient(c);
							} else {
								self.unblockClient(c);
							}
						}
					}, [ accessTrack ]);

					// 3-Dot Action Button
					var dotsBtn = E('button', {
						'class': 'qx-dots-btn',
						'title': _('Device Actions'),
						'click': function(ev) {
							ev.stopPropagation();
							self.openPortalMenu(ev.currentTarget, c, true);
						}
					}, '•••');

					var tr = E('tr', {}, [
						E('td', {}, [ nameCell ]),
						E('td', { 'style': 'text-align: center;' }, [ connCell ]),
						E('td', {}, [ ipMacCell ]),
						E('td', {}, [ speedCell ]),
						E('td', {}, [ trafficCell ]),
						E('td', { 'style': 'text-align: center;' }, [ reservedSwitch ]),
						E('td', { 'style': 'text-align: center;' }, [ accessSwitch ]),
						E('td', { 'style': 'text-align: center;' }, [ dotsBtn ])
					]);

					tbody.appendChild(tr);
				});

				table.appendChild(tbody);
				tableScroll.appendChild(table);
				onlineCard.appendChild(tableScroll);
			}
		}
		root.appendChild(onlineCard);

		// ==================== 2. OFFLINE CLIENTS CARD ====================
		var offlineCard = E('div', { 'class': 'qx-card' });

		var chevronOffline = E('span', { 'class': 'qx-chevron ' + (self.state.isOfflineCollapsed ? 'collapsed' : '') }, '⌃');
		
		var titleAreaOffline = E('div', {
			'class': 'qx-title-area',
			'click': function() {
				self.state.isOfflineCollapsed = !self.state.isOfflineCollapsed;
				self.buildDashboard(root);
			}
		}, [
			E('h3', { 'class': 'qx-title' }, [
				_('Offline Clients'),
				E('span', { 'class': 'qx-count' }, '(%d)'.format(offlineClients.length)),
				chevronOffline
			])
		]);

		var clearAllBtn = E('button', {
			'class': 'qx-header-btn qx-btn-danger',
			'title': _('Delete and clear all offline client history records'),
			'style': offlineClients.length === 0 ? 'display: none;' : '',
			'click': function(ev) {
				ev.stopPropagation();
				if (confirm(_('Are you sure you want to DELETE ALL %d offline client records?\n\nThis will clear all inactive DHCP lease history and offline records.').format(offlineClients.length))) {
					ui.showModal(_('Clearing Offline Records...'), [
						E('p', { 'class': 'spinning' }, _('Removing offline client history...'))
					]);
					callClearAllOfflineClients().then(function(res) {
						ui.hideModal();
						ui.addNotification(null, E('p', res.message || _('All offline records cleared.')), 'info');
						self.refreshClients();
					}).catch(function(err) {
						ui.hideModal();
						ui.addNotification(null, E('p', _('Error: %s').format(err.message || err)), 'error');
					});
				}
			}
		}, [
			'🗑️',
			_('Clear All Records')
		]);

		var headerOffline = E('div', { 'class': 'qx-header' }, [
			titleAreaOffline,
			clearAllBtn
		]);
		offlineCard.appendChild(headerOffline);

		if (!self.state.isOfflineCollapsed) {
			if (offlineClients.length === 0) {
				var emptyOff = E('div', { 'style': 'text-align: center; padding: 24px 0; opacity: 0.6; font-size: 13px;' }, [
					_('No offline/disconnected devices recorded in history.')
				]);
				offlineCard.appendChild(emptyOff);
			} else {
				var offScroll = E('div', { 'class': 'qx-table-scroll' });
				var offTable = E('table', { 'class': 'qx-table' });

				var offThead = E('thead', {}, [
					E('tr', {}, [
						E('th', { 'style': 'min-width: 170px;' }, _('Name')),
						E('th', { 'style': 'min-width: 170px;' }, _('Last Known IP + MAC')),
						E('th', { 'style': 'min-width: 130px;' }, [
							_('Total Data Used'),
							E('span', { 'class': 'qx-info-icon', 'title': _('Total cumulative data downloaded (↓) and uploaded (↑) by this device') }, 'i')
						]),
						E('th', { 'style': 'min-width: 90px; text-align: center;' }, _('Status')),
						E('th', { 'style': 'min-width: 100px; text-align: center;' }, _('Reserved IP')),
						E('th', { 'style': 'min-width: 80px; text-align: center;' }, _('Access')),
						E('th', { 'style': 'min-width: 65px; text-align: center;' }, _('Action'))
					])
				]);
				offTable.appendChild(offThead);

				var offTbody = E('tbody');

				offlineClients.forEach(function(c) {
					var devName = c.hostname || _('Unknown Device');
					var devIconSvg = '<svg class="qx-dev-icon-svg" viewBox="0 0 24 24" style="opacity: 0.45;"><rect x="2" y="5" width="14" height="10" rx="1.5"/><path d="M1 18h16"/><rect x="15" y="10" width="7" height="9" rx="1.5"/></svg>';

					var nameCell = E('div', { 'class': 'qx-name-cell', 'style': 'opacity: 0.75;' }, [
						E('div', {}, []),
						E('div', { 'style': 'display: flex; align-items: center;' }, [
							E('span', { 'class': 'qx-dev-name' }, devName)
						])
					]);
					nameCell.firstChild.innerHTML = devIconSvg;

					var ipMacCell = E('div', { 'style': 'opacity: 0.75;' }, [
						E('div', { 'class': 'qx-ip' }, c.ip || _('—')),
						E('div', { 'class': 'qx-mac' }, c.mac)
					]);

					// Cumulative Total Data Usage for Offline Client
					var trafficCell = E('div', { 'style': 'opacity: 0.8;' }, [
						E('div', { 'class': 'qx-speed-line' }, [
							E('span', { 'class': 'qx-arrow-down' }, '↓'),
							E('span', {}, self.formatBytes(c.rx_bytes))
						]),
						E('div', { 'class': 'qx-speed-line' }, [
							E('span', { 'class': 'qx-arrow-up' }, '↑'),
							E('span', {}, self.formatBytes(c.tx_bytes))
						])
					]);

					var statusCell = E('div', { 'style': 'text-align: center;' }, [
						E('span', { 'class': 'qx-offline-pill' }, [
							E('span', { 'class': 'qx-offline-dot' }),
							_('Offline')
						])
					]);

					// Reserved IP Switch
					var isReserved = c.is_reserved ? true : false;
					var reservedTrack = E('div', { 'class': 'qx-toggle-track ' + (isReserved ? 'active' : '') }, [
						E('div', { 'class': 'qx-toggle-thumb' })
					]);
					var reservedSwitch = E('div', {
						'class': 'qx-toggle-switch',
						'title': isReserved ? _('Static IP Reservation is ON') : _('Static IP Reservation is OFF'),
						'click': function(ev) {
							ev.stopPropagation();
							callToggleReservedIp(c.mac, c.ip, c.hostname).then(function(res) {
								if (res && res.success) {
									c.is_reserved = res.reserved;
									if (res.reserved) reservedTrack.classList.add('active');
									else reservedTrack.classList.remove('active');
									ui.addNotification(null, E('p', res.message), 'info');
								}
							});
						}
					}, [ reservedTrack ]);

					// Access Switch
					var isBlocked = c.is_blocked ? true : false;
					var accessTrack = E('div', { 'class': 'qx-toggle-track ' + (!isBlocked ? 'active' : '') }, [
						E('div', { 'class': 'qx-toggle-thumb' })
					]);
					var accessSwitch = E('div', {
						'class': 'qx-toggle-switch',
						'title': !isBlocked ? _('Network Access is ALLOWED') : _('Network Access is BLOCKED'),
						'click': function(ev) {
							ev.stopPropagation();
							if (!isBlocked) {
								self.blockClient(c);
							} else {
								self.unblockClient(c);
							}
						}
					}, [ accessTrack ]);

					// 3-Dot Action Button
					var dotsBtn = E('button', {
						'class': 'qx-dots-btn',
						'title': _('Device Actions'),
						'click': function(ev) {
							ev.stopPropagation();
							self.openPortalMenu(ev.currentTarget, c, false);
						}
					}, '•••');

					var tr = E('tr', {}, [
						E('td', {}, [ nameCell ]),
						E('td', {}, [ ipMacCell ]),
						E('td', {}, [ trafficCell ]),
						E('td', { 'style': 'text-align: center;' }, [ statusCell ]),
						E('td', { 'style': 'text-align: center;' }, [ reservedSwitch ]),
						E('td', { 'style': 'text-align: center;' }, [ accessSwitch ]),
						E('td', { 'style': 'text-align: center;' }, [ dotsBtn ])
					]);

					offTbody.appendChild(tr);
				});

				offTable.appendChild(offTbody);
				offScroll.appendChild(offTable);
				offlineCard.appendChild(offScroll);
			}
		}
		root.appendChild(offlineCard);
	},

	openPortalMenu: function(buttonElem, c, isOnline) {
		var self = this;
		var existing = document.getElementById('qx-active-portal');
		if (existing) existing.remove();

		var rect = buttonElem.getBoundingClientRect();
		var menuItems = [];

		if (isOnline) {
			// Speed Limit
			menuItems.push(E('div', {
				'class': 'qx-portal-item',
				'click': function() {
					dropdown.remove();
					self.showSpeedLimitModal(c);
				}
			}, [ '⚡', _('Set Speed Limit / QoS') ]));

			// Remove Speed Limit (if active)
			if (c.qos && (c.qos.down_mbps > 0 || c.qos.up_mbps > 0)) {
				menuItems.push(E('div', {
					'class': 'qx-portal-item qx-portal-warn',
					'click': function() {
						dropdown.remove();
						callSetSpeedLimit(c.mac, c.ip, 0, 0).then(function(res) {
							c.qos = null;
							ui.addNotification(null, E('p', _('Speed limit removed for %s.').format(c.ip || c.mac)), 'info');
							self.refreshClients();
						});
					}
				}, [ '✕', _('Remove Speed Limit') ]));
			}

			// View Details
			menuItems.push(E('div', {
				'class': 'qx-portal-item',
				'click': function() {
					dropdown.remove();
					self.showClientModal(c);
				}
			}, [ '🔍', _('View Device Details') ]));

			if (c.conn_type === 'wifi') {
				menuItems.push(E('div', {
					'class': 'qx-portal-item',
					'click': function() {
						dropdown.remove();
						self.kickClient(c);
					}
				}, [ '🔄', _('Reconnect / Kick') ]));
			}

			menuItems.push(E('div', { 'class': 'qx-portal-divider' }));
		}

		// Copy MAC
		menuItems.push(E('div', {
			'class': 'qx-portal-item',
			'click': function() {
				dropdown.remove();
				navigator.clipboard.writeText(c.mac);
				ui.addNotification(null, E('p', _('Copied MAC address: %s').format(c.mac)), 'info');
			}
		}, [ '📋', _('Copy MAC Address') ]));

		// Copy IP
		if (c.ip && c.ip !== '—') {
			menuItems.push(E('div', {
				'class': 'qx-portal-item',
				'click': function() {
					dropdown.remove();
					navigator.clipboard.writeText(c.ip);
					ui.addNotification(null, E('p', _('Copied IP address: %s').format(c.ip)), 'info');
				}
			}, [ '🌐', _('Copy IP Address') ]));
		}

		menuItems.push(E('div', { 'class': 'qx-portal-divider' }));

		// Block / Unblock
		if (!c.is_blocked) {
			menuItems.push(E('div', {
				'class': 'qx-portal-item qx-portal-danger',
				'click': function() {
					dropdown.remove();
					self.blockClient(c);
				}
			}, [ '🚫', _('Block Device') ]));
		} else {
			menuItems.push(E('div', {
				'class': 'qx-portal-item',
				'style': 'color: #2dce89;',
				'click': function() {
					dropdown.remove();
					self.unblockClient(c);
				}
			}, [ '✓', _('Unblock Device') ]));
		}

		// Delete Record for Offline Client
		if (!isOnline) {
			menuItems.push(E('div', { 'class': 'qx-portal-divider' }));
			menuItems.push(E('div', {
				'class': 'qx-portal-item qx-portal-danger',
				'click': function() {
					dropdown.remove();
					if (confirm(_('Delete history record and data usage history for "%s" (%s)?').format(c.hostname || c.mac, c.mac))) {
						callDeleteOfflineClient(c.mac, c.ip).then(function(res) {
							ui.addNotification(null, E('p', res.message || _('Device record deleted.')), 'info');
							self.refreshClients();
						}).catch(function(err) {
							ui.addNotification(null, E('p', _('Error: %s').format(err.message || err)), 'error');
						});
					}
				}
			}, [ '🗑️', _('Delete Record') ]));
		}

		var dropdown = E('div', {
			'id': 'qx-active-portal',
			'class': 'qx-portal-dropdown'
		}, menuItems);

		document.body.appendChild(dropdown);

		var menuWidth = 210;
		var leftPos = rect.right - menuWidth;
		if (leftPos < 10) leftPos = 10;
		var topPos = rect.bottom + 6;

		dropdown.style.top = topPos + 'px';
		dropdown.style.left = leftPos + 'px';
	},

	showGlobalSpeedLimitModal: function() {
		var self = this;
		var current = self.state.globalQos || { enabled: false, scope: 'both', down_mbps: 20, up_mbps: 5 };

		var enableCheck = E('input', {
			'type': 'checkbox',
			'checked': current.enabled ? true : false,
			'style': 'width: 18px; height: 18px; cursor: pointer;'
		});

		var scopeSelect = E('select', { 'class': 'cbi-input-select', 'style': 'width: 100%; padding: 8px;' }, [
			E('option', { 'value': 'both', 'selected': current.scope === 'both' || current.scope === 'all' }, _('🌐 All Devices (Wi-Fi + Wired LAN)')),
			E('option', { 'value': 'wifi', 'selected': current.scope === 'wifi' }, _('📶 Wi-Fi Devices Only (2.4G & 5G)')),
			E('option', { 'value': 'lan', 'selected': current.scope === 'lan' }, _('🔌 Wired LAN Devices Only'))
		]);

		var downInput = E('input', {
			'type': 'number',
			'class': 'cbi-input-text',
			'style': 'width: 100%; padding: 8px 12px;',
			'placeholder': 'e.g. 25',
			'value': current.down_mbps > 0 ? current.down_mbps : '20'
		});

		var upInput = E('input', {
			'type': 'number',
			'class': 'cbi-input-text',
			'style': 'width: 100%; padding: 8px 12px;',
			'placeholder': 'e.g. 5',
			'value': current.up_mbps > 0 ? current.up_mbps : '5'
		});

		var modalContent = E('div', {}, [
			E('div', { 'style': 'display: flex; align-items: center; gap: 10px; margin-bottom: 16px; background: rgba(94, 114, 228, 0.08); padding: 12px 16px; border-radius: 8px;' }, [
				enableCheck,
				E('label', { 'style': 'font-weight: 700; font-size: 14px; cursor: pointer;', 'click': function() { enableCheck.checked = !enableCheck.checked; } }, _('Enable Global Bandwidth Limit'))
			]),
			E('div', { 'style': 'margin-bottom: 16px;' }, [
				E('label', { 'style': 'font-size: 12px; font-weight: 600; display: block; margin-bottom: 6px;' }, _('Apply Limit To:')),
				scopeSelect
			]),
			E('div', { 'style': 'display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;' }, [
				E('div', {}, [
					E('label', { 'style': 'font-size: 12px; font-weight: 600; display: block; margin-bottom: 6px;' }, _('Download Cap (Mbps)')),
					downInput
				]),
				E('div', {}, [
					E('label', { 'style': 'font-size: 12px; font-weight: 600; display: block; margin-bottom: 6px;' }, _('Upload Cap (Mbps)')),
					upInput
				])
			]),
			E('div', { 'style': 'background: rgba(94, 114, 228, 0.12); border: 1px solid rgba(94, 114, 228, 0.3); border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #5e72e4; margin-bottom: 20px;' }, [
				_('Global bandwidth shaping applies hardware rate limits across selected interfaces.')
			]),
			E('div', { 'style': 'display: flex; justify-content: flex-end; gap: 10px;' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Cancel')),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'click': function() {
						var isEn = enableCheck.checked;
						var scope = scopeSelect.value;
						var downVal = parseInt(downInput.value) || 0;
						var upVal = parseInt(upInput.value) || 0;

						ui.showModal(_('Applying Global Speed Limit...'), [
							E('p', { 'class': 'spinning' }, _('Updating firewall traffic scheduler rules...'))
						]);

						callSetGlobalSpeedLimit(scope, downVal, upVal, isEn).then(function(res) {
							ui.hideModal();
							if (res && res.success) {
								ui.addNotification(null, E('p', res.message), 'info');
								self.refreshClients();
							} else {
								ui.addNotification(null, E('p', _('Failed to set global limit: %s').format(res.message || 'Error')), 'error');
							}
						}).catch(function(err) {
							ui.hideModal();
							ui.addNotification(null, E('p', _('Error: %s').format(err.message || err)), 'error');
						});
					}
				}, _('Save & Apply'))
			])
		]);

		ui.showModal(_('Global Bandwidth Control (QoS)'), [ modalContent ]);
	},

	showSpeedLimitModal: function(c) {
		var self = this;
		var devName = c.hostname || c.mac;
		var currentDown = (c.qos && c.qos.down_mbps) ? c.qos.down_mbps : '';
		var currentUp = (c.qos && c.qos.up_mbps) ? c.qos.up_mbps : '';

		var downInput = E('input', {
			'type': 'number',
			'class': 'cbi-input-text',
			'style': 'width: 100%; padding: 8px 12px;',
			'placeholder': 'e.g. 25 (0 to disable)',
			'value': currentDown
		});

		var upInput = E('input', {
			'type': 'number',
			'class': 'cbi-input-text',
			'style': 'width: 100%; padding: 8px 12px;',
			'placeholder': 'e.g. 5 (0 to disable)',
			'value': currentUp
		});

		var modalContent = E('div', {}, [
			E('p', { 'style': 'opacity: 0.85; margin-bottom: 16px;' }, _('Set hardware traffic rate limit for <strong>%s</strong> (<code>%s</code>):').format(devName, c.ip || c.mac)),
			E('div', { 'style': 'display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;' }, [
				E('div', {}, [
					E('label', { 'style': 'font-size: 12px; font-weight: 600; display: block; margin-bottom: 6px;' }, _('Download Cap (Mbps)')),
					downInput
				]),
				E('div', {}, [
					E('label', { 'style': 'font-size: 12px; font-weight: 600; display: block; margin-bottom: 6px;' }, _('Upload Cap (Mbps)')),
					upInput
				])
			]),
			E('div', { 'style': 'background: rgba(94, 114, 228, 0.12); border: 1px solid rgba(94, 114, 228, 0.3); border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #5e72e4; margin-bottom: 20px;' }, [
				_('Bandwidth throttle rules are applied directly to the kernel network packet scheduler.')
			]),
			E('div', { 'style': 'display: flex; justify-content: flex-end; gap: 10px;' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Cancel')),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'click': function() {
						var downVal = parseInt(downInput.value) || 0;
						var upVal = parseInt(upInput.value) || 0;

						ui.showModal(_('Applying Speed Limit...'), [
							E('p', { 'class': 'spinning' }, _('Configuring traffic filter rules for %s...').format(c.ip))
						]);

						callSetSpeedLimit(c.mac, c.ip, downVal, upVal).then(function(res) {
							ui.hideModal();
							if (res && res.success) {
								ui.addNotification(null, E('p', res.message), 'info');
								self.refreshClients();
							} else {
								ui.addNotification(null, E('p', _('Failed to set speed limit: %s').format(res.message || 'Error')), 'error');
							}
						}).catch(function(err) {
							ui.hideModal();
							ui.addNotification(null, E('p', _('Error: %s').format(err.message || err)), 'error');
						});
					}
				}, _('Apply Limit'))
			])
		]);

		ui.showModal(_('Speed Limit / Bandwidth Control') + ' — ' + devName, [ modalContent ]);
	},

	kickClient: function(c) {
		var devName = c.hostname || c.mac;
		if (!confirm(_('Force disconnect "%s" (%s)?').format(devName, c.mac))) return;

		var hapdObj = 'hostapd.' + (c.interface || 'phy0-ap0');
		var callHapdKick = rpc.declare({
			object: hapdObj,
			method: 'del_client',
			params: ['addr', 'reason', 'deauth', 'ban_time'],
			expect: { '': {} }
		});

		callHapdKick(c.mac, 1, true, 0).then(function() {
			ui.addNotification(null, E('p', _('Client %s deauthenticated.').format(c.mac)), 'info');
		}).catch(function() {
			ui.addNotification(null, E('p', _('Deauthentication frame sent to %s.').format(c.mac)), 'info');
		});
	},

	blockClient: function(c) {
		var self = this;
		var devName = c.hostname || c.mac;

		if (!confirm(_('Are you sure you want to BLOCK "%s" (%s)?\n\nThis will add the device to the MAC Filter blocklist and immediately prevent it from accessing the Wi-Fi networks.').format(devName, c.mac))) {
			return;
		}

		ui.showModal(_('Blocking Client...'), [
			E('p', { 'class': 'spinning' }, _('Adding %s to Blocklist...').format(c.mac))
		]);

		callValidateMacFilter(c.mac + '\n', '').then(function() {
			return callApplyMacFilter('deny', 'add', 'blocked_client.txt').then(function(res) {
				ui.hideModal();
				if (res.success) {
					ui.addNotification(null, E('p', _('Device %s (%s) has been successfully BLOCKED.').format(devName, c.mac)), 'info');
					if (c.conn_type === 'wifi') self.kickClient(c);
				} else {
					ui.addNotification(null, E('p', _('Failed to block client: %s').format(res.message || 'Error')), 'error');
				}
			});
		}).catch(function(err) {
			ui.hideModal();
			ui.addNotification(null, E('p', _('Error blocking client: %s').format(err.message || err)), 'error');
		});
	},

	unblockClient: function(c) {
		ui.showModal(_('Unblocking Client...'), [
			E('p', { 'class': 'spinning' }, _('Removing %s from Blocklist...').format(c.mac))
		]);

		callApplyMacFilter('disabled', 'replace', 'none').then(function(res) {
			ui.hideModal();
			ui.addNotification(null, E('p', _('Device %s (%s) unblocked successfully.').format(c.hostname || c.mac, c.mac)), 'info');
		}).catch(function(err) {
			ui.hideModal();
			ui.addNotification(null, E('p', _('Error unblocking: %s').format(err.message || err)), 'error');
		});
	},

	showClientModal: function(c) {
		var self = this;
		var rows = [
			[ _('Device Name / Hostname'), c.hostname || _('Unknown Device') ],
			[ _('MAC Address'), c.mac ],
			[ _('IPv4 Address'), c.ip || _('Unavailable') ],
			[ _('Connection Medium'), c.conn_type === 'wifi' ? _('Wi-Fi Wireless (%s)').format(c.radio || '2.4G') : _('Ethernet Wired') ],
			[ _('Physical Interface'), c.interface || 'LAN' ],
			[ _('Current Download Rate'), self.formatSpeed(c.rx_speed) ],
			[ _('Current Upload Rate'), self.formatSpeed(c.tx_speed) ],
			[ _('Total Cumulative Download (RX)'), self.formatBytes(c.rx_bytes) ],
			[ _('Total Cumulative Upload (TX)'), self.formatBytes(c.tx_bytes) ]
		];

		if (c.conn_type === 'wifi') {
			rows.push([ _('SSID'), c.ssid || 'OpenWrt' ]);
			rows.push([ _('Radio Band'), c.radio || '2.4G' ]);
			rows.push([ _('Frequency / Channel'), (c.frequency ? c.frequency + ' MHz' : '-') ]);
			rows.push([ _('Signal Strength'), (c.signal ? c.signal + ' dBm' : _('Unavailable')) ]);
			rows.push([ _('Link PHY TX Rate'), c.tx_rate_kbps ? ((c.tx_rate_kbps > 1000 ? (c.tx_rate_kbps/1000).toFixed(1) + ' Mbps' : c.tx_rate_kbps + ' kbps')) : _('Auto') ]);
			rows.push([ _('Link PHY RX Rate'), c.rx_rate_kbps ? ((c.rx_rate_kbps > 1000 ? (c.rx_rate_kbps/1000).toFixed(1) + ' Mbps' : c.rx_rate_kbps + ' kbps')) : _('Auto') ]);
			rows.push([ _('Connected Duration'), self.formatDuration(c.connected_time) ]);
		}

		if (c.qos && (c.qos.down_mbps > 0 || c.qos.up_mbps > 0)) {
			rows.push([ _('QoS Speed Limit'), _('↓ %d Mbps / ↑ %d Mbps').format(c.qos.down_mbps, c.qos.up_mbps) ]);
		}

		var table = E('table', { 'class': 'table cbi-section-table', 'style': 'margin-top: 10px;' });
		rows.forEach(function(r) {
			var valCell = E('td', { 'class': 'td' });
			valCell.innerHTML = r[1];
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'style': 'font-weight: 600; width: 40%; opacity: 0.8;' }, r[0]),
				valCell
			]));
		});

		ui.showModal((c.hostname || c.mac) + ' — ' + _('Client Details & Lifetime Statistics'), [
			table,
			E('div', { 'class': 'right', 'style': 'margin-top: 20px; display: flex; justify-content: flex-end;' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Close'))
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
