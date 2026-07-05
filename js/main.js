/* ============================================================
   main.js  —  Bootstrap + game loop
   ============================================================ */

let _tickTimer = null, _autosaveTimer = null, _renderTimer = null;

function init(){
  ACHIEVEMENTS = buildAchievements();

  applyTheme(loadTheme());

  if (!loadGame()){
    newGame();
  } else if (!COMPANIES[0].history.length){
    newGame();
  }

  // apply persisted sound preference
  if (typeof fxSetMuted === 'function') fxSetMuted(!state.settings.sound);
  updateSoundBtn();

  computeNetWorth();
  buildNav();
  rebuildMarketTable();
  const first = COMPANIES.find(c=>state.unlockedSectors.includes(c.sector));
  if (first) selectedTicker = first.ticker;

  switchView('dashboard');
  renderAll();
  wireControls();

  if (!state.news.length) pushNews('Markets open. Your $10,000 journey begins.', 0.05, 'global', true);

  startLoops();
  offlineProgress();
}

function gameTick(){
  state.tick++;

  // Snapshot cash so the Double Income power-up can double everything
  // earned passively this tick (dividends, passive, exits, deal payouts).
  const cashBefore = state.cash;

  tickMarket();
  tickHoldings();
  tickStartups();
  tickDeals();
  tickIPOs();
  tickOwned();
  tickHedgeFund();

  if (state.tick % 3 === 0) generateNews();
  maybeSpecialEvent();
  maybeBlackSwan();
  if (state.tick % 4 === 0){ maybeGenerateStartupOffer(); maybeGenerateIPO(); maybeGenerateDeal(); }
  if (state.tick % 30 === 0) payDividends();

  if (state.empire.passive > 0) state.cash += state.empire.passive;

  // Apply the permanent prestige income multiplier (Compound Interest) and the
  // Double Income power-up to everything earned passively this tick, in one place.
  const gained = state.cash - cashBefore;
  if (gained > 0){
    let total = gained;
    if (typeof incomeMult === 'function') total *= incomeMult();
    if (typeof boostActive === 'function' && boostActive('double')) total *= 2;
    state.cash = cashBefore + total;
  }

  computeNetWorth();
  checkSectorUnlocks();
  checkMilestones();
  checkAchievements();

  renderAll();
  if (typeof updateBoostUI === 'function') updateBoostUI();
  if (currentView === 'boosts' && typeof renderBoosts === 'function') renderBoosts();

  if (state.tick % 5 === 0){
    if (currentView==='startups') renderStartups();
    else if (currentView==='deals') renderDeals();
    else if (currentView==='ipos') renderIPOs();
    else if (currentView==='acquisitions') renderAcquisitions();
    else if (currentView==='empire') renderEmpire();
    else if (currentView==='legacy') renderPrestige();
  }
}

function renderTick(){
  if (typeof state === 'undefined' || !state) return;   // guard: theme can call this pre-init
  if (currentView==='dashboard'){
    drawLineChart('indexChart', state.market.indexHistory.slice(-120));
  } else if (currentView==='market' && selectedTicker){
    const c = getCompany(selectedTicker);
    if (c) drawCandles('tradeChart', c.history);
    updateMarketPrices();
  }
}

function startLoops(){
  clearInterval(_tickTimer); clearInterval(_autosaveTimer); clearInterval(_renderTimer);
  _tickTimer = setInterval(gameTick, 1000);
  _renderTimer = setInterval(renderTick, 300);
  _autosaveTimer = setInterval(()=>{ if (state.settings.autosave) saveGame(true); }, 30000);
}

/* Pause/resume only the simulation tick — used while a video ad plays
   (the SDK calls these via CG._gamePause / _gameResume). */
function pauseGameLoop(){ clearInterval(_tickTimer); _tickTimer = null; }
function resumeGameLoop(){ if (!_tickTimer) _tickTimer = setInterval(gameTick, 1000); }

function offlineProgress(){
  const elapsed = (Date.now() - (state.lastSave||Date.now()))/1000;
  if (elapsed < 60) return;
  const capH = (typeof prestigeOfflineCapHours === 'function') ? prestigeOfflineCapHours() : 8;
  const ticks = Math.min(Math.floor(elapsed), capH*3600);
  let earned = passivePerSec(state) * ticks;   // passivePerSec already includes incomeMult
  if (typeof prestigeOfflineMult === 'function') earned *= prestigeOfflineMult();
  if (earned > 0){
    state.cash += earned;
    computeNetWorth();
    setTimeout(()=>{
      showModal(`<h3 class="gold">Welcome Back</h3>
        <p class="muted" style="margin-bottom:14px;">While you were away (${fmtDuration(elapsed)}), your empire kept working.</p>
        <div class="kv"><span class="k">Passive Income Earned</span><span class="v pos mono">+${fmtMoney(earned)}</span></div>
        <button class="btn gold" style="margin-top:16px;width:100%" onclick="closeModal()">Collect</button>`);
    }, 600);
  }
}
function fmtDuration(s){
  if (s<60) return Math.floor(s)+'s';
  if (s<3600) return Math.floor(s/60)+'m';
  return Math.floor(s/3600)+'h '+Math.floor((s%3600)/60)+'m';
}

function updateSoundBtn(){
  const b = $('btn-sound'); if (b) b.textContent = state.settings.sound ? '🔊' : '🔇';
}

function wireControls(){
  $('btn-save').onclick = () => saveGame();
  $('btn-theme').onclick = () => toggleTheme();
  $('btn-sound').onclick = () => {
    state.settings.sound = !state.settings.sound;
    if (typeof fxSetMuted === 'function') fxSetMuted(!state.settings.sound);
    updateSoundBtn();
    if (state.settings.sound && typeof sfx === 'function'){ if (typeof fxResume==='function') fxResume(); sfx('coin'); }
  };
  // browsers require a user gesture before audio can start
  document.addEventListener('pointerdown', () => { if (typeof fxResume==='function') fxResume(); }, { once:true });
  $('btn-reset').onclick = () => {
    showModal(`<h3 class="neg">Reset Empire?</h3>
      <p class="muted" style="margin-bottom:16px;">This permanently deletes your save and restarts from $10,000.</p>
      <div class="btn-row">
        <button class="btn sell" style="flex:1" onclick="doReset()">Delete & Restart</button>
        <button class="btn" style="flex:1" onclick="closeModal()">Cancel</button>
      </div>`);
  };
  $('btn-data').onclick = () => {
    showModal(`<h3>Import / Export Save</h3>
      <p class="muted" style="margin-bottom:10px;">Copy this code to back up, or paste a code to restore.</p>
      <textarea id="save-data">${exportSave()}</textarea>
      <div class="btn-row" style="margin-top:14px;">
        <button class="btn gold" style="flex:1" onclick="doImport()">Import Pasted Code</button>
        <button class="btn blue" style="flex:1" onclick="copySave()">Copy Code</button>
        <button class="btn" onclick="closeModal()">Close</button>
      </div>`);
  };
  const bo = $('boost-open'); if (bo) bo.onclick = () => switchView('boosts');
  $('modal-bg').onclick = (e)=>{ if (e.target.id==='modal-bg') closeModal(); };

  document.addEventListener('keydown', e => {
    if (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    // Number keys mirror the sidebar order (1 = top icon … 0 = tenth icon)
    const map = {'1':'dashboard','2':'market','3':'portfolio','4':'boosts','5':'startups','6':'ipos','7':'deals','8':'acquisitions','9':'hedgefund','0':'empire'};
    if (map[e.key]) switchView(map[e.key]);
  });
}

function doReset(){ closeModal(); clearInterval(_tickTimer); hardReset(); location.reload(); }
function doImport(){
  const v = $('save-data').value;
  if (importSave(v)){ closeModal(); toast('Save imported', 'gold'); saveGame(true); location.reload(); }
  else toast('Invalid save code', 'red');
}
function copySave(){
  const ta = $('save-data'); ta.select();
  try { navigator.clipboard.writeText(ta.value); toast('Copied to clipboard', 'blue'); }
  catch(e){ document.execCommand('copy'); toast('Copied', 'blue'); }
}

window.addEventListener('beforeunload', ()=>saveGame(true));
window.addEventListener('resize', ()=>renderTick());

/* Boot: initialise the CrazyGames SDK first (storage, locale, mute,
   adblock), then start the game, then report that loading is done and
   gameplay has begun. SDK calls are all no-ops off-platform. */
async function boot(){
  // Never let a slow/blocked SDK stall the game. If init() hasn't resolved
  // within 3s we start anyway; store() falls back to localStorage until the
  // SDK (if any) finishes wiring up.
  if (typeof CG !== 'undefined'){
    try { await Promise.race([ CG.init(), new Promise(r => setTimeout(r, 3000)) ]); } catch(e){}
  }
  try { init(); } catch(e){ console.error('init failed', e); }
  if (typeof updateBoostUI === 'function') updateBoostUI();
  if (typeof CG !== 'undefined'){ CG.gameplayStart(); CG.loadingStop(); }
  hideSplash();
}
function hideSplash(){
  const s = document.getElementById('splash');
  if (s) setTimeout(() => s.classList.add('hide'), 350);   // a short beat so the brand reads
}
// Failsafe: never let the splash trap the player if boot stalls.
setTimeout(() => { const s = document.getElementById('splash'); if (s) s.classList.add('hide'); }, 7000);
window.addEventListener('DOMContentLoaded', boot);
