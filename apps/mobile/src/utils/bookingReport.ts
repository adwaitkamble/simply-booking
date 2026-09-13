/**
 * Pure reporting logic for the Booking Report screen: aggregation and the
 * HTML document used for the PDF export. Kept free of React Native imports so
 * it can be exercised directly.
 */
export const STATUS_COLORS: Record<string, string> = {
  Confirmed: '#10B981',
  CheckedIn: '#3B82F6',
  CheckedOut: '#64748B',
  Pending: '#F59E0B',
  Cancelled: '#EF4444',
};

const toNumber = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const inr = (n: number): string => `₹${Math.round(n).toLocaleString('en-IN')}`;

const nightsBetween = (checkIn: string, checkOut: string): number => {
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 1;
  return Math.max(1, Math.round((b - a) / 86400000));
};

const monthKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const monthLabel = (key: string): string => {
  const [y, m] = key.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[Number(m) - 1]} ${String(y).slice(2)}`;
};

export const ddmmyyyy = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
};

/** Everything the report shows, derived once from the reservation list. */
export function buildReport(reservations: any[], periodDays: number | null) {
  // A trailing window is bounded at both ends: without the upper bound a booking
  // for next year would count as being "in the last 30 days".
  const now = Date.now();
  const cutoff = periodDays ? now - periodDays * 86400000 : null;
  const endOfToday = new Date().setHours(23, 59, 59, 999);

  const rows = reservations
    .filter((r) => {
      if (!cutoff) return true;
      const t = new Date(r.checkIn).getTime();
      return Number.isFinite(t) && t >= cutoff && t <= endOfToday;
    })
    .map((r) => {
      const total = toNumber(r.totalAmount);
      const advance = toNumber(r.advancePaid);
      return {
        id: String(r.id),
        guestName: r.guest?.name || 'Walk-in Guest',
        roomNumber: r.room?.roomNumber || '—',
        category: r.room?.roomCategory?.name || 'Standard',
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        nights: nightsBetween(r.checkIn, r.checkOut),
        status: r.status || 'Pending',
        total,
        advance,
        balance: Math.max(0, total - advance),
      };
    });

  const live = rows.filter((r) => r.status !== 'Cancelled');

  const revenue = live.reduce((a, r) => a + r.total, 0);
  const advance = live.reduce((a, r) => a + r.advance, 0);
  const balance = live.reduce((a, r) => a + r.balance, 0);
  const roomNights = live.reduce((a, r) => a + r.nights, 0);
  const cancelled = rows.length - live.length;

  // Revenue and booking count per month, oldest first.
  const byMonthMap = new Map<string, { revenue: number; count: number }>();
  live.forEach((r) => {
    const d = new Date(r.checkIn);
    if (Number.isNaN(d.getTime())) return;
    const k = monthKey(d);
    const cur = byMonthMap.get(k) || { revenue: 0, count: 0 };
    cur.revenue += r.total;
    cur.count += 1;
    byMonthMap.set(k, cur);
  });
  const byMonth = Array.from(byMonthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([k, v]) => ({ key: k, label: monthLabel(k), ...v }));

  const group = (items: typeof live, keyOf: (r: (typeof live)[0]) => string) => {
    const m = new Map<string, { revenue: number; count: number }>();
    items.forEach((r) => {
      const k = keyOf(r);
      const cur = m.get(k) || { revenue: 0, count: 0 };
      cur.revenue += r.total;
      cur.count += 1;
      m.set(k, cur);
    });
    return Array.from(m.entries())
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.revenue - a.revenue);
  };

  const byCategory = group(live, (r) => r.category);
  const byRoom = group(live, (r) => `Room ${r.roomNumber}`).slice(0, 6);

  const statusCounts = Object.keys(STATUS_COLORS)
    .map((s) => ({ label: s, count: rows.filter((r) => r.status === s).length }))
    .filter((s) => s.count > 0);

  return {
    rows: rows.sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime()),
    totals: {
      bookings: rows.length,
      confirmed: live.length,
      cancelled,
      revenue,
      advance,
      balance,
      roomNights,
      adr: roomNights ? revenue / roomNights : 0,
      avgStay: live.length ? roomNights / live.length : 0,
      cancelRate: rows.length ? (cancelled / rows.length) * 100 : 0,
    },
    byMonth,
    byCategory,
    byRoom,
    statusCounts,
  };
}

export type ReportData = ReturnType<typeof buildReport>;

/** Standalone HTML document for the PDF export. */
export function buildReportHtml(
  report: ReportData,
  hotelName: string,
  periodLabel: string
): string {
  const t = report.totals;
  const generated = new Date().toLocaleString('en-IN');
  const maxMonth = Math.max(1, ...report.byMonth.map((m) => m.revenue));
  const maxCat = Math.max(1, ...report.byCategory.map((c) => c.revenue));

  const kpi = (label: string, value: string) =>
    `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>`;

  const monthBars = report.byMonth
    .map(
      (m) => `
      <div class="col">
        <div class="col-val">${m.revenue >= 1000 ? Math.round(m.revenue / 1000) + 'k' : Math.round(m.revenue)}</div>
        <div class="col-track"><div class="col-fill" style="height:${Math.max(4, (m.revenue / maxMonth) * 100)}%"></div></div>
        <div class="col-label">${m.label}</div>
      </div>`
    )
    .join('');

  const catBars = report.byCategory
    .map(
      (c) => `
      <div class="bar-row">
        <div class="bar-head"><span>${c.label}</span><span>${inr(c.revenue)} · ${c.count} booking${c.count === 1 ? '' : 's'}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, (c.revenue / maxCat) * 100)}%"></div></div>
      </div>`
    )
    .join('');

  const statusChips = report.statusCounts
    .map(
      (s) =>
        `<span class="chip" style="background:${STATUS_COLORS[s.label]}1a;color:${STATUS_COLORS[s.label]};border-color:${STATUS_COLORS[s.label]}55">${s.label}: ${s.count}</span>`
    )
    .join('');

  const tableRows = report.rows
    .map(
      (r) => `
      <tr>
        <td>${r.guestName}</td>
        <td>${r.category}<br/><span class="muted">Room ${r.roomNumber}</span></td>
        <td>${ddmmyyyy(r.checkIn)}<br/><span class="muted">to ${ddmmyyyy(r.checkOut)}</span></td>
        <td class="num">${r.nights}</td>
        <td class="num">${inr(r.total)}</td>
        <td class="num">${inr(r.balance)}</td>
        <td><span class="status" style="color:${STATUS_COLORS[r.status] || '#64748B'}">${r.status}</span></td>
      </tr>`
    )
    .join('');

  return `<!doctype html>
<html>
<head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0F172A; margin: 0; padding: 28px; font-size: 12px; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  h2 { font-size: 14px; margin: 26px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #E2E8F0; }
  .sub { color: #64748B; font-size: 11px; margin-bottom: 4px; }
  .kpi-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .kpi { flex: 1 1 30%; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; background: #F8FAFC; }
  .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: .6px; color: #64748B; }
  .kpi-value { font-size: 16px; font-weight: 700; margin-top: 3px; }
  .chart { display: flex; align-items: flex-end; gap: 8px; height: 150px; padding-top: 8px; }
  .col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
  .col-val { font-size: 8px; color: #64748B; margin-bottom: 3px; }
  .col-track { flex: 1; width: 100%; display: flex; align-items: flex-end; background: #F1F5F9; border-radius: 4px; }
  .col-fill { width: 100%; background: #3B82F6; border-radius: 4px; }
  .col-label { font-size: 8px; color: #64748B; margin-top: 4px; }
  .bar-row { margin-bottom: 9px; }
  .bar-head { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 3px; }
  .bar-head span:last-child { color: #64748B; }
  .bar-track { height: 8px; background: #F1F5F9; border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; background: #3B82F6; border-radius: 4px; }
  .chip { display: inline-block; padding: 3px 9px; border-radius: 99px; font-size: 10px; font-weight: 600; border: 1px solid; margin-right: 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: #64748B; border-bottom: 1px solid #E2E8F0; padding: 6px 5px; }
  td { padding: 7px 5px; border-bottom: 1px solid #F1F5F9; font-size: 10px; vertical-align: top; }
  td.num, th.num { text-align: right; }
  .muted { color: #94A3B8; font-size: 9px; }
  .status { font-weight: 700; font-size: 10px; }
  .foot { margin-top: 22px; padding-top: 10px; border-top: 1px solid #E2E8F0; color: #94A3B8; font-size: 9px; }
</style>
</head>
<body>
  <h1>${hotelName}</h1>
  <div class="sub">Booking Report · ${periodLabel}</div>
  <div class="sub">Generated ${generated}</div>

  <div class="kpi-grid">
    ${kpi('Total Bookings', String(t.bookings))}
    ${kpi('Room Nights', String(t.roomNights))}
    ${kpi('Gross Revenue', inr(t.revenue))}
    ${kpi('Advance Collected', inr(t.advance))}
    ${kpi('Balance Due', inr(t.balance))}
    ${kpi('Avg Nightly Rate', inr(t.adr))}
    ${kpi('Avg Stay', `${t.avgStay.toFixed(1)} nights`)}
    ${kpi('Cancelled', `${t.cancelled} (${t.cancelRate.toFixed(0)}%)`)}
  </div>

  <h2>Revenue by Month</h2>
  ${report.byMonth.length ? `<div class="chart">${monthBars}</div>` : '<p class="muted">No bookings in this period.</p>'}

  <h2>Revenue by Room Category</h2>
  ${report.byCategory.length ? catBars : '<p class="muted">No bookings in this period.</p>'}

  <h2>Booking Status</h2>
  <div>${statusChips || '<span class="muted">No bookings in this period.</span>'}</div>

  <h2>Bookings (${report.rows.length})</h2>
  <table>
    <thead><tr>
      <th>Guest</th><th>Room</th><th>Stay</th><th class="num">Nights</th>
      <th class="num">Total</th><th class="num">Balance</th><th>Status</th>
    </tr></thead>
    <tbody>${tableRows || '<tr><td colspan="7" class="muted">No bookings in this period.</td></tr>'}</tbody>
  </table>

  <div class="foot">Revenue figures exclude cancelled bookings. Generated by Simply Booking.</div>
</body>
</html>`;
}
