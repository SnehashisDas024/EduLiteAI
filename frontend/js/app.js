// app.js — Theme, toasts, animations, mobile menu

// ===== THEME =====
const themeToggle = () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  document.querySelectorAll('.theme-icon').forEach(el => { el.textContent = next === 'dark' ? '☀️' : '🌙'; });
  document.querySelectorAll('.theme-label').forEach(el => { el.textContent = next === 'dark' ? 'Light Mode' : 'Dark Mode'; });
};

const initTheme = () => {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  document.querySelectorAll('.theme-icon').forEach(el => { el.textContent = saved === 'dark' ? '☀️' : '🌙'; });
  document.querySelectorAll('.theme-label').forEach(el => { el.textContent = saved === 'dark' ? 'Light Mode' : 'Dark Mode'; });
};

// ===== TOAST =====
const showToast = (msg, type = 'info', duration = 3500) => {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-msg">${msg}</span>
    <span class="toast-close" onclick="removeToast(this.parentElement)">✕</span>
  `;
  container.appendChild(toast);
  setTimeout(() => removeToast(toast), duration);
};

const removeToast = (toast) => {
  if (!toast || !toast.parentElement) return;
  toast.classList.add('removing');
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 300);
};

// ===== MOBILE MENU =====
// FIX: Look up overlay fresh inside open/close so it works after dynamic layout injection
const initMobileMenu = () => {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  const openMenu = () => {
    sidebar.classList.add('open');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  };
  const closeMenu = () => {
    sidebar.classList.remove('open');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.classList.remove('show');
    document.body.style.overflow = '';
  };

  document.querySelector('.mobile-menu-btn')?.addEventListener('click', openMenu);
  document.addEventListener('click', e => {
    if (e.target?.classList?.contains('sidebar-overlay')) closeMenu();
  });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => { if (window.innerWidth <= 768) closeMenu(); });
  });
};

// ===== ACTIVE NAV =====
const setActiveNav = () => {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('href');
    if (href && (href === current || href.endsWith(current))) item.classList.add('active');
  });
};

// ===== SKELETON LOADER =====
const showSkeletons = (container, count = 3) => {
  container.innerHTML = Array(count).fill('').map(() => `
    <div class="card" style="height:100px">
      <div class="skeleton" style="height:16px;width:60%;margin-bottom:12px"></div>
      <div class="skeleton" style="height:12px;width:40%"></div>
    </div>
  `).join('');
};

// ===== ANIMATIONS =====
const animateCards = () => {
  // Skip dynamic containers so runtime-rendered cards never get stuck at opacity:0
  const dynamic = ['#notes-library-grid','#history-list','#review-modal-body','#modal-body',
    '#list-view','#notes-view','#tests-view','#questions-container',
    '#recent-tests-list','#review-backdrop','#history-backdrop','#note-modal-backdrop'];
  document.querySelectorAll('.card, .glass').forEach((card, i) => {
    if (dynamic.some(sel => card.closest(sel))) return;
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    setTimeout(() => {
      card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, i * 60);
  });
};

const animateProgress = () => {
  document.querySelectorAll('.progress-fill[data-width]').forEach(bar => {
    setTimeout(() => { bar.style.width = bar.dataset.width; }, 300);
  });
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileMenu();
  setActiveNav();
  animateCards();
  animateProgress();
  document.querySelectorAll('.theme-btn').forEach(btn => btn.addEventListener('click', themeToggle));
});

window.showToast  = showToast;
window.removeToast = removeToast;
window.themeToggle = themeToggle;
window.showSkeletons = showSkeletons;
