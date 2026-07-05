/* ============================================================
   boosts.js  —  Power-ups, rewarded-ad boosts & retention loops

   Everything here is OPT-IN. Boosts are claimed by the player,
   never forced. Timed boosts and cooldowns are stored as absolute
   epoch-ms timestamps so they are immune to frame rate, tab focus,
   reloads and offline time.
   ============================================================ */

const BOOST_DUR   = 5 * 60 * 1000;   // timed boosts last 5 minutes
const CRATE_CD    = 3 * 60 * 1000;   // free bonus recharges every 3 minutes
const INSTANT_CD  = 3 * 60 * 1000;   // instant-cash cooldown
const MYSTERY_CD  = 2 * 60 * 1000;   // mystery crate cooldown
const DAILY_CD    = 20 * 60 * 60 * 1000;   // daily reward window
const DAILY_RESET = 48 * 60 * 60 * 1000;   // miss this long and the streak resets

const BOOSTS = {
  double: { name: 'Double Income', icon: '💰', accent: 'gold',
            desc: '2× all passive & dividend income for 5 minutes.' },
  bull:   { name: 'Bull Run',      icon: '🐂', accent: 'blue',
            desc: 'Ignite a surging bull market across every sector for 5 minutes.' },
  xp:     { name: 'XP Surge',      icon: '⭐', accent: 'blue',
            desc: '2× XP from every trade, dividend and deal for 5 minutes.' },
};

/* ---------- queries (all guard against old saves) ---------- */
function boostState(){ if (!state.boosts) state.boosts = { double:0, bull:0, xp:0 }; return state.boosts; }
function boostActive(key){ const b = boostState(); return (b[key]||0) > Date.now(); }
function boostRemain(key){ const b = boostState(); return Math.max(0, (b[key]||0) - Date.now()); }
function gainMult(){ return boostActive('double') ? 2 : 1; }
function xpMult(){ return boostActive('xp') ? 2 : 1; }

function crateReady(){ return Date.now() >= (state.crateReady || 0); }
function instantReady(){ return Date.now() >= (state.instantReady || 0); }
function mysteryReady(){ return Date.now() >= (state.mysteryReady || 0); }
function dailyReady(){ return Date.now() - ((state.daily && state.daily.last) || 0) >= DAILY_CD; }

function fmtClock(ms){
  const s = Math.ceil(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/* ---------- claim helpers ---------- */
function activateBoost(key){
  boostState()[key] = Date.now() + BOOST_DUR;
  sfxSafe('unlock');
  const b = BOOSTS[key];
  toast(b.icon + ' ' + b.name + ' activated · 5 min', 'gold');
  if (key === 'bull') pushNews('Trading desks light up — a boosted bull run begins', 0.2, 'global', true);
  updateBoostUI();
  if (currentView === 'boosts') renderBoosts();
  afterAction();
}

function claimBoost(key){
  if (boostActive(key)){ toast('That boost is already running', 'blue'); return; }
  CG.rewardedAd(
    () => activateBoost(key),
    () => toast('Ad unavailable — turn off your adblocker to claim boosts', 'red')
  );
}

/* Midas Touch prestige tree scales every cash reward. */
function rewardMult(){ return (typeof prestigeRewardMult === 'function') ? prestigeRewardMult() : 1; }
function crateAmount(viaAd){ return Math.max(2500, state.netWorth * 0.005) * (viaAd ? 6 : 1) * rewardMult(); }
function claimCrate(viaAd){
  if (!crateReady()) return;
  const grant = () => {
    const amt = crateAmount(viaAd);
    state.cash += amt;
    state.crateReady = Date.now() + CRATE_CD;
    sfxSafe('coin');
    floatProfit('+' + fmtMoneyShort(amt) + ' bonus');
    updateBoostUI();
    if (currentView === 'boosts') renderBoosts();
    afterAction();
  };
  if (viaAd) CG.rewardedAd(grant, () => toast('Ad unavailable — turn off your adblocker', 'red'));
  else grant();
}

function instantAmount(){ return Math.max(5000, state.netWorth * 0.04) * rewardMult(); }
function claimInstant(){
  if (!instantReady()){ toast('Instant cash is recharging', 'blue'); return; }
  CG.rewardedAd(
    () => {
      const amt = instantAmount();
      state.cash += amt;
      state.instantReady = Date.now() + INSTANT_CD;
      sfxSafe('profit');
      floatProfit('+' + fmtMoneyShort(amt) + ' cash');
      updateBoostUI();
      if (currentView === 'boosts') renderBoosts();
      afterAction();
    },
    () => toast('Ad unavailable — turn off your adblocker', 'red')
  );
}

/* ---------- Mystery Crate: variable reward (the strongest hook) ----------
   Watch an ad, get a random prize: cash, a random 5-min boost, or a rare
   jackpot. Variable-ratio rewards keep players coming back. */
function rollMystery(){
  const r = Math.random();
  if (r < 0.34) return { type:'cash',    mult:0.03, label:'Cash Drop' };
  if (r < 0.58) return { type:'cash',    mult:0.08, label:'Big Cash Drop' };
  if (r < 0.74) return { type:'boost',   key:'double', label:'Double Income' };
  if (r < 0.86) return { type:'boost',   key:'xp',     label:'XP Surge' };
  if (r < 0.95) return { type:'boost',   key:'bull',   label:'Bull Run' };
  return         { type:'jackpot', mult:0.25, label:'JACKPOT' };
}
function claimMystery(){
  if (!mysteryReady()){ toast('Mystery crate is recharging', 'blue'); return; }
  CG.rewardedAd(
    () => {
      state.mysteryReady = Date.now() + MYSTERY_CD;
      const p = rollMystery();
      if (p.type === 'boost'){
        activateBoost(p.key);
        toast('🎲 Mystery Crate · ' + p.label + ' boost!', 'gold');
      } else {
        const amt = Math.max(5000, state.netWorth * p.mult) * rewardMult();
        state.cash += amt;
        floatProfit('+' + fmtMoneyShort(amt) + ' ' + p.label);
        if (p.type === 'jackpot'){
          sfxSafe('milestone');
          if (typeof burstConfetti === 'function') burstConfetti({ count: 130 });
          if (typeof fullEvent === 'function') fullEvent('💎 JACKPOT', 'You won ' + fmtMoneyShort(amt));
          toast('💎 JACKPOT — ' + fmtMoneyShort(amt) + '!', 'gold');
        } else {
          sfxSafe('coin');
          toast('🎲 Mystery Crate · ' + fmtMoneyShort(amt), 'blue');
        }
      }
      updateBoostUI();
      if (currentView === 'boosts') renderBoosts();
      afterAction();
    },
    () => toast('Ad unavailable — turn off your adblocker', 'red')
  );
}

function dailyAmount(streak, viaAd){
  return Math.max(10000, state.netWorth * 0.02) * (1 + Math.min(streak, 7) * 0.15) * (viaAd ? 2 : 1) * rewardMult();
}
function claimDaily(viaAd){
  if (!dailyReady()) return;
  if (!state.daily) state.daily = { last: 0, streak: 0 };
  const grant = () => {
    const gap = Date.now() - (state.daily.last || 0);
    state.daily.streak = (state.daily.last && gap <= DAILY_RESET) ? state.daily.streak + 1 : 1;
    const amt = dailyAmount(state.daily.streak, viaAd);
    state.daily.last = Date.now();
    state.cash += amt;
    sfxSafe('milestone');
    floatProfit('+' + fmtMoneyShort(amt) + ' daily');
    toast('Daily reward · day ' + state.daily.streak + ' streak', 'gold');
    updateBoostUI();
    if (currentView === 'boosts') renderBoosts();
    afterAction();
  };
  if (viaAd) CG.rewardedAd(grant, () => toast('Ad unavailable — turn off your adblocker', 'red'));
  else grant();
}

/* ============================================================
   UI  —  always-visible boost bar + full Power-Ups view
   ============================================================ */
function updateBoostUI(){
  const actives = $('boost-actives');
  if (actives){
    let html = '';
    Object.keys(BOOSTS).forEach(k => {
      if (boostActive(k)) html += `<span class="boost-chip ${BOOSTS[k].accent}">${BOOSTS[k].icon} ${fmtClock(boostRemain(k))}</span>`;
    });
    actives.innerHTML = html;
  }
  const quick = $('boost-quick');
  if (quick){
    let html = '';
    if (crateReady()) html += `<button class="boost-cta" onclick="claimCrate(false)">🎁 Free Bonus</button>`;
    if (dailyReady()) html += `<button class="boost-cta gold" onclick="claimDaily(false)">📅 Daily Reward</button>`;
    quick.innerHTML = html;
  }
  const open = $('boost-open');
  if (open) open.classList.toggle('pulse', crateReady() || dailyReady());
}

function boostCard(key){
  const b = BOOSTS[key];
  const active = boostActive(key);
  const foot = active
    ? `<div class="boost-active-row"><span class="boost-live ${b.accent}">● ACTIVE</span><span class="mono">${fmtClock(boostRemain(key))} left</span></div>`
    : `<button class="btn ${b.accent} sm boost-watch" onclick="claimBoost('${key}')">▶ Watch ad · Activate</button>`;
  return `<div class="card boost ${active?'on':''}">
    <div class="boost-ic">${b.icon}</div>
    <h4>${b.name}</h4>
    <div class="meta">${b.desc}</div>
    ${foot}</div>`;
}

function rewardCard(opts){
  // opts: { icon, name, desc, amountText, ready, cdText, freeAttr, adAttr }
  const foot = opts.ready
    ? `<div class="btn-row">${opts.freeBtn || ''}${opts.adBtn || ''}</div>`
    : `<div class="boost-active-row"><span class="muted">Recharging</span><span class="mono">${opts.cdText}</span></div>`;
  return `<div class="card boost reward ${opts.ready?'':'cooling'}">
    <div class="boost-ic">${opts.icon}</div>
    <h4>${opts.name}</h4>
    <div class="meta">${opts.desc}</div>
    <div class="kv"><span class="k">Reward</span><span class="v gold mono">${opts.amountText}</span></div>
    ${foot}</div>`;
}

function renderBoosts(){
  const wrap = $('boosts-wrap'); if (!wrap) return;
  let html = '';

  // Active-boost banner
  const liveKeys = Object.keys(BOOSTS).filter(boostActive);
  if (liveKeys.length){
    html += '<div class="boost-banner">';
    liveKeys.forEach(k => html += `<span class="boost-chip big ${BOOSTS[k].accent}">${BOOSTS[k].icon} ${BOOSTS[k].name} · ${fmtClock(boostRemain(k))}</span>`);
    html += '</div>';
  }

  // Free / daily / instant
  html += '<h2 class="section-title">Free Rewards</h2><div class="grid g-auto">';
  html += rewardCard({
    icon: '🎁', name: 'Bonus Crate', desc: 'Grab a quick cash drop, or watch an ad for 6× the loot.',
    amountText: fmtMoneyShort(crateAmount(false)) + ' / ' + fmtMoneyShort(crateAmount(true)),
    ready: crateReady(), cdText: fmtClock(Math.max(0, (state.crateReady||0) - Date.now())),
    freeBtn: `<button class="btn sm" style="flex:1" onclick="claimCrate(false)">Claim free</button>`,
    adBtn: `<button class="btn gold sm" style="flex:1" onclick="claimCrate(true)">▶ Ad · 6×</button>`,
  });
  html += rewardCard({
    icon: '💵', name: 'Instant Cash', desc: 'Need capital now? Watch an ad for an instant injection scaled to your empire.',
    amountText: fmtMoneyShort(instantAmount()),
    ready: instantReady(), cdText: fmtClock(Math.max(0, (state.instantReady||0) - Date.now())),
    adBtn: `<button class="btn gold sm" style="width:100%" onclick="claimInstant()">▶ Watch ad · Collect</button>`,
  });
  const dStreak = (state.daily && state.daily.streak) || 0;
  html += rewardCard({
    icon: '📅', name: 'Daily Reward', desc: 'Come back every day — streaks pay more. Double it with an ad.' + (dStreak?` <b class="gold">Day ${dStreak} streak</b>`:''),
    amountText: fmtMoneyShort(dailyAmount(dStreak+1, false)) + ' / ' + fmtMoneyShort(dailyAmount(dStreak+1, true)),
    ready: dailyReady(), cdText: fmtClock(Math.max(0, ((state.daily&&state.daily.last)||0) + DAILY_CD - Date.now())),
    freeBtn: `<button class="btn sm" style="flex:1" onclick="claimDaily(false)">Claim</button>`,
    adBtn: `<button class="btn gold sm" style="flex:1" onclick="claimDaily(true)">▶ Ad · 2×</button>`,
  });
  html += rewardCard({
    icon: '🎲', name: 'Mystery Crate', desc: 'Watch an ad for a random prize — cash, a power-up, or a rare 💎 jackpot.',
    amountText: '???',
    ready: mysteryReady(), cdText: fmtClock(Math.max(0, (state.mysteryReady||0) - Date.now())),
    adBtn: `<button class="btn gold sm" style="width:100%" onclick="claimMystery()">▶ Open crate</button>`,
  });
  html += '</div>';

  // Timed power-ups
  html += '<h2 class="section-title" style="margin-top:22px;">Power-Ups · watch an ad to activate</h2><div class="grid g-auto">';
  Object.keys(BOOSTS).forEach(k => html += boostCard(k));
  html += '</div>';

  if (CG.adblock){
    html += `<div class="adblock-note">⚠ An adblocker is active. Boosts that need an ad will be unavailable until you disable it and refresh — your progress is saved automatically.</div>`;
  }

  wrap.innerHTML = html;
}
