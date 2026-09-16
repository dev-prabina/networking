'use strict';

/**
 * Prabina's ACS - Lightweight Interactive SVG Topology Canvas
 * Zero dependencies, pure vanilla JS, optimized for low-resource OpenWrt routers.
 */

window.AcsTopologyCanvas = function(containerEl, options) {
	this.container = containerEl;
	this.options = options || {};
	this.nodes = {};         // map of id -> node data
	this.nodeElements = {};  // map of id -> SVG element group
	this.links = [];         // array of { from, to, pathEl }
	this.selectedId = null;
	this.scale = 1.0;
	this.panX = 0;
	this.panY = 0;
	this.isPanning = false;
	this.isPinching = false;
	this.dragNode = null;
	this.dragPointerId = null;
	this.dragOffset = { x: 0, y: 0 };
	this.dragStartScreen = { x: 0, y: 0 };
	this.hasMoved = false;
	this.isDirty = false;
	this.activePointers = {};
	this.rafPending = false;

	this.init();
};

window.AcsTopologyCanvas.prototype = {
	init: function() {
		var self = this;
		this.container.innerHTML = '';

		// Create SVG element
		this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		this.svg.setAttribute('class', 'acs-canvas-svg');
		this.svg.setAttribute('tabindex', '0');
		this.svg.style.touchAction = 'none';
		this.svg.style.userSelect = 'none';
		this.svg.style.webkitUserSelect = 'none';
		this.container.style.touchAction = 'none';

		// Definitions for gradients & markers
		var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
		defs.innerHTML = 
			'<marker id="acs-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
			'  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />' +
			'</marker>' +
			'<filter id="acs-node-shadow" x="-10%" y="-10%" width="125%" height="125%">' +
			'  <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.45"/>' +
			'</filter>';
		this.svg.appendChild(defs);

		// Viewport group for Zoom and Pan
		this.viewport = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		this.viewport.setAttribute('id', 'acs-viewport');
		this.svg.appendChild(this.viewport);

		// Group for connection links
		this.linksGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		this.linksGroup.setAttribute('id', 'acs-links');
		this.viewport.appendChild(this.linksGroup);

		// Group for router nodes
		this.nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		this.nodesGroup.setAttribute('id', 'acs-nodes');
		this.viewport.appendChild(this.nodesGroup);

		this.container.appendChild(this.svg);

		// Attach Pan & Zoom Event Listeners
		this.setupEvents();
		this.renderControls();
	},

	renderControls: function() {
		var self = this;
		var ctrl = document.createElement('div');
		ctrl.className = 'acs-canvas-controls';
		ctrl.innerHTML = 
			'<button type="button" class="acs-ctrl-btn" id="acs-btn-zoom-in" title="Zoom In">+</button>' +
			'<button type="button" class="acs-ctrl-btn" id="acs-btn-zoom-out" title="Zoom Out">−</button>' +
			'<button type="button" class="acs-ctrl-btn" id="acs-btn-fit" title="Reset View">⊙</button>';
		this.container.appendChild(ctrl);

		ctrl.querySelector('#acs-btn-zoom-in').onclick = function(e) { e.stopPropagation(); self.zoom(0.15); };
		ctrl.querySelector('#acs-btn-zoom-out').onclick = function(e) { e.stopPropagation(); self.zoom(-0.15); };
		ctrl.querySelector('#acs-btn-fit').onclick = function(e) { e.stopPropagation(); self.resetView(); };
	},

	setupEvents: function() {
		var self = this;
		var panStartX = 0;
		var panStartY = 0;
		var pinchStartDist = 0;
		var pinchStartScale = 1.0;
		var pinchSvgCenter = { x: 0, y: 0 };

		// Desktop mouse wheel zoom
		this.svg.addEventListener('wheel', function(e) {
			e.preventDefault();
			var delta = e.deltaY > 0 ? -0.1 : 0.1;
			self.zoom(delta, e.clientX, e.clientY);
		}, { passive: false });

		// Unified Pointer Down (Mouse, Touch, Pen)
		this.svg.addEventListener('pointerdown', function(e) {
			// For mouse, only react to primary button (left click)
			if (e.pointerType === 'mouse' && e.button !== 0) return;

			// If clicked the node action menu trigger (3 dots), let it handle its own click
			if (e.target && e.target.closest && e.target.closest('.acs-node-action-btn')) {
				return;
			}

			// Prevent touch gestures/scrolling on mobile canvas
			if (e.pointerType === 'touch') {
				try { e.preventDefault(); } catch (err) {}
			}

			self.activePointers[e.pointerId] = {
				clientX: e.clientX,
				clientY: e.clientY
			};

			try {
				if (self.svg.setPointerCapture) {
					self.svg.setPointerCapture(e.pointerId);
				}
			} catch (err) {}

			var pIds = Object.keys(self.activePointers);
			var count = pIds.length;

			if (count === 1) {
				// Single pointer: Check if touching a router node card or canvas background
				var targetNode = (e.target && e.target.closest) ? e.target.closest('.acs-node-group') : null;
				if (targetNode) {
					var nodeId = targetNode.getAttribute('data-id');
					self.dragNode = self.nodes[nodeId];
					self.dragPointerId = e.pointerId;
					self.selectedId = nodeId;
					self.hasMoved = false;

					var pt = self.screenToSvg(e.clientX, e.clientY);
					self.dragOffset.x = pt.x - self.dragNode.x;
					self.dragOffset.y = pt.y - self.dragNode.y;
					self.dragStartScreen.x = e.clientX;
					self.dragStartScreen.y = e.clientY;

					self.highlightSelected();
					if (self.options.onSelectNode) {
						self.options.onSelectNode(self.dragNode);
					}
				} else {
					// Canvas Pan
					self.isPanning = true;
					panStartX = e.clientX - self.panX;
					panStartY = e.clientY - self.panY;
					self.svg.classList.add('panning');
				}
			} else if (count >= 2) {
				// Multi-touch: Smooth pinch-to-zoom and two-finger canvas pan
				// Cancel any single node drag to avoid accidental repositioning while pinching
				self.dragNode = null;
				self.dragPointerId = null;
				self.isPanning = false;
				self.svg.classList.remove('panning');
				self.isPinching = true;

				var p1 = self.activePointers[pIds[0]];
				var p2 = self.activePointers[pIds[1]];

				pinchStartDist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
				pinchStartScale = self.scale;

				var centerScreenX = (p1.clientX + p2.clientX) / 2;
				var centerScreenY = (p1.clientY + p2.clientY) / 2;
				pinchSvgCenter = self.screenToSvg(centerScreenX, centerScreenY);
			}
		});

		// Unified Pointer Move
		window.addEventListener('pointermove', function(e) {
			if (!self.activePointers[e.pointerId]) return;

			self.activePointers[e.pointerId].clientX = e.clientX;
			self.activePointers[e.pointerId].clientY = e.clientY;

			var pIds = Object.keys(self.activePointers);
			var count = pIds.length;

			if (self.isPinching && count >= 2) {
				var p1 = self.activePointers[pIds[0]];
				var p2 = self.activePointers[pIds[1]];

				var curDist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
				if (pinchStartDist > 5 && curDist > 5) {
					var factor = curDist / pinchStartDist;
					var targetScale = Math.min(Math.max(pinchStartScale * factor, 0.4), 2.2);

					var curCenterX = (p1.clientX + p2.clientX) / 2;
					var curCenterY = (p1.clientY + p2.clientY) / 2;
					var rect = self.svg.getBoundingClientRect();

					self.scale = targetScale;
					self.panX = (curCenterX - rect.left) - (pinchSvgCenter.x * targetScale);
					self.panY = (curCenterY - rect.top) - (pinchSvgCenter.y * targetScale);

					self.scheduleRender();
				}
			} else if (self.dragNode && e.pointerId === self.dragPointerId) {
				var dx = e.clientX - self.dragStartScreen.x;
				var dy = e.clientY - self.dragStartScreen.y;
				// 4px movement threshold separates taps from drags
				if (!self.hasMoved && (dx * dx + dy * dy > 16)) {
					self.hasMoved = true;
				}

				if (self.hasMoved) {
					var pt = self.screenToSvg(e.clientX, e.clientY);
					self.dragNode.x = Math.round(pt.x - self.dragOffset.x);
					self.dragNode.y = Math.round(pt.y - self.dragOffset.y);
					self.isDirty = true;
					self.scheduleRender();
				}
			} else if (self.isPanning) {
				self.panX = e.clientX - panStartX;
				self.panY = e.clientY - panStartY;
				self.scheduleRender();
			}
		});

		// End pointer handling (pointerup / pointercancel)
		var endPointerHandler = function(e) {
			if (!self.activePointers[e.pointerId]) return;
			delete self.activePointers[e.pointerId];

			try {
				if (self.svg.hasPointerCapture && self.svg.hasPointerCapture(e.pointerId)) {
					self.svg.releasePointerCapture(e.pointerId);
				}
			} catch (err) {}

			var pIds = Object.keys(self.activePointers);
			var count = pIds.length;

			if (e.pointerId === self.dragPointerId) {
				if (self.dragNode) {
					if (self.hasMoved) {
						self.updateNodePosition(self.dragNode.id);
						self.updateLinks();
						if (self.options.onNodeMoved) {
							self.options.onNodeMoved(self.dragNode);
						}
					}
					self.dragNode = null;
				}
				self.dragPointerId = null;
			}

			if (count === 0) {
				if (self.isPanning) {
					self.isPanning = false;
					self.svg.classList.remove('panning');
					self.applyTransform();
				}
				self.isPinching = false;
			} else if (count === 1) {
				// Transition from pinch back to single pan
				self.isPinching = false;
				var remId = pIds[0];
				var p = self.activePointers[remId];
				self.isPanning = true;
				panStartX = p.clientX - self.panX;
				panStartY = p.clientY - self.panY;
			}
		};

		window.addEventListener('pointerup', endPointerHandler);
		window.addEventListener('pointercancel', endPointerHandler);
	},

	scheduleRender: function() {
		var self = this;
		if (this.rafPending) return;
		this.rafPending = true;
		window.requestAnimationFrame(function() {
			self.rafPending = false;
			if (self.dragNode) {
				self.updateNodePosition(self.dragNode.id);
				self.updateLinks();
			} else {
				self.applyTransform();
			}
		});
	},

	screenToSvg: function(screenX, screenY) {
		var rect = this.svg.getBoundingClientRect();
		return {
			x: (screenX - rect.left - this.panX) / this.scale,
			y: (screenY - rect.top - this.panY) / this.scale
		};
	},

	applyTransform: function() {
		this.viewport.setAttribute('transform', 'translate(' + this.panX + ',' + this.panY + ') scale(' + this.scale + ')');
	},

	zoom: function(delta, centerScreenX, centerScreenY) {
		var oldScale = this.scale;
		var newScale = Math.min(Math.max(oldScale + delta, 0.4), 2.2);
		if (newScale === oldScale) return;

		var rect = this.svg.getBoundingClientRect();
		var cx = (centerScreenX != null) ? centerScreenX - rect.left : rect.width / 2;
		var cy = (centerScreenY != null) ? centerScreenY - rect.top : rect.height / 2;

		this.panX = cx - ((cx - this.panX) * newScale) / oldScale;
		this.panY = cy - ((cy - this.panY) * newScale) / oldScale;
		this.scale = newScale;
		this.applyTransform();
	},

	resetView: function() {
		var rect = this.svg.getBoundingClientRect();
		var local = this.nodes['local'];
		if (local) {
			this.panX = Math.round((rect.width / 2) - (local.x + 105));
			this.panY = Math.round(50 - local.y);
		} else {
			this.panX = 0;
			this.panY = 0;
		}
		this.scale = 1.0;
		this.applyTransform();
	},

	setDevices: function(devicesList) {
		var self = this;
		this.nodes = {};
		this.nodesGroup.innerHTML = '';
		this.linksGroup.innerHTML = '';
		this.links = [];

		var remoteCount = 0;
		devicesList.forEach(function(d) {
			var isLocal = (d.id === 'local');
			var isHeader = isLocal || (d.role === 'header');

			self.nodes[d.id] = {
				id: d.id,
				name: d.name || d.id,
				ip: d.ip || '',
				username: d.username || 'root',
				type: isLocal ? 'header_gateway' : (d.type || 'jio'),
				role: isHeader ? 'header' : 'child',
				parent: isHeader ? '' : (d.parent || 'local'),
				x: (d.x != null) ? d.x : (isLocal ? 450 : 250),
				y: (d.y != null) ? d.y : (isLocal ? 70 : 260),
				online: isLocal,
				rx_formatted: '0 bps',
				tx_formatted: '0 bps',
				clients: 0
			};
			if (!isLocal) remoteCount++;
		});

		// Build SVG nodes
		Object.keys(this.nodes).forEach(function(id) {
			self.renderNode(self.nodes[id]);
		});

		// Build links
		this.buildLinks();
		this.applyTransform();

		// Handle first launch welcome state
		this.toggleWelcomeState(remoteCount === 0);
	},

	toggleWelcomeState: function(show) {
		var welcome = this.container.querySelector('#acs-welcome-overlay');
		if (show) {
			if (!welcome) {
				welcome = document.createElement('div');
				welcome.id = 'acs-welcome-overlay';
				welcome.className = 'acs-welcome-box';
				welcome.innerHTML = 
					'<div class="acs-welcome-title">Welcome to prabina\'s acs</div>' +
					'<div class="acs-welcome-text">Add your first device to build the network topology.</div>' +
					'<button type="button" class="acs-btn acs-btn-primary" id="acs-welcome-add-btn" style="padding: 10px 20px; font-size: 14px;">+ Add Device</button>';
				this.container.appendChild(welcome);

				var self = this;
				welcome.querySelector('#acs-welcome-add-btn').onclick = function() {
					if (self.options.onAddDevice) self.options.onAddDevice();
				};
			}
		} else if (welcome) {
			welcome.remove();
		}
	},

	renderNode: function(node) {
		var isGateway = (node.id === 'local' || node.type === 'header_gateway');
		var isHeader = (isGateway || node.role === 'header');
		var width = isGateway ? 220 : 210;
		var height = 112;

		var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		g.setAttribute('class', 'acs-node-group' + (node.id === this.selectedId ? ' acs-node-selected' : ''));
		g.setAttribute('data-id', node.id);
		g.setAttribute('transform', 'translate(' + node.x + ',' + node.y + ')');

		var isGlinet = (node.type === 'glinet');
		var hwLabel = isGlinet ? 'GL.iNet AX180P' : 'Jio Pure OpenWrt';
		var typeClass = isGateway ? 'header-gateway' : ((node.role === 'header' ? 'header-node ' : '') + (isGlinet ? 'glinet' : 'jio'));
		var typeLabel = isGateway ? 'HEADER GATEWAY' : (node.role === 'header' ? hwLabel + ' (Header)' : hwLabel);
		var badgeColor = isGateway ? '#38bdf8' : (node.role === 'header' ? '#f59e0b' : (isGlinet ? '#60a5fa' : '#c084fc'));

		var svgHtml = 
			// Card background
			'<rect class="acs-node-bg ' + typeClass + '" width="' + width + '" height="' + height + '" filter="url(#acs-node-shadow)"/>' +
			
			// Top Header banner / type badge
			'<rect x="0" y="0" width="' + width + '" height="24" rx="8" ry="8" fill="rgba(15, 23, 42, 0.75)"/>' +
			'<rect x="0" y="16" width="' + width + '" height="8" fill="rgba(15, 23, 42, 0.75)"/>' +
			'<text x="10" y="16" font-size="9.5" font-weight="700" fill="' + badgeColor + '" letter-spacing="0.5">' + typeLabel + '</text>' +
			
			// Status Indicator dot & text
			'<circle class="acs-status-dot ' + (node.online ? 'acs-status-dot-online' : 'acs-status-dot-offline') + '" id="dot-' + node.id + '" cx="' + (width - 65) + '" cy="12" r="3.5"/>' +
			'<text class="acs-status-text ' + (node.online ? 'acs-status-text-online' : 'acs-status-text-offline') + '" id="statustext-' + node.id + '" x="' + (width - 55) + '" y="15">' + (node.online ? 'Online' : 'Offline') + '</text>' +
			
			// Device Name
			'<text class="acs-node-title" x="12" y="44" font-size="13.5" font-weight="700">' + this.escapeHtml(node.name) + '</text>' +
			
			// IP Address
			'<text class="acs-node-ip" x="12" y="60" font-size="11">' + (node.ip || 'No IP') + '</text>' +
			
			// Divider line
			'<line x1="12" y1="67" x2="' + (width - 12) + '" y2="67" stroke="#334155" stroke-width="1"/>' +
			
			// Metrics row (Speeds & Users)
			'<text class="acs-node-stat" x="12" y="82">↓ <tspan class="acs-node-stat-down" id="rx-' + node.id + '">' + (node.rx_formatted || '0 bps') + '</tspan></text>' +
			'<text class="acs-node-stat" x="110" y="82">↑ <tspan class="acs-node-stat-up" id="tx-' + node.id + '">' + (node.tx_formatted || '0 bps') + '</tspan></text>' +
			'<text class="acs-node-stat" x="12" y="99">Users: <tspan class="acs-node-stat-users" id="users-' + node.id + '">' + (node.clients != null ? node.clients : '0') + '</tspan></text>' +
			
			// Actions trigger icon (gear / dots) with comfortable mobile touch target
			'<g class="acs-node-action-btn" id="act-' + node.id + '" transform="translate(' + (width - 26) + ', 86)" cursor="pointer">' +
			'  <rect x="-8" y="-8" width="32" height="32" fill="transparent" pointer-events="all"/>' +
			'  <circle cx="8" cy="8" r="10" fill="#334155" opacity="0.8"/>' +
			'  <text x="8" y="12" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">⋮</text>' +
			'</g>';

		g.innerHTML = svgHtml;

		// Action button handler
		var self = this;
		var actBtn = g.querySelector('#act-' + node.id);
		if (actBtn) {
			actBtn.addEventListener('pointerdown', function(e) {
				e.stopPropagation();
			});
			actBtn.addEventListener('click', function(e) {
				e.stopPropagation();
				if (self.options.onNodeAction) self.options.onNodeAction(node, e);
			});
		}

		this.nodesGroup.appendChild(g);
		this.nodeElements[node.id] = g;
	},

	updateNodePosition: function(id) {
		var g = this.nodeElements[id];
		var n = this.nodes[id];
		if (g && n) {
			g.setAttribute('transform', 'translate(' + n.x + ',' + n.y + ')');
		}
	},

	highlightSelected: function() {
		var self = this;
		Object.keys(this.nodeElements).forEach(function(id) {
			var el = self.nodeElements[id];
			if (id === self.selectedId) {
				el.classList.add('acs-node-selected');
			} else {
				el.classList.remove('acs-node-selected');
			}
		});
	},

	buildLinks: function() {
		var self = this;
		this.linksGroup.innerHTML = '';
		this.links = [];

		Object.keys(this.nodes).forEach(function(id) {
			var child = self.nodes[id];
			// If node is Header Gateway or a Header Node or has no parent, do NOT connect it to Gateway!
			if (id === 'local' || child.role === 'header' || !child.parent) return;

			var parent = self.nodes[child.parent];
			if (!parent) return; // Keep separate if no valid parent exists!

			var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('class', 'acs-link-path active');
			path.setAttribute('marker-end', 'url(#acs-arrow)');
			self.linksGroup.appendChild(path);

			self.links.push({
				from: parent.id,
				to: child.id,
				pathEl: path
			});
		});

		this.updateLinks();
	},

	updateLinks: function() {
		var self = this;
		this.links.forEach(function(link) {
			var p = self.nodes[link.from];
			var c = self.nodes[link.to];
			if (!p || !c) return;

			var pW = (p.id === 'local' || p.role === 'header') ? 220 : 210;
			var pH = 112;
			var cW = (c.id === 'local' || c.role === 'header') ? 220 : 210;
			var cH = 112;

			var startX, startY, endX, endY, cp1X, cp1Y, cp2X, cp2Y;

			// Check relative vertical & horizontal positions
			if (c.y >= p.y + pH - 15) {
				// Standard downward link (child below parent)
				startX = p.x + (pW / 2);
				startY = p.y + pH;
				endX = c.x + (cW / 2);
				endY = c.y - 3; // precisely at top border for arrowhead

				var dy = Math.max((endY - startY) * 0.5, 30);
				cp1X = startX;
				cp1Y = startY + dy;
				// Keep cp2X = endX so the curve enters vertically straight down into the child
				cp2X = endX;
				cp2Y = endY - dy;
			} else if (c.y + cH <= p.y + 15) {
				// Child is above parent
				startX = p.x + (pW / 2);
				startY = p.y;
				endX = c.x + (cW / 2);
				endY = c.y + cH + 3;

				var dy = Math.max((startY - endY) * 0.5, 30);
				cp1X = startX;
				cp1Y = startY - dy;
				cp2X = endX;
				cp2Y = endY + dy;
			} else {
				// Side by side link
				if (c.x >= p.x) {
					startX = p.x + pW;
					startY = p.y + (pH / 2);
					endX = c.x - 3;
					endY = c.y + (cH / 2);
					var dx = Math.max((endX - startX) * 0.5, 30);
					cp1X = startX + dx;
					cp1Y = startY;
					cp2X = endX - dx;
					cp2Y = endY;
				} else {
					startX = p.x;
					startY = p.y + (pH / 2);
					endX = c.x + cW + 3;
					endY = c.y + (cH / 2);
					var dx = Math.max((startX - endX) * 0.5, 30);
					cp1X = startX - dx;
					cp1Y = startY;
					cp2X = endX + dx;
					cp2Y = endY;
				}
			}

			var d = 'M ' + Math.round(startX) + ' ' + Math.round(startY) + ' ' +
					'C ' + Math.round(cp1X) + ' ' + Math.round(cp1Y) + ', ' +
					      Math.round(cp2X) + ' ' + Math.round(cp2Y) + ', ' +
					      Math.round(endX) + ' ' + Math.round(endY);

			link.pathEl.setAttribute('d', d);
		});
	},

	updateLiveMetrics: function(statusData) {
		var self = this;
		if (!statusData || !statusData.devices) return;

		Object.keys(statusData.devices).forEach(function(id) {
			var metric = statusData.devices[id];
			var n = self.nodes[id];
			if (!n) return;

			n.online = !!metric.online;
			n.rx_formatted = n.online ? (metric.rx_formatted || '0 bps') : '--';
			n.tx_formatted = n.online ? (metric.tx_formatted || '0 bps') : '--';
			n.clients = n.online ? (metric.clients != null ? metric.clients : 0) : '--';
			n.wan_dev = metric.wan_dev || (n.online ? 'wan' : '--');
			n.wan_rx = metric.wan_rx != null ? metric.wan_rx : 0;
			n.wan_tx = metric.wan_tx != null ? metric.wan_tx : 0;
			n.client_src = metric.client_src || '--';
			n.uptime = metric.uptime != null ? metric.uptime : 0;
			n.updated = metric.updated != null ? metric.updated : 0;

			var dot = self.container.querySelector('#dot-' + id);
			var txt = self.container.querySelector('#statustext-' + id);
			var rxEl = self.container.querySelector('#rx-' + id);
			var txEl = self.container.querySelector('#tx-' + id);
			var uEl = self.container.querySelector('#users-' + id);

			if (dot) {
				dot.setAttribute('class', 'acs-status-dot ' + (n.online ? 'acs-status-dot-online' : 'acs-status-dot-offline'));
			}
			if (txt) {
				txt.setAttribute('class', 'acs-status-text ' + (n.online ? 'acs-status-text-online' : 'acs-status-text-offline'));
				txt.textContent = n.online ? 'Online' : 'Offline';
			}
			if (rxEl) rxEl.textContent = n.rx_formatted;
			if (txEl) txEl.textContent = n.tx_formatted;
			if (uEl) uEl.textContent = n.clients;
		});
	},

	autoRearrange: function() {
		var self = this;

		// 1. Find all Header / Root nodes (independent trees)
		var rootIds = [];
		Object.keys(this.nodes).forEach(function(id) {
			var n = self.nodes[id];
			if (id === 'local' || n.role === 'header' || !n.parent || !self.nodes[n.parent]) {
				rootIds.push(id);
			}
		});

		// Ensure 'local' (Header Gateway) is the first root
		rootIds.sort(function(a, b) {
			if (a === 'local') return -1;
			if (b === 'local') return 1;
			return 0;
		});

		// 2. Build children adjacency map
		var childrenOf = {};
		Object.keys(this.nodes).forEach(function(id) { childrenOf[id] = []; });
		Object.keys(this.nodes).forEach(function(id) {
			var n = self.nodes[id];
			if (rootIds.indexOf(id) === -1 && n.parent && childrenOf[n.parent]) {
				childrenOf[n.parent].push(id);
			}
		});

		// 3. Compute subtree width
		function getSubtreeWidth(nodeId) {
			var ch = childrenOf[nodeId] || [];
			if (ch.length === 0) return 240;
			var sum = 0;
			ch.forEach(function(cid) {
				sum += getSubtreeWidth(cid);
			});
			return Math.max(sum, 240);
		}

		// 4. Recursive layout
		var ySpacing = 160;
		function layoutSubtree(nodeId, leftX, level) {
			var n = self.nodes[nodeId];
			var w = getSubtreeWidth(nodeId);
			var ch = childrenOf[nodeId] || [];

			if (ch.length === 0) {
				n.x = Math.round(leftX + (w - 210) / 2);
				n.y = 70 + (level * ySpacing);
			} else {
				var curLeft = leftX;
				var childCenters = [];
				ch.forEach(function(cid) {
					var cw = getSubtreeWidth(cid);
					layoutSubtree(cid, curLeft, level + 1);
					childCenters.push(self.nodes[cid].x + 105);
					curLeft += cw;
				});

				// Center parent above its children
				var firstCenter = childCenters[0];
				var lastCenter = childCenters[childCenters.length - 1];
				n.x = Math.round(((firstCenter + lastCenter) / 2) - 105);
				n.y = 70 + (level * ySpacing);
			}
			self.updateNodePosition(nodeId);
		}

		// 5. Layout each Header tree side-by-side
		var svgWidth = this.svg.clientWidth || 900;
		var totalForestWidth = 0;
		rootIds.forEach(function(rid, idx) {
			totalForestWidth += getSubtreeWidth(rid) + (idx > 0 ? 80 : 0);
		});

		var curX = Math.max((svgWidth - totalForestWidth) / 2, 60);
		rootIds.forEach(function(rid) {
			var tw = getSubtreeWidth(rid);
			layoutSubtree(rid, curX, 0);
			curX += tw + 80;
		});

		this.updateLinks();
		this.isDirty = true;
		this.resetView();
	},

	getTopologyData: function() {
		var self = this;
		return Object.keys(this.nodes).map(function(id) {
			var n = self.nodes[id];
			return {
				id: n.id,
				x: n.x,
				y: n.y,
				parent: (n.role === 'header' || n.id === 'local') ? '' : n.parent,
				role: n.role
			};
		});
	},

	escapeHtml: function(str) {
		if (!str) return '';
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}
};
