/* ============================================================
   state.js  —  Game state, persistence (localStorage)
   ============================================================ */

const SAVE_KEY = 'empire_save_v2';
const THEME_KEY = 'empire_theme';
const SAVE_VERSION = 2;
const HIST_SEED = 260;     // ticks of history seeded on a new game
const HIST_SAVE = 320;     // ticks of history persisted to save

let state = null;

/* Storage backend: CrazyGames data module when available, else localStorage.
   The CrazyGames data module mirrors the localStorage API, so this is a
   drop-in swap that also syncs progress across the player's devices. */
function store(){ return (typeof CG !== 'undefined' && CG.storage) ? CG.storage : localStorage; }

function defaultState(){
  return {
    version: SAVE_VERSION,
    cash: 10000,
    netWorth: 10000,
    level: 1,
    xp: 0,
    rankName: 'Bedroom Investor',
    streak: 0,
    tick: 0,
    createdAt: Date.now(),
    lastSave: Date.now(),

    holdings: {},
    unlockedSectors: ['TECH', 'BANK'],
    unlockedFeatures: {},
    watchlist: [],

    market: {
      regime: 'normal', regimeTicks: 0, sentiment: 0,
      index: 1000, indexHistory: [],
    },

    startups: [], startupOffers: [],
    deals: [], dealOffers: [],
    ipos: [],
    ownedCompanies: [], acquisitionOffers: [],

    hedgeFund: {
      created: false, name: '', aum: 0, investors: 0,
      analysts: 0, traders: 0, reputation: 50,
      monthlyReturn: 0.01, capitalContributed: 0,
    },

    empire: {
      etfs: 0, investmentBank: false, privateBank: false,
      vcFirm: false, governmentsFinanced: 0, industriesControlled: 0,
      passive: 0,
    },

    news: [], achievements: {}, milestonesHit: {},

    // Power-ups & retention. Timed boosts are absolute epoch-ms expiry stamps.
    boosts: { double: 0, bull: 0, xp: 0 },
    crateReady: 0, instantReady: 0, mysteryReady: 0,
    daily: { last: 0, streak: 0 },

    // Prestige / Legacy meta-progression (persists across reincorporations).
    prestige: { legacy: 0, lifetimeLegacy: 0, reincorporations: 0, upgrades: {} },


    stats: {
      trades: 0, profitableTrades: 0, realizedPnL: 0,
      dividends: 0, dividendIncome: 0,
      startupsInvested: 0, startupReturns: 0, unicorns: 0, decacorns: 0,
      ipos: 0, ipoWins: 0, deals: 0,
      crashesSurvived: 0, blackSwans: 0, recessionsSeen: 0,
      longestHoldTicks: 0, peakNetWorth: 10000, bestStreak: 0,
    },

    settings: { autosave: true, sound: true },
  };
}

/* Build a plausible price walk so charts have depth on day one */
function seedCompanyHistory(c){
  c.price = c.basePrice;
  c.sentiment = 0;
  c.history = [];
  let p = c.basePrice * rand(0.82, 0.95);
  for (let i = 0; i < HIST_SEED; i++){
    const o = p;
    const drift = c.drift + (Math.random() - 0.48) * c.vol * 1.2;
    p = Math.max(0.5, p * (1 + drift));
    const h = Math.max(o, p) * (1 + Math.random() * c.vol * 0.7);
    const l = Math.min(o, p) * (1 - Math.random() * c.vol * 0.7);
    c.history.push({ o, h, l, c: p });
  }
  c.price = c.history[c.history.length - 1].c;
}

function newGame(){
  state = defaultState();
  if (typeof prestigeSeedCash === 'function') state.cash = state.netWorth = prestigeSeedCash();
  COMPANIES.forEach(seedCompanyHistory);
  state.market.indexHistory = [];
  for (let i = 0; i < HIST_SEED; i++) state.market.indexHistory.push(1000 * (1 + (Math.random() - 0.5) * 0.04));
  saveGame(true);
}

function serializeCompanies(){
  return COMPANIES.map(c => ({
    t: c.ticker, p: c.price, s: c.sentiment, h: c.history.slice(-HIST_SAVE),
  }));
}
function restoreCompanies(arr){
  if (!arr) return;
  arr.forEach(o => {
    const c = getCompany(o.t);
    if (c){ c.price = o.p; c.sentiment = o.s || 0; c.history = o.h || []; }
  });
}

function saveGame(silent){
  try {
    state.lastSave = Date.now();
    const blob = { s: state, c: serializeCompanies() };
    store().setItem(SAVE_KEY, JSON.stringify(blob));
    if (!silent && typeof toast === 'function') toast('Game saved', 'gold');
  } catch (e){ console.warn('Save failed', e); }
}

function loadGame(){
  const raw = store().getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const blob = JSON.parse(raw);
    state = Object.assign(defaultState(), blob.s);
    const d = defaultState();
    state.market = Object.assign(d.market, blob.s.market || {});
    state.hedgeFund = Object.assign(d.hedgeFund, blob.s.hedgeFund || {});
    state.empire = Object.assign(d.empire, blob.s.empire || {});
    state.stats = Object.assign(d.stats, blob.s.stats || {});
    state.settings = Object.assign(d.settings, blob.s.settings || {});
    state.boosts = Object.assign(d.boosts, blob.s.boosts || {});
    state.daily = Object.assign(d.daily, blob.s.daily || {});
    state.prestige = Object.assign(d.prestige, blob.s.prestige || {});
    if (!state.prestige.upgrades) state.prestige.upgrades = {};
    restoreCompanies(blob.c);
    return true;
  } catch (e){ console.warn('Load failed', e); return false; }
}

function exportSave(){
  const blob = { s: state, c: serializeCompanies() };
  return btoa(unescape(encodeURIComponent(JSON.stringify(blob))));
}

function importSave(str){
  try {
    const blob = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
    state = Object.assign(defaultState(), blob.s);
    const d = defaultState();
    state.market = Object.assign(d.market, blob.s.market || {});
    state.hedgeFund = Object.assign(d.hedgeFund, blob.s.hedgeFund || {});
    state.empire = Object.assign(d.empire, blob.s.empire || {});
    state.stats = Object.assign(d.stats, blob.s.stats || {});
    state.prestige = Object.assign(d.prestige, blob.s.prestige || {});
    if (!state.prestige.upgrades) state.prestige.upgrades = {};
    restoreCompanies(blob.c);
    return true;
  } catch (e){ return false; }
}

function hardReset(){
  store().removeItem(SAVE_KEY);
  newGame();
}

/* ---------- THEME (stored independently of the save) ---------- */
function loadTheme(){ return store().getItem(THEME_KEY) || 'dark'; }
function saveTheme(t){ store().setItem(THEME_KEY, t); }
