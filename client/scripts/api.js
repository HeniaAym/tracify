const API_BASE = '/api';

// ===== إدارة المستخدم والتوكن =====
function getToken()  { return localStorage.getItem('token'); }
function getUser()   { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } }

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  // ⚠️ لا نحذف connected_box — يبقى في localStorage للمستخدم العائد
  window.location.href = '/login';
}

function requireAuth() {
  if (!getToken() || !getUser()) {
    window.location.href = '/login';
    return null;
  }
  return getUser();
}

// ===== الصندوق — يُخزن في localStorage كـ cache فقط =====
const BOX_KEY = 'connected_box';

function getConnectedBox()     { try { return JSON.parse(localStorage.getItem(BOX_KEY)); } catch { return null; } }
function setConnectedBox(box)  { localStorage.setItem(BOX_KEY, JSON.stringify(box)); }
function clearConnectedBox()   { localStorage.removeItem(BOX_KEY); }
function getBoxId()            { const b = getConnectedBox(); return b ? b._id : null; }

// ===== جلب الصندوق المتصل للمستخدم الحالي من DB =====
async function getMyConnectedBox() {
  try {
    const user = getUser();
    if (!user) return null;
    const boxes = await fetchAPI('/moneybox/connected');
    if (!boxes || !boxes.length) return null;
    const myBox = boxes.find(b => b.connectedByName === user.username);
    if (myBox) {
      setConnectedBox(myBox);
      return myBox;
    }
    return null;
  } catch { return null; }
}

// ===== دالة الطلب الأساسية =====
async function fetchAPI(endpoint, options = {}) {
  const loader = document.getElementById('global-loader');
  if (loader) loader.style.display = 'inline-block';

  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData))
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return;
    }

    if (!res.ok) {
      let msg = 'حدث خطأ';
      try { const e = await res.json(); msg = e.error || msg; } catch {}
      throw new Error(msg);
    }
    return res.json();
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

// ===== صناديق المال =====
async function getBoxes()         { return fetchAPI('/moneybox'); }
async function connectBox(boxId)  { return fetchAPI('/moneybox/connect', { method:'POST', body: JSON.stringify({ boxId }) }); }

// ===== الطرود =====
async function getParcels(query)  { return fetchAPI(`/parcels/search?q=${encodeURIComponent(query)}`); }

async function payParcel(id) {
  let boxId = getBoxId();
  if (!boxId) {
    const myBox = await getMyConnectedBox();
    if (myBox) boxId = myBox._id;
  }
  if (!boxId) throw new Error('يجب الاتصال بصندوق المال أولاً');
  return fetchAPI(`/parcels/${id}/pay`, {
    method: 'POST',
    body: JSON.stringify({ boxId })
  });
}

// ===== الصندوق =====
async function getBalance() {
  let boxId = getBoxId();
  if (!boxId) {
    const myBox = await getMyConnectedBox();
    if (myBox) boxId = myBox._id;
  }
  if (!boxId) return { balance: 0 };
  return fetchAPI(`/cash/balance?boxId=${boxId}`);
}

async function getMovements() {
  let boxId = getBoxId();
  if (!boxId) { const b = await getMyConnectedBox(); if (b) boxId = b._id; }
  if (!boxId) return [];
  return fetchAPI(`/cash/movements?boxId=${boxId}`);
}

async function getTodayStats() {
  let boxId = getBoxId();
  if (!boxId) { const b = await getMyConnectedBox(); if (b) boxId = b._id; }
  if (!boxId) return { totalCollected:0, paidCount:0, pendingCount:0, recentParcels:[] };
  return fetchAPI(`/cash/today-stats?boxId=${boxId}`);
}

// ===== المصاريف =====
async function addExpense(data) {
  return fetchAPI('/expenses', { method:'POST', body: JSON.stringify(data) });
}

// ===== التجميع =====
async function closeCash(data) {
  if (!data.boxId) throw new Error('يجب اختيار الصندوق أولاً');
  return fetchAPI('/closings', { method:'POST', body: JSON.stringify(data) });
}

// ===== رفع Excel =====
async function uploadExcel(file) {
  const fd = new FormData();
  fd.append('file', file);
  return fetchAPI('/upload', { method:'POST', body: fd });
}

// ===== تسليم جماعي من Excel =====
async function bulkDeliver(file) {
  let boxId = getBoxId();
  if (!boxId) {
    const myBox = await getMyConnectedBox();
    if (myBox) boxId = myBox._id;
  }
  if (!boxId) throw new Error('يجب الاتصال بصندوق المال أولاً');

  const fd = new FormData();
  fd.append('file', file);
  fd.append('boxId', boxId);
  return fetchAPI('/parcels/bulk-deliver', { method:'POST', body: fd });
}

// ===== Navbar/Sidebar =====
function updateSidebarUser() {
  const user = getUser();
  if (!user) return;
  const roleColors = { admin:'badge-info', supervisor:'badge-success', user:'badge-gray' };
  const roleNames  = { admin:'مسؤول', supervisor:'مشرف', user:'مستخدم' };
  const el = document.getElementById('sidebar-footer-user');
  if (el) {
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:.5rem;">
        <div style="font-size:.8rem;font-weight:700;color:var(--text-dark);display:flex;align-items:center;gap:.4rem;">
          <i class="fas fa-building" style="color:var(--primary);"></i> ${user.stationName || ''}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:.8rem;color:var(--text-secondary);font-weight:600;">
            <i class="fas fa-user"></i> ${user.username}
            <span class="badge ${roleColors[user.role]||'badge-gray'}" style="margin-right:.4rem;font-size:.7rem;">${roleNames[user.role]||user.role}</span>
          </div>
          <button onclick="logout()" title="تسجيل الخروج"
            style="background:none;border:1px solid var(--border);border-radius:6px;padding:.25rem .5rem;cursor:pointer;color:var(--danger);font-size:.8rem;"
            onmouseover="this.style.background='var(--danger)';this.style.color='white';"
            onmouseout="this.style.background='none';this.style.color='var(--danger)';">
            <i class="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>`;
  }
  if (user.role === 'user') {
    ['link-import','link-expenses','link-closing','link-returns','link-edit'].forEach(id => {
      const e = document.getElementById(id);
      if (e) e.style.display = 'none';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth();
  if (!user) return;
  updateSidebarUser();
});