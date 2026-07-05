/* ============================================================
   ui.js  —  Rendering, charts, animations, overlays
   ============================================================ */

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

let currentView = 'dashboard';
let selectedTicker = null;
let chartTF = '1W';
const _lastShownPrice = {};        // ticker -> last rendered price (for flash)
let _lastNetWorth = 0;

function sfxSafe(n, o){ if (typeof sfx === 'function' && state && state.settings.sound) sfx(n, o); }

/* ---------- NAV ---------- */
const NAV = [
  { view:'dashboard',    icon:'◧', label:'Dashboard' },
  { view:'market',       icon:'📈', label:'Markets' },
  { view:'portfolio',    icon:'💼', label:'Portfolio' },
  { view:'boosts',       icon:'⚡', label:'Power-Ups' },
  { view:'startups',     icon:'🚀', label:'Startups',     unlock:s=>startupUnlocked() },
  { view:'ipos',         icon:'🔔', label:'IPOs',         unlock:s=>s.netWorth>=250000 },
  { view:'deals',        icon:'🤝', label:'Deals',        unlock:s=>dealsUnlocked() },
  { view:'acquisitions', icon:'🏢', label:'Acquisitions', unlock:s=>acquisitionsUnlocked() },
  { view:'hedgefund',    icon:'🏦', label:'Hedge Fund',   unlock:s=>hedgeFundUnlocked() },
  { view:'empire',       icon:'🌐', label:'Empire',       unlock:s=>empireUnlocked() },
  { view:'legacy',       icon:'♻️', label:'Legacy · Reincorporate', unlock:s=>prestigeUnlocked() },
  { view:'rankings',     icon:'👑', label:'Rankings' },
  { view:'achievements', icon:'🏆', label:'Achievements' },
];

function buildNav(){
  const nav = $('nav'); nav.innerHTML = '';
  NAV.forEach(n => {
    const unlocked = n.unlock ? n.unlock(state) : true;
    const item = el('div', 'nav-item' + (n.view===currentView?' active':'') + (unlocked?'':' locked'));
    item.dataset.view = n.view;
    const ic = (typeof svgIcon === 'function' && svgIcon(n.view)) || n.icon;
    item.innerHTML = `<span class="nav-ic">${ic}</span><span class="tip">${n.label}${unlocked?'':' · locked'}</span><span class="nav-badge" data-badge="${n.view}" style="display:none"></span>`;
    item.onclick = () => switchView(n.view);
    nav.appendChild(item);
  });
  updateNavBadges();
}

function updateNavBadges(){
  const set = (v, count) => {
    const b = document.querySelector(`[data-badge="${v}"]`);
    if (!b) return;
    if (count > 0){ b.style.display='grid'; b.textContent = count; } else b.style.display='none';
  };
  set('startups', state.startupOffers.length);
  set('deals', state.dealOffers.length);
  set('ipos', state.ipos.filter(i=>i.status==='upcoming').length);
  // Legacy badge nudges the player when a reincorporation is worth taking.
  const legacyBadge = document.querySelector('[data-badge="legacy"]');
  if (legacyBadge){
    const pend = (typeof canReincorporate === 'function' && canReincorporate()) ? pendingLegacy() : 0;
    if (pend > 0){ legacyBadge.style.display='grid'; legacyBadge.textContent = pend > 99 ? '99+' : pend; }
    else legacyBadge.style.display='none';
  }
}

function switchView(view){
  if (view !== currentView) sfxSafe('tab');
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view===view));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view===view));
  renderView(view);
}
function refreshFeatureVisibility(){
  buildNav();
  // Re-render the current view so a freshly unlocked feature (analyst
  // reports, scanner, forecasts, …) shows up immediately, not on next visit.
  if (typeof currentView !== 'undefined' && currentView) renderView(currentView);
}

/* ---------- THEME ---------- */
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  const btn = $('btn-theme');
  if (btn) btn.textContent = t === 'light' ? '☾' : '☀';
  saveTheme(t);
  renderTick();
}
function toggleTheme(){
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}
function themeColor(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

/* ---------- ANIMATED COUNTER ---------- */
const counters = {};
function animateCounter(id, target, fmt){
  const node = $(id); if (!node) return;
  const c = counters[id] || (counters[id] = { cur: target });
  c.target = target; c.fmt = fmt; c.node = node;
  if (c.raf) return;
  const step = () => {
    const diff = c.target - c.cur;
    if (Math.abs(diff) < Math.max(1, Math.abs(c.target)*0.0005)){ c.cur = c.target; c.node.textContent = c.fmt(c.cur); c.raf=null; return; }
    c.cur += diff * 0.16;
    c.node.textContent = c.fmt(c.cur);
    c.raf = requestAnimationFrame(step);
  };
  c.raf = requestAnimationFrame(step);
}

/* ---------- TOP BAR ---------- */
function renderTopbar(){
  animateCounter('t-networth', state.netWorth, v=>fmtMoneyAuto(v));
  animateCounter('t-cash', state.cash, v=>fmtMoneyAuto(v));
  const passMult = (typeof gainMult === 'function') ? gainMult() : 1;
  $('t-passive').textContent = '+' + fmtMoneyShort(passivePerSec(state) * passMult) + '/s' + (passMult > 1 ? ' ×2' : '');
  $('t-rank').textContent = state.rankName;
  $('t-level').textContent = state.level;
  const need = xpForLevel(state.level);
  $('t-xp').style.width = clamp(state.xp/need*100, 0, 100) + '%';
  $('t-xp-label').textContent = Math.floor(state.xp) + ' / ' + need + ' XP';

  // net-worth glow pulse on gains
  if (state.netWorth > _lastNetWorth + Math.max(1, _lastNetWorth*0.0002)){
    const n = $('t-networth');
    n.classList.remove('pulse-up'); void n.offsetWidth; n.classList.add('pulse-up');
  }
  _lastNetWorth = state.netWorth;

  const reg = $('t-regime');
  reg.querySelector('.reg-label').textContent = REGIME_LABEL[state.market.regime];
  const up = ['bull','recovery','bubble'].includes(state.market.regime);
  const down = ['bear','recession','crash'].includes(state.market.regime);
  reg.dataset.dir = up?'up':down?'down':'flat';

  // streak chip
  const sc = $('streak-chip');
  if (state.streak >= 2){ sc.style.display='flex'; sc.querySelector('.sval').textContent = state.streak + '×'; }
  else sc.style.display='none';

  renderGoalTracker();
}

function updateRankLabel(){
  if (!state.milestonesHit['$100K'] && state.netWorth < 100000){
    state.rankName = state.netWorth >= 25000 ? 'Retail Investor' : 'Bedroom Investor';
  }
}

/* ---------- GOAL TRACKER ---------- */
function nextGoal(){
  // gather upcoming net-worth thresholds: sector unlocks + milestones
  const goals = [];
  for (const id in SECTORS){ const s = SECTORS[id]; if (s.unlockAt>0 && !state.unlockedSectors.includes(id)) goals.push({ v:s.unlockAt, label:'Unlock '+s.name, kind:'sector' }); }
  MILESTONES.forEach(m => { if (!state.milestonesHit[m.tag]) goals.push({ v:m.v, label:m.rank+' ('+m.tag+')', kind:'rank' }); });
  goals.sort((a,b)=>a.v-b.v);
  const g = goals.find(x => x.v > state.netWorth) || goals[0];
  if (!g) return null;
  // lower bound = highest already-passed threshold
  const passed = [10000, ...goals.filter(x=>x.v<=state.netWorth).map(x=>x.v),
    ...MILESTONES.filter(m=>state.milestonesHit[m.tag]).map(m=>m.v),
    ...Object.values(SECTORS).filter(s=>state.unlockedSectors.includes(s.id)&&s.unlockAt>0).map(s=>s.unlockAt)];
  const lo = Math.max(...passed.filter(v=>v<g.v), 10000);
  return { g, lo };
}
function renderGoalTracker(){
  const ng = nextGoal();
  if (!ng){ $('goal-tracker').style.display='none'; return; }
  $('goal-tracker').style.display='flex';
  const pct = clamp((state.netWorth - ng.lo)/(ng.g.v - ng.lo)*100, 0, 100);
  $('goal-fill').style.width = pct + '%';
  $('goal-reward').textContent = ng.g.label;
  $('goal-remain').textContent = fmtMoneyShort(Math.max(0, ng.g.v - state.netWorth)) + ' to go';
  $('goal-pct').textContent = pct.toFixed(1) + '%';
}

/* ---------- DASHBOARD ---------- */
function renderDashboard(){
  $('dash-index').textContent = state.market.index.toFixed(2);
  drawLineChart('indexChart', state.market.indexHistory.slice(-120));

  const pwrap = $('dash-portfolio');
  const holds = Object.keys(state.holdings).filter(t=>state.holdings[t].qty>0);
  $('dash-holdcount').textContent = holds.length + ' position' + (holds.length!==1?'s':'');
  if (!holds.length){ pwrap.innerHTML = '<div class="empty">No holdings yet. Visit Markets to invest.</div>'; }
  else {
    let html = '', total = 0;
    holds.sort((a,b)=>positionValue(b)-positionValue(a)).slice(0,8).forEach(t=>{
      const c = getCompany(t), h = state.holdings[t];
      const val = h.qty*c.price, pnl = val - h.avgCost*h.qty;
      html += `<div class="kv"><span class="k"><b class="ticker">${t}</b> <span class="tname">×${fmtNum(h.qty)}</span></span>
        <span class="v mono">${fmtMoneyShort(val)} <span class="${pnl>=0?'pos':'neg'}">${pnl>=0?'+':''}${fmtMoneyShort(pnl)}</span></span></div>`;
    });
    holds.forEach(t=>total+=positionValue(t));
    pwrap.innerHTML = html + `<div class="kv" style="border:none;margin-top:8px;"><span class="k">Total Equity Value</span><span class="v mono">${fmtMoney(total)}</span></div>`;
  }
  renderHeatmap('dash-heatmap');
  renderNews('dash-news');
}

function renderHeatmap(id){
  const wrap = $(id); if (!wrap) return;
  wrap.innerHTML = '';
  state.unlockedSectors.forEach(secId => {
    const sec = SECTORS[secId];
    const comps = COMPANIES.filter(c=>c.sector===secId);
    const avgChg = comps.reduce((a,c)=>{ const h=c.history; return h.length<2?a:a+(c.price/h[h.length-2].c-1); },0)/comps.length;
    const cell = el('div','heat-cell');
    const intensity = clamp(Math.abs(avgChg)*40, .14, .85);
    cell.style.background = avgChg>=0 ? `rgba(36,200,124,${intensity})` : `rgba(240,70,104,${intensity})`;
    cell.innerHTML = `<div class="ht">${sec.name.split(' ')[0]}</div><div class="hp mono">${fmtPct(avgChg)}</div>`;
    cell.onclick = () => switchView('market');
    wrap.appendChild(cell);
  });
}

function renderNews(id){
  const wrap = $(id); if (!wrap) return;
  wrap.innerHTML = '';
  state.news.slice(0,25).forEach(n => {
    const item = el('div', 'news-item' + (n.big?' big':''));
    const color = n.impact>0?'var(--green)':n.impact<0?'var(--red)':'var(--blue)';
    item.innerHTML = `<div class="tag" style="background:${color}"></div>
      <div class="txt">${n.text}<div class="time">Day ${Math.floor(n.tick)} · ${n.scope}</div></div>`;
    wrap.appendChild(item);
  });
  if (!state.news.length) wrap.innerHTML = '<div class="empty">Awaiting market news…</div>';
}
function onNews(n){
  if (currentView==='dashboard') renderNews('dash-news');
  // ticker strip
  const strip = $('ticker-strip');
  if (strip && n){
    const color = n.impact>0?'var(--green)':n.impact<0?'var(--red)':'var(--muted)';
    const item = el('span','ticker-item');
    item.innerHTML = `<span class="dot" style="background:${color}"></span>${n.text}`;
    strip.insertBefore(item, strip.firstChild);
    while (strip.children.length > 14) strip.removeChild(strip.lastChild);
  }
}

/* ---------- MARKET TABLE ---------- */
function momentum(c){ const h=c.history; if (h.length<22) return 0; return c.price/h[h.length-22].c - 1; }
function hotTag(c){
  const m = momentum(c);
  if (m >= 0.12) return '<span class="hot vhot">🔥 HOT</span>';
  if (m >= 0.05) return '<span class="hot">▲</span>';
  if (m <= -0.10) return '<span class="cold">❄</span>';
  if (m <= -0.05) return '<span class="cold">▼</span>';
  return '';
}

function rebuildMarketTable(){
  const body = $('market-body'); if (!body) return;
  body.innerHTML = '';
  COMPANIES.filter(c=>state.unlockedSectors.includes(c.sector)).forEach(c => {
    const sec = SECTORS[c.sector];
    const tr = el('tr');
    tr.dataset.ticker = c.ticker;
    if (c.ticker===selectedTicker) tr.classList.add('selected');
    tr.innerHTML = `
      <td><span class="ticker">${c.ticker}</span> <span data-hot>${hotTag(c)}</span><div class="tname">${c.name}</div></td>
      <td><span class="sector-pill" style="background:${hexA(sec.color,.14)};color:${sec.color}">${sec.name.split(' ')[0]}</span></td>
      <td><canvas class="spark" data-spark="${c.ticker}" width="90" height="30"></canvas></td>
      <td class="mono" data-price>${fmtMoney(c.price,2)}</td>
      <td class="mono" data-change></td>
      <td><span class="badge risk-${c.risk}">R${c.risk}</span></td>
      <td class="mono muted">${(c.div*100).toFixed(1)}%</td>`;
    tr.onclick = () => selectTicker(c.ticker);
    body.appendChild(tr);
    _lastShownPrice[c.ticker] = c.price;
  });
  $('market-count').textContent = COMPANIES.filter(c=>state.unlockedSectors.includes(c.sector)).length + ' listed';
  updateMarketPrices();
  drawSparklines();
}

function updateMarketPrices(){
  const body = $('market-body'); if (!body) return;
  body.querySelectorAll('tr').forEach(tr => {
    const c = getCompany(tr.dataset.ticker); if (!c) return;
    const h = c.history;
    const chg = h.length>1 ? (c.price/h[h.length-2].c - 1) : 0;
    const pc = tr.querySelector('[data-price]');
    const cc = tr.querySelector('[data-change]');
    const prev = _lastShownPrice[c.ticker] != null ? _lastShownPrice[c.ticker] : c.price;
    pc.textContent = fmtMoney(c.price,2);
    cc.textContent = fmtPct(chg);
    cc.className = 'mono ' + (chg>=0?'pos':'neg');
    // flash on meaningful move
    if (Math.abs(c.price/prev - 1) > 0.0012){
      const up = c.price >= prev;
      pc.classList.remove('flash-up','flash-down'); void pc.offsetWidth;
      pc.classList.add(up?'flash-up':'flash-down');
    }
    _lastShownPrice[c.ticker] = c.price;
    const ht = tr.querySelector('[data-hot]'); if (ht) ht.innerHTML = hotTag(c);
  });
}

function drawSparklines(){
  const body = $('market-body'); if (!body) return;
  body.querySelectorAll('canvas[data-spark]').forEach(cv => {
    const c = getCompany(cv.dataset.spark); if (!c) return;
    const data = c.history.slice(-30).map(d=>d.c);
    if (data.length < 2) return;
    const ctx = cv.getContext('2d');
    const r = window.devicePixelRatio||1;
    if (cv.width !== 90*r){ cv.width=90*r; cv.height=30*r; }
    ctx.setTransform(r,0,0,r,0,0);
    ctx.clearRect(0,0,90,30);
    const min=Math.min(...data), max=Math.max(...data), range=(max-min)||1;
    const up = data[data.length-1]>=data[0];
    const col = up?themeColor('--green'):themeColor('--red');
    const X=i=>2+i/(data.length-1)*86, Y=v=>28-(v-min)/range*26;
    const grad = ctx.createLinearGradient(0,2,0,30);
    grad.addColorStop(0, hexToRgba(col,.28)); grad.addColorStop(1, hexToRgba(col,0));
    ctx.beginPath(); ctx.moveTo(X(0),Y(data[0])); data.forEach((v,i)=>ctx.lineTo(X(i),Y(v)));
    ctx.lineTo(X(data.length-1),30); ctx.lineTo(X(0),30); ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
    ctx.beginPath(); ctx.moveTo(X(0),Y(data[0])); data.forEach((v,i)=>ctx.lineTo(X(i),Y(v)));
    ctx.strokeStyle=col; ctx.lineWidth=1.4; ctx.stroke();
  });
}

/* Market Scanner unlock (lvl 15): a Top Movers strip above the market table. */
function renderScanner(){
  const wrap = $('market-scanner'); if (!wrap) return;
  if (!state.unlockedFeatures.marketScanner){ wrap.innerHTML = ''; wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  const pool = COMPANIES.filter(c => state.unlockedSectors.includes(c.sector))
    .map(c => ({ c, m: momentum(c) }))
    .filter(x => isFinite(x.m));
  const gain = [...pool].sort((a,b)=>b.m-a.m).slice(0,3);
  const lose = [...pool].sort((a,b)=>a.m-b.m).slice(0,3);
  const chip = (x, up) => `<button class="scan-chip ${up?'up':'down'}" data-scan="${x.c.ticker}">
      <span class="sc-tk">${x.c.ticker}</span><span class="sc-mv mono">${fmtPct(x.m)}</span></button>`;
  wrap.innerHTML =
    `<span class="scan-label">📡 Scanner</span>
     <span class="scan-group"><span class="scan-tag pos">▲ Top Movers</span>${gain.map(x=>chip(x,true)).join('')}</span>
     <span class="scan-group"><span class="scan-tag neg">▼ Laggards</span>${lose.map(x=>chip(x,false)).join('')}</span>`;
  wrap.querySelectorAll('[data-scan]').forEach(b => b.onclick = () => selectTicker(b.dataset.scan));
}

function selectTicker(ticker){
  selectedTicker = ticker;
  sfxSafe('click');
  document.querySelectorAll('#market-body tr').forEach(tr=>tr.classList.toggle('selected', tr.dataset.ticker===ticker));
  renderTradePanel();
}

function renderTradePanel(){
  const c = getCompany(selectedTicker);
  const body = $('trade-body');
  if (!c){ body.innerHTML = '<div class="empty">Select a company from the market to trade.</div>'; return; }
  const sec = SECTORS[c.sector];
  const h = state.holdings[c.ticker];
  const owned = h ? h.qty : 0;
  $('trade-title').textContent = `${c.ticker} · ${c.name}`;
  $('trade-sub').innerHTML = `<span class="sector-pill" style="background:${hexA(sec.color,.14)};color:${sec.color}">${sec.name}</span> ${hotTag(c)}`;

  const target = c.price * (1 + (c.growth - 3) * 0.06 + c.div);   // 12-mo price target
  const analyst = state.unlockedFeatures.analystReports
    ? `<div class="kv"><span class="k">Analyst Rating</span><span class="v ${c.growth>=4?'pos':''}">${['','Sell','Hold','Hold','Buy','Strong Buy'][c.growth]}</span></div>
       <div class="kv"><span class="k">12-mo Target</span><span class="v mono ${target>=c.price?'pos':'neg'}">${fmtMoney(target,2)} <span class="muted">(${fmtPct(target/c.price-1)})</span></span></div>
       <div class="kv"><span class="k">Sentiment</span><span class="v ${c.sentiment>=0?'pos':'neg'}">${c.sentiment>=0?'Bullish':'Bearish'}</span></div>` : '';

  let forecast = '';
  if (state.unlockedFeatures.forecasts){
    const nx = REGIMES[state.market.regime] ? REGIMES[state.market.regime].next : null;
    if (nx){
      let bk = state.market.regime, bp = 0;
      for (const k in nx){ if (nx[k] > bp){ bp = nx[k]; bk = k; } }
      const upBias = ['bull','recovery','bubble'].includes(bk);
      forecast = `<div class="kv"><span class="k">Market Forecast</span><span class="v ${upBias?'pos':'neg'}">${REGIME_LABEL[bk]} <span class="muted">${Math.round(bp*100)}%</span></span></div>`;
    }
  }

  const tfBtns = Object.keys(TIMEFRAMES).map(k =>
    `<button class="tf-btn${k===chartTF?' active':''}" data-tf="${k}">${k}</button>`).join('');
  const prevQty = $('trade-qty') ? $('trade-qty').value : null;

  body.innerHTML = `
    <div class="chart-toolbar">
      <div class="tf-group">${tfBtns}</div>
      <div class="last-px mono" id="trade-lastpx"></div>
    </div>
    <div class="chartbox"><canvas id="tradeChart" height="210"></canvas></div>
    <div style="margin:14px 0;">
      <div class="kv"><span class="k">Price</span><span class="v mono">${fmtMoney(c.price,2)}</span></div>
      <div class="kv"><span class="k">Market Cap</span><span class="v mono">${fmtMoneyShort(c.mcap)}</span></div>
      <div class="kv"><span class="k">Volatility</span><span class="v">${(c.vol*100).toFixed(1)}%</span></div>
      <div class="kv"><span class="k">Risk / Growth</span><span class="v"><span class="badge risk-${c.risk}">R${c.risk}</span> <span class="badge">G${c.growth}</span></span></div>
      <div class="kv"><span class="k">Dividend Yield</span><span class="v">${(c.div*100).toFixed(2)}%</span></div>
      ${analyst}
      ${forecast}
      <div class="kv"><span class="k">You Own</span><span class="v mono">${fmtNum(owned)} (${fmtMoneyShort(owned*c.price)})</span></div>
    </div>
    <div class="quick-row">
      <button class="btn buy sm" data-amt="1000">+$1K</button>
      <button class="btn buy sm" data-amt="10000">+$10K</button>
      <button class="btn buy sm" data-amt="100000">+$100K</button>
      <button class="btn buy sm" data-amt="max">Max</button>
    </div>
    <input class="trade-input mono" id="trade-qty" type="number" min="1" value="${prevQty || (owned>0?owned:Math.max(1,Math.floor(state.cash/c.price/4)))}" />
    <div class="qty-presets" style="margin:10px 0;">
      <button class="btn sm" data-q="1">1</button>
      <button class="btn sm" data-q="10">10</button>
      <button class="btn sm" data-q="100">100</button>
      <button class="btn sm" data-q="max">All-In Qty</button>
    </div>
    <div class="btn-row">
      <button class="btn buy" id="do-buy" style="flex:1">BUY</button>
      <button class="btn sell" id="do-sell" style="flex:1" ${owned<=0?'disabled':''}>SELL</button>
    </div>
    ${owned>0?`<div class="btn-row" style="margin-top:8px;">
      <button class="btn sell sm" data-sell="0.25" style="flex:1">Sell 25%</button>
      <button class="btn sell sm" data-sell="0.5" style="flex:1">Sell 50%</button>
      <button class="btn sell sm" data-sell="1" style="flex:1">Sell All</button>
    </div>`:''}`;

  drawCandles('tradeChart', c.history, c);

  body.querySelectorAll('[data-tf]').forEach(b => b.onclick = () => {
    chartTF = b.dataset.tf; sfxSafe('click');
    body.querySelectorAll('[data-tf]').forEach(x=>x.classList.toggle('active', x.dataset.tf===chartTF));
    drawCandles('tradeChart', c.history, c);
  });
  const qtyInput = $('trade-qty');
  body.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
    qtyInput.value = b.dataset.q==='max' ? Math.floor(state.cash/c.price) : b.dataset.q;
  });
  body.querySelectorAll('[data-amt]').forEach(b => b.onclick = () => {
    if (b.dataset.amt==='max') buyAmount(c.ticker, state.cash);
    else buyAmount(c.ticker, parseFloat(b.dataset.amt));
  });
  body.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => {
    const hh = state.holdings[c.ticker]; if (!hh) return;
    sellStock(c.ticker, Math.max(1, Math.floor(hh.qty * parseFloat(b.dataset.sell))));
  });
  $('do-buy').onclick = () => buyStock(c.ticker, parseInt(qtyInput.value)||0);
  $('do-sell').onclick = () => sellStock(c.ticker, parseInt(qtyInput.value)||0);
}

/* ---------- PORTFOLIO ---------- */
function renderPortfolio(){
  const body = $('port-body'); if (!body) return;
  body.innerHTML = '';
  const holds = Object.keys(state.holdings).filter(t=>state.holdings[t].qty>0);
  let totalVal = 0, totalPnl = 0;
  holds.sort((a,b)=>positionValue(b)-positionValue(a)).forEach(t => {
    const c = getCompany(t), h = state.holdings[t];
    const val = h.qty*c.price, pnl = val - h.avgCost*h.qty, pct = pnl/(h.avgCost*h.qty);
    totalVal += val; totalPnl += pnl;
    const tr = el('tr');
    tr.innerHTML = `
      <td><span class="ticker">${t}</span><div class="tname">${c.name}</div></td>
      <td class="mono">${fmtNum(h.qty)}</td>
      <td class="mono">${fmtMoney(h.avgCost,2)}</td>
      <td class="mono">${fmtMoney(c.price,2)}</td>
      <td class="mono">${fmtMoney(val)}</td>
      <td class="mono ${pnl>=0?'pos':'neg'}">${pnl>=0?'+':''}${fmtMoneyShort(pnl)}<div class="tname ${pnl>=0?'pos':'neg'}">${fmtPct(pct)}</div></td>
      <td><button class="btn sm sell">Sell All</button></td>`;
    tr.querySelector('button').onclick = (e)=>{ e.stopPropagation(); sellStock(t, h.qty); };
    tr.onclick = ()=>{ selectedTicker=t; switchView('market'); };
    body.appendChild(tr);
  });
  if (!holds.length) body.innerHTML = '<tr><td colspan="7" class="empty">No holdings yet.</td></tr>';
  $('port-total').innerHTML = `Equity ${fmtMoney(totalVal)} · <span class="${totalPnl>=0?'pos':'neg'}">${totalPnl>=0?'+':''}${fmtMoneyShort(totalPnl)} unrealized</span>`;
}

/* ---------- STARTUPS ---------- */
function renderStartups(){
  const wrap = $('startups-wrap'); if (!wrap) return;
  if (!startupUnlocked()){ wrap.innerHTML = lockedCard('🚀','Startup Investing Locked','Reach $5M net worth (or level 40) to access exclusive startup deal flow.'); return; }
  let html = '';
  if (state.startupOffers.length){
    html += '<h2 class="section-title">Incoming Proposals</h2><div class="grid g-auto">';
    state.startupOffers.forEach(o => {
      const locked = o.locked;
      const buttons = locked
        ? `<div class="btn-row" style="margin-top:12px;">
             <button class="btn gold sm" style="flex:1" onclick="unlockStartup('${o.id}')">▶ Watch ad to unlock</button>
             <button class="btn sm" onclick="rejectStartup('${o.id}')">Pass</button>
           </div>`
        : `<div class="btn-row" style="margin-top:12px;">
             <button class="btn buy sm" onclick="investStartup('${o.id}')">Invest ${fmtMoneyShort(o.ask)}</button>
             <button class="btn blue sm" onclick="negotiateStartup('${o.id}')">Negotiate</button>
             <button class="btn sm" onclick="rejectStartup('${o.id}')">Pass</button>
           </div>`;
      html += `<div class="card ${o.premium?'accent-gold premium-card':'accent-blue'} ${locked?'locked-round':''}">
        <h4>${o.name} ${o.premium?'<span class="premium-tag">★ EXCLUSIVE</span>':''}</h4>
        <div class="meta">Founder: ${o.founder} · ${o.sector}</div>
        <div class="kv"><span class="k">Valuation</span><span class="v mono">${fmtMoneyShort(o.valuation)}</span></div>
        <div class="kv"><span class="k">Seeking</span><span class="v mono gold">${locked?'🔒 Locked':fmtMoneyShort(o.ask)}</span></div>
        <div class="kv"><span class="k">Equity Offered</span><span class="v">${(o.equity*100).toFixed(1)}%</span></div>
        <div class="kv"><span class="k">Risk</span><span class="v"><span class="badge risk-${o.risk}">${['','Low','Low','Medium','High','Very High'][o.risk]}</span></span></div>
        <div class="kv"><span class="k">Potential</span><span class="v gold">${['','Low','Modest','Good','High','Very High'][o.potential]}</span></div>
        ${buttons}</div>`;
    });
    html += '</div>';
  }
  html += '<h2 class="section-title" style="margin-top:20px;">Venture Portfolio</h2>';
  const active = state.startups.filter(s=>s.status!=='exited');
  if (!active.length) html += '<div class="empty">No active venture investments. Wait for proposals to arrive.</div>';
  else {
    html += '<div class="grid g-auto">';
    active.forEach(su => {
      const mul = su.value/su.invested;
      const statusColor = su.status==='failed'?'var(--red)':su.status==='operating'?'var(--green)':'var(--blue)';
      html += `<div class="card">
        <h4>${su.name} <span class="badge" style="color:${statusColor}">${su.status}</span></h4>
        <div class="meta">${su.sector} · Founder ${su.founder}</div>
        <div class="kv"><span class="k">Invested</span><span class="v mono">${fmtMoneyShort(su.invested)}</span></div>
        <div class="kv"><span class="k">Current Value</span><span class="v mono ${mul>=1?'pos':'neg'}">${fmtMoneyShort(su.value)} (${mul.toFixed(1)}×)</span></div>
        <div class="kv"><span class="k">Valuation</span><span class="v mono">${fmtMoneyShort(su.value/su.equity)}</span></div>
        ${su.income>0?`<div class="kv"><span class="k">Income</span><span class="v pos mono">+${fmtMoneyShort(su.income)}/s</span></div>`:''}
        <div class="meta" style="margin-top:8px;">Age: ${su.age} cycles</div>
      </div>`;
    });
    html += '</div>';
  }
  wrap.innerHTML = html;
}

/* ---------- IPOs ---------- */
function renderIPOs(){
  const wrap = $('ipos-wrap'); if (!wrap) return;
  if (state.netWorth < 250000){ wrap.innerHTML = lockedCard('🔔','IPO Access Locked','Reach $250K net worth to participate in initial public offerings.'); return; }
  if (!state.ipos.length){ wrap.innerHTML = '<div class="empty">No IPOs on the calendar. New offerings appear as the market evolves.</div>'; return; }
  let html = '<div class="grid g-auto">';
  state.ipos.forEach(ipo => {
    const subscribed = ipo.status==='subscribed';
    html += `<div class="card accent-gold">
      <h4>${ipo.name} ${subscribed?'<span class="badge" style="color:var(--green)">Subscribed</span>':''}</h4>
      <div class="meta">${ipo.sector} · Valuation ${fmtMoneyShort(ipo.valuation)}</div>
      <div class="kv"><span class="k">Share Price</span><span class="v mono">${fmtMoney(ipo.sharePrice,2)}</span></div>
      <div class="kv"><span class="k">Your Allocation</span><span class="v mono">${fmtNum(ipo.allocation)} shares</span></div>
      <div class="kv"><span class="k">Hype</span><span class="v gold">${'★'.repeat(Math.round(ipo.hype*5))||'—'}</span></div>
      <div class="kv"><span class="k">Lists in</span><span class="v mono">${ipo.countdown} cycles</span></div>
      ${subscribed
        ? `<div class="kv"><span class="k">Committed</span><span class="v mono gold">${fmtMoneyShort(ipo.costBasis)}</span></div>`
        : `<div class="btn-row" style="margin-top:12px;">
            <input class="trade-input mono" id="ipo-q-${ipo.id}" type="number" value="${ipo.allocation}" style="flex:1">
            <button class="btn gold sm" onclick="subscribeIPO('${ipo.id}', parseInt(document.getElementById('ipo-q-${ipo.id}').value)||0)">Subscribe</button>
          </div>`}
    </div>`;
  });
  html += '</div>';
  wrap.innerHTML = html;
}

/* ---------- DEALS ---------- */
function renderDeals(){
  const wrap = $('deals-wrap'); if (!wrap) return;
  if (!dealsUnlocked()){ wrap.innerHTML = lockedCard('🤝','Investor Network Locked','Reach $50M net worth to enter the elite private deal network.'); return; }
  let html = '';
  if (state.dealOffers.length){
    html += '<h2 class="section-title">Private Opportunities</h2><div class="grid g-auto">';
    state.dealOffers.forEach(o => {
      html += `<div class="card accent-gold">
        <h4>${o.type}</h4><div class="meta">Exclusive · Invitation only</div>
        <div class="kv"><span class="k">Commitment</span><span class="v mono gold">${fmtMoneyShort(o.size)}</span></div>
        <div class="kv"><span class="k">Expected Return</span><span class="v pos">${o.expectedReturn.toFixed(2)}×</span></div>
        <div class="kv"><span class="k">Risk of Loss</span><span class="v neg">${(o.failChance*100).toFixed(0)}%</span></div>
        <div class="kv"><span class="k">Horizon</span><span class="v">${o.duration} cycles</span></div>
        ${o.passive?`<div class="kv"><span class="k">Passive</span><span class="v pos">+${fmtMoneyShort(o.passive)}/s</span></div>`:''}
        <div class="btn-row" style="margin-top:12px;">
          <button class="btn gold sm" onclick="acceptDeal('${o.id}')">Commit Capital</button>
          <button class="btn sm" onclick="rejectDeal('${o.id}')">Decline</button>
        </div></div>`;
    });
    html += '</div>';
  }
  html += '<h2 class="section-title" style="margin-top:20px;">Active Deals</h2>';
  if (!state.deals.length) html += '<div class="empty">No active private deals.</div>';
  else {
    html += '<div class="grid g-auto">';
    state.deals.forEach(d => {
      const mul = d.value/d.invested;
      html += `<div class="card">
        <h4>${d.type}</h4>
        <div class="kv"><span class="k">Invested</span><span class="v mono">${fmtMoneyShort(d.invested)}</span></div>
        <div class="kv"><span class="k">Current</span><span class="v mono ${mul>=1?'pos':'neg'}">${fmtMoneyShort(d.value)} (${mul.toFixed(2)}×)</span></div>
        <div class="pill-progress"><div style="width:${clamp(d.age/d.duration*100,0,100)}%"></div></div>
        <div class="meta" style="margin-top:8px;">${d.age}/${d.duration} cycles</div>
      </div>`;
    });
    html += '</div>';
  }
  wrap.innerHTML = html;
}

/* ---------- ACQUISITIONS ---------- */
function renderAcquisitions(){
  const wrap = $('acq-wrap'); if (!wrap) return;
  if (!acquisitionsUnlocked()){ wrap.innerHTML = lockedCard('🏢','Acquisitions Locked','Reach $50M net worth (or level 50) to acquire companies outright.'); return; }
  let html = '';
  if (state.ownedCompanies.length){
    html += '<h2 class="section-title">Your Companies</h2><div class="grid g-auto">';
    state.ownedCompanies.forEach(o => {
      const sec = SECTORS[o.sector];
      html += `<div class="card accent-gold">
        <h4>${o.name} <span class="badge" style="color:${sec.color}">${o.ticker}</span></h4>
        <div class="meta">${sec.name}</div>
        <div class="kv"><span class="k">Value</span><span class="v mono">${fmtMoneyShort(o.value)}</span></div>
        <div class="kv"><span class="k">Income</span><span class="v pos mono">+${fmtMoneyShort(o.income)}/s</span></div>
        <div class="kv"><span class="k">CEO</span><span class="v">${o.ceo?'Hired ✓':'—'}</span></div>
        <div class="kv"><span class="k">Eff / R&D / Global</span><span class="v">${o.efficiency-1} / ${o.rnd} / ${o.global}</span></div>
        <div class="btn-row" style="margin-top:12px;">
          ${!o.ceo?`<button class="btn sm blue" onclick="upgradeOwned('${o.ticker}','ceo')">Hire CEO</button>`:''}
          <button class="btn sm" onclick="upgradeOwned('${o.ticker}','efficiency')">Efficiency</button>
          <button class="btn sm" onclick="upgradeOwned('${o.ticker}','rnd')">R&D</button>
          <button class="btn sm gold" onclick="upgradeOwned('${o.ticker}','global')">Expand</button>
        </div></div>`;
    });
    html += '</div>';
  }
  html += '<h2 class="section-title" style="margin-top:20px;">Acquisition Targets</h2><div class="grid g-auto">';
  acquirableCompanies().slice(0,18).forEach(c => {
    const price = acquisitionPrice(c);
    const sec = SECTORS[c.sector];
    const can = price <= state.cash;
    html += `<div class="card">
      <h4>${c.name} <span class="badge" style="color:${sec.color}">${c.ticker}</span></h4>
      <div class="meta">${sec.name} · Mcap ${fmtMoneyShort(c.mcap)}</div>
      <div class="kv"><span class="k">Acquisition Price</span><span class="v mono gold">${fmtMoneyShort(price)}</span></div>
      <div class="kv"><span class="k">Est. Income</span><span class="v pos mono">+${fmtMoneyShort(price*0.0004)}/s</span></div>
      <button class="btn ${can?'gold':''} sm" style="margin-top:10px;width:100%" ${can?'':'disabled'} onclick="acquireCompany('${c.ticker}')">${can?'Acquire':'Need '+fmtMoneyShort(price)}</button>
    </div>`;
  });
  html += '</div>';
  wrap.innerHTML = html;
}

/* ---------- HEDGE FUND ---------- */
function renderHedgeFund(){
  const wrap = $('hf-wrap'); if (!wrap) return;
  if (!hedgeFundUnlocked()){ wrap.innerHTML = lockedCard('🏦','Hedge Fund Locked','Reach $1B net worth (or level 75) to launch your own hedge fund.'); return; }
  const hf = state.hedgeFund;
  if (!hf.created){
    wrap.innerHTML = `<div class="panel"><div class="panel-body" style="text-align:center;padding:40px;">
      <h3 style="font-size:20px;margin-bottom:8px;">Launch Your Hedge Fund</h3>
      <p class="muted" style="margin-bottom:18px;">Seed with ${fmtMoneyShort(50e6)} to begin accepting outside capital and charging fees.</p>
      <input class="trade-input" id="hf-name" placeholder="Fund name (e.g. Apex Capital Partners)" style="max-width:340px;margin:0 auto 14px;">
      <div><button class="btn gold" onclick="createHedgeFund(document.getElementById('hf-name').value)">Launch Fund · ${fmtMoneyShort(50e6)}</button></div>
    </div></div>`;
    return;
  }
  wrap.innerHTML = `
    <div class="grid g-3">
      <div class="panel accent-gold"><div class="panel-body"><div class="stat"><span class="label">Assets Under Management</span><span class="value big mono gold">${fmtMoneyShort(hf.aum)}</span></div></div></div>
      <div class="panel"><div class="panel-body"><div class="stat"><span class="label">Investors</span><span class="value big mono">${fmtNum(hf.investors)}</span></div></div></div>
      <div class="panel"><div class="panel-body"><div class="stat"><span class="label">Fee Income / sec</span><span class="value big mono pos">+${fmtMoneyShort(hedgeFundIncome(state))}</span></div></div></div>
    </div>
    <div class="panel" style="margin-top:16px;"><div class="panel-head"><h3>${hf.name}</h3><span class="sub">Reputation ${hf.reputation.toFixed(0)}/100</span></div>
      <div class="panel-body">
        <div class="kv"><span class="k">Monthly Return</span><span class="v pos">${(hf.monthlyReturn*100).toFixed(2)}%</span></div>
        <div class="kv"><span class="k">Analysts</span><span class="v">${hf.analysts}</span></div>
        <div class="kv"><span class="k">Traders</span><span class="v">${hf.traders}</span></div>
        <div class="kv"><span class="k">Management Fee</span><span class="v">2% AUM</span></div>
        <div class="kv"><span class="k">Performance Fee</span><span class="v">20% profits</span></div>
        <div class="btn-row" style="margin-top:14px;">
          <button class="btn blue" onclick="hireHF('analyst')">Hire Analyst · ${fmtMoneyShort(2e6)}</button>
          <button class="btn blue" onclick="hireHF('trader')">Hire Trader · ${fmtMoneyShort(5e6)}</button>
        </div>
      </div></div>`;
}

/* ---------- EMPIRE ---------- */
function renderEmpire(){
  const wrap = $('empire-wrap'); if (!wrap) return;
  if (!empireUnlocked()){ wrap.innerHTML = lockedCard('🌐','Global Finance Locked','Reach $100B net worth to control industries, finance governments, and reshape the global economy.'); return; }
  const e = state.empire;
  const acts = [
    { a:'etf', name:'Launch ETF', owned:e.etfs, desc:'Create a new exchange-traded fund', repeat:true },
    { a:'investmentBank', name:'Investment Bank', owned:e.investmentBank?1:0, desc:'Underwrite deals worldwide' },
    { a:'privateBank', name:'Private Bank', owned:e.privateBank?1:0, desc:'Serve ultra-high-net-worth clients' },
    { a:'vcFirm', name:'Venture Capital Firm', owned:e.vcFirm?1:0, desc:'Fund the next generation' },
    { a:'financeGovt', name:'Finance a Government', owned:e.governmentsFinanced, desc:'Purchase national debt, gain influence', repeat:true },
    { a:'controlIndustry', name:'Control an Industry', owned:e.industriesControlled, desc:'Dominate an entire sector', repeat:true },
  ].map(x => ({ ...x, cost: empireCost(x.a) }));
  let html = `<div class="panel accent-gold"><div class="panel-body" style="text-align:center;">
    <h3 style="font-size:22px;" class="gold">Financial Empire</h3>
    <p class="muted">You started with $10,000. You now command ${fmtMoney(state.netWorth)}.</p>
    <div class="kv" style="border:none;justify-content:center;gap:30px;margin-top:10px;">
      <span>ETFs: <b class="gold">${e.etfs}</b></span>
      <span>Governments: <b class="gold">${e.governmentsFinanced}</b></span>
      <span>Industries: <b class="gold">${e.industriesControlled}</b></span>
      <span>Empire passive: <b class="pos">+${fmtMoneyShort(e.passive)}/s</b></span>
    </div></div></div><div class="grid g-auto" style="margin-top:16px;">`;
  acts.forEach(x => {
    const ownedOneTime = !x.repeat && x.owned;
    const can = !ownedOneTime && x.cost <= state.cash;
    const yld = x.cost * EMPIRE_YIELD[x.a] * ((typeof prestigeTycoonMult==='function')?prestigeTycoonMult():1);
    const btn = ownedOneTime
      ? `<button class="btn sm" style="width:100%;margin-top:10px;" disabled>Owned ✓</button>`
      : `<button class="btn ${can?'gold':''} sm" style="width:100%;margin-top:10px;" ${can?'':'disabled'} onclick="empireAction('${x.a}')">${can?(x.repeat&&x.owned?'Build Another':'Execute'):'Need '+fmtMoneyShort(x.cost)}</button>`;
    html += `<div class="card">
      <h4>${x.name} ${x.owned?`<span class="badge gold">×${x.owned}</span>`:''}</h4>
      <div class="meta">${x.desc}</div>
      <div class="kv"><span class="k">Cost</span><span class="v mono gold">${fmtMoneyShort(x.cost)}</span></div>
      <div class="kv"><span class="k">Adds Passive</span><span class="v pos mono">+${fmtMoneyShort(yld)}/s</span></div>
      ${btn}
    </div>`;
  });
  html += '</div>';
  wrap.innerHTML = html;
}

/* ---------- RANKINGS ---------- */
const RIVALS = [
  { name:'Marcus Sterling', base:185e9 }, { name:'Vivian Cross', base:142e9 },
  { name:'Kenji Watanabe', base:98e9 }, { name:'Aleksandr Volkov', base:67e9 },
  { name:'Isabella Moreau', base:41e9 }, { name:'Raj Malhotra', base:22e9 },
  { name:'Greta Lindqvist', base:9.5e9 }, { name:'Diego Fuentes', base:3.2e9 },
  { name:'Hannah Goldberg', base:780e6 }, { name:'Yusuf Demir', base:210e6 },
  { name:'Chen Wei', base:54e6 }, { name:'Olivia Brooks', base:12e6 },
  { name:'Tom Becker', base:2.4e6 }, { name:'Aisha Khan', base:480e3 },
];
function renderRankings(){
  const list = [...RIVALS.map((r,i)=>({ name:r.name, worth:r.base*(1+Math.sin(state.tick/50+i)*0.05) })),
    { name:'YOU', worth:state.netWorth, you:true }];
  list.sort((a,b)=>b.worth-a.worth);
  const wrap = $('rank-list'); wrap.innerHTML = '';
  list.forEach((r,i) => {
    const row = el('div', 'rank-row' + (r.you?' you':''));
    row.innerHTML = `<div class="rpos">#${i+1}</div><div class="rn">${r.you?'<b class="gold">YOU</b>':r.name}</div><div class="rw mono">${fmtMoneyShort(r.worth)}</div>`;
    wrap.appendChild(row);
  });
  const pg = $('rank-progress');
  let next = MILESTONES.find(m=>!state.milestonesHit[m.tag]);
  let pgHtml = `<div class="stat" style="margin-bottom:16px;"><span class="label">Current Rank</span><span class="value big gold">${state.rankName}</span></div>`;
  if (next){
    const prev = MILESTONES[MILESTONES.indexOf(next)-1];
    const lo = prev?prev.v:10000;
    const pct = clamp((state.netWorth-lo)/(next.v-lo)*100,0,100);
    pgHtml += `<div class="label">Next: ${next.rank} (${next.tag})</div>
      <div class="pill-progress" style="height:8px;margin:8px 0;"><div style="width:${pct}%"></div></div>
      <div class="muted mono">${fmtMoneyShort(state.netWorth)} / ${fmtMoneyShort(next.v)}</div>`;
  } else pgHtml += `<div class="gold">You have reached the pinnacle of finance.</div>`;
  pgHtml += `<div class="kv" style="margin-top:14px;"><span class="k">Best Win Streak</span><span class="v gold">${state.stats.bestStreak}×</span></div>`;
  pgHtml += '<h2 class="section-title" style="margin-top:24px;">Level Unlocks</h2>';
  Object.keys(LEVEL_UNLOCKS).forEach(L => {
    const u = LEVEL_UNLOCKS[L]; const got = state.level>=L;
    pgHtml += `<div class="kv"><span class="k ${got?'pos':''}">${got?'✓':'·'} Lvl ${L}</span><span class="v ${got?'':'dim'}">${u.name}</span></div>`;
  });
  pg.innerHTML = pgHtml;
}

/* ---------- ACHIEVEMENTS ---------- */
function renderAchievements(){
  const grid = $('ach-grid'); if (!grid) return;
  const done = ACHIEVEMENTS.filter(a=>state.achievements[a.id]).length;
  $('ach-count').textContent = `${done} / ${ACHIEVEMENTS.length} unlocked`;
  grid.innerHTML = '';
  const sorted = [...ACHIEVEMENTS].sort((a,b)=>(state.achievements[b.id]?1:0)-(state.achievements[a.id]?1:0));
  sorted.forEach(a => {
    const got = state.achievements[a.id];
    const node = el('div', 'ach'+(got?' done':''));
    node.innerHTML = `<div class="medal">${got?'★':'·'}</div><div class="ad"><h5>${a.name}</h5><p>${a.desc}</p></div>`;
    grid.appendChild(node);
  });
}

/* ---------- helpers ---------- */
function lockedCard(icon, title, text){
  return `<div class="locked-state"><div class="lock-ic">${icon}</div><h3>${title}</h3><p>${text}</p></div>`;
}
function hexA(hex, a){ const n = parseInt(hex.slice(1),16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }

/* ============================================================
   CHART TIMEFRAMES + AGGREGATION
   ============================================================ */
const TIMEFRAMES = {
  '1D':  { agg: 1,  bars: 40 },
  '1W':  { agg: 3,  bars: 48 },
  '1M':  { agg: 8,  bars: 54 },
  '1Y':  { agg: 22, bars: 56 },
  'ALL': { agg: 0,  bars: 60 },
};
function aggregateHistory(hist, tfKey){
  const tf = TIMEFRAMES[tfKey] || TIMEFRAMES['1W'];
  let agg = tf.agg;
  if (tfKey === 'ALL') agg = Math.max(1, Math.ceil(hist.length / tf.bars));
  if (agg <= 1) return hist.slice(-tf.bars);
  const out = [];
  for (let end = hist.length; end > 0 && out.length < tf.bars; end -= agg){
    const start = Math.max(0, end - agg);
    const chunk = hist.slice(start, end);
    if (!chunk.length) break;
    out.unshift({ o: chunk[0].o, c: chunk[chunk.length-1].c, h: Math.max(...chunk.map(d=>d.h)), l: Math.min(...chunk.map(d=>d.l)) });
  }
  return out;
}

/* ============================================================
   CHARTS
   ============================================================ */
let _candleScale = null;   // eased vertical zoom, keyed by ticker|timeframe

/* "nice" round axis step (1 / 2 / 5 × 10^n) → clean gridline numbers */
function niceStep(raw){
  if (!isFinite(raw) || raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  const f = raw / base;
  const nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  return nf * base;
}
/* Decimals matched to the gridline STEP. niceStep only ever yields
   1/2/5 × 10ⁿ, so every step ≥ 1 is a whole number → no trailing ".0". */
function axisDecimals(step){
  if (step >= 1)   return 0;
  if (step >= 0.1) return 1;
  if (step >= 0.01) return 2;
  return 3;
}
/* gridline label: compact millions/billions, separators for thousands,
   clean decimals for share prices. */
function fmtAxisNum(v, dec){
  const a = Math.abs(v);
  if (a >= 1e6)  return fmtShort(v);                       // 1.20M / 3.4B
  if (a >= 1000) return Math.round(v).toLocaleString('en-US');
  return v.toFixed(dec);
}
function roundRectPath(ctx, x, y, wd, ht, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+wd, y, x+wd, y+ht, r);
  ctx.arcTo(x+wd, y+ht, x, y+ht, r);
  ctx.arcTo(x, y+ht, x, y, r);
  ctx.arcTo(x, y, x+wd, y, r);
  ctx.closePath();
}

function sizeCanvas(cv){
  const ratio = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.height;
  cv.width = w*ratio; cv.style.height = h+'px';
  const ctx = cv.getContext('2d'); ctx.setTransform(ratio,0,0,ratio,0,0);
  return { ctx, w, h };
}

function drawLineChart(id, data){
  const cv = $(id); if (!cv || !data.length) return;
  const { ctx, w, h } = sizeCanvas(cv);
  ctx.clearRect(0,0,w,h);
  const min = Math.min(...data), max = Math.max(...data), range = (max-min)||1;
  const padTop = 12, padBot = 12, padR = 56, padL = 8;
  const axisX = w - padR;
  const X = i => padL + i/(data.length-1)*(w-padL-padR);
  const Y = v => padTop + (1-(v-min)/range)*(h-padTop-padBot);
  const last = data[data.length-1];
  const up = last >= data[0];
  const c = up?themeColor('--green'):themeColor('--red');

  // faint price-axis gutter + divider for a clean terminal look
  ctx.fillStyle = hexToRgba(themeColor('--panel-2'), .55);
  ctx.fillRect(axisX, 0, w-axisX, h);
  ctx.strokeStyle = themeColor('--border'); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(axisX, 0); ctx.lineTo(axisX, h); ctx.stroke();

  // gridlines + right-aligned round numbers
  ctx.font = '600 10px "JetBrains Mono", ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  const lstep = niceStep(range / 4);
  const ldec = axisDecimals(lstep);
  const lastY = Y(last);
  for (let v = Math.ceil(min/lstep)*lstep; v <= max; v += lstep){
    const y = Y(v);
    ctx.strokeStyle = themeColor('--grid');
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(axisX, y); ctx.stroke();
    if (Math.abs(y - lastY) < 11) continue;     // don't collide with the live tag
    ctx.fillStyle = themeColor('--muted');
    ctx.textAlign = 'right';
    ctx.fillText(fmtAxisNum(v, ldec), w-6, y);
  }

  const grad = ctx.createLinearGradient(0,padTop,0,h-padBot);
  grad.addColorStop(0, hexToRgba(c,.22)); grad.addColorStop(1, hexToRgba(c,0));
  ctx.beginPath(); ctx.moveTo(X(0), Y(data[0])); data.forEach((v,i)=>ctx.lineTo(X(i),Y(v)));
  ctx.lineTo(X(data.length-1), h-padBot); ctx.lineTo(X(0), h-padBot); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath(); ctx.moveTo(X(0), Y(data[0])); data.forEach((v,i)=>ctx.lineTo(X(i),Y(v)));
  ctx.strokeStyle = c; ctx.lineWidth=2; ctx.stroke();

  // live last-value: dashed guide, pulsing dot, price tag in the gutter
  ctx.strokeStyle = hexToRgba(c, .5); ctx.lineWidth = 1; ctx.setLineDash([3,3]);
  ctx.beginPath(); ctx.moveTo(padL, lastY); ctx.lineTo(axisX, lastY); ctx.stroke(); ctx.setLineDash([]);
  const pulse = 5 + 1.8*Math.sin(Date.now()/350);
  ctx.fillStyle = hexToRgba(c, .16); ctx.beginPath(); ctx.arc(X(data.length-1), lastY, pulse, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(X(data.length-1), lastY, 2.6, 0, Math.PI*2); ctx.fill();
  roundRectPath(ctx, axisX + 3, lastY - 9, padR - 6, 18, 4);
  ctx.fillStyle = c; ctx.fill();
  ctx.fillStyle = themeColor('--bg'); ctx.font = 'bold 10px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(fmtAxisNum(last, axisDecimals(lstep)), w - 7, lastY);
}

function drawCandles(id, rawHist){
  const cv = $(id); if (!cv || !rawHist || !rawHist.length) return;
  const all = aggregateHistory(rawHist, chartTF);
  if (!all.length) return;
  const { ctx, w, h } = sizeCanvas(cv);
  ctx.clearRect(0,0,w,h);

  const padTop = 14, padBot = 14, padR = 64, padL = 10;
  const plotW = w - padL - padR, plotH = h - padTop - padBot;
  const cx = padL + plotW;                  // x of the price axis
  const centerX = padL + plotW * 0.5;       // the latest candle lives here

  // Comfortable candle pitch. The newest candle sits at the horizontal centre
  // and history scrolls off to its left, leaving "future" room on the right —
  // so the chart always tracks (follows) the last bar.
  const slot = clamp(plotW / 52, 7, 16);
  const bw = Math.max(2, Math.min(15, slot * 0.62));
  const visN = Math.min(all.length, Math.floor((centerX - padL) / slot) + 2);
  const data = all.slice(all.length - visN);

  const lastCandle = data[data.length-1];
  const last = lastCandle.c;
  const hiMax = Math.max(...data.map(d=>d.h));
  const loMin = Math.min(...data.map(d=>d.l));

  // Vertical: fit the *visible* candles to the full height with even padding
  // (eased) so they fill the chart and never get squashed into one half.
  const vpad = (hiMax - loMin) * 0.14 || last * 0.04 || 1;
  const tMax = hiMax + vpad, tMin = loMin - vpad;
  const key = (selectedTicker || id) + '|' + chartTF;
  if (!_candleScale || _candleScale.key !== key){
    _candleScale = { key, min: tMin, max: tMax };
  } else {
    // Expand INSTANTLY so a big climb/fall (and the newest candle) is always
    // framed — the chart never loses the last bar. Contract slowly so the
    // axis glides back without jittering as tall bars scroll off the left.
    _candleScale.min = Math.min(_candleScale.min + (tMin - _candleScale.min) * 0.18, tMin);
    _candleScale.max = Math.max(_candleScale.max + (tMax - _candleScale.max) * 0.18, tMax);
  }
  const min = _candleScale.min, max = _candleScale.max, range = (max - min) || 1;
  const Y = v => padTop + (1-(v-min)/range)*plotH;
  const lastY = Y(last);

  const gC = themeColor('--green'), rC = themeColor('--red');
  const lastUp = lastCandle.c >= lastCandle.o;
  const tagC = lastUp ? gC : rC;

  // ---- faint price-axis gutter + divider ----
  ctx.fillStyle = hexToRgba(themeColor('--panel-2'), .55);
  ctx.fillRect(cx, 0, w - cx, h);
  ctx.strokeStyle = themeColor('--border'); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();

  // ---- gridlines with clean, right-aligned round numbers ----
  const step = niceStep(range / 4.5);
  const dec = axisDecimals(step);
  ctx.font = '600 10px "JetBrains Mono", ui-monospace, monospace';
  ctx.textBaseline = 'middle'; ctx.lineWidth = 1;
  for (let v = Math.ceil(min/step)*step; v <= max; v += step){
    const y = Y(v);
    if (y < padTop-0.5 || y > h-padBot+0.5) continue;
    ctx.strokeStyle = themeColor('--grid');
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(cx, y); ctx.stroke();
    if (Math.abs(y - lastY) < 11) continue;     // skip labels behind the live tag
    ctx.fillStyle = themeColor('--muted'); ctx.textAlign = 'right';
    ctx.fillText(fmtAxisNum(v, dec), w - 6, y);
  }

  // ---- candles: newest at centre, older ones marching left ----
  for (let i = data.length-1; i >= 0; i--){
    const x = centerX - (data.length-1 - i) * slot;
    if (x < padL - slot) break;             // scrolled off the left edge
    const d = data[i], up = d.c >= d.o;
    ctx.strokeStyle = up?gC:rC; ctx.fillStyle = up?gC:rC; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, Y(d.h)); ctx.lineTo(x, Y(d.l)); ctx.stroke();
    const yo = Y(d.o), yc = Y(d.c);
    ctx.fillRect(x-bw/2, Math.min(yo,yc), bw, Math.max(2, Math.abs(yc-yo)));
  }

  // ---- Advanced Charts unlock (lvl 10): 20-period moving-average line ----
  if (typeof state !== 'undefined' && state && state.unlockedFeatures && state.unlockedFeatures.advancedCharts){
    const win = Math.min(20, data.length);
    if (win >= 2){
      ctx.strokeStyle = hexToRgba(themeColor('--gold'), .85); ctx.lineWidth = 1.5;
      ctx.beginPath(); let started = false;
      for (let i = 0; i < data.length; i++){
        if (i < win-1) continue;
        let sum = 0; for (let j = i-win+1; j <= i; j++) sum += data[j].c;
        const x = centerX - (data.length-1 - i) * slot;
        if (x < padL - slot) continue;
        const y = Y(sum/win);
        if (!started){ ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = hexToRgba(themeColor('--gold'), .9); ctx.font = '700 9px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('MA20', padL + 2, padTop + 2);
    }
  }

  // ---- centre guide + last-price line + pulsing marker + price tag ----
  ctx.strokeStyle = hexToRgba(tagC, .16); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(centerX, padTop); ctx.lineTo(centerX, h-padBot); ctx.stroke();
  ctx.strokeStyle = hexToRgba(tagC, .55); ctx.setLineDash([3,3]);
  ctx.beginPath(); ctx.moveTo(padL, lastY); ctx.lineTo(cx, lastY); ctx.stroke(); ctx.setLineDash([]);
  const pulse = 6 + 2*Math.sin(Date.now()/350);
  ctx.fillStyle = hexToRgba(tagC, .16); ctx.beginPath(); ctx.arc(centerX, lastY, pulse, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = tagC; ctx.beginPath(); ctx.arc(centerX, lastY, 3, 0, Math.PI*2); ctx.fill();

  const tagText = last >= 1e6 ? fmtShort(last) : last >= 1000 ? Math.round(last).toLocaleString('en-US') : last.toFixed(2);
  roundRectPath(ctx, cx + 3, lastY - 9, padR - 6, 18, 4);
  ctx.fillStyle = tagC; ctx.fill();
  ctx.fillStyle = themeColor('--bg'); ctx.font = 'bold 10px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(tagText, w - 7, lastY);

  const px = $('trade-lastpx');
  if (px){ const first = data[0].o, chg = (last/first-1); px.innerHTML = `${fmtMoney(last,2)} <span class="${chg>=0?'pos':'neg'}">${fmtPct(chg)}</span> <span class="muted">· ${chartTF}</span>`; }
}

function hexToRgba(col, a){
  col = col.trim();
  if (col.startsWith('#')){ const n = parseInt(col.slice(1),16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }
  if (col.startsWith('rgb')){ const nums = col.match(/[\d.]+/g); return `rgba(${nums[0]},${nums[1]},${nums[2]},${a})`; }
  return col;
}

/* ============================================================
   OVERLAYS
   ============================================================ */
function toast(msg, kind){ const t = el('div', 'toast '+(kind||''), msg); $('toasts').appendChild(t); setTimeout(()=>t.remove(), 3700); }
function floatProfit(text, loss){ const f = el('div', 'floater'+(loss?' loss':''), text); $('floaters').appendChild(f); setTimeout(()=>f.remove(), 2400); }

function showStreak(n, mult){
  const s = $('streak-pop');
  s.innerHTML = `<div class="sp-flame">🔥</div><div><div class="sp-n">${n}× STREAK</div><div class="sp-m">${mult.toFixed(2)}× XP</div></div>`;
  s.classList.remove('show'); void s.offsetWidth; s.classList.add('show');
  clearTimeout(showStreak._t); showStreak._t = setTimeout(()=>s.classList.remove('show'), 1600);
}

function milestoneCelebration(m){
  $('cele-tag').textContent = m.tag;
  $('cele-rank').textContent = m.rank;
  $('cele-sub').textContent = 'New Wealth Rank Achieved';
  $('cele-tag').style.fontSize = '';
  const c = $('celebration'); c.classList.add('show');
  if (typeof burstConfetti==='function'){ burstConfetti({count:180}); setTimeout(()=>burstConfetti({count:120}), 400); }
  sfxSafe('milestone');
  toast('Milestone: ' + m.tag + ' — ' + m.rank, 'gold');
  // Let the platform celebrate too, and show a midgame ad at this natural
  // break — only from $1M up, so the early game stays ad-free.
  if (typeof CG !== 'undefined'){ CG.happytime(); if (m.v >= 1e6) CG.midgame(); }
  setTimeout(()=>c.classList.remove('show'), 3400);
}

function fullEvent(tag, sub){
  const c = $('celebration');
  if (c.classList.contains('show')) return;
  $('cele-tag').textContent = tag; $('cele-rank').textContent = ''; $('cele-sub').textContent = sub;
  // Responsive sizing so long event tags ("HEDGE FUND LAUNCHED") never overflow.
  $('cele-tag').style.fontSize = tag.length>10 ? 'clamp(26px,7vw,42px)' : 'clamp(34px,9vw,60px)';
  c.classList.add('show');
  if (typeof burstConfetti==='function') burstConfetti({count:70});
  setTimeout(()=>{ c.classList.remove('show'); $('cele-tag').style.fontSize=''; }, 2200);
}

let achPopTimer = null;
function achievementPopup(a){
  $('achpop-name').textContent = a.name;
  const p = $('achpop'); p.classList.remove('show'); void p.offsetWidth; p.classList.add('show');
  sfxSafe('coin');
  clearTimeout(achPopTimer);
  achPopTimer = setTimeout(()=>p.classList.remove('show'), 3400);
}

function showModal(html){ $('modal').innerHTML = html; $('modal-bg').classList.add('show'); }
function closeModal(){ $('modal-bg').classList.remove('show'); }

/* ---------- VIEW DISPATCH ---------- */
function renderView(view){
  switch(view){
    case 'dashboard': renderDashboard(); break;
    case 'market': if(!$('market-body').children.length) rebuildMarketTable(); renderScanner(); renderTradePanel(); drawSparklines(); break;
    case 'portfolio': renderPortfolio(); break;
    case 'boosts': renderBoosts(); break;
    case 'startups': renderStartups(); break;
    case 'ipos': renderIPOs(); break;
    case 'deals': renderDeals(); break;
    case 'acquisitions': renderAcquisitions(); break;
    case 'hedgefund': renderHedgeFund(); break;
    case 'empire': renderEmpire(); break;
    case 'legacy': renderPrestige(); break;
    case 'rankings': renderRankings(); break;
    case 'achievements': renderAchievements(); break;
  }
}

function renderAll(){
  renderTopbar();
  updateNavBadges();
  if (currentView==='dashboard') renderDashboard();
  else if (currentView==='market'){ updateMarketPrices(); if (state.tick%2===0) drawSparklines(); if (state.tick%4===0) renderScanner(); }
  else if (currentView==='portfolio') renderPortfolio();
  else if (currentView==='rankings') renderRankings();
  else if (currentView==='hedgefund' && state.hedgeFund.created) renderHedgeFund();
}
