/* ============================================================
   systems.js  —  Trading + progression systems
   ============================================================ */

/* ---------- TRADING ---------- */
function sfxSafe(n, o){ if (typeof sfx === 'function' && state.settings.sound) sfx(n, o); }

/* Options Desk unlock (lvl 20): sharper execution = +25% XP from trades. */
function tradeXpMult(){ return state.unlockedFeatures.options ? 1.25 : 1; }
/* Private Deal Network unlock (lvl 30): startup & private deals arrive ~2× as often.
   Multiplied further by the Insider Network prestige tree. */
function privateFreqMult(){
  const base = state.unlockedFeatures.privateInvest ? 2 : 1;
  return base * ((typeof prestigeLuckMult === 'function') ? prestigeLuckMult() : 1);
}
function offerFreqMult(){ return (typeof prestigeLuckMult === 'function') ? prestigeLuckMult() : 1; }

function buyStock(ticker, qty){
  const c = getCompany(ticker);
  if (!c || qty <= 0) return false;
  const cost = c.price * qty;
  if (cost > state.cash){ toast('Not enough cash', 'red'); sfxSafe('error'); return false; }
  state.cash -= cost;
  const h = state.holdings[ticker] || { qty: 0, avgCost: 0, heldTicks: 0 };
  h.avgCost = (h.avgCost * h.qty + cost) / (h.qty + qty);
  h.qty += qty;
  h.heldTicks = h.heldTicks || 0;
  state.holdings[ticker] = h;
  state.stats.trades++;
  addXP(2 * tradeXpMult());
  sfxSafe('buy');
  toast(`Bought ${fmtNum(qty)} ${ticker} @ ${fmtMoney(c.price,2)}`, 'green');
  afterAction();
  return true;
}

/* Quick-buy by dollar amount */
function buyAmount(ticker, dollars){
  const c = getCompany(ticker);
  if (!c) return false;
  const qty = Math.floor(Math.min(dollars, state.cash) / c.price);
  if (qty <= 0){ toast('Not enough cash', 'red'); sfxSafe('error'); return false; }
  return buyStock(ticker, qty);
}

function sellStock(ticker, qty){
  const c = getCompany(ticker);
  const h = state.holdings[ticker];
  if (!c || !h || h.qty <= 0) return false;
  qty = Math.min(qty, h.qty);
  const proceeds = c.price * qty;
  const costBasis = h.avgCost * qty;
  const pnl = proceeds - costBasis;
  state.cash += proceeds;
  h.qty -= qty;
  state.stats.trades++;
  state.stats.realizedPnL += pnl;
  if (pnl > 0){
    state.stats.profitableTrades++;
    state.streak = (state.streak || 0) + 1;
    if (state.streak > state.stats.bestStreak) state.stats.bestStreak = state.streak;
    const mult = 1 + Math.min(state.streak - 1, 10) * 0.25;   // up to 3.5x XP
    addXP(clamp(pnl / 500, 1, 100) * mult * tradeXpMult());
    floatProfit('+' + fmtMoneyShort(pnl));
    if (state.streak >= 2){
      sfxSafe('streak', { level: state.streak });
      if (typeof showStreak === 'function') showStreak(state.streak, mult);
    } else {
      sfxSafe('profit');
    }
  } else {
    if (state.streak >= 3 && typeof toast === 'function') toast('Streak broken', 'red');
    state.streak = 0;
    floatProfit(fmtMoneyShort(pnl), true);
    sfxSafe('loss');
  }
  if (h.qty <= 0) delete state.holdings[ticker];
  toast(`Sold ${fmtNum(qty)} ${ticker} (${pnl>=0?'+':''}${fmtMoneyShort(pnl)})`, pnl>=0?'green':'red');
  afterAction();
  return true;
}

function positionValue(ticker){
  const h = state.holdings[ticker]; const c = getCompany(ticker);
  return (h && c) ? h.qty * c.price : 0;
}

function tickHoldings(){
  for (const t in state.holdings){
    const h = state.holdings[t];
    if (h.qty > 0){
      h.heldTicks = (h.heldTicks || 0) + 1;
      if (h.heldTicks > state.stats.longestHoldTicks) state.stats.longestHoldTicks = h.heldTicks;
      if (state.tick % 30 === 0) addXP(0.5);
    }
  }
}

/* Refresh views directly affected by a player action */
function afterAction(){
  computeNetWorth();
  checkSectorUnlocks();
  checkMilestones();
  checkAchievements();
  if (typeof renderAll === 'function') renderAll();
  // Immediately rebuild the trade panel so the Sell button / owned qty
  // update without needing a page change or refresh.
  if (typeof currentView !== 'undefined' && currentView === 'market'
      && selectedTicker && typeof renderTradePanel === 'function'){
    renderTradePanel();
  }
  if (typeof currentView !== 'undefined' && currentView === 'portfolio'
      && typeof renderPortfolio === 'function'){
    renderPortfolio();
  }
}

/* ============================================================
   STARTUP INVESTMENT SYSTEM
   ============================================================ */
function startupUnlocked(){ return state.netWorth >= 5e6 || state.unlockedFeatures.startups; }

function maybeGenerateStartupOffer(){
  if (!startupUnlocked()) return;
  if (state.startupOffers.length >= 3) return;
  if (!chance(0.04 * privateFreqMult())) return;
  state.startupOffers.push(makeStartupOffer());
  toast('New startup proposal received', 'blue');
  if (typeof renderStartups === 'function') renderStartups();
}

function makeStartupOffer(){
  // ~35% of proposals are exclusive high-upside rounds gated behind a
  // rewarded ad. They get a potential bump so unlocking feels worth it.
  const premium = chance(0.35);
  const valuation = Math.max(2e6, state.netWorth * rand(0.05, 0.4)) * rand(0.6, 2.5) * (premium ? 1.3 : 1);
  const equity = rand(0.08, 0.30);
  const ask = valuation * equity;
  return {
    id: 'su' + Date.now() + randInt(0,999),
    name: pick(STARTUP_NAMES) + ' ' + pick(STARTUP_SUFFIX),
    founder: pick(FOUNDER_FIRST) + ' ' + pick(FOUNDER_LAST),
    sector: pick(STARTUP_SECTORS),
    valuation, equity, ask, risk: randInt(1,5),
    potential: premium ? Math.min(5, randInt(3,5) + 1) : randInt(2,5),
    premium, locked: premium,
  };
}

/* Watch a rewarded ad to unlock an exclusive startup round, then it can
   be invested in like any other. Off-platform / on ad failure we unlock
   anyway so the game is never blocked. */
function unlockStartup(offerId){
  const o = state.startupOffers.find(x => x.id === offerId);
  if (!o || !o.locked) return;
  if (typeof CG === 'undefined'){ o.locked = false; if (typeof renderStartups === 'function') renderStartups(); return; }
  CG.rewardedAd(
    () => { o.locked = false; sfxSafe('unlock'); toast('Exclusive round unlocked', 'gold');
            if (typeof renderStartups === 'function') renderStartups(); },
    () => toast('Ad unavailable — turn off your adblocker to unlock', 'red')
  );
}

function investStartup(offerId){
  const idx = state.startupOffers.findIndex(o => o.id === offerId);
  if (idx < 0) return;
  const o = state.startupOffers[idx];
  if (o.locked){ unlockStartup(o.id); return; }   // must watch the ad first
  if (o.ask > state.cash){ toast('Not enough cash', 'red'); return; }
  state.cash -= o.ask;
  state.startupOffers.splice(idx, 1);
  state.stats.startupsInvested++;
  state.startups.push({
    id: o.id, name: o.name, founder: o.founder, sector: o.sector,
    invested: o.ask, equity: o.equity, value: o.ask,
    status: 'growing', age: 0, risk: o.risk, potential: o.potential, income: 0,
    targetMul: rollStartupOutcome(o),
  });
  addXP(150);
  toast(`Invested ${fmtMoneyShort(o.ask)} in ${o.name}`, 'green');
  afterAction();
  if (typeof renderStartups === 'function') renderStartups();
}

function negotiateStartup(offerId){
  const o = state.startupOffers.find(x => x.id === offerId);
  if (!o) return;
  if (chance(0.5)){
    o.ask *= rand(0.78, 0.92);
    o.equity *= rand(1.05, 1.2);
    toast('Negotiation succeeded — better terms', 'green');
  } else {
    toast('Founder walked away from negotiation', 'red');
    state.startupOffers = state.startupOffers.filter(x => x.id !== offerId);
  }
  if (typeof renderStartups === 'function') renderStartups();
}

function rejectStartup(offerId){
  state.startupOffers = state.startupOffers.filter(x => x.id !== offerId);
  if (typeof renderStartups === 'function') renderStartups();
}

function rollStartupOutcome(o){
  const r = Math.random();
  const potBoost = o.potential / 5;
  if (r < 0.25 - o.risk * 0.02) return 0;
  if (r < 0.55) return rand(0.5, 1.5);
  if (r < 0.82) return rand(2, 8) * potBoost;
  if (r < 0.96) return rand(10, 50) * potBoost;
  return rand(60, 300) * potBoost;
}

function tickStartups(){
  state.startups.forEach(su => {
    if (su.status === 'failed' || su.status === 'exited') return;
    su.age++;
    const target = su.invested * su.targetMul;
    su.value += (target - su.value) * 0.01 + su.value * rand(-0.02, 0.025);
    su.value = Math.max(0, su.value);

    const valuationNow = su.value / su.equity;
    if (valuationNow >= 1e10 && !su.decacornFlagged){ su.decacornFlagged = true; state.stats.decacorns++; pushNews(`${su.name} reaches DECACORN status ($10B valuation)`, +0.2, 'global', true); }
    if (valuationNow >= 1e9 && !su.unicornFlagged){ su.unicornFlagged = true; state.stats.unicorns++; pushNews(`Your startup ${su.name} becomes a UNICORN ($1B valuation)`, +0.15, 'global', true); toast(su.name+' is now a Unicorn!', 'gold'); }

    if (su.targetMul === 0 && su.age > randInt(20, 60)){
      su.status = 'failed'; su.value = 0;
      pushNews(`${su.name} has shut down — investment lost`, -0.05, 'company');
      toast(su.name + ' failed', 'red');
      return;
    }
    if (su.age > randInt(80, 160) && su.status === 'growing'){
      const roll = Math.random();
      if (roll < 0.4){
        su.status = 'exited';
        state.cash += su.value;
        state.stats.startupReturns += Math.max(0, su.value - su.invested);
        addXP(clamp(su.value/1e5, 50, 1000));
        pushNews(`${su.name} acquired — you cashed out ${fmtMoneyShort(su.value)}`, +0.1, 'company', true);
        floatProfit('+' + fmtMoneyShort(su.value) + ' exit');
        fullEvent('STARTUP EXIT', su.name + ' acquired for ' + fmtMoneyShort(su.value));
      } else if (roll < 0.7){
        su.status = 'operating';
        su.income = su.value * 0.0008;
        queueIPOFromStartup(su);
        pushNews(`${su.name} files to go PUBLIC via IPO`, +0.12, 'global', true);
      } else {
        su.status = 'operating';
        su.income = su.value * 0.001;
        pushNews(`${su.name} turns profitable — paying you ${fmtMoneyShort(su.income)}/sec`, +0.08, 'company');
      }
    }
    if (su.status === 'operating'){ su.income = su.value * 0.001; }
  });
}

/* ============================================================
   IPO SYSTEM
   ============================================================ */
function queueIPOFromStartup(su){ state.ipos.push(makeIPO(su.name, su.sector, su.value / su.equity)); }
function maybeGenerateIPO(){
  if (state.netWorth < 250000) return;
  if (state.ipos.length >= 4) return;
  if (!chance(0.03 * offerFreqMult())) return;
  state.ipos.push(makeIPO(pick(STARTUP_NAMES)+' '+pick(STARTUP_SUFFIX), pick(STARTUP_SECTORS), rand(2e8, 2e10)));
  toast('New IPO announced', 'blue');
  if (typeof renderIPOs === 'function') renderIPOs();
}
function makeIPO(name, sector, valuation){
  const sharePrice = rand(12, 90);
  const allocation = Math.max(50, Math.floor(valuation * rand(0.0005, 0.003) / sharePrice));
  return { id: 'ipo'+Date.now()+randInt(0,999), name, sector, valuation, sharePrice, allocation,
    hype: rand(0.2, 1), countdown: randInt(15, 40), status: 'upcoming' };
}
function subscribeIPO(ipoId, shares){
  const ipo = state.ipos.find(i => i.id === ipoId);
  if (!ipo || ipo.status !== 'upcoming') return;
  shares = Math.min(shares, ipo.allocation);
  const cost = shares * ipo.sharePrice;
  if (cost > state.cash){ toast('Not enough cash', 'red'); return; }
  state.cash -= cost;
  ipo.subscribed = shares; ipo.costBasis = cost; ipo.status = 'subscribed';
  state.stats.ipos++;
  addXP(80);
  toast(`Subscribed to ${ipo.name} IPO`, 'green');
  afterAction();
  if (typeof renderIPOs === 'function') renderIPOs();
}
function tickIPOs(){
  state.ipos.forEach(ipo => {
    if (ipo.status === 'subscribed' || ipo.status === 'upcoming'){
      ipo.countdown--;
      if (ipo.countdown <= 0 && !ipo.listed){
        ipo.listed = true;
        const success = Math.random() < (0.45 + ipo.hype * 0.3);
        ipo.pop = success ? rand(0.2, 2.5) * ipo.hype : -rand(0.2, 0.6);
        if (ipo.status === 'subscribed'){
          const value = ipo.costBasis * (1 + ipo.pop);
          const pnl = value - ipo.costBasis;
          state.cash += value;
          if (pnl > 0){ state.stats.ipoWins++; floatProfit('+'+fmtMoneyShort(pnl)+' IPO'); addXP(clamp(pnl/2000,10,500)); }
          else floatProfit(fmtMoneyShort(pnl)+' IPO', true);
          pushNews(`${ipo.name} debuts ${fmtPct(ipo.pop)} on first day`, ipo.pop>0?0.1:-0.1, 'global', ipo.pop>1);
        } else {
          pushNews(`${ipo.name} IPO debuts ${fmtPct(ipo.pop)}`, 0.05, 'global');
        }
        ipo.status = 'closed';
      }
    }
  });
  state.ipos = state.ipos.filter(i => i.status !== 'closed');
}

/* ============================================================
   EXCLUSIVE DEALS
   ============================================================ */
function dealsUnlocked(){ return state.netWorth >= 50e6 || state.unlockedFeatures.privateEquity; }

function maybeGenerateDeal(){
  if (!dealsUnlocked()) return;
  if (state.dealOffers.length >= 3) return;
  if (!chance(0.035 * privateFreqMult())) return;
  const dt = pick(DEAL_TYPES);
  const size = Math.max(5e6, state.netWorth * rand(0.02, 0.15));
  state.dealOffers.push({
    id: 'deal'+Date.now()+randInt(0,999), type: dt.type, size,
    expectedReturn: rand(dt.minRet, dt.maxRet), failChance: dt.fail,
    duration: randInt(30, 90), passive: chance(0.4) ? size * 0.0006 : 0,
  });
  toast('Exclusive deal offered: ' + dt.type, 'gold');
  if (typeof renderDeals === 'function') renderDeals();
}

function acceptDeal(id){
  const idx = state.dealOffers.findIndex(d => d.id === id);
  if (idx < 0) return;
  const o = state.dealOffers[idx];
  if (o.size > state.cash){ toast('Not enough cash', 'red'); return; }
  state.cash -= o.size;
  state.dealOffers.splice(idx, 1);
  state.stats.deals++;
  state.deals.push({
    id: o.id, type: o.type, invested: o.size, value: o.size,
    expectedReturn: o.expectedReturn, failChance: o.failChance,
    duration: o.duration, age: 0, status: 'active', passive: o.passive,
  });
  addXP(120);
  toast('Deal closed: ' + o.type, 'green');
  afterAction();
  if (typeof renderDeals === 'function') renderDeals();
}
function rejectDeal(id){ state.dealOffers = state.dealOffers.filter(d => d.id !== id); if (typeof renderDeals==='function') renderDeals(); }

function tickDeals(){
  state.deals.forEach(d => {
    if (d.status !== 'active') return;
    d.age++;
    const progress = d.age / d.duration;
    d.value = d.invested * (1 + (d.expectedReturn - 1) * Math.min(1, progress)) * (1 + rand(-0.01,0.01));
    if (d.age >= d.duration){
      if (Math.random() < d.failChance){
        d.status = 'closed'; d.value = d.invested * rand(0, 0.4);
        state.cash += d.value;
        pushNews(`${d.type} deal underperformed — recovered ${fmtMoneyShort(d.value)}`, -0.05, 'global');
        floatProfit(fmtMoneyShort(d.value - d.invested), true);
      } else {
        const out = d.invested * d.expectedReturn;
        d.status = 'closed'; d.value = out;
        state.cash += out;
        addXP(clamp(out/1e5, 50, 800));
        pushNews(`${d.type} deal closed — returned ${fmtMoneyShort(out)}`, +0.08, 'global', out>d.invested*2);
        floatProfit('+'+fmtMoneyShort(out - d.invested)+' deal');
      }
    }
  });
  state.deals = state.deals.filter(d => d.status === 'active');
}

/* ============================================================
   COMPANY ACQUISITIONS
   ============================================================ */
function acquisitionsUnlocked(){ return state.netWorth >= 50e6 || state.unlockedFeatures.acquisitions; }

function acquirableCompanies(){
  return COMPANIES.filter(c => state.unlockedSectors.includes(c.sector) &&
    !state.ownedCompanies.some(o => o.ticker === c.ticker));
}

function acquisitionPrice(c){
  const base = Math.min(c.mcap, state.netWorth * 0.6);
  const price = Math.max(c.mcap * 0.15, base);
  // Conglomerate prestige tree makes takeovers cheaper.
  return price * ((typeof prestigeAcqDiscount === 'function') ? prestigeAcqDiscount() : 1);
}

function acquireCompany(ticker){
  const c = getCompany(ticker);
  if (!c) return;
  const price = acquisitionPrice(c);
  if (price > state.cash){ toast('Need '+fmtMoneyShort(price)+' cash to acquire', 'red'); return; }
  state.cash -= price;
  const tycoon = (typeof prestigeTycoonMult === 'function') ? prestigeTycoonMult() : 1;
  state.ownedCompanies.push({
    ticker: c.ticker, name: c.name, sector: c.sector,
    acquiredFor: price, value: price, income: price * 0.0004 * tycoon,
    ceo: false, efficiency: 1, rnd: 0, global: 0,
  });
  addXP(400);
  pushNews(`You acquired ${c.name} (${c.ticker}) for ${fmtMoneyShort(price)}`, +0.1, 'global', true);
  fullEvent('ACQUISITION', 'You now own ' + c.name);
  afterAction();
  if (typeof renderAcquisitions === 'function') renderAcquisitions();
}

function upgradeOwned(ticker, type){
  const o = state.ownedCompanies.find(x => x.ticker === ticker);
  if (!o) return;
  const costs = { ceo: o.value * 0.05, efficiency: o.value * 0.08, rnd: o.value * 0.12, global: o.value * 0.2 };
  const cost = costs[type];
  if (cost > state.cash){ toast('Not enough cash', 'red'); return; }
  state.cash -= cost;
  if (type === 'ceo' && !o.ceo){ o.ceo = true; o.income *= 1.25; }
  else if (type === 'efficiency'){ o.efficiency++; o.income *= 1.18; }
  else if (type === 'rnd'){ o.rnd++; o.income *= 1.3; o.value *= 1.15; }
  else if (type === 'global'){ o.global++; o.income *= 1.5; o.value *= 1.25; }
  toast(o.name + ' upgraded: ' + type, 'green');
  afterAction();
  if (typeof renderAcquisitions === 'function') renderAcquisitions();
}

function tickOwned(){
  let income = 0;
  state.ownedCompanies.forEach(o => { income += o.income; o.value *= (1 + rand(-0.002, 0.004)); });
  if (income > 0) state.cash += income;
}

/* ============================================================
   HEDGE FUND
   ============================================================ */
function hedgeFundUnlocked(){ return state.netWorth >= 1e9 || state.unlockedFeatures.hedgeFund; }

function createHedgeFund(name){
  if (state.hedgeFund.created) return;
  const seed = 50e6;
  if (seed > state.cash){ toast('Need '+fmtMoneyShort(seed)+' to seed the fund', 'red'); return; }
  state.cash -= seed;
  state.hedgeFund.created = true;
  state.hedgeFund.name = name || 'Apex Capital Partners';
  state.hedgeFund.aum = seed;
  state.hedgeFund.capitalContributed = seed;
  state.hedgeFund.investors = 1;
  addXP(800);
  fullEvent('HEDGE FUND LAUNCHED', state.hedgeFund.name);
  afterAction();
  if (typeof renderHedgeFund === 'function') renderHedgeFund();
}

function hireHF(role){
  const hf = state.hedgeFund;
  const cost = role === 'analyst' ? 2e6 : 5e6;
  if (cost > state.cash){ toast('Not enough cash', 'red'); return; }
  state.cash -= cost;
  if (role === 'analyst') hf.analysts++; else hf.traders++;
  hf.monthlyReturn = clamp(0.008 + hf.analysts*0.0015 + hf.traders*0.0025, 0, 0.06);
  hf.reputation = clamp(hf.reputation + 2, 0, 100);
  toast('Hired ' + role, 'green');
  if (typeof renderHedgeFund === 'function') renderHedgeFund();
}

function tickHedgeFund(){
  const hf = state.hedgeFund;
  if (!hf.created) return;
  const ret = hf.monthlyReturn / 30 + rand(-0.004, 0.004);
  hf.aum *= (1 + ret);
  hf.capitalContributed *= (1 + ret * 0.3);
  if (chance(0.05 + hf.reputation/1000)){ hf.aum += hf.aum * rand(0.01, 0.06); hf.investors++; }
  hf.reputation = clamp(hf.reputation + (ret > 0 ? 0.05 : -0.05), 0, 100);
  state.cash += hedgeFundIncome(state);
}

/* ============================================================
   ENDGAME EMPIRE
   ============================================================ */
function empireUnlocked(){ return state.netWorth >= 100e9 || state.unlockedFeatures.globalFinance; }

const EMPIRE_BASE_COST = { etf: 5e9, investmentBank: 25e9, privateBank: 15e9, vcFirm: 10e9, financeGovt: 50e9, controlIndustry: 75e9 };
const EMPIRE_YIELD     = { etf: 0.0005, investmentBank: 0.0006, privateBank: 0.0005, vcFirm: 0.0007, financeGovt: 0.0008, controlIndustry: 0.001 };

/* Repeatable empire actions get geometrically more expensive each time so
   there is always a meaningful next purchase deep into the endgame. */
function empireOwned(action){
  const e = state.empire;
  return { etf: e.etfs, financeGovt: e.governmentsFinanced, controlIndustry: e.industriesControlled,
           investmentBank: e.investmentBank?1:0, privateBank: e.privateBank?1:0, vcFirm: e.vcFirm?1:0 }[action] || 0;
}
function empireRepeatable(action){ return action === 'etf' || action === 'financeGovt' || action === 'controlIndustry'; }
function empireCost(action){
  const base = EMPIRE_BASE_COST[action];
  return empireRepeatable(action) ? Math.round(base * Math.pow(1.18, empireOwned(action))) : base;
}

function empireAction(action){
  const e = state.empire;
  const cost = empireCost(action);
  if (!empireRepeatable(action) && empireOwned(action)) return;   // one-time assets
  if (cost > state.cash){ toast('Need '+fmtMoneyShort(cost)+' cash', 'red'); return; }
  state.cash -= cost;
  const tycoon = (typeof prestigeTycoonMult === 'function') ? prestigeTycoonMult() : 1;
  const yld = cost * EMPIRE_YIELD[action] * tycoon;
  e.passive += yld;
  if (action === 'etf'){ e.etfs++; pushNews('You launched a new ETF', 0.1,'global',true); }
  else if (action === 'investmentBank'){ e.investmentBank = true; fullEvent('INVESTMENT BANK','Now operating globally'); }
  else if (action === 'privateBank'){ e.privateBank = true; fullEvent('PRIVATE BANK','Serving the ultra-wealthy'); }
  else if (action === 'vcFirm'){ e.vcFirm = true; fullEvent('VC FIRM','Funding the future'); }
  else if (action === 'financeGovt'){ e.governmentsFinanced++; pushNews('You financed a national government', 0.15,'global',true); fullEvent('KINGMAKER','You finance governments'); }
  else if (action === 'controlIndustry'){ e.industriesControlled++; pushNews('You now control an entire industry', 0.2,'global',true); fullEvent('INDUSTRY CONTROL','An entire sector bends to you'); }
  addXP(1000);
  afterAction();
  if (typeof renderEmpire === 'function') renderEmpire();
}
