'use strict';
'require view';
'require ui';
'require rpc';
'require fs';

/*
 * Modern, Elegant & Production-Ready MAC Filter Manager for OpenWrt LuCI (Argon Theme)
 */

var callGetStatus = rpc.declare({
	object: 'luci.macfilter',
	method: 'get_status',
	expect: { '': {} }
});

var callValidate = rpc.declare({
	object: 'luci.macfilter',
	method: 'validate_maclist',
	params: ['content', 'filepath'],
	expect: { '': {} }
});

var callApply = rpc.declare({
	object: 'luci.macfilter',
	method: 'apply_macfilter',
	params: ['mode', 'action', 'filename'],
	expect: { '': {} }
});

var callRestore = rpc.declare({
	object: 'luci.macfilter',
	method: 'restore_backup',
	expect: { '': {} }
});

return view.extend({
	state: {
		status: {},
		mode: 'disabled',
		macsText: '',
		validCount: 0,
		invalidCount: 0,
		duplicateCount: 0,
		uploadedFileName: '',
		importAction: 'replace',
		errorMessage: ''
	},

	load: function() {
		return L.resolveDefault(callGetStatus(), {});
	},

	normalizeMac: function(mac) {
		if (!mac) return '';
		return mac.trim().toUpperCase().replace(/-/g, ':');
	},

	isValidMac: function(mac) {
		return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac);
	},

	parseText: function(text) {
		var lines = (text || '').split(/\r?\n/);
		var validMacs = [];
		var seen = {};
		var errors = [];
		var duplicates = 0;

		for (var i = 0; i < lines.length; i++) {
			var line = lines[i].trim();
			if (!line || line.indexOf('#') === 0) continue;

			var norm = this.normalizeMac(line);
			if (this.isValidMac(norm)) {
				if (seen[norm]) {
					duplicates++;
				} else {
					seen[norm] = true;
					validMacs.push(norm);
				}
			} else {
				errors.push({ line: i + 1, value: line });
			}
		}

		return {
			macs: validMacs,
			validCount: validMacs.length,
			errors: errors,
			invalidCount: errors.length,
			duplicates: duplicates
		};
	},

	render: function(statusData) {
		var self = this;
		self.state.status = statusData || {};

		var currentMode = (self.state.status.mode || 'disabled').toLowerCase();
		if (currentMode === 'disable' || currentMode === 'none' || currentMode === 'restored') {
			var firstNetFilter = (self.state.status.networks && self.state.status.networks[0]) ? self.state.status.networks[0].macfilter : 'disabled';
			if (firstNetFilter === 'allow') currentMode = 'allow';
			else if (firstNetFilter === 'deny') currentMode = 'deny';
			else currentMode = 'disabled';
		}
		self.state.mode = currentMode;

		var activeMacs = self.state.status.active_macs || [];
		self.state.macsText = activeMacs.join('\n');
		var initialParsed = self.parseText(self.state.macsText);
		self.state.validCount = initialParsed.validCount;
		self.state.invalidCount = initialParsed.invalidCount;
		self.state.duplicateCount = initialParsed.duplicates;

		var mainDiv = E('div', { 'class': 'cbi-map', 'id': 'macfilter-app-container' });

		// Complete Elegant Styling System
		var style = E('style', {}, [
			'#macfilter-app-container { max-width: 1080px; margin: 0 auto; font-family: inherit; }',
			'#macfilter-app-container .mf-hero { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }',
			'#macfilter-app-container .mf-hero-title { margin: 0; font-size: 24px; font-weight: 700; display: flex; align-items: center; gap: 10px; letter-spacing: -0.3px; }',
			'#macfilter-app-container .mf-hero-sub { margin: 6px 0 0 0; opacity: 0.75; font-size: 13px; line-height: 1.5; }',
			
			'#macfilter-app-container .mf-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 24px; }',
			'#macfilter-app-container .mf-metric-card { background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px 18px; backdrop-filter: blur(10px); transition: transform 0.2s ease, box-shadow 0.2s ease; }',
			'#macfilter-app-container .mf-metric-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.15); }',
			'#macfilter-app-container .mf-metric-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; opacity: 0.65; font-weight: 600; margin-bottom: 6px; }',
			'#macfilter-app-container .mf-metric-val { font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 8px; }',
			'#macfilter-app-container .mf-metric-hint { font-size: 12px; opacity: 0.65; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
			
			'#macfilter-app-container .mf-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 22px 24px; margin-bottom: 24px; backdrop-filter: blur(12px); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }',
			'#macfilter-app-container .mf-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }',
			'#macfilter-app-container .mf-card-title { font-size: 16px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px; }',
			
			'#macfilter-app-container .mf-modes-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }',
			'#macfilter-app-container .mf-mode-box { border: 2px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 18px; cursor: pointer; transition: all 0.22s ease; background: rgba(255,255,255,0.015); position: relative; overflow: hidden; }',
			'#macfilter-app-container .mf-mode-box:hover { border-color: rgba(94, 114, 228, 0.4); background: rgba(94, 114, 228, 0.04); }',
			'#macfilter-app-container .mf-mode-box.active-disabled { border-color: #95a5a6; background: rgba(149, 165, 166, 0.12); box-shadow: 0 0 16px rgba(149, 165, 166, 0.2); }',
			'#macfilter-app-container .mf-mode-box.active-allow { border-color: #2ecc71; background: rgba(46, 204, 113, 0.12); box-shadow: 0 0 16px rgba(46, 204, 113, 0.2); }',
			'#macfilter-app-container .mf-mode-box.active-deny { border-color: #e74c3c; background: rgba(231, 76, 60, 0.12); box-shadow: 0 0 16px rgba(231, 76, 60, 0.2); }',
			'#macfilter-app-container .mf-mode-head { font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }',
			'#macfilter-app-container .mf-mode-desc { font-size: 12px; opacity: 0.75; line-height: 1.5; margin: 0; }',
			
			'#macfilter-app-container .mf-dropzone { border: 2px dashed rgba(255,255,255,0.2); border-radius: 12px; padding: 24px; text-align: center; background: rgba(255,255,255,0.01); transition: all 0.2s ease; cursor: pointer; margin-bottom: 16px; }',
			'#macfilter-app-container .mf-dropzone:hover, #macfilter-app-container .mf-dropzone.dragover { border-color: #5e72e4; background: rgba(94, 114, 228, 0.08); }',
			
			'#macfilter-app-container .mf-editor-wrapper { position: relative; margin-top: 14px; }',
			'#macfilter-app-container .mf-textarea { width: 100%; min-height: 190px; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; font-size: 14px; line-height: 1.6; padding: 14px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.28); color: #ecf0f1; resize: vertical; box-sizing: border-box; transition: border-color 0.2s; letter-spacing: 0.5px; }',
			'#macfilter-app-container .mf-textarea:focus { border-color: #5e72e4; outline: none; box-shadow: 0 0 0 3px rgba(94, 114, 228, 0.2); }',
			
			'#macfilter-app-container .mf-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; padding: 10px 14px; background: rgba(0,0,0,0.15); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }',
			'#macfilter-app-container .mf-radio-pill { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; opacity: 0.9; margin-right: 14px; }',
			
			'#macfilter-app-container .mf-badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }',
			'#macfilter-app-container .mf-badge-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; margin-right: 6px; }',
			'#macfilter-app-container .mf-badge-success { background: rgba(46, 204, 113, 0.15); color: #2ecc71; border: 1px solid rgba(46, 204, 113, 0.3); }',
			'#macfilter-app-container .mf-badge-danger { background: rgba(231, 76, 60, 0.15); color: #e74c3c; border: 1px solid rgba(231, 76, 60, 0.3); }',
			'#macfilter-app-container .mf-badge-neutral { background: rgba(149, 165, 166, 0.15); color: #bdc3c7; border: 1px solid rgba(149, 165, 166, 0.3); }',
			
			'#macfilter-app-container .mf-ssid-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; font-size: 12px; margin-right: 6px; margin-top: 4px; }',
			'#macfilter-app-container .mf-info-callout { background: rgba(52, 152, 219, 0.1); border: 1px solid rgba(52, 152, 219, 0.3); border-radius: 10px; padding: 14px 16px; margin-top: 18px; font-size: 12.5px; line-height: 1.5; color: #90caf9; }',
			
			'#macfilter-app-container .mf-actions-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-top: 28px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); }',
			'#macfilter-app-container .mf-btn-apply { background: linear-gradient(135deg, #5e72e4 0%, #4353c7 100%) !important; border: none !important; color: #fff !important; font-size: 15px !important; font-weight: 700 !important; padding: 12px 36px !important; border-radius: 8px !important; box-shadow: 0 4px 15px rgba(94, 114, 228, 0.35) !important; cursor: pointer !important; transition: all 0.2s ease !important; }',
			'#macfilter-app-container .mf-btn-apply:hover { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(94, 114, 228, 0.5) !important; }',
			'#macfilter-app-container .mf-btn-sub { font-size: 14px; padding: 10px 20px; border-radius: 8px; cursor: pointer; transition: all 0.15s ease; }'
		]);
		mainDiv.appendChild(style);

		// Dynamic content holder
		var contentHolder = E('div', { 'id': 'mf-content-root' });
		mainDiv.appendChild(contentHolder);

		self.buildUI(contentHolder);

		return mainDiv;
	},

	buildUI: function(container) {
		var self = this;
		container.innerHTML = '';

		var st = self.state.status || {};
		var isFiltering = self.state.mode !== 'disabled';
		var netList = st.networks || [];

		// 1. HERO HEADER
		var hero = E('div', { 'class': 'mf-hero' }, [
			E('div', {}, [
				E('h2', { 'class': 'mf-hero-title' }, [
					E('span', { 'style': 'color: #5e72e4;' }, '🛡️'),
					_('MAC Filter Manager')
				]),
				E('p', { 'class': 'mf-hero-sub' }, _('Control Wi-Fi device access across all wireless AP networks. Choose Allowlist, Blocklist, or Disabled.'))
			]),
			E('div', {}, [
				isFiltering ? (
					self.state.mode === 'allow' ?
					E('span', { 'class': 'mf-badge mf-badge-success' }, [
						E('span', { 'class': 'mf-badge-dot', 'style': 'background: #2ecc71;' }),
						_('ALLOWLIST ACTIVE')
					]) :
					E('span', { 'class': 'mf-badge mf-badge-danger' }, [
						E('span', { 'class': 'mf-badge-dot', 'style': 'background: #e74c3c;' }),
						_('BLOCKLIST ACTIVE')
					])
				) :
				E('span', { 'class': 'mf-badge mf-badge-neutral' }, [
					E('span', { 'class': 'mf-badge-dot', 'style': 'background: #95a5a6;' }),
					_('FILTERING DISABLED')
				])
			])
		]);
		container.appendChild(hero);

		// 2. METRICS DASHBOARD
		var cardMode = E('div', { 'class': 'mf-metric-card' }, [
			E('div', { 'class': 'mf-metric-label' }, _('Policy Mode')),
			E('div', { 'class': 'mf-metric-val', 'style': 'color: ' + (self.state.mode === 'allow' ? '#2ecc71' : (self.state.mode === 'deny' ? '#e74c3c' : '#bdc3c7')) }, [
				self.state.mode === 'allow' ? '🛡️ Allowlist' : (self.state.mode === 'deny' ? '🚫 Blocklist' : '⚪ Disabled')
			]),
			E('div', { 'class': 'mf-metric-hint' }, self.state.mode === 'allow' ? _('Only listed devices allowed') : (self.state.mode === 'deny' ? _('Listed devices are blocked') : _('All devices allowed')))
		]);

		var cardCount = E('div', { 'class': 'mf-metric-card' }, [
			E('div', { 'class': 'mf-metric-label' }, _('Configured MACs')),
			E('div', { 'class': 'mf-metric-val' }, [
				E('span', { 'style': 'color: #5e72e4;' }, self.state.validCount.toString()),
				E('span', { 'style': 'font-size: 13px; font-weight: normal; opacity: 0.7;' }, _('addresses'))
			]),
			E('div', { 'class': 'mf-metric-hint' }, self.state.invalidCount > 0 ? E('span', { 'style': 'color: #e74c3c; font-weight: 600;' }, _('⚠️ %d invalid line(s)').format(self.state.invalidCount)) : _('Ready to apply'))
		]);

		var chipElements = netList.map(function(n) {
			return E('span', { 'class': 'mf-ssid-chip' }, [
				E('span', { 'style': 'color: #5e72e4;' }, '📶'),
				n.ssid + ' (' + n.device + ')'
			]);
		});

		var cardNets = E('div', { 'class': 'mf-metric-card' }, [
			E('div', { 'class': 'mf-metric-label' }, _('Protected Wi-Fi Networks')),
			E('div', { 'class': 'mf-metric-val' }, [
				E('span', {}, netList.length.toString()),
				E('span', { 'style': 'font-size: 13px; font-weight: normal; opacity: 0.7;' }, _('AP interfaces'))
			]),
			E('div', { 'style': 'margin-top: 4px;' }, chipElements.length ? chipElements : _('All AP Radios'))
		]);

		var cardApplied = E('div', { 'class': 'mf-metric-card' }, [
			E('div', { 'class': 'mf-metric-label' }, _('Last Applied')),
			E('div', { 'class': 'mf-metric-val', 'style': 'font-size: 16px; font-weight: 600;' }, st.last_applied || _('Never')),
			E('div', { 'class': 'mf-metric-hint' }, [
				_('Source: '),
				E('code', { 'style': 'font-size: 11px;' }, st.filename || (self.state.uploadedFileName || 'maclist.txt'))
			])
		]);

		var metricsGrid = E('div', { 'class': 'mf-metrics' }, [ cardMode, cardCount, cardNets, cardApplied ]);
		container.appendChild(metricsGrid);

		// 3. STEP 1: MODE SELECTION CARD
		var modeCard = E('div', { 'class': 'mf-card' }, [
			E('div', { 'class': 'mf-card-head' }, [
				E('h3', { 'class': 'mf-card-title' }, [
					E('span', { 'style': 'color: #5e72e4;' }, '1.'),
					_('Choose Filter Policy')
				]),
				E('span', { 'style': 'font-size: 12px; opacity: 0.65;' }, _('Applies uniformly to all Wi-Fi Access Points'))
			]),
			E('div', { 'class': 'mf-modes-grid' }, [
				// Disabled Box
				E('div', {
					'class': 'mf-mode-box ' + (self.state.mode === 'disabled' ? 'active-disabled' : ''),
					'click': function() {
						self.state.mode = 'disabled';
						self.buildUI(container);
					}
				}, [
					E('div', { 'class': 'mf-mode-head' }, [
						E('span', {}, _('Disabled')),
						self.state.mode === 'disabled' ? E('span', { 'style': 'color: #bdc3c7; font-size: 18px;' }, '✓') : ''
					]),
					E('p', { 'class': 'mf-mode-desc' }, _('MAC filtering is disabled. All Wi-Fi devices with valid password connect normally.'))
				]),
				// Allowlist Box
				E('div', {
					'class': 'mf-mode-box ' + (self.state.mode === 'allow' ? 'active-allow' : ''),
					'click': function() {
						self.state.mode = 'allow';
						self.buildUI(container);
					}
				}, [
					E('div', { 'class': 'mf-mode-head', 'style': 'color: #2ecc71;' }, [
						E('span', {}, _('Allowlist (Whitelist)')),
						self.state.mode === 'allow' ? E('span', { 'style': 'color: #2ecc71; font-size: 18px;' }, '✓') : ''
					]),
					E('p', { 'class': 'mf-mode-desc' }, _('Strict security. ONLY MAC addresses in your configured list are permitted to connect.'))
				]),
				// Blocklist Box
				E('div', {
					'class': 'mf-mode-box ' + (self.state.mode === 'deny' ? 'active-deny' : ''),
					'click': function() {
						self.state.mode = 'deny';
						self.buildUI(container);
					}
				}, [
					E('div', { 'class': 'mf-mode-head', 'style': 'color: #e74c3c;' }, [
						E('span', {}, _('Blocklist (Blacklist)')),
						self.state.mode === 'deny' ? E('span', { 'style': 'color: #e74c3c; font-size: 18px;' }, '✓') : ''
					]),
					E('p', { 'class': 'mf-mode-desc' }, _('Targeted restriction. MAC addresses in your list are blocked from connecting.'))
				])
			])
		]);
		container.appendChild(modeCard);

		// 4. STEP 2: MAC LIST & FILE UPLOAD CARD
		var fileInput = E('input', {
			'type': 'file',
			'accept': '.txt,text/plain',
			'style': 'display: none;',
			'change': function(ev) {
				var file = ev.target.files[0];
				if (!file) return;
				self.state.uploadedFileName = file.name;
				var reader = new FileReader();
				reader.onload = function(e) {
					var content = e.target.result;
					if (self.state.importAction === 'add') {
						self.state.macsText = (self.state.macsText.trim() ? self.state.macsText.trim() + '\n' : '') + content;
					} else {
						self.state.macsText = content;
					}
					var parsed = self.parseText(self.state.macsText);
					self.state.validCount = parsed.validCount;
					self.state.invalidCount = parsed.invalidCount;
					self.state.duplicateCount = parsed.duplicates;
					ui.addNotification(null, E('p', _('File "%s" loaded: %d valid MAC addresses found.').format(file.name, parsed.validCount)), 'info');
					self.buildUI(container);
				};
				reader.readAsText(file);
			}
		});

		var dropzone = E('div', {
			'class': 'mf-dropzone',
			'click': function() { fileInput.click(); },
			'dragover': function(ev) {
				ev.preventDefault();
				dropzone.classList.add('dragover');
			},
			'dragleave': function() {
				dropzone.classList.remove('dragover');
			},
			'drop': function(ev) {
				ev.preventDefault();
				dropzone.classList.remove('dragover');
				if (ev.dataTransfer.files && ev.dataTransfer.files[0]) {
					var f = ev.dataTransfer.files[0];
					self.state.uploadedFileName = f.name;
					var r = new FileReader();
					r.onload = function(e) {
						var content = e.target.result;
						if (self.state.importAction === 'add') {
							self.state.macsText = (self.state.macsText.trim() ? self.state.macsText.trim() + '\n' : '') + content;
						} else {
							self.state.macsText = content;
						}
						var parsed = self.parseText(self.state.macsText);
						self.state.validCount = parsed.validCount;
						self.state.invalidCount = parsed.invalidCount;
						self.state.duplicateCount = parsed.duplicates;
						ui.addNotification(null, E('p', _('Dropped "%s": %d valid MAC addresses loaded.').format(f.name, parsed.validCount)), 'info');
						self.buildUI(container);
					};
					r.readAsText(f);
				}
			}
		}, [
			E('div', { 'style': 'font-size: 32px; margin-bottom: 8px;' }, '📁'),
			E('div', { 'style': 'font-weight: 700; font-size: 15px; margin-bottom: 4px;' }, _('Click to Browse or Drag & Drop a .TXT File')),
			E('div', { 'style': 'font-size: 12px; opacity: 0.7;' }, _('Accepts plain text files with one MAC address per line (e.g. AA:BB:CC:11:22:33)'))
		]);

		var macsTextarea = E('textarea', {
			'class': 'mf-textarea',
			'placeholder': 'AA:BB:CC:11:22:33\nAA:BB:CC:44:55:66\nAA:BB:CC:77:88:99',
			'input': function(ev) {
				self.state.macsText = ev.target.value;
				self.updateCounter(counterSpan, errorAlert);
			}
		}, self.state.macsText);

		var counterSpan = E('div', { 'style': 'font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px;' });

		var errorAlert = E('div', {
			'style': 'display: ' + (self.state.invalidCount > 0 ? 'block' : 'none') + '; color: #ff7675; background: rgba(231,76,60,0.15); border: 1px solid #e74c3c; border-radius: 8px; padding: 12px 16px; margin-top: 14px; font-size: 13px;'
		});

		self.updateCounter(counterSpan, errorAlert);

		var listCard = E('div', { 'class': 'mf-card' }, [
			fileInput,
			E('div', { 'class': 'mf-card-head' }, [
				E('h3', { 'class': 'mf-card-title' }, [
					E('span', { 'style': 'color: #5e72e4;' }, '2.'),
					_('MAC Address List & Editor')
				]),
				E('div', { 'style': 'display: flex; gap: 8px;' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-action mf-btn-sub',
						'click': function() { fileInput.click(); }
					}, _('📁 Upload .TXT')),
					E('button', {
						'class': 'btn cbi-button cbi-button-neutral mf-btn-sub',
						'disabled': self.state.validCount === 0,
						'click': function() {
							var content = self.state.macsText;
							var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
							var url = URL.createObjectURL(blob);
							var a = document.createElement('a');
							a.href = url;
							a.download = 'macfilter_export_' + new Date().toISOString().slice(0,10) + '.txt';
							document.body.appendChild(a);
							a.click();
							document.body.removeChild(a);
							URL.revokeObjectURL(url);
						}
					}, _('📥 Export .TXT')),
					E('button', {
						'class': 'btn cbi-button cbi-button-remove mf-btn-sub',
						'click': function() {
							if (confirm(_('Clear the entire MAC address list?'))) {
								self.state.macsText = '';
								self.state.validCount = 0;
								self.state.invalidCount = 0;
								self.state.duplicateCount = 0;
								macsTextarea.value = '';
								self.updateCounter(counterSpan, errorAlert);
							}
						}
					}, _('🗑️ Clear'))
				])
			]),

			dropzone,

			// Toolbar with Import mode radio and Live count
			E('div', { 'class': 'mf-toolbar' }, [
				E('div', { 'style': 'display: flex; align-items: center;' }, [
					E('span', { 'style': 'font-weight: 600; font-size: 12.5px; opacity: 0.8; margin-right: 12px;' }, _('When uploading:')),
					E('label', { 'class': 'mf-radio-pill' }, [
						E('input', {
							'type': 'radio',
							'name': 'mf_import_action',
							'checked': self.state.importAction === 'replace',
							'change': function() { self.state.importAction = 'replace'; }
						}),
						E('span', {}, _('Replace existing list'))
					]),
					E('label', { 'class': 'mf-radio-pill' }, [
						E('input', {
							'type': 'radio',
							'name': 'mf_import_action',
							'checked': self.state.importAction === 'add',
							'change': function() { self.state.importAction = 'add'; }
						}),
						E('span', {}, _('Add to existing list'))
					])
				]),
				counterSpan
			]),

			E('div', { 'class': 'mf-editor-wrapper' }, [
				macsTextarea
			]),

			errorAlert,

			// Helpful Tip Box
			E('div', { 'class': 'mf-info-callout' }, [
				E('strong', {}, _('💡 Notice about Randomized MACs (Private Wi-Fi Addresses):')),
				E('div', { 'style': 'margin-top: 4px;' }, _('Modern smartphones and laptops randomize their Wi-Fi MAC address by default. If using <strong>Allowlist</strong> mode, add the device\'s current randomized MAC or turn off "Private Wi-Fi Address" on that device.'))
			])
		]);
		container.appendChild(listCard);

		// 5. ACTION BAR
		var applyBtn = E('button', {
			'class': 'btn cbi-button cbi-button-apply mf-btn-apply',
			'id': 'mf-apply-btn-main',
			'click': function() { self.executeApply(container); }
		}, _('⚡ APPLY MAC FILTER'));

		var resetBtn = E('button', {
			'class': 'btn cbi-button cbi-button-neutral mf-btn-sub',
			'style': 'padding: 12px 24px; font-size: 14px;',
			'click': function() {
				location.reload();
			}
		}, _('↺ Reset Changes'));

		var restoreBtn = st.has_backup ? E('button', {
			'class': 'btn cbi-button cbi-button-reset mf-btn-sub',
			'style': 'padding: 12px 20px; font-size: 14px;',
			'click': function() { self.executeRestore(container); }
		}, _('⏪ Restore Backup')) : '';

		var actionFooter = E('div', { 'class': 'mf-actions-footer' }, [
			E('div', {}, [ restoreBtn ]),
			E('div', { 'style': 'display: flex; gap: 14px;' }, [ resetBtn, applyBtn ])
		]);
		container.appendChild(actionFooter);
	},

	updateCounter: function(counterSpan, errorAlert) {
		var self = this;
		var parsed = self.parseText(self.state.macsText);
		self.state.validCount = parsed.validCount;
		self.state.invalidCount = parsed.invalidCount;
		self.state.duplicateCount = parsed.duplicates;

		counterSpan.innerHTML = '';
		counterSpan.appendChild(E('span', { 'class': 'mf-badge mf-badge-success' }, _('✓ %d Valid MAC(s)').format(parsed.validCount)));
		if (parsed.duplicates > 0) {
			counterSpan.appendChild(E('span', { 'class': 'mf-badge mf-badge-neutral', 'style': 'margin-left: 8px;' }, _('ℹ %d duplicates merged').format(parsed.duplicates)));
		}

		if (parsed.invalidCount > 0) {
			errorAlert.style.display = 'block';
			errorAlert.innerHTML = '<strong>' + _('⚠️ Invalid MAC address format detected:') + '</strong><br>' +
				parsed.errors.map(function(e) {
					return _('Line %d: <code>%s</code> (expected format: AA:BB:CC:DD:EE:FF)').format(e.line, e.value);
				}).join('<br>');
		} else {
			errorAlert.style.display = 'none';
			errorAlert.innerHTML = '';
		}
	},

	executeApply: function(container) {
		var self = this;
		var parsed = self.parseText(self.state.macsText);

		if (parsed.invalidCount > 0 && self.state.mode !== 'disabled') {
			ui.addNotification(null, E('p', _('Please fix invalid MAC address lines before applying.')), 'error');
			return;
		}

		if (self.state.mode === 'allow' && parsed.validCount === 0) {
			if (!confirm(_('WARNING: You have selected Allowlist mode with 0 MAC addresses. This will BLOCK ALL Wi-Fi devices from connecting!\n\nDo you want to continue?'))) {
				return;
			}
		}

		ui.showModal(_('Applying MAC Filter...'), [
			E('p', { 'class': 'spinning' }, _('Updating wireless configuration and reloading hostapd access points... Please wait a few seconds.'))
		]);

		var cleanContent = parsed.macs.join('\n') + '\n';
		var filename = self.state.uploadedFileName || 'maclist.txt';

		callValidate(cleanContent, '').then(function(valRes) {
			return callApply(self.state.mode, 'replace', filename).then(function(applyRes) {
				ui.hideModal();
				if (applyRes.success) {
					ui.addNotification(null, E('p', applyRes.message || _('MAC Filter successfully applied!')), 'info');
					return callGetStatus().then(function(st) {
						self.state.status = st;
						self.state.mode = st.mode || 'disabled';
						self.state.macsText = (st.active_macs || []).join('\n');
						var p = self.parseText(self.state.macsText);
						self.state.validCount = p.validCount;
						self.state.invalidCount = p.invalidCount;
						self.state.duplicateCount = p.duplicates;
						self.buildUI(container);
					});
				} else {
					ui.addNotification(null, E('p', _('Failed to apply MAC filter: %s').format(applyRes.message || 'Error')), 'error');
				}
			});
		}).catch(function(err) {
			ui.hideModal();
			ui.addNotification(null, E('p', _('Error applying MAC filter: %s').format(err.message || err)), 'error');
		});
	},

	executeRestore: function(container) {
		var self = this;
		if (!confirm(_('Are you sure you want to restore the previous MAC filter configuration from backup?'))) {
			return;
		}

		ui.showModal(_('Restoring Backup...'), [
			E('p', { 'class': 'spinning' }, _('Restoring previous configuration...'))
		]);

		callRestore().then(function(res) {
			ui.hideModal();
			if (res.success) {
				ui.addNotification(null, E('p', res.message || _('Backup restored successfully!')), 'info');
				return callGetStatus().then(function(st) {
					self.state.status = st;
					self.state.mode = st.mode || 'disabled';
					self.state.macsText = (st.active_macs || []).join('\n');
					var p = self.parseText(self.state.macsText);
					self.state.validCount = p.validCount;
					self.state.invalidCount = p.invalidCount;
					self.state.duplicateCount = p.duplicates;
					self.buildUI(container);
				});
			} else {
				ui.addNotification(null, E('p', res.message || _('Failed to restore backup.')), 'error');
			}
		}).catch(function(err) {
			ui.hideModal();
			ui.addNotification(null, E('p', _('Error restoring backup: %s').format(err.message || err)), 'error');
		});
	},

	handleSaveApply: function(ev, mode) {
		var root = document.getElementById('mf-content-root');
		if (root) this.executeApply(root);
		return Promise.resolve();
	},
	handleSave: function(ev) {
		var root = document.getElementById('mf-content-root');
		if (root) this.executeApply(root);
		return Promise.resolve();
	},
	handleReset: function(ev) {
		location.reload();
		return Promise.resolve();
	}
});
