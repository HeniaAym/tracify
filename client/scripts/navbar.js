// Tracify Floating Navbar Component
// Glassmorphism navbar with role-based visibility and mobile responsive design

const ROLE_NAMES = {
  admin:      'مسؤول',
  supervisor: 'مشرف',
  user:       'مستخدم'
};

const ROLE_BADGES = {
  admin:      'badge-info',
  supervisor: 'badge-success',
  user:       'badge-gray'
};

/**
 * Build the navbar HTML structure based on user role and active page
 * @returns {string} HTML string for the navbar
 */
function buildNavbar() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = user.role || 'user';
  const username = user.username || 'مستخدم';
  const station = user.stationName || 'المحطة';

  // Get current page from URL
  const path = window.location.pathname;
  const currentPage = path.split('/').pop() || 'index.html';

  // Navigation items with role-based visibility
  const navItems = [
    {
      group: 'الرئيسية',
      items: [
        {
          label: 'لوحة التحكم',
          icon: 'fas fa-tachometer-alt',
          href: '/',
          visible: true,
          active: currentPage === 'index.html'
        }
      ]
    },
    {
      group: 'الطرود',
      dropdown: true,
      items: [
        {
          label: 'بحث وتسليم',
          icon: 'fas fa-search',
          href: '/search',
          visible: true,
          active: currentPage === 'search.html'
        },
        {
          label: 'استيراد Excel',
          icon: 'fas fa-file-upload',
          href: '/import',
          visible: true,
          active: currentPage === 'import.html'
        },
        {
          label: 'تعديل الطرود',
          icon: 'fas fa-edit',
          href: '/edit',
          visible: role === 'supervisor' || role === 'admin',
          active: currentPage === 'edit.html'
        }
      ]
    },
    {
      group: 'المالية',
      dropdown: true,
      items: [
        {
          label: 'إقفال الصندوق',
          icon: 'fas fa-lock',
          href: '/closing',
          visible: role === 'supervisor' || role === 'admin',
          active: currentPage === 'closing.html'
        },
        {
          label: 'تسوية السائق',
          icon: 'fas fa-car',
          href: '/drivers',
          visible: role === 'supervisor' || role === 'admin',
          active: currentPage === 'drivers.html'
        },
        {
          label: 'كل التجميعات',
          icon: 'fas fa-list-alt',
          href: '/all-closings',
          visible: role === 'supervisor' || role === 'admin',
          active: currentPage === 'all-closings.html'
        },
        {
          label: 'المصاريف',
          icon: 'fas fa-wallet',
          href: '/expenses',
          visible: role === 'supervisor' || role === 'admin',
          active: currentPage === 'expenses.html'
        }
      ]
    },
    {
      group: 'المرتجعات',
      items: [
        {
          label: 'المرتجعات',
          icon: 'fas fa-undo-alt',
          href: '/returns',
          visible: role === 'supervisor' || role === 'admin',
          active: currentPage === 'returns.html'
        }
      ]
    }
  ];

  // Filter out hidden items and build HTML
  const filteredNav = navItems.filter(group =>
    group.items.some(item => item.visible)
  );

  // Build HTML structure
  let html = `
    <nav class="eco-nav">
      <div class="eco-nav-inner">
        <!-- Logo -->
        <a href="/" class="eco-nav-logo">
          <img
            src="/image/logo.png"
            alt="Tracify"
            style="height: 38px; width: auto; object-fit: contain;"
          />
        </a>

        <!-- Main Navigation -->
        <div class="eco-nav-main">
  `;

  // Build navigation items
  filteredNav.forEach((group, groupIndex) => {
    if (group.dropdown) {
      // Dropdown group
      html += `
        <div class="eco-nav-dropdown-container">
          <button class="eco-nav-item dropdown-toggle" data-group="${groupIndex}">
            <i class="${group.items[0].icon}"></i>
            <span>${group.group}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div class="eco-dropdown eco-dropdown-${groupIndex}" style="display:none;">
      `;

      group.items.forEach(item => {
        if (item.visible) {
          const activeClass = item.active ? 'active' : '';
          html += `
            <a href="${item.href}" class="eco-dropdown-item ${activeClass}" data-active="${item.active}">
              <i class="${item.icon}"></i>
              <span>${item.label}</span>
            </a>
          `;
        }
      });

      html += `
          </div>
        </div>
      `;
    } else {
      // Regular item
      group.items.forEach(item => {
        if (item.visible) {
          const activeClass = item.active ? 'active' : '';
          html += `
            <a href="${item.href}" class="eco-nav-item ${activeClass}" data-active="${item.active}">
              <i class="${item.icon}"></i>
              <span>${item.label}</span>
            </a>
          `;
        }
      });
    }
  });

  html += `
        </div>

        <!-- Settings Menu (supervisor/admin only) -->
  `;

  if (role === 'supervisor' || role === 'admin') {
    html += `
      <div class="eco-nav-user">
        <button class="eco-user-btn eco-settings-btn" onclick="openSettingsModal()">
          <i class="fas fa-cog"></i>
        </button>
      </div>
    `;
  }

  html += `
        <!-- User Menu (right side) -->
        <div class="eco-nav-user">
          <button class="eco-user-btn" onclick="toggleUserMenu()">
            <span class="user-name">${username}</span>
            <span class="badge ${ROLE_BADGES[role] || 'badge-gray'}">${ROLE_NAMES[role] || role}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div class="eco-user-dropdown" style="display:none;">
            <div class="user-station">${station}</div>
            <a href="#" class="user-logout" onclick="logout()">تسجيل الخروج</a>
          </div>
        </div>

        <!-- Mobile Menu Button -->
        <button class="eco-mobile-toggle" onclick="toggleMobileMenu()">
          <i class="fas fa-bars"></i>
        </button>
      </div>
    </nav>
  `;

  return html;
}

/**
 * Build mobile navigation HTML
 * @returns {string} Mobile navigation HTML
 */
function buildMobileNav() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = user.role || 'user';
  const path = window.location.pathname;
  const currentPage = path.split('/').pop() || 'index';

  const navItems = [
    {
      group: 'الرئيسية',
      items: [
        {
          label: 'لوحة التحكم',
          icon: 'fas fa-tachometer-alt',
          href: '/index',
          visible: true
        }
      ]
    },
    {
      group: 'الطرود',
      dropdown: true,
      items: [
        {
          label: 'بحث وتسليم',
          icon: 'fas fa-search',
          href: '/search',
          visible: true
        },
        {
          label: 'استيراد Excel',
          icon: 'fas fa-file-upload',
          href: '/import',
          visible: true
        },
        {
          label: 'تعديل الطرود',
          icon: 'fas fa-edit',
          href: '/edit',
          visible: role === 'supervisor' || role === 'admin'
        }
      ]
    },
    {
      group: 'المالية',
      dropdown: true,
      items: [
        {
          label: 'إقفال الصندوق',
          icon: 'fas fa-lock',
          href: '/closing',
          visible: role === 'supervisor' || role === 'admin'
        },
        {
          label: 'تسوية السائق',
          icon: 'fas fa-car',
          href: '/drivers',
          visible: role === 'supervisor' || role === 'admin'
        },
        {
          label: 'كل التجميعات',
          icon: 'fas fa-list-alt',
          href: '/all-closings',
          visible: role === 'supervisor' || role === 'admin'
        },
        {
          label: 'المصاريف',
          icon: 'fas fa-wallet',
          href: '/expenses',
          visible: role === 'supervisor' || role === 'admin'
        }
      ]
    },
    {
      group: 'المرتجعات',
      items: [
        {
          label: 'المرتجعات',
          icon: 'fas fa-undo-alt',
          href: '/returns',
          visible: role === 'supervisor' || role === 'admin'
        }
      ]
    }
  ];

  let html = '';

  navItems.forEach((group, groupIndex) => {
    if (group.dropdown) {
      html += `
        <div class="eco-mobile-dropdown-container">
          <button class="eco-mobile-dropdown-toggle" data-group="${groupIndex}">
            <i class="${group.items[0].icon}"></i>
            <span>${group.group}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div class="eco-mobile-dropdown eco-mobile-dropdown-${groupIndex}" style="display:none;">
      `;

      group.items.forEach(item => {
        if (item.visible) {
          const isActive = currentPage === item.href.split('/').pop();
          html += `
            <a href="${item.href}" class="eco-mobile-dropdown-item ${isActive ? 'active' : ''}">
              <i class="${item.icon}"></i>
              <span>${item.label}</span>
            </a>
          `;
        }
      });

      html += `
          </div>
        </div>
      `;
    } else {
      group.items.forEach(item => {
        if (item.visible) {
          const isActive = currentPage === item.href.split('/').pop();
          html += `
            <a href="${item.href}" class="eco-mobile-nav-item ${isActive ? 'active' : ''}">
              <i class="${item.icon}"></i>
              <span>${item.label}</span>
            </a>
          `;
        }
      });
    }
  });

  return html;
}

/**
 * Initialize the navbar with event listeners and active state
 */
function initNavbar() {
  // Insert navbar HTML
  const navbarMount = document.getElementById('navbar-mount');
  if (navbarMount) {
    navbarMount.innerHTML = buildNavbar();
  }

  // Add event listeners for dropdowns
  setupDropdownListeners();

  // Add event listeners for mobile menu
  setupMobileMenu();

  // Add click outside handler
  setupClickOutside();

  // Initialize active state
  updateActiveState();
}

/**
 * Setup dropdown toggle functionality
 */
function setupDropdownListeners() {
  // Main dropdown toggles
  document.querySelectorAll('.dropdown-toggle').forEach(btn => {
    btn.addEventListener('click', function() {
      const groupIndex = this.dataset.group;
      const dropdown = document.querySelector(`.eco-dropdown-${groupIndex}`);

      // Close all other dropdowns
      document.querySelectorAll('.eco-dropdown').forEach(drop => {
        if (drop !== dropdown) {
          drop.style.display = 'none';
        }
      });

      // Toggle current dropdown
      if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        dropdown.style.display = 'block';
        dropdown.style.animation = 'navDropIn 0.2s ease both';
      } else {
        dropdown.style.display = 'none';
      }
    });
  });

  // Dropdown items
  document.querySelectorAll('.eco-dropdown-item').forEach(item => {
    item.addEventListener('click', function() {
      // Remove active class from all dropdown items
      document.querySelectorAll('.eco-dropdown-item').forEach(i => {
        i.classList.remove('active');
      });

      // Add active class to clicked item
      this.classList.add('active');

      // Close dropdown
      const dropdown = this.closest('.eco-dropdown');
      if (dropdown) {
        dropdown.style.display = 'none';
      }
    });
  });
}

/**
 * Setup mobile menu functionality
 */
function setupMobileMenu() {
  // Mobile toggle button
  const mobileToggle = document.querySelector('.eco-mobile-toggle');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', toggleMobileMenu);
  }
}

/**
 * Toggle mobile menu overlay
 */
function toggleMobileMenu() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = user.role || 'user';
  const username = user.username || 'مستخدم';

  const body = document.body;
  const overlay = document.createElement('div');
  overlay.className = 'eco-mobile-overlay';

  if (!body.querySelector('.eco-mobile-overlay')) {
    overlay.innerHTML = `
      <div class="eco-mobile-menu">
        <div class="eco-mobile-header">
          <a href="/" class="eco-mobile-logo">
            <img
              src="/image/logo.png"
              alt="Tracify"
              style="height: 38px; width: auto; object-fit: contain;"
            />
          </a>
          <button class="eco-mobile-close" onclick="closeMobileMenu()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="eco-mobile-nav">
          ${buildMobileNav()}
        </div>
        <div class="eco-mobile-user">
          <div class="user-info">
            <span class="user-name">${username}</span>
            <span class="badge ${ROLE_BADGES[role] || 'badge-gray'}">${ROLE_NAMES[role] || role}</span>
          </div>
          <a href="#" class="user-logout" onclick="logout()">تسجيل الخروج</a>
        </div>
      </div>
    `;

    body.appendChild(overlay);

    // Setup mobile dropdown toggles
    overlay.querySelectorAll('.eco-mobile-dropdown-toggle').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const container = this.closest('.eco-mobile-dropdown-container');
        const dropdown = container.querySelector('.eco-mobile-dropdown');

        // Close other dropdowns
        overlay.querySelectorAll('.eco-mobile-dropdown-container').forEach(c => {
          if (c !== container) {
            c.classList.remove('open');
            const dd = c.querySelector('.eco-mobile-dropdown');
            if (dd) dd.classList.remove('open');
          }
        });

        // Toggle this dropdown
        container.classList.toggle('open');
        dropdown.classList.toggle('open');
      });
    });

    setTimeout(() => {
      overlay.classList.add('active');
    }, 10);
  }
}

/**
 * Close mobile menu
 */
function closeMobileMenu() {
  const overlay = document.querySelector('.eco-mobile-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 300);
  }
}

/**
 * Setup click outside handler to close dropdowns
 */
function setupClickOutside() {
  document.addEventListener('click', function(event) {
    const target = event.target;

    // Close main dropdowns when clicking outside
    if (!target.closest('.eco-nav-dropdown-container') &&
        !target.closest('.eco-user-btn') &&
        !target.closest('.eco-mobile-toggle')) {
      document.querySelectorAll('.eco-dropdown').forEach(dropdown => {
        dropdown.style.display = 'none';
      });

      // Close user dropdown
      const userDropdown = document.querySelector('.eco-user-dropdown');
      if (userDropdown) {
        userDropdown.style.display = 'none';
      }
    }

    // Close mobile overlay when clicking outside
    if (document.querySelector('.eco-mobile-overlay') &&
        !target.closest('.eco-mobile-menu')) {
      closeMobileMenu();
    }
  });
}

/**
 * Update active state for navigation items
 */
function updateActiveState() {
  const path = window.location.pathname;
  const currentPage = path.split('/').pop() || 'index.html';

  // Remove all active classes
  document.querySelectorAll('.eco-nav-item, .eco-dropdown-item').forEach(item => {
    item.classList.remove('active');
  });

  // Add active class to current page
  const activeItem = document.querySelector(`[href*="${currentPage}"]`);
  if (activeItem) {
    activeItem.classList.add('active');
  }
}

/**
 * Toggle user menu
 */
function toggleUserMenu() {
  const userDropdown = document.querySelector('.eco-user-dropdown');
  if (userDropdown) {
    const isVisible = userDropdown.style.display === 'block';

    // Close all other dropdowns
    document.querySelectorAll('.eco-dropdown').forEach(dropdown => {
      dropdown.style.display = 'none';
    });

    // Toggle user dropdown
    userDropdown.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
      userDropdown.style.animation = 'navDropIn 0.2s ease both';
    }
  }
}

// ===================================================
// Settings Modal (supervisor/admin only)
// ===================================================

function injectSettingsModal() {
  if (!document.getElementById('nav-settings-mount') && document.body) {
    const mount = document.createElement('div');
    mount.id = 'nav-settings-mount';
    mount.innerHTML = `
      <div id="settings-modal" class="modal-overlay" style="display:none;">
        <div class="modal-box" style="max-width:420px;">
          <div class="modal-head">
            <div class="modal-head-title">
              <i class="fas fa-plus-circle" style="margin-left:.5rem;"></i> إضافة صندوق مال جديد
            </div>
            <button class="modal-close-btn" onclick="closeSettingsModal()">×</button>
          </div>
          <div style="padding:1.5rem;">
            <p style="color:var(--text-secondary);margin-bottom:1rem;">
              سيتم إنشاء الصندوق باسم تلقائي من النظام (مثال: mb-krt482)
              ومرتبط بمحطتك فقط.
            </p>
            <div id="settings-actions">
              <button onclick="createNewBox()" class="btn btn-primary btn-full" id="create-box-btn">
                <i class="fas fa-plus"></i> إنشاء الصندوق
              </button>
            </div>
            <div id="create-box-result" style="margin-top:1rem;"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(mount);
  }
}

function openSettingsModal() {
  injectSettingsModal();
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.padding = '1.5rem';
  }
  const result = document.getElementById('create-box-result');
  if (result) result.innerHTML = '';
  const btn = document.getElementById('create-box-btn');
  if (btn) btn.disabled = false;
}

function closeSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function createNewBox() {
  const btn = document.getElementById('create-box-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';
  }

  try {
    const result = await fetchAPI('/moneybox/create', { method: 'POST' });
    document.getElementById('create-box-result').innerHTML =
      `<div class="alert alert-success">
        تم إنشاء الصندوق: <strong>${result.box.boxCode || result.box.name}</strong>
      </div>`;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-plus"></i> إنشاء الصندوق';
    }
  } catch(e) {
    document.getElementById('create-box-result').innerHTML =
      `<div class="alert alert-danger">${e.message || 'حدث خطأ أثناء إنشاء الصندوق'}</div>`;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-plus"></i> إنشاء الصندوق';
    }
  }
}

// Initialize navbar when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initNavbar();
  injectSettingsModal();

  // Update active state on page load
  updateActiveState();

  // Add resize listener for mobile menu
  window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
      closeMobileMenu();
    }
  });
});

// Export functions for global access
window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;
window.toggleUserMenu = toggleUserMenu;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.createNewBox = createNewBox;
// logout is provided by api.js
