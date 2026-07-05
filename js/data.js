/* ============================================================
   data.js  —  Static game database
   ============================================================ */

const SECTORS = {
  TECH:     { id: 'TECH',     name: 'Technology',              color: '#4da3ff', unlockAt: 0 },
  BANK:     { id: 'BANK',     name: 'Banking',                color: '#c9a227', unlockAt: 0 },
  HEALTH:   { id: 'HEALTH',   name: 'Healthcare',             color: '#3ddc84', unlockAt: 100000 },
  ENERGY:   { id: 'ENERGY',   name: 'Energy',                 color: '#ff8c42', unlockAt: 250000 },
  RETAIL:   { id: 'RETAIL',   name: 'Retail',                 color: '#ff5fa2', unlockAt: 500000 },
  AI:       { id: 'AI',       name: 'Artificial Intelligence',color: '#a06bff', unlockAt: 1000000 },
  DEFENSE:  { id: 'DEFENSE',  name: 'Defense',                color: '#8a8f98', unlockAt: 5000000 },
  BIOTECH:  { id: 'BIOTECH',  name: 'Biotechnology',          color: '#2ee6c8', unlockAt: 10000000 },
  ROBOTICS: { id: 'ROBOTICS', name: 'Robotics',               color: '#ffd166', unlockAt: 50000000 },
  SPACE:    { id: 'SPACE',    name: 'Space Industry',         color: '#7c9cff', unlockAt: 100000000 },
};

function C(name, ticker, sector, price, mcap, vol, risk, growth, div, rep, beta, drift) {
  return { name, ticker, sector, price, basePrice: price, mcap, vol, risk, growth,
           div, rep, beta, drift, history: [], sentiment: 0 };
}

const COMPANIES = [
  C('NovaTech Systems','NVTS','TECH',  142.50, 480e9, 0.018, 3, 4, 0.008, 78, 1.1, 0.00022),
  C('Apex Computing','APXC','TECH',     88.20, 210e9, 0.020, 3, 3, 0.012, 71, 1.0, 0.00016),
  C('Quantum Digital','QDGT','TECH',   311.75, 690e9, 0.024, 4, 5, 0.004, 82, 1.3, 0.00030),
  C('Zenith Technologies','ZNTH','TECH',57.40, 95e9,  0.022, 3, 4, 0.006, 66, 1.1, 0.00020),
  C('HyperLink Networks','HLNK','TECH', 23.10, 38e9,  0.028, 4, 4, 0.000, 60, 1.2, 0.00024),

  C('Titan Capital','TCAP','BANK',     176.30, 320e9, 0.012, 2, 2, 0.030, 80, 0.8, 0.00010),
  C('Sovereign Bank Group','SBG','BANK',64.90, 180e9, 0.011, 2, 2, 0.035, 77, 0.7, 0.00008),
  C('NorthStar Financial','NSF','BANK', 41.25, 72e9,  0.014, 3, 2, 0.028, 69, 0.9, 0.00009),
  C('Prime Equity Holdings','PEH','BANK',98.60, 140e9,0.013, 2, 3, 0.025, 74, 0.85,0.00012),
  C('Vertex Banking Corp','VBC','BANK', 52.80, 88e9,  0.015, 3, 2, 0.032, 65, 0.9, 0.00009),

  C('MedCore Health','MCH','HEALTH',   130.40, 250e9, 0.014, 2, 3, 0.018, 79, 0.7, 0.00014),
  C('BioNova Labs','BNL','HEALTH',      72.15, 96e9,  0.026, 4, 4, 0.004, 64, 1.1, 0.00022),
  C('VitaGen Therapeutics','VGT','HEALTH',46.30,55e9, 0.030, 4, 5, 0.000, 58, 1.2, 0.00026),
  C('PureLife Pharma','PLP','HEALTH',  108.90, 175e9, 0.016, 2, 3, 0.022, 75, 0.8, 0.00013),
  C('Helix Medical Systems','HMS','HEALTH',88.70,120e9,0.020,3, 4, 0.010, 70, 0.95,0.00018),

  C('FusionGrid Energy','FGE','ENERGY', 64.50, 110e9, 0.030, 4, 5, 0.006, 62, 1.2, 0.00028),
  C('Titan Oil & Gas','TOG','ENERGY',   91.20, 260e9, 0.018, 3, 2, 0.040, 73, 1.1, 0.00006),
  C('SolarWave Power','SWP','ENERGY',   37.80, 64e9,  0.026, 4, 4, 0.012, 66, 1.15,0.00022),
  C('Horizon Renewables','HRN','ENERGY',54.60, 98e9,  0.022, 3, 4, 0.014, 68, 1.0, 0.00020),
  C('Infinity Energy Group','IEG','ENERGY',120.30,300e9,0.016,2,3, 0.030, 76, 0.9, 0.00012),

  C('UrbanCart','UCRT','RETAIL',        58.40, 88e9,  0.020, 3, 4, 0.006, 67, 1.0, 0.00018),
  C('PrimeMarket Holdings','PMH','RETAIL',142.70,260e9,0.014,2, 3, 0.020, 78, 0.85,0.00014),
  C('OmniStore Global','OSG','RETAIL',  205.10, 410e9, 0.016, 2, 4, 0.010, 81, 0.95,0.00020),
  C('NextBuy Commerce','NBC','RETAIL',  33.90, 47e9,  0.024, 4, 4, 0.000, 61, 1.1, 0.00022),
  C('Metro Retail Group','MRG','RETAIL',71.25, 102e9, 0.015, 2, 2, 0.026, 70, 0.8, 0.00010),

  C('QuantumAI','QAI','AI',            420.90, 980e9, 0.032, 5, 5, 0.000, 88, 1.5, 0.00040),
  C('Neural Dynamics','NDYN','AI',     188.50, 360e9, 0.030, 4, 5, 0.000, 79, 1.4, 0.00036),
  C('DeepMind Labs Intl','DMLI','AI',  264.30, 540e9, 0.034, 5, 5, 0.000, 84, 1.5, 0.00042),
  C('Cortex Intelligence','CRTX','AI',  97.60, 150e9, 0.036, 5, 5, 0.000, 72, 1.45,0.00038),
  C('Atlas AI Systems','ATLS','AI',    142.80, 280e9, 0.031, 4, 5, 0.000, 76, 1.4, 0.00036),

  C('IronShield Defense','ISD','DEFENSE',156.40,300e9,0.014, 2, 3, 0.020, 80, 0.7, 0.00014),
  C('Vanguard Military Sys','VMS','DEFENSE',98.20,180e9,0.016,3, 3, 0.018, 74, 0.8, 0.00013),
  C('Sentinel Dynamics','SNDL','DEFENSE',124.70,230e9,0.018, 3, 4, 0.012, 77, 0.9, 0.00018),
  C('Titan Defense Ind','TDI','DEFENSE',211.50,420e9,0.013, 2, 3, 0.022, 82, 0.7, 0.00015),
  C('Blackstone Aero Def','BAD','DEFENSE',76.90,128e9,0.020, 4, 4, 0.008, 69, 1.0, 0.00020),

  C('GeneForge Labs','GFL','BIOTECH',   58.30, 72e9,  0.040, 5, 5, 0.000, 63, 1.3, 0.00034),
  C('NovaCell Therapeutics','NCT','BIOTECH',83.40,110e9,0.038,5, 5, 0.000, 67, 1.3, 0.00036),
  C('BioQuantum Research','BQR','BIOTECH',112.60,160e9,0.036,5,5, 0.000, 71, 1.25,0.00034),
  C('HelixGen Industries','HGI','BIOTECH',44.20,58e9, 0.042, 5, 5, 0.000, 59, 1.35,0.00038),
  C('LifeCode Systems','LCS','BIOTECH', 95.80, 130e9, 0.034, 4, 5, 0.004, 70, 1.2, 0.00032),

  C('RoboCore Industries','RCI','ROBOTICS',138.50,280e9,0.028,4, 5, 0.006, 75, 1.3, 0.00030),
  C('Nexus Automation','NXA','ROBOTICS',102.30,190e9,0.026,4, 4, 0.008, 72, 1.2, 0.00028),
  C('MechaDynamics','MCD','ROBOTICS',   67.90, 105e9, 0.030, 4, 5, 0.000, 66, 1.3, 0.00032),
  C('Atlas Robotics Group','ARG','ROBOTICS',184.70,370e9,0.027,4,5,0.004, 80, 1.25,0.00030),
  C('OmniBot Systems','OBS','ROBOTICS', 49.60, 70e9,  0.033, 5, 5, 0.000, 62, 1.35,0.00034),

  C('Stellar Frontier','SFR','SPACE',   78.40, 130e9, 0.040, 5, 5, 0.000, 70, 1.4, 0.00040),
  C('NovaSpace Industries','NSI','SPACE',146.20,290e9,0.038,5, 5, 0.000, 78, 1.45,0.00042),
  C('Orbital Dynamics','ORD','SPACE',   54.80, 82e9,  0.044, 5, 5, 0.000, 64, 1.5, 0.00044),
  C('Titan Aerospace','TAS','SPACE',    198.30, 400e9, 0.034, 4, 5, 0.004, 83, 1.35,0.00038),
  C('DeepSpace Ventures','DSV','SPACE',  41.10, 60e9, 0.048, 5, 5, 0.000, 60, 1.55,0.00046),
];

const LEVEL_UNLOCKS = {
  5:   { key: 'analystReports',  name: 'Analyst Reports (ratings + price targets)' },
  10:  { key: 'advancedCharts',  name: 'Advanced Charts (MA20 overlay)' },
  15:  { key: 'marketScanner',   name: 'Market Scanner (Top Movers)' },
  20:  { key: 'options',         name: 'Options Desk (+25% trade XP)' },
  25:  { key: 'forecasts',       name: 'Economic Forecasts (next regime)' },
  30:  { key: 'privateInvest',   name: 'Private Deal Network (2× offers)' },
  40:  { key: 'startups',        name: 'Startup Investments' },
  50:  { key: 'acquisitions',    name: 'Company Acquisitions' },
  60:  { key: 'privateEquity',   name: 'Private Equity Deals' },
  75:  { key: 'hedgeFund',       name: 'Hedge Fund Creation' },
  100: { key: 'globalFinance',   name: 'Global Finance Systems' },
};

const MILESTONES = [
  { v: 100000,       rank: 'Retail Investor',        tag: '$100K' },
  { v: 1000000,      rank: 'Millionaire',            tag: '$1M' },
  { v: 10000000,     rank: 'Professional Trader',    tag: '$10M' },
  { v: 100000000,    rank: 'Venture Capitalist',     tag: '$100M' },
  { v: 1000000000,   rank: 'Billionaire Titan',      tag: '$1B' },
  { v: 10000000000,  rank: 'Financial Mogul',        tag: '$10B' },
  { v: 100000000000, rank: 'Master of the Economy',  tag: '$100B' },
  { v: 1e12,         rank: 'Trillionaire',           tag: '$1T' },
  { v: 1e13,         rank: 'Global Tycoon',          tag: '$10T' },
  { v: 1e14,         rank: 'World Banker',           tag: '$100T' },
  { v: 1e15,         rank: 'Economic Sovereign',     tag: '$1Qa' },
];

const STARTUP_NAMES = ['Quantum','Nano','Hyper','Neuro','Astro','Bio','Cryo','Vertex','Helio','Lumen',
  'Synth','Orbital','Fusion','Sigma','Omega','Cipher','Nimbus','Aether','Pulse','Vortex'];
const STARTUP_SUFFIX = ['Robotics','AI','Labs','Dynamics','Genomics','Systems','Networks','Spaceworks',
  'Therapeutics','Compute','Energy','Mobility','Materials','Bioworks'];
const FOUNDER_FIRST = ['Ethan','Maya','Liam','Sofia','Noah','Aria','Lucas','Chloe','Mateo','Ava',
  'Kai','Nora','Ivan','Lena','Omar','Zara','Theo','Iris','Dmitri','Yuki'];
const FOUNDER_LAST = ['Brooks','Chen','Patel','Okafor','Ivanov','Reyes','Kim','Novak','Sato','Haddad',
  'Lindqvist','Moreau','Singh','Costa','Aaltonen','Vasquez','Becker','Romano'];
const STARTUP_SECTORS = ['AI Robotics','Fusion Energy','Biotech','Space Tech','Quantum Computing',
  'Defense Tech','Neurotech','Synthetic Biology','Autonomous Systems','Advanced Materials'];

const DEAL_TYPES = [
  { type: 'Private Equity',         minRet: 1.4, maxRet: 3.2, fail: 0.12 },
  { type: 'Distressed Buyout',      minRet: 1.1, maxRet: 5.0, fail: 0.28 },
  { type: 'Pre-IPO Allocation',     minRet: 1.3, maxRet: 4.5, fail: 0.18 },
  { type: 'Luxury Real Estate',     minRet: 1.2, maxRet: 2.1, fail: 0.05 },
  { type: 'Infrastructure Project', minRet: 1.15,maxRet: 1.9, fail: 0.04 },
  { type: 'Private Debt',           minRet: 1.12,maxRet: 1.5, fail: 0.08 },
  { type: 'Special Acquisition',    minRet: 1.5, maxRet: 6.0, fail: 0.22 },
];

const NEWS_TEMPLATES = {
  companyPos: [
    '{C} posts record-breaking quarterly earnings',
    '{C} unveils breakthrough product line',
    'Analysts upgrade {C} to Strong Buy',
    '{C} announces major share buyback program',
    '{C} secures landmark government contract',
    '{C} expands into new global markets',
  ],
  companyNeg: [
    '{C} misses earnings expectations',
    '{C} faces regulatory investigation',
    'Analysts downgrade {C} amid concerns',
    '{C} announces surprise CEO departure',
    '{C} hit by product recall',
    'Lawsuit filed against {C}',
  ],
  sectorPos: [
    '{S} sector rallies on strong demand',
    'Government increases {S} spending',
    'Investors pile into {S} stocks',
    '{S} breakthrough fuels optimism',
  ],
  sectorNeg: [
    '{S} sector under pressure',
    'Regulators tighten rules on {S}',
    'Demand cools across {S} sector',
  ],
  global: [
    { t: 'Central bank signals rate cuts', impact: +0.04 },
    { t: 'Inflation comes in hotter than expected', impact: -0.05 },
    { t: 'Global trade tensions escalate', impact: -0.06 },
    { t: 'Consumer confidence hits record high', impact: +0.05 },
    { t: 'Unemployment falls to historic lows', impact: +0.04 },
    { t: 'Tech earnings season beats forecasts', impact: +0.05 },
  ],
};

function buildAchievements() {
  const list = [];
  const add = (id, name, desc, check) => list.push({ id, name, desc, check, done: false });

  const nwSteps = [
    [25000,'Pocket Change'],[50000,'Getting Started'],[100000,'Six Figures'],
    [250000,'Quarter Million'],[500000,'Half a Million'],[1e6,'Millionaire'],
    [2.5e6,'Multi-Millionaire'],[5e6,'High Roller'],[10e6,'Eight Figures'],
    [25e6,'Serious Money'],[50e6,'Fifty Million Club'],[100e6,'Nine Figures'],
    [250e6,'Quarter Billion'],[500e6,'Half a Billion'],[1e9,'Billionaire'],
    [5e9,'Mega Billionaire'],[10e9,'Ten Figures'],[50e9,'Financial Titan'],
    [100e9,'Master of the Economy'],[250e9,'Quarter Trillion'],[500e9,'Approaching Trillion'],
    [1e12,'Trillionaire'],
  ];
  nwSteps.forEach(([v,n],i)=>add('nw'+i,n,`Reach $${fmtShort(v)} net worth`,s=>s.netWorth>=v));

  [50000,100000,500000,1e6,10e6,100e6,1e9,10e9].forEach((v,i)=>
    add('cash'+i,'Liquidity '+(i+1),`Hold $${fmtShort(v)} in cash`,s=>s.cash>=v));

  [1,5,10,25,50,100,250,500,1000,2500,5000].forEach((v,i)=>
    add('trade'+i,'Trader '+(i+1),`Execute ${v} trades`,s=>s.stats.trades>=v));

  [1,10,50,100,500,1000].forEach((v,i)=>
    add('ptrade'+i,'Winner '+(i+1),`Close ${v} profitable trades`,s=>s.stats.profitableTrades>=v));

  [1,10,100,1000].forEach((v,i)=>
    add('div'+i,'Dividend Collector '+(i+1),`Collect ${v} dividend payments`,s=>s.stats.dividends>=v));
  [1000,100000,1e6,100e6].forEach((v,i)=>
    add('divamt'+i,'Yield Hunter '+(i+1),`Earn $${fmtShort(v)} in dividends total`,s=>s.stats.dividendIncome>=v));

  [5,10,15,20,25,30,40,50,60,75,100].forEach((v,i)=>
    add('lvl'+i,'Level '+v,`Reach player level ${v}`,s=>s.level>=v));

  Object.values(SECTORS).forEach((sec,i)=>
    add('sec'+i,'Discover '+sec.name,`Unlock the ${sec.name} sector`,s=>s.unlockedSectors.includes(sec.id)));

  [1,3,5,10,20,30,40,50].forEach((v,i)=>
    add('hold'+i,'Diversified '+(i+1),`Hold ${v} different stocks at once`,s=>Object.keys(s.holdings).filter(t=>s.holdings[t].qty>0).length>=v));

  [100000,1e6,10e6,100e6,1e9].forEach((v,i)=>
    add('pos'+i,'Big Position '+(i+1),`Hold a single position worth $${fmtShort(v)}`,s=>{
      return Object.keys(s.holdings).some(t=>{const c=getCompany(t);return c&&s.holdings[t].qty*c.price>=v;});
    }));

  [1,3,5,10,25].forEach((v,i)=>
    add('su'+i,'Angel '+(i+1),`Invest in ${v} startups`,s=>s.stats.startupsInvested>=v));
  add('unicorn','Unicorn Hunter','Own a startup that reaches $1B valuation',s=>s.stats.unicorns>=1);
  add('decacorn','Decacorn Maker','Own a startup that reaches $10B valuation',s=>s.stats.decacorns>=1);
  [1e6,10e6,100e6,1e9].forEach((v,i)=>
    add('suret'+i,'VC Returns '+(i+1),`Earn $${fmtShort(v)} from startup exits`,s=>s.stats.startupReturns>=v));

  [1,5,10].forEach((v,i)=>add('ipo'+i,'IPO Player '+(i+1),`Participate in ${v} IPOs`,s=>s.stats.ipos>=v));
  add('ipowin','IPO Jackpot','Profit big from a successful IPO',s=>s.stats.ipoWins>=1);

  [1,5,10,25].forEach((v,i)=>add('deal'+i,'Insider '+(i+1),`Close ${v} exclusive deals`,s=>s.stats.deals>=v));

  [1,3,5,10].forEach((v,i)=>add('acq'+i,'Tycoon '+(i+1),`Acquire ${v} companies`,s=>s.ownedCompanies.length>=v));
  [1e6,10e6,100e6,1e9].forEach((v,i)=>
    add('passive'+i,'Passive Power '+(i+1),`Reach $${fmtShort(v)}/sec passive income`,s=>passivePerSec(s)>=v));

  add('hf','Fund Manager','Create your own hedge fund',s=>s.hedgeFund.created);
  [1e9,10e9,100e9].forEach((v,i)=>add('aum'+i,'AUM '+(i+1),`Reach $${fmtShort(v)} assets under management`,s=>s.hedgeFund.aum>=v));

  add('etf','ETF Architect','Launch your first ETF',s=>s.empire.etfs>0);
  add('ibank','Investment Banker','Launch an investment bank',s=>s.empire.investmentBank);
  add('govt','Kingmaker','Finance a government',s=>s.empire.governmentsFinanced>0);

  // Prestige / Legacy
  add('reinc1','Reincorporated','Reincorporate your empire for the first time',s=>s.prestige&&s.prestige.reincorporations>=1);
  [3,10,25].forEach((v,i)=>add('reinc'+(i+2),'Serial Founder '+(i+1),`Reincorporate ${v} times`,s=>s.prestige&&s.prestige.reincorporations>=v));
  [10,100,1000,10000].forEach((v,i)=>add('legacy'+i,'Legacy '+(i+1),`Bank ${v} lifetime Legacy shares`,s=>s.prestige&&s.prestige.lifetimeLegacy>=v));

  add('first','First Trade','Execute your very first trade',s=>s.stats.trades>=1);
  add('diamond','Diamond Hands','Hold a position for a long time',s=>s.stats.longestHoldTicks>=600);
  add('crash','Survivor','Live through a market crash',s=>s.stats.crashesSurvived>=1);
  add('blackswan','Black Swan','Witness a black swan event',s=>s.stats.blackSwans>=1);
  add('night','Night Owl','Play during a recession',s=>s.stats.recessionsSeen>=1);
  add('allsec','Economic Mapper','Discover every sector',s=>s.unlockedSectors.length>=Object.keys(SECTORS).length);

  return list;
}

function getCompany(ticker){ return COMPANIES.find(c=>c.ticker===ticker); }
