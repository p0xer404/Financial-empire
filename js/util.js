/* ============================================================
   util.js  —  Formatting + math helpers (loaded first)
   ============================================================ */

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function rand(a, b){ return a + Math.random() * (b - a); }
function randInt(a, b){ return Math.floor(rand(a, b + 1)); }
function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
function chance(p){ return Math.random() < p; }

/* Full currency, e.g. $1,234,567 */
function fmtMoney(v, decimals = 0){
  const neg = v < 0;
  v = Math.abs(v);
  const s = v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (neg ? '-$' : '$') + s;
}

/* Compact, e.g. $1.23M / $4.5B / $12.3T / $3.4Qa / $7.8Qi */
function fmtShort(v){
  const neg = v < 0; v = Math.abs(v);
  let out;
  if (v >= 1e18) out = (v/1e18).toFixed(2) + 'Qi';
  else if (v >= 1e15) out = (v/1e15).toFixed(2) + 'Qa';
  else if (v >= 1e12) out = (v/1e12).toFixed(2) + 'T';
  else if (v >= 1e9) out = (v/1e9).toFixed(2) + 'B';
  else if (v >= 1e6) out = (v/1e6).toFixed(2) + 'M';
  else if (v >= 1e3) out = (v/1e3).toFixed(1) + 'K';
  else out = v.toFixed(0);
  return (neg ? '-' : '') + out;
}
function fmtMoneyShort(v){ return (v < 0 ? '-$' : '$') + fmtShort(Math.abs(v)); }

/* Adaptive: full separated figure below $1M (where every dollar reads),
   compact above it so big balances never overflow the chrome. */
function fmtMoneyAuto(v){ return Math.abs(v) < 1e6 ? fmtMoney(v) : fmtMoneyShort(v); }

function fmtPct(v, d = 2){ return (v >= 0 ? '+' : '') + (v * 100).toFixed(d) + '%'; }

function fmtNum(v){ return Math.round(v).toLocaleString('en-US'); }

/* Passive income per second across all sources — referenced widely */
function passivePerSec(s){
  let total = 0;
  for (const t in s.holdings){
    const h = s.holdings[t]; if (h.qty <= 0) continue;
    const c = getCompany(t); if (!c) continue;
    total += (c.price * h.qty * c.div) / 240;
  }
  s.ownedCompanies.forEach(o => total += o.income);
  s.startups.forEach(su => { if (su.status === 'operating') total += su.income; });
  s.deals.forEach(d => { if (d.status === 'active' && d.passive) total += d.passive; });
  if (s.hedgeFund.created) total += hedgeFundIncome(s);
  total += s.empire.passive || 0;
  // Permanent prestige income multiplier (Compound Interest tree).
  if (typeof incomeMult === 'function') total *= incomeMult();
  return total;
}

function hedgeFundIncome(s){
  const hf = s.hedgeFund;
  if (!hf.created) return 0;
  const mgmt = (hf.aum * 0.02) / 240;
  const perf = (hf.aum * hf.monthlyReturn * 0.20) / 30;
  return mgmt + Math.max(0, perf);
}

/* XP required to go from level L to L+1 */
function xpForLevel(L){ return Math.floor(100 * Math.pow(L, 1.55)); }
