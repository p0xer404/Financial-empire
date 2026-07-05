/* ============================================================
   prestige.js  —  Reincorporation (prestige) + Legacy meta-tree

   The long-game engine. Once an empire is large enough the player
   can "Reincorporate": wipe the current run for permanent Legacy
   shares, then spend them on a tree of permanent multipliers that
   make every future run faster and richer. This is what gives the
   game effectively unlimited lifetime past the first billion.

   Everything here is OPT-IN and additive. All multiplier getters
   guard against old saves / pre-init state so the rest of the game
   can call them unconditionally.
   ============================================================ */

const PRESTIGE_MIN = 1e9;          // first reincorporation available at $1B net worth

/* Legacy shares earned for a given net worth (diminishing returns:
   each tier costs ~10× the net worth of the previous). */
function legacyFromNetWorth(nw){
  if (nw < PRESTIGE_MIN) return 0;
  return Math.floor(Math.pow(nw / 1e9, 0.5) * 2);
}

/* Permanent upgrade tree. `per` is the effect magnitude per level;
   cost (in Legacy) grows geometrically so deep levels are aspirational. */
const PRESTIGE_UPGRADES = [
  { id:'compounding',  icon:'📈', name:'Compound Interest',
    desc:'Permanently boost ALL income — dividends, passive, deals & empire.',
    per:0.08,    unit:'income',  max:60, baseCost:1, costMul:1.55 },
  { id:'seed',         icon:'💵', name:"Founder's Capital",
    desc:'Begin every new empire with dramatically more starting cash.',
    per:1,       unit:'seed',    max:15, baseCost:2, costMul:1.7 },
  { id:'mentor',       icon:'🎓', name:'Wall Street Veteran',
    desc:'Earn more XP from every action — re-climb the ranks far faster.',
    per:0.15,    unit:'xp',      max:40, baseCost:1, costMul:1.45 },
  { id:'insider',      icon:'🕴️', name:'Insider Network',
    desc:'Startup, IPO & private-deal offers arrive more often.',
    per:0.18,    unit:'luck',    max:25, baseCost:2, costMul:1.6 },
  { id:'midas',        icon:'✨', name:'Midas Touch',
    desc:'Every crate, bonus, daily & mystery reward pays out more.',
    per:0.18,    unit:'reward',  max:25, baseCost:2, costMul:1.6 },
  { id:'autopilot',    icon:'🌙', name:'Autopilot Empire',
    desc:'Earn far more while away, and bank up to 24h of offline income.',
    per:0.30,    unit:'offline', max:20, baseCost:2, costMul:1.7 },
  { id:'conglomerate', icon:'🏛️', name:'Conglomerate',
    desc:'New acquisitions & empire assets earn more and cost less.',
    per:0.12,    unit:'tycoon',  max:30, baseCost:2, costMul:1.6 },
  { id:'bull',         icon:'🐂', name:'Bull Instinct',
    desc:'A permanent tailwind lifts the entire market in your favor.',
    per:0.00007, unit:'drift',   max:20, baseCost:3, costMul:1.8 },
];
const PRESTIGE_BY_ID = {};
PRESTIGE_UPGRADES.forEach(u => PRESTIGE_BY_ID[u.id] = u);

/* ---------- safe state access ---------- */
function prestigeState(){
  if (!state.prestige) state.prestige = { legacy:0, lifetimeLegacy:0, reincorporations:0, upgrades:{} };
  if (!state.prestige.upgrades) state.prestige.upgrades = {};
  return state.prestige;
}
function pUp(id){ return (state && state.prestige && state.prestige.upgrades && state.prestige.upgrades[id]) || 0; }

/* ---------- multiplier getters (called all over the game) ---------- */
function incomeMult(){ return 1 + pUp('compounding') * 0.08; }
function prestigeXpMult(){ return 1 + pUp('mentor') * 0.15; }
function prestigeLuckMult(){ return 1 + pUp('insider') * 0.18; }
function prestigeRewardMult(){ return 1 + pUp('midas') * 0.18; }
function prestigeOfflineMult(){ return 1 + pUp('autopilot') * 0.30; }
function prestigeOfflineCapHours(){ return 8 + pUp('autopilot') * 0.8; }   // 8h → 24h
function prestigeTycoonMult(){ return 1 + pUp('conglomerate') * 0.12; }
function prestigeAcqDiscount(){ return 1 / (1 + pUp('conglomerate') * 0.06); }
function prestigeGrowthBonus(){ return pUp('bull') * 0.00007; }
function prestigeSeedCash(){
  if (!state || !state.prestige) return 10000;
  return Math.min(1e12, 10000 * Math.pow(4, pUp('seed')));
}

/* ---------- queries ---------- */
function prestigeUnlocked(){
  return state.netWorth >= PRESTIGE_MIN || (state.prestige && state.prestige.reincorporations > 0);
}
function pendingLegacy(){
  return Math.max(0, legacyFromNetWorth(state.netWorth) - legacyFromNetWorth(prestigeSeedCash()));
}
function canReincorporate(){ return state.netWorth >= PRESTIGE_MIN && pendingLegacy() >= 1; }

function upgradeCost(u){
  const lvl = pUp(u.id);
  return Math.floor(u.baseCost * Math.pow(u.costMul, lvl));
}
function upgradeEffectText(u, lvl){
  const v = lvl != null ? lvl : pUp(u.id);
  switch(u.unit){
    case 'income':  return '+' + Math.round(v * u.per * 100) + '% income';
    case 'xp':      return '+' + Math.round(v * u.per * 100) + '% XP';
    case 'luck':    return '+' + Math.round(v * u.per * 100) + '% offers';
    case 'reward':  return '+' + Math.round(v * u.per * 100) + '% rewards';
    case 'offline': return '+' + Math.round(v * u.per * 100) + '% offline · ' + Math.round(8 + v*0.8) + 'h bank';
    case 'tycoon':  return '+' + Math.round(v * u.per * 100) + '% empire · ' + Math.round((1-1/(1+v*0.06))*100) + '% off';
    case 'drift':   return '+' + (v * u.per * 100).toFixed(2) + '% market/tick';
    case 'seed':    return 'Start with ' + fmtMoneyShort(Math.min(1e12, 10000 * Math.pow(4, v)));
    default:        return '';
  }
}

/* ---------- actions ---------- */
function buyPrestigeUpgrade(id){
  const u = PRESTIGE_BY_ID[id]; if (!u) return;
  const ps = prestigeState();
  const lvl = pUp(id);
  if (lvl >= u.max){ toast('Already maxed', 'blue'); return; }
  const cost = upgradeCost(u);
  if (ps.legacy < cost){ toast('Not enough Legacy', 'red'); sfxSafe('error'); return; }
  ps.legacy -= cost;
  ps.upgrades[id] = lvl + 1;
  sfxSafe('unlock');
  toast(u.icon + ' ' + u.name + ' → Lv ' + (lvl+1), 'gold');
  afterAction();
  if (typeof renderPrestige === 'function') renderPrestige();
}

function promptReincorporate(){
  const gain = pendingLegacy();
  if (gain < 1){
    showModal(`<h3>Reincorporate</h3>
      <p class="muted" style="margin-bottom:14px;">You need more net worth before reincorporating is worthwhile. Grow past your starting capital to bank Legacy shares.</p>
      <button class="btn" style="width:100%" onclick="closeModal()">Keep Building</button>`);
    return;
  }
  showModal(`<h3 class="gold">Reincorporate Your Empire?</h3>
    <p class="muted" style="margin-bottom:12px;">Liquidate everything and re-found a leaner, smarter empire. You keep your achievements, stats and Legacy tree forever.</p>
    <div class="kv"><span class="k">Legacy shares earned</span><span class="v gold mono">+${fmtNum(gain)} ◆</span></div>
    <div class="kv"><span class="k">You will reset</span><span class="v">Cash · holdings · ventures · level</span></div>
    <div class="kv"><span class="k">You will keep</span><span class="v">Legacy tree · achievements · stats</span></div>
    <div class="btn-row" style="margin-top:16px;">
      <button class="btn gold" style="flex:1" onclick="doReincorporate()">Reincorporate · +${fmtNum(gain)} ◆</button>
      <button class="btn" style="flex:1" onclick="closeModal()">Not Yet</button>
    </div>`);
}
function doReincorporate(){ closeModal(); reincorporate(); }

function reincorporate(){
  const gain = pendingLegacy();
  if (gain < 1) return;

  // Preserve everything that should survive a prestige.
  const ps = prestigeState();
  ps.legacy += gain;
  ps.lifetimeLegacy += gain;
  ps.reincorporations++;

  const keep = {
    prestige:     ps,
    achievements: state.achievements,
    milestonesHit:{},                       // ranks re-earned each run (re-celebrate)
    stats:        state.stats,
    settings:     state.settings,
    daily:        state.daily,
    boosts:       state.boosts,
    crateReady:   state.crateReady,
    instantReady: state.instantReady,
    mysteryReady: state.mysteryReady,
  };

  // Fresh run, then graft the preserved data back on.
  state = defaultState();
  Object.assign(state, keep);
  state.cash = state.netWorth = prestigeSeedCash();

  // Reseed the whole market so charts have depth and prices feel new.
  COMPANIES.forEach(seedCompanyHistory);
  state.market.indexHistory = [];
  for (let i = 0; i < HIST_SEED; i++) state.market.indexHistory.push(1000 * (1 + (Math.random() - 0.5) * 0.04));

  computeNetWorth();

  // Silently re-grant everything the seed cash already affords, so the first
  // post-reincorporation tick doesn't spam celebration overlays, XP and ad
  // requests for milestones/sectors the player has effectively skipped past.
  for (const id in SECTORS){
    const sec = SECTORS[id];
    if (sec.unlockAt <= state.netWorth && !state.unlockedSectors.includes(id)) state.unlockedSectors.push(id);
  }
  MILESTONES.forEach(m => { if (state.netWorth >= m.v){ state.milestonesHit[m.tag] = true; state.rankName = m.rank; } });

  const first = COMPANIES.find(c => state.unlockedSectors.includes(c.sector));
  if (typeof selectedTicker !== 'undefined') selectedTicker = first ? first.ticker : null;

  sfxSafe('milestone');
  if (typeof burstConfetti === 'function'){ burstConfetti({ count: 180 }); setTimeout(()=>burstConfetti({ count: 120 }), 350); }
  pushNews(`You reincorporated — a new empire rises, +${fmtNum(gain)} Legacy banked`, 0.2, 'global', true);

  if (typeof buildNav === 'function') buildNav();
  if (typeof rebuildMarketTable === 'function') rebuildMarketTable();
  if (typeof switchView === 'function') switchView('legacy');
  if (typeof renderAll === 'function') renderAll();
  if (typeof renderPrestige === 'function') renderPrestige();
  saveGame(true);

  setTimeout(()=>{
    $('cele-tag').textContent = '◆ ' + fmtNum(ps.legacy);
    $('cele-tag').style.fontSize = 'clamp(34px,9vw,54px)';
    $('cele-rank').textContent = 'Reincorporated';
    $('cele-sub').textContent = `Run #${ps.reincorporations + 1} begins · ${fmtNum(gain)} Legacy earned`;
    const c = $('celebration'); c.classList.add('show');
    setTimeout(()=>{ c.classList.remove('show'); $('cele-tag').style.fontSize=''; }, 3000);
  }, 200);
}

/* ============================================================
   UI  —  Legacy view
   ============================================================ */
function renderPrestige(){
  const wrap = $('legacy-wrap'); if (!wrap) return;
  if (!prestigeUnlocked()){
    wrap.innerHTML = lockedCard('♻️', 'Reincorporation Locked',
      `Reach ${fmtMoneyShort(PRESTIGE_MIN)} net worth to unlock the prestige loop. Reincorporate to trade your empire for permanent Legacy upgrades that compound across every future run.`);
    return;
  }
  const ps = prestigeState();
  const gain = pendingLegacy();
  const can = canReincorporate();

  let html = `
    <div class="panel accent-gold legacy-hero">
      <div class="panel-body">
        <div class="legacy-stats">
          <div class="stat"><span class="label">Legacy Available</span><span class="value big gold mono">◆ ${fmtNum(ps.legacy)}</span></div>
          <div class="stat"><span class="label">Reincorporations</span><span class="value big mono">${fmtNum(ps.reincorporations)}</span></div>
          <div class="stat"><span class="label">Lifetime Legacy</span><span class="value big mono">◆ ${fmtNum(ps.lifetimeLegacy)}</span></div>
          <div class="stat"><span class="label">Income Multiplier</span><span class="value big pos mono">×${incomeMult().toFixed(2)}</span></div>
        </div>
        <div class="legacy-cta">
          <div class="legacy-cta-text">
            <div class="lct-big">${can ? '+' + fmtNum(gain) + ' ◆' : 'Keep building'}</div>
            <div class="lct-sub muted">${can
              ? 'Reincorporate now to bank these Legacy shares.'
              : 'Grow past ' + fmtMoneyShort(legacyValueNeededForNext()) + ' net worth to earn your next Legacy share.'}</div>
          </div>
          <button class="btn gold ${can?'':''}" ${can?'':'disabled'} onclick="promptReincorporate()" style="min-width:200px;">
            ${can ? '♻️ Reincorporate · +' + fmtNum(gain) + ' ◆' : '♻️ Reincorporate'}
          </button>
        </div>
      </div>
    </div>`;

  html += '<h2 class="section-title" style="margin-top:18px;">Legacy Upgrades · permanent across every empire</h2><div class="grid g-auto">';
  PRESTIGE_UPGRADES.forEach(u => {
    const lvl = pUp(u.id);
    const maxed = lvl >= u.max;
    const cost = upgradeCost(u);
    const afford = ps.legacy >= cost;
    html += `<div class="card legacy-card ${lvl>0?'owned':''}">
      <div class="legacy-head"><span class="legacy-ic">${u.icon}</span>
        <div><h4>${u.name}</h4><div class="meta" style="margin:0;">${u.desc}</div></div></div>
      <div class="legacy-lvl"><span class="muted">Level</span><span class="mono">${lvl} / ${u.max}</span></div>
      <div class="legacy-meter"><div style="width:${(lvl/u.max*100).toFixed(0)}%"></div></div>
      <div class="kv"><span class="k">Current</span><span class="v gold">${lvl>0?upgradeEffectText(u):'—'}</span></div>
      ${maxed ? '' : `<div class="kv"><span class="k">Next level</span><span class="v">${upgradeEffectText(u, lvl+1)}</span></div>`}
      ${maxed
        ? `<div class="legacy-maxed">★ MAXED</div>`
        : `<button class="btn ${afford?'gold':''} sm" style="width:100%;margin-top:10px;" ${afford?'':'disabled'} onclick="buyPrestigeUpgrade('${u.id}')">${afford?`Buy · ◆ ${fmtNum(cost)}`:`Need ◆ ${fmtNum(cost)}`}</button>`}
    </div>`;
  });
  html += '</div>';
  wrap.innerHTML = html;
}

/* Net-worth threshold of the next whole Legacy share (for the "keep building"
   hint) — invert legacyFromNetWorth offset by the seed baseline. */
function legacyValueNeededForNext(){
  const base = legacyFromNetWorth(prestigeSeedCash());
  const target = Math.max(1, legacyFromNetWorth(state.netWorth) - base) + base + 1;
  return Math.pow(target / 2, 2) * 1e9;
}
