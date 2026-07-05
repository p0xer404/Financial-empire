/* ============================================================
   market.js  —  Price engine, regimes, news, economy ticks,
                 XP / levels, sector unlocks, achievements
   ============================================================ */

const HIST_MAX = 600;   // ticks of price history retained in memory

const REGIMES = {
  bull:      { drift: +0.0015, volMul: 1.0,  next: { normal: .5, bubble: .2, bull: .3 } },
  bear:      { drift: -0.0015, volMul: 1.3,  next: { normal: .5, recession: .25, bear: .25 } },
  normal:    { drift: +0.0003, volMul: 1.0,  next: { bull: .3, bear: .2, normal: .5 } },
  recession: { drift: -0.0030, volMul: 1.6,  next: { recovery: .55, recession: .3, bear: .15 } },
  recovery:  { drift: +0.0025, volMul: 1.1,  next: { bull: .45, normal: .45, recovery: .1 } },
  bubble:    { drift: +0.0040, volMul: 1.4,  next: { normal: .2, crash: .35, bubble: .45 } },
  crash:     { drift: -0.0090, volMul: 2.2,  next: { recovery: .6, recession: .3, crash: .1 } },
};
const REGIME_LABEL = {
  bull: 'Bull Market', bear: 'Bear Market', normal: 'Stable Market',
  recession: 'Recession', recovery: 'Recovery', bubble: 'Bubble', crash: 'Market Crash',
};

function rotateRegime(){
  const m = state.market;
  const cfg = REGIMES[m.regime] || REGIMES.normal;
  const roll = Math.random();
  let acc = 0, chosen = m.regime;
  for (const k in cfg.next){ acc += cfg.next[k]; if (roll <= acc){ chosen = k; break; } }
  if (chosen !== m.regime){
    m.regime = chosen;
    m.regimeTicks = 0;
    if (chosen === 'crash'){ state.stats.crashesSurvived++; if(typeof sfxSafe==='function')sfxSafe('crash'); pushNews('⚠ MARKET CRASH — panic selling sweeps global markets', -0.5, 'global', true); fullEvent('MARKET CRASH', 'Markets in freefall'); }
    else if (chosen === 'recession'){ state.stats.recessionsSeen++; pushNews('Economy slides into recession', -0.2, 'global', true); }
    else if (chosen === 'recovery') pushNews('Markets stage a strong recovery', +0.2, 'global', true);
    else if (chosen === 'bull') pushNews('Bull market roars to life', +0.25, 'global', true);
    else if (chosen === 'bubble') pushNews('Speculative bubble inflates across markets', +0.3, 'global');
    else if (chosen === 'bear') pushNews('Bear market grips investors', -0.2, 'global');
  }
}

function tickMarket(){
  const m = state.market;
  m.regimeTicks++;
  if (m.regimeTicks > randInt(40, 90)) rotateRegime();

  const cfg = REGIMES[m.regime] || REGIMES.normal;
  m.sentiment *= 0.96;

  // Bull Run power-up: strong extra upward drift while active.
  const bullBoost = (typeof boostActive === 'function' && boostActive('bull')) ? 0.005 : 0;
  // Bull Instinct prestige tree: a small permanent upward tailwind.
  const prestigeDrift = (typeof prestigeGrowthBonus === 'function') ? prestigeGrowthBonus() : 0;

  let idxSum = 0, idxCount = 0;
  COMPANIES.forEach(c => {
    c.sentiment *= 0.92;
    const regimeDrift = cfg.drift * c.beta;
    const noise = (Math.random() - 0.5) * 2 * c.vol * cfg.volMul;
    const sentEffect = (m.sentiment * 0.5 + c.sentiment) * 0.02;
    let change = c.drift + regimeDrift + noise + sentEffect + (bullBoost + prestigeDrift) * c.beta;
    change = clamp(change, -0.25, 0.25);

    const open = c.price;
    let price = Math.max(0.5, c.price * (1 + change));
    const hi = Math.max(open, price) * (1 + Math.random() * c.vol * 0.5);
    const lo = Math.min(open, price) * (1 - Math.random() * c.vol * 0.5);
    c.price = price;
    c.history.push({ o: open, h: hi, l: lo, c: price });
    if (c.history.length > HIST_MAX) c.history.shift();

    if (state.unlockedSectors.includes(c.sector)){ idxSum += price / c.basePrice; idxCount++; }
  });

  m.index = idxCount ? 1000 * (idxSum / idxCount) : m.index;
  m.indexHistory.push(m.index);
  if (m.indexHistory.length > HIST_MAX) m.indexHistory.shift();
}

function pushNews(text, impact, scope, big){
  state.news.unshift({ text, impact, scope, big: !!big, tick: state.tick, t: Date.now() });
  if (state.news.length > 40) state.news.pop();
  if (typeof onNews === 'function') onNews(state.news[0]);
}

function generateNews(){
  const roll = Math.random();
  if (roll < 0.45){
    const pool = COMPANIES.filter(c => state.unlockedSectors.includes(c.sector));
    if (!pool.length) return;
    const c = pick(pool);
    const positive = Math.random() < 0.52;
    const tmpl = pick(positive ? NEWS_TEMPLATES.companyPos : NEWS_TEMPLATES.companyNeg);
    const impact = positive ? rand(0.05, 0.22) : -rand(0.05, 0.22);
    c.sentiment += impact * 6;
    pushNews(tmpl.replace('{C}', `${c.name} (${c.ticker})`), impact, 'company');
  } else if (roll < 0.75){
    const secId = pick(state.unlockedSectors);
    const sec = SECTORS[secId];
    const positive = Math.random() < 0.5;
    const tmpl = pick(positive ? NEWS_TEMPLATES.sectorPos : NEWS_TEMPLATES.sectorNeg);
    const impact = positive ? rand(0.04, 0.14) : -rand(0.04, 0.14);
    COMPANIES.filter(c => c.sector === secId).forEach(c => c.sentiment += impact * 4);
    pushNews(tmpl.replace('{S}', sec.name), impact, 'sector');
  } else {
    const g = pick(NEWS_TEMPLATES.global);
    state.market.sentiment = clamp(state.market.sentiment + g.impact, -1, 1);
    pushNews(g.t, g.impact, 'global');
  }
}

const SPECIAL_EVENTS = [
  { name: 'AI Revolution', sector: 'AI', impact: +0.5, msg: 'AI REVOLUTION — artificial intelligence stocks surge' },
  { name: 'Energy Crisis', sector: 'ENERGY', impact: +0.4, msg: 'ENERGY CRISIS — energy prices spike worldwide' },
  { name: 'Defense Boom', sector: 'DEFENSE', impact: +0.45, msg: 'DEFENSE SPENDING BOOM — governments ramp up military budgets' },
  { name: 'Space Explosion', sector: 'SPACE', impact: +0.5, msg: 'SPACE INDUSTRY EXPLOSION — private space race accelerates' },
  { name: 'Biotech Breakthrough', sector: 'BIOTECH', impact: +0.5, msg: 'BIOTECH BREAKTHROUGH — gene therapy stocks soar' },
  { name: 'Housing Bubble', sector: 'BANK', impact: -0.4, msg: 'HOUSING BUBBLE bursts — financial sector reels' },
  { name: 'Rate Shock', sector: null, impact: -0.3, msg: 'INTEREST RATE SHOCK — central banks hike aggressively' },
];

function maybeSpecialEvent(){
  if (!chance(0.015)) return;
  const ev = pick(SPECIAL_EVENTS);
  if (ev.sector && !state.unlockedSectors.includes(ev.sector)) return;
  if (ev.sector){
    COMPANIES.filter(c => c.sector === ev.sector).forEach(c => c.sentiment += ev.impact * 8);
  } else {
    state.market.sentiment = clamp(state.market.sentiment + ev.impact, -1, 1);
  }
  if(typeof sfxSafe==='function')sfxSafe('event');
  pushNews('★ ' + ev.msg, ev.impact, 'global', true);
  fullEvent(ev.name, ev.msg);
}

function maybeBlackSwan(){
  if (!chance(0.0015)) return;
  const swans = [
    () => { state.stats.blackSwans++; COMPANIES.forEach(c => c.sentiment -= rand(8, 16)); state.market.sentiment = -1; pushNews('🦢 BLACK SWAN — global financial collapse underway', -0.9, 'global', true); fullEvent('BLACK SWAN', 'Global Market Collapse'); },
    () => { state.stats.blackSwans++; const c = pick(COMPANIES.filter(x=>state.unlockedSectors.includes(x.sector))); if(c){ c.sentiment -= 40; pushNews(`🦢 MASSIVE FRAUD uncovered at ${c.name} (${c.ticker})`, -0.5, 'company', true);} },
    () => { state.stats.blackSwans++; COMPANIES.forEach(c => c.sentiment += rand(6, 14)); state.market.sentiment = 1; pushNews('🦢 ECONOMIC MIRACLE — unprecedented global boom', +0.9, 'global', true); fullEvent('ECONOMIC MIRACLE', 'Markets Skyrocket'); },
    () => { state.stats.blackSwans++; const c = pick(COMPANIES.filter(x=>state.unlockedSectors.includes(x.sector))); if(c){ c.sentiment += 50; pushNews(`🦢 ${c.name} becomes first TRILLION-dollar breakout — stock explodes`, +0.6, 'company', true);} },
  ];
  pick(swans)();
}

function payDividends(){
  let total = 0, count = 0;
  for (const t in state.holdings){
    const h = state.holdings[t]; if (h.qty <= 0) continue;
    const c = getCompany(t); if (!c || c.div <= 0) continue;
    const pay = (c.price * h.qty * c.div) / 8;
    if (pay > 0){ total += pay; count++; }
  }
  if (total > 0){
    state.cash += total;
    state.stats.dividends += count;
    state.stats.dividendIncome += total;
    addXP(Math.min(50, total / 1000));
    floatProfit('+' + fmtMoneyShort(total) + ' dividends');
  }
}

function computeNetWorth(){
  let nw = state.cash;
  for (const t in state.holdings){
    const h = state.holdings[t]; if (h.qty <= 0) continue;
    const c = getCompany(t); if (c) nw += h.qty * c.price;
  }
  state.startups.forEach(su => { if (su.status !== 'failed') nw += su.value; });
  state.deals.forEach(d => { if (d.status === 'active') nw += d.value; });
  state.ownedCompanies.forEach(o => nw += o.value);
  if (state.hedgeFund.created) nw += state.hedgeFund.capitalContributed;
  state.netWorth = nw;
  if (nw > state.stats.peakNetWorth) state.stats.peakNetWorth = nw;
  return nw;
}

function addXP(amount){
  if (amount <= 0) return;
  if (typeof xpMult === 'function') amount *= xpMult();              // XP Surge power-up
  if (typeof prestigeXpMult === 'function') amount *= prestigeXpMult(); // Wall Street Veteran tree
  state.xp += amount;
  let need = xpForLevel(state.level);
  while (state.xp >= need && state.level < 100){
    state.xp -= need;
    state.level++;
    onLevelUp(state.level);
    need = xpForLevel(state.level);
  }
}

function onLevelUp(L){
  const unlock = LEVEL_UNLOCKS[L];
  if (unlock){
    state.unlockedFeatures[unlock.key] = true;
    if(typeof sfxSafe==='function')sfxSafe('unlock');
    fullEvent('LEVEL ' + L, 'Unlocked: ' + unlock.name);
    toast('Unlocked: ' + unlock.name, 'blue');
  } else {
    if(typeof sfxSafe==='function')sfxSafe('levelup');
    toast('Level ' + L + ' reached', 'blue');
  }
  if (typeof refreshFeatureVisibility === 'function') refreshFeatureVisibility();
}

function checkSectorUnlocks(){
  for (const id in SECTORS){
    const sec = SECTORS[id];
    if (sec.unlockAt > 0 && !state.unlockedSectors.includes(id) && state.netWorth >= sec.unlockAt){
      state.unlockedSectors.push(id);
      if(typeof sfxSafe==='function')sfxSafe('unlock');
      pushNews(`New sector discovered: ${sec.name}`, +0.1, 'global', true);
      fullEvent('SECTOR UNLOCKED', sec.name);
      toast('Sector unlocked: ' + sec.name, 'gold');
      addXP(200);
      if (typeof rebuildMarketTable === 'function') rebuildMarketTable();
    }
  }
}

function checkMilestones(){
  MILESTONES.forEach(m => {
    if (state.netWorth >= m.v && !state.milestonesHit[m.tag]){
      state.milestonesHit[m.tag] = true;
      state.rankName = m.rank;
      milestoneCelebration(m);
      addXP(500);
    }
  });
  if (typeof updateRankLabel === 'function') updateRankLabel();
}

let ACHIEVEMENTS = [];
function checkAchievements(){
  ACHIEVEMENTS.forEach(a => {
    if (!state.achievements[a.id]){
      let ok = false;
      try { ok = a.check(state); } catch(e){}
      if (ok){
        state.achievements[a.id] = true;
        a.done = true;
        addXP(40);
        achievementPopup(a);
      }
    }
  });
}
