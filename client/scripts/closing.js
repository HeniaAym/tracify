// ===================================================
// تحميل الرصيد النظري من الصندوق المختار
// ===================================================
async function loadExpectedBalance() {
  const boxId = document.getElementById('connectedBoxSelect').value;
  if (!boxId) {
    document.getElementById('expected').textContent = '0';
    return;
  }
  try {
    const data = await fetchAPI(`/cash/balance?boxId=${boxId}`);
    document.getElementById('expected').textContent =
      Number(data.balance).toLocaleString('ar-DZ');
  } catch (err) {
    console.error('خطأ في تحميل الرصيد:', err);
  }
}

// ===================================================
// تحميل سجل التجميعات
// ===================================================
async function loadClosings() {
  try {
    const closings = await fetchAPI('/closings');
    const tbody    = document.getElementById('closings-list');

    if (!closings || !closings.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">
              <div class="empty-state-icon" style="background:#ede9fe;color:#7c3aed;">
                <i class="fas fa-archive"></i>
              </div>
              <h3>لا توجد تجميعات سابقة</h3>
              <p>ستظهر التجميعات هنا بعد تسجيل أول عملية</p>
            </div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = closings.map(c => {
      const diff      = c.difference;
      const diffClass = diff > 0 ? 'amount-positive' : diff < 0 ? 'amount-negative' : '';
      const diffSign  = diff > 0 ? '+' : '';

      return `
        <tr>
          <td>
            <span style="
              font-family: 'Courier New', monospace;
              font-weight: 800;
              font-size: 0.85rem;
              background: #ede9fe;
              color: #7c3aed;
              padding: 0.2rem 0.6rem;
              border-radius: 6px;
            ">${c.receiptNumber || '—'}</span>
          </td>
          <td style="font-size:0.82rem; color:var(--gray);">
            ${new Date(c.closedAt).toLocaleString('ar-DZ')}
          </td>
          <td><strong>${Number(c.expectedAmount).toLocaleString('ar-DZ')} DA</strong></td>
          <td><strong>${Number(c.actualAmount).toLocaleString('ar-DZ')} DA</strong></td>
          <td class="${diffClass}">${diffSign}${Number(diff).toLocaleString('ar-DZ')} DA</td>
          <td>${c.operatorName || c.closedBy || '—'}</td>
          <td>${c.supervisorName || c.closedBy || '—'}</td>
          <td style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;">
            <button
              class="btn-view-parcels"
              onclick="openParcelsModal('${c._id}', '${c.receiptNumber}')"
              title="عرض الطرود"
            >
              <i class="fas fa-box"></i> عرض الطرود
            </button>
            <button
              class="btn-view-parcels"
              onclick="exportParcelsPDF('${c._id}', '${c.receiptNumber}')"
              title="تصدير PDF"
              style="background:#fef3c7;color:#b45309;"
            >
              <i class="fas fa-file-pdf"></i> PDF
            </button>
          </td>
        </tr>`;
    }).join('');

  } catch (err) {
    console.error('خطأ في تحميل التجميعات:', err);
  }
}

// ===================================================
// النافذة المنبثقة - عرض الطرود
// ===================================================
async function openParcelsModal(closingId, receiptNumber) {
  const modal        = document.getElementById('parcelsModal');
  const modalTitle   = document.getElementById('modalTitle');
  const modalBody    = document.getElementById('modalBody');
  const modalSummary = document.getElementById('modalSummary');

  modal.classList.add('active');
  modalTitle.textContent = `طرود التجميعة ${receiptNumber}`;
  modalBody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align:center; padding:2rem; color:var(--gray);">
        <i class="fas fa-spinner fa-spin" style="font-size:1.5rem;"></i>
        <div style="margin-top:0.5rem;">جاري التحميل...</div>
      </td>
    </tr>`;
  modalSummary.innerHTML = '';

  try {
    const closing = await fetchAPI(`/closings/${closingId}`);
    const parcels = closing.parcels || [];

    if (!parcels.length) {
      modalBody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-state">
              <div class="empty-state-icon" style="background:#fef3c7;color:#f59e0b;">
                <i class="fas fa-box-open"></i>
              </div>
              <h3>لا توجد طرود مرتبطة</h3>
              <p>هذه التجميعة لا تحتوي على طرود مسجلة</p>
            </div>
          </td>
        </tr>`;
      return;
    }

    modalBody.innerHTML = parcels.map((p, i) => `
      <tr>
        <td style="text-align:center; color:var(--gray); font-size:0.8rem;">${i + 1}</td>
        <td class="tracking-code">${p.tracking}</td>
        <td>${p.customer}</td>
        <td>${p.phone}</td>
        <td style="font-weight:700; color:var(--success);">${Number(p.price).toLocaleString('ar-DZ')} DA</td>
      </tr>
    `).join('');

    const diff      = closing.difference;
    const diffColor = diff === 0 ? 'var(--success)' : diff > 0 ? 'var(--primary)' : 'var(--danger)';

    modalSummary.innerHTML = `
      <div style="display:flex; gap:1rem; flex-wrap:wrap; padding:0.75rem 1.25rem; background:var(--light); border-top:1px solid var(--border); font-size:0.83rem;">
        <span><strong>عدد الطرود:</strong> ${parcels.length}</span>
        <span><strong>المجموع النظري:</strong> ${Number(closing.expectedAmount).toLocaleString('ar-DZ')} DA</span>
        <span><strong>المبلغ الفعلي:</strong> ${Number(closing.actualAmount).toLocaleString('ar-DZ')} DA</span>
        <span style="color:${diffColor};"><strong>الفرق:</strong> ${diff >= 0 ? '+' : ''}${Number(diff).toLocaleString('ar-DZ')} DA</span>
        <span><strong>المسؤول:</strong> ${closing.closedBy || '—'}</span>
      </div>`;

  } catch (err) {
    modalBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; color:var(--danger); padding:2rem;">
          <i class="fas fa-exclamation-circle"></i> خطأ في تحميل البيانات
        </td>
      </tr>`;
  }
}

function closeParcelsModal() {
  document.getElementById('parcelsModal').classList.remove('active');
}

document.getElementById('parcelsModal').addEventListener('click', function(e) {
  if (e.target === this) closeParcelsModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeParcelsModal();
});

// ===================================================
// تصدير طرود التجميعة كـ PDF
// ===================================================
async function exportParcelsPDF(closingId, receiptNumber) {
  let closing;
  try {
    closing = await fetchAPI(`/closings/${closingId}`);
  } catch (err) {
    alert('خطأ في تحميل بيانات التجميعة');
    return;
  }

  const parcels = closing.parcels || [];
  const user    = JSON.parse(localStorage.getItem('user') || '{}');

  // تحميل اللوغو كـ base64
  let logoBase64 = '';
  try {
    const resp = await fetch('/image/logo.png');
    const blob = await resp.blob();
    logoBase64 = await new Promise(res => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Logo not found, skipping.');
  }

  const logoTag = logoBase64
    ? `<img src="${logoBase64}" alt="Logo" style="height:56px;object-fit:contain;">`
    : `<span style="font-size:1.3rem;font-weight:900;color:#7c3aed;">Tracify</span>`;

  const now     = new Date();
  const dateStr = now.toLocaleDateString('ar-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });

  const diff      = closing.difference || 0;
  const diffSign  = diff >= 0 ? '+' : '';
  const diffColor = diff === 0 ? '#16a34a' : diff > 0 ? '#7c3aed' : '#dc2626';
  const diffBg    = diff === 0 ? '#f0fdf4' : diff > 0 ? '#ede9fe' : '#fef2f2';
  const statusLabel = diff === 0 ? 'متطابق' : diff > 0 ? 'زيادة' : 'نقص';

  const totalAmount = parcels.reduce((a, p) => a + (p.price || 0), 0);

  let rowsHtml = '';
  if (parcels.length) {
    rowsHtml = parcels.map((p, i) => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#faf8ff'};">
        <td style="text-align:center;color:#94a3b8;font-size:.78rem;font-weight:600;">${i + 1}</td>
        <td style="font-family:monospace;font-weight:800;font-size:.82rem;color:#1e1b4b;">${p.tracking}</td>
        <td style="font-size:.83rem;">${p.customer}</td>
        <td style="font-size:.82rem;color:#64748b;direction:ltr;text-align:right;">${p.phone}</td>
        <td style="font-weight:800;color:#7c3aed;font-size:.88rem;">${Number(p.price).toLocaleString('ar-DZ')} DA</td>
      </tr>`).join('');
  } else {
    rowsHtml = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:#94a3b8;">لا توجد طرود مرتبطة بهذه التجميعة</td></tr>`;
  }

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>طرود التجميعة ${receiptNumber}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
          font-family: 'Cairo', Arial, sans-serif;
          direction: rtl;
          background: #f5f3ff;
          color: #1e1b4b;
          padding: 28px;
        }

        /* Header */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%);
          border-radius: 16px;
          padding: 20px 26px;
          margin-bottom: 16px;
          color: white;
          box-shadow: 0 8px 32px rgba(124,58,237,.25);
        }
        .header-left { display:flex; align-items:center; gap:18px; }
        .header-logo {
          background: white;
          border-radius: 12px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 80px;
          min-height: 72px;
          box-shadow: 0 4px 12px rgba(0,0,0,.15);
        }
        .header-divider { width:1px; height:50px; background:rgba(255,255,255,.3); margin:0 4px; }
        .header-title h1 { font-size:1.35rem; font-weight:900; margin-bottom:3px; letter-spacing:-.5px; }
        .header-title p { font-size:.76rem; opacity:.8; font-weight:400; }
        .header-right { text-align:left; font-size:.8rem; line-height:1.85; opacity:.92; }
        .header-right strong { font-weight:800; }

        /* Receipt badge */
        .receipt-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: white;
          color: #7c3aed;
          border-radius: 10px;
          padding: 10px 18px;
          font-weight: 900;
          font-size: 1rem;
          margin-bottom: 16px;
          box-shadow: 0 2px 10px rgba(124,58,237,.12);
          font-family: 'Courier New', monospace;
        }

        /* Stats */
        .stats-bar { display:flex; gap:12px; margin-bottom:16px; }
        .stat-card {
          flex:1; background:white; border-radius:12px; padding:14px 18px;
          border-right:4px solid #7c3aed;
          box-shadow: 0 2px 10px rgba(124,58,237,.07);
          position:relative; overflow:hidden;
        }
        .stat-card.blue { border-right-color:#2563eb; }
        .stat-card.dynamic { border-right-color:${diffColor}; }
        .stat-label { font-size:.7rem; color:#94a3b8; margin-bottom:5px; font-weight:600; text-transform:uppercase; letter-spacing:.5px; }
        .stat-value { font-size:1.2rem; font-weight:900; color:#1e1b4b; }

        /* Table */
        .section-title {
          display:flex; align-items:center; gap:8px;
          font-size:.76rem; font-weight:800; color:#7c3aed;
          text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;
        }
        .section-title::before {
          content:''; display:inline-block; width:4px; height:16px;
          background:linear-gradient(180deg,#7c3aed,#2563eb); border-radius:2px;
        }
        .table-wrapper {
          background:white; border-radius:14px; overflow:hidden;
          box-shadow:0 4px 20px rgba(124,58,237,.09); margin-bottom:20px;
        }
        table { width:100%; border-collapse:collapse; }
        thead tr { background:linear-gradient(90deg,#7c3aed 0%,#4f46e5 50%,#2563eb 100%); }
        thead th { color:white; padding:11px 12px; font-size:.78rem; font-weight:700; text-align:right; white-space:nowrap; }
        tbody td { padding:9px 12px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
        tbody tr:last-child td { border-bottom:none; }

        /* Summary footer */
        .summary-box {
          display:flex; justify-content:space-between; align-items:center;
          background:white; border-radius:14px; padding:16px 22px;
          box-shadow:0 4px 20px rgba(124,58,237,.09);
          margin-bottom:16px;
        }
        .summary-item { text-align:center; }
        .summary-item .s-label { font-size:.7rem; color:#94a3b8; font-weight:600; margin-bottom:4px; }
        .summary-item .s-value { font-size:1rem; font-weight:900; color:#1e1b4b; }
        .summary-divider { width:1px; height:40px; background:#f1f5f9; }
        .diff-pill {
          background:${diffBg}; color:${diffColor};
          padding:6px 16px; border-radius:20px; font-weight:800; font-size:.9rem;
        }

        /* Footer */
        .footer { display:flex; justify-content:space-between; align-items:center; }
        .footer-note { font-size:.7rem; color:#94a3b8; line-height:1.7; text-align:left; }
        .footer-note .brand { font-weight:800; color:#7c3aed; font-size:.76rem; }
        .watermark {
          position:fixed; bottom:40px; left:50%; transform:translateX(-50%) rotate(-30deg);
          font-size:5rem; font-weight:900; color:rgba(124,58,237,.04);
          pointer-events:none; white-space:nowrap; letter-spacing:8px; z-index:0;
        }

        @media print {
          body { background:white; padding:15px; }
          .stat-card, .table-wrapper, .summary-box { box-shadow:none; }
          .header { box-shadow:none; }
        }
      </style>
    </head>
    <body>

      <div class="watermark">TRACIFY</div>

      <!-- Header -->
      <div class="header">
        <div class="header-left">
          <div class="header-logo">${logoTag}</div>
          <div class="header-divider"></div>
          <div class="header-title">
            <h1>تقرير طرود التجميعة</h1>
            <p>Closing Parcels Report — Tracify</p>
          </div>
        </div>
        <div class="header-right">
          <div>📅 <strong>${dateStr}</strong></div>
          <div>⏰ <strong>${timeStr}</strong></div>
          <div>🏢 <strong>${user.stationName || 'غير محدد'}</strong></div>
          <div>👤 <strong>${user.username || 'غير محدد'}</strong></div>
        </div>
      </div>

      <!-- Receipt number -->
      <div class="receipt-badge">
        🧾 رقم التجميعة: ${receiptNumber}
      </div>

      <!-- Stats -->
      <div class="stats-bar">
        <div class="stat-card">
          <div class="stat-label">عدد الطرود</div>
          <div class="stat-value">${parcels.length}</div>
        </div>
        <div class="stat-card blue">
          <div class="stat-label">الرصيد النظري</div>
          <div class="stat-value">${Number(closing.expectedAmount || 0).toLocaleString('ar-DZ')} DA</div>
        </div>
        <div class="stat-card blue">
          <div class="stat-label">المبلغ الفعلي</div>
          <div class="stat-value">${Number(closing.actualAmount || 0).toLocaleString('ar-DZ')} DA</div>
        </div>
        <div class="stat-card dynamic">
          <div class="stat-label">الحالة</div>
          <div class="stat-value" style="color:${diffColor};">${statusLabel}</div>
        </div>
      </div>

      <!-- Table -->
      <div class="section-title">تفاصيل الطرود</div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>رقم التتبع</th>
              <th>العميل</th>
              <th>الهاتف</th>
              <th>المبلغ</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>

      <!-- Summary -->
      <div class="summary-box">
        <div class="summary-item">
          <div class="s-label">المجموع الكلي للطرود</div>
          <div class="s-value" style="color:#7c3aed;">${Number(totalAmount).toLocaleString('ar-DZ')} DA</div>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <div class="s-label">الفرق</div>
          <div class="diff-pill">${diffSign}${Number(diff).toLocaleString('ar-DZ')} DA</div>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <div class="s-label">المسؤول</div>
          <div class="s-value" style="font-size:.88rem;">${closing.supervisorName || closing.closedBy || '—'}</div>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <div class="s-label">المنفذ</div>
          <div class="s-value" style="font-size:.88rem;">${closing.operatorName || closing.closedBy || '—'}</div>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div class="footer-note">
          <div class="brand">Tracify</div>
          تم إنشاء هذا التقرير تلقائياً<br>
          ${dateStr} — ${timeStr}
        </div>
      </div>

    </body>
    </html>
  `;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 800);
}

// ===================================================
// حدث تقديم نموذج التجميع
// ===================================================
document.getElementById('closingForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const boxId        = document.getElementById('connectedBoxSelect').value;
  const actualAmount = parseFloat(document.getElementById('actualAmount').value);
  const notes        = document.getElementById('notes').value;
  const resultDiv    = document.getElementById('result');
  const submitBtn    = e.target.querySelector('button[type="submit"]');

  if (!boxId) {
    resultDiv.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-circle"></i>
        يجب اختيار صندوق أولاً
      </div>`;
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التجميع...';

  try {
    const result = await closeCash({ actualAmount, notes, boxId });

    if (result.emptyClose) {
      resultDiv.innerHTML = `
        <div class="alert alert-success">
          <i class="fas fa-check-circle"></i>
          <div><strong>${result.message}</strong></div>
        </div>`;
    } else {
      const diff     = result.difference;
      const diffText = diff === 0
        ? 'لا يوجد فرق ✓'
        : diff > 0
          ? `زيادة: +${Number(diff).toLocaleString('ar-DZ')} DA`
          : `نقص: ${Number(diff).toLocaleString('ar-DZ')} DA`;

      resultDiv.innerHTML = `
        <div class="alert alert-success">
          <i class="fas fa-check-circle"></i>
          <div>
            <strong>تم التجميع بنجاح — ${result.closing.receiptNumber}</strong><br>
            <span style="font-size:0.83rem;opacity:0.85;">الرصيد أصبح 0 DA &nbsp;|&nbsp; ${diffText}</span>
          </div>
        </div>`;
    }

    await loadConnectedBoxes();
    await loadClosings();
    e.target.reset();

  } catch (err) {
    resultDiv.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-circle"></i>
        خطأ: ${err.message}
      </div>`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-lock"></i> تأكيد التجميع';
  }
});

// ===================================================
// تحميل البيانات عند فتح الصفحة
// ===================================================
loadClosings();