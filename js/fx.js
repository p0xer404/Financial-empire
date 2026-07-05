/* ============================================================
   fx.js  —  Web Audio sound effects + particle confetti
   Self-contained, all functions globally available and guarded.
   ============================================================ */

/* ---------------- SOUND ---------------- */
let _actx = null, _muted = false, _masterGain = null;

function fxInitAudio(){
  if (_actx) return _actx;
  try {
    _actx = new (window.AudioContext || window.webkitAudioContext)();
    _masterGain = _actx.createGain();
    _masterGain.gain.value = 0.5;
    _masterGain.connect(_actx.destination);
  } catch(e){ _actx = null; }
  return _actx;
}
function fxSetMuted(m){ _muted = m; }
function fxMuted(){ return _muted; }
function fxResume(){ if (_actx && _actx.state === 'suspended') _actx.resume(); }

/* one oscillator note */
function _note(freq, t0, dur, type, vol){
  const ctx = _actx;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(_masterGain);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
/* pitch glide note */
function _glide(f1, f2, t0, dur, type, vol){
  const ctx = _actx;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(f1, t0);
  o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(_masterGain);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

const NOTE = { C5:523.25, E5:659.25, G5:783.99, C6:1046.5, E6:1318.5, G6:1568, A5:880, D6:1174.7 };

function sfx(name, opt){
  if (_muted) return;
  const ctx = fxInitAudio(); if (!ctx) return;
  fxResume();
  const t = ctx.currentTime;
  switch(name){
    case 'click':   _note(420, t, 0.05, 'square', 0.05); break;
    case 'tab':     _note(560, t, 0.06, 'triangle', 0.06); break;
    case 'buy':     _glide(330, 520, t, 0.12, 'triangle', 0.12); break;
    case 'sell':    _glide(520, 360, t, 0.12, 'triangle', 0.10); break;
    case 'profit':  // pleasant coin ascend
      _note(NOTE.E5, t, 0.09, 'triangle', 0.12);
      _note(NOTE.G5, t+0.06, 0.10, 'triangle', 0.12);
      _note(NOTE.C6, t+0.13, 0.16, 'triangle', 0.13);
      break;
    case 'coin':    _note(NOTE.G5, t, 0.06,'square',0.07); _note(NOTE.C6, t+0.04,0.10,'square',0.07); break;
    case 'loss':    _glide(300, 150, t, 0.25, 'sawtooth', 0.10); break;
    case 'error':   _note(160, t, 0.16, 'sawtooth', 0.10); break;
    case 'xp':      _note(NOTE.C5, t,0.06,'triangle',0.08); _note(NOTE.G5,t+0.05,0.08,'triangle',0.08); break;
    case 'levelup':
      [NOTE.C5,NOTE.E5,NOTE.G5,NOTE.C6].forEach((f,i)=>_note(f, t+i*0.07, 0.16,'triangle',0.13));
      break;
    case 'unlock':
      _note(NOTE.G5, t, 0.12,'triangle',0.12);
      _note(NOTE.C6, t+0.08, 0.18,'triangle',0.13);
      _note(NOTE.E6, t+0.18, 0.22,'sine',0.12);
      break;
    case 'milestone':
      [NOTE.C5,NOTE.E5,NOTE.G5,NOTE.C6,NOTE.E6,NOTE.G6].forEach((f,i)=>_note(f, t+i*0.08, 0.4,'triangle',0.13));
      _note(NOTE.C6, t+0.5, 0.7, 'sine', 0.10);
      break;
    case 'streak': {
      const n = clamp((opt&&opt.level)||1, 1, 12);
      const base = 520 + n*60;
      _glide(base, base*1.6, t, 0.16, 'square', 0.11);
      break;
    }
    case 'event':   _glide(700, 900, t, 0.2, 'sine', 0.10); _note(NOTE.A5, t+0.12, 0.2,'sine',0.08); break;
    case 'offer':   _note(NOTE.A5, t, 0.1,'sine',0.09); _note(NOTE.D6, t+0.08,0.14,'sine',0.09); break;
    case 'crash':   _glide(400, 80, t, 0.7, 'sawtooth', 0.13); break;
  }
}

/* ---------------- CONFETTI ---------------- */
let _confCanvas = null, _confCtx = null, _confParts = [], _confRAF = null;

function _ensureConfetti(){
  if (_confCanvas) return;
  _confCanvas = document.createElement('canvas');
  _confCanvas.id = 'confetti-canvas';
  _confCanvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:210;';
  document.body.appendChild(_confCanvas);
  _confCtx = _confCanvas.getContext('2d');
  _resizeConfetti();
  window.addEventListener('resize', _resizeConfetti);
}
function _resizeConfetti(){
  if (!_confCanvas) return;
  const r = window.devicePixelRatio || 1;
  _confCanvas.width = innerWidth * r; _confCanvas.height = innerHeight * r;
  _confCtx.setTransform(r,0,0,r,0,0);
}

function burstConfetti(opts){
  _ensureConfetti();
  opts = opts || {};
  const colors = opts.colors || ['#e7c873','#cda84e','#24c87c','#4b9fff','#ffffff'];
  const count = opts.count || 140;
  const originY = opts.originY != null ? opts.originY : innerHeight * 0.42;
  for (let i = 0; i < count; i++){
    const ang = rand(-Math.PI, Math.PI);
    const spd = rand(4, 15);
    _confParts.push({
      x: innerWidth/2, y: originY,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - rand(3, 9),
      g: rand(0.18, 0.34),
      size: rand(5, 11),
      rot: rand(0, Math.PI*2),
      vr: rand(-0.3, 0.3),
      color: pick(colors),
      life: rand(70, 130),
      shape: Math.random() < 0.5 ? 'rect' : 'circ',
    });
  }
  if (!_confRAF) _confLoop();
}

function _confLoop(){
  _confCtx.clearRect(0,0,innerWidth,innerHeight);
  for (let i = _confParts.length - 1; i >= 0; i--){
    const p = _confParts[i];
    p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr; p.life--;
    if (p.life <= 0 || p.y > innerHeight + 30){ _confParts.splice(i,1); continue; }
    _confCtx.save();
    _confCtx.translate(p.x, p.y);
    _confCtx.rotate(p.rot);
    _confCtx.globalAlpha = clamp(p.life/40, 0, 1);
    _confCtx.fillStyle = p.color;
    if (p.shape === 'rect') _confCtx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.6);
    else { _confCtx.beginPath(); _confCtx.arc(0,0,p.size/2,0,Math.PI*2); _confCtx.fill(); }
    _confCtx.restore();
  }
  if (_confParts.length){ _confRAF = requestAnimationFrame(_confLoop); }
  else { _confCtx.clearRect(0,0,innerWidth,innerHeight); _confRAF = null; }
}
