'use strict';
'require view';
'require ui';
'require rpc';
'require poll';
'require dom';

/*
 * Queen / primeNet AX6000 Load Balancing & Dual-WAN Management Interface
 * Enterprise-Grade Dual-WAN, Real-time Traffic Weight Distribution & Failover Health Monitoring
 */

function strTrim(s) {
	return (s != null) ? String(s).trim() : '';
}

function formatBytes(bytes) {
	if (!bytes || bytes <= 0) return '0 B';
	var k = 1024;
	var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	var i = Math.floor(Math.log(bytes) / Math.log(k));
	if (i >= sizes.length) i = sizes.length - 1;
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatSpeed(bps) {
	if (bps == null) return '—';
	if (bps <= 0) return '0.0 KB/s';
	var Bps = bps / 8;
	if (Bps < 1024) return Bps.toFixed(0) + ' B/s';
	var KBps = Bps / 1024;
	if (KBps < 1024) return KBps.toFixed(1) + ' KB/s';
	var MBps = KBps / 1024;
	return MBps.toFixed(2) + ' MB/s';
}

var callGetStatus = rpc.declare({
	object: 'luci.loadbalance',
	method: 'get_status',
	expect: { '': {} }
});

var callApplySettings = rpc.declare({
	object: 'luci.loadbalance',
	method: 'apply_settings',
	params: ['enabled', 'mode', 'wan1_weight', 'wan2_weight', 'auto_failover', 'preferred_wan', 'check_interval', 'check_timeout', 'failure_threshold', 'recovery_threshold', 'check_targets'],
	expect: { '': {} }
});

var callResetDataUsage = rpc.declare({
	object: 'luci.loadbalance',
	method: 'reset_data_usage',
	expect: { '': {} }
});

var callRunDiagnostics = rpc.declare({
	object: 'luci.loadbalance',
	method: 'run_diagnostics',
	expect: { '': {} }
});

return view.extend({
	state: {
		data: {},
		isApplying: false,
		prevStats: null,
		form: {
			enabled: false,
			wan1_weight: 50,
			wan2_weight: 50,
			auto_failover: true,
			preferred_wan: 'wan1',
			check_interval: 3,
			check_timeout: 2,
			failure_threshold: 3,
			recovery_threshold: 2,
			check_targets: '1.1.1.1, 8.8.8.8, 9.9.9.9'
		},
		showAdvanced: false
	},

	load: function() {
		return L.resolveDefault(callGetStatus(), {});
	},

	render: function(initialData) {
		var self = this;
		self.state.data = initialData || {};

		var cfg = (initialData && initialData.config) ? initialData.config : {};
		self.state.form.enabled = (cfg.enabled === true || cfg.enabled === '1' || cfg.enabled === 1);
		self.state.form.wan1_weight = (cfg.wan1_weight != null) ? parseInt(cfg.wan1_weight) : 50;
		self.state.form.wan2_weight = 100 - self.state.form.wan1_weight;
		self.state.form.auto_failover = (cfg.auto_failover !== false && cfg.auto_failover !== '0' && cfg.auto_failover !== 0);
		self.state.form.preferred_wan = cfg.preferred_wan || 'wan1';
		self.state.form.check_interval = cfg.check_interval || 3;
		self.state.form.check_timeout = cfg.check_timeout || 2;
		self.state.form.failure_threshold = cfg.failure_threshold || 3;
		self.state.form.recovery_threshold = cfg.recovery_threshold || 2;
		if (cfg.check_targets && Array.isArray(cfg.check_targets)) {
			self.state.form.check_targets = cfg.check_targets.join(', ');
		}

		var container = E('div', { 'class': 'cbi-map', 'id': 'lb-app-root' });

		// Professional Stylesheet
		var styleTag = E('style', {}, [
			'#lb-app-root { width: 100%; max-width: 100%; overflow-x: hidden; margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #2b354f; }',
			'[data-theme="dark"] #lb-app-root, [data-dark="true"] #lb-app-root, @media (prefers-color-scheme: dark) { #lb-app-root { color: #f8fafc; } }',

			/* Section Title */
			'#lb-app-root .lb-page-title { font-size: 1.35rem; font-weight: 800; margin: 0 0 1.25rem; color: inherit; letter-spacing: -0.3px; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }',

			/* Main Card Box */
			'#lb-app-root .lb-card { background: #ffffff; border-radius: 10px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid rgba(0, 0, 0, 0.08); padding: 22px 26px; margin-bottom: 24px; box-sizing: border-box; transition: box-shadow 0.2s; }',
			'[data-theme="dark"] #lb-app-root .lb-card, [data-dark="true"] #lb-app-root .lb-card, @media (prefers-color-scheme: dark) { #lb-app-root .lb-card { background: rgba(30, 41, 59, 0.85); border-color: rgba(255, 255, 255, 0.08); box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35); } }',

			/* Header Card / Master Switch */
			'#lb-app-root .lb-master-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }',
			'#lb-app-root .lb-master-info { flex: 1; min-width: 250px; }',
			'#lb-app-root .lb-master-title { font-size: 1.15rem; font-weight: 800; margin: 0 0 6px; display: flex; align-items: center; gap: 10px; }',
			'#lb-app-root .lb-master-desc { font-size: 13px; opacity: 0.8; margin: 0; line-height: 1.4; }',

			/* Pill Switch */
			'#lb-app-root .lb-switch-wrap { display: inline-flex; align-items: center; cursor: pointer; user-select: none; gap: 10px; }',
			'#lb-app-root .lb-switch-track { position: relative; width: 50px; height: 26px; background: #cbd5e1; border-radius: 26px; transition: background 0.25s ease; }',
			'#lb-app-root .lb-switch-track.active { background: #0F766E; }',
			'#lb-app-root .lb-switch-thumb { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #ffffff; transition: transform 0.25s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.25); }',
			'#lb-app-root .lb-switch-track.active .lb-switch-thumb { transform: translateX(24px); }',
			'#lb-app-root .lb-switch-status { font-size: 13px; font-weight: 800; color: #0F766E; }',

			/* Notice Banner */
			'#lb-app-root .lb-notice-banner { background: rgba(15, 118, 110, 0.08); border-left: 4px solid #0F766E; border-radius: 6px; padding: 12px 16px; font-size: 12.5px; margin-top: 16px; display: flex; align-items: center; justify-content: space-between; gap: 14px; }',
			'[data-theme="dark"] #lb-app-root .lb-notice-banner { background: rgba(15, 118, 110, 0.2); }',

			/* Grid for Dual WAN Cards */
			'#lb-app-root .lb-wan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }',
			'@media (max-width: 820px) { #lb-app-root .lb-wan-grid { grid-template-columns: 1fr; } }',

			/* Individual WAN Card */
			'#lb-app-root .lb-wan-card { border-radius: 10px; background: #ffffff; border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 4px 16px rgba(0,0,0,0.04); padding: 20px 22px; position: relative; overflow: hidden; }',
			'[data-theme="dark"] #lb-app-root .lb-wan-card { background: rgba(30, 41, 59, 0.85); border-color: rgba(255, 255, 255, 0.08); }',
			'#lb-app-root .lb-wan-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid rgba(0,0,0,0.06); padding-bottom: 12px; }',
			'[data-theme="dark"] #lb-app-root .lb-wan-header { border-bottom-color: rgba(255,255,255,0.06); }',
			'#lb-app-root .lb-wan-title-box { display: flex; align-items: center; gap: 10px; }',
			'#lb-app-root .lb-wan-title { font-size: 1.1rem; font-weight: 800; margin: 0; }',
			'#lb-app-root .lb-wan-badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; }',
			'#lb-app-root .lb-badge-online { background: rgba(32, 201, 151, 0.15); color: #20c997; }',
			'#lb-app-root .lb-badge-offline { background: rgba(239, 68, 68, 0.15); color: #ef4444; }',
			'#lb-app-root .lb-badge-disabled { background: rgba(148, 163, 184, 0.2); color: #64748b; }',
			'[data-theme="dark"] #lb-app-root .lb-badge-disabled { color: #94a3b8; }',

			/* WAN Details Table */
			'#lb-app-root .lb-details-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; font-size: 12.5px; border-bottom: 1px dashed rgba(0,0,0,0.05); }',
			'[data-theme="dark"] #lb-app-root .lb-details-row { border-bottom-color: rgba(255,255,255,0.05); }',
			'#lb-app-root .lb-details-row:last-child { border-bottom: none; }',
			'#lb-app-root .lb-dt-label { opacity: 0.7; font-weight: 600; }',
			'#lb-app-root .lb-dt-val { font-weight: 700; font-family: monospace; font-size: 12.5px; }',

			/* WAN Speed & Usage Meter */
			'#lb-app-root .lb-wan-metrics { display: flex; gap: 14px; margin-top: 16px; background: rgba(0,0,0,0.02); padding: 12px; border-radius: 8px; }',
			'[data-theme="dark"] #lb-app-root .lb-wan-metrics { background: rgba(255,255,255,0.03); }',
			'#lb-app-root .lb-metric-box { flex: 1; text-align: center; }',
			'#lb-app-root .lb-metric-num { font-size: 1.15rem; font-weight: 800; color: #0F766E; margin-bottom: 2px; }',
			'[data-theme="dark"] #lb-app-root .lb-metric-num { color: #81C784; }',
			'#lb-app-root .lb-metric-lbl { font-size: 11px; opacity: 0.7; font-weight: 600; text-transform: uppercase; }',

			/* Total Data Usage Bar */
			'#lb-app-root .lb-total-box { display: flex; align-items: center; justify-content: space-between; background: rgba(15, 118, 110, 0.05); border: 1px solid rgba(15, 118, 110, 0.15); border-radius: 8px; padding: 14px 20px; margin-bottom: 24px; flex-wrap: wrap; gap: 14px; }',
			'[data-theme="dark"] #lb-app-root .lb-total-box { background: rgba(15, 118, 110, 0.12); border-color: rgba(15, 118, 110, 0.25); }',
			'#lb-app-root .lb-total-info { display: flex; align-items: center; gap: 16px; }',
			'#lb-app-root .lb-total-title { font-size: 13px; font-weight: 700; opacity: 0.8; }',
			'#lb-app-root .lb-total-val { font-size: 1.25rem; font-weight: 800; color: #0F766E; }',
			'[data-theme="dark"] #lb-app-root .lb-total-val { color: #81C784; }',

			/* Distribution Slider Section */
			'#lb-app-root .lb-dist-box { margin: 20px 0; }',
			'#lb-app-root .lb-slider-labels { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-weight: 800; font-size: 14px; }',
			'#lb-app-root .lb-slider-wrap { position: relative; width: 100%; margin: 16px 0; }',
			'#lb-app-root .lb-range-input { width: 100%; -webkit-appearance: none; appearance: none; height: 10px; border-radius: 5px; background: linear-gradient(to right, #0F766E var(--w1, 50%), #3b82f6 var(--w1, 50%)); outline: none; cursor: pointer; }',
			'#lb-app-root .lb-range-input::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 24px; height: 24px; border-radius: 50%; background: #ffffff; border: 3px solid #0F766E; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3); transition: transform 0.1s; }',
			'#lb-app-root .lb-range-input::-webkit-slider-thumb:hover { transform: scale(1.15); }',
			
			/* Presets */
			'#lb-app-root .lb-presets-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; justify-content: center; }',
			'#lb-app-root .lb-preset-btn { background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.1); border-radius: 16px; padding: 5px 14px; font-size: 12px; font-weight: 700; color: inherit; cursor: pointer; transition: all 0.15s ease; }',
			'#lb-app-root .lb-preset-btn:hover { background: #0F766E; color: #ffffff; border-color: #0F766E; }',
			'[data-theme="dark"] #lb-app-root .lb-preset-btn { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }',

			/* Form Controls */
			'#lb-app-root .lb-form-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,0.05); gap: 20px; }',
			'[data-theme="dark"] #lb-app-root .lb-form-row { border-bottom-color: rgba(255,255,255,0.05); }',
			'#lb-app-root .lb-form-row:last-child { border-bottom: none; }',
			'#lb-app-root .lb-input-text, #lb-app-root .lb-select { padding: 7px 12px; font-size: 13px; font-weight: 600; border: 1px solid rgba(0,0,0,0.15); border-radius: 6px; background: #f8fafc; color: inherit; outline: none; width: 220px; }',
			'[data-theme="dark"] #lb-app-root .lb-input-text, [data-theme="dark"] #lb-app-root .lb-select { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.15); }',

			/* Health Grid */
			'#lb-app-root .lb-health-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }',
			'@media (max-width: 820px) { #lb-app-root .lb-health-grid { grid-template-columns: 1fr; } }',
			'#lb-app-root .lb-health-card { background: rgba(0,0,0,0.02); border-radius: 8px; padding: 16px; }',
			'[data-theme="dark"] #lb-app-root .lb-health-card { background: rgba(255,255,255,0.03); }',

			/* Action Buttons */
			'#lb-app-root .lb-btn-primary { background: #0F766E; color: #ffffff; border: none; font-size: 13px; font-weight: 700; border-radius: 22px; padding: 9px 36px; cursor: pointer; transition: all 0.2s ease; }',
			'#lb-app-root .lb-btn-primary:hover { background: #115E59; box-shadow: 0 4px 14px rgba(15, 118, 110, 0.35); }',
			'#lb-app-root .lb-btn-neutral { background: transparent; border: 1.5px solid rgba(0,0,0,0.2); color: inherit; font-size: 12.5px; font-weight: 700; border-radius: 20px; padding: 6px 18px; cursor: pointer; transition: all 0.15s; }',
			'[data-theme="dark"] #lb-app-root .lb-btn-neutral { border-color: rgba(255,255,255,0.2); }',
			'#lb-app-root .lb-btn-neutral:hover { background: rgba(0,0,0,0.05); }',
			'#lb-app-root .lb-btn-danger { background: transparent; border: 1.5px solid #ef4444; color: #ef4444; font-size: 12px; font-weight: 700; border-radius: 16px; padding: 5px 16px; cursor: pointer; transition: all 0.15s; }',
			'#lb-app-root .lb-btn-danger:hover { background: #ef4444; color: #ffffff; }'
		]);
		container.appendChild(styleTag);

		// Page Header
		var headerRow = E('div', { 'class': 'lb-page-title' }, [
			E('span', {}, _('Load Balancing (Dual-WAN)')),
			E('div', { 'style': 'display: flex; gap: 10px;' }, [
				E('button', {
					'class': 'lb-btn-neutral',
					'click': function() { self.showDiagnosticsModal(); }
				}, '🩺 ' + _('Diagnostics')),
				E('button', {
					'class': 'lb-btn-danger',
					'click': function() { self.confirmResetDataUsage(); }
				}, '🗑️ ' + _('Reset Data Usage'))
			])
		]);
		container.appendChild(headerRow);

		// 1. Master Control Card
		var masterCard = E('div', { 'class': 'lb-card' });
		self.masterCard = masterCard;
		container.appendChild(masterCard);

		// Total Data Usage Strip
		var totalStrip = E('div', { 'class': 'lb-total-box', 'id': 'lb_total_strip' });
		self.totalStrip = totalStrip;
		container.appendChild(totalStrip);

		// 2. Dual WAN Cards Grid
		var wanGrid = E('div', { 'class': 'lb-wan-grid' });
		self.wanGrid = wanGrid;
		container.appendChild(wanGrid);

		// 3. Traffic Distribution Card
		var distCard = E('div', { 'class': 'lb-card' });
		self.distCard = distCard;
		container.appendChild(distCard);

		// 4. WAN Health Monitoring Card
		var healthCard = E('div', { 'class': 'lb-card' });
		self.healthCard = healthCard;
		container.appendChild(healthCard);

		// 5. Failover & Advanced Settings Card
		var failoverCard = E('div', { 'class': 'lb-card' });
		self.failoverCard = failoverCard;
		container.appendChild(failoverCard);

		// 6. Action Button Bar
		var actionBar = E('div', { 'style': 'display: flex; justify-content: center; margin: 30px 0 20px;' }, [
			E('button', {
				'class': 'lb-btn-primary',
				'click': function() { self.applyConfiguration(); }
			}, _('Save & Apply Configuration'))
		]);
		container.appendChild(actionBar);

		self.buildMasterCard();
		self.buildTotalStrip();
		self.buildWanGrid();
		self.buildDistCard();
		self.buildHealthCard();
		self.buildFailoverCard();

		// Safe non-destructive polling
		poll.add(function() {
			return L.resolveDefault(callGetStatus(), {}).then(function(d) {
				self.state.data = d || {};
				if (!self.state.isApplying) {
					self.updateLiveMetrics();
				}
			});
		}, 2);

		return container;
	},

	buildMasterCard: function() {
		var self = this;
		var d = self.state.data || {};
		var isEn = self.state.form.enabled;

		var track = E('div', { 'class': 'lb-switch-track ' + (isEn ? 'active' : '') }, [
			E('div', { 'class': 'lb-switch-thumb' })
		]);
		var statusText = E('span', { 'class': 'lb-switch-status' }, isEn ? 'ACTIVE' : 'DISABLED');

		var switchWrap = E('div', {
			'class': 'lb-switch-wrap',
			'click': function() {
				self.state.form.enabled = !self.state.form.enabled;
				if (self.state.form.enabled) {
					track.classList.add('active');
					statusText.textContent = 'ACTIVE';
					statusText.style.color = '#0F766E';
					descElem.innerHTML = _('<strong>Dual-WAN Active:</strong> WAN1 + WAN2 (LAN1) are configured to load balance traffic.');
					noticeBanner.style.display = 'flex';
				} else {
					track.classList.remove('active');
					statusText.textContent = 'DISABLED';
					statusText.style.color = '#64748b';
					descElem.innerHTML = _('<strong>Dual-WAN Disabled:</strong> WAN1 operates as the sole Internet connection. LAN1 operates as a standard LAN port.');
					noticeBanner.style.display = 'none';
				}
			}
		}, [ statusText, track ]);

		var descElem = E('p', { 'class': 'lb-master-desc' }, isEn ?
			_('<strong>Dual-WAN Active:</strong> WAN1 + WAN2 (LAN1) are configured to load balance traffic.') :
			_('<strong>Dual-WAN Disabled:</strong> WAN1 operates as the sole Internet connection. LAN1 operates as a standard LAN port.')
		);

		var noticeBanner = E('div', {
			'class': 'lb-notice-banner',
			'style': isEn ? 'display: flex;' : 'display: none;'
		}, [
			E('span', {}, '⚠️ ' + _('<strong>Physical Port Notice:</strong> Port <strong>LAN1</strong> is converted to <strong>WAN2</strong>. Any client plugged into LAN1 should be moved to LAN2, LAN3, or LAN4.')),
			E('span', { 'style': 'font-weight: 800; font-family: monospace;' }, 'LAN1 ➔ WAN2')
		]);

		var headerWrap = E('div', { 'class': 'lb-master-header' }, [
			E('div', { 'class': 'lb-master-info' }, [
				E('h3', { 'class': 'lb-master-title' }, [
					'⚡ ' + _('Dual-WAN Load Balancing & Failover')
				]),
				descElem
			]),
			switchWrap
		]);

		self.masterCard.innerHTML = '';
		self.masterCard.appendChild(headerWrap);
		self.masterCard.appendChild(noticeBanner);
	},

	buildTotalStrip: function() {
		var self = this;
		var d = self.state.data || {};
		var tot = d.total_usage || {};
		var totBytes = tot.total_bytes || 0;

		self.totalStrip.innerHTML = '';
		self.totalStrip.appendChild(E('div', { 'class': 'lb-total-info' }, [
			E('span', { 'style': 'font-size: 1.4rem;' }, '📊'),
			E('div', {}, [
				E('div', { 'class': 'lb-total-title' }, _('Total Cumulative Router Data Usage (Persistent)')),
				E('div', { 'id': 'lb_global_total', 'class': 'lb-total-val' }, formatBytes(totBytes))
			])
		]));
		self.totalStrip.appendChild(E('button', {
			'class': 'lb-btn-neutral',
			'style': 'font-size: 11.5px; padding: 4px 14px;',
			'click': function() { self.confirmResetDataUsage(); }
		}, '🗑️ ' + _('Reset History')));
	},

	buildWanGrid: function() {
		var self = this;
		var d = self.state.data || {};
		var isEn = (d.dual_wan_enabled !== false && self.state.form.enabled);
		var w1 = d.wan1 || {};
		var w2 = d.wan2 || {};

		self.wanGrid.innerHTML = '';

		// Card 1: WAN1
		var c1 = E('div', { 'class': 'lb-wan-card' }, [
			E('div', { 'class': 'lb-wan-header' }, [
				E('div', { 'class': 'lb-wan-title-box' }, [
					E('h4', { 'class': 'lb-wan-title' }, 'WAN1 (Primary)'),
					E('span', { 'id': 'w1_badge', 'class': 'lb-wan-badge ' + (w1.connected ? 'lb-badge-online' : 'lb-badge-offline') }, w1.connected ? _('● Connected') : _('○ Disconnected'))
				]),
				E('span', { 'style': 'font-size: 11.5px; opacity: 0.7; font-weight: 700;' }, 'Port: WAN')
			]),
			E('div', { 'class': 'lb-details-row' }, [
				E('span', { 'class': 'lb-dt-label' }, _('Protocol / Interface')),
				E('span', { 'id': 'w1_proto', 'class': 'lb-dt-val' }, (w1.proto ? w1.proto.toUpperCase() : 'DHCP') + ' (' + (w1.device || 'wan') + ')')
			]),
			E('div', { 'class': 'lb-details-row' }, [
				E('span', { 'class': 'lb-dt-label' }, _('IP Address')),
				E('span', { 'id': 'w1_ip', 'class': 'lb-dt-val' }, w1.ip || '—')
			]),
			E('div', { 'class': 'lb-details-row' }, [
				E('span', { 'class': 'lb-dt-label' }, _('Gateway')),
				E('span', { 'id': 'w1_gw', 'class': 'lb-dt-val' }, w1.gateway || '—')
			]),
			E('div', { 'class': 'lb-details-row' }, [
				E('span', { 'class': 'lb-dt-label' }, _('DNS Servers')),
				E('span', { 'id': 'w1_dns', 'class': 'lb-dt-val' }, (w1.dns && w1.dns.length > 0) ? w1.dns.join(', ') : '—')
			]),
			E('div', { 'class': 'lb-wan-metrics' }, [
				E('div', { 'class': 'lb-metric-box' }, [
					E('div', { 'id': 'w1_speed_down', 'class': 'lb-metric-num' }, formatSpeed(w1.rx_rate_bps)),
					E('div', { 'class': 'lb-metric-lbl' }, '↓ ' + _('Download'))
				]),
				E('div', { 'class': 'lb-metric-box' }, [
					E('div', { 'id': 'w1_speed_up', 'class': 'lb-metric-num' }, formatSpeed(w1.tx_rate_bps)),
					E('div', { 'class': 'lb-metric-lbl' }, '↑ ' + _('Upload'))
				]),
				E('div', { 'class': 'lb-metric-box' }, [
					E('div', { 'id': 'w1_total_rx', 'class': 'lb-metric-num' }, formatBytes(w1.total_bytes || 0)),
					E('div', { 'class': 'lb-metric-lbl' }, _('Data Usage'))
				])
			])
		]);
		self.wanGrid.appendChild(c1);

		// Card 2: WAN2 (LAN1)
		var w2BadgeClass = isEn ? (w2.connected ? 'lb-badge-online' : 'lb-badge-offline') : 'lb-badge-disabled';
		var w2BadgeText = isEn ? (w2.connected ? _('● Connected') : _('○ Disconnected')) : _('○ Disabled');

		var c2 = E('div', { 'class': 'lb-wan-card' }, [
			E('div', { 'class': 'lb-wan-header' }, [
				E('div', { 'class': 'lb-wan-title-box' }, [
					E('h4', { 'class': 'lb-wan-title' }, 'WAN2 (Secondary)'),
					E('span', { 'id': 'w2_badge', 'class': 'lb-wan-badge ' + w2BadgeClass }, w2BadgeText)
				]),
				E('span', { 'style': 'font-size: 11.5px; opacity: 0.7; font-weight: 700;' }, 'Port: LAN1')
			]),
			E('div', { 'class': 'lb-details-row' }, [
				E('span', { 'class': 'lb-dt-label' }, _('Protocol / Interface')),
				E('span', { 'id': 'w2_proto', 'class': 'lb-dt-val' }, isEn ? ((w2.proto ? w2.proto.toUpperCase() : 'DHCP') + ' (' + (w2.device || 'lan1') + ')') : _('LAN Port 1 (Local)'))
			]),
			E('div', { 'class': 'lb-details-row' }, [
				E('span', { 'class': 'lb-dt-label' }, _('IP Address')),
				E('span', { 'id': 'w2_ip', 'class': 'lb-dt-val' }, isEn ? (w2.ip || '—') : '—')
			]),
			E('div', { 'class': 'lb-details-row' }, [
				E('span', { 'class': 'lb-dt-label' }, _('Gateway')),
				E('span', { 'id': 'w2_gw', 'class': 'lb-dt-val' }, isEn ? (w2.gateway || '—') : '—')
			]),
			E('div', { 'class': 'lb-details-row' }, [
				E('span', { 'class': 'lb-dt-label' }, _('DNS Servers')),
				E('span', { 'id': 'w2_dns', 'class': 'lb-dt-val' }, isEn ? ((w2.dns && w2.dns.length > 0) ? w2.dns.join(', ') : '—') : '—')
			]),
			E('div', { 'class': 'lb-wan-metrics' }, [
				E('div', { 'class': 'lb-metric-box' }, [
					E('div', { 'id': 'w2_speed_down', 'class': 'lb-metric-num' }, isEn ? formatSpeed(w2.rx_rate_bps) : '—'),
					E('div', { 'class': 'lb-metric-lbl' }, '↓ ' + _('Download'))
				]),
				E('div', { 'class': 'lb-metric-box' }, [
					E('div', { 'id': 'w2_speed_up', 'class': 'lb-metric-num' }, isEn ? formatSpeed(w2.tx_rate_bps) : '—'),
					E('div', { 'class': 'lb-metric-lbl' }, '↑ ' + _('Upload'))
				]),
				E('div', { 'class': 'lb-metric-box' }, [
					E('div', { 'id': 'w2_total_rx', 'class': 'lb-metric-num' }, formatBytes(w2.total_bytes || 0)),
					E('div', { 'class': 'lb-metric-lbl' }, _('Data Usage'))
				])
			])
		]);
		self.wanGrid.appendChild(c2);
	},

	buildDistCard: function() {
		var self = this;
		var w1 = self.state.form.wan1_weight;
		var w2 = self.state.form.wan2_weight;

		var w1Label = E('span', { 'id': 'w1_label_pct', 'style': 'color: #0F766E;' }, 'WAN1: ' + w1 + '%');
		var w2Label = E('span', { 'id': 'w2_label_pct', 'style': 'color: #3b82f6;' }, 'WAN2: ' + w2 + '%');

		var rangeInput = E('input', {
			'type': 'range',
			'min': '0',
			'max': '100',
			'value': String(w1),
			'class': 'lb-range-input',
			'id': 'lb_weight_slider'
		});
		rangeInput.style.setProperty('--w1', w1 + '%');

		function updateSlider(val) {
			val = parseInt(val);
			self.state.form.wan1_weight = val;
			self.state.form.wan2_weight = 100 - val;
			w1Label.textContent = 'WAN1: ' + val + '%';
			w2Label.textContent = 'WAN2: ' + (100 - val) + '%';
			rangeInput.value = String(val);
			rangeInput.style.setProperty('--w1', val + '%');
		}

		rangeInput.addEventListener('input', function() {
			updateSlider(this.value);
		});

		var presets = [
			{ name: '50 / 50 ' + _('Balanced'), w1: 50 },
			{ name: '70 / 30 ' + _('Priority'), w1: 70 },
			{ name: '80 / 20 ' + _('Backup'), w1: 80 },
			{ name: '100 / 0 ' + _('WAN1 Only'), w1: 100 },
			{ name: '0 / 100 ' + _('WAN2 Only'), w1: 0 }
		];

		var presetsRow = E('div', { 'class': 'lb-presets-row' });
		presets.forEach(function(p) {
			presetsRow.appendChild(E('button', {
				'class': 'lb-preset-btn',
				'click': function(ev) {
					ev.preventDefault();
					updateSlider(p.w1);
				}
			}, p.name));
		});

		self.distCard.innerHTML = '';
		self.distCard.appendChild(E('h4', { 'style': 'font-size: 1.05rem; font-weight: 800; margin: 0 0 4px;' }, '⚖️ ' + _('Traffic Distribution Policy')));
		self.distCard.appendChild(E('p', { 'style': 'font-size: 12.5px; opacity: 0.75; margin: 0 0 16px;' }, _('Customize connection distribution weights between WAN1 and WAN2. When both uplinks are healthy, traffic is balanced dynamically.')));
		
		var sliderBox = E('div', { 'class': 'lb-dist-box' }, [
			E('div', { 'class': 'lb-slider-labels' }, [ w1Label, w2Label ]),
			E('div', { 'class': 'lb-slider-wrap' }, [ rangeInput ]),
			presetsRow
		]);
		self.distCard.appendChild(sliderBox);
	},

	buildHealthCard: function() {
		var self = this;
		var d = self.state.data || {};
		var isEn = (d.dual_wan_enabled !== false && self.state.form.enabled);
		var w1 = d.wan1 || {};
		var w2 = d.wan2 || {};

		self.healthCard.innerHTML = '';
		self.healthCard.appendChild(E('h4', { 'style': 'font-size: 1.05rem; font-weight: 800; margin: 0 0 4px;' }, '💓 ' + _('Uplink Health Monitoring')));
		self.healthCard.appendChild(E('p', { 'style': 'font-size: 12.5px; opacity: 0.75; margin: 0 0 16px;' }, _('Continuous ICMP probes verify actual Internet reachability, measuring latency and packet loss to prevent black-hole routing.')));

		var grid = E('div', { 'class': 'lb-health-grid' }, [
			E('div', { 'class': 'lb-health-card' }, [
				E('div', { 'style': 'font-weight: 800; margin-bottom: 10px; font-size: 13px;' }, 'WAN1 Health'),
				E('div', { 'class': 'lb-details-row' }, [
					E('span', { 'class': 'lb-dt-label' }, _('Internet Status')),
					E('span', { 'id': 'w1_health_status', 'class': 'lb-dt-val' }, (w1.status ? w1.status.toUpperCase() : 'OFFLINE'))
				]),
				E('div', { 'class': 'lb-details-row' }, [
					E('span', { 'class': 'lb-dt-label' }, _('Probe Latency')),
					E('span', { 'id': 'w1_latency', 'class': 'lb-dt-val' }, (w1.latency > 0) ? (w1.latency + ' ms') : '—')
				]),
				E('div', { 'class': 'lb-details-row' }, [
					E('span', { 'class': 'lb-dt-label' }, _('Packet Loss')),
					E('span', { 'id': 'w1_loss', 'class': 'lb-dt-val' }, (w1.packet_loss != null) ? (w1.packet_loss + '%') : '—')
				])
			]),
			E('div', { 'class': 'lb-health-card' }, [
				E('div', { 'style': 'font-weight: 800; margin-bottom: 10px; font-size: 13px;' }, 'WAN2 Health'),
				E('div', { 'class': 'lb-details-row' }, [
					E('span', { 'class': 'lb-dt-label' }, _('Internet Status')),
					E('span', { 'id': 'w2_health_status', 'class': 'lb-dt-val' }, isEn ? (w2.status ? w2.status.toUpperCase() : 'OFFLINE') : _('DISABLED'))
				]),
				E('div', { 'class': 'lb-details-row' }, [
					E('span', { 'class': 'lb-dt-label' }, _('Probe Latency')),
					E('span', { 'id': 'w2_latency', 'class': 'lb-dt-val' }, isEn ? ((w2.latency > 0) ? (w2.latency + ' ms') : '—') : '—')
				]),
				E('div', { 'class': 'lb-details-row' }, [
					E('span', { 'class': 'lb-dt-label' }, _('Packet Loss')),
					E('span', { 'id': 'w2_loss', 'class': 'lb-dt-val' }, isEn ? ((w2.packet_loss != null) ? (w2.packet_loss + '%') : '—') : '—')
				])
			])
		]);

		self.healthCard.appendChild(grid);
	},

	buildFailoverCard: function() {
		var self = this;
		var form = self.state.form;

		self.failoverCard.innerHTML = '';
		self.failoverCard.appendChild(E('h4', { 'style': 'font-size: 1.05rem; font-weight: 800; margin: 0 0 4px;' }, '🔄 ' + _('Failover & Advanced Routing')));
		self.failoverCard.appendChild(E('p', { 'style': 'font-size: 12.5px; opacity: 0.75; margin: 0 0 16px;' }, _('Configures automatic rerouting if one uplink suffers an outage, and fine-tunes probe intervals.')));

		// Auto Failover Toggle
		var autoSwitchTrack = E('div', { 'class': 'lb-switch-track ' + (form.auto_failover ? 'active' : '') }, [
			E('div', { 'class': 'lb-switch-thumb' })
		]);
		var autoSwitchWrap = E('div', {
			'class': 'lb-switch-wrap',
			'click': function() {
				form.auto_failover = !form.auto_failover;
				if (form.auto_failover) autoSwitchTrack.classList.add('active');
				else autoSwitchTrack.classList.remove('active');
			}
		}, [ autoSwitchTrack ]);

		var rowAuto = E('div', { 'class': 'lb-form-row' }, [
			E('div', {}, [
				E('div', { 'style': 'font-weight: 700; font-size: 13.5px;' }, _('Automatic Failover')),
				E('div', { 'style': 'font-size: 12px; opacity: 0.7;' }, _('If one WAN link drops, reroute 100% of traffic to the surviving uplink.'))
			]),
			autoSwitchWrap
		]);
		self.failoverCard.appendChild(rowAuto);

		// Preferred WAN Dropdown
		var prefSelect = E('select', { 'class': 'lb-select' }, [
			E('option', { 'value': 'wan1', 'selected': (form.preferred_wan === 'wan1') }, 'WAN1 (Primary)'),
			E('option', { 'value': 'wan2', 'selected': (form.preferred_wan === 'wan2') }, 'WAN2 (Secondary / LAN1)')
		]);
		prefSelect.addEventListener('change', function() { form.preferred_wan = this.value; });

		var rowPref = E('div', { 'class': 'lb-form-row' }, [
			E('div', {}, [
				E('div', { 'style': 'font-weight: 700; font-size: 13.5px;' }, _('Preferred Primary Uplink')),
				E('div', { 'style': 'font-size: 12px; opacity: 0.7;' }, _('Default route chosen when both connections are recovering.'))
			]),
			prefSelect
		]);
		self.failoverCard.appendChild(rowPref);

		// Advanced Settings Toggle
		var advToggleBtn = E('button', {
			'class': 'lb-btn-neutral',
			'style': 'margin-top: 16px;',
			'click': function() {
				self.state.showAdvanced = !self.state.showAdvanced;
				advBox.style.display = self.state.showAdvanced ? 'block' : 'none';
				advToggleBtn.textContent = self.state.showAdvanced ? '▲ ' + _('Hide Advanced Settings') : '▼ ' + _('Show Advanced Settings');
			}
		}, self.state.showAdvanced ? '▲ ' + _('Hide Advanced Settings') : '▼ ' + _('Show Advanced Settings'));

		var advBox = E('div', { 'style': self.state.showAdvanced ? 'margin-top: 14px;' : 'display: none; margin-top: 14px;' });

		// Probe Targets Input
		var targetsInput = E('input', {
			'type': 'text',
			'class': 'lb-input-text',
			'value': form.check_targets,
			'placeholder': '1.1.1.1, 8.8.8.8, 9.9.9.9'
		});
		targetsInput.addEventListener('input', function() { form.check_targets = this.value; });

		advBox.appendChild(E('div', { 'class': 'lb-form-row' }, [
			E('div', {}, [
				E('div', { 'style': 'font-weight: 700; font-size: 13px;' }, _('Health Check Targets')),
				E('div', { 'style': 'font-size: 11.5px; opacity: 0.7;' }, _('Comma-separated public IP addresses to ping.'))
			]),
			targetsInput
		]));

		// Probe Interval
		var intvlInput = E('input', {
			'type': 'number',
			'min': '1',
			'max': '60',
			'class': 'lb-input-text',
			'value': String(form.check_interval)
		});
		intvlInput.addEventListener('input', function() { form.check_interval = parseInt(this.value) || 3; });

		advBox.appendChild(E('div', { 'class': 'lb-form-row' }, [
			E('div', {}, [
				E('div', { 'style': 'font-weight: 700; font-size: 13px;' }, _('Check Interval (seconds)')),
				E('div', { 'style': 'font-size: 11.5px; opacity: 0.7;' }, _('Frequency of periodic ping health checks.'))
			]),
			intvlInput
		]));

		// Failure Threshold
		var failInput = E('input', {
			'type': 'number',
			'min': '1',
			'max': '10',
			'class': 'lb-input-text',
			'value': String(form.failure_threshold)
		});
		failInput.addEventListener('input', function() { form.failure_threshold = parseInt(this.value) || 3; });

		advBox.appendChild(E('div', { 'class': 'lb-form-row' }, [
			E('div', {}, [
				E('div', { 'style': 'font-weight: 700; font-size: 13px;' }, _('Failure Threshold (counts)')),
				E('div', { 'style': 'font-size: 11.5px; opacity: 0.7;' }, _('Number of missed pings before triggering failover.'))
			]),
			failInput
		]));

		self.failoverCard.appendChild(advToggleBtn);
		self.failoverCard.appendChild(advBox);
	},

	updateLiveMetrics: function() {
		var self = this;
		var d = self.state.data || {};
		var isEn = (d.dual_wan_enabled !== false && self.state.form.enabled);
		var w1 = d.wan1 || {};
		var w2 = d.wan2 || {};
		var tot = d.total_usage || {};

		// Update Total Global Usage
		var elGlobalTotal = document.getElementById('lb_global_total');
		if (elGlobalTotal) elGlobalTotal.textContent = formatBytes(tot.total_bytes || (w1.total_bytes || 0) + (w2.total_bytes || 0));

		// Update WAN1 Nodes
		var elW1Badge = document.getElementById('w1_badge');
		if (elW1Badge) {
			elW1Badge.textContent = w1.connected ? _('● Connected') : _('○ Disconnected');
			elW1Badge.className = 'lb-wan-badge ' + (w1.connected ? 'lb-badge-online' : 'lb-badge-offline');
		}
		var elW1Ip = document.getElementById('w1_ip');
		if (elW1Ip) elW1Ip.textContent = w1.ip || '—';
		var elW1Gw = document.getElementById('w1_gw');
		if (elW1Gw) elW1Gw.textContent = w1.gateway || '—';
		var elW1Dns = document.getElementById('w1_dns');
		if (elW1Dns) elW1Dns.textContent = (w1.dns && w1.dns.length > 0) ? w1.dns.join(', ') : '—';
		var elW1Down = document.getElementById('w1_speed_down');
		if (elW1Down) elW1Down.textContent = formatSpeed(w1.rx_rate_bps);
		var elW1Up = document.getElementById('w1_speed_up');
		if (elW1Up) elW1Up.textContent = formatSpeed(w1.tx_rate_bps);
		var elW1Tot = document.getElementById('w1_total_rx');
		if (elW1Tot) elW1Tot.textContent = formatBytes(w1.total_bytes || 0);

		// Update WAN2 Nodes
		var elW2Badge = document.getElementById('w2_badge');
		if (elW2Badge) {
			if (isEn) {
				elW2Badge.textContent = w2.connected ? _('● Connected') : _('○ Disconnected');
				elW2Badge.className = 'lb-wan-badge ' + (w2.connected ? 'lb-badge-online' : 'lb-badge-offline');
			} else {
				elW2Badge.textContent = _('○ Disabled');
				elW2Badge.className = 'lb-wan-badge lb-badge-disabled';
			}
		}
		var elW2Proto = document.getElementById('w2_proto');
		if (elW2Proto) elW2Proto.textContent = isEn ? ((w2.proto ? w2.proto.toUpperCase() : 'DHCP') + ' (' + (w2.device || 'lan1') + ')') : _('LAN Port 1 (Local)');
		var elW2Ip = document.getElementById('w2_ip');
		if (elW2Ip) elW2Ip.textContent = isEn ? (w2.ip || '—') : '—';
		var elW2Gw = document.getElementById('w2_gw');
		if (elW2Gw) elW2Gw.textContent = isEn ? (w2.gateway || '—') : '—';
		var elW2Dns = document.getElementById('w2_dns');
		if (elW2Dns) elW2Dns.textContent = isEn ? ((w2.dns && w2.dns.length > 0) ? w2.dns.join(', ') : '—') : '—';
		var elW2Down = document.getElementById('w2_speed_down');
		if (elW2Down) elW2Down.textContent = isEn ? formatSpeed(w2.rx_rate_bps) : '—';
		var elW2Up = document.getElementById('w2_speed_up');
		if (elW2Up) elW2Up.textContent = isEn ? formatSpeed(w2.tx_rate_bps) : '—';
		var elW2Tot = document.getElementById('w2_total_rx');
		if (elW2Tot) elW2Tot.textContent = formatBytes(w2.total_bytes || 0);

		// Update Health Nodes
		var elW1HStatus = document.getElementById('w1_health_status');
		if (elW1HStatus) elW1HStatus.textContent = (w1.status ? w1.status.toUpperCase() : 'OFFLINE');
		var elW1Lat = document.getElementById('w1_latency');
		if (elW1Lat) elW1Lat.textContent = (w1.latency > 0) ? (w1.latency + ' ms') : '—';
		var elW1Loss = document.getElementById('w1_loss');
		if (elW1Loss) elW1Loss.textContent = (w1.packet_loss != null) ? (w1.packet_loss + '%') : '—';

		var elW2HStatus = document.getElementById('w2_health_status');
		if (elW2HStatus) elW2HStatus.textContent = isEn ? (w2.status ? w2.status.toUpperCase() : 'OFFLINE') : _('DISABLED');
		var elW2Lat = document.getElementById('w2_latency');
		if (elW2Lat) elW2Lat.textContent = isEn ? ((w2.latency > 0) ? (w2.latency + ' ms') : '—') : '—';
		var elW2Loss = document.getElementById('w2_loss');
		if (elW2Loss) elW2Loss.textContent = isEn ? ((w2.packet_loss != null) ? (w2.packet_loss + '%') : '—') : '—';
	},

	applyConfiguration: function() {
		var self = this;
		var form = self.state.form;

		var targets = [];
		(form.check_targets || '').split(',').forEach(function(t) {
			var st = strTrim(t);
			if (st.length > 0) targets.push(st);
		});
		if (targets.length === 0) targets = ['1.1.1.1', '8.8.8.8'];

		var payload = {
			enabled: form.enabled,
			mode: (form.wan1_weight === 50 && form.wan2_weight === 50) ? 'balanced' : 'custom',
			wan1_weight: form.wan1_weight,
			wan2_weight: form.wan2_weight,
			auto_failover: form.auto_failover,
			preferred_wan: form.preferred_wan,
			check_interval: form.check_interval,
			check_timeout: form.check_timeout,
			failure_threshold: form.failure_threshold,
			recovery_threshold: form.recovery_threshold,
			check_targets: targets
		};

		self.state.isApplying = true;
		ui.showModal(_('Applying Load Balancing Settings...'), [
			E('p', { 'class': 'spinning' }, _('Reconfiguring network interfaces, updating mwan3 policies, and reloading daemons...'))
		]);

		callApplySettings(
			payload.enabled,
			payload.mode,
			payload.wan1_weight,
			payload.wan2_weight,
			payload.auto_failover,
			payload.preferred_wan,
			payload.check_interval,
			payload.check_timeout,
			payload.failure_threshold,
			payload.recovery_threshold,
			payload.check_targets
		).then(function(res) {
			self.state.isApplying = false;
			ui.hideModal();
			if (res && res.success) {
				ui.addNotification(null, E('p', res.message || _('Load balancing configuration applied successfully.')), 'info');
				callGetStatus().then(function(d) {
					self.state.data = d || {};
					self.buildMasterCard();
					self.buildTotalStrip();
					self.buildWanGrid();
					self.buildDistCard();
					self.buildHealthCard();
					self.buildFailoverCard();
				});
			} else {
				ui.addNotification(null, E('p', _('Failed to apply configuration: %s').format(res.message || 'Error')), 'error');
			}
		}).catch(function(err) {
			self.state.isApplying = false;
			ui.hideModal();
			ui.addNotification(null, E('p', _('Error applying configuration: %s').format(err.message || err)), 'error');
		});
	},

	confirmResetDataUsage: function() {
		var self = this;
		ui.showModal(_('Reset Data Usage?'), [
			E('p', {}, _('Are you sure you want to reset all accumulated historical WAN data usage? This action cannot be undone.')),
			E('div', { 'style': 'display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-neutral',
					'click': ui.hideModal
				}, _('Cancel')),
				E('button', {
					'class': 'btn cbi-button cbi-button-negative',
					'click': function() {
						ui.hideModal();
						callResetDataUsage().then(function(res) {
							ui.addNotification(null, E('p', _('Data usage counters have been reset to zero.')), 'info');
							callGetStatus().then(function(d) {
								self.state.data = d || {};
								self.updateLiveMetrics();
							});
						}).catch(function(err) {
							ui.addNotification(null, E('p', _('Failed to reset data usage: %s').format(err.message || err)), 'error');
						});
					}
				}, _('Reset Usage'))
			])
		]);
	},

	showDiagnosticsModal: function() {
		var modalBody = E('div', { 'style': 'padding: 10px 0;' }, [
			E('p', { 'class': 'spinning', 'style': 'text-align: center; margin: 20px 0;' }, _('Running comprehensive multi-WAN diagnostics...'))
		]);

		ui.showModal('🩺 ' + _('Load Balancing Diagnostics'), [ modalBody ]);

		callRunDiagnostics().then(function(diag) {
			modalBody.innerHTML = '';
			modalBody.appendChild(E('div', { 'style': 'display: flex; flex-direction: column; gap: 10px;' }, [
				E('div', { 'class': 'lb-details-row' }, [
					E('span', { 'class': 'lb-dt-label' }, _('WAN1 (WAN Port) Physical Link')),
					E('span', { 'class': 'lb-dt-val', 'style': diag.wan1.link ? 'color: #20c997;' : 'color: #ef4444;' }, diag.wan1.link ? '✅ Carrier Detected' : '❌ No Carrier')
				]),
				E('div', { 'class': 'lb-details-row' }, [
					E('span', { 'class': 'lb-dt-label' }, _('WAN2 (LAN1 Port) Physical Link')),
					E('span', { 'class': 'lb-dt-val', 'style': diag.wan2.link ? 'color: #20c997;' : 'color: #ef4444;' }, diag.wan2.link ? '✅ Carrier Detected' : '❌ No Carrier')
				]),
				E('div', { 'class': 'lb-details-row' }, [
					E('span', { 'class': 'lb-dt-label' }, _('WAN1 Internet Ping Probe (1.1.1.1)')),
					E('span', { 'class': 'lb-dt-val', 'style': diag.wan1.ping ? 'color: #20c997;' : 'color: #ef4444;' }, diag.wan1.ping ? ('✅ ' + diag.wan1.latency_ms + ' ms') : '❌ Failed')
				]),
				E('div', { 'class': 'lb-details-row' }, [
					E('span', { 'class': 'lb-dt-label' }, _('WAN2 Internet Ping Probe (1.1.1.1)')),
					E('span', { 'class': 'lb-dt-val', 'style': diag.wan2.ping ? 'color: #20c997;' : 'color: #ef4444;' }, diag.wan2.ping ? ('✅ ' + diag.wan2.latency_ms + ' ms') : '❌ Failed')
				]),
				E('div', { 'class': 'lb-details-row' }, [
					E('span', { 'class': 'lb-dt-label' }, _('DNS Resolution (openwrt.org)')),
					E('span', { 'class': 'lb-dt-val', 'style': diag.dns.resolved ? 'color: #20c997;' : 'color: #ef4444;' }, diag.dns.resolved ? '✅ Successful' : '❌ Failed')
				]),
				E('div', { 'class': 'lb-details-row' }, [
					E('span', { 'class': 'lb-dt-label' }, _('Multi-WAN (mwan3) Engine')),
					E('span', { 'class': 'lb-dt-val', 'style': diag.routing.mwan3_running ? 'color: #20c997;' : 'color: #ef4444;' }, diag.routing.mwan3_running ? '✅ Online & Routing' : '❌ Offline')
				]),
				E('div', { 'class': 'lb-details-row' }, [
					E('span', { 'class': 'lb-dt-label' }, _('Firewall Masquerade (NAT)')),
					E('span', { 'class': 'lb-dt-val', 'style': diag.firewall.nat_active ? 'color: #20c997;' : 'color: #ef4444;' }, diag.firewall.nat_active ? '✅ Enabled' : '❌ Disabled')
				]),
				E('div', { 'style': 'display: flex; justify-content: center; margin-top: 18px;' }, [
					E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Close'))
				])
			]));
		}).catch(function(err) {
			modalBody.innerHTML = '';
			modalBody.appendChild(E('p', { 'style': 'color: #ef4444;' }, _('Failed to run diagnostics: %s').format(err.message || err)));
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
