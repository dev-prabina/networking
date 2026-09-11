'use strict';
'require view';
'require ui';
'require rpc';
'require poll';
'require dom';

/*
 * Queen.X / Controls Wireless Management Interface
 * Complete Independent Interface Isolation & Original Queen.X Theme Layout
 */

function strTrim(s) {
	return (s != null) ? String(s).trim() : '';
}

var callGetWirelessInfo = rpc.declare({
	object: 'luci.wireless',
	method: 'get_wireless_info',
	expect: { '': {} }
});

var callModifyWireless = rpc.declare({
	object: 'luci.wireless',
	method: 'modify_wireless',
	params: ['radio', 'iface_section', 'ssid', 'encryption', 'key', 'channel', 'htmode', 'txpower', 'hidden', 'iface_disabled', 'random_bssid'],
	expect: { '': {} }
});

return view.extend({
	state: {
		data: { radios: [] },
		activeTabKey: null,
		tabFormState: {},
		isApplying: false
	},

	load: function() {
		return L.resolveDefault(callGetWirelessInfo(), { radios: [] });
	},

	render: function(initialData) {
		var self = this;
		self.state.data = initialData || { radios: [] };

		var container = E('div', { 'class': 'cbi-map', 'id': 'wireless-app-root' });

		// Queen.X Original Theme Stylesheet
		var styleTag = E('style', {}, [
			'#wireless-app-root { width: 100%; max-width: 100%; overflow-x: hidden; margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #2b354f; }',
			'[data-theme="dark"] #wireless-app-root, [data-dark="true"] #wireless-app-root, @media (prefers-color-scheme: dark) { #wireless-app-root { color: #f8fafc; } }',

			/* Section Title */
			'#wireless-app-root .qx-page-title { font-size: 1.35rem; font-weight: 800; margin: 0 0 1.25rem; color: inherit; letter-spacing: -0.3px; }',

			/* Main Wireless Card Container */
			'#wireless-app-root .qx-wifi-card { background: #ffffff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid rgba(0, 0, 0, 0.08); box-sizing: border-box; overflow: hidden; margin-bottom: 2rem; }',
			'[data-theme="dark"] #wireless-app-root .qx-wifi-card, [data-dark="true"] #wireless-app-root .qx-wifi-card, @media (prefers-color-scheme: dark) { #wireless-app-root .qx-wifi-card { background: rgba(30, 41, 59, 0.85); border-color: rgba(255, 255, 255, 0.08); box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35); } }',

			/* Tab Bar */
			'#wireless-app-root .qx-tabs-bar { display: flex; align-items: stretch; background: #f0f4f9; border-bottom: 1px solid rgba(0, 0, 0, 0.06); overflow-x: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; touch-action: pan-x pan-y; width: 100%; max-width: 100%; }',
			'[data-theme="dark"] #wireless-app-root .qx-tabs-bar, [data-dark="true"] #wireless-app-root .qx-tabs-bar, @media (prefers-color-scheme: dark) { #wireless-app-root .qx-tabs-bar { background: rgba(255, 255, 255, 0.03); border-bottom-color: rgba(255, 255, 255, 0.06); } }',

			'#wireless-app-root .qx-tab-item { display: flex; align-items: center; gap: 8px; padding: 14px 22px; font-size: 13.5px; font-weight: 700; color: #64748b; cursor: pointer; border-right: 1px solid rgba(0, 0, 0, 0.05); background: transparent; transition: all 0.2s ease; user-select: none; white-space: nowrap; }',
			'[data-theme="dark"] #wireless-app-root .qx-tab-item, [data-dark="true"] #wireless-app-root .qx-tab-item, @media (prefers-color-scheme: dark) { #wireless-app-root .qx-tab-item { color: #94a3b8; border-right-color: rgba(255, 255, 255, 0.05); } }',
			'#wireless-app-root .qx-tab-item:hover { color: #2b354f; background: rgba(255, 255, 255, 0.5); }',
			'[data-theme="dark"] #wireless-app-root .qx-tab-item:hover { color: #f8fafc; background: rgba(255, 255, 255, 0.05); }',
			
			'#wireless-app-root .qx-tab-item.active { background: #ffffff; color: #2b354f; border-bottom: 2px solid #ffffff; margin-bottom: -1px; }',
			'[data-theme="dark"] #wireless-app-root .qx-tab-item.active, [data-dark="true"] #wireless-app-root .qx-tab-item.active, @media (prefers-color-scheme: dark) { #wireless-app-root .qx-tab-item.active { background: rgba(30, 41, 59, 1); color: #f8fafc; border-bottom-color: rgba(30, 41, 59, 1); } }',

			'#wireless-app-root .qx-tab-dot { width: 7px; height: 7px; border-radius: 50%; background: #cbd5e1; flex-shrink: 0; }',
			'#wireless-app-root .qx-tab-dot.active { background: #20c997; box-shadow: 0 0 6px #20c997; }',
			'#wireless-app-root .qx-client-pill { font-size: 10.5px; font-weight: 700; background: rgba(59, 130, 246, 0.12); color: #3b82f6; padding: 1px 6px; border-radius: 10px; margin-left: 4px; }',

			/* Form Body */
			'#wireless-app-root .qx-form-body { padding: 20px 24px; max-width: 620px; }',
			'@media (max-width: 700px) { #wireless-app-root .qx-form-body { max-width: 100%; padding: 16px; } }',

			/* Form Rows */
			'#wireless-app-root .qx-form-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(0, 0, 0, 0.04); gap: 20px; }',
			'[data-theme="dark"] #wireless-app-root .qx-form-row, [data-dark="true"] #wireless-app-root .qx-form-row, @media (prefers-color-scheme: dark) { #wireless-app-root .qx-form-row { border-bottom-color: rgba(255, 255, 255, 0.04); } }',
			'#wireless-app-root .qx-form-row:last-of-type { border-bottom: none; }',

			'#wireless-app-root .qx-label-box { display: flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 600; color: inherit; }',
			'#wireless-app-root .qx-info-btn { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; background: #2b354f; color: #ffffff; font-size: 9px; font-weight: bold; cursor: help; font-style: normal; }',
			'[data-theme="dark"] #wireless-app-root .qx-info-btn { background: #94a3b8; color: #0f172a; }',

			'#wireless-app-root .qx-qr-icon-btn { background: none; border: none; cursor: pointer; padding: 2px 4px; font-size: 14px; color: #64748b; line-height: 1; border-radius: 4px; transition: color 0.15s; }',
			'#wireless-app-root .qx-qr-icon-btn:hover { color: #3b82f6; }',

			'#wireless-app-root .qx-control-box { width: 230px; display: flex; align-items: center; justify-content: flex-end; }',
			'@media (max-width: 500px) { #wireless-app-root .qx-control-box { width: 170px; } }',

			/* Clean Pill Switches */
			'#wireless-app-root .qx-switch-wrap { display: inline-flex; align-items: center; cursor: pointer; user-select: none; }',
			'#wireless-app-root .qx-switch-track { position: relative; width: 44px; height: 22px; background: #cbd5e1; border-radius: 22px; transition: background 0.2s ease; }',
			'#wireless-app-root .qx-switch-track.active { background: #20c997; }',
			'#wireless-app-root .qx-switch-thumb { position: absolute; top: 2.5px; left: 3px; width: 17px; height: 17px; border-radius: 50%; background: #ffffff; transition: transform 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.25); }',
			'#wireless-app-root .qx-switch-track.active .qx-switch-thumb { transform: translateX(21px); }',
			'#wireless-app-root .qx-switch-label { font-size: 11.5px; font-weight: 800; color: #20c997; margin-right: 8px; }',

			/* Text Inputs & Select Dropdowns */
			'#wireless-app-root .qx-input-text, #wireless-app-root .qx-select { width: 100%; padding: 7px 12px; font-size: 13px; font-weight: 500; border: 1px solid rgba(0, 0, 0, 0.15); border-radius: 6px; background: #f8fafc; color: inherit; outline: none; transition: border-color 0.2s; box-sizing: border-box; }',
			'[data-theme="dark"] #wireless-app-root .qx-input-text, [data-theme="dark"] #wireless-app-root .qx-select, [data-dark="true"] #wireless-app-root .qx-input-text, @media (prefers-color-scheme: dark) { #wireless-app-root .qx-input-text, #wireless-app-root .qx-select { background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.15); } }',
			'#wireless-app-root .qx-input-text:focus, #wireless-app-root .qx-select:focus { border-color: #3b82f6; }',

			/* Password Input with Eye */
			'#wireless-app-root .qx-pwd-wrap { position: relative; width: 100%; display: flex; align-items: center; }',
			'#wireless-app-root .qx-pwd-input { padding-right: 32px !important; }',
			'#wireless-app-root .qx-pwd-eye { position: absolute; right: 8px; background: none; border: none; font-size: 14px; color: #94a3b8; cursor: pointer; padding: 2px; line-height: 1; }',
			'#wireless-app-root .qx-pwd-eye:hover { color: #3b82f6; }',

			/* Modify Button */
			'#wireless-app-root .qx-modify-wrap { display: flex; justify-content: center; margin-top: 24px; padding-top: 14px; }',
			'#wireless-app-root .qx-modify-btn { background: #ffffff; border: 1.5px solid #2b354f; color: #2b354f; font-size: 13px; font-weight: 700; border-radius: 22px; padding: 6px 38px; cursor: pointer; transition: all 0.2s ease; }',
			'#wireless-app-root .qx-modify-btn:hover { background: #2b354f; color: #ffffff; box-shadow: 0 4px 12px rgba(43, 53, 79, 0.25); }',
			'[data-theme="dark"] #wireless-app-root .qx-modify-btn, [data-dark="true"] #wireless-app-root .qx-modify-btn, @media (prefers-color-scheme: dark) { #wireless-app-root .qx-modify-btn { background: transparent; border-color: #38bdf8; color: #38bdf8; } #wireless-app-root .qx-modify-btn:hover { background: #38bdf8; color: #0f172a; } }'
		]);
		container.appendChild(styleTag);

		// Page Title
		container.appendChild(E('h2', { 'class': 'qx-page-title' }, _('Wireless')));

		// Main Card Frame
		var cardFrame = E('div', { 'class': 'qx-wifi-card' });

		// Tab Bar Mount
		var tabsBar = E('div', { 'class': 'qx-tabs-bar', 'id': 'qx-tabs-bar' });
		cardFrame.appendChild(tabsBar);

		// Form Body Mount
		var formBody = E('div', { 'class': 'qx-form-body', 'id': 'qx-form-body' });
		cardFrame.appendChild(formBody);

		container.appendChild(cardFrame);

		self.tabsBar = tabsBar;
		self.formBody = formBody;

		self.syncTabList();
		self.renderTabs();
		self.renderForm();

		// Safe non-destructive live polling (only updates tab client counts and green dots)
		poll.add(function() {
			return L.resolveDefault(callGetWirelessInfo(), { radios: [] }).then(function(data) {
				self.state.data = data;
				if (!self.state.isApplying) {
					self.updateTabStatus();
				}
			});
		}, 4);

		return container;
	},

	syncTabList: function() {
		var self = this;
		var tabItems = [];
		(self.state.data.radios || []).forEach(function(r) {
			(r.interfaces || []).forEach(function(ifc) {
				var key = r.radio + '::' + ifc.section;
				tabItems.push({
					key: key,
					radio: r,
					iface: ifc,
					label: ifc.label || (r.band_label + (ifc.is_guest ? ' Guest Wi-Fi' : ' Wi-Fi')),
					isEnabled: !ifc.disabled,
					clientsCount: ifc.clients_count || 0
				});

				// Initialize or update tab form state without wiping unsaved user edits
				if (!self.state.tabFormState[key]) {
					self.state.tabFormState[key] = {
						ssid: ifc.ssid || '',
						key: ifc.key || '',
						encryption: ifc.encryption || 'psk2',
						hidden: (ifc.hidden === true),
						random_bssid: (ifc.random_bssid === true),
						isWifiEnabled: !ifc.disabled,
						channel: String(r.channel || 'auto'),
						htmode: String(r.htmode || (r.band === '5g' ? 'HE80' : 'HE20')),
						txpower: parseInt(r.txpower) || parseInt(r.max_txpower) || 30,
						showPassword: false
					};
				}
			});
		});

		self.tabItems = tabItems;

		if (!self.state.activeTabKey || !tabItems.some(function(t) { return t.key === self.state.activeTabKey; })) {
			if (tabItems.length > 0) self.state.activeTabKey = tabItems[0].key;
		}
	},

	renderTabs: function() {
		var self = this;
		self.tabsBar.innerHTML = '';

		(self.tabItems || []).forEach(function(t) {
			var isCurrent = (t.key === self.state.activeTabKey);
			var tabBtn = E('div', {
				'class': 'qx-tab-item ' + (isCurrent ? 'active' : ''),
				'id': 'tab_item_' + t.key,
				'click': function() {
					if (self.state.activeTabKey !== t.key) {
						self.state.activeTabKey = t.key;
						self.renderTabs();
						self.renderForm();
					}
				}
			}, [
				E('span', { 'class': 'qx-tab-dot ' + (t.isEnabled ? 'active' : ''), 'id': 'dot_' + t.key }),
				E('span', {}, t.label),
				E('span', {
					'class': 'qx-client-pill',
					'id': 'pill_' + t.key,
					'style': (t.isEnabled && t.clientsCount > 0) ? '' : 'display: none;'
				}, String(t.clientsCount))
			]);
			self.tabsBar.appendChild(tabBtn);
		});
	},

	updateTabStatus: function() {
		var self = this;
		(self.tabItems || []).forEach(function(t) {
			var dot = document.getElementById('dot_' + t.key);
			var pill = document.getElementById('pill_' + t.key);
			if (dot) {
				if (t.isEnabled) dot.classList.add('active');
				else dot.classList.remove('active');
			}
			if (pill) {
				if (t.isEnabled && t.clientsCount > 0) {
					pill.textContent = String(t.clientsCount);
					pill.style.display = '';
				} else {
					pill.style.display = 'none';
				}
			}
		});
	},

	renderForm: function() {
		var self = this;
		self.formBody.innerHTML = '';

		var activeTab = (self.tabItems || []).find(function(t) { return t.key === self.state.activeTabKey; });
		if (!activeTab) return;

		var activeRadio = activeTab.radio;
		var activeIface = activeTab.iface;
		var form = self.state.tabFormState[activeTab.key];

		// Row 1: Enable Wi-Fi Toggle (Isolated per-interface)
		var enableSwitchTrack = E('div', { 'class': 'qx-switch-track ' + (form.isWifiEnabled ? 'active' : '') }, [
			E('div', { 'class': 'qx-switch-thumb' })
		]);
		var enableSwitchLabel = E('span', { 'class': 'qx-switch-label', 'style': form.isWifiEnabled ? '' : 'display: none;' }, 'ON');
		var enableSwitchWrap = E('div', {
			'class': 'qx-switch-wrap',
			'click': function() {
				form.isWifiEnabled = !form.isWifiEnabled;
				if (form.isWifiEnabled) {
					enableSwitchTrack.classList.add('active');
					enableSwitchLabel.style.display = '';
				} else {
					enableSwitchTrack.classList.remove('active');
					enableSwitchLabel.style.display = 'none';
				}
			}
		}, [ enableSwitchLabel, enableSwitchTrack ]);

		var rowEnable = E('div', { 'class': 'qx-form-row' }, [
			E('div', { 'class': 'qx-label-box' }, [ activeTab.iface.is_guest ? _('Enable Guest Wi-Fi') : _('Enable Wi-Fi') ]),
			E('div', { 'class': 'qx-control-box' }, [ enableSwitchWrap ])
		]);
		self.formBody.appendChild(rowEnable);

		// Row 2: TX Power Dropdown
		var txSelect = E('select', { 'class': 'qx-select' });
		var maxTx = activeRadio.max_txpower || 30;
		var curTx = form.txpower || maxTx;

		var txOptions = [
			{ val: maxTx, label: _('Max (%d dBm)').format(maxTx) }
		];
		(activeRadio.supported_txpowers || []).slice().reverse().forEach(function(p) {
			if (p.dbm !== maxTx && p.dbm >= 5) {
				txOptions.push({ val: p.dbm, label: '%d dBm (%d mW)'.format(p.dbm, p.mw) });
			}
		});

		txOptions.forEach(function(opt) {
			var optElem = E('option', { 'value': opt.val, 'selected': (opt.val === curTx) }, opt.label);
			txSelect.appendChild(optElem);
		});
		txSelect.addEventListener('change', function() { form.txpower = parseInt(this.value); });

		var rowTx = E('div', { 'class': 'qx-form-row' }, [
			E('div', { 'class': 'qx-label-box' }, [ _('TX Power') ]),
			E('div', { 'class': 'qx-control-box' }, [ txSelect ])
		]);
		self.formBody.appendChild(rowTx);

		// Row 3: Wi-Fi Name (SSID) Input + QR Code Trigger
		var ssidInput = E('input', {
			'type': 'text',
			'class': 'qx-input-text',
			'value': form.ssid,
			'maxlength': '32',
			'placeholder': 'Enter SSID Name'
		});
		ssidInput.addEventListener('input', function() { form.ssid = this.value; });

		var qrBtn = E('button', {
			'class': 'qx-qr-icon-btn',
			'title': _('Show Wi-Fi QR Code for Mobile Scanning'),
			'click': function(ev) {
				ev.stopPropagation();
				self.showQrCodeModal(form.ssid, form.encryption, form.key, form.hidden);
			}
		}, '🔲');

		var rowSsid = E('div', { 'class': 'qx-form-row' }, [
			E('div', { 'class': 'qx-label-box' }, [
				_('Wi-Fi Name (SSID)'),
				qrBtn
			]),
			E('div', { 'class': 'qx-control-box' }, [ ssidInput ])
		]);
		self.formBody.appendChild(rowSsid);

		// Row 4: Enable Randomized BSSID Toggle
		var randomSwitchTrack = E('div', { 'class': 'qx-switch-track ' + (form.random_bssid ? 'active' : '') }, [
			E('div', { 'class': 'qx-switch-thumb' })
		]);
		var randomSwitchWrap = E('div', {
			'class': 'qx-switch-wrap',
			'click': function() {
				form.random_bssid = !form.random_bssid;
				if (form.random_bssid) randomSwitchTrack.classList.add('active');
				else randomSwitchTrack.classList.remove('active');
			}
		}, [ randomSwitchTrack ]);

		var rowRandom = E('div', { 'class': 'qx-form-row' }, [
			E('div', { 'class': 'qx-label-box' }, [
				_('Enable Randomized BSSID'),
				E('span', { 'class': 'qx-info-btn', 'title': _('Generates randomized virtual MAC address for the wireless interface') }, 'i')
			]),
			E('div', { 'class': 'qx-control-box' }, [ randomSwitchWrap ])
		]);
		self.formBody.appendChild(rowRandom);

		// Row 5: Wi-Fi Security Dropdown
		var curEnc = form.encryption || 'psk2';
		var secSelect = E('select', { 'class': 'qx-select' }, [
			E('option', { 'value': 'psk2', 'selected': (curEnc === 'psk2' || curEnc === 'wpa2') }, 'WPA2-PSK'),
			E('option', { 'value': 'sae', 'selected': (curEnc === 'sae' || curEnc === 'wpa3') }, 'WPA3-SAE'),
			E('option', { 'value': 'sae-mixed', 'selected': (curEnc === 'sae-mixed' || curEnc === 'psk2+sae' || curEnc === 'psk-mixed') }, 'WPA2/WPA3 Mixed'),
			E('option', { 'value': 'none', 'selected': (curEnc === 'none' || !curEnc) }, _('Open / None'))
		]);

		var rowSec = E('div', { 'class': 'qx-form-row' }, [
			E('div', { 'class': 'qx-label-box' }, [ _('Wi-Fi Security') ]),
			E('div', { 'class': 'qx-control-box' }, [ secSelect ])
		]);
		self.formBody.appendChild(rowSec);

		// Row 6: Wi-Fi Password Input + Show/Hide Eye
		var pwdInput = E('input', {
			'type': form.showPassword ? 'text' : 'password',
			'class': 'qx-input-text qx-pwd-input',
			'value': form.key,
			'placeholder': 'Enter 8-63 character password'
		});
		pwdInput.addEventListener('input', function() { form.key = this.value; });

		var pwdEyeBtn = E('button', {
			'class': 'qx-pwd-eye',
			'title': _('Toggle Password Visibility'),
			'click': function(ev) {
				ev.stopPropagation();
				form.showPassword = !form.showPassword;
				pwdInput.type = form.showPassword ? 'text' : 'password';
				pwdEyeBtn.textContent = form.showPassword ? '👁️‍🗨️' : '👁️';
			}
		}, form.showPassword ? '👁️‍🗨️' : '👁️');

		var pwdWrap = E('div', { 'class': 'qx-pwd-wrap' }, [ pwdInput, pwdEyeBtn ]);

		var rowPwd = E('div', { 'class': 'qx-form-row', 'style': (curEnc === 'none' ? 'display: none;' : '') }, [
			E('div', { 'class': 'qx-label-box' }, [ _('Wi-Fi Password') ]),
			E('div', { 'class': 'qx-control-box' }, [ pwdWrap ])
		]);
		self.formBody.appendChild(rowPwd);

		secSelect.addEventListener('change', function() {
			form.encryption = this.value;
			rowPwd.style.display = (this.value === 'none') ? 'none' : 'flex';
		});

		// Row 7: SSID Visibility Dropdown
		var hideSelect = E('select', { 'class': 'qx-select' }, [
			E('option', { 'value': '0', 'selected': !form.hidden }, _('Shown')),
			E('option', { 'value': '1', 'selected': form.hidden }, _('Hidden'))
		]);
		hideSelect.addEventListener('change', function() { form.hidden = (this.value === '1'); });

		var rowHide = E('div', { 'class': 'qx-form-row' }, [
			E('div', { 'class': 'qx-label-box' }, [ _('SSID Visibility') ]),
			E('div', { 'class': 'qx-control-box' }, [ hideSelect ])
		]);
		self.formBody.appendChild(rowHide);

		// Row 8: Wi-Fi Mode Selector
		var modeOptions = (activeRadio.band === '5g') ? [
			{ val: '11a/n/ac/ax', label: '11a/n/ac/ax' },
			{ val: '11a/n/ac', label: '11a/n/ac' },
			{ val: '11a/n/ac', label: '11a/n' }
		] : [
			{ val: '11g/n/ax', label: '11g/n/ax' },
			{ val: '11b/g/n', label: '11b/g/n' },
			{ val: '11b/g', label: '11b/g' }
		];

		var modeSelect = E('select', { 'class': 'qx-select' });
		modeOptions.forEach(function(m) {
			modeSelect.appendChild(E('option', { 'value': m.val }, m.label));
		});

		var rowMode = E('div', { 'class': 'qx-form-row' }, [
			E('div', { 'class': 'qx-label-box' }, [ _('Wi-Fi Mode') ]),
			E('div', { 'class': 'qx-control-box' }, [ modeSelect ])
		]);
		self.formBody.appendChild(rowMode);

		// Row 9: Bandwidth (HT Mode) Dropdown
		var curHtmode = form.htmode || (activeRadio.band === '5g' ? 'HE80' : 'HE20');
		var bwSelect = E('select', { 'class': 'qx-select' });

		var supportedBw = (activeRadio.band === '5g') ? [
			{ val: 'HE160', label: '160 MHz' },
			{ val: 'HE80', label: '80 MHz' },
			{ val: 'HE40', label: '40 MHz' },
			{ val: 'HE20', label: '20 MHz' }
		] : [
			{ val: 'HE40', label: '20/40 MHz' },
			{ val: 'HE20', label: '20 MHz' }
		];

		supportedBw.forEach(function(b) {
			var isSel = (b.val === curHtmode || (curHtmode.indexOf(b.label.replace(' MHz', '')) !== -1));
			bwSelect.appendChild(E('option', { 'value': b.val, 'selected': isSel }, b.label));
		});
		bwSelect.addEventListener('change', function() { form.htmode = this.value; });

		var rowBw = E('div', { 'class': 'qx-form-row' }, [
			E('div', { 'class': 'qx-label-box' }, [ _('Bandwidth') ]),
			E('div', { 'class': 'qx-control-box' }, [ bwSelect ])
		]);
		self.formBody.appendChild(rowBw);

		// Row 10: Channel Dropdown
		var curChan = form.channel || 'auto';
		var chanSelect = E('select', { 'class': 'qx-select' }, [
			E('option', { 'value': 'auto', 'selected': (curChan === 'auto' || curChan === '0') }, _('Auto'))
		]);

		(activeRadio.supported_channels || []).forEach(function(ch) {
			var chVal = String(ch.channel);
			chanSelect.appendChild(E('option', { 'value': chVal, 'selected': (chVal === String(curChan)) }, 'Channel ' + chVal + ' (' + ch.mhz + ' MHz)'));
		});
		chanSelect.addEventListener('change', function() { form.channel = this.value; });

		var rowChan = E('div', { 'class': 'qx-form-row' }, [
			E('div', { 'class': 'qx-label-box' }, [
				_('Channel'),
				E('span', { 'class': 'qx-info-btn', 'title': _('Selecting Auto chooses the cleanest frequency channel automatically') }, 'i')
			]),
			E('div', { 'class': 'qx-control-box' }, [ chanSelect ])
		]);
		self.formBody.appendChild(rowChan);

		// Row 11: Modify Button
		var modifyBtn = E('button', {
			'class': 'qx-modify-btn',
			'click': function() {
				var newSsid = strTrim(form.ssid);
				if (!newSsid || newSsid.length === 0) {
					ui.addNotification(null, E('p', _('Please enter a valid Wi-Fi SSID Name.')), 'error');
					return;
				}
				if (newSsid.length > 32) {
					ui.addNotification(null, E('p', _('SSID Name must not exceed 32 characters.')), 'error');
					return;
				}

				var newEnc = form.encryption;
				var newKey = strTrim(form.key);
				if (newEnc !== 'none') {
					if (newKey.length < 8 || newKey.length > 63) {
						ui.addNotification(null, E('p', _('Password must be between 8 and 63 characters.')), 'error');
						return;
					}
				}

				var params = {
					radio: activeRadio.radio,
					iface_section: activeIface.section,
					ssid: newSsid,
					encryption: newEnc,
					key: (newEnc === 'none') ? '' : newKey,
					channel: form.channel,
					htmode: form.htmode,
					txpower: parseInt(form.txpower) || 30,
					hidden: form.hidden,
					iface_disabled: !form.isWifiEnabled,
					random_bssid: form.random_bssid
				};

				self.state.isApplying = true;
				ui.showModal(_('Applying Wireless Settings...'), [
					E('p', { 'class': 'spinning' }, _('Updating wireless configuration for %s...').format(activeTab.label))
				]);

				callModifyWireless(
					params.radio,
					params.iface_section,
					params.ssid,
					params.encryption,
					params.key,
					params.channel,
					params.htmode,
					params.txpower,
					params.hidden,
					params.iface_disabled,
					params.random_bssid
				).then(function(res) {
					self.state.isApplying = false;
					ui.hideModal();
					if (res && res.success) {
						ui.addNotification(null, E('p', res.message || _('Wireless settings applied successfully.')), 'info');
						callGetWirelessInfo().then(function(d) {
							self.state.data = d;
							self.syncTabList();
							self.renderTabs();
							self.renderForm();
						});
					} else {
						ui.addNotification(null, E('p', _('Failed to apply wireless settings: %s').format(res.message || 'Error')), 'error');
					}
				}).catch(function(err) {
					self.state.isApplying = false;
					ui.hideModal();
					ui.addNotification(null, E('p', _('Error: %s').format(err.message || err)), 'error');
				});
			}
		}, _('Modify'));

		var modifyWrap = E('div', { 'class': 'qx-modify-wrap' }, [ modifyBtn ]);
		self.formBody.appendChild(modifyWrap);
	},

	showQrCodeModal: function(ssid, enc, key, hidden) {
		var secType = 'WPA';
		if (enc === 'none' || !enc) secType = 'nopass';
		else if (enc === 'wep') secType = 'WEP';

		var qrText = 'WIFI:S:' + ssid + ';T:' + secType + ';P:' + (secType !== 'nopass' ? key : '') + ';H:' + (hidden ? 'true' : 'false') + ';;';

		var modalContent = E('div', { 'style': 'text-align: center; padding: 10px 0;' }, [
			E('p', { 'style': 'font-size: 13.5px; opacity: 0.85; margin-bottom: 16px;' }, _('Scan this QR code with your phone camera to instantly connect to <strong>%s</strong>:').format(ssid)),
			E('div', { 'id': 'wifi-qr-container', 'style': 'display: flex; justify-content: center; margin: 16px 0;' }, [
				E('img', {
					'src': 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(qrText),
					'alt': 'Wi-Fi QR Code',
					'style': 'border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); padding: 8px; background: white;'
				})
			]),
			E('p', { 'style': 'font-family: monospace; font-size: 12px; opacity: 0.7; word-break: break-all;' }, qrText),
			E('div', { 'style': 'display: flex; justify-content: center; margin-top: 20px;' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Close'))
			])
		]);

		ui.showModal(_('Wi-Fi QR Code') + ' — ' + ssid, [ modalContent ]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
