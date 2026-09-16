'use strict';
'require view';
'require ui';
'require rpc';
'require poll';

/*
 * Prabina's ACS - Topology Canvas View
 * Native LuCI client-side view for interactive router network topology management
 */

var callListDevices = rpc.declare({
	object: 'luci.prabina_acs',
	method: 'list_devices',
	expect: { '': {} }
});

var callAddDevice = rpc.declare({
	object: 'luci.prabina_acs',
	method: 'add_device',
	params: ['name', 'ip', 'username', 'password', 'type', 'role', 'parent', 'port'],
	expect: { '': {} }
});

var callEditDevice = rpc.declare({
	object: 'luci.prabina_acs',
	method: 'edit_device',
	params: ['id', 'name', 'ip', 'username', 'password', 'type', 'role', 'parent', 'port', 'x', 'y'],
	expect: { '': {} }
});

var callDeleteDevice = rpc.declare({
	object: 'luci.prabina_acs',
	method: 'delete_device',
	params: ['id'],
	expect: { '': {} }
});

var callSaveTopology = rpc.declare({
	object: 'luci.prabina_acs',
	method: 'save_topology',
	params: ['nodes'],
	expect: { '': {} }
});

var callGetStatus = rpc.declare({
	object: 'luci.prabina_acs',
	method: 'get_status',
	params: ['target', 'force'],
	expect: { '': {} }
});

var callTestSsh = rpc.declare({
	object: 'luci.prabina_acs',
	method: 'test_ssh',
	params: ['id', 'ip', 'username', 'password', 'port'],
	expect: { '': {} }
});

return view.extend({
	canvas: null,
	devices: [],
	pollInterval: 25,
	isFullscreen: false,

	load: function() {
		return Promise.all([
			callListDevices(),
			callGetStatus('all', false)
		]);
	},

	render: function(data) {
		var self = this;
		var devData = data[0] || {};
		var statusData = data[1] || {};
		this.devices = devData.devices || [];

		// Inject external CSS stylesheet
		var linkTag = document.createElement('link');
		linkTag.rel = 'stylesheet';
		linkTag.href = L.resource('prabina-acs/style.css');
		document.head.appendChild(linkTag);

		// Load topology canvas engine if not loaded yet
		var loadScript = function() {
			return new Promise(function(resolve) {
				if (window.AcsTopologyCanvas) {
					resolve();
					return;
				}
				var script = document.createElement('script');
				script.src = L.resource('prabina-acs/topology-canvas.js');
				script.onload = resolve;
				document.head.appendChild(script);
			});
		};

		// Main Container
		var container = E('div', { 'class': 'acs-container' });

		// Top Header
		var header = E('div', { 'class': 'acs-header' }, [
			E('div', { 'class': 'acs-title-area' }, [
				E('h2', { 'class': 'acs-title' }, [
					_("prabina's acs"),
					E('span', { 'class': 'acs-badge-header' }, _('Topology Canvas'))
				]),
				E('div', { 'class': 'acs-subtitle' }, [
					_('Header Gateway: '),
					E('strong', { 'id': 'acs-header-gw-ip' }, devData.gateway_ip || '100.64.2.1'),
					' (' + (devData.hostname || 'prabina') + ')'
				])
			]),
			E('div', { 'class': 'acs-toolbar' }, [
				// Section 28 requirement: "Open prabina's acs" in new browser tab
				E('a', {
					'href': L.url('admin', 'prabina_acs', 'topology'),
					'target': '_blank',
					'rel': 'noopener noreferrer',
					'class': 'acs-btn acs-btn-launch',
					'title': _('Open ACS interface in a new browser tab')
				}, [ '↗ ', _("Open prabina's acs") ]),

				E('button', {
					'type': 'button',
					'class': 'acs-btn acs-btn-primary',
					'id': 'acs-top-btn-add',
					'click': function() { self.showAddDeviceModal(); }
				}, [ '+ ', _('Add Device') ]),

				E('button', {
					'type': 'button',
					'class': 'acs-btn acs-btn-success',
					'id': 'acs-top-btn-save',
					'click': function() { self.handleSaveTopology(); }
				}, [ '💾 ', _('Save Topology') ]),

				E('button', {
					'type': 'button',
					'class': 'acs-btn acs-btn-secondary',
					'id': 'acs-top-btn-refresh',
					'click': function() { self.handleRefreshStatus(true); }
				}, [ '🔄 ', _('Refresh Status') ]),

				E('button', {
					'type': 'button',
					'class': 'acs-btn acs-btn-secondary',
					'id': 'acs-top-btn-rearrange',
					'click': function() {
						if (self.canvas) self.canvas.autoRearrange();
					}
				}, [ '🔀 ', _('Rearrange') ]),

				E('button', {
					'type': 'button',
					'class': 'acs-btn acs-btn-secondary',
					'id': 'acs-top-btn-fullscreen',
					'click': function() { self.toggleFullscreen(); }
				}, [ '⛶ ', _('Fullscreen') ])
			])
		]);
		container.appendChild(header);

		// Canvas Wrapper
		var canvasWrapper = E('div', {
			'class': 'acs-canvas-wrapper',
			'id': 'acs-canvas-container'
		});
		container.appendChild(canvasWrapper);

		// Initialize interactive SVG canvas once DOM is attached
		loadScript().then(function() {
			self.canvas = new window.AcsTopologyCanvas(canvasWrapper, {
				onAddDevice: function() {
					self.showAddDeviceModal();
				},
				onNodeAction: function(node, evt) {
					self.showNodeActionMenu(node, evt);
				}
			});

			self.canvas.setDevices(self.devices);
			if (statusData && statusData.devices) {
				self.canvas.updateLiveMetrics(statusData);
			}

			// Setup background polling (15-25s)
			self.startPolling();
		});

		return container;
	},

	startPolling: function() {
		var self = this;
		poll.add(function() {
			if (document.hidden) return Promise.resolve();
			return callGetStatus('all', false).then(function(res) {
				if (self.canvas && res && res.devices) {
					self.canvas.updateLiveMetrics(res);
				}
			}).catch(function() {});
		}, this.pollInterval);
	},

	handleRefreshStatus: function(force) {
		var self = this;
		var btn = document.getElementById('acs-top-btn-refresh');
		if (btn) {
			btn.disabled = true;
			btn.textContent = '🔄 Probing...';
		}

		return callGetStatus('all', !!force).then(function(res) {
			if (self.canvas && res && res.devices) {
				self.canvas.updateLiveMetrics(res);
			}
			ui.addNotification(null, E('p', {}, _('Device metrics updated.')), 'info');
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, _('Failed to refresh status: ') + (err.message || err)), 'error');
		}).finally(function() {
			if (btn) {
				btn.disabled = false;
				btn.textContent = '🔄 Refresh Status';
			}
		});
	},

	handleSaveTopology: function() {
		if (!this.canvas) return;
		var topoData = this.canvas.getTopologyData();
		var btn = document.getElementById('acs-top-btn-save');
		if (btn) {
			btn.disabled = true;
			btn.textContent = '💾 Saving...';
		}

		return callSaveTopology(topoData).then(function(res) {
			if (res && res.success) {
				ui.addNotification(null, E('p', {}, _('Network topology layout saved successfully.')), 'info');
			} else {
				ui.addNotification(null, E('p', {}, _('Error saving topology: ') + (res.error || 'Unknown error')), 'error');
			}
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, _('Save failed: ') + (err.message || err)), 'error');
		}).finally(function() {
			if (btn) {
				btn.disabled = false;
				btn.textContent = '💾 Save Topology';
			}
		});
	},

	toggleFullscreen: function() {
		var wrapper = document.getElementById('acs-canvas-container');
		if (!wrapper) return;
		this.isFullscreen = !this.isFullscreen;
		if (this.isFullscreen) {
			wrapper.classList.add('acs-canvas-fullscreen');
		} else {
			wrapper.classList.remove('acs-canvas-fullscreen');
		}
		if (this.canvas) this.canvas.resetView();
	},

	showAddDeviceModal: function(preselectedParentId) {
		var self = this;
		var addTypeSelect = E('select', { 'class': 'acs-form-select', 'id': 'acs-add-type' }, [
			E('option', { 'value': 'glinet' }, 'GL.iNet AX180P'),
			E('option', { 'value': 'jio' }, 'Jio Pure OpenWrt')
		]);
		addTypeSelect.value = 'jio';

		var addRoleSelect = E('select', {
			'class': 'acs-form-select',
			'id': 'acs-add-role',
			'change': function(e) {
				var parentGroup = document.getElementById('acs-add-parent-group');
				if (parentGroup) {
					parentGroup.style.display = (e.target.value === 'header') ? 'none' : 'block';
				}
			}
		}, [
			E('option', { 'value': 'child' }, _('Child Node (Connect to Parent)')),
			E('option', { 'value': 'header' }, _('Header Node (Independent Root)'))
		]);
		addRoleSelect.value = 'child';

		var addParentSelect = E('select', { 'class': 'acs-form-select', 'id': 'acs-add-parent' }, 
			this.devices.map(function(d) {
				return E('option', { 'value': d.id }, d.name + (d.id === 'local' ? ' (Header Gateway)' : ' (' + d.ip + ')'));
			})
		);
		addParentSelect.value = preselectedParentId || 'local';

		var modalContent = E('div', { 'class': 'acs-modal-body' }, [
			E('div', { 'class': 'acs-form-group' }, [
				E('label', { 'class': 'acs-form-label' }, _('Device Name')),
				E('input', {
					'type': 'text',
					'class': 'acs-form-input',
					'id': 'acs-add-name',
					'placeholder': 'e.g. Bedroom Router, Office Router 01'
				})
			]),
			E('div', { 'class': 'acs-form-group' }, [
				E('label', { 'class': 'acs-form-label' }, _('Tailscale IP')),
				E('input', {
					'type': 'text',
					'class': 'acs-form-input',
					'id': 'acs-add-ip',
					'placeholder': 'e.g. 100.64.0.1'
				}),
				E('div', { 'class': 'acs-form-hint' }, _('Must be reachable over Tailscale VPN from Header Gateway.'))
			]),
			E('div', { 'style': 'display: flex; gap: 12px;' }, [
				E('div', { 'class': 'acs-form-group', 'style': 'flex: 1;' }, [
					E('label', { 'class': 'acs-form-label' }, _('SSH Username')),
					E('input', {
						'type': 'text',
						'class': 'acs-form-input',
						'id': 'acs-add-user',
						'value': 'root'
					})
				]),
				E('div', { 'class': 'acs-form-group', 'style': 'flex: 1;' }, [
					E('label', { 'class': 'acs-form-label' }, _('SSH Password')),
					E('input', {
						'type': 'password',
						'class': 'acs-form-input',
						'id': 'acs-add-pass',
						'placeholder': '••••••••'
					})
				])
			]),
			E('div', { 'class': 'acs-form-group' }, [
				E('label', { 'class': 'acs-form-label' }, _('Device Type')),
				addTypeSelect
			]),
			E('div', { 'style': 'display: flex; gap: 12px;' }, [
				E('div', { 'class': 'acs-form-group', 'style': 'flex: 1;' }, [
					E('label', { 'class': 'acs-form-label' }, _('Topology Role')),
					addRoleSelect
				]),
				E('div', { 'class': 'acs-form-group', 'id': 'acs-add-parent-group', 'style': 'flex: 1;' }, [
					E('label', { 'class': 'acs-form-label' }, _('Parent Device')),
					addParentSelect
				])
			])
		]);

		var backdrop = E('div', { 'class': 'acs-modal-backdrop' }, [
			E('div', { 'class': 'acs-modal-card' }, [
				E('div', { 'class': 'acs-modal-header' }, [
					E('h3', { 'class': 'acs-modal-title' }, _('Add New Router Node')),
					E('button', {
						'class': 'acs-modal-close',
						'click': function() { backdrop.remove(); }
					}, '×')
				]),
				modalContent,
				E('div', { 'class': 'acs-modal-footer' }, [
					E('button', {
						'type': 'button',
						'class': 'acs-btn acs-btn-secondary',
						'click': function() { backdrop.remove(); }
					}, _('Cancel')),
					E('button', {
						'type': 'button',
						'class': 'acs-btn acs-btn-primary',
						'id': 'acs-btn-submit-add',
						'click': function() {
							var name = document.getElementById('acs-add-name').value.trim();
							var ip = document.getElementById('acs-add-ip').value.trim();
							var user = document.getElementById('acs-add-user').value.trim() || 'root';
							var pass = document.getElementById('acs-add-pass').value;
							var type = document.getElementById('acs-add-type').value;
							var role = document.getElementById('acs-add-role').value;
							var parent = document.getElementById('acs-add-parent').value;

							if (!name) {
								ui.addNotification(null, E('p', {}, _('Please enter a device name.')), 'error');
								return;
							}
							if (!ip.match(/^([0-9]{1,3}\.){3}[0-9]{1,3}$/)) {
								ui.addNotification(null, E('p', {}, _('Please enter a valid Tailscale IP address.')), 'error');
								return;
							}

							var submitBtn = document.getElementById('acs-btn-submit-add');
							submitBtn.disabled = true;
							submitBtn.textContent = 'Adding...';

							callAddDevice(name, ip, user, pass, type, role, parent, 22).then(function(res) {
								if (res && res.success) {
									backdrop.remove();
									ui.addNotification(null, E('p', {}, _('Device added successfully.')), 'info');
									// Reload device list
									self.refreshDeviceList();
								} else {
									ui.addNotification(null, E('p', {}, _('Error adding device: ') + (res.error || 'Failed')), 'error');
									submitBtn.disabled = false;
									submitBtn.textContent = _('Add Device');
								}
							}).catch(function(err) {
								ui.addNotification(null, E('p', {}, _('Failed: ') + (err.message || err)), 'error');
								submitBtn.disabled = false;
								submitBtn.textContent = _('Add Device');
							});
						}
					}, _('Add Device'))
				])
			])
		]);

		document.body.appendChild(backdrop);
	},

	showEditDeviceModal: function(node) {
		var self = this;
		var isLocal = (node.id === 'local');

		var otherDevices = this.devices.filter(function(d) {
			return d.id !== node.id;
		});

		var editTypeSelect = E('select', { 'class': 'acs-form-select', 'id': 'acs-edit-type' }, [
			E('option', { 'value': 'glinet' }, 'GL.iNet AX180P'),
			E('option', { 'value': 'jio' }, 'Jio Pure OpenWrt')
		]);
		editTypeSelect.value = (node.type === 'glinet') ? 'glinet' : 'jio';

		var editRoleSelect = E('select', {
			'class': 'acs-form-select',
			'id': 'acs-edit-role',
			'change': function(e) {
				var parentGroup = document.getElementById('acs-edit-parent-group');
				if (parentGroup) {
					parentGroup.style.display = (e.target.value === 'header') ? 'none' : 'block';
				}
			}
		}, [
			E('option', { 'value': 'child' }, _('Child Node (Connect to Parent)')),
			E('option', { 'value': 'header' }, _('Header Node (Independent Root)'))
		]);
		editRoleSelect.value = (node.role === 'header') ? 'header' : 'child';

		var editParentSelect = E('select', { 'class': 'acs-form-select', 'id': 'acs-edit-parent' }, 
			otherDevices.map(function(d) {
				return E('option', { 'value': d.id }, d.name + (d.id === 'local' ? ' (Header Gateway)' : ' (' + d.ip + ')'));
			})
		);
		var currentParent = node.parent;
		if (!currentParent || currentParent === node.id) {
			currentParent = 'local';
		}
		editParentSelect.value = currentParent;

		var modalContent = E('div', { 'class': 'acs-modal-body' }, [
			E('div', { 'class': 'acs-form-group' }, [
				E('label', { 'class': 'acs-form-label' }, _('Device Name')),
				E('input', {
					'type': 'text',
					'class': 'acs-form-input',
					'id': 'acs-edit-name',
					'value': node.name
				})
			]),
			isLocal ? '' : E('div', { 'class': 'acs-form-group' }, [
				E('label', { 'class': 'acs-form-label' }, _('Tailscale IP')),
				E('input', {
					'type': 'text',
					'class': 'acs-form-input',
					'id': 'acs-edit-ip',
					'value': node.ip
				})
			]),
			isLocal ? '' : E('div', { 'style': 'display: flex; gap: 12px;' }, [
				E('div', { 'class': 'acs-form-group', 'style': 'flex: 1;' }, [
					E('label', { 'class': 'acs-form-label' }, _('SSH Username')),
					E('input', {
						'type': 'text',
						'class': 'acs-form-input',
						'id': 'acs-edit-user',
						'value': node.username || 'root'
					})
				]),
				E('div', { 'class': 'acs-form-group', 'style': 'flex: 1;' }, [
					E('label', { 'class': 'acs-form-label' }, _('New Password')),
					E('input', {
						'type': 'password',
						'class': 'acs-form-input',
						'id': 'acs-edit-pass',
						'placeholder': _('(Leave blank to keep current)')
					})
				])
			]),
			isLocal ? '' : E('div', { 'class': 'acs-form-group' }, [
				E('label', { 'class': 'acs-form-label' }, _('Device Type')),
				editTypeSelect
			]),
			isLocal ? '' : E('div', { 'style': 'display: flex; gap: 12px;' }, [
				E('div', { 'class': 'acs-form-group', 'style': 'flex: 1;' }, [
					E('label', { 'class': 'acs-form-label' }, _('Topology Role')),
					editRoleSelect
				]),
				E('div', {
					'class': 'acs-form-group',
					'id': 'acs-edit-parent-group',
					'style': ((node.role === 'header') ? 'display: none; ' : '') + 'flex: 1;'
				}, [
					E('label', { 'class': 'acs-form-label' }, _('Parent Device')),
					editParentSelect
				])
			])
		]);

		var backdrop = E('div', { 'class': 'acs-modal-backdrop' }, [
			E('div', { 'class': 'acs-modal-card' }, [
				E('div', { 'class': 'acs-modal-header' }, [
					E('h3', { 'class': 'acs-modal-title' }, _('Edit Device: ') + node.name),
					E('button', {
						'class': 'acs-modal-close',
						'click': function() { backdrop.remove(); }
					}, '×')
				]),
				modalContent,
				E('div', { 'class': 'acs-modal-footer' }, [
					E('button', {
						'type': 'button',
						'class': 'acs-btn acs-btn-secondary',
						'click': function() { backdrop.remove(); }
					}, _('Cancel')),
					E('button', {
						'type': 'button',
						'class': 'acs-btn acs-btn-primary',
						'click': function() {
							var name = document.getElementById('acs-edit-name').value.trim();
							var ip = isLocal ? node.ip : document.getElementById('acs-edit-ip').value.trim();
							var user = isLocal ? '' : (document.getElementById('acs-edit-user').value.trim() || 'root');
							var pass = isLocal ? '' : document.getElementById('acs-edit-pass').value;
							var type = isLocal ? 'header_gateway' : editTypeSelect.value;
							var role = isLocal ? 'header' : editRoleSelect.value;
							var parent = (isLocal || role === 'header') ? '' : editParentSelect.value;

							if (!isLocal && role === 'child' && (!parent || parent === node.id)) {
								parent = (node.parent && node.parent !== node.id) ? node.parent : 'local';
							}

							var nx = Math.round(Number(node.x) || (isLocal ? 450 : 250));
							var ny = Math.round(Number(node.y) || (isLocal ? 70 : 250));

							callEditDevice(node.id, name, ip, user, pass, type, role, parent, 22, nx, ny).then(function(res) {
								if (res && res.success) {
									backdrop.remove();
									ui.addNotification(null, E('p', {}, _('Device updated successfully.')), 'info');
									self.refreshDeviceList();
								} else {
									ui.addNotification(null, E('p', {}, _('Error updating device: ') + (res.error || 'Failed')), 'error');
								}
							}).catch(function(err) {
								ui.addNotification(null, E('p', {}, _('Failed: ') + (err.message || err)), 'error');
							});
						}
					}, _('Save Changes'))
				])
			])
		]);

		document.body.appendChild(backdrop);
	},

	showDeleteConfirmModal: function(node) {
		var self = this;
		if (node.id === 'local') return;

		var backdrop = E('div', { 'class': 'acs-modal-backdrop' }, [
			E('div', { 'class': 'acs-modal-card', 'style': 'max-width: 420px;' }, [
				E('div', { 'class': 'acs-modal-header' }, [
					E('h3', { 'class': 'acs-modal-title', 'style': 'color: #f87171;' }, _('Remove Router')),
					E('button', {
						'class': 'acs-modal-close',
						'click': function() { backdrop.remove(); }
					}, '×')
				]),
				E('div', { 'class': 'acs-modal-body' }, [
					E('p', { 'style': 'margin-top: 0; line-height: 1.5;' }, [
						_('Are you sure you want to remove '),
						E('strong', {}, node.name),
						' (' + node.ip + ')?'
					]),
					E('div', { 'class': 'acs-alert acs-alert-warning', 'style': 'margin: 10px 0 0 0;' }, [
						_('This will only remove the device from the ACS registry. It will NOT modify or reset the remote router.')
					])
				]),
				E('div', { 'class': 'acs-modal-footer' }, [
					E('button', {
						'type': 'button',
						'class': 'acs-btn acs-btn-secondary',
						'click': function() { backdrop.remove(); }
					}, _('Cancel')),
					E('button', {
						'type': 'button',
						'class': 'acs-btn acs-btn-danger',
						'click': function() {
							callDeleteDevice(node.id).then(function(res) {
								if (res && res.success) {
									backdrop.remove();
									ui.addNotification(null, E('p', {}, _('Device removed successfully.')), 'info');
									self.refreshDeviceList();
								} else {
									ui.addNotification(null, E('p', {}, _('Delete failed: ') + (res.error || 'Failed')), 'error');
								}
							}).catch(function(err) {
								ui.addNotification(null, E('p', {}, _('Delete failed: ') + (err.message || err)), 'error');
							});
						}
					}, _('Remove Device'))
				])
			])
		]);

		document.body.appendChild(backdrop);
	},

	showDiagnosticsModal: function(node) {
		var self = this;
		var isLocal = (node.id === 'local');
		var live = (self.canvas && self.canvas.nodes[node.id]) ? self.canvas.nodes[node.id] : node;

		var formatUptime = function(sec) {
			if (!sec || isNaN(sec)) return '--';
			sec = parseInt(sec, 10);
			var d = Math.floor(sec / 86400);
			var h = Math.floor((sec % 86400) / 3600);
			var m = Math.floor((sec % 3600) / 60);
			var s = sec % 60;
			if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
			if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
			return m + 'm ' + s + 's';
		};

		var formatBytes = function(b) {
			if (!b || isNaN(b)) return '0 B';
			b = parseInt(b, 10);
			if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
			if (b >= 1048576) return (b / 1048576).toFixed(2) + ' MB';
			if (b >= 1024) return (b / 1024).toFixed(2) + ' KB';
			return b + ' B';
		};

		var diagContainer = E('div', { 'class': 'acs-diag-body' });

		var updateDiagContent = function(n) {
			diagContainer.innerHTML = '';

			var isOnline = !!n.online;
			var wanDev = n.wan_dev || (isOnline ? 'wan' : '--');
			var wanRx = n.wan_rx != null ? n.wan_rx : 0;
			var wanTx = n.wan_tx != null ? n.wan_tx : 0;
			var rxFmt = isOnline ? (n.rx_formatted || '0 bps') : '--';
			var txFmt = isOnline ? (n.tx_formatted || '0 bps') : '--';
			var clients = isOnline ? (n.clients != null ? n.clients : '0') : '--';
			var clientSrc = isOnline ? (n.client_src || 'Associated Wi-Fi stations + active wired LAN') : '--';
			var uptimeStr = isOnline ? formatUptime(n.uptime) : '--';
			var updatedStr = n.updated ? new Date(n.updated * 1000).toLocaleTimeString() : '--';

			var typeTitle = isLocal ? 'Header Gateway' : (n.type === 'glinet' ? 'GL.iNet AX180P' : 'Jio Pure OpenWrt');
			var roleBadge = isLocal ? 'HEADER GATEWAY' : (n.role === 'header' ? 'HEADER NODE' : 'CHILD NODE');

			var grid = E('div', { 'class': 'acs-diag-grid' }, [
				// Device Overview
				E('div', { 'class': 'acs-diag-card' }, [
					E('div', { 'class': 'acs-diag-label' }, _('Hardware & Role')),
					E('div', { 'class': 'acs-diag-value' }, typeTitle),
					E('div', { 'class': 'acs-diag-sub' }, [
						E('span', { 'class': 'acs-badge ' + (isOnline ? 'acs-badge-success' : 'acs-badge-failed') }, isOnline ? 'Online' : 'Offline'),
						' Role: ' + roleBadge
					])
				]),
				// IP & Uplink
				E('div', { 'class': 'acs-diag-card' }, [
					E('div', { 'class': 'acs-diag-label' }, _('Active WAN Uplink Interface')),
					E('div', { 'class': 'acs-diag-value', 'style': 'font-family: monospace;' }, wanDev),
					E('div', { 'class': 'acs-diag-sub' }, 'IP: ' + (n.ip || '100.64.x.x'))
				]),
				// Download Speed
				E('div', { 'class': 'acs-diag-card' }, [
					E('div', { 'class': 'acs-diag-label' }, _('Internet Download Speed (WAN RX)')),
					E('div', { 'class': 'acs-diag-value', 'style': 'color: #0284c7;' }, '↓ ' + rxFmt),
					E('div', { 'class': 'acs-diag-sub' }, _('Raw RX Counter: ') + formatBytes(wanRx) + ' (' + Number(wanRx).toLocaleString() + ' B)')
				]),
				// Upload Speed
				E('div', { 'class': 'acs-diag-card' }, [
					E('div', { 'class': 'acs-diag-label' }, _('Internet Upload Speed (WAN TX)')),
					E('div', { 'class': 'acs-diag-value', 'style': 'color: #10b981;' }, '↑ ' + txFmt),
					E('div', { 'class': 'acs-diag-sub' }, _('Raw TX Counter: ') + formatBytes(wanTx) + ' (' + Number(wanTx).toLocaleString() + ' B)')
				]),
				// Connected Clients
				E('div', { 'class': 'acs-diag-card' }, [
					E('div', { 'class': 'acs-diag-label' }, _('Active Connected Users / Clients')),
					E('div', { 'class': 'acs-diag-value', 'style': 'color: #8b5cf6;' }, String(clients)),
					E('div', { 'class': 'acs-diag-sub' }, _('Source: ') + clientSrc)
				]),
				// System Uptime & Polling
				E('div', { 'class': 'acs-diag-card' }, [
					E('div', { 'class': 'acs-diag-label' }, _('System Uptime & Sync')),
					E('div', { 'class': 'acs-diag-value' }, uptimeStr),
					E('div', { 'class': 'acs-diag-sub' }, _('Last Checked: ') + updatedStr)
				])
			]);

			diagContainer.appendChild(grid);
		};

		updateDiagContent(live);

		var refreshBtn = E('button', {
			'type': 'button',
			'class': 'acs-btn acs-btn-primary',
			'id': 'acs-btn-diag-refresh',
			'click': function() {
				refreshBtn.disabled = true;
				refreshBtn.textContent = '🔄 Probing...';
				callGetStatus(node.id, true).then(function(res) {
					if (res && res.devices) {
						if (self.canvas) self.canvas.updateLiveMetrics(res);
						var updatedNode = (self.canvas && self.canvas.nodes[node.id]) ? self.canvas.nodes[node.id] : null;
						if (updatedNode) updateDiagContent(updatedNode);
					}
					ui.addNotification(null, E('p', {}, _('Diagnostics updated.')), 'info');
				}).catch(function(err) {
					ui.addNotification(null, E('p', {}, _('Failed: ') + (err.message || err)), 'error');
				}).finally(function() {
					refreshBtn.disabled = false;
					refreshBtn.textContent = '🔄 Refresh Metrics';
				});
			}
		}, [ '🔄 ', _('Refresh Metrics') ]);

		var backdrop = E('div', { 'class': 'acs-modal-backdrop' }, [
			E('div', { 'class': 'acs-modal-card', 'style': 'max-width: 620px;' }, [
				E('div', { 'class': 'acs-modal-header' }, [
					E('h3', { 'class': 'acs-modal-title' }, [ '📊 ', _('Diagnostics: '), node.name ]),
					E('button', {
						'class': 'acs-modal-close',
						'click': function() { backdrop.remove(); }
					}, '×')
				]),
				E('div', { 'class': 'acs-modal-body', 'style': 'padding: 16px 20px;' }, [
					diagContainer
				]),
				E('div', { 'class': 'acs-modal-footer' }, [
					refreshBtn,
					E('button', {
						'type': 'button',
						'class': 'acs-btn acs-btn-secondary',
						'click': function() { backdrop.remove(); }
					}, _('Close'))
				])
			])
		]);

		document.body.appendChild(backdrop);
	},

	showSshInfoModal: function(node) {
		var self = this;
		var ip = node.ip || '100.x.x.x';
		var user = node.username || 'root';
		var sshCmd = 'ssh ' + user + '@' + ip;

		var statusResultBox = E('div', {
			'id': 'acs-ssh-test-result',
			'style': 'display: none; margin-top: 14px;'
		});

		var backdrop = E('div', { 'class': 'acs-modal-backdrop' }, [
			E('div', { 'class': 'acs-modal-card' }, [
				E('div', { 'class': 'acs-modal-header' }, [
					E('h3', { 'class': 'acs-modal-title' }, _('SSH Access: ') + node.name),
					E('button', {
						'class': 'acs-modal-close',
						'click': function() { backdrop.remove(); }
					}, '×')
				]),
				E('div', { 'class': 'acs-modal-body' }, [
					E('div', { 'class': 'acs-form-group' }, [
						E('label', { 'class': 'acs-form-label' }, _('CLI Connection Command')),
						E('input', {
							'type': 'text',
							'class': 'acs-form-input',
							'readonly': 'readonly',
							'value': sshCmd,
							'style': 'font-family: monospace; background: #0b1120; cursor: pointer;',
							'click': function(e) { e.target.select(); }
						}),
						E('div', { 'class': 'acs-form-hint' }, _('Use your terminal or PowerShell with Tailscale active.'))
					]),
					E('div', { 'style': 'margin-top: 16px;' }, [
						E('button', {
							'type': 'button',
							'class': 'acs-btn acs-btn-secondary',
							'id': 'acs-btn-test-ssh',
							'click': function() {
								var btn = document.getElementById('acs-btn-test-ssh');
								btn.disabled = true;
								btn.textContent = 'Testing connection...';
								statusResultBox.style.display = 'block';
								statusResultBox.className = 'acs-alert acs-alert-info';
								statusResultBox.textContent = _('Connecting via Tailscale SSH...');

								callTestSsh(node.id, '', '', '', 22).then(function(res) {
									if (res && res.success) {
										statusResultBox.className = 'acs-alert acs-alert-info';
										statusResultBox.innerHTML = '<strong>✓ ' + _('SSH Connected Successfully!') + '</strong><br>' +
											_('Hostname: ') + (res.hostname || 'Unknown') + '<br>' + _('Latency test passed.');
									} else {
										statusResultBox.className = 'acs-alert acs-alert-danger';
										statusResultBox.innerHTML = '<strong>✗ ' + _('SSH Connection Failed') + '</strong><br>' +
											(res.error || _('Connection timed out or auth rejected.'));
									}
								}).catch(function(err) {
									statusResultBox.className = 'acs-alert acs-alert-danger';
									statusResultBox.textContent = _('Error: ') + (err.message || err);
								}).finally(function() {
									btn.disabled = false;
									btn.textContent = _('Test SSH Connectivity');
								});
							}
						}, _('Test SSH Connectivity'))
					]),
					statusResultBox
				]),
				E('div', { 'class': 'acs-modal-footer' }, [
					E('button', {
						'type': 'button',
						'class': 'acs-btn acs-btn-primary',
						'click': function() { backdrop.remove(); }
					}, _('Close'))
				])
			])
		]);

		document.body.appendChild(backdrop);
	},

	showNodeActionMenu: function(node, evt) {
		var self = this;
		var oldMenu = document.getElementById('acs-node-context-menu');
		if (oldMenu) oldMenu.remove();

		var isLocal = (node.id === 'local');
		var ip = node.ip || '100.64.2.1';
		var webUrl = 'http://' + ip;

		var menuWidth = 185;
		var menuHeight = isLocal ? 220 : 260;
		var posX = (evt && evt.clientX != null) ? evt.clientX : (window.innerWidth / 2 - menuWidth / 2);
		var posY = (evt && evt.clientY != null) ? evt.clientY : (window.innerHeight / 2 - menuHeight / 2);

		// Clamp within mobile screen boundaries
		if (posX + menuWidth > window.innerWidth - 12) {
			posX = Math.max(10, window.innerWidth - menuWidth - 12);
		}
		if (posX < 10) posX = 10;
		if (posY + menuHeight > window.innerHeight - 12) {
			posY = Math.max(10, window.innerHeight - menuHeight - 12);
		}
		if (posY < 10) posY = 10;

		var menu = E('div', {
			'id': 'acs-node-context-menu',
			'style': 'position: fixed; top: ' + posY + 'px; left: ' + posX + 'px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 10001; min-width: ' + menuWidth + 'px; padding: 6px 0; overflow: hidden;'
		}, [
			// Open Web UI
			E('a', {
				'href': webUrl,
				'target': '_blank',
				'rel': 'noopener noreferrer',
				'style': 'display: flex; align-items: center; gap: 8px; padding: 8px 14px; color: #0f172a; font-size: 13px; font-weight: 500; text-decoration: none; cursor: pointer;',
				'mouseenter': function(e) { e.target.style.background = '#f1f5f9'; },
				'mouseleave': function(e) { e.target.style.background = 'transparent'; },
				'click': function() { menu.remove(); }
			}, [ '🌐 ', _('Open Web UI') ]),

			// SSH Info
			E('div', {
				'style': 'display: flex; align-items: center; gap: 8px; padding: 8px 14px; color: #0f172a; font-size: 13px; font-weight: 500; cursor: pointer;',
				'mouseenter': function(e) { e.target.style.background = '#f1f5f9'; },
				'mouseleave': function(e) { e.target.style.background = 'transparent'; },
				'click': function() {
					menu.remove();
					self.showSshInfoModal(node);
				}
			}, [ '💻 ', _('SSH Action / Test') ]),

			// Diagnostics & Traffic Stats
			E('div', {
				'style': 'display: flex; align-items: center; gap: 8px; padding: 8px 14px; color: #0284c7; font-size: 13px; font-weight: 500; cursor: pointer;',
				'mouseenter': function(e) { e.target.style.background = '#f0f9ff'; },
				'mouseleave': function(e) { e.target.style.background = 'transparent'; },
				'click': function() {
					menu.remove();
					self.showDiagnosticsModal(node);
				}
			}, [ '📊 ', _('Diagnostics & Traffic') ]),

			// Add Child Device
			E('div', {
				'style': 'display: flex; align-items: center; gap: 8px; padding: 8px 14px; color: #0f172a; font-size: 13px; font-weight: 500; cursor: pointer;',
				'mouseenter': function(e) { e.target.style.background = '#f1f5f9'; },
				'mouseleave': function(e) { e.target.style.background = 'transparent'; },
				'click': function() {
					menu.remove();
					self.showAddDeviceModal(node.id);
				}
			}, [ '➕ ', _('Add Child Device') ]),

			// Edit Device
			E('div', {
				'style': 'display: flex; align-items: center; gap: 8px; padding: 8px 14px; color: #0f172a; font-size: 13px; font-weight: 500; cursor: pointer;',
				'mouseenter': function(e) { e.target.style.background = '#f1f5f9'; },
				'mouseleave': function(e) { e.target.style.background = 'transparent'; },
				'click': function() {
					menu.remove();
					self.showEditDeviceModal(node);
				}
			}, [ '✏️ ', _('Edit Device') ]),

			// Delete Device (not for local)
			isLocal ? '' : E('div', {
				'style': 'display: flex; align-items: center; gap: 8px; padding: 8px 14px; color: #dc2626; font-size: 13px; font-weight: 500; cursor: pointer; border-top: 1px solid #f1f5f9;',
				'mouseenter': function(e) { e.target.style.background = '#fef2f2'; },
				'mouseleave': function(e) { e.target.style.background = 'transparent'; },
				'click': function() {
					menu.remove();
					self.showDeleteConfirmModal(node);
				}
			}, [ '🗑️ ', _('Remove Device') ])
		]);

		var closeHandler = function(e) {
			if (!menu.contains(e.target)) {
				menu.remove();
				window.removeEventListener('click', closeHandler);
				window.removeEventListener('pointerdown', closeHandler);
			}
		};
		setTimeout(function() {
			window.addEventListener('click', closeHandler);
			window.addEventListener('pointerdown', closeHandler);
		}, 10);

		document.body.appendChild(menu);
	},

	refreshDeviceList: function() {
		var self = this;
		return callListDevices().then(function(devData) {
			self.devices = devData.devices || [];
			if (self.canvas) {
				self.canvas.setDevices(self.devices);
			}
			return self.handleRefreshStatus(true);
		});
	}
});
