/* ============================================================
   cg.js  —  CrazyGames SDK integration (loaded right after util)

   Wraps the v3 SDK so the rest of the game can use ads, the data
   module, lifecycle events and system info without ever caring
   whether the SDK is actually present. On non-CrazyGames domains
   (the "disabled" environment, file://, or when an adblocker
   removes the SDK script) everything degrades gracefully:
     - storage falls back to localStorage
     - rewarded "ads" resolve instantly so boosts still work
   ============================================================ */

const CG = {
  sdk: null,
  env: 'disabled',          // 'disabled' | 'local' | 'crazygames'
  ready: false,
  adblock: false,
  locale: 'en-US',
  platformMuted: false,
  storage: null,            // {getItem,setItem,removeItem}
  _MIGRATE_KEYS: ['empire_save_v2', 'empire_theme'],

  async init(){
    const SDK = (typeof window !== 'undefined' && window.CrazyGames) ? window.CrazyGames.SDK : null;
    if (!SDK){ this._fallbackStorage(); this.ready = true; return; }
    try { SDK.game.loadingStart(); } catch(e){}
    try {
      await SDK.init();
      this.sdk = SDK;
      this.env = SDK.environment || 'disabled';
    } catch(e){
      this.env = 'disabled';
    }

    if (this.env === 'disabled' || !this.sdk){
      this._fallbackStorage();
      this.ready = true;
      return;
    }

    this._sdkStorage();
    this._migrate();

    // Language: use platform locale (game ships English, falls back to it).
    try { this.locale = (this.sdk.user.systemInfo && this.sdk.user.systemInfo.locale) || 'en-US'; } catch(e){}

    // Honour the platform mute toggle.
    try {
      const apply = (s) => {
        if (s && typeof s.muteAudio === 'boolean'){
          this.platformMuted = s.muteAudio;
          this._syncMute();
        }
      };
      apply(this.sdk.game.settings);
      this.sdk.game.addSettingsChangeListener(apply);
    } catch(e){}

    // Adblock detection (used only to nudge — game stays fully playable).
    try { this.adblock = await this.sdk.ad.hasAdblock(); } catch(e){}

    this.ready = true;
  },

  /* ---------- storage ---------- */
  _fallbackStorage(){ this.storage = localStorage; },
  _sdkStorage(){
    const data = this.sdk.data;
    this.storage = {
      getItem: (k) => { try { return data.getItem(k); } catch(e){ return localStorage.getItem(k); } },
      setItem: (k, v) => { try { data.setItem(k, v); } catch(e){ try { localStorage.setItem(k, v); } catch(_){} } },
      removeItem: (k) => { try { data.removeItem(k); } catch(e){ try { localStorage.removeItem(k); } catch(_){} } },
    };
  },
  // Copy any pre-existing localStorage progress into the data module once.
  _migrate(){
    try {
      this._MIGRATE_KEYS.forEach(k => {
        if (this.storage.getItem(k) == null){
          const v = localStorage.getItem(k);
          if (v != null) this.storage.setItem(k, v);
        }
      });
    } catch(e){}
  },

  /* ---------- audio / loop bridging during ads ---------- */
  _syncMute(){
    if (typeof fxSetMuted !== 'function') return;
    const userWantsSound = (typeof state !== 'undefined' && state && state.settings) ? state.settings.sound : true;
    fxSetMuted(this.platformMuted || !userWantsSound);
  },
  _gamePause(){
    if (typeof pauseGameLoop === 'function') pauseGameLoop();
    try { this.sdk && this.sdk.game.gameplayStop(); } catch(e){}
    if (typeof fxSetMuted === 'function') fxSetMuted(true);
  },
  _gameResume(){
    if (typeof resumeGameLoop === 'function') resumeGameLoop();
    try { this.sdk && this.sdk.game.gameplayStart(); } catch(e){}
    this._syncMute();
  },

  /* ---------- ads ---------- */
  // Rewarded ad. onReward fires when the player earns the reward;
  // onFail only fires when an adblocker blocks it (so we can nudge).
  // Unfilled / cooldown / other errors still grant the reward, and
  // when there is no SDK (local file / disabled env) we grant instantly.
  rewardedAd(onReward, onFail){
    if (!this.sdk || this.env === 'disabled'){ if (onReward) onReward(); return; }
    const done = (grant, failCode) => {
      this._gameResume();
      if (grant){ if (onReward) onReward(); }
      else { if (onFail) onFail(failCode); }
    };
    let settled = false;
    const callbacks = {
      adStarted: () => { this._gamePause(); },
      adFinished: () => { if (settled) return; settled = true; done(true); },
      adError: (err) => {
        if (settled) return; settled = true;
        const code = err && err.code;
        done(code !== 'adblock', code);
      },
    };
    try { this.sdk.ad.requestAd('rewarded', callbacks); }
    catch(e){ if (onReward) onReward(); }
  },

  // Midgame ad for natural breaks. Used sparingly; the SDK enforces
  // its own ~3 min cooldown and we silently ignore failures.
  midgame(){
    if (!this.sdk || this.env === 'disabled') return;
    const callbacks = {
      adStarted: () => { this._gamePause(); },
      adFinished: () => { this._gameResume(); },
      adError: () => { this._gameResume(); },
    };
    try { this.sdk.ad.requestAd('midgame', callbacks); } catch(e){}
  },

  /* ---------- lifecycle / feedback ---------- */
  gameplayStart(){ try { this.sdk && this.sdk.game.gameplayStart(); } catch(e){} },
  gameplayStop(){ try { this.sdk && this.sdk.game.gameplayStop(); } catch(e){} },
  loadingStop(){ try { this.sdk && this.sdk.game.loadingStop(); } catch(e){} },
  happytime(){ try { this.sdk && this.sdk.game.happytime(); } catch(e){} },
};
