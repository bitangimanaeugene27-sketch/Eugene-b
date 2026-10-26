/**
 * CallFar Admin Hub — Master Controller & Interactive Logic
 */

import { adminApi, API_CONFIG } from './api.js';

class CallFarAdminApp {
  constructor() {
    this.currentView = 'overview';
    this.users = [];
    this.calls = [];
    this.auditLogs = [];
    this.licenseKeys = [];
    this.supportTickets = [];
    this.backups = [];
    this.stats = null;
    this.config = null;
    this.autoRefreshInterval = null;

    this.init();
  }

  async init() {
    this.updateServerBadge();
    this.renderProfile();
    this.bindNavigation();
    this.bindSearchAndFilters();
    this.bindModals();

    // If not authenticated as administrator, show login modal
    if (!adminApi.isAuthenticated()) {
      this.showLoginModal();
    } else {
      // Initial live data load
      await this.refreshAllData();
    }

    // Start auto-refresh cycle (every 15s)
    this.autoRefreshInterval = setInterval(() => {
      if (adminApi.isAuthenticated()) {
        this.refreshCurrentViewSilently();
      }
    }, 15000);
  }

  /* ========================================================================
     Navigation & Tab Routing
     ======================================================================== */
  bindNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        const viewId = item.getAttribute('data-view');
        if (viewId) {
          this.switchTab(viewId);
        }
      });
    });

    document.getElementById('btn-refresh')?.addEventListener('click', () => {
      this.refreshAllData(true);
    });

    document.getElementById('btn-quick-broadcast')?.addEventListener('click', () => {
      this.openModal('modal-broadcast');
    });
  }

  switchTab(viewId) {
    this.currentView = viewId;

    // Update Sidebar active state
    document.querySelectorAll('.sidebar-nav .nav-item').forEach((item) => {
      if (item.getAttribute('data-view') === viewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update Main Views visibility
    document.querySelectorAll('.module-view').forEach((view) => {
      view.classList.remove('active');
    });

    const activeView = document.getElementById(`view-${viewId}`);
    if (activeView) {
      activeView.classList.add('active');
    }

    // Update Header Title & Subtitle
    this.updateHeaderMeta(viewId);

    // Load Tab specific data
    this.refreshCurrentView();
  }

  updateHeaderMeta(viewId) {
    const titleEl = document.getElementById('view-title');
    const subEl = document.getElementById('view-subtitle');

    const meta = {
      overview: { title: 'Platform Overview', sub: 'Executive real-time monitoring of CallFar communications' },
      users: { title: 'Users & Accounts', sub: 'Directory, verification status, role elevation & suspension controls' },
      calls: { title: 'Voice & Video Calls', sub: 'Comprehensive call audit logs, signaling telemetry & connection metrics' },
      contacts: { title: 'Contacts & Friends', sub: 'Social graph connections, friend requests & blocked contacts' },
      messages: { title: 'Messages & Chat', sub: 'Encrypted message traffic volume & active conversation threads' },
      security: { title: 'Security & Sessions', sub: 'Active session tokens, password policies & threat countermeasures' },
      audit: { title: 'Audit Trail', sub: 'Cryptographically ordered log of all administrator actions' },
      privacy: { title: 'Privacy & Backups', sub: 'Database snapshot archives, data governance & disaster recovery' },
      broadcast: { title: 'System Announcements', sub: 'Push real-time critical announcements to all connected mobile devices' },
      analytics: { title: 'Analytics & Reports', sub: 'Performance indicators, call completion rates & exportable reports' },
      infrastructure: { title: 'Infrastructure & STUN', sub: 'Node.js memory telemetry, database latency & STUN/TURN clusters' },
      support: { title: 'Support & Tickets', sub: 'Customer assistance queue, troubleshooting & resolution management' },
      config: { title: 'App Configuration', sub: 'Live system parameters, maintenance mode & feature rollouts' },
      licenses: { title: 'License Keys & Subscriptions', sub: 'Batch key generator for Pro, Enterprise & Master Admin entitlements' },
      staff: { title: 'Admin Staff & Roles', sub: 'Superuser directory & role-based access control matrix' },
      telecom: { title: 'Cellular Telecom', sub: 'Rwanda GSM routing matrix (+250) & global PSTN gateways' },
      languages: { title: 'Languages & Locales', sub: 'Multi-language dictionary & interface accessibility' },
    };

    const cur = meta[viewId] || { title: 'CallFar Admin Hub', sub: 'Communication administration system' };
    if (titleEl) titleEl.textContent = cur.title;
    if (subEl) subEl.textContent = cur.sub;
  }

  /* ========================================================================
     Data Fetching & View Refresh
     ======================================================================== */
  async refreshAllData(showToastNotice = false) {
    try {
      await Promise.allSettled([
        this.loadOverview(),
        this.loadUsers(),
        this.loadCalls(),
        this.loadConfig(),
        this.loadAuditLogs(),
        this.loadLicenses(),
        this.loadSupportTickets(),
        this.loadBackups(),
        this.loadInfrastructure(),
        this.loadContacts(),
        this.loadMessages(),
      ]);

      if (showToastNotice) {
        this.showToast('Platform data synchronized successfully.', 'success');
      }
    } catch (err) {
      console.error('Data refresh error:', err);
      if (showToastNotice) {
        this.showToast('Partial data refresh notice: Some services offline.', 'warning');
      }
    }
  }

  async refreshCurrentViewSilently() {
    switch (this.currentView) {
      case 'overview':
        await this.loadOverview();
        break;
      case 'users':
        await this.loadUsers();
        break;
      case 'calls':
        await this.loadCalls();
        break;
      case 'audit':
        await this.loadAuditLogs();
        break;
      case 'infrastructure':
        await this.loadInfrastructure();
        break;
    }
  }

  async refreshCurrentView() {
    switch (this.currentView) {
      case 'overview':
        return this.loadOverview();
      case 'users':
        return this.loadUsers();
      case 'calls':
        return this.loadCalls();
      case 'contacts':
        return this.loadContacts();
      case 'messages':
        return this.loadMessages();
      case 'audit':
        return this.loadAuditLogs();
      case 'privacy':
        return this.loadBackups();
      case 'broadcast':
        return this.loadBroadcasts();
      case 'infrastructure':
        return this.loadInfrastructure();
      case 'support':
        return this.loadSupportTickets();
      case 'config':
        return this.loadConfig();
      case 'licenses':
        return this.loadLicenses();
      case 'staff':
        return this.loadStaff();
    }
  }

  /* ========================================================================
     1. OVERVIEW / DASHBOARD
     ======================================================================== */
  async loadOverview() {
    const res = await adminApi.getStats();
    if (res.success && res.data) {
      this.stats = res.data;
      const ov = res.data.overview || {};
      const ca = res.data.calling || {};
      const msg = res.data.messaging || {};
      const lic = res.data.licensing || {};
      const sys = res.data.systemHealth || {};

      document.getElementById('stat-total-users').textContent = ov.totalUsers ?? 0;
      document.getElementById('stat-active-users').textContent = `${ov.activeUsers ?? 0} active`;
      document.getElementById('stat-online-users').textContent = `${ov.onlineUsers ?? 0} online`;
      document.getElementById('badge-total-users').textContent = ov.totalUsers ?? 0;

      document.getElementById('stat-total-calls').textContent = ca.totalCalls ?? 0;
      document.getElementById('stat-active-calls').textContent = `${ca.activeCalls ?? 0} live now`;
      document.getElementById('stat-call-minutes').textContent = `${ca.totalDurationMinutes ?? 0} min total`;
      document.getElementById('badge-total-calls').textContent = ca.totalCalls ?? 0;

      document.getElementById('stat-total-messages').textContent = msg.totalMessages ?? 0;

      document.getElementById('stat-available-keys').textContent = lic.keysAvailable ?? 0;
      document.getElementById('stat-redeemed-keys').textContent = `${lic.keysRedeemed ?? 0} redeemed`;

      document.getElementById('overview-uptime').textContent = sys.uptimeFormatted || '3h 15m';
      document.getElementById('overview-memory').textContent = `${sys.memoryUsageMB?.rss || 64} MB`;

      // Render Bar Chart
      this.renderOverviewChart();
    }
  }

  renderOverviewChart() {
    const container = document.getElementById('overview-chart');
    if (!container) return;

    const days = [
      { label: 'Mon', calls: 38, users: 4 },
      { label: 'Tue', calls: 52, users: 8 },
      { label: 'Wed', calls: 45, users: 5 },
      { label: 'Thu', calls: 68, users: 12 },
      { label: 'Fri', calls: 92, users: 19 },
      { label: 'Sat', calls: 114, users: 24 },
      { label: 'Today', calls: 86, users: 16 },
    ];

    const maxVal = Math.max(...days.map((d) => d.calls));
    container.innerHTML = days
      .map((d) => {
        const heightPct = Math.round((d.calls / maxVal) * 85);
        return `
          <div class="chart-bar-col">
            <div class="chart-bar" style="height: ${heightPct}%;" title="${d.label}: ${d.calls} calls, +${d.users} users"></div>
            <span class="chart-label">${d.label}</span>
          </div>
        `;
      })
      .join('');
  }

  /* ========================================================================
     2. USERS & ACCOUNTS
     ======================================================================== */
  async loadUsers() {
    const search = document.getElementById('users-search')?.value || '';
    const role = document.getElementById('users-filter-role')?.value || '';
    const status = document.getElementById('users-filter-status')?.value;
    const tier = document.getElementById('users-filter-tier')?.value || '';

    const params = { limit: 50 };
    if (search) params.search = search;
    if (role) params.role = role;
    if (status) params.isActive = status === 'active';
    if (tier) params.tier = tier;

    const res = await adminApi.getUsers(params);
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    if (res.success && res.data?.users) {
      this.users = res.data.users;

      if (this.users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">No matching accounts found.</td></tr>`;
        return;
      }

      tbody.innerHTML = this.users
        .map((u) => {
          const tier = u.license?.tier || 'FREE';
          const tierClass =
            tier === 'MASTER_ADMIN'
              ? 'badge-tier-master'
              : tier === 'ENTERPRISE'
              ? 'badge-tier-enterprise'
              : tier === 'PRO'
              ? 'badge-tier-pro'
              : 'badge-member';

          const initial = (u.profile?.displayName || u.username || 'U')[0].toUpperCase();

          return `
            <tr>
              <td>
                <div class="user-cell">
                  <div class="user-avatar-circle">${initial}</div>
                  <div>
                    <div class="user-name-title">${this.escape(u.profile?.displayName || u.username)}</div>
                    <div class="user-handle-sub">@${this.escape(u.username)} • ${this.escape(u.email || u.phoneNumber || '')}</div>
                  </div>
                </div>
              </td>
              <td>
                <span class="badge ${u.role === 'ADMIN' ? 'badge-admin' : 'badge-member'}">
                  ${u.role === 'ADMIN' ? '🛡️ Admin' : '👤 Member'}
                </span>
              </td>
              <td>
                <span class="badge ${tierClass}">${tier}</span>
              </td>
              <td>
                <span class="badge ${u.isActive ? 'badge-active' : 'badge-suspended'}">
                  ${u.isActive ? '● Active' : '✕ Suspended'}
                </span>
              </td>
              <td style="font-size: 12.5px; color: var(--text-muted);">
                📞 ${u._count?.initiatedCalls || 0} calls • 💬 ${u._count?.messages || 0} msgs
              </td>
              <td style="font-size: 12.5px; color: var(--text-muted);">
                ${new Date(u.createdAt).toLocaleDateString()}
              </td>
              <td style="text-align: right; white-space: nowrap;">
                <button class="btn-icon" title="${u.isActive ? 'Suspend User' : 'Restore User'}" onclick="window.adminApp.toggleUserStatus('${u.id}', ${!u.isActive})">
                  ${u.isActive ? '🚫' : '✅'}
                </button>
                <button class="btn-icon" title="Toggle Role (Admin/Member)" onclick="window.adminApp.toggleUserRole('${u.id}', '${u.role === 'ADMIN' ? 'MEMBER' : 'ADMIN'}')">
                  👑
                </button>
                <button class="btn-icon" title="Manage License & Entitlements" onclick="window.adminApp.openManageLicenseModal('${u.id}', '${this.escape(u.username)}', '${u.license?.tier || 'FREE'}', ${u.license?.maxCallDurationMinutes ?? -1})">
                  💎
                </button>
                <button class="btn-icon" title="Reset Password" onclick="window.adminApp.openResetPasswordModal('${u.id}', '${this.escape(u.username)}')">
                  🔑
                </button>
                <button class="btn-icon" title="Terminate All Sessions" onclick="window.adminApp.revokeSessions('${u.id}')">
                  ⚡
                </button>
                <button class="btn-icon danger" title="Delete User Permanently" onclick="window.adminApp.deleteUser('${u.id}', '${this.escape(u.username)}')">
                  🗑️
                </button>
              </td>
            </tr>
          `;
        })
        .join('');
    }
  }

  async toggleUserStatus(userId, targetActive) {
    const actionName = targetActive ? 'Restore' : 'Suspend';
    if (!confirm(`Are you sure you want to ${actionName} this user account?`)) return;

    try {
      const res = await adminApi.updateUserStatus(userId, targetActive);
      if (res.success) {
        this.showToast(res.message || `Account successfully ${targetActive ? 'restored' : 'suspended'}.`, 'success');
        await this.loadUsers();
        await this.loadOverview();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async toggleUserRole(userId, newRole) {
    if (!confirm(`Change user authority to ${newRole}?`)) return;

    try {
      const res = await adminApi.updateUserRole(userId, newRole);
      if (res.success) {
        this.showToast(`User role successfully updated to ${newRole}.`, 'success');
        await this.loadUsers();
        await this.loadStaff();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async deleteUser(userId, username) {
    const promptVal = prompt(`WARNING: This will permanently delete @${username} and all records. Type "DELETE" to confirm:`);
    if (promptVal !== 'DELETE') return;

    try {
      const res = await adminApi.deleteUser(userId);
      if (res.success) {
        this.showToast(`User @${username} deleted permanently.`, 'success');
        await this.loadUsers();
        await this.loadOverview();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async revokeSessions(userId) {
    if (!confirm('Invalidate all active sessions and refresh tokens for this user?')) return;
    try {
      const res = await adminApi.revokeUserSessions(userId);
      if (res.success) {
        this.showToast(res.message || 'All user sessions terminated.', 'success');
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  openResetPasswordModal(userId, username) {
    document.getElementById('reset-pwd-userid').value = userId;
    document.getElementById('reset-pwd-username').textContent = `@${username}`;
    document.getElementById('reset-pwd-new').value = '';
    this.openModal('modal-reset-password');
  }

  async submitResetPassword() {
    const userId = document.getElementById('reset-pwd-userid').value;
    const newPwd = document.getElementById('reset-pwd-new').value.trim();

    if (!newPwd || newPwd.length < 6) {
      this.showToast('Password must be at least 6 characters.', 'warning');
      return;
    }

    try {
      const res = await adminApi.resetUserPassword(userId, newPwd);
      if (res.success) {
        this.showToast(res.message || 'Password reset successfully.', 'success');
        this.closeModal('modal-reset-password');
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async submitCreateUser() {
    const fullName = document.getElementById('create-user-fullname').value.trim();
    const username = document.getElementById('create-user-username').value.trim();
    const email = document.getElementById('create-user-email').value.trim();
    const password = document.getElementById('create-user-password').value;
    const phoneNumber = document.getElementById('create-user-phone').value.trim();
    const role = document.getElementById('create-user-role').value;
    const tier = document.getElementById('create-user-tier').value;

    if (!fullName || !username || !email || !password) {
      this.showToast('Please fill in Full Name, Username, Email, and Password.', 'warning');
      return;
    }

    try {
      const res = await adminApi.createUser({
        fullName,
        username,
        email,
        password,
        phoneNumber: phoneNumber || undefined,
        role,
        tier,
      });

      if (res.success) {
        this.showToast(res.message || `Account @${username} created!`, 'success');
        this.closeModal('modal-create-user');
        await this.loadUsers();
        await this.loadOverview();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  /* ========================================================================
     3. CALLS & AUDIT LOGS
     ======================================================================== */
  async loadCalls() {
    const search = document.getElementById('calls-search')?.value || '';
    const type = document.getElementById('calls-filter-type')?.value;
    const status = document.getElementById('calls-filter-status')?.value;

    const res = await adminApi.getCalls({ limit: 50 });
    const tbody = document.getElementById('calls-tbody');
    if (!tbody) return;

    if (res.success && res.data?.calls) {
      let calls = res.data.calls;

      // Filter locally
      if (search) {
        const q = search.toLowerCase();
        calls = calls.filter(
          (c) =>
            c.initiator?.username?.toLowerCase().includes(q) ||
            c.initiator?.profile?.displayName?.toLowerCase().includes(q) ||
            c.participants?.some((p) => p.user?.username?.toLowerCase().includes(q))
        );
      }
      if (type) calls = calls.filter((c) => c.callType === type);
      if (status) calls = calls.filter((c) => c.status === status);

      if (calls.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">No calls found matching filters.</td></tr>`;
        return;
      }

      tbody.innerHTML = calls
        .map((c) => {
          const initiatorName = c.initiator?.profile?.displayName || c.initiator?.username || 'Unknown';
          const participantNames = (c.participants || [])
            .map((p) => p.user?.profile?.displayName || p.user?.username || 'User')
            .join(', ');

          const isVideo = c.callType === 'VIDEO';
          const statusBadge =
            c.status === 'COMPLETED'
              ? 'badge-active'
              : c.status === 'MISSED'
              ? 'badge-suspended'
              : c.status === 'ONGOING'
              ? 'badge-admin'
              : 'badge-member';

          const durationFormatted =
            c.durationSeconds > 0
              ? `${Math.floor(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s`
              : c.status === 'ONGOING'
              ? 'Active now'
              : '0s';

          return `
            <tr>
              <td>
                <div style="font-weight: 600; color: #FFFFFF;">${this.escape(initiatorName)}</div>
                <div style="font-size: 11.5px; color: var(--text-muted);">@${this.escape(c.initiator?.username || '')}</div>
              </td>
              <td style="color: var(--text-secondary);">${this.escape(participantNames || '1 participant')}</td>
              <td>
                <span class="badge ${isVideo ? 'badge-tier-pro' : 'badge-member'}">
                  ${isVideo ? '📹 Video' : '📞 Voice'}
                </span>
              </td>
              <td>
                <span class="badge ${statusBadge}">${c.status}</span>
              </td>
              <td style="font-weight: 500; color: #FFFFFF;">${durationFormatted}</td>
              <td style="font-size: 12px; color: var(--text-muted);">${new Date(c.startedAt).toLocaleString()}</td>
            </tr>
          `;
        })
        .join('');
    }
  }

  /* ========================================================================
     4. CONTACTS & SOCIAL GRAPH
     ======================================================================== */
  async loadContacts() {
    const res = await adminApi.getContacts();
    if (res.success && res.data) {
      const m = res.data.metrics || {};
      document.getElementById('contacts-stat-total').textContent = m.totalContacts ?? 0;
      document.getElementById('contacts-stat-pending').textContent = m.pendingRequests ?? 0;
      document.getElementById('contacts-stat-blocked').textContent = m.blockedUsers ?? 0;

      const tbody = document.getElementById('contacts-tbody');
      if (!tbody) return;

      const list = res.data.recentContacts || [];
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">No registered contact connections yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = list
        .map(
          (c) => `
          <tr>
            <td>
              <div style="font-weight: 600; color: #FFFFFF;">${this.escape(c.user?.profile?.displayName || c.user?.username)}</div>
              <div style="font-size: 11.5px; color: var(--text-muted);">@${this.escape(c.user?.username)}</div>
            </td>
            <td>
              <div style="font-weight: 600; color: var(--accent-cyan);">${this.escape(c.contactUser?.profile?.displayName || c.contactUser?.username)}</div>
              <div style="font-size: 11.5px; color: var(--text-muted);">@${this.escape(c.contactUser?.username)}</div>
            </td>
            <td style="color: var(--text-secondary);">${this.escape(c.aliasName || '—')}</td>
            <td style="font-size: 12px; color: var(--text-muted);">${new Date(c.createdAt).toLocaleDateString()}</td>
          </tr>
        `
        )
        .join('');
    }
  }

  /* ========================================================================
     5. MESSAGES & CHAT
     ======================================================================== */
  async loadMessages() {
    const res = await adminApi.getMessages();
    if (res.success && res.data) {
      const m = res.data.metrics || {};
      document.getElementById('msg-stat-total').textContent = m.totalMessages ?? 0;
      document.getElementById('msg-stat-today').textContent = m.todayMessages ?? 0;
      document.getElementById('msg-stat-conversations').textContent = m.totalConversations ?? 0;

      const tbody = document.getElementById('messages-tbody');
      if (!tbody) return;

      const list = res.data.recentConversations || [];
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">No conversation threads active yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = list
        .map((conv) => {
          const members = (conv.members || [])
            .map((m) => m.user?.profile?.displayName || m.user?.username)
            .join(', ');
          return `
            <tr>
              <td><span class="badge ${conv.type === 'DIRECT' ? 'badge-member' : 'badge-tier-pro'}">${conv.type}</span></td>
              <td style="font-weight: 500; color: #FFFFFF;">${this.escape(members || 'Direct Chat')}</td>
              <td><span style="font-weight: 600; color: var(--accent-emerald);">${conv._count?.messages || 0} messages</span></td>
              <td style="font-size: 12px; color: var(--text-muted);">${new Date(conv.updatedAt).toLocaleString()}</td>
            </tr>
          `;
        })
        .join('');
    }
  }

  /* ========================================================================
     6. AUDIT LOGS
     ======================================================================== */
  async loadAuditLogs() {
    const search = document.getElementById('audit-search')?.value || '';
    const res = await adminApi.getAuditLogs({ limit: 50, search });

    const tbody = document.getElementById('audit-tbody');
    const ovTbody = document.getElementById('overview-audit-tbody');

    if (res.success && res.data) {
      this.auditLogs = res.data;

      const renderRows = (logs) => {
        if (logs.length === 0) {
          return `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">No audit events found.</td></tr>`;
        }
        return logs
          .map(
            (l) => `
            <tr>
              <td style="font-size: 12px; color: var(--text-muted);">${new Date(l.timestamp).toLocaleTimeString()}</td>
              <td style="font-weight: 600; color: var(--accent-cyan);">${this.escape(l.adminUsername)}</td>
              <td><span class="badge badge-admin">${this.escape(l.action)}</span></td>
              <td style="color: #FFFFFF;">${this.escape(l.target || '—')}</td>
              <td style="font-size: 12.5px; color: var(--text-secondary); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escape(l.details)}">
                ${this.escape(l.details)}
              </td>
              <td style="font-size: 11.5px; color: var(--text-muted);">${l.ip || '127.0.0.1'}</td>
              <td><span class="badge badge-active">${l.status}</span></td>
            </tr>
          `
          )
          .join('');
      };

      if (tbody) tbody.innerHTML = renderRows(this.auditLogs);
      if (ovTbody) ovTbody.innerHTML = renderRows(this.auditLogs.slice(0, 5));
    }
  }

  exportAuditCSV() {
    if (!this.auditLogs || this.auditLogs.length === 0) {
      this.showToast('No audit records to export.', 'warning');
      return;
    }
    const headers = ['Timestamp', 'Administrator', 'Action', 'Target', 'Details', 'IP', 'Status'];
    const rows = this.auditLogs.map((l) => [
      `"${l.timestamp}"`,
      `"${l.adminUsername}"`,
      `"${l.action}"`,
      `"${l.target || ''}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      `"${l.ip || ''}"`,
      `"${l.status}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `callfar_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('Audit log CSV exported.', 'success');
  }

  /* ========================================================================
     7. PRIVACY & BACKUPS
     ======================================================================== */
  async loadBackups() {
    const res = await adminApi.getBackups();
    const tbody = document.getElementById('backups-tbody');
    if (!tbody) return;

    if (res.success && res.data) {
      this.backups = res.data;
      if (this.backups.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">No backup snapshots recorded yet.</td></tr>`;
        return;
      }
      tbody.innerHTML = this.backups
        .map(
          (b) => `
          <tr>
            <td style="font-weight: 600; color: var(--accent-cyan);">${this.escape(b.filename)}</td>
            <td>${b.sizeMB} MB</td>
            <td style="font-size: 12px; color: var(--text-muted);">${new Date(b.createdAt).toLocaleString()}</td>
            <td><span class="badge badge-member">${this.escape(b.createdBy)}</span></td>
            <td>${b.type}</td>
            <td><span class="badge badge-active">${b.status}</span></td>
            <td>${b.tablesCount} tables</td>
          </tr>
        `
        )
        .join('');
    }
  }

  async triggerBackup() {
    try {
      this.showToast('Generating database snapshot backup...', 'info');
      const res = await adminApi.createBackup();
      if (res.success) {
        this.showToast('Database backup snapshot created successfully!', 'success');
        await this.loadBackups();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  /* ========================================================================
     8. BROADCASTS
     ======================================================================== */
  async loadBroadcasts() {
    const res = await adminApi.getBroadcasts();
    const tbody = document.getElementById('broadcasts-tbody');
    if (!tbody) return;

    if (res.success && res.data) {
      const list = res.data;
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">No announcements sent yet.</td></tr>`;
        return;
      }
      tbody.innerHTML = list
        .map(
          (bc) => `
          <tr>
            <td style="font-weight: 600; color: #FFFFFF;">${this.escape(bc.title)}</td>
            <td style="color: var(--text-secondary); max-width: 320px;">${this.escape(bc.message)}</td>
            <td>
              <span class="badge ${bc.priority === 'URGENT' ? 'badge-suspended' : bc.priority === 'HIGH' ? 'badge-admin' : 'badge-member'}">
                ${bc.priority}
              </span>
            </td>
            <td>@${this.escape(bc.sentBy)}</td>
            <td style="font-size: 12px; color: var(--text-muted);">${new Date(bc.timestamp).toLocaleTimeString()}</td>
            <td><span class="badge badge-active">${bc.recipientsCount} devices</span></td>
          </tr>
        `
        )
        .join('');
    }
  }

  async submitBroadcast() {
    const title = document.getElementById('broadcast-title').value.trim();
    const message = document.getElementById('broadcast-message').value.trim();
    const priority = document.getElementById('broadcast-priority').value;

    if (!title || !message) {
      this.showToast('Please enter both title and message.', 'warning');
      return;
    }

    try {
      const res = await adminApi.broadcastMessage({ title, message, priority });
      if (res.success) {
        this.showToast('Announcement broadcast to all connected devices!', 'success');
        this.closeModal('modal-broadcast');
        document.getElementById('broadcast-title').value = '';
        document.getElementById('broadcast-message').value = '';
        await this.loadBroadcasts();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  /* ========================================================================
     9. INFRASTRUCTURE & HEALTH
     ======================================================================== */
  async loadInfrastructure() {
    const res = await adminApi.getInfrastructure();
    if (res.success && res.data) {
      const s = res.data.server || {};
      const m = res.data.memory || {};
      const db = res.data.database || {};
      const sig = res.data.signaling || {};

      document.getElementById('infra-node').textContent = s.nodeVersion || 'v22.8.0';
      document.getElementById('infra-platform').textContent = s.platform || 'win32';
      document.getElementById('infra-rss').textContent = `${m.rssMB || 64} MB`;
      document.getElementById('infra-heap').textContent = `${m.heapUsedMB || 38} MB / ${m.heapTotalMB || 52} MB`;
      document.getElementById('infra-db-latency').textContent = `${db.pingLatencyMs || 2} ms`;
      document.getElementById('infra-sockets').textContent = `${sig.activeSocketConnections || 0} active`;

      document.getElementById('overview-db-ping').textContent = `${db.pingLatencyMs || 2} ms`;
    }
  }

  /* ========================================================================
     10. SUPPORT & TICKETS
     ======================================================================== */
  async loadSupportTickets() {
    const res = await adminApi.getSupportTickets();
    const tbody = document.getElementById('support-tbody');
    if (!tbody) return;

    if (res.success && res.data) {
      this.supportTickets = res.data;
      const openCount = this.supportTickets.filter((t) => t.status === 'OPEN').length;
      document.getElementById('badge-open-tickets').textContent = openCount;

      if (this.supportTickets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">No support tickets logged.</td></tr>`;
        return;
      }

      tbody.innerHTML = this.supportTickets
        .map(
          (t) => `
          <tr>
            <td style="font-family: monospace; color: var(--accent-cyan);">${t.id}</td>
            <td>
              <div style="font-weight: 600; color: #FFFFFF;">${this.escape(t.username)}</div>
              <div style="font-size: 11.5px; color: var(--text-muted);">${this.escape(t.email)}</div>
            </td>
            <td>
              <div style="font-weight: 500; color: #FFFFFF;">${this.escape(t.subject)}</div>
              <div style="font-size: 12px; color: var(--text-muted); max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escape(t.description)}</div>
            </td>
            <td><span class="badge badge-member">${t.category}</span></td>
            <td>
              <span class="badge ${t.priority === 'HIGH' ? 'badge-suspended' : t.priority === 'MEDIUM' ? 'badge-admin' : 'badge-member'}">
                ${t.priority}
              </span>
            </td>
            <td>
              <span class="badge ${t.status === 'RESOLVED' ? 'badge-active' : 'badge-suspended'}">
                ${t.status}
              </span>
            </td>
            <td style="font-size: 12px; color: var(--text-secondary); max-width: 200px;">
              ${t.resolution ? this.escape(t.resolution) : '<span style="color: var(--text-muted);">Unresolved</span>'}
            </td>
            <td style="text-align: right;">
              ${
                t.status !== 'RESOLVED'
                  ? `<button class="btn-primary" style="padding: 5px 12px; font-size: 12px;" onclick="window.adminApp.resolveTicketPrompt('${t.id}')">Resolve</button>`
                  : `<span style="color: var(--accent-emerald); font-size: 12px;">✓ Closed</span>`
              }
            </td>
          </tr>
        `
        )
        .join('');
    }
  }

  async resolveTicketPrompt(ticketId) {
    const resolution = prompt('Enter resolution notes for this ticket:');
    if (!resolution) return;

    try {
      const res = await adminApi.resolveSupportTicket(ticketId, resolution);
      if (res.success) {
        this.showToast('Support ticket marked as resolved.', 'success');
        await this.loadSupportTickets();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async submitCreateTicket() {
    const username = document.getElementById('ticket-username').value.trim();
    const email = document.getElementById('ticket-email').value.trim();
    const category = document.getElementById('ticket-category').value;
    const priority = document.getElementById('ticket-priority').value;
    const subject = document.getElementById('ticket-subject').value.trim();
    const description = document.getElementById('ticket-desc').value.trim();

    if (!username || !email || !subject || !description) {
      this.showToast('Please fill in all ticket fields.', 'warning');
      return;
    }

    try {
      const res = await adminApi.createSupportTicket({ username, email, category, priority, subject, description });
      if (res.success) {
        this.showToast('Support ticket created.', 'success');
        this.closeModal('modal-create-ticket');
        await this.loadSupportTickets();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  /* ========================================================================
     11. APP CONFIGURATION
     ======================================================================== */
  async loadConfig() {
    const res = await adminApi.getConfig();
    if (res.success && res.data) {
      this.config = res.data;
      document.getElementById('cfg-maintenance-mode').checked = !!this.config.maintenanceMode;
      document.getElementById('cfg-maintenance-msg').value = this.config.maintenanceMessage || '';
      document.getElementById('cfg-allow-registrations').checked = !!this.config.allowRegistrations;
      document.getElementById('cfg-call-limit').value = this.config.defaultCallLimitMinutes ?? 15;
      document.getElementById('cfg-min-version').value = this.config.minAppVersion || '1.0.0';

      const media = this.config.allowedMedia || {};
      document.getElementById('cfg-media-audio').checked = media.audio !== false;
      document.getElementById('cfg-media-video').checked = media.video !== false;
      document.getElementById('cfg-media-screen').checked = media.screenShare !== false;
    }
  }

  async saveConfig() {
    const maintenanceMode = document.getElementById('cfg-maintenance-mode').checked;
    const maintenanceMessage = document.getElementById('cfg-maintenance-msg').value.trim();
    const allowRegistrations = document.getElementById('cfg-allow-registrations').checked;
    const defaultCallLimitMinutes = Number(document.getElementById('cfg-call-limit').value);
    const minAppVersion = document.getElementById('cfg-min-version').value.trim();

    const allowedMedia = {
      audio: document.getElementById('cfg-media-audio').checked,
      video: document.getElementById('cfg-media-video').checked,
      screenShare: document.getElementById('cfg-media-screen').checked,
    };

    try {
      const res = await adminApi.updateConfig({
        maintenanceMode,
        maintenanceMessage,
        allowRegistrations,
        defaultCallLimitMinutes,
        minAppVersion,
        allowedMedia,
      });

      if (res.success) {
        this.showToast('Application configuration saved & active across platform.', 'success');
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  /* ========================================================================
     12. LICENSE KEYS & SUBSCRIPTIONS
     ======================================================================== */
  async loadLicenses() {
    const res = await adminApi.getLicenseKeys();
    const tbody = document.getElementById('licenses-tbody');
    if (!tbody) return;

    if (res.success && res.data) {
      this.licenseKeys = res.data;
      if (this.licenseKeys.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">No activation keys generated yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = this.licenseKeys
        .map((k) => {
          const tierClass =
            k.tier === 'MASTER_ADMIN'
              ? 'badge-tier-master'
              : k.tier === 'ENTERPRISE'
              ? 'badge-tier-enterprise'
              : 'badge-tier-pro';

          return `
            <tr>
              <td>
                <div style="font-family: monospace; font-size: 13.5px; font-weight: 700; color: #FFFFFF; display: flex; align-items: center; gap: 8px;">
                  <span>${k.key}</span>
                  <button class="btn-icon" title="Copy Key" style="width: 24px; height: 24px; font-size: 11px;" onclick="window.adminApp.copyText('${k.key}')">📋</button>
                </div>
                ${k.notes ? `<div style="font-size: 11.5px; color: var(--text-muted);">${this.escape(k.notes)}</div>` : ''}
              </td>
              <td><span class="badge ${tierClass}">${k.tier}</span></td>
              <td>${k.durationDays === -1 ? 'Lifetime' : `${k.durationDays} Days`}</td>
              <td>
                <span class="badge ${k.isRedeemed ? 'badge-suspended' : 'badge-active'}">
                  ${k.isRedeemed ? 'Redeemed' : 'Available'}
                </span>
              </td>
              <td style="color: var(--text-secondary);">@${this.escape(k.creator?.username || 'admin')}</td>
              <td>
                ${
                  k.redeemer
                    ? `<span style="font-weight: 600; color: var(--accent-cyan);">@${this.escape(k.redeemer.username)}</span>`
                    : '<span style="color: var(--text-muted);">—</span>'
                }
              </td>
              <td style="font-size: 12px; color: var(--text-muted);">${new Date(k.createdAt).toLocaleDateString()}</td>
              <td style="text-align: right;">
                <button class="btn-icon danger" title="Revoke Key" onclick="window.adminApp.revokeLicenseKey('${k.id}')">✕</button>
              </td>
            </tr>
          `;
        })
        .join('');
    }
  }

  async submitGenerateKeys() {
    const tier = document.getElementById('gen-key-tier').value;
    const durationDays = Number(document.getElementById('gen-key-duration').value);
    const count = Number(document.getElementById('gen-key-count').value) || 1;
    const customPrefix = document.getElementById('gen-key-prefix').value.trim() || undefined;
    const notes = document.getElementById('gen-key-notes').value.trim() || undefined;

    try {
      const res = await adminApi.generateLicenseKeys({
        tier,
        durationDays,
        count,
        customPrefix,
        notes,
      });

      if (res.success && res.data?.keys) {
        this.closeModal('modal-gen-license');
        const keysStr = res.data.keys.join('\n');
        this.copyText(keysStr);
        this.showToast(`Generated ${res.data.count} keys! Copied directly to clipboard.`, 'success');
        await this.loadLicenses();
        await this.loadOverview();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async revokeLicenseKey(keyId) {
    if (!confirm('Permanently remove this license activation key?')) return;
    try {
      const res = await adminApi.revokeLicenseKey(keyId);
      if (res.success) {
        this.showToast('License key revoked.', 'success');
        await this.loadLicenses();
        await this.loadOverview();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  /* ========================================================================
     13. STAFF & ROLES
     ======================================================================== */
  async loadStaff() {
    const res = await adminApi.getUsers({ role: 'ADMIN', limit: 50 });
    const tbody = document.getElementById('staff-tbody');
    if (!tbody) return;

    if (res.success && res.data?.users) {
      const staff = res.data.users;
      tbody.innerHTML = staff
        .map(
          (u) => `
          <tr>
            <td>
              <div class="user-cell">
                <div class="user-avatar-circle" style="background: var(--grad-amber); color: #070B14;">
                  ${(u.profile?.displayName || u.username)[0].toUpperCase()}
                </div>
                <div>
                  <div class="user-name-title">${this.escape(u.profile?.displayName || u.username)}</div>
                  <div class="user-handle-sub">@${this.escape(u.username)} • ${this.escape(u.email || '')}</div>
                </div>
              </div>
            </td>
            <td>
              <span class="badge badge-admin">Master Administrator</span>
            </td>
            <td>
              <span class="badge badge-tier-master">UNLIMITED ALL-ACCESS</span>
            </td>
            <td>
              <span class="badge ${u.isActive ? 'badge-active' : 'badge-suspended'}">
                ${u.isActive ? '● Active' : '✕ Suspended'}
              </span>
            </td>
            <td style="font-size: 12px; color: var(--text-muted);">${new Date(u.createdAt).toLocaleDateString()}</td>
          </tr>
        `
        )
        .join('');
    }
  }

  /* ========================================================================
     Utility & Modal Helpers
     ======================================================================== */
  bindSearchAndFilters() {
    const debounce = (fn, delay = 350) => {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delay);
      };
    };

    document.getElementById('users-search')?.addEventListener('input', debounce(() => this.loadUsers()));
    document.getElementById('users-filter-role')?.addEventListener('change', () => this.loadUsers());
    document.getElementById('users-filter-status')?.addEventListener('change', () => this.loadUsers());
    document.getElementById('users-filter-tier')?.addEventListener('change', () => this.loadUsers());

    document.getElementById('calls-search')?.addEventListener('input', debounce(() => this.loadCalls()));
    document.getElementById('calls-filter-type')?.addEventListener('change', () => this.loadCalls());
    document.getElementById('calls-filter-status')?.addEventListener('change', () => this.loadCalls());

    document.getElementById('audit-search')?.addEventListener('input', debounce(() => this.loadAuditLogs()));
  }

  bindModals() {
    // Backdrop click close
    document.querySelectorAll('.modal-overlay').forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${this.escape(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideInRight 0.3s ease reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  copyText(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      this.showToast('Copied to clipboard!', 'info');
    } else {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      this.showToast('Copied to clipboard!', 'info');
    }
  }

  exportPlatformSummary() {
    const payload = {
      exportedAt: new Date().toISOString(),
      stats: this.stats,
      config: this.config,
      usersCount: this.users.length,
      auditRecordsCount: this.auditLogs.length,
      licenseKeysCount: this.licenseKeys.length,
    };
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', `callfar_platform_report_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('Platform summary downloaded (JSON).', 'success');
  }

  /* ========================================================================
     Executive Authentication, Profile & Server Management
     ======================================================================== */
  onAuthChanged(user) {
    this.renderProfile();
    if (user) {
      this.refreshAllData();
    }
  }

  renderProfile() {
    const user = adminApi.user;
    const displayName = user?.profile?.displayName || user?.username || 'Executive Admin';
    const username = user?.username || 'admin';
    const role = user?.role === 'ADMIN' ? 'MASTER ADMINISTRATOR' : 'PLATFORM MEMBER';
    const initial = (displayName || username || 'A')[0].toUpperCase();

    const avatarEl = document.getElementById('sidebar-avatar');
    const nameEl = document.getElementById('sidebar-admin-name');
    const roleEl = document.getElementById('sidebar-admin-role');
    const headerDisplay = document.getElementById('header-admin-display');

    if (avatarEl) avatarEl.textContent = initial;
    if (nameEl) nameEl.textContent = displayName;
    if (roleEl) roleEl.textContent = role;
    if (headerDisplay) headerDisplay.textContent = username;
  }

  updateServerBadge() {
    const env = API_CONFIG.getTargetEnvironment();
    const isCloud = env === 'cloud';

    const iconEl = document.getElementById('header-server-icon');
    const labelEl = document.getElementById('header-server-label');
    const pillLocal = document.getElementById('pill-server-local');
    const pillCloud = document.getElementById('pill-server-cloud');

    if (iconEl) iconEl.textContent = isCloud ? '🌐' : '🟢';
    if (labelEl) labelEl.textContent = isCloud ? 'Render Cloud' : 'Local (5000)';

    if (pillLocal) {
      if (!isCloud) pillLocal.classList.add('active');
      else pillLocal.classList.remove('active');
    }
    if (pillCloud) {
      if (isCloud) pillCloud.classList.add('active');
      else pillCloud.classList.remove('active');
    }
  }

  cycleServerTarget() {
    const current = API_CONFIG.getTargetEnvironment();
    const target = current === 'local' ? 'cloud' : 'local';
    this.selectServerTarget(target);
  }

  async selectServerTarget(target) {
    API_CONFIG.setTargetEnvironment(target);
    this.updateServerBadge();
    const label = target === 'cloud' ? 'Render Cloud (callfar-backend.onrender.com)' : 'Localhost Backend (localhost:5000)';
    this.showToast(`Switched API Target to ${label}`, 'info');
    await this.refreshAllData(true);
  }

  fillAdminCredentials(identifier) {
    const input = document.getElementById('login-identifier');
    const pwdInput = document.getElementById('login-password');
    if (input) {
      input.value = identifier;
      if (pwdInput) pwdInput.focus();
    }
  }

  togglePasswordVisibility(inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (!input) return;
    const isPwd = input.type === 'password';
    input.type = isPwd ? 'text' : 'password';
    if (btn) btn.textContent = isPwd ? '🙈' : '👁️';
  }

  showLoginModal(optionalMsg) {
    const banner = document.getElementById('login-error-banner');
    const textEl = document.getElementById('login-error-text');
    if (optionalMsg && banner && textEl) {
      textEl.textContent = optionalMsg;
      banner.classList.add('active');
    } else if (banner) {
      banner.classList.remove('active');
    }
    this.updateServerBadge();
    this.openModal('modal-admin-login');
  }

  async submitAdminLogin() {
    const identifier = document.getElementById('login-identifier')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const passcode = document.getElementById('login-passcode')?.value.trim();
    const submitBtn = document.getElementById('btn-submit-login');
    const banner = document.getElementById('login-error-banner');
    const textEl = document.getElementById('login-error-text');

    if (!identifier || !password) {
      if (banner && textEl) {
        textEl.textContent = 'Please enter both your identifier and password.';
        banner.classList.add('active');
      }
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳</span> <span>Authenticating Security Credentials...</span>';
      }
      if (banner) banner.classList.remove('active');

      const res = await adminApi.login(identifier, password, passcode);

      if (res.success) {
        this.closeModal('modal-admin-login');
        const username = res.user?.username || identifier;
        this.showToast(`Authenticated successfully! Welcome to Executive Hub, @${username}.`, 'success');
        this.renderProfile();
        await this.refreshAllData(true);
      }
    } catch (err) {
      if (banner && textEl) {
        textEl.textContent = err.message || 'Authentication failed. Please verify credentials.';
        banner.classList.add('active');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>🔓</span> <span>Sign In &amp; Unlock Console</span>';
      }
    }
  }

  handleSignOut() {
    if (confirm('Sign out from the CallFar Executive Admin Console?')) {
      adminApi.clearSession();
      this.renderProfile();
      this.showToast('You have signed out from the administration console.', 'info');
      this.showLoginModal('Enter administrator credentials to sign back in.');
    }
  }

  /* ========================================================================
     User License Management Modal
     ======================================================================== */
  openManageLicenseModal(userId, username, currentTier, maxDuration) {
    document.getElementById('license-user-id').value = userId;
    document.getElementById('license-user-name').textContent = `@${username}`;
    document.getElementById('license-select-tier').value = currentTier || 'FREE';
    document.getElementById('license-call-limit').value = maxDuration ?? -1;
    this.openModal('modal-manage-license');
  }

  async submitManageLicense() {
    const userId = document.getElementById('license-user-id')?.value;
    const tier = document.getElementById('license-select-tier')?.value;
    const maxCallDurationMinutes = Number(document.getElementById('license-call-limit')?.value) || -1;
    const expirationDays = Number(document.getElementById('license-expiration-select')?.value);
    const canRecordCalls = document.getElementById('license-can-record')?.checked;
    const canScreenShare = document.getElementById('license-can-screenshare')?.checked;
    const priorityTurn = document.getElementById('license-priority-turn')?.checked;

    let expiresAt = null;
    if (expirationDays > 0) {
      const d = new Date();
      d.setDate(d.getDate() + expirationDays);
      expiresAt = d.toISOString();
    }

    try {
      const res = await adminApi.updateUserLicense(userId, {
        tier,
        maxCallDurationMinutes,
        expiresAt,
        canRecordCalls,
        canScreenShare,
        priorityTurn,
      });

      if (res.success) {
        this.showToast(res.message || 'User license & entitlements updated.', 'success');
        this.closeModal('modal-manage-license');
        await this.loadUsers();
        await this.loadOverview();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Instantiate and expose globally
window.adminApp = new CallFarAdminApp();
