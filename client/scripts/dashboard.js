const HOST = `${window.location.protocol}//${window.location.hostname}:3000`;

async function loadDashboard() {
  try {
    // جلب البيانات باستخدام fetchAPI (يضيف التوكن تلقائياً)
    const [parcels, closingsRes, deliveryStats] = await Promise.all([
      fetchAPI('/parcels'),
      fetchAPI(`/closings?from=${new Date().toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}`),
      fetchAPI('/cash/monthly-delivery-stats').catch(() => ({ monthlyDeliveries: 0, currentMonth: '' }))
    ]);

    // إحصائيات الطرود
    const paid    = parcels.filter(p => p.status === 'paid').length;
    const pending = parcels.filter(p => p.status === 'pending').length;

    // تحصيل اليوم — من الصندوق المتصل أو مجموع كل الصناديق
    let todayTotal = 0;
    try {
      const boxId = getBoxId();
      if (boxId) {
        const stats    = await fetchAPI(`/cash/today-stats?boxId=${boxId}`);
        todayTotal = stats.totalCollected || 0;
      } else {
        // بدون صندوق محدد — نحسب من كل الحركات اليوم
        const mov = await fetchAPI('/cash/today-total');
        if (mov) {
          todayTotal = mov.total || 0;
        }
      }
    } catch(e) { /* نتجاهل الخطأ ونكمل */ }

    // الرصيد الإجمالي لكل الصناديق
    let balance = 0;
    try {
      const boxId = getBoxId();
      if (boxId) {
        const bal = await fetchAPI(`/cash/balance?boxId=${boxId}`);
        if (bal) {
          balance = bal.balance || 0;
        }
      }
    } catch(e) { /* نتجاهل */ }

    animateNumber('balance',       balance);
    animateNumber('total-today',   todayTotal);
    animateNumber('paid-count',    paid);
    animateNumber('pending-count', pending);

    // Update delivery stats
    if (deliveryStats && deliveryStats.monthlyDeliveries !== undefined) {
      animateNumber('monthly-deliveries', deliveryStats.monthlyDeliveries || 0);
      const label = document.getElementById('delivery-month-label');
      if (label) label.textContent = deliveryStats.currentMonth || '';
    }

    // Update hero row stats (same values, different IDs)
    const hp = document.getElementById('hero-pending');
    const hd = document.getElementById('hero-paid');
    const hb = document.getElementById('hero-balance');
    if (hp) hp.textContent = pending;
    if (hd) hd.textContent = paid;
    if (hb) hb.textContent = balance;

    await loadTodayClosings(closingsRes);

  } catch (err) {
    console.error('خطأ في تحميل لوحة التحكم:', err);
  }
}

async function loadTodayClosings(closingsRes) {
  try {
    const data     = await closingsRes.json();
    const closings = Array.isArray(data) ? data : (data.closings || []);
    const container = document.getElementById('closings-container');

    if (!closings.length) {
      container.innerHTML = `
        <div class="no-closings">
          <div class="no-closings-icon"><i class="fas fa-moon"></i></div>
          <p style="font-size:var(--text-md);font-weight:900;color:var(--text-dark);margin-bottom:.4rem;">لا توجد تجميعات اليوم</p>
          <p style="font-size:var(--text-sm);color:var(--text-secondary);">ستظهر هنا فور إنجازها</p>
        </div>`;
      return;
    }

    container.innerHTML = closings.map((c, i) => {
      const diff         = c.difference || 0;
      const diffAbs      = Math.abs(diff);
      const diffStr      = Number(diffAbs).toLocaleString('ar-DZ');
      const time         = new Date(c.closedAt).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
      const parcelsCount = (c.parcels || []).length;

      let diffBadge;
      if (diff === 0) {
        diffBadge = `<span class="cc-diff-badge ok"><i class="fas fa-check"></i> متطابق</span>`;
      } else if (diff > 0) {
        diffBadge = `<span class="cc-diff-badge pos"><i class="fas fa-arrow-up"></i> +${diffStr} DA</span>`;
      } else {
        diffBadge = `<span class="cc-diff-badge neg"><i class="fas fa-arrow-down"></i> -${diffStr} DA</span>`;
      }

      const diffValueClass = diff === 0 ? 'neutral' : diff > 0 ? 'positive' : 'negative';
      const diffDisplay    = diff === 0
        ? `<span style="font-size:.9rem;font-weight:800;color:var(--success);">✓</span>`
        : `${diff > 0 ? '+' : '-'}${diffStr}`;

      return `
        <div class="closing-card" style="animation-delay:${i * 0.07}s">
          <div class="cc-head">
            <span class="cc-receipt"><i class="fas fa-receipt"></i> ${c.receiptNumber || 'REC-?????'}</span>
            <span class="cc-time"><i class="fas fa-clock"></i> ${time}</span>
          </div>
          <div class="cc-body">
            <div class="cc-amounts">
              <div class="cc-amount-item">
                <span class="cc-amount-label">النظري</span>
                <span class="cc-amount-value">${Number(c.expectedAmount || 0).toLocaleString('ar-DZ')}<small>DA</small></span>
              </div>
              <div class="cc-divider-v"></div>
              <div class="cc-amount-item">
                <span class="cc-amount-label">الفعلي</span>
                <span class="cc-amount-value">${Number(c.actualAmount || 0).toLocaleString('ar-DZ')}<small>DA</small></span>
              </div>
              <div class="cc-divider-v"></div>
              <div class="cc-amount-item">
                <span class="cc-amount-label">الفرق</span>
                <span class="cc-amount-value ${diffValueClass}">${diffDisplay}${diff !== 0 ? '<small>DA</small>' : ''}</span>
              </div>
            </div>
          </div>
          <div class="cc-foot">
            <span class="cc-meta"><i class="fas fa-user-tie"></i> ${c.closedBy || '—'}</span>
            <span class="cc-meta"><i class="fas fa-boxes"></i> ${parcelsCount} طرد</span>
            ${diffBadge}
            <a href="/closing.html" class="cc-link"><i class="fas fa-eye"></i> تفاصيل</a>
          </div>
        </div>`;
    }).join('');

  } catch (e) { console.error(e); }
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now(), duration = 900;
  function update(now) {
    const p = Math.min((now - start) / duration, 1);
    const e = 1 - Math.pow(1 - p, 4);
    el.textContent = Number(Math.round(target * e)).toLocaleString('ar-DZ');
    if (p < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

loadDashboard();
setInterval(loadDashboard, 60000);