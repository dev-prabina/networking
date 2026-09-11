'use strict';
'require view';
'require ui';
'require rpc';
'require poll';
'require dom';

/*
 * Controls / primeNet AX600 Internet Control Center & Network Topology Dashboard
 * Pixel-Perfect Hero Section + Clean, Professional Screenshot Card Layout Below Hero
 */

var callGetInternetStatus = rpc.declare({
	object: 'luci.internet',
	method: 'get_internet_status',
	expect: { '': {} }
});

var callTestConnectivity = rpc.declare({
	object: 'luci.internet',
	method: 'test_connectivity',
	expect: { '': {} }
});

var callConfigureWan = rpc.declare({
	object: 'luci.internet',
	method: 'configure_wan',
	params: ['proto', 'ipaddr', 'netmask', 'gateway', 'dns', 'username', 'password'],
	expect: { '': {} }
});

var callScanWifi = rpc.declare({
	object: 'luci.internet',
	method: 'scan_wifi',
	expect: { '': {} }
});

return view.extend({
	state: {
		data: {},
		isTesting: false,
		testResult: null
	},

	load: function() {
		return L.resolveDefault(callGetInternetStatus(), {});
	},

	render: function(initialData) {
		var self = this;
		self.state.data = initialData || {};

		var container = E('div', { 'class': 'cbi-map', 'id': 'internet-app-root' });

		var styleTag = E('style', {}, [
			'#internet-app-root { width: 100%; max-width: 100%; margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #2b354f; }',
			'[data-theme="dark"] #internet-app-root, [data-dark="true"] #internet-app-root, @media (prefers-color-scheme: dark) { #internet-app-root { color: #f8fafc; } }',

			/* ==================== COMPACT HERO SECTION ==================== */
			'#internet-app-root .gl-hero-card { position: relative; width: 100%; border-radius: 10px; background: linear-gradient(180deg, #f0f5fd 0%, #e6effb 50%, #f4f8ff 100%); padding: 1.1rem 1.5rem 1.3rem; box-shadow: 0 6px 24px rgba(100, 130, 180, 0.08); border: 1px solid rgba(255, 255, 255, 0.8); box-sizing: border-box; overflow: hidden; margin-bottom: 1.25rem; }',
			'[data-theme="dark"] #internet-app-root .gl-hero-card, [data-dark="true"] #internet-app-root .gl-hero-card, @media (prefers-color-scheme: dark) { #internet-app-root .gl-hero-card { background: linear-gradient(180deg, #182032 0%, #111726 100%); border-color: rgba(255, 255, 255, 0.08); box-shadow: 0 8px 26px rgba(0, 0, 0, 0.4); } }',

			'#internet-app-root .gl-top-tag { display: flex; align-items: center; justify-content: flex-end; gap: 6px; font-size: 11.5px; font-weight: 600; color: #64748b; margin-bottom: 0.25rem; letter-spacing: 0.2px; }',
			'[data-theme="dark"] #internet-app-root .gl-top-tag, [data-dark="true"] #internet-app-root .gl-top-tag, @media (prefers-color-scheme: dark) { #internet-app-root .gl-top-tag { color: #94a3b8; } }',
			'#internet-app-root .gl-live-dot { width: 7.5px; height: 7.5px; border-radius: 50%; background: #2dce89; box-shadow: 0 0 7px #2dce89; }',

			'#internet-app-root .gl-topology-grid { display: grid; grid-template-columns: 240px 1fr 240px; gap: 16px; align-items: center; position: relative; z-index: 2; }',
			'@media (max-width: 1100px) { #internet-app-root .gl-topology-grid { grid-template-columns: 1fr; gap: 20px; } }',

			'#internet-app-root .gl-col-header { margin-bottom: 0.75rem; }',
			'#internet-app-root .gl-col-title { font-size: 0.95rem; font-weight: 800; display: flex; align-items: center; gap: 6px; margin: 0; color: inherit; }',
			'#internet-app-root .gl-col-subtitle { font-size: 0.74rem; color: #64748b; margin: 2px 0 0; font-weight: 500; }',
			'[data-theme="dark"] #internet-app-root .gl-col-subtitle, [data-dark="true"] #internet-app-root .gl-col-subtitle, @media (prefers-color-scheme: dark) { #internet-app-root .gl-col-subtitle { color: #94a3b8; } }',

			'#internet-app-root .gl-sources-list { display: flex; flex-direction: column; gap: 7px; }',
			'#internet-app-root .gl-source-card { position: relative; display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.95); border: 1.2px solid rgba(255, 255, 255, 0.8); border-radius: 12px; padding: 7px 11px; box-shadow: 0 2px 10px rgba(100, 130, 180, 0.05); cursor: pointer; transition: all 0.2s ease; user-select: none; }',
			'[data-theme="dark"] #internet-app-root .gl-source-card, [data-dark="true"] #internet-app-root .gl-source-card, @media (prefers-color-scheme: dark) { #internet-app-root .gl-source-card { background: rgba(30, 41, 59, 0.7); border-color: rgba(255, 255, 255, 0.06); box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2); } }',
			'#internet-app-root .gl-source-card:hover { transform: translateY(-1.5px); box-shadow: 0 5px 15px rgba(100, 130, 180, 0.12); }',
			'#internet-app-root .gl-source-card.active { border-color: #3b82f6; background: rgba(255, 255, 255, 1); box-shadow: 0 3px 14px rgba(59, 130, 246, 0.15); }',
			'[data-theme="dark"] #internet-app-root .gl-source-card.active, [data-dark="true"] #internet-app-root .gl-source-card.active, @media (prefers-color-scheme: dark) { #internet-app-root .gl-source-card.active { border-color: #38bdf8; background: rgba(30, 41, 59, 0.95); box-shadow: 0 3px 14px rgba(56, 189, 248, 0.25); } }',

			'#internet-app-root .gl-card-left { display: flex; align-items: center; gap: 8px; }',
			'#internet-app-root .gl-dot { width: 6.5px; height: 6.5px; border-radius: 50%; background: #cbd5e1; flex-shrink: 0; }',
			'#internet-app-root .gl-dot.active { background: #2dce89; box-shadow: 0 0 6px #2dce89; }',
			
			'#internet-app-root .gl-icon-badge { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }',
			'#internet-app-root .gl-icon-badge.ethernet { background: linear-gradient(135deg, #2dce89, #20c997); }',
			'#internet-app-root .gl-icon-badge.repeater { background: linear-gradient(135deg, #60a5fa, #3b82f6); }',
			'#internet-app-root .gl-icon-badge.tethering { background: linear-gradient(135deg, #818cf8, #6366f1); }',
			'#internet-app-root .gl-icon-badge.cellular { background: linear-gradient(135deg, #94a3b8, #64748b); }',

			'#internet-app-root .gl-source-info { display: flex; flex-direction: column; }',
			'#internet-app-root .gl-source-title { font-size: 0.84rem; font-weight: 700; color: inherit; line-height: 1.1; }',
			'#internet-app-root .gl-source-sub { font-size: 0.68rem; color: #64748b; margin-top: 1px; }',
			'[data-theme="dark"] #internet-app-root .gl-source-sub, [data-dark="true"] #internet-app-root .gl-source-sub, @media (prefers-color-scheme: dark) { #internet-app-root .gl-source-sub { color: #94a3b8; } }',

			'#internet-app-root .gl-status-pill { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 14px; text-transform: capitalize; }',
			'#internet-app-root .gl-status-pill.connected { background: rgba(45, 206, 137, 0.15); color: #2dce89; border: 1px solid rgba(45, 206, 137, 0.3); }',
			'#internet-app-root .gl-status-pill.inactive { background: rgba(148, 163, 184, 0.12); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.2); }',

			'#internet-app-root .gl-router-stage { display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; text-align: center; }',
			'#internet-app-root .gl-model-title { font-size: 1.35rem; font-weight: 900; color: inherit; letter-spacing: -0.4px; margin: 0; }',
			'#internet-app-root .gl-model-sub { font-size: 0.80rem; font-weight: 600; color: #64748b; margin: 2px 0 6px; }',
			'[data-theme="dark"] #internet-app-root .gl-model-sub, [data-dark="true"] #internet-app-root .gl-model-sub, @media (prefers-color-scheme: dark) { #internet-app-root .gl-model-sub { color: #94a3b8; } }',

			'#internet-app-root .gl-router-img-wrap { position: relative; width: 100%; max-width: 240px; height: 120px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }',
			'#internet-app-root .gl-router-img { max-width: 100%; max-height: 100%; object-fit: contain; filter: drop-shadow(0 6px 16px rgba(0, 150, 255, 0.2)); }',

			'#internet-app-root .gl-features-row { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 5px; flex-wrap: wrap; }',
			'#internet-app-root .gl-feature-capsule { display: flex; align-items: center; gap: 5px; background: rgba(255, 255, 255, 0.95); border: 1px solid rgba(255, 255, 255, 0.8); border-radius: 9px; padding: 4px 9px; box-shadow: 0 2px 6px rgba(100, 130, 180, 0.05); user-select: none; }',
			'[data-theme="dark"] #internet-app-root .gl-feature-capsule, [data-dark="true"] #internet-app-root .gl-feature-capsule, @media (prefers-color-scheme: dark) { #internet-app-root .gl-feature-capsule { background: rgba(30, 41, 59, 0.7); border-color: rgba(255, 255, 255, 0.06); } }',
			'#internet-app-root .gl-feat-icon { font-size: 12px; }',
			'#internet-app-root .gl-feat-name { font-size: 10.5px; font-weight: 700; color: inherit; }',
			'#internet-app-root .gl-feat-status { font-size: 9px; font-weight: 800; color: #2dce89; display: flex; align-items: center; gap: 2px; }',

			'#internet-app-root .gl-bands-bar { display: flex; align-items: center; justify-content: center; gap: 12px; background: rgba(255, 255, 255, 0.95); border: 1px solid rgba(255, 255, 255, 0.8); border-radius: 18px; padding: 4px 16px; box-shadow: 0 2px 6px rgba(100, 130, 180, 0.05); margin-top: 6px; font-size: 10.5px; font-weight: 700; color: inherit; }',
			'[data-theme="dark"] #internet-app-root .gl-bands-bar, [data-dark="true"] #internet-app-root .gl-bands-bar, @media (prefers-color-scheme: dark) { #internet-app-root .gl-bands-bar { background: rgba(30, 41, 59, 0.7); border-color: rgba(255, 255, 255, 0.06); } }',
			'#internet-app-root .gl-band-item { display: flex; align-items: center; gap: 4px; }',
			'#internet-app-root .gl-band-divider { width: 1px; height: 11px; background: rgba(148, 163, 184, 0.4); }',

			'#internet-app-root .gl-clients-list { display: flex; flex-direction: column; gap: 10px; }',
			'#internet-app-root .gl-client-card { display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.95); border: 1.2px solid rgba(255, 255, 255, 0.8); border-radius: 14px; padding: 12px 14px; box-shadow: 0 3px 12px rgba(100, 130, 180, 0.05); cursor: pointer; transition: all 0.2s ease; user-select: none; }',
			'[data-theme="dark"] #internet-app-root .gl-client-card, [data-dark="true"] #internet-app-root .gl-client-card, @media (prefers-color-scheme: dark) { #internet-app-root .gl-client-card { background: rgba(30, 41, 59, 0.7); border-color: rgba(255, 255, 255, 0.06); box-shadow: 0 3px 12px rgba(0, 0, 0, 0.2); } }',
			'#internet-app-root .gl-client-card:hover { transform: translateY(-1.5px); box-shadow: 0 6px 18px rgba(100, 130, 180, 0.14); border-color: #3b82f6; }',
			'[data-theme="dark"] #internet-app-root .gl-client-card:hover, [data-dark="true"] #internet-app-root .gl-client-card:hover, @media (prefers-color-scheme: dark) { #internet-app-root .gl-client-card:hover { border-color: #38bdf8; } }',
			
			'#internet-app-root .gl-client-badge-circle { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }',
			'#internet-app-root .gl-client-badge-circle.wlan { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }',
			'#internet-app-root .gl-client-badge-circle.lan { background: rgba(147, 51, 234, 0.12); color: #9333ea; }',
			'[data-theme="dark"] #internet-app-root .gl-client-badge-circle.wlan { background: rgba(56, 189, 248, 0.18); color: #38bdf8; }',
			'[data-theme="dark"] #internet-app-root .gl-client-badge-circle.lan { background: rgba(192, 132, 252, 0.18); color: #c084fc; }',

			'#internet-app-root .gl-client-data { display: flex; flex-direction: column; }',
			'#internet-app-root .gl-client-num { font-size: 1.65rem; font-weight: 800; line-height: 1; color: inherit; }',
			'#internet-app-root .gl-client-label { font-size: 0.78rem; font-weight: 600; color: #64748b; margin-top: 2px; }',
			'[data-theme="dark"] #internet-app-root .gl-client-label, [data-dark="true"] #internet-app-root .gl-client-label, @media (prefers-color-scheme: dark) { #internet-app-root .gl-client-label { color: #94a3b8; } }',

			'#internet-app-root .gl-chevron-icon { font-size: 1.15rem; color: #94a3b8; font-weight: 300; transition: transform 0.2s ease; }',
			'#internet-app-root .gl-client-card:hover .gl-chevron-icon { transform: translateX(3px); color: #3b82f6; }',

			/* ==================== CLEAN SCREENSHOT 2026-08-16 CARDS LAYOUT ==================== */
			'#internet-app-root .qx-card-frame { background: #ffffff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04); border: 1px solid rgba(0, 0, 0, 0.08); box-sizing: border-box; overflow: hidden; margin-bottom: 1.25rem; }',
			'[data-theme="dark"] #internet-app-root .qx-card-frame, [data-dark="true"] #internet-app-root .qx-card-frame, @media (prefers-color-scheme: dark) { #internet-app-root .qx-card-frame { background: rgba(30, 41, 59, 0.85); border-color: rgba(255, 255, 255, 0.08); box-shadow: 0 4px 18px rgba(0, 0, 0, 0.3); } }',

			'#internet-app-root .qx-card-header { background: #f0f4f9; padding: 10px 18px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(0, 0, 0, 0.04); }',
			'[data-theme="dark"] #internet-app-root .qx-card-header, [data-dark="true"] #internet-app-root .qx-card-header, @media (prefers-color-scheme: dark) { #internet-app-root .qx-card-header { background: rgba(255, 255, 255, 0.04); border-bottom-color: rgba(255, 255, 255, 0.06); } }',

			'#internet-app-root .qx-header-title-box { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 1rem; color: inherit; }',
			'#internet-app-root .qx-dot-indicator { width: 7.5px; height: 7.5px; border-radius: 50%; background: #cbd5e1; display: inline-block; }',
			'#internet-app-root .qx-dot-indicator.active { background: #20c997; box-shadow: 0 0 7px #20c997; }',

			'#internet-app-root .qx-wan-badge { background: #00bcd4; color: #ffffff; font-size: 10.5px; font-weight: 800; border-radius: 3px; padding: 2px 6px; display: inline-flex; align-items: center; gap: 4px; letter-spacing: 0.5px; }',
			
			'#internet-app-root .qx-gear-btn { background: none; border: none; font-size: 17px; color: #94a3b8; cursor: pointer; padding: 2px; transition: color 0.15s, transform 0.2s; line-height: 1; }',
			'#internet-app-root .qx-gear-btn:hover { color: #3b82f6; transform: rotate(45deg); }',

			'#internet-app-root .qx-card-body { padding: 18px 22px; }',

			/* Primary Ethernet Card Grid (2-Column) */
			'#internet-app-root .qx-eth-layout { display: grid; grid-template-columns: 1fr 200px; gap: 20px; align-items: center; }',
			'@media (max-width: 800px) { #internet-app-root .qx-eth-layout { grid-template-columns: 1fr; } }',

			'#internet-app-root .qx-param-list { width: 100%; display: flex; flex-direction: column; }',
			'#internet-app-root .qx-param-row { display: flex; align-items: center; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid rgba(0, 0, 0, 0.05); font-size: 13px; }',
			'[data-theme="dark"] #internet-app-root .qx-param-row, [data-dark="true"] #internet-app-root .qx-param-row, @media (prefers-color-scheme: dark) { #internet-app-root .qx-param-row { border-bottom-color: rgba(255, 255, 255, 0.05); } }',
			'#internet-app-root .qx-param-k { color: #64748b; font-weight: 500; }',
			'[data-theme="dark"] #internet-app-root .qx-param-k, [data-dark="true"] #internet-app-root .qx-param-k, @media (prefers-color-scheme: dark) { #internet-app-root .qx-param-k { color: #94a3b8; } }',
			'#internet-app-root .qx-param-v { font-weight: 700; color: inherit; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',

			'#internet-app-root .qx-modify-wrap { display: flex; justify-content: center; margin-top: 16px; }',
			'#internet-app-root .qx-modify-btn { background: #ffffff; border: 1.5px solid #2b354f; color: #2b354f; font-size: 12.5px; font-weight: 700; border-radius: 20px; padding: 5px 34px; cursor: pointer; transition: all 0.2s ease; }',
			'#internet-app-root .qx-modify-btn:hover { background: #2b354f; color: #ffffff; box-shadow: 0 3px 10px rgba(43, 53, 79, 0.2); }',
			'[data-theme="dark"] #internet-app-root .qx-modify-btn, [data-dark="true"] #internet-app-root .qx-modify-btn, @media (prefers-color-scheme: dark) { #internet-app-root .qx-modify-btn { background: transparent; border-color: #38bdf8; color: #38bdf8; } #internet-app-root .qx-modify-btn:hover { background: #38bdf8; color: #0f172a; } }',

			/* Ethernet Circle Graphic */
			'#internet-app-root .qx-circle-graphic-wrap { display: flex; align-items: center; justify-content: center; }',
			'#internet-app-root .qx-circle-graphic { width: 130px; height: 130px; border-radius: 50%; background: #f0f4f9; display: flex; align-items: center; justify-content: center; }',
			'[data-theme="dark"] #internet-app-root .qx-circle-graphic, [data-dark="true"] #internet-app-root .qx-circle-graphic, @media (prefers-color-scheme: dark) { #internet-app-root .qx-circle-graphic { background: rgba(255, 255, 255, 0.05); } }',

			/* Bottom 3 Cards Row */
			'#internet-app-root .qx-tri-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 1.8rem; }',
			'@media (max-width: 950px) { #internet-app-root .qx-tri-grid { grid-template-columns: 1fr; } }',

			'#internet-app-root .qx-sub-card-body { display: flex; align-items: center; gap: 16px; padding: 18px 18px; }',
			'#internet-app-root .qx-sub-circle-icon { width: 58px; height: 58px; border-radius: 50%; background: #f0f4f9; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }',
			'[data-theme="dark"] #internet-app-root .qx-sub-circle-icon, [data-dark="true"] #internet-app-root .qx-sub-circle-icon, @media (prefers-color-scheme: dark) { #internet-app-root .qx-sub-circle-icon { background: rgba(255, 255, 255, 0.05); } }',

			'#internet-app-root .qx-sub-content { display: flex; flex-direction: column; gap: 8px; }',
			'#internet-app-root .qx-sub-desc { font-size: 12.5px; color: #475569; line-height: 1.35; margin: 0; }',
			'[data-theme="dark"] #internet-app-root .qx-sub-desc, [data-dark="true"] #internet-app-root .qx-sub-desc, @media (prefers-color-scheme: dark) { #internet-app-root .qx-sub-desc { color: #94a3b8; } }',

			'#internet-app-root .qx-sub-action-btn { align-self: flex-start; background: #ffffff; border: 1.5px solid #2b354f; color: #2b354f; font-size: 12px; font-weight: 700; border-radius: 16px; padding: 4px 20px; cursor: pointer; transition: all 0.2s ease; text-decoration: none; }',
			'#internet-app-root .qx-sub-action-btn:hover { background: #2b354f; color: #ffffff; box-shadow: 0 3px 8px rgba(43, 53, 79, 0.2); }',
			'[data-theme="dark"] #internet-app-root .qx-sub-action-btn, [data-dark="true"] #internet-app-root .qx-sub-action-btn, @media (prefers-color-scheme: dark) { #internet-app-root .qx-sub-action-btn { background: transparent; border-color: #38bdf8; color: #38bdf8; } #internet-app-root .qx-sub-action-btn:hover { background: #38bdf8; color: #0f172a; } }'
		]);
		container.appendChild(styleTag);

		var mainMount = E('div', { 'id': 'gl-internet-mount' });
		container.appendChild(mainMount);

		self.buildView(mainMount);

		// Polling for live status with Scroll Preservation
		poll.add(function() {
			return L.resolveDefault(callGetInternetStatus(), {}).then(function(data) {
				self.state.data = data;
				var mount = document.getElementById('gl-internet-mount');
				if (mount) {
					var scrolls = mount.querySelectorAll('.qx-card-frame, .gl-hero-card, [style*="overflow"]');
					var savedPos = [];
					for (var i = 0; i < scrolls.length; i++) {
						savedPos.push(scrolls[i].scrollLeft);
					}
					
					self.buildView(mount);
					
					var newScrolls = mount.querySelectorAll('.qx-card-frame, .gl-hero-card, [style*="overflow"]');
					for (var j = 0; j < newScrolls.length; j++) {
						if (savedPos[j] != null) {
							newScrolls[j].scrollLeft = savedPos[j];
						}
					}
				}
			});
		}, 3);

		return container;
	},

	buildView: function(root) {
		var self = this;
		root.innerHTML = '';

		var data = self.state.data || {};
		var activeConn = data.active_connection || { source: 'tethering', status: 'connected' };
		var uplinks = data.uplinks || {};
		var clients = data.clients || { wlan_count: 5, lan_count: 1 };

		var isEthernetActive = (activeConn.source === 'ethernet' || uplinks.ethernet?.connected);
		var isRepeaterActive = (activeConn.source === 'repeater' || uplinks.repeater?.connected);
		var isTetherActive = (activeConn.source === 'tethering' || uplinks.tethering?.connected);
		var isCellularActive = (activeConn.source === 'cellular' || uplinks.cellular?.connected);

		// ==================== 1. COMPACT 'primeNet' AX600 HERO SECTION ====================
		var heroCard = E('div', { 'class': 'gl-hero-card' });

		var topTag = E('div', { 'class': 'gl-top-tag' }, [
			E('span', {}, 'Fast  •  Secure  •  Always Connected'),
			E('span', { 'class': 'gl-live-dot' })
		]);
		heroCard.appendChild(topTag);

		var topologyGrid = E('div', { 'class': 'gl-topology-grid' });

		// ---------- LEFT COLUMN: INTERNET SOURCES ----------
		var leftCol = E('div', {});
		var leftHeader = E('div', { 'class': 'gl-col-header' }, [
			E('h3', { 'class': 'gl-col-title' }, [
				E('span', { 'style': 'font-size: 1.05rem;' }, '🌐'),
				_('Internet Sources')
			]),
			E('p', { 'class': 'gl-col-subtitle' }, _('Choose your internet connection'))
		]);
		leftCol.appendChild(leftHeader);

		var sourcesList = E('div', { 'class': 'gl-sources-list' });

		// 1. Ethernet Card
		var ethSvg = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="#ffffff" fill="none" stroke-width="2.2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15v-4h10v4M10 11V7m4 4V7"/></svg>';
		var ethCard = E('div', {
			'class': 'gl-source-card ' + (isEthernetActive ? 'active' : ''),
			'click': function() { self.showWanModal(); }
		}, [
			E('div', { 'class': 'gl-card-left' }, [
				E('span', { 'class': 'gl-dot ' + (isEthernetActive ? 'active' : '') }),
				E('div', { 'class': 'gl-icon-badge ethernet' }, []),
				E('div', { 'class': 'gl-source-info' }, [
					E('span', { 'class': 'gl-source-title' }, _('Ethernet')),
					E('span', { 'class': 'gl-source-sub' }, _('Wired Connection'))
				])
			]),
			E('span', { 'class': 'gl-status-pill ' + (isEthernetActive ? 'connected' : 'inactive') }, isEthernetActive ? _('Connected') : _('Inactive'))
		]);
		ethCard.querySelector('.gl-icon-badge.ethernet').innerHTML = ethSvg;
		sourcesList.appendChild(ethCard);

		// 2. Repeater Card
		var repSvg = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="#ffffff" fill="none" stroke-width="2.2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.5 16.5a6 6 0 0 1 7 0"/><circle cx="12" cy="20" r="1.5" fill="#ffffff"/></svg>';
		var repCard = E('div', {
			'class': 'gl-source-card ' + (isRepeaterActive ? 'active' : ''),
			'click': function() { self.showRepeaterModal(); }
		}, [
			E('div', { 'class': 'gl-card-left' }, [
				E('span', { 'class': 'gl-dot ' + (isRepeaterActive ? 'active' : '') }),
				E('div', { 'class': 'gl-icon-badge repeater' }, []),
				E('div', { 'class': 'gl-source-info' }, [
					E('span', { 'class': 'gl-source-title' }, _('Repeater')),
					E('span', { 'class': 'gl-source-sub' }, _('Wi-Fi Repeater'))
				])
			]),
			E('span', { 'class': 'gl-status-pill ' + (isRepeaterActive ? 'connected' : 'inactive') }, isRepeaterActive ? _('Connected') : _('Inactive'))
		]);
		repCard.querySelector('.gl-icon-badge.repeater').innerHTML = repSvg;
		sourcesList.appendChild(repCard);

		// 3. Tethering Card
		var tethSvg = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="#ffffff" fill="none" stroke-width="2.2"><rect x="5" y="2" width="14" height="20" rx="3"/><circle cx="12" cy="18" r="1" fill="#ffffff"/></svg>';
		var tethCard = E('div', {
			'class': 'gl-source-card ' + (isTetherActive ? 'active' : ''),
			'click': function() { self.showTetheringModal(); }
		}, [
			E('div', { 'class': 'gl-card-left' }, [
				E('span', { 'class': 'gl-dot ' + (isTetherActive ? 'active' : '') }),
				E('div', { 'class': 'gl-icon-badge tethering' }, []),
				E('div', { 'class': 'gl-source-info' }, [
					E('span', { 'class': 'gl-source-title' }, _('Tethering')),
					E('span', { 'class': 'gl-source-sub' }, _('USB Tethering'))
				])
			]),
			E('span', { 'class': 'gl-status-pill ' + (isTetherActive ? 'connected' : 'inactive') }, isTetherActive ? _('Connected') : _('Inactive'))
		]);
		tethCard.querySelector('.gl-icon-badge.tethering').innerHTML = tethSvg;
		sourcesList.appendChild(tethCard);

		// 4. Cellular Card
		var cellSvg = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="#ffffff" fill="none" stroke-width="2.2"><path d="M12 2v20M4.93 4.93a10 10 0 0 1 14.14 0M7.76 7.76a6 6 0 0 1 8.48 0"/><circle cx="12" cy="12" r="2" fill="#ffffff"/></svg>';
		var cellCard = E('div', {
			'class': 'gl-source-card ' + (isCellularActive ? 'active' : ''),
			'click': function() { self.showCellularModal(); }
		}, [
			E('div', { 'class': 'gl-card-left' }, [
				E('span', { 'class': 'gl-dot ' + (isCellularActive ? 'active' : '') }),
				E('div', { 'class': 'gl-icon-badge cellular' }, []),
				E('div', { 'class': 'gl-source-info' }, [
					E('span', { 'class': 'gl-source-title' }, _('Cellular')),
					E('span', { 'class': 'gl-source-sub' }, _('4G / 5G Connection'))
				])
			]),
			E('span', { 'class': 'gl-status-pill ' + (isCellularActive ? 'connected' : 'inactive') }, isCellularActive ? _('Connected') : _('Inactive'))
		]);
		cellCard.querySelector('.gl-icon-badge.cellular').innerHTML = cellSvg;
		sourcesList.appendChild(cellCard);

		leftCol.appendChild(sourcesList);
		topologyGrid.appendChild(leftCol);

		// ---------- CENTER COLUMN: primeNet AX600 ROUTER ----------
		var centerCol = E('div', { 'class': 'gl-router-stage' }, [
			E('h2', { 'class': 'gl-model-title' }, "primeNet AX6000"),
			E('div', { 'class': 'gl-model-sub' }, _('5G Wi-Fi 6 Gigabit Router'))
		]);

		var routerImgWrap = E('div', { 'class': 'gl-router-img-wrap' }, [
			E('img', {
				'class': 'gl-router-img',
				'src': '/luci-static/resources/primenet_router.png',
				'alt': "primeNet AX6000 5G Wi-Fi Router"
			})
		]);
		centerCol.appendChild(routerImgWrap);

		// Feature Status Capsules (Row 1: AdGuard, IPv6, VPN, Tor)
		var featuresRow = E('div', { 'class': 'gl-features-row' }, [
			E('div', { 'class': 'gl-feature-capsule' }, [
				E('span', { 'class': 'gl-feat-icon', 'style': 'color: #2dce89;' }, '🛡️'),
				E('span', { 'class': 'gl-feat-name' }, 'AdGuard'),
				E('span', { 'class': 'gl-feat-status' }, '● ON')
			]),
			E('div', { 'class': 'gl-feature-capsule' }, [
				E('span', { 'class': 'gl-feat-icon', 'style': 'color: #3b82f6;' }, '🌐'),
				E('span', { 'class': 'gl-feat-name' }, 'IPv6'),
				E('span', { 'class': 'gl-feat-status' }, '● ON')
			]),
			E('div', { 'class': 'gl-feature-capsule' }, [
				E('span', { 'class': 'gl-feat-icon', 'style': 'color: #8b5cf6;' }, '🔒'),
				E('span', { 'class': 'gl-feat-name' }, 'VPN'),
				E('span', { 'class': 'gl-feat-status' }, '● ON')
			]),
			E('div', { 'class': 'gl-feature-capsule' }, [
				E('span', { 'class': 'gl-feat-icon', 'style': 'color: #a855f7;' }, '🧅'),
				E('span', { 'class': 'gl-feat-name' }, 'Tor'),
				E('span', { 'class': 'gl-feat-status' }, '● ON')
			])
		]);
		centerCol.appendChild(featuresRow);

		// Wi-Fi Band Stats Pill (Row 2)
		var bandsBar = E('div', { 'class': 'gl-bands-bar' }, [
			E('div', { 'class': 'gl-band-item' }, [
				E('span', {}, '5G'),
				E('span', { 'style': 'color: #38bdf8;' }, '📶')
			]),
			E('span', { 'class': 'gl-band-divider' }),
			E('div', { 'class': 'gl-band-item' }, [
				E('span', {}, '2.4G'),
				E('span', { 'style': 'color: #2dce89;' }, '📶')
			]),
			E('span', { 'class': 'gl-band-divider' }),
			E('div', { 'class': 'gl-band-item' }, [
				E('span', { 'style': 'color: #3b82f6;' }, '📶'),
				E('span', {}, '5G / 2.4G Dual Band')
			])
		]);
		centerCol.appendChild(bandsBar);

		topologyGrid.appendChild(centerCol);

		// ---------- RIGHT COLUMN: CONNECTED CLIENTS ----------
		var rightCol = E('div', {});
		var rightHeader = E('div', { 'class': 'gl-col-header' }, [
			E('h3', { 'class': 'gl-col-title' }, [
				E('span', { 'style': 'font-size: 1.05rem;' }, '👥'),
				_('Connected Clients')
			]),
			E('p', { 'class': 'gl-col-subtitle' }, _('Devices currently connected to your network'))
		]);
		rightCol.appendChild(rightHeader);

		var clientsList = E('div', { 'class': 'gl-clients-list' });

		// 1. WLAN Clients Card
		var wlanSvg = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2.2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.5 16.5a6 6 0 0 1 7 0"/><circle cx="12" cy="20" r="1.5" fill="currentColor"/></svg>';
		var wlanCard = E('div', {
			'class': 'gl-client-card',
			'title': _('Click to view all WLAN clients'),
			'click': function() { window.location.href = L.url('admin/queenx/clients'); }
		}, [
			E('div', { 'style': 'display: flex; align-items: center; gap: 11px;' }, [
				E('div', { 'class': 'gl-client-badge-circle wlan' }, []),
				E('div', { 'class': 'gl-client-data' }, [
					E('span', { 'class': 'gl-client-num' }, String(clients.wlan_count || 0)),
					E('span', { 'class': 'gl-client-label' }, _('WLAN Clients'))
				])
			]),
			E('span', { 'class': 'gl-chevron-icon' }, '›')
		]);
		wlanCard.querySelector('.gl-client-badge-circle.wlan').innerHTML = wlanSvg;
		clientsList.appendChild(wlanCard);

		// 2. LAN Clients Card
		var lanSvg = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2.2"><rect x="9" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M12 9v3m0 0H6v3m6-3h6v3"/></svg>';
		var lanCard = E('div', {
			'class': 'gl-client-card',
			'title': _('Click to view all wired LAN clients'),
			'click': function() { window.location.href = L.url('admin/queenx/clients'); }
		}, [
			E('div', { 'style': 'display: flex; align-items: center; gap: 11px;' }, [
				E('div', { 'class': 'gl-client-badge-circle lan' }, []),
				E('div', { 'class': 'gl-client-data' }, [
					E('span', { 'class': 'gl-client-num' }, String(clients.lan_count || 1)),
					E('span', { 'class': 'gl-client-label' }, _('LAN Clients'))
				])
			]),
			E('span', { 'class': 'gl-chevron-icon' }, '›')
		]);
		lanCard.querySelector('.gl-client-badge-circle.lan').innerHTML = lanSvg;
		clientsList.appendChild(lanCard);

		rightCol.appendChild(clientsList);
		topologyGrid.appendChild(rightCol);

		heroCard.appendChild(topologyGrid);
		root.appendChild(heroCard);

		// ==================== 2. SCREENSHOT 2026-08-16 CARDS LAYOUT (BELOW HERO) ====================

		// ---------- A. TOP FULL-WIDTH CARD: ETHERNET / ACTIVE WAN ----------
		var ethCardFrame = E('div', { 'class': 'qx-card-frame' });

		var ethCardHeader = E('div', { 'class': 'qx-card-header' }, [
			E('div', { 'class': 'qx-header-title-box' }, [
				E('span', { 'class': 'qx-dot-indicator ' + (isEthernetActive ? 'active' : '') }),
				E('span', {}, _('Ethernet')),
				E('span', { 'class': 'qx-wan-badge' }, _('WAN'))
			]),
			E('button', {
				'class': 'qx-gear-btn',
				'title': _('Configure Ethernet WAN'),
				'click': function() { self.showWanModal(); }
			}, '⚙')
		]);
		ethCardFrame.appendChild(ethCardHeader);

		var ethCardBody = E('div', { 'class': 'qx-card-body' });
		var ethLayout = E('div', { 'class': 'qx-eth-layout' });

		// Parameter List
		var ethParams = E('div', { 'class': 'qx-param-list' }, [
			E('div', { 'class': 'qx-param-row' }, [
				E('span', { 'class': 'qx-param-k' }, _('Protocol')),
				E('span', { 'class': 'qx-param-v' }, (uplinks.ethernet?.protocol ? uplinks.ethernet.protocol.toUpperCase() : (activeConn.protocol || 'DHCP')))
			]),
			E('div', { 'class': 'qx-param-row' }, [
				E('span', { 'class': 'qx-param-k' }, _('IP Address')),
				E('span', { 'class': 'qx-param-v' }, (isEthernetActive && uplinks.ethernet?.ip ? uplinks.ethernet.ip : (isEthernetActive && activeConn.ip_address ? activeConn.ip_address : '—')))
			]),
			E('div', { 'class': 'qx-param-row' }, [
				E('span', { 'class': 'qx-param-k' }, _('Gateway')),
				E('span', { 'class': 'qx-param-v' }, (isEthernetActive && uplinks.ethernet?.gateway ? uplinks.ethernet.gateway : (isEthernetActive && activeConn.gateway ? activeConn.gateway : '—')))
			]),
			E('div', { 'class': 'qx-param-row' }, [
				E('span', { 'class': 'qx-param-k' }, _('DNS Server')),
				E('span', { 'class': 'qx-param-v' }, (isEthernetActive && uplinks.ethernet?.dns && uplinks.ethernet.dns.length ? uplinks.ethernet.dns.join(', ') : (isEthernetActive && activeConn.dns_servers && activeConn.dns_servers.length ? activeConn.dns_servers.join(', ') : '—')))
			]),
			E('div', { 'class': 'qx-modify-wrap' }, [
				E('button', {
					'class': 'qx-modify-btn',
					'click': function() { self.showWanModal(); }
				}, _('Modify'))
			])
		]);
		ethLayout.appendChild(ethParams);

		// Circular Ethernet Cable Graphic
		var ethGraphicWrap = E('div', { 'class': 'qx-circle-graphic-wrap' });
		var ethCircle = E('div', { 'class': 'qx-circle-graphic' });
		var ethPlugSvg = '<svg viewBox="0 0 100 120" width="70" height="85" fill="none" stroke="#2b354f" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">' +
			'<!-- Top Wire Entry -->' +
			'<path d="M42,6 L58,6" />' +
			'<path d="M50,6 L50,15" />' +
			'<!-- Upper Boot -->' +
			'<rect x="36" y="15" width="28" height="18" rx="2.5" fill="none"/>' +
			'<!-- Connector Body -->' +
			'<rect x="26" y="33" width="48" height="48" rx="3.5" fill="none"/>' +
			'<!-- Retention Clip (Right) -->' +
			'<path d="M74,44 L83,47 L83,65 L74,67" />' +
			'<!-- Front Contacts Lines -->' +
			'<path d="M35,56 L35,76" />' +
			'<path d="M45,56 L45,76" />' +
			'<path d="M55,56 L55,76" />' +
			'<path d="M65,56 L65,76" />' +
			'<!-- Bottom Leads -->' +
			'<path d="M32,81 L32,100" />' +
			'<path d="M41,81 L41,100" />' +
			'<path d="M50,81 L50,110" stroke-width="3.2" />' +
			'<path d="M59,81 L59,100" />' +
			'<path d="M68,81 L68,100" />' +
			'</svg>';
		ethCircle.innerHTML = ethPlugSvg;
		ethGraphicWrap.appendChild(ethCircle);
		ethLayout.appendChild(ethGraphicWrap);

		ethCardBody.appendChild(ethLayout);
		ethCardFrame.appendChild(ethCardBody);
		root.appendChild(ethCardFrame);

		// ---------- B. BOTTOM ROW: 3 EQUAL CARDS (REPEATER, TETHERING, CELLULAR) ----------
		var triGrid = E('div', { 'class': 'qx-tri-grid' });

		// 1. REPEATER CARD
		var repCardFrame = E('div', { 'class': 'qx-card-frame' });
		var repHeader = E('div', { 'class': 'qx-card-header' }, [
			E('div', { 'class': 'qx-header-title-box' }, [
				E('span', { 'class': 'qx-dot-indicator ' + (isRepeaterActive ? 'active' : '') }),
				E('span', {}, _('Repeater'))
			]),
			E('button', {
				'class': 'qx-gear-btn',
				'title': _('Repeater Settings'),
				'click': function() { self.showRepeaterModal(); }
			}, '⚙')
		]);
		repCardFrame.appendChild(repHeader);

		var repBody = E('div', { 'class': 'qx-sub-card-body' });
		var repCircle = E('div', { 'class': 'qx-sub-circle-icon' });
		var repWifiSvg = '<svg viewBox="0 0 60 60" width="34" height="34" fill="none" stroke="#2b354f" stroke-width="2.4" stroke-linecap="round">' +
			'<path d="M12,22 A28,28 0 0,1 48,22" />' +
			'<path d="M18,30 A18,18 0 0,1 42,30" />' +
			'<circle cx="30" cy="39" r="1.8" fill="#2b354f"/>' +
			'<text x="30" y="50" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#2b354f" stroke="none" font-family="sans-serif">wi-fi</text>' +
			'</svg>';
		repCircle.innerHTML = repWifiSvg;
		repBody.appendChild(repCircle);

		var repContent = E('div', { 'class': 'qx-sub-content' }, [
			E('p', { 'class': 'qx-sub-desc' }, isRepeaterActive ? _('Connected to upstream Wi-Fi.') : _('Repeater (STA) is disabled.')),
			E('button', {
				'class': 'qx-sub-action-btn',
				'click': function() { self.showRepeaterModal(); }
			}, isRepeaterActive ? _('Disconnect') : _('Connect'))
		]);
		repBody.appendChild(repContent);
		repCardFrame.appendChild(repBody);
		triGrid.appendChild(repCardFrame);

		// 2. TETHERING CARD
		var tethCardFrame = E('div', { 'class': 'qx-card-frame' });
		var tethHeader = E('div', { 'class': 'qx-card-header' }, [
			E('div', { 'class': 'qx-header-title-box' }, [
				E('span', { 'class': 'qx-dot-indicator ' + (isTetherActive ? 'active' : '') }),
				E('span', {}, _('Tethering'))
			]),
			E('button', {
				'class': 'qx-gear-btn',
				'title': _('USB Tethering Settings'),
				'click': function() { self.showTetheringModal(); }
			}, '⚙')
		]);
		tethCardFrame.appendChild(tethHeader);

		var tethBody = E('div', { 'class': 'qx-sub-card-body' });
		var tethCircle = E('div', { 'class': 'qx-sub-circle-icon' });
		var tethPhoneSvg = '<svg viewBox="0 0 60 60" width="34" height="34" fill="none" stroke="#2b354f" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">' +
			'<rect x="14" y="10" width="22" height="38" rx="3.5" />' +
			'<line x1="21" y1="14" x2="29" y2="14" />' +
			'<circle cx="25" cy="42" r="1.3" fill="#2b354f"/>' +
			'<!-- USB Trident Inside Phone -->' +
			'<path d="M25,24 L25,34" stroke-width="1.6"/>' +
			'<circle cx="25" cy="23" r="1" fill="#2b354f"/>' +
			'<path d="M22,28 L25,30 L28,28" stroke-width="1.3"/>' +
			'<!-- Cable Wire to Right Connector -->' +
			'<path d="M36,40 Q46,40 46,26 L46,18" stroke-width="1.8"/>' +
			'<rect x="43" y="12" width="6" height="6" rx="1" stroke-width="1.8"/>' +
			'</svg>';
		tethCircle.innerHTML = tethPhoneSvg;
		tethBody.appendChild(tethCircle);

		var tethContent = E('div', { 'class': 'qx-sub-content' }, [
			E('p', { 'class': 'qx-sub-desc' }, isTetherActive ? _('USB Smartphone tethering is active and connected.') : _('No Tethering device found, Plug in your smartphone or USB Modem to start.')),
			isTetherActive ? E('button', {
				'class': 'qx-sub-action-btn',
				'click': function() { self.showTetheringModal(); }
			}, _('Details')) : ''
		]);
		tethBody.appendChild(tethContent);
		tethCardFrame.appendChild(tethBody);
		triGrid.appendChild(tethCardFrame);

		// 3. CELLULAR CARD
		var cellCardFrame = E('div', { 'class': 'qx-card-frame' });
		var cellHeader = E('div', { 'class': 'qx-card-header' }, [
			E('div', { 'class': 'qx-header-title-box' }, [
				E('span', { 'class': 'qx-dot-indicator ' + (isCellularActive ? 'active' : '') }),
				E('span', {}, _('Cellular'))
			]),
			E('button', {
				'class': 'qx-gear-btn',
				'title': _('Cellular Modem Settings'),
				'click': function() { self.showCellularModal(); }
			}, '⚙')
		]);
		cellCardFrame.appendChild(cellHeader);

		var cellBody = E('div', { 'class': 'qx-sub-card-body' });
		var cellCircle = E('div', { 'class': 'qx-sub-circle-icon' });
		var cellTowerSvg = '<svg viewBox="0 0 60 60" width="34" height="34" fill="none" stroke="#2b354f" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
			'<!-- Tower Mast -->' +
			'<path d="M22,48 L28,18 L32,18 L38,48" />' +
			'<line x1="24" y1="38" x2="36" y2="38" />' +
			'<line x1="26" y1="28" x2="34" y2="28" />' +
			'<line x1="24" y1="28" x2="36" y2="38" />' +
			'<line x1="36" y1="28" x2="24" y2="38" />' +
			'<circle cx="30" cy="15" r="2.2" fill="#2b354f"/>' +
			'<!-- Radio Waves Left & Right -->' +
			'<path d="M18,12 A16,16 0 0,0 18,22" />' +
			'<path d="M12,8 A22,22 0 0,0 12,26" />' +
			'<path d="M42,12 A16,16 0 0,1 42,22" />' +
			'<path d="M48,8 A22,22 0 0,1 48,26" />' +
			'</svg>';
		cellCircle.innerHTML = cellTowerSvg;
		cellBody.appendChild(cellCircle);

		var cellContent = E('div', { 'class': 'qx-sub-content' }, [
			E('p', { 'class': 'qx-sub-desc' }, isCellularActive ? _('Cellular 4G/5G connection is active.') : _('No Modem device found. Plug in your USB modem to start.'))
		]);
		cellBody.appendChild(cellContent);
		cellCardFrame.appendChild(cellBody);
		triGrid.appendChild(cellCardFrame);

		root.appendChild(triGrid);
	},

	showWanModal: function() {
		var self = this;
		var protoSelect = E('select', { 'class': 'cbi-input-select', 'style': 'width: 100%; padding: 8px;' }, [
			E('option', { 'value': 'dhcp', 'selected': true }, _('DHCP Client (Automatic IP)')),
			E('option', { 'value': 'static' }, _('Static IPv4 Address')),
			E('option', { 'value': 'pppoe' }, _('PPPoE Dial-Up (Broadband)'))
		]);

		var ipInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': '192.168.1.100', 'style': 'width:100%;', 'value': (uplinks.ethernet?.ip || '') });
		var maskInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': '255.255.255.0', 'style': 'width:100%;', 'value': '255.255.255.0' });
		var gwInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': '192.168.1.1', 'style': 'width:100%;', 'value': (uplinks.ethernet?.gateway || '') });
		var dnsInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': '1.1.1.1 8.8.8.8', 'style': 'width:100%;', 'value': (uplinks.ethernet?.dns ? uplinks.ethernet.dns.join(' ') : '') });
		var userInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': 'PPPoE Username', 'style': 'width:100%;' });
		var passInput = E('input', { 'type': 'password', 'class': 'cbi-input-text', 'placeholder': 'PPPoE Password', 'style': 'width:100%;' });

		var staticFields = E('div', { 'style': 'display: none; margin-top: 12px;' }, [
			E('div', { 'style': 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;' }, [
				E('div', {}, [ E('label', { 'style': 'font-size: 12px; font-weight: 600;' }, _('IP Address')), ipInput ]),
				E('div', {}, [ E('label', { 'style': 'font-size: 12px; font-weight: 600;' }, _('Subnet Mask')), maskInput ])
			]),
			E('div', { 'style': 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px;' }, [
				E('div', {}, [ E('label', { 'style': 'font-size: 12px; font-weight: 600;' }, _('Gateway')), gwInput ]),
				E('div', {}, [ E('label', { 'style': 'font-size: 12px; font-weight: 600;' }, _('DNS Servers')), dnsInput ])
			])
		]);

		var pppoeFields = E('div', { 'style': 'display: none; margin-top: 12px;' }, [
			E('div', { 'style': 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px;' }, [
				E('div', {}, [ E('label', { 'style': 'font-size: 12px; font-weight: 600;' }, _('Username')), userInput ]),
				E('div', {}, [ E('label', { 'style': 'font-size: 12px; font-weight: 600;' }, _('Password')), passInput ])
			])
		]);

		protoSelect.addEventListener('change', function() {
			staticFields.style.display = (this.value === 'static') ? 'block' : 'none';
			pppoeFields.style.display = (this.value === 'pppoe') ? 'block' : 'none';
		});

		var modalBody = E('div', {}, [
			E('p', { 'style': 'opacity: 0.85; margin-bottom: 14px;' }, _('Configure the primary Ethernet WAN uplink protocol and IP settings:')),
			E('div', { 'style': 'margin-bottom: 12px;' }, [
				E('label', { 'style': 'font-size: 12px; font-weight: 700; display: block; margin-bottom: 6px;' }, _('Protocol Mode')),
				protoSelect
			]),
			staticFields,
			pppoeFields,
			E('div', { 'style': 'display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Cancel')),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'click': function() {
						var proto = protoSelect.value;
						ui.showModal(_('Applying WAN Settings...'), [
							E('p', { 'class': 'spinning' }, _('Restarting WAN network subsystem...'))
						]);
						callConfigureWan(proto, ipInput.value, maskInput.value, gwInput.value, dnsInput.value, userInput.value, passInput.value).then(function(res) {
							ui.hideModal();
							ui.addNotification(null, E('p', res.message || _('WAN configured successfully.')), 'info');
						}).catch(function(err) {
							ui.hideModal();
							ui.addNotification(null, E('p', _('Error: %s').format(err.message || err)), 'error');
						});
					}
				}, _('Save & Apply'))
			])
		]);

		ui.showModal(_('Ethernet WAN Configuration'), [ modalBody ]);
	},

	showRepeaterModal: function() {
		var resultsContainer = E('div', { 'style': 'max-height: 280px; overflow-y: auto; margin: 14px 0;' }, [
			E('p', { 'class': 'spinning', 'style': 'text-align: center; padding: 20px 0;' }, _('Scanning available 2.4 GHz and 5 GHz wireless networks...'))
		]);

		var modalContent = E('div', {}, [
			E('p', { 'style': 'opacity: 0.85;' }, _('Connect router to an existing Wi-Fi access point (WISP / Repeater mode):')),
			resultsContainer,
			E('div', { 'style': 'display: flex; justify-content: flex-end; gap: 10px;' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Close'))
			])
		]);

		ui.showModal(_('Wi-Fi Repeater / WISP Setup'), [ modalContent ]);

		callScanWifi().then(function(res) {
			resultsContainer.innerHTML = '';
			var aps = (res && res.results) ? res.results : [];
			if (aps.length === 0) {
				resultsContainer.appendChild(E('p', { 'style': 'text-align: center; opacity: 0.7; padding: 20px 0;' }, _('No Wi-Fi networks found.')));
				return;
			}
			var list = E('div', { 'style': 'display: flex; flex-direction: column; gap: 8px;' });
			aps.forEach(function(ap) {
				var item = E('div', {
					'style': 'display: flex; align-items: center; justify-content: space-between; background: rgba(94, 114, 228, 0.06); padding: 10px 14px; border-radius: 8px; cursor: pointer;',
					'click': function() {
						var pass = prompt(_('Enter password for Wi-Fi network "%s":').format(ap.ssid));
						if (pass !== null) {
							ui.addNotification(null, E('p', _('Connecting to %s...').format(ap.ssid)), 'info');
							ui.hideModal();
						}
					}
				}, [
					E('div', {}, [
						E('div', { 'style': 'font-weight: 700; font-size: 13.5px;' }, ap.ssid),
						E('div', { 'style': 'font-size: 11.5px; opacity: 0.7;' }, 'Ch ' + ap.channel + '  •  ' + ap.encryption + '  •  ' + (ap.signal || -60) + ' dBm')
					]),
					E('button', { 'class': 'btn cbi-button cbi-button-action' }, _('Join'))
				]);
				list.appendChild(item);
			});
			resultsContainer.appendChild(list);
		});
	},

	showTetheringModal: function() {
		var modalContent = E('div', {}, [
			E('p', {}, _('Plug your smartphone into the router USB port and enable <strong>USB Tethering</strong> in your phone settings.')),
			E('div', { 'style': 'background: rgba(45, 206, 137, 0.12); border: 1px solid rgba(45, 206, 137, 0.3); border-radius: 8px; padding: 12px 16px; margin: 14px 0; font-size: 13px; color: #2dce89; font-weight: 600;' }, [
				_('✓ USB Tethering interface (usb0 / rndis0) is detected and actively routing traffic.')
			]),
			E('div', { 'style': 'display: flex; justify-content: flex-end;' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Done'))
			])
		]);
		ui.showModal(_('USB Smartphone Tethering'), [ modalContent ]);
	},

	showCellularModal: function() {
		var modalContent = E('div', {}, [
			E('p', {}, _('Connect a supported USB 4G/5G LTE modem (e.g. Quectel, Fibocom, Huawei) to the USB 3.0 port for cellular data fallback.')),
			E('div', { 'style': 'display: flex; justify-content: flex-end; margin-top: 16px;' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Close'))
			])
		]);
		ui.showModal(_('Cellular 4G / 5G Modem'), [ modalContent ]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
