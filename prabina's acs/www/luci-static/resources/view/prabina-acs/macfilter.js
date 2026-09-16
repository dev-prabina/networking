'use strict';
'require view';
'require ui';
'require rpc';

/*
 * prabina's acs - MAC Access Control Manager
 * Multi-router batch MAC whitelisting with Header-based and Branch router targeting
 */

var callListDevices = rpc.declare({
	object: 'luci.prabina_acs',
	method: 'list_devices',
	expect: { '': {} }
});

var callPushMac = rpc.declare({
	object: 'luci.prabina_acs',
	method: 'push_mac',
	params: ['mode', 'macs', 'target'],
	expect: { '': {} }
});

return view.extend({
	devices: [],
	parsedMacs: [],
	invalidMacs: [],

	load: function() {
		return callListDevices();
	},

	render: function(devData) {
		var self = this;
		this.devices = devData.devices || [];

		// Count categories and headers
		var glinetCount = 0;
		var jioCount = 0;
		var headerCount = 0;

		this.devices.forEach(function(d) {
			if (d.role === 'header' || d.id === 'local') headerCount++;
			if (d.type === 'glinet') glinetCount++;
			else if (d.type === 'jio') jioCount++;
		});

		// Inject CSS stylesheet
		var linkTag = document.createElement('link');
		linkTag.rel = 'stylesheet';
		linkTag.href = L.resource('prabina-acs/style.css');
		document.head.appendChild(linkTag);

		var container = E('div', { 'class': 'acs-container' });

		// Header
		var header = E('div', { 'class': 'acs-header' }, [
			E('div', { 'class': 'acs-title-area' }, [
				E('h2', { 'class': 'acs-title' }, [
					_("prabina's acs"),
					E('span', { 'class': 'acs-badge-header' }, _('MAC Access Control'))
				]),
				E('div', { 'class': 'acs-subtitle' }, [
					_('Batch Wi-Fi access whitelist manager for remote routers')
				])
			]),
			E('div', { 'class': 'acs-toolbar' }, [
				E('a', {
					'href': L.url('admin', 'prabina_acs', 'mac_control'),
					'target': '_blank',
					'rel': 'noopener noreferrer',
					'class': 'acs-btn acs-btn-launch',
					'title': _('Open ACS in a new browser tab')
				}, [ '↗ ', _("Open prabina's acs") ]),

				E('a', {
					'href': L.url('admin', 'prabina_acs', 'topology'),
					'class': 'acs-btn acs-btn-secondary'
				}, [ '🗺️ ', _('View Topology') ])
			])
		]);
		container.appendChild(header);

		// Summary Cards
		var summaryRow = E('div', { 'class': 'acs-mac-summary' }, [
			E('div', { 'class': 'acs-summary-card' }, [
				E('span', { 'class': 'acs-summary-label' }, _('Total Network Routers')),
				E('span', { 'class': 'acs-summary-value', 'id': 'acs-sum-total' }, this.devices.length)
			]),
			E('div', { 'class': 'acs-summary-card' }, [
				E('span', { 'class': 'acs-summary-label' }, _('Header Nodes / Roots')),
				E('span', { 'class': 'acs-summary-value', 'style': 'color: #f59e0b;' }, headerCount)
			]),
			E('div', { 'class': 'acs-summary-card' }, [
				E('span', { 'class': 'acs-summary-label' }, _('GL.iNet AX180P')),
				E('span', { 'class': 'acs-summary-value', 'style': 'color: #60a5fa;' }, glinetCount)
			]),
			E('div', { 'class': 'acs-summary-card' }, [
				E('span', { 'class': 'acs-summary-label' }, _('Jio Pure OpenWrt')),
				E('span', { 'class': 'acs-summary-value', 'style': 'color: #c084fc;' }, jioCount)
			])
		]);
		container.appendChild(summaryRow);

		// Form Card
		var formCard = E('div', { 'class': 'acs-card' });
		formCard.appendChild(E('h3', { 'class': 'acs-card-title' }, [ '🔒 ', _('Configure Allowed MAC Addresses') ]));

		// Input File & Textarea
		var fileInput = E('input', {
			'type': 'file',
			'accept': '.txt',
			'style': 'display: none;',
			'change': function(e) {
				var file = e.target.files[0];
				if (!file) return;
				var reader = new FileReader();
				reader.onload = function(evt) {
					var textarea = document.getElementById('acs-mac-input');
					if (textarea) {
						textarea.value = evt.target.result;
						self.validateMacInputs();
					}
				};
				reader.readAsText(file);
			}
		});

		var uploadBtn = E('button', {
			'type': 'button',
			'class': 'acs-btn acs-btn-secondary',
			'style': 'margin-bottom: 10px;',
			'click': function() { fileInput.click(); }
		}, [ '📁 ', _('Select .txt File with MACs') ]);

		var macTextarea = E('textarea', {
			'class': 'acs-form-textarea',
			'id': 'acs-mac-input',
			'rows': '7',
			'placeholder': 'AA:BB:CC:DD:EE:FF\n11:22:33:44:55:66\n0C:E6:7C:39:61:55',
			'style': 'font-family: monospace; font-size: 13px; line-height: 1.5;',
			'input': function() { self.validateMacInputs(); }
		});

		var validationBox = E('div', {
			'id': 'acs-mac-validation-box',
			'style': 'margin-top: 10px;'
		});

		formCard.appendChild(fileInput);
		formCard.appendChild(uploadBtn);
		formCard.appendChild(macTextarea);
		formCard.appendChild(validationBox);

		// Operation Mode Section
		var modeSection = E('div', { 'style': 'margin-top: 20px; border-top: 1px solid #334155; padding-top: 16px;' }, [
			E('label', { 'class': 'acs-form-label', 'style': 'font-size: 14px; margin-bottom: 10px;' }, _('MAC Operation Mode')),
			E('div', { 'class': 'acs-radio-group' }, [
				E('label', { 'class': 'acs-radio-label' }, [
					E('input', {
						'type': 'radio',
						'name': 'acs_mac_mode',
						'value': 'add',
						'checked': 'checked',
						'change': function() { self.toggleModeWarning(); }
					}),
					E('span', {}, _('Add to Existing List'))
				]),
				E('label', { 'class': 'acs-radio-label' }, [
					E('input', {
						'type': 'radio',
						'name': 'acs_mac_mode',
						'value': 'replace',
						'change': function() { self.toggleModeWarning(); }
					}),
					E('span', { 'style': 'color: #fca5a5;' }, _('Replace With New List'))
				])
			]),
			E('div', {
				'id': 'acs-mode-warning',
				'class': 'acs-alert acs-alert-danger',
				'style': 'display: none; font-weight: 500;'
			}, [
				'⚠️ <strong>' + _('Warning: ') + '</strong>' +
				_('This will remove the currently configured allowed MAC addresses from the selected routers and replace them with the uploaded list.')
			])
		]);
		formCard.appendChild(modeSection);

		// Header & Branch Target Selection Section
		formCard.appendChild(this.buildHeaderSelectionSection());

		// Push Action Button Section
		var actionSection = E('div', { 'style': 'margin-top: 20px; display: flex; align-items: center; gap: 14px;' }, [
			E('button', {
				'type': 'button',
				'class': 'acs-btn acs-btn-primary',
				'id': 'acs-btn-push-all',
				'style': 'padding: 10px 24px; font-size: 14px;',
				'click': function() { self.handlePushToRouters(); }
			}, [ '🚀 ', _('Push MAC to Selected Headers') ])
		]);
		formCard.appendChild(actionSection);

		container.appendChild(formCard);

		// Results Section
		var resultsCard = E('div', {
			'class': 'acs-card',
			'id': 'acs-results-card',
			'style': 'display: none;'
		}, [
			E('h3', { 'class': 'acs-card-title' }, [ '📋 ', _('Execution Results') ]),
			E('div', { 'id': 'acs-results-progress', 'class': 'acs-alert acs-alert-info', 'style': 'display: none;' }),
			E('table', { 'class': 'acs-table', 'id': 'acs-results-table' }, [
				E('thead', {}, [
					E('tr', {}, [
						E('th', {}, _('Router Name')),
						E('th', {}, _('Device Type')),
						E('th', {}, _('Tailscale IP')),
						E('th', {}, _('Status')),
						E('th', {}, _('Result Details'))
					])
				]),
				E('tbody', { 'id': 'acs-results-tbody' })
			])
		]);
		container.appendChild(resultsCard);

		// Initialize initial state
		setTimeout(function() {
			self.updatePushState();
		}, 0);

		return container;
	},

	buildHeaderSelectionSection: function() {
		var self = this;
		var deviceMap = {};
		this.devices.forEach(function(d) {
			deviceMap[d.id] = d;
		});

		var findRootHeaderId = function(devId) {
			var cur = deviceMap[devId];
			if (!cur) return devId;
			if (cur.role === 'header' || cur.id === 'local') return cur.id;

			var visited = {};
			visited[devId] = true;
			while (cur && cur.role === 'child' && cur.parent && cur.parent !== cur.id) {
				if (visited[cur.parent]) break;
				visited[cur.parent] = true;
				var p = deviceMap[cur.parent];
				if (!p) break;
				if (p.role === 'header' || p.id === 'local') return p.id;
				cur = p;
			}
			return cur ? cur.id : 'local';
		};

		var headerNodes = this.devices.filter(function(d) {
			return d.role === 'header' || d.id === 'local';
		});
		if (headerNodes.length === 0) {
			headerNodes = this.devices.slice(0, 1);
		}

		// Group devices by root header
		var headerGroups = {};
		headerNodes.forEach(function(h) {
			headerGroups[h.id] = {
				header: h,
				members: []
			};
		});

		this.devices.forEach(function(d) {
			var rootId = findRootHeaderId(d.id);
			if (headerGroups[rootId]) {
				headerGroups[rootId].members.push(d);
			} else if (headerNodes.length > 0) {
				headerGroups[headerNodes[0].id].members.push(d);
			}
		});

		// Helper to build recursive tree for a header branch
		var buildTreeItems = function(headerId) {
			var group = headerGroups[headerId];
			var members = group.members;

			var childrenOf = {};
			members.forEach(function(m) {
				var p = m.parent || '';
				if (m.role === 'child' && p) {
					if (!childrenOf[p]) childrenOf[p] = [];
					childrenOf[p].push(m.id);
				}
			});

			var treeRows = [];
			var visited = {};

			var traverse = function(nodeId, depth, prefix) {
				if (visited[nodeId]) return;
				visited[nodeId] = true;
				var node = deviceMap[nodeId];
				if (!node) return;

				var isRoot = (node.id === headerId);
				var isGw = (node.id === 'local' || node.type === 'header_gateway');
				var typeClass = isGw ? 'acs-badge-gateway' : (node.type === 'glinet' ? 'acs-badge-glinet' : 'acs-badge-jio');
				var typeName = isGw ? 'Header Gateway' : (node.type === 'glinet' ? 'GL.iNet AX180P' : 'Jio Pure OpenWrt');
				var treeSymbol = isRoot ? '●' : prefix;

				var chk = E('input', {
					'type': 'checkbox',
					'class': 'acs-router-checkbox acs-dev-check',
					'data-header-id': headerId,
					'data-device-id': node.id,
					'checked': 'checked',
					'change': function() {
						self.syncHeaderState(headerId);
						self.updatePushState();
					}
				});

				var row = E('div', {
					'class': 'acs-header-router-item',
					'style': 'padding-left: ' + (depth * 22 + 10) + 'px;'
				}, [
					chk,
					E('span', { 'class': 'acs-router-tree-line' }, treeSymbol),
					E('span', { 'class': 'acs-router-name' }, node.name),
					E('span', { 'class': 'acs-router-ip' }, '(' + (node.ip || '--') + ')'),
					E('span', { 'class': typeClass }, typeName),
					isRoot ? E('span', { 'class': 'acs-badge-headernode' }, _('Header Root')) : ''
				]);

				treeRows.push(row);

				var kids = childrenOf[nodeId] || [];
				for (var i = 0; i < kids.length; i++) {
					var isLast = (i === kids.length - 1);
					var childPrefix = isLast ? '└─' : '├─';
					traverse(kids[i], depth + 1, childPrefix);
				}
			};

			traverse(headerId, 0, '●');

			members.forEach(function(m) {
				if (!visited[m.id]) {
					traverse(m.id, 1, '└─');
				}
			});

			return treeRows;
		};

		// Container for selection section
		var targetSection = E('div', {
			'style': 'margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px;'
		});

		var targetHeaderRow = E('div', {
			'style': 'display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 8px;'
		}, [
			E('div', {}, [
				E('label', { 'class': 'acs-form-label', 'style': 'font-size: 14px; margin: 0;' }, [
					'🎯 ', _('Target Header Nodes & Branches')
				]),
				E('div', { 'class': 'acs-form-hint', 'style': 'margin-top: 2px;' }, [
					_('Choose one or more header nodes. All routers belonging to the selected header branch will receive the MAC whitelist configuration.')
				])
			]),
			E('div', { 'style': 'display: flex; gap: 8px; align-items: center;' }, [
				E('button', {
					'type': 'button',
					'class': 'acs-btn acs-btn-secondary acs-btn-sm',
					'click': function() { self.selectAllHeaders(true); }
				}, _('Select All Headers')),
				E('button', {
					'type': 'button',
					'class': 'acs-btn acs-btn-secondary acs-btn-sm',
					'click': function() { self.selectAllHeaders(false); }
				}, _('Deselect All'))
			])
		]);
		targetSection.appendChild(targetHeaderRow);

		var cardsBox = E('div', { 'class': 'acs-header-selection-box', 'id': 'acs-header-cards-box' });

		headerNodes.forEach(function(h) {
			var group = headerGroups[h.id];
			var memberCount = group.members.length;
			var isGw = (h.id === 'local' || h.type === 'header_gateway');
			var typeClass = isGw ? 'acs-badge-gateway' : (h.type === 'glinet' ? 'acs-badge-glinet' : 'acs-badge-jio');
			var typeName = isGw ? 'Header Gateway' : (h.type === 'glinet' ? 'GL.iNet AX180P' : 'Jio Pure OpenWrt');

			var bodyDiv = E('div', {
				'class': 'acs-header-branch-body',
				'id': 'acs-branch-body-' + h.id,
				'style': 'display: block;'
			}, buildTreeItems(h.id));

			var toggleBtn = E('button', {
				'type': 'button',
				'class': 'acs-branch-toggle-btn',
				'id': 'acs-toggle-btn-' + h.id,
				'click': function(e) {
					e.stopPropagation();
					var curDisplay = bodyDiv.style.display;
					bodyDiv.style.display = (curDisplay === 'none') ? 'block' : 'none';
					toggleBtn.textContent = (curDisplay === 'none') ? '▲ ' + _('Hide Routers') : '▼ ' + _('Show Routers');
				}
			}, '▲ ' + _('Hide Routers'));

			var headerCheck = E('input', {
				'type': 'checkbox',
				'class': 'acs-header-checkbox',
				'id': 'acs-hdr-check-' + h.id,
				'data-header-id': h.id,
				'checked': 'checked',
				'change': function(e) {
					var checked = e.target.checked;
					var memberChecks = bodyDiv.querySelectorAll('.acs-dev-check');
					memberChecks.forEach(function(c) {
						c.checked = checked;
					});
					card.classList.toggle('selected', checked);
					self.updatePushState();
				}
			});

			var headRow = E('div', {
				'class': 'acs-header-branch-head',
				'click': function(e) {
					if (e.target === headerCheck || e.target === toggleBtn) return;
					headerCheck.checked = !headerCheck.checked;
					headerCheck.dispatchEvent(new Event('change'));
				}
			}, [
				E('div', { 'class': 'acs-header-branch-title' }, [
					headerCheck,
					E('span', { 'class': 'acs-header-name' }, h.name),
					E('span', { 'class': 'acs-header-ip' }, '(' + (h.ip || '--') + ')'),
					isGw ? E('span', { 'class': 'acs-badge-gateway' }, 'Header Gateway') : E('span', { 'class': 'acs-badge-headernode' }, 'Header Node'),
					E('span', { 'class': typeClass }, typeName)
				]),
				E('div', { 'class': 'acs-header-branch-meta' }, [
					E('span', { 'class': 'acs-branch-count-badge', 'id': 'acs-hdr-count-' + h.id },
						memberCount + ' ' + (memberCount === 1 ? _('Router') : _('Routers'))
					),
					toggleBtn
				])
			]);

			var card = E('div', {
				'class': 'acs-header-branch-card selected',
				'id': 'acs-hdr-card-' + h.id
			}, [
				headRow,
				bodyDiv
			]);

			cardsBox.appendChild(card);
		});

		targetSection.appendChild(cardsBox);

		var summaryStatus = E('div', {
			'id': 'acs-target-summary',
			'style': 'margin-top: 10px; font-size: 13px; font-weight: 600; color: #2563eb;'
		});
		targetSection.appendChild(summaryStatus);

		return targetSection;
	},

	syncHeaderState: function(headerId) {
		var body = document.getElementById('acs-branch-body-' + headerId);
		var headerCheck = document.getElementById('acs-hdr-check-' + headerId);
		var card = document.getElementById('acs-hdr-card-' + headerId);
		if (!body || !headerCheck) return;

		var checks = body.querySelectorAll('.acs-dev-check');
		var total = checks.length;
		var checkedCount = 0;
		checks.forEach(function(c) { if (c.checked) checkedCount++; });

		if (checkedCount === 0) {
			headerCheck.checked = false;
			headerCheck.indeterminate = false;
			if (card) card.classList.remove('selected');
		} else if (checkedCount === total) {
			headerCheck.checked = true;
			headerCheck.indeterminate = false;
			if (card) card.classList.add('selected');
		} else {
			headerCheck.checked = false;
			headerCheck.indeterminate = true;
			if (card) card.classList.add('selected');
		}
	},

	selectAllHeaders: function(select) {
		var checks = document.querySelectorAll('.acs-header-checkbox, .acs-dev-check');
		checks.forEach(function(c) {
			c.checked = !!select;
			c.indeterminate = false;
		});
		var cards = document.querySelectorAll('.acs-header-branch-card');
		cards.forEach(function(card) {
			card.classList.toggle('selected', !!select);
		});
		this.updatePushState();
	},

	getSelectedRouterIds: function() {
		var ids = [];
		var checks = document.querySelectorAll('.acs-dev-check:checked');
		checks.forEach(function(c) {
			var id = c.getAttribute('data-device-id');
			if (id && ids.indexOf(id) === -1) {
				ids.push(id);
			}
		});
		return ids;
	},

	updatePushState: function() {
		var targetIds = this.getSelectedRouterIds();
		var pushBtn = document.getElementById('acs-btn-push-all');
		var sumDiv = document.getElementById('acs-target-summary');
		var count = targetIds.length;

		var headerCount = 0;
		var hdrChecks = document.querySelectorAll('.acs-header-checkbox');
		hdrChecks.forEach(function(h) {
			if (h.checked || h.indeterminate) headerCount++;
		});

		if (sumDiv) {
			if (count === 0) {
				sumDiv.innerHTML = '<span style="color: #ef4444;">⚠️ ' + _('No headers or routers selected.') + '</span>';
			} else {
				sumDiv.innerHTML = '✓ ' + count + ' ' + (count === 1 ? _('router') : _('routers')) + ' ' +
					_('targeted across') + ' ' + headerCount + ' ' + (headerCount === 1 ? _('header node') : _('header nodes')) + '.';
			}
		}

		if (pushBtn) {
			if (count === 0) {
				pushBtn.disabled = true;
				pushBtn.textContent = '⚠️ ' + _('Select at least one Header Node');
			} else {
				pushBtn.disabled = false;
				pushBtn.textContent = '🚀 ' + _('Push MAC to Selected Headers') + ' (' + count + ' ' + (count === 1 ? _('Router') : _('Routers')) + ')';
			}
		}
	},

	validateMacInputs: function() {
		var text = document.getElementById('acs-mac-input').value;
		var valBox = document.getElementById('acs-mac-validation-box');
		if (!valBox) return;

		var lines = text.split(/[\r\n, \t]+/);
		var valid = [];
		var invalid = [];
		var seen = {};

		lines.forEach(function(item) {
			var m = item.trim();
			if (!m) return;
			var norm = m.toUpperCase().replace(/-/g, ':');
			if (norm.match(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/)) {
				if (!seen[norm]) {
					seen[norm] = true;
					valid.push(norm);
				}
			} else {
				invalid.push(m);
			}
		});

		this.parsedMacs = valid;
		this.invalidMacs = invalid;

		if (valid.length === 0 && invalid.length === 0) {
			valBox.innerHTML = '';
			return;
		}

		var html = '';
		if (valid.length > 0) {
			html += '<div style="color: #34d399; font-size: 12.5px; font-weight: 600;">✓ ' +
				valid.length + ' ' + _('valid MAC address(es) detected') + '</div>';
		}
		if (invalid.length > 0) {
			html += '<div style="color: #f87171; font-size: 12.5px; font-weight: 600; margin-top: 4px;">✗ ' +
				invalid.length + ' ' + _('invalid entry(s): ') + '<span style="font-family: monospace;">' +
				invalid.slice(0, 5).join(', ') + (invalid.length > 5 ? '...' : '') + '</span></div>';
		}

		valBox.innerHTML = html;
	},

	toggleModeWarning: function() {
		var mode = document.querySelector('input[name="acs_mac_mode"]:checked').value;
		var warning = document.getElementById('acs-mode-warning');
		if (warning) {
			warning.style.display = (mode === 'replace') ? 'block' : 'none';
		}
	},

	handlePushToRouters: function() {
		var self = this;
		this.validateMacInputs();

		if (this.parsedMacs.length === 0) {
			ui.addNotification(null, E('p', {}, _('Please provide at least one valid MAC address.')), 'error');
			return;
		}

		if (this.invalidMacs.length > 0) {
			ui.addNotification(null, E('p', {}, _('Please correct or remove the invalid MAC entries before proceeding.')), 'error');
			return;
		}

		var targetIds = this.getSelectedRouterIds();
		if (targetIds.length === 0) {
			ui.addNotification(null, E('p', {}, _('Please select at least one header node or router to push to.')), 'error');
			return;
		}

		var mode = document.querySelector('input[name="acs_mac_mode"]:checked').value;

		if (mode === 'replace') {
			var confirmMsg = _('This will remove existing allowed MAC addresses and replace them with the new list on %d selected router(s).\n\nAre you sure you want to proceed?').replace('%d', targetIds.length);
			if (!confirm(confirmMsg)) {
				return;
			}
		}

		var pushBtn = document.getElementById('acs-btn-push-all');
		var resultsCard = document.getElementById('acs-results-card');
		var resultsProgress = document.getElementById('acs-results-progress');
		var tbody = document.getElementById('acs-results-tbody');

		pushBtn.disabled = true;
		pushBtn.textContent = 'Pushing to Selected Routers...';
		resultsCard.style.display = 'block';
		resultsProgress.style.display = 'block';
		resultsProgress.className = 'acs-alert acs-alert-info';
		resultsProgress.innerHTML = '<strong>' + _('Deploying MAC configuration to %d selected router(s) in chosen header(s)...').replace('%d', targetIds.length) + '</strong><br>' +
			_('Please wait, this may take a few seconds per router.');
		tbody.innerHTML = '';

		callPushMac(mode, self.parsedMacs, targetIds.join(',')).then(function(res) {
			resultsProgress.style.display = 'none';

			if (res && res.results) {
				res.results.forEach(function(item) {
					var typeLabel = (item.type === 'glinet') ? 'GL.iNet AX180P' : ((item.type === 'header_gateway') ? 'Header Gateway' : 'Jio Pure OpenWrt');
					var tr = E('tr', {}, [
						E('td', { 'style': 'font-weight: 600;' }, item.name || item.id),
						E('td', {}, typeLabel),
						E('td', { 'style': 'font-family: monospace;' }, item.ip || '-'),
						E('td', {}, [
							E('span', {
								'class': 'acs-badge ' + (item.status === 'success' ? 'acs-badge-success' : 'acs-badge-failed')
							}, item.status === 'success' ? '✓ ' + _('Success') : '✗ ' + _('Failed'))
						]),
						E('td', { 'style': 'color: ' + (item.status === 'success' ? '#94a3b8' : '#f87171') + ';' }, item.message || '-')
					]);
					tbody.appendChild(tr);
				});

				var sCount = (res.success_count != null) ? res.success_count : 0;
				var tCount = (res.total != null) ? res.total : 0;
				var fCount = (res.failed_count != null) ? res.failed_count : 0;
				var successSummary = _('Operation finished. Success: %d / %d, Failed: %d')
					.replace('%d', sCount)
					.replace('%d', tCount)
					.replace('%d', fCount);

				ui.addNotification(null, E('p', {}, successSummary), fCount === 0 ? 'info' : 'warning');
			} else {
				ui.addNotification(null, E('p', {}, _('Push execution failed: ') + (res.error || 'Unknown error')), 'error');
			}
		}).catch(function(err) {
			resultsProgress.style.display = 'none';
			ui.addNotification(null, E('p', {}, _('Failed: ') + (err.message || err)), 'error');
		}).finally(function() {
			self.updatePushState();
		});
	}
});
