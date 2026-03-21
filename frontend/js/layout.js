// layout.js — Shared sidebar + navbar injected into every protected page.
// FIX: No hardcoded "Arjun Sharma / AS" — all user info pulled live from localStorage.

window.renderLayout = function(pageTitle, activeHref) {
  // Read real user from localStorage before injecting HTML
  let user = null;
  try { user = JSON.parse(localStorage.getItem('padhlo_user') || 'null'); } catch(e) {}
  const username = user ? user.username : 'User';
  const initials = username.substring(0, 2).toUpperCase();

  const sidebarHTML = `
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon">📚</div>
        <div class="logo-text">
          <div>PadhloAI</div>
          <div class="logo-sub">AI Education Platform</div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">Main</div>
        <a href="dashboard.html" class="nav-item"><span class="nav-icon">🏠</span> Dashboard</a>
        <a href="chat.html" class="nav-item"><span class="nav-icon">🤖</span> AI Tutor Chat<span class="nav-badge">AI</span></a>

        <div class="nav-section">Learning</div>
        <a href="upload.html" class="nav-item"><span class="nav-icon">📤</span> Upload Book</a>
        <a href="notes.html" class="nav-item"><span class="nav-icon">📝</span> Notes Generator</a>
        <a href="test.html" class="nav-item"><span class="nav-icon">📋</span> Test Generator</a>
        <a href="pdfs.html" class="nav-item"><span class="nav-icon">📄</span> My PDFs</a>

        <div class="nav-section">Insights</div>
        <a href="analytics.html" class="nav-item"><span class="nav-icon">📊</span> Analytics</a>

        <div class="nav-section">Account</div>
        <a href="#" class="nav-item" id="settings-link"><span class="nav-icon">⚙️</span> Settings</a>
        <a href="#" class="nav-item" id="logout-link"><span class="nav-icon">🚪</span> Logout</a>
      </nav>

      <div class="sidebar-footer">
        <div class="user-card">
          <div class="avatar ring-indicator" id="sidebar-avatar">${initials}</div>
          <div class="user-info">
            <div class="user-name" id="sidebar-username">${username}</div>
            <div class="user-role">Student</div>
          </div>
          <span style="color:var(--text-light);font-size:0.8rem">⋮</span>
        </div>
      </div>
    </aside>

    <nav class="navbar">
      <button class="mobile-menu-btn" id="menu-btn">☰</button>
      <h2 class="navbar-title">${pageTitle}</h2>
      <div class="navbar-actions">
        <button class="icon-btn" id="notif-btn" data-tooltip="Notifications">🔔</button>
        <button class="icon-btn theme-btn" data-tooltip="Toggle theme">
          <span class="theme-icon">🌙</span>
        </button>
        <div class="avatar" id="navbar-avatar"
          style="cursor:pointer;width:36px;height:36px;font-size:0.8rem"
          onclick="window.location.href='dashboard.html'">${initials}</div>
      </div>
    </nav>
  `;

  document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

  // Active nav link
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('href') === activeHref) item.classList.add('active');
  });

  // Wire up nav actions safely (showToast from app.js may not be loaded yet)
  document.getElementById('settings-link').addEventListener('click', e => {
    e.preventDefault();
    if (window.showToast) showToast('Settings coming soon', 'info');
  });
  document.getElementById('logout-link').addEventListener('click', e => {
    e.preventDefault();
    if (window.Auth) Auth.clearSession();
    if (window.showToast) {
      showToast('Logging out...', 'info');
      setTimeout(() => { window.location.href = 'login.html'; }, 600);
    } else {
      window.location.href = 'login.html';
    }
  });
  document.getElementById('notif-btn').addEventListener('click', () => {
    if (window.showToast) showToast('No new notifications', 'info');
  });
};
