'use strict';
'require view';
'require ui';
'require rpc';
'require poll';
'require dom';

/*
 * Controls DNS Management Interface
 * Production Architecture — Non-Destructive Live Polling & Stable Input State
 */

function strTrim(s) {
	return (s != null) ? String(s).trim() : '';
}

var callGetDnsInfo = rpc.declare({
	object: 'luci.dns',
	method: 'get_dns_info',
	expect: { '': {} }
});

var callApplyDnsSettings = rpc.declare({
	object: 'luci.dns',
	method: 'apply_dns_settings',
	params: ['mode', 'rebind_protection', 'override_clients', 'override_vpn', 'servers'],
	expect: { '': {} }
});

var callManageHosts = rpc.declare({
	object: 'luci.dns',
	method: 'manage_hosts',
	params: ['action', 'params'],
	expect: { '': {} }
});

return view.extend({
	state: {
		data: {},
		isApplying: false,
		selectedMode: 'auto',
		isRebind: true,
		isOverrideClients: false,
		isOverrideVpn: false,
		dns1: '',
		dns2: '',
		dns3: ''
	},

	load: function() {
		return L.resolveDefault(callGetDnsInfo(), {});
	},

	render: function(initialData) {
		var self = this;
		self.state.data = initialData || {};

		// Initialize state from router
		self.state.selectedMode = (initialData && initialData.mode === 'manual') ? 'manual' : 'auto';
		self.state.isRebind = (initialData && initialData.rebind_protection !== false);
		self.state.isOverrideClients = (initialData && initialData.override_clients === true);
		self.state.isOverrideVpn = (initialData && initialData.override_vpn === true);

		var initialServers = (initialData && initialData.manual_servers) ? initialData.manual_servers : [];
		self.state.dns1 = initialServers[0] || '';
		self.state.dns2 = initialServers[1] || '';
		self.state.dns3 = initialServers[2] || '';

		var container = E('div', { 'class': 'cbi-map', 'id': 'dns-app-root' });

		// Controls Stylesheet
		var styleTag = E('style', {}, [
			'#dns-app-root { width: 100%; max-width: 100%; overflow-x: hidden; margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #2b354f; }',
			'[data-theme="dark"] #dns-app-root, [data-dark="true"] #dns-app-root, @media (prefers-color-scheme: dark) { #dns-app-root { color: #f8fafc; } }',

			/* Header Bar */
			'#dns-app-root .qx-dns-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }',
			'#dns-app-root .qx-page-title { font-size: 1.35rem; font-weight: 800; margin: 0; color: inherit; letter-spacing: -0.3px; }',
			'#dns-app-root .qx-edit-hosts-btn { background: #ffffff; border: 1.5px solid #2b354f; color: #2b354f; font-size: 12.5px; font-weight: 700; border-radius: 20px; padding: 5px 20px; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px; }',
			'#dns-app-root .qx-edit-hosts-btn:hover { background: #2b354f; color: #ffffff; box-shadow: 0 4px 12px rgba(43, 53, 79, 0.2); }',
			'[data-theme="dark"] #dns-app-root .qx-edit-hosts-btn, [data-dark="true"] #dns-app-root .qx-edit-hosts-btn, @media (prefers-color-scheme: dark) { #dns-app-root .qx-edit-hosts-btn { background: transparent; border-color: #38bdf8; color: #38bdf8; } #dns-app-root .qx-edit-hosts-btn:hover { background: #38bdf8; color: #0f172a; } }',

			/* Info Banner */
			'#dns-app-root .qx-info-banner { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 18px; margin-bottom: 1.25rem; font-size: 13px; color: #166534; line-height: 1.5; display: flex; align-items: flex-start; gap: 10px; }',
			'[data-theme="dark"] #dns-app-root .qx-info-banner, [data-dark="true"] #dns-app-root .qx-info-banner, @media (prefers-color-scheme: dark) { #dns-app-root .qx-info-banner { background: rgba(34, 197, 94, 0.08); border-color: rgba(34, 197, 94, 0.25); color: #86efac; } }',

			/* Main Glass Card */
			'#dns-app-root .qx-dns-card { background: #ffffff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid rgba(0, 0, 0, 0.08); box-sizing: border-box; overflow: hidden; margin-bottom: 2rem; }',
			'[data-theme="dark"] #dns-app-root .qx-dns-card, [data-dark="true"] #dns-app-root .qx-dns-card, @media (prefers-color-scheme: dark) { #dns-app-root .qx-dns-card { background: rgba(30, 41, 59, 0.85); border-color: rgba(255, 255, 255, 0.08); box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35); } }',

			'#dns-app-root .qx-card-section { padding: 18px 24px; border-bottom: 1px solid rgba(0, 0, 0, 0.05); }',
			'[data-theme="dark"] #dns-app-root .qx-card-section, [data-dark="true"] #dns-app-root .qx-card-section, @media (prefers-color-scheme: dark) { #dns-app-root .qx-card-section { border-bottom-color: rgba(255, 255, 255, 0.05); } }',
			'#dns-app-root .qx-card-section:last-of-type { border-bottom: none; }',

			/* Section Subheading */
			'#dns-app-root .qx-section-subhead { font-size: 14px; font-weight: 800; color: inherit; margin: 0 0 16px; letter-spacing: -0.2px; }',

			/* Form Rows */
			'#dns-app-root .qx-form-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(0, 0, 0, 0.04); gap: 20px; }',
			'[data-theme="dark"] #dns-app-root .qx-form-row, [data-dark="true"] #dns-app-root .qx-form-row, @media (prefers-color-scheme: dark) { #dns-app-root .qx-form-row { border-bottom-color: rgba(255, 255, 255, 0.04); } }',
			'#dns-app-root .qx-form-row:last-of-type { border-bottom: none; }',

			'#dns-app-root .qx-label-box { display: flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 600; color: inherit; }',
			'#dns-app-root .qx-info-btn { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; background: #2b354f; color: #ffffff; font-size: 9px; font-weight: bold; cursor: help; font-style: normal; }',
			'[data-theme="dark"] #dns-app-root .qx-info-btn { background: #94a3b8; color: #0f172a; }',

			'#dns-app-root .qx-control-box { width: 280px; display: flex; align-items: center; justify-content: flex-end; }',
			'@media (max-width: 600px) { #dns-app-root .qx-control-box { width: 180px; } }',

			/* Clean Pill Switches */
			'#dns-app-root .qx-switch-wrap { display: inline-flex; align-items: center; cursor: pointer; user-select: none; }',
			'#dns-app-root .qx-switch-track { position: relative; width: 44px; height: 22px; background: #cbd5e1; border-radius: 22px; transition: background 0.2s ease; }',
			'#dns-app-root .qx-switch-track.active { background: #20c997; }',
			'#dns-app-root .qx-switch-thumb { position: absolute; top: 2.5px; left: 3px; width: 17px; height: 17px; border-radius: 50%; background: #ffffff; transition: transform 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.25); }',
			'#dns-app-root .qx-switch-track.active .qx-switch-thumb { transform: translateX(21px); }',
			'#dns-app-root .qx-switch-label { font-size: 11.5px; font-weight: 800; color: #20c997; margin-right: 8px; }',

			/* Inputs & Select */
			'#dns-app-root .qx-select, #dns-app-root .qx-input-text { width: 100%; padding: 8px 12px; font-size: 13px; font-weight: 500; border: 1px solid rgba(0, 0, 0, 0.15); border-radius: 6px; background: #f8fafc; color: inherit; outline: none; transition: border-color 0.2s; box-sizing: border-box; }',
			'[data-theme="dark"] #dns-app-root .qx-select, [data-theme="dark"] #dns-app-root .qx-input-text, [data-dark="true"] #dns-app-root .qx-select, @media (prefers-color-scheme: dark) { #dns-app-root .qx-select, #dns-app-root .qx-input-text { background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.15); } }',
			'#dns-app-root .qx-select:focus, #dns-app-root .qx-input-text:focus { border-color: #3b82f6; }',

			/* Presets Pills */
			'#dns-app-root .qx-presets-bar { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 16px; }',
			'#dns-app-root .qx-preset-pill { padding: 5px 12px; font-size: 12px; font-weight: 600; border-radius: 14px; background: #f1f5f9; border: 1px solid rgba(0, 0, 0, 0.08); color: #475569; cursor: pointer; transition: all 0.2s; user-select: none; }',
			'[data-theme="dark"] #dns-app-root .qx-preset-pill, [data-dark="true"] #dns-app-root .qx-preset-pill, @media (prefers-color-scheme: dark) { #dns-app-root .qx-preset-pill { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.08); color: #cbd5e1; } }',
			'#dns-app-root .qx-preset-pill:hover { border-color: #3b82f6; color: #3b82f6; }',
			'#dns-app-root .qx-preset-pill.active { background: #3b82f6; border-color: #3b82f6; color: #ffffff; }',

			/* Automatic Mode ISP Box */
			'#dns-app-root .qx-isp-box { background: #f8fafc; border: 1px solid rgba(0, 0, 0, 0.06); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }',
			'[data-theme="dark"] #dns-app-root .qx-isp-box, [data-dark="true"] #dns-app-root .qx-isp-box, @media (prefers-color-scheme: dark) { #dns-app-root .qx-isp-box { background: rgba(255, 255, 255, 0.03); border-color: rgba(255, 255, 255, 0.06); } }',

			'#dns-app-root .qx-isp-row { display: flex; justify-content: space-between; font-size: 13px; border-bottom: 1px dashed rgba(0,0,0,0.06); padding-bottom: 6px; }',
			'[data-theme="dark"] #dns-app-root .qx-isp-row, [data-dark="true"] #dns-app-root .qx-isp-row, @media (prefers-color-scheme: dark) { #dns-app-root .qx-isp-row { border-bottom-color: rgba(255,255,255,0.06); } }',
			'#dns-app-root .qx-isp-row:last-of-type { border-bottom: none; padding-bottom: 0; }',
			'#dns-app-root .qx-isp-k { color: #64748b; font-weight: 500; }',
			'[data-theme="dark"] #dns-app-root .qx-isp-k, [data-dark="true"] #dns-app-root .qx-isp-k, @media (prefers-color-scheme: dark) { #dns-app-root .qx-isp-k { color: #94a3b8; } }',
			'#dns-app-root .qx-isp-v { font-weight: 600; font-family: monospace; color: inherit; }',

			/* Apply Button */
			'#dns-app-root .qx-apply-wrap { display: flex; justify-content: center; padding: 20px 0 10px; }',
			'#dns-app-root .qx-apply-btn { background: #ffffff; border: 1.5px solid #2b354f; color: #2b354f; font-size: 13px; font-weight: 700; border-radius: 22px; padding: 6px 42px; cursor: pointer; transition: all 0.2s ease; }',
			'#dns-app-root .qx-apply-btn:hover { background: #2b354f; color: #ffffff; box-shadow: 0 4px 12px rgba(43, 53, 79, 0.25); }',
			'[data-theme="dark"] #dns-app-root .qx-apply-btn, [data-dark="true"] #dns-app-root .qx-apply-btn, @media (prefers-color-scheme: dark) { #dns-app-root .qx-apply-btn { background: transparent; border-color: #38bdf8; color: #38bdf8; } #dns-app-root .qx-apply-btn:hover { background: #38bdf8; color: #0f172a; } }'
		]);
		container.appendChild(styleTag);

		// Build Static Framework
		var header = E('div', { 'class': 'qx-dns-header' }, [
			E('h2', { 'class': 'qx-page-title' }, _('DNS')),
			E('button', {
				'class': 'qx-edit-hosts-btn',
				'click': function() { self.showHostsModal(); }
			}, [ E('span', {}, '📝'), _('Edit Hosts') ])
		]);
		container.appendChild(header);

		var infoBanner = E('div', { 'class': 'qx-info-banner', 'id': 'qx-info-banner' }, [
			E('span', { 'style': 'font-size: 16px; line-height: 1;' }, 'ℹ️'),
			E('div', { 'id': 'qx-banner-text' })
		]);
		container.appendChild(infoBanner);

		var cardFrame = E('div', { 'class': 'qx-dns-card' });

		// Section 1: Top Security Switches
		var secTop = E('div', { 'class': 'qx-card-section' });

		// Rebind Switch
		var rebindTrack = E('div', { 'class': 'qx-switch-track' }, [ E('div', { 'class': 'qx-switch-thumb' }) ]);
		var rebindLabel = E('span', { 'class': 'qx-switch-label' }, 'ON');
		var rebindWrap = E('div', {
			'class': 'qx-switch-wrap',
			'click': function() {
				self.state.isRebind = !self.state.isRebind;
				self.syncSwitches();
			}
		}, [ rebindLabel, rebindTrack ]);

		var rowRebind = E('div', { 'class': 'qx-form-row' }, [
			E('div', { 'class': 'qx-label-box' }, [
				_('DNS Rebinding Attack Protection'),
				E('span', { 'class': 'qx-info-btn', 'title': _('Blocks upstream DNS responses resolving to local/private RFC1918 IP addresses to prevent web browser rebinding attacks') }, 'i')
			]),
			E('div', { 'class': 'qx-control-box' }, [ rebindWrap ])
		]);
		secTop.appendChild(rowRebind);

		// Override Clients Switch
		var clientTrack = E('div', { 'class': 'qx-switch-track' }, [ E('div', { 'class': 'qx-switch-thumb' }) ]);
		var clientLabel = E('span', { 'class': 'qx-switch-label' }, 'ON');
		var clientWrap = E('div', {
			'class': 'qx-switch-wrap',
			'click': function() {
				self.state.isOverrideClients = !self.state.isOverrideClients;
				self.syncSwitches();
			}
		}, [ clientLabel, clientTrack ]);

		var rowClient = E('div', { 'class': 'qx-form-row' }, [
			E('div', { 'class': 'qx-label-box' }, [
				_('Override DNS Settings of All Clients'),
				E('span', { 'class': 'qx-info-btn', 'title': _('Intercepts and redirects outbound port 53 DNS traffic from all connected devices to force the router resolver') }, 'i')
			]),
			E('div', { 'class': 'qx-control-box' }, [ clientWrap ])
		]);
		secTop.appendChild(rowClient);

		// Override VPN Switch
		var vpnTrack = E('div', { 'class': 'qx-switch-track' }, [ E('div', { 'class': 'qx-switch-thumb' }) ]);
		var vpnLabel = E('span', { 'class': 'qx-switch-label' }, 'ON');
		var vpnNotice = E('span', { 'style': 'font-size: 11px; color: #94a3b8; margin-left: 4px;' }, _('(No active VPN)'));
		var vpnWrap = E('div', {
			'class': 'qx-switch-wrap',
			'click': function() {
				if (!self.state.data.has_vpn) return;
				self.state.isOverrideVpn = !self.state.isOverrideVpn;
				self.syncSwitches();
			}
		}, [ vpnLabel, vpnTrack ]);

		var rowVpn = E('div', { 'class': 'qx-form-row' }, [
			E('div', { 'class': 'qx-label-box' }, [
				_('Allow Custom DNS to Override VPN DNS'),
				E('span', { 'class': 'qx-info-btn', 'title': _('Prioritizes configured custom DNS servers over DNS pushed by active VPN tunnels') }, 'i'),
				vpnNotice
			]),
			E('div', { 'class': 'qx-control-box' }, [ vpnWrap ])
		]);
		secTop.appendChild(rowVpn);

		cardFrame.appendChild(secTop);

		// Section 2: DNS Server Settings
		var secDns = E('div', { 'class': 'qx-card-section' });
		secDns.appendChild(E('h3', { 'class': 'qx-section-subhead' }, _('DNS Server Settings')));

		// Mode Dropdown
		var modeSelect = E('select', { 'class': 'qx-select', 'id': 'qx-mode-select' }, [
			E('option', { 'value': 'auto' }, _('Automatic (ISP Provided)')),
			E('option', { 'value': 'manual' }, _('Manual DNS (Static Resolvers)'))
		]);

		modeSelect.addEventListener('change', function() {
			self.state.selectedMode = this.value;
			self.updateModeDisplay();
		});

		var rowMode = E('div', { 'class': 'qx-form-row' }, [
			E('div', { 'class': 'qx-label-box' }, [ _('Mode') ]),
			E('div', { 'class': 'qx-control-box' }, [ modeSelect ])
		]);
		secDns.appendChild(rowMode);

		// Dynamic Container for Mode Display
		var dynamicContainer = E('div', { 'id': 'qx-dynamic-mode-container', 'style': 'margin-top: 14px;' });
		secDns.appendChild(dynamicContainer);

		// Input fields for Manual Mode (persisted in self.state)
		var dns1Input = E('input', { 'type': 'text', 'class': 'qx-input-text', 'placeholder': 'e.g. 1.1.1.1 or 8.8.8.8', 'value': self.state.dns1 });
		var dns2Input = E('input', { 'type': 'text', 'class': 'qx-input-text', 'placeholder': 'e.g. 1.0.0.1 or 8.8.4.4', 'value': self.state.dns2 });
		var dns3Input = E('input', { 'type': 'text', 'class': 'qx-input-text', 'placeholder': 'e.g. 2606:4700:4700::1111 (Optional)', 'value': self.state.dns3 });

		dns1Input.addEventListener('input', function() { self.state.dns1 = this.value; });
		dns2Input.addEventListener('input', function() { self.state.dns2 = this.value; });
		dns3Input.addEventListener('input', function() { self.state.dns3 = this.value; });

		self.dns1Input = dns1Input;
		self.dns2Input = dns2Input;
		self.dns3Input = dns3Input;
		self.modeSelect = modeSelect;
		self.rebindTrack = rebindTrack;
		self.rebindLabel = rebindLabel;
		self.clientTrack = clientTrack;
		self.clientLabel = clientLabel;
		self.vpnTrack = vpnTrack;
		self.vpnLabel = vpnLabel;
		self.vpnWrap = vpnWrap;
		self.vpnNotice = vpnNotice;

		// Apply Button
		var applyBtn = E('button', {
			'class': 'qx-apply-btn',
			'click': function() {
				var mode = self.state.selectedMode;
				var servers = [];

				if (mode === 'manual') {
					var s1 = strTrim(self.dns1Input.value);
					var s2 = strTrim(self.dns2Input.value);
					var s3 = strTrim(self.dns3Input.value);

					if (!s1 && !s2) {
						ui.addNotification(null, E('p', _('Please enter at least one valid DNS server address.')), 'error');
						return;
					}
					if (s1) servers.push(s1);
					if (s2) servers.push(s2);
					if (s3) servers.push(s3);
				}

				self.state.isApplying = true;
				ui.showModal(_('Applying DNS Settings...'), [
					E('p', { 'class': 'spinning' }, _('Updating dnsmasq resolver and restarting DNS subsystem...'))
				]);

				callApplyDnsSettings(mode, self.state.isRebind, self.state.isOverrideClients, self.state.isOverrideVpn, servers).then(function(res) {
					self.state.isApplying = false;
					ui.hideModal();
					if (res && res.success) {
						ui.addNotification(null, E('p', res.message || _('DNS settings applied successfully.')), 'info');
						callGetDnsInfo().then(function(d) {
							self.state.data = d;
							self.state.selectedMode = (d.mode === 'manual') ? 'manual' : 'auto';
							var s = d.manual_servers || [];
							self.state.dns1 = s[0] || '';
							self.state.dns2 = s[1] || '';
							self.state.dns3 = s[2] || '';
							self.dns1Input.value = self.state.dns1;
							self.dns2Input.value = self.state.dns2;
							self.dns3Input.value = self.state.dns3;
							self.syncSwitches();
							self.updateModeDisplay();
							self.updateBanner();
						});
					} else {
						ui.addNotification(null, E('p', _('Failed to apply DNS settings: %s').format(res.message || 'Error')), 'error');
					}
				}).catch(function(err) {
					self.state.isApplying = false;
					ui.hideModal();
					ui.addNotification(null, E('p', _('Error: %s').format(err.message || err)), 'error');
				});
			}
		}, _('APPLY'));

		var applyWrap = E('div', { 'class': 'qx-apply-wrap' }, [ applyBtn ]);
		secDns.appendChild(applyWrap);

		cardFrame.appendChild(secDns);
		container.appendChild(cardFrame);

		// Synchronize switches, banner and mode display
		self.syncSwitches();
		self.updateModeDisplay();
		self.updateBanner();

		// Safe non-destructive polling: only refresh read-only information
		poll.add(function() {
			return L.resolveDefault(callGetDnsInfo(), {}).then(function(data) {
				self.state.data = data;
				if (!self.state.isApplying) {
					self.updateBanner();
					if (self.state.selectedMode === 'auto') {
						self.updateAutoIspBox();
					}
				}
			});
		}, 4);

		return container;
	},

	syncSwitches: function() {
		var self = this;
		if (self.rebindTrack) {
			if (self.state.isRebind) {
				self.rebindTrack.classList.add('active');
				self.rebindLabel.style.display = '';
			} else {
				self.rebindTrack.classList.remove('active');
				self.rebindLabel.style.display = 'none';
			}
		}
		if (self.clientTrack) {
			if (self.state.isOverrideClients) {
				self.clientTrack.classList.add('active');
				self.clientLabel.style.display = '';
			} else {
				self.clientTrack.classList.remove('active');
				self.clientLabel.style.display = 'none';
			}
		}
		var hasVpn = (self.state.data && self.state.data.has_vpn === true);
		if (self.vpnTrack) {
			if (self.state.isOverrideVpn && hasVpn) {
				self.vpnTrack.classList.add('active');
				self.vpnLabel.style.display = '';
			} else {
				self.vpnTrack.classList.remove('active');
				self.vpnLabel.style.display = 'none';
			}
		}
		if (self.vpnWrap) {
			if (hasVpn) {
				self.vpnWrap.style.opacity = '1';
				self.vpnWrap.style.cursor = 'pointer';
			} else {
				self.vpnWrap.style.opacity = '0.5';
				self.vpnWrap.style.cursor = 'not-allowed';
			}
		}
		if (self.vpnNotice) {
			self.vpnNotice.style.display = hasVpn ? 'none' : '';
		}
	},

	updateBanner: function() {
		var self = this;
		var bannerDiv = document.getElementById('qx-banner-text');
		if (!bannerDiv) return;

		var data = self.state.data || {};
		var isAuto = (self.state.selectedMode !== 'manual');
		var wanIpv4 = data.wan_ipv4 || [];
		var wanIpv6 = data.wan_ipv6 || [];
		var allWan = wanIpv4.concat(wanIpv6);

		var bannerText = isAuto
			? (allWan.length > 0
				? _('DNS queries are currently resolved automatically by your <strong>WAN / ISP Connection</strong> (%s). Select <strong>Manual DNS</strong> below if you require custom static DNS servers.').format(allWan.join(', '))
				: _('DNS mode is set to <strong>Automatic (WAN / ISP)</strong>. When an active WAN uplink is connected, the router will automatically receive and use your ISP\'s DNS servers.'))
			: (self.state.dns1
				? _('DNS queries are configured to use <strong>Custom Static Resolvers</strong> (%s). All connected devices resolve DNS through these servers.').format([self.state.dns1, self.state.dns2].filter(Boolean).join(', '))
				: _('DNS is configured in <strong>Manual DNS</strong> mode. Enter your static DNS servers below and click Apply.'));

		bannerDiv.innerHTML = '<p style="margin: 0;">' + bannerText + '</p>';
	},

	updateModeDisplay: function() {
		var self = this;
		var container = document.getElementById('qx-dynamic-mode-container');
		if (!container) return;

		if (self.modeSelect) {
			self.modeSelect.value = self.state.selectedMode;
		}

		container.innerHTML = '';

		if (self.state.selectedMode === 'manual') {
			var presets = [
				{ name: '⚡ Cloudflare', d1: '1.1.1.1', d2: '1.0.0.1' },
				{ name: '🔍 Google', d1: '8.8.8.8', d2: '8.8.4.4' },
				{ name: '🛡️ Quad9', d1: '9.9.9.9', d2: '149.112.112.112' },
				{ name: '👨‍👩‍👧 Family', d1: '1.1.1.3', d2: '1.0.0.3' },
				{ name: '🔒 AdGuard', d1: '94.140.14.14', d2: '94.140.15.15' }
			];

			var presetsBar = E('div', { 'class': 'qx-presets-bar' });
			presets.forEach(function(p) {
				var isCurrent = (self.dns1Input.value === p.d1 && self.dns2Input.value === p.d2);
				var pill = E('div', {
					'class': 'qx-preset-pill ' + (isCurrent ? 'active' : ''),
					'click': function() {
						self.dns1Input.value = p.d1;
						self.dns2Input.value = p.d2;
						self.state.dns1 = p.d1;
						self.state.dns2 = p.d2;
						document.querySelectorAll('.qx-preset-pill').forEach(function(el) { el.classList.remove('active'); });
						pill.classList.add('active');
					}
				}, p.name);
				presetsBar.appendChild(pill);
			});

			var manualBlock = E('div', {}, [
				E('div', { 'style': 'font-size: 12.5px; font-weight: 700; color: #64748b; margin-bottom: 6px;' }, _('Quick Presets:')),
				presetsBar,
				E('div', { 'class': 'qx-form-row' }, [
					E('div', { 'class': 'qx-label-box' }, [ _('Primary Static DNS (DNS 1)') ]),
					E('div', { 'class': 'qx-control-box' }, [ self.dns1Input ])
				]),
				E('div', { 'class': 'qx-form-row' }, [
					E('div', { 'class': 'qx-label-box' }, [ _('Secondary Static DNS (DNS 2)') ]),
					E('div', { 'class': 'qx-control-box' }, [ self.dns2Input ])
				]),
				E('div', { 'class': 'qx-form-row' }, [
					E('div', { 'class': 'qx-label-box' }, [ _('Tertiary DNS (Optional)') ]),
					E('div', { 'class': 'qx-control-box' }, [ self.dns3Input ])
				])
			]);

			container.appendChild(manualBlock);
		} else {
			var autoBox = E('div', { 'class': 'qx-isp-box', 'id': 'qx-auto-isp-box' });
			container.appendChild(autoBox);
			self.updateAutoIspBox();
		}
	},

	updateAutoIspBox: function() {
		var self = this;
		var autoBox = document.getElementById('qx-auto-isp-box');
		if (!autoBox) return;

		var data = self.state.data || {};
		var wanSource = data.wan_source || 'WAN / ISP (Waiting for ISP Connection)';
		var wanIpv4 = data.wan_ipv4 || [];
		var wanIpv6 = data.wan_ipv6 || [];

		autoBox.innerHTML = '';
		autoBox.appendChild(E('div', { 'class': 'qx-isp-row' }, [
			E('span', { 'class': 'qx-isp-k' }, _('IPv4 Primary DNS:')),
			E('span', { 'class': 'qx-isp-v', 'style': wanIpv4[0] ? 'color: #3b82f6;' : 'color: #94a3b8;' }, wanIpv4[0] || _('Waiting for ISP assignment'))
		]));
		autoBox.appendChild(E('div', { 'class': 'qx-isp-row' }, [
			E('span', { 'class': 'qx-isp-k' }, _('IPv4 Secondary DNS:')),
			E('span', { 'class': 'qx-isp-v', 'style': wanIpv4[1] ? 'color: #3b82f6;' : 'color: #94a3b8;' }, wanIpv4[1] || '—')
		]));
		autoBox.appendChild(E('div', { 'class': 'qx-isp-row' }, [
			E('span', { 'class': 'qx-isp-k' }, _('IPv6 Primary DNS:')),
			E('span', { 'class': 'qx-isp-v', 'style': wanIpv6[0] ? 'color: #3b82f6;' : 'color: #94a3b8;' }, wanIpv6[0] || _('Waiting for ISP assignment'))
		]));
		autoBox.appendChild(E('div', { 'class': 'qx-isp-row' }, [
			E('span', { 'class': 'qx-isp-k' }, _('IPv6 Secondary DNS:')),
			E('span', { 'class': 'qx-isp-v', 'style': wanIpv6[1] ? 'color: #3b82f6;' : 'color: #94a3b8;' }, wanIpv6[1] || '—')
		]));
		autoBox.appendChild(E('div', { 'class': 'qx-isp-row' }, [
			E('span', { 'class': 'qx-isp-k' }, _('Source:')),
			E('span', { 'class': 'qx-isp-v', 'style': 'color: #10b981; font-weight: 700;' }, wanSource)
		]));
	},

	showHostsModal: function() {
		var self = this;
		var hostsMount = E('div', { 'style': 'margin-top: 10px; max-height: 350px; overflow-y: auto;' }, [
			E('p', { 'class': 'spinning' }, _('Loading local host records...'))
		]);

		function reloadHostsTable() {
			callManageHosts('list', {}).then(function(res) {
				hostsMount.innerHTML = '';
				var hosts = res.hosts || [];

				var table = E('table', { 'class': 'table', 'style': 'width: 100%; font-size: 13px;' }, [
					E('tr', {}, [
						E('th', {}, _('Hostname / Domain')),
						E('th', {}, _('IP Address')),
						E('th', { 'style': 'text-align: right;' }, _('Action'))
					])
				]);

				if (hosts.length === 0) {
					hostsMount.appendChild(E('p', { 'style': 'padding: 12px; text-align: center; opacity: 0.7;' }, _('No custom host mappings configured.')));
				} else {
					hosts.forEach(function(h) {
						var row = E('tr', {}, [
							E('td', { 'style': 'font-weight: 600;' }, h.name),
							E('td', { 'style': 'font-family: monospace;' }, h.ip),
							E('td', { 'style': 'text-align: right;' }, [
								E('button', {
									'class': 'btn cbi-button cbi-button-remove',
									'style': 'padding: 2px 8px; font-size: 12px;',
									'click': function() {
										callManageHosts('delete', { section: h.section }).then(function() {
											reloadHostsTable();
										});
									}
								}, _('Delete'))
							])
						]);
						table.appendChild(row);
					});
					hostsMount.appendChild(table);
				}
			});
		}

		reloadHostsTable();

		// Add Host Inputs
		var addName = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': 'e.g. nas.lan', 'style': 'width: 100%;' });
		var addIp = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': 'e.g. 192.168.1.50', 'style': 'width: 100%;' });

		var addBtn = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'style': 'margin-top: 10px;',
			'click': function() {
				var n = strTrim(addName.value);
				var ip = strTrim(addIp.value);
				if (!n || !ip) {
					ui.addNotification(null, E('p', _('Please enter both Hostname and IP Address.')), 'error');
					return;
				}
				callManageHosts('add', { name: n, ip: ip }).then(function(res) {
					if (res && res.success) {
						addName.value = '';
						addIp.value = '';
						reloadHostsTable();
					} else {
						ui.addNotification(null, E('p', res.message || _('Failed to add host record.')), 'error');
					}
				});
			}
		}, _('+ Add Record'));

		var addBlock = E('div', { 'style': 'margin-top: 20px; padding: 14px; background: rgba(0,0,0,0.03); border-radius: 6px;' }, [
			E('h4', { 'style': 'margin: 0 0 10px; font-size: 13px;' }, _('Add Custom Local Host Mapping')),
			E('div', { 'style': 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px;' }, [
				E('div', {}, [ E('label', { 'style': 'font-size: 12px;' }, _('Hostname')), addName ]),
				E('div', {}, [ E('label', { 'style': 'font-size: 12px;' }, _('IP Address')), addIp ])
			]),
			E('div', { 'style': 'display: flex; justify-content: flex-end;' }, [ addBtn ])
		]);

		var modal = E('div', {}, [
			E('p', { 'style': 'font-size: 13px; opacity: 0.85;' }, _('Manage static local hostname-to-IP mappings in local DNS cache (/etc/config/dhcp):')),
			hostsMount,
			addBlock,
			E('div', { 'style': 'display: flex; justify-content: flex-end; margin-top: 16px;' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Close'))
			])
		]);

		ui.showModal(_('Local Host Records (DNS Cache)'), [ modal ]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
