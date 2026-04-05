const searchInput = document.getElementById('searchInput');
const searchBtn   = document.getElementById('searchBtn');
const searchCards = document.getElementById('searchCards');

// ===== حالة الصندوق =====
function updateBoxUI() {
  const box       = getConnectedBox();
  const bar       = document.getElementById('boxBar');
  const dot       = document.getElementById('boxDot');
  const name      = document.getElementById('boxName');
  const label     = document.getElementById('boxLabel');
  const btn       = document.getElementById('boxBtn');
  const balance   = document.getElementById('boxBalance');
  const blocked   = document.getElementById('blockedNotice');
  const main      = document.getElementById('mainContent');

  if (box) {
    bar.className   = 'box-bar connected';
    dot.className   = 'box-status-dot on';
    name.textContent  = box.name;
    label.textContent = `متصل منذ ${new Date(box.openedAt || Date.now()).toLocaleTimeString('ar-DZ')}`;
    btn.className   = 'box-connect-btn disconnect';
    btn.innerHTML   = '<i class="fas fa-power-off"></i> قطع الاتصال';
    btn.onclick     = disconnectBox;
    balance.style.display = 'block';
    blocked.style.display = 'none';
    main.classList.remove('search-blocked');
    loadTodayStats();
    showBulkDeliverSection();
  } else {
    bar.className   = 'box-bar disconnected';
    dot.className   = 'box-status-dot off';
    name.textContent  = 'غير متصل';
    label.textContent = 'يجب الاتصال بصندوق المال لتأكيد الدفع';
    btn.className   = 'box-connect-btn connect';
    btn.innerHTML   = '<i class="fas fa-plug"></i> اتصال بالصندوق';
    btn.onclick     = openBoxModal;
    balance.style.display = 'none';
    balance.textContent   = '';
    blocked.style.display = 'block';
    const section = document.getElementById('bulk-deliver-section');
    if (section) section.style.display = 'none';
    main.classList.add('search-blocked');
    document.getElementById('total-collected').textContent = '0';
    document.getElementById('paid-count').textContent      = '0';
    document.getElementById('pending-count').textContent   = '0';
    document.getElementById('recent-list').innerHTML =
      '<li style="justify-content:center;color:var(--gray);font-size:.83rem;">اتصل بالصندوق أولاً</li>';
  }
}

// ===== فتح modal الصناديق =====
async function openBoxModal() {
  document.getElementById('boxModal').classList.add('active');
  const list = document.getElementById('boxList');
  list.innerHTML = '<div style="text-align:center;color:var(--gray);padding:1rem;"><i class="fas fa-spinner fa-spin"></i></div>';

  try {
    const boxes = await getBoxes();
    list.innerHTML = boxes.map(b => `
      <div class="box-option" onclick="selectBox('${b._id}', '${b.name}')">
        <div class="box-option-icon"><i class="fas fa-cash-register"></i></div>
        <div>
          <div class="box-option-name">${b.name}</div>
          <div class="box-option-label">${b.isOpen ? '🟢 مفتوح' : '⚪ مغلق'}</div>
        </div>
      </div>`).join('');
  } catch (e) {
    list.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-circle"></i> ${e.message}</div>`;
  }
}

function closeBoxModal() {
  document.getElementById('boxModal').classList.remove('active');
}

async function selectBox(boxId, boxName) {
  try {
    const result = await connectBox(boxId);
    setConnectedBox(result.box);
    closeBoxModal();
    updateBoxUI();
    showToast(`تم الاتصال بـ ${boxName}`, 'success');
  } catch (e) {
    showToast('خطأ في الاتصال: ' + e.message, 'error');
  }
}

async function disconnectBox() {
  if (!confirm('هل تريد قطع الاتصال بالصندوق؟')) return;
  const box = getConnectedBox();
  if (!box) return;

  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role === 'user') {
      showToast('لا يمكنك قطع الاتصال بالصندوق — أخبر مشرفك أو المسؤول', 'error');
      const disconnectBtn = document.getElementById('boxBtn');
      if (disconnectBtn) disconnectBtn.style.display = 'none';
      return;
    }

    const result = await fetchAPI(`/moneybox/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boxId: box._id })
    });

    if (result.error) {
      showToast(result.error, 'error');
      if (result.showSupervisor) {
        const btn = document.getElementById('boxBtn');
        if (btn) btn.style.display = 'none';
      }
      return;
    }

    clearConnectedBox();
    updateBoxUI();
    showToast('تم قطع الاتصال', 'info');
  } catch (e) {
    showToast('خطأ: ' + e.message, 'error');
  }
}

document.getElementById('boxModal').addEventListener('click', function(e) {
  if (e.target === this) closeBoxModal();
});

// ===== قائمة كل الطرود المسلمة (تتراكم طوال الجلسة) =====
let allPaidToday = [];

function addToList(parcel) {
  if (allPaidToday.find(p => p.tracking === parcel.tracking)) return;
  allPaidToday.unshift(parcel);
  renderRecentList();
}

function renderRecentList() {
  const recentList = document.getElementById('recent-list');
  if (!allPaidToday.length) {
    recentList.innerHTML = '<li style="justify-content:center;color:var(--gray);">لا توجد مدفوعات اليوم</li>';
    return;
  }
  recentList.innerHTML = allPaidToday.map(p => `
    <li>
      <span class="tracking">${p.tracking || 'غير معروف'}</span>
      <span class="price">${p.price || 0} DA</span>
    </li>`).join('');
}

// ===== إحصائيات اليوم =====
async function loadTodayStats() {
  try {
    const stats = await getTodayStats();
    document.getElementById('total-collected').textContent = stats.totalCollected || 0;
    document.getElementById('paid-count').textContent      = stats.paidCount      || 0;
    document.getElementById('pending-count').textContent   = stats.pendingCount   || 0;

    // إذا القائمة فارغة نملأها من الخادم، وإلا نحافظ على ما عندنا
    if (allPaidToday.length === 0 && stats.recentParcels && stats.recentParcels.length) {
      allPaidToday = [...stats.recentParcels];
    }
    renderRecentList();

    const balanceEl = document.getElementById('boxBalance');
    balanceEl.textContent = `${Number(stats.totalCollected || 0).toLocaleString('ar-DZ')} DA`;
  } catch (err) {
    console.error('خطأ في تحميل الإحصائيات:', err);
  }
}

// ===== بناء بطاقة بحث =====
function addSearchCard(query, parcels) {
  const emptyState = document.getElementById('emptyState');
  if (emptyState) emptyState.style.display = 'none';

  if (searchCards.children.length >= 5)
    searchCards.removeChild(searchCards.firstChild);

  const cardId = 'card-' + Date.now();
  const card   = document.createElement('div');
  card.className = 'search-card';
  card.id = cardId;

  let rows = '';
  parcels.forEach(p => {
    let statusText, statusClass, actionCell;
    if (p.status === 'paid') {
      statusText = 'مُسلَّم'; statusClass = 'paid'; actionCell = '';
    } else if (p.status === 'returned') {
      statusText = 'مرتجع'; statusClass = 'returned'; actionCell = '';
    } else {
      statusText = 'معلق'; statusClass = 'pending';
      actionCell = `<button class="pay-btn" data-id="${p._id}" data-tracking="${p.tracking}" data-price="${p.price}" data-customer="${p.customer}">
                     <i class="fas fa-check"></i> دفع
                   </button>`;
    }
    rows += `<tr>
      <td style="font-family:monospace;font-weight:700;color:var(--primary);font-size:.82rem;">${p.tracking}</td>
      <td>${p.customer}</td><td>${p.phone}</td>
      <td>${p.price} DA</td>
      <td><span class="badge badge-${statusClass}">${statusText}</span></td>
      <td>${actionCell}</td>
    </tr>`;
  });

  card.innerHTML = `
    <div class="search-card-header">
      <h4>
        <i class="fas fa-tag"></i>
        <span class="query-badge">${query}</span>
        <span class="count-badge">${parcels.length} نتيجة</span>
      </h4>
      <button class="close-card"><i class="fas fa-times"></i></button>
    </div>
    <div class="table-container">
      <table>
        <thead><tr>
          <th>رقم التتبع</th><th>العميل</th><th>الهاتف</th>
          <th>المبلغ</th><th>الحالة</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  searchCards.appendChild(card);
  card.querySelector('.close-card').addEventListener('click', () => card.remove());

  card.querySelectorAll('.pay-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const box = getConnectedBox();
      if (!box) { showToast('يجب الاتصال بالصندوق أولاً', 'error'); return; }

      const parcelId = e.currentTarget.dataset.id;
      e.currentTarget.disabled = true;
      e.currentTarget.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

      try {
        await payParcel(parcelId);
        // إضافة للقائمة
        addToList({
          tracking: e.currentTarget.dataset.tracking,
          price:    e.currentTarget.dataset.price,
          customer: e.currentTarget.dataset.customer
        });
        await loadTodayStats();
        const row = e.currentTarget.closest('tr');
        row.cells[4].innerHTML = '<span class="badge badge-paid">مُسلَّم</span>';
        e.currentTarget.remove();
        if (!card.querySelectorAll('.pay-btn').length) {
          setTimeout(() => { if (card.parentNode) card.remove(); }, 1500);
        }
        showToast('تم الدفع بنجاح', 'success');
      } catch (err) {
        e.currentTarget.disabled = false;
        e.currentTarget.innerHTML = '<i class="fas fa-check"></i> دفع';
        showToast('خطأ: ' + err.message, 'error');
      }
    });
  });
}

// ===== البحث =====
async function performSearch() {
  if (!getConnectedBox()) { showToast('اتصل بالصندوق أولاً', 'error'); return; }
  const query = searchInput.value.trim();
  if (!query) { showToast('الرجاء إدخال كلمة بحث', 'info'); return; }

  searchBtn.disabled = true;
  searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';

  try {
    const parcels = await getParcels(query);
    if (!parcels.length) { showToast('لا توجد نتائج', 'info'); }
    else { addSearchCard(query, parcels); searchInput.value = ''; }
  } catch (err) {
    showToast('خطأ: ' + err.message, 'error');
  } finally {
    searchBtn.disabled = false;
    searchBtn.innerHTML = '<i class="fas fa-search"></i> بحث';
  }
}

// ===== Toast =====
function showToast(message, type = 'info') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast'; toast.className = `toast ${type}`; toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') performSearch(); });
updateBoxUI();

// =================================================================
// وضع مسح الباركود — إضافة جديدة
// =================================================================
let scanMode   = false;
let scanBuffer = '';
let scanTimer  = null;

function toggleScanMode() {
  if (!getConnectedBox()) { showToast('يجب الاتصال بالصندوق أولاً', 'error'); return; }
  scanMode = !scanMode;
  const btn   = document.getElementById('scanModeBtn');
  const badge = document.getElementById('scanBadge');
  if (scanMode) {
    btn.className = 'scan-btn active';
    btn.innerHTML = '<i class="fas fa-barcode"></i> إيقاف المسح <span class="scan-blink"></span>';
    badge.style.display = 'flex';
    showToast('وضع المسح مفعّل', 'info');
  } else {
    btn.className = 'scan-btn';
    btn.innerHTML = '<i class="fas fa-barcode"></i> وضع المسح';
    badge.style.display = 'none';
    scanBuffer = '';
    clearTimeout(scanTimer);
    showToast('وضع المسح معطّل', 'info');
  }
}

// قارئ USB يرسل أحرفاً بسرعة ثم Enter
document.addEventListener('keydown', (e) => {
  if (!scanMode) return;
  if (document.activeElement === searchInput) return;

  if (e.key === 'Enter') {
    e.preventDefault();
    if (scanBuffer.trim().length > 3) processScan(scanBuffer.trim());
    scanBuffer = '';
    clearTimeout(scanTimer);
    return;
  }
  if (e.key.length === 1) {
    scanBuffer += e.key;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      if (scanBuffer.trim().length > 3) processScan(scanBuffer.trim());
      scanBuffer = '';
    }, 300);
  }
});

async function processScan(tracking) {
  showScanModal('loading', tracking);
  try {
    const parcels = await getParcels(tracking);
    if (!parcels.length) { playBeep(false); showScanModal('error', tracking, null, 'لم يتم العثور على هذا الطرد'); return; }

    const parcel = parcels.find(p => p.tracking === tracking) || parcels[0];

    if (parcel.status === 'paid')     { playBeep(false); showScanModal('error', tracking, parcel, 'هذا الطرد مسلَّم مسبقاً'); return; }
    if (parcel.status === 'returned') { playBeep(false); showScanModal('error', tracking, parcel, 'هذا الطرد مرتجع'); return; }

    await payParcel(parcel._id);
    addToList({ tracking: parcel.tracking, price: parcel.price, customer: parcel.customer });
    await loadTodayStats();
    playBeep(true);
    showScanModal('success', tracking, parcel);
  } catch (err) {
    playBeep(false);
    showScanModal('error', tracking, null, err.message);
  }
}

// النافذة المنبثقة
let scanAutoClose = null;

function showScanModal(type, tracking, parcel, errorMsg) {
  const modal   = document.getElementById('scanModal');
  const content = document.getElementById('scanModalContent');
  clearTimeout(scanAutoClose);

  if (type === 'loading') {
    content.innerHTML = `
      <div class="scan-modal-icon" style="background:#dbeafe;color:#2563eb;">
        <i class="fas fa-spinner fa-spin"></i>
      </div>
      <div class="scan-modal-tracking">${tracking}</div>
      <div style="color:#94a3b8;font-size:.9rem;">جاري البحث...</div>`;
    modal.style.display = 'flex';
    return;
  }

  if (type === 'success') {
    content.innerHTML = `
      <div class="scan-modal-icon success">
        <i class="fas fa-check-circle"></i>
      </div>
      <div class="scan-modal-tracking">${parcel.tracking}</div>
      <div class="scan-modal-customer">${parcel.customer}</div>
      <div class="scan-modal-phone"><i class="fas fa-phone"></i> ${parcel.phone}</div>
      <div class="scan-modal-price">${Number(parcel.price).toLocaleString('ar-DZ')} DA</div>
      <div class="scan-modal-label success">✅ تم التسليم بنجاح</div>`;
    modal.style.display = 'flex';
    scanAutoClose = setTimeout(() => { modal.style.display = 'none'; }, 3000);
    return;
  }

  if (type === 'error') {
    content.innerHTML = `
      <div class="scan-modal-icon error">
        <i class="fas fa-times-circle"></i>
      </div>
      ${parcel ? `<div class="scan-modal-tracking">${parcel.tracking}</div><div class="scan-modal-customer">${parcel.customer}</div>` : `<div class="scan-modal-tracking" style="color:#94a3b8;">${tracking}</div>`}
      <div class="scan-modal-label error">${errorMsg}</div>`;
    modal.style.display = 'flex';
    scanAutoClose = setTimeout(() => { modal.style.display = 'none'; }, 2500);
  }
}

document.getElementById('scanModal').addEventListener('click', function() {
  clearTimeout(scanAutoClose);
  this.style.display = 'none';
});

// أصوات
function showBulkDeliverSection() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = user.role || 'user';
  if (role !== 'supervisor' && role !== 'admin') return;

  const section = document.getElementById('bulk-deliver-section');
  if (section) section.style.display = 'block';

  const drop  = document.getElementById('bulkFileDrop');
  const input = document.getElementById('bulkFileInput');
  if (drop && input) {
    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      if (input.files.length) {
        document.getElementById('bulkFileLabel').textContent = input.files[0].name;
      }
    });
  }
  if (drop) {
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.borderColor = 'var(--primary)'; });
    drop.addEventListener('dragleave', () => { drop.style.borderColor = ''; });
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.style.borderColor = '';
      if (e.dataTransfer.files.length) {
        input.files = e.dataTransfer.files;
        document.getElementById('bulkFileLabel').textContent = e.dataTransfer.files[0].name;
      }
    });
  }
}

async function bulkDeliverUpload() {
  const input = document.getElementById('bulkFileInput');
  if (!input.files.length) { showToast('اختر ملف Excel أولاً', 'info'); return; }

  const btn = document.getElementById('bulkUploadBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الرفع...';
  document.getElementById('bulk-result').innerHTML = '';

  try {
    const result = await bulkDeliver(input.files[0]);
    const s = result.summary;
    let html = `
      <div class="alert alert-info">
        <strong>الملخص — ${s.total} سطر</strong><br>
        ✅ تم التسليم: ${s.delivered} | ⚪ مسلَّم مسبقاً: ${s.alreadyPaid} |
        🔄 تحويل من مرتجع: ${s.changedFromReturned} | ➕ أُضيف وسُلِّم: ${s.addedAndDelivered}
      </div>
    `;

    if (result.details && result.details.length) {
      const badgeMap = {
        delivered: 'badge-success',
        already_paid: 'badge-gray',
        changed_from_returned: 'badge-warning',
        added_and_delivered: 'badge-info',
        duplicate_file: 'badge-gray'
      };
      const labelMap = {
        delivered: 'تم التسليم',
        already_paid: 'مسلَّم مسبقاً',
        changed_from_returned: 'تحويل من مرتجع',
        added_and_delivered: 'أُضيف وسُلِّم',
        duplicate_file: 'مكرر في الملف'
      };

      html += `<div class="table-container"><table>
        <thead><tr><th>رقم التتبع</th><th>العميل</th><th>المبلغ</th><th>الحالة</th></tr></thead>
        <tbody>`;

      result.details.forEach(d => {
        html += `<tr>
          <td style="font-family:monospace;font-weight:700;color:var(--primary);font-size:.82rem;">${d.tracking}</td>
          <td>${d.customer || '—'}</td>
          <td>${d.price ? d.price + ' DA' : '—'}</td>
          <td><span class="badge ${badgeMap[d.status] || 'badge-gray'}">${labelMap[d.status] || d.status}</span></td>
        </tr>`;
      });

      html += '</tbody></table></div>';
    }

    if (result.errors && result.errors.length) {
      html += `<div class="alert alert-danger"><strong>أخطاء:</strong><ul style="margin:.5rem 0 0;padding-right:1.2rem;">` +
        result.errors.map(e => `<li>${e.tracking || ''} — ${e.message}</li>`).join('') +
        '</ul></div>';
    }

    document.getElementById('bulk-result').innerHTML = html;
    await loadTodayStats();
    showToast('تم التسليم الجماعي — ' + s.delivered + ' جديد', 'success');
  } catch (e) {
    document.getElementById('bulk-result').innerHTML =
      '<div class="alert alert-danger">خطأ: ' + e.message + '</div>';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> رفع وتنفيذ';
  }
}

function playBeep(ok) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = ok ? 880 : 220;
    osc.type = ok ? 'sine' : 'sawtooth';
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (ok ? 0.35 : 0.25));
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
  } catch(e) {}
}