import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Activity, Box, Search, Copy, Check, Shield, ShieldAlert, Zap, Clock,
  TrendingUp, Hash, Wallet, Layers, Settings, X, ArrowRight, ChevronRight,
  Cpu, Globe, AlertTriangle, CheckCircle2, Wifi, Gauge
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, RadialBarChart, RadialBar, PolarAngleAxis
} from "recharts";

/* ============================================================
 * TideExplorer — Tidecoin (TDC) Post-Quantum Block Explorer
 * Single-file React app. Mock data engine + RPC-ready abstraction.
 * ============================================================ */

/* ---------- CONFIG ---------- */
const CONFIG = {
  USE_LIVE_RPC: false,
  RPC_URL: "http://127.0.0.1:8332/",
  RPC_USER: "satoshi",
  RPC_PASS: "satoshi",
};

/* ---------- DETERMINISTIC PRNG (mulberry32) ---------- */
const prng = (seed) => {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};
const hexFrom = (rng, len) => {
  const c = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < len; i++) s += c[Math.floor(rng() * 16)];
  return s;
};
const tdcAddress = (rng, falcon = true) => {
  // Falcon-512 PQ addresses are longer (bech32-ish "tdc1q..."), legacy ECDSA shorter ("T...")
  if (falcon) return "tdc1q" + hexFrom(rng, 58);
  return "T" + hexFrom(rng, 33).toUpperCase().slice(0, 33);
};
const fmtTdc = (sat) => (sat / 1e8).toFixed(8).replace(/0+$/, "0").replace(/\.$/, ".0");
const fmtNum = (n) => n.toLocaleString("en-US");
const ago = (ts) => {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const trunc = (s, l = 8, r = 6) => (s && s.length > l + r + 3 ? `${s.slice(0, l)}…${s.slice(-r)}` : s);

/* ---------- MOCK DATA ENGINE ---------- */
const MINERS = ["TideHash", "QuantumPool", "FalconMine", "DeepCurrent", "AbyssCo", "Solo"];
const GENESIS_TIME = Date.now() - 8 * 60 * 1000 * 200; // 200 blocks back

const mockDataEngine = {
  _tipHeight: 487_213,
  _mempool: [],
  _blockCache: new Map(),

  init() {
    this._mempool = this._genMempool(2400);
  },

  generateBlock(height) {
    if (this._blockCache.has(height)) return this._blockCache.get(height);
    const rng = prng(height * 2654435761);
    const txCount = 800 + Math.floor(rng() * 2400);
    const sizeBytes = txCount * (220 + Math.floor(rng() * 180));
    const reward = 5_000_000_000; // 50 TDC subsidy
    const totalFees = Math.floor((10_000_000 + rng() * 90_000_000));
    const pqRatio = 0.45 + rng() * 0.5; // 45-95%
    const minerIdx = Math.floor(rng() * MINERS.length);
    const tsOffset = (this._tipHeight - height) * (480 + Math.floor(rng() * 60 - 30)) * 1000;
    const block = {
      height,
      hash: "0000" + hexFrom(rng, 60),
      prevHash: "0000" + hexFrom(prng((height - 1) * 2654435761), 60),
      merkleRoot: hexFrom(rng, 64),
      timestamp: Date.now() - tsOffset,
      txCount,
      size: sizeBytes,
      weight: sizeBytes * 4,
      totalFees,
      reward,
      miner: MINERS[minerIdx],
      pqRatio,
      difficulty: (3.2e13 * (0.9 + rng() * 0.2)).toFixed(0),
      nonce: Math.floor(rng() * 4_000_000_000),
      version: 0x20000000,
      bits: "1a02428f",
      _rng: () => prng((height * 31 + 7) * 2654435761),
    };
    this._blockCache.set(height, block);
    return block;
  },

  generateTxsForBlock(height, count = 12) {
    const block = this.generateBlock(height);
    const rng = prng(height * 1103515245 + 12345);
    const txs = [];
    for (let i = 0; i < count; i++) {
      txs.push(this._genTx(rng, height, block.timestamp, block.pqRatio));
    }
    return txs;
  },

  _genTx(rng, height, ts, pqRatio = 0.7) {
    const isFalcon = rng() < pqRatio;
    const inCount = 1 + Math.floor(rng() * 3);
    const outCount = 1 + Math.floor(rng() * 3);
    const inputs = [];
    const outputs = [];
    let totalIn = 0, totalOut = 0;
    for (let i = 0; i < inCount; i++) {
      const v = Math.floor(10_000 + rng() * 5_000_000_000);
      totalIn += v;
      inputs.push({
        prevTxid: hexFrom(rng, 64),
        vout: Math.floor(rng() * 4),
        address: tdcAddress(rng, isFalcon),
        value: v,
        scriptType: isFalcon ? "p2falcon" : "p2pkh",
      });
    }
    const fee = Math.floor(200 + rng() * 12000);
    let remaining = totalIn - fee;
    for (let i = 0; i < outCount; i++) {
      const v = i === outCount - 1 ? remaining : Math.floor(remaining * (0.2 + rng() * 0.5));
      remaining -= v;
      totalOut += v;
      outputs.push({
        n: i,
        address: tdcAddress(rng, rng() < pqRatio),
        value: v,
        scriptType: rng() < pqRatio ? "p2falcon" : "p2pkh",
      });
    }
    const size = 220 + inCount * 180 + outCount * 34 + (isFalcon ? 690 : 0);
    return {
      txid: hexFrom(rng, 64),
      blockHeight: height,
      timestamp: ts + Math.floor(rng() * 480000),
      size,
      vsize: Math.floor(size * 0.75),
      weight: size * 4,
      fee,
      feeRate: (fee / Math.floor(size * 0.75)).toFixed(1),
      inputs,
      outputs,
      totalIn,
      totalOut,
      confirmations: this._tipHeight - height + 1,
      isFalcon,
      falconPubkeyPrefix: isFalcon ? hexFrom(rng, 32) : null,
      locktime: 0,
      version: 2,
      status: "confirmed",
    };
  },

  _genMempool(n) {
    const rng = prng(Date.now() & 0xffff);
    const arr = [];
    for (let i = 0; i < n; i++) {
      const tx = this._genTx(rng, this._tipHeight + 1, Date.now() - Math.floor(rng() * 600000), 0.72);
      tx.status = "pending";
      tx.confirmations = 0;
      arr.push(tx);
    }
    return arr;
  },

  getTip() { return this._tipHeight; },

  getRecentBlocks(n = 8) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(this.generateBlock(this._tipHeight - i));
    return out;
  },

  getBlockPage(page = 0, perPage = 25) {
    const out = [];
    const start = this._tipHeight - page * perPage;
    for (let i = 0; i < perPage; i++) out.push(this.generateBlock(start - i));
    return out;
  },

  getMempoolStats() {
    const total = this._mempool.length;
    const totalFees = this._mempool.reduce((a, t) => a + t.fee, 0);
    const totalVsize = this._mempool.reduce((a, t) => a + t.vsize, 0);
    const avgFeeRate = totalVsize ? (totalFees / totalVsize).toFixed(1) : "0";
    const pqCount = this._mempool.filter(t => t.isFalcon).length;
    return { total, totalFees, avgFeeRate, pqRatio: pqCount / Math.max(1, total) };
  },

  getMempoolDepthChart() {
    const tiers = [
      { label: "1-5", min: 1, max: 5 },
      { label: "5-10", min: 5, max: 10 },
      { label: "10-20", min: 10, max: 20 },
      { label: "20-50", min: 20, max: 50 },
      { label: "50-100", min: 50, max: 100 },
      { label: "100+", min: 100, max: Infinity },
    ];
    return tiers.map(t => {
      const txs = this._mempool.filter(x => +x.feeRate >= t.min && +x.feeRate < t.max);
      return {
        bucket: t.label,
        falcon: txs.filter(x => x.isFalcon).length,
        ecdsa: txs.filter(x => !x.isFalcon).length,
      };
    });
  },

  getFeeEstimates() {
    const sorted = [...this._mempool].map(t => +t.feeRate).sort((a, b) => b - a);
    const p = (q) => sorted[Math.floor(sorted.length * q)] || 1;
    return {
      fast:    { rate: Math.ceil(p(0.10)), low: Math.ceil(p(0.15)), high: Math.ceil(p(0.05)), eta: "Next block (~8 min)" },
      medium:  { rate: Math.ceil(p(0.40)), low: Math.ceil(p(0.55)), high: Math.ceil(p(0.30)), eta: "~30 min" },
      slow:    { rate: Math.ceil(p(0.80)), low: Math.ceil(p(0.90)), high: Math.ceil(p(0.70)), eta: "~1 hour" },
    };
  },

  getLiveTxFeed(n = 20) {
    const txs = [];
    let h = this._tipHeight;
    while (txs.length < n) {
      txs.push(...this.generateTxsForBlock(h, 8));
      h--;
    }
    return txs.slice(0, n);
  },

  getNetworkHealth() {
    const recent = this.getRecentBlocks(20);
    const avgPq = recent.reduce((a, b) => a + b.pqRatio, 0) / recent.length;
    const tipAge = (Date.now() - recent[0].timestamp) / 1000;
    return {
      peerCount: 47,
      synced: true,
      tipAgeSec: tipAge,
      pqAdoption: avgPq,
      hashrate: "342.7 TH/s",
      hashrateNum: 342.7,
      chainWork: "0x" + hexFrom(prng(this._tipHeight), 16),
    };
  },

  searchAuto(q) {
    if (!q) return null;
    const s = q.trim();
    if (/^\d+$/.test(s)) {
      const h = +s;
      if (h <= this._tipHeight && h >= 0) return { type: "block", value: h };
    }
    if (/^[0-9a-fA-F]{64}$/.test(s)) return { type: "tx", value: s };
    if (/^tdc1q[0-9a-f]{30,}$/i.test(s) || /^T[0-9A-F]{20,}$/.test(s)) return { type: "address", value: s };
    return { type: "notfound", value: s };
  },

  getAddress(addr) {
    const rng = prng(addr.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
    const txCount = 8 + Math.floor(rng() * 80);
    const totalReceived = Math.floor(1e8 + rng() * 5e10);
    const totalSent = Math.floor(rng() * totalReceived * 0.8);
    const balance = totalReceived - totalSent;
    const utxoCount = 2 + Math.floor(rng() * 12);
    const utxos = [];
    for (let i = 0; i < utxoCount; i++) {
      utxos.push({
        txid: hexFrom(rng, 64),
        vout: Math.floor(rng() * 4),
        value: Math.floor(balance / utxoCount * (0.5 + rng())),
        confirmations: 1 + Math.floor(rng() * 5000),
      });
    }
    const txs = [];
    for (let i = 0; i < Math.min(txCount, 25); i++) {
      const h = this._tipHeight - Math.floor(rng() * 5000);
      txs.push({
        txid: hexFrom(rng, 64),
        height: h,
        timestamp: Date.now() - Math.floor(rng() * 1e9),
        amount: Math.floor((rng() - 0.4) * 5e9),
        confirmations: this._tipHeight - h + 1,
        isFalcon: addr.startsWith("tdc1q"),
      });
    }
    return {
      address: addr,
      isFalcon: addr.startsWith("tdc1q"),
      balance, totalReceived, totalSent, txCount, utxos, txs,
    };
  },

  tickBlock() {
    this._tipHeight += 1;
    // remove some mempool txs (mined) and add new ones
    this._mempool = this._mempool.slice(Math.min(800, this._mempool.length));
    this._mempool.push(...this._genMempool(600 + Math.floor(Math.random() * 400)));
  },

  tickMempool() {
    const delta = Math.floor((Math.random() - 0.5) * 200);
    if (delta > 0) this._mempool.push(...this._genMempool(delta));
    else this._mempool = this._mempool.slice(0, Math.max(500, this._mempool.length + delta));
  },
};
mockDataEngine.init();

/* ---------- RPC-READY API ABSTRACTION ---------- */
const explorerAPI = {
  async getBlock(h)   { if (CONFIG.USE_LIVE_RPC) return rpcCall("getblock", [h]);   return mockDataEngine.generateBlock(h); },
  async getTx(id)     { if (CONFIG.USE_LIVE_RPC) return rpcCall("getrawtransaction", [id, true]); return null; },
  async getAddress(a) { if (CONFIG.USE_LIVE_RPC) return rpcCall("getaddressinfo", [a]); return mockDataEngine.getAddress(a); },
  async getMempool()  { if (CONFIG.USE_LIVE_RPC) return rpcCall("getrawmempool", [true]); return mockDataEngine.getMempoolStats(); },
};
async function rpcCall(method, params) {
  const r = await fetch(CONFIG.RPC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Basic " + btoa(`${CONFIG.RPC_USER}:${CONFIG.RPC_PASS}`),
    },
    body: JSON.stringify({ jsonrpc: "1.0", id: "tideexplorer", method, params }),
  });
  return (await r.json()).result;
}

/* ============================================================
 * UI PRIMITIVES
 * ============================================================ */
const Card = ({ children, className = "", ...rest }) => (
  <div
    className={`rounded-2xl border border-violet-500/20 bg-[#16213e]/60 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${className}`}
    {...rest}
  >{children}</div>
);

const Pill = ({ children, color = "violet" }) => {
  const map = {
    violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    cyan:   "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    green:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    amber:  "bg-amber-500/15 text-amber-300 border-amber-500/30",
    red:    "bg-red-500/15 text-red-300 border-red-500/30",
    slate:  "bg-slate-500/15 text-slate-300 border-slate-500/30",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${map[color]}`}>{children}</span>;
};

const HashCopy = ({ value, className = "", left = 8, right = 6, mono = true }) => {
  const [copied, setCopied] = useState(false);
  const [hover, setHover] = useState(false);
  const copy = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <span
      className={`relative inline-flex items-center gap-1.5 cursor-pointer group ${mono ? "font-mono" : ""} ${className}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={copy}
    >
      <span className="hover:text-violet-300 transition-colors">{trunc(value, left, right)}</span>
      {copied
        ? <Check size={12} className="text-emerald-400" />
        : <Copy size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" />}
      {hover && (
        <span className="absolute z-50 bottom-full left-0 mb-1.5 px-2 py-1 rounded-md bg-[#0a0a1a] border border-violet-500/40 text-[10px] font-mono text-violet-100 whitespace-nowrap shadow-xl">
          {value}
        </span>
      )}
    </span>
  );
};

const Skeleton = ({ className = "" }) => (
  <div className={`relative overflow-hidden rounded-md bg-violet-500/5 ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-violet-500/15 to-transparent" />
  </div>
);

const TideLogo = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <defs>
      <linearGradient id="tideg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#7c3aed" />
        <stop offset="100%" stopColor="#06b6d4" />
      </linearGradient>
    </defs>
    <circle cx="20" cy="20" r="19" stroke="url(#tideg)" strokeWidth="1.5" fill="rgba(124,58,237,0.08)" />
    <path d="M6 22 Q11 16, 16 22 T26 22 T36 22" stroke="url(#tideg)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    <path d="M6 27 Q11 21, 16 27 T26 27 T36 27" stroke="url(#tideg)" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.6" />
  </svg>
);

/* ============================================================
 * HEADER + SEARCH
 * ============================================================ */
const Header = ({ view, setView, onSearch, openSettings, networkHealth }) => {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (q.trim()) { onSearch(q); setQ(""); }
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: Activity },
    { id: "blocks",    label: "Blocks",    icon: Layers },
    { id: "mempool",   label: "Mempool",   icon: Cpu },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-violet-500/20 bg-[#0f0f1e]/85 backdrop-blur-2xl">
      {/* animated gradient strip */}
      <div className="h-[2px] w-full bg-gradient-to-r from-violet-600 via-cyan-400 to-violet-600 bg-[length:200%_100%] animate-[gradient_8s_linear_infinite]" />
      <div className="mx-auto max-w-[1600px] px-6 py-3 flex items-center gap-6">
        <button onClick={() => setView({ name: "dashboard" })} className="flex items-center gap-2.5 group">
          <TideLogo />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
              TideExplorer
            </div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-violet-400/70">Post-Quantum · TDC</div>
          </div>
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = view.name === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setView({ name: t.id })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${active
                    ? "bg-violet-500/20 text-violet-200 border border-violet-500/30"
                    : "text-slate-400 hover:text-violet-300 hover:bg-violet-500/10 border border-transparent"}`}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </nav>

        <form onSubmit={submit} className="flex-1 max-w-xl ml-auto relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400/60" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search block height, txid, or address…"
            className="w-full pl-9 pr-12 py-2 rounded-lg bg-[#0a0a1a]/80 border border-violet-500/20 focus:border-violet-500/60 focus:outline-none text-xs font-mono text-slate-200 placeholder:text-slate-500 transition-colors"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">/</kbd>
        </form>

        <div className="hidden lg:flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-slate-400">{networkHealth.peerCount} peers</span>
          </div>
          <div className="text-slate-500">|</div>
          <div className="text-slate-400">tip <span className="font-mono text-violet-300">{fmtNum(mockDataEngine.getTip())}</span></div>
        </div>

        <button onClick={openSettings} className="p-2 rounded-lg hover:bg-violet-500/10 text-slate-400 hover:text-violet-300 transition-colors">
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
};

/* ============================================================
 * DASHBOARD
 * ============================================================ */
const Dashboard = ({ navigate }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const a = setInterval(() => { mockDataEngine.tickMempool(); setTick(t => t + 1); }, 5000);
    const b = setInterval(() => { mockDataEngine.tickBlock();   setTick(t => t + 1); }, 30000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);

  const mempoolStats = mockDataEngine.getMempoolStats();
  const fees         = mockDataEngine.getFeeEstimates();
  const recentBlocks = mockDataEngine.getRecentBlocks(8);
  const depthChart   = mockDataEngine.getMempoolDepthChart();
  const liveTx       = mockDataEngine.getLiveTxFeed(20);
  const health       = mockDataEngine.getNetworkHealth();

  // composite health score (0-100)
  const healthScore = Math.round(
    (Math.min(1, health.peerCount / 50) * 25) +
    (health.tipAgeSec < 600 ? 25 : Math.max(0, 25 - (health.tipAgeSec - 600) / 60)) +
    (health.pqAdoption * 25) +
    (Math.min(1, health.hashrateNum / 400) * 25)
  );

  return (
    <div className="space-y-5">
      {/* MEMPOOL TICKER */}
      <Card className="px-5 py-3 flex flex-wrap items-center gap-x-8 gap-y-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-violet-400">
          <Cpu size={13} /> Mempool
        </div>
        <Stat label="Unconfirmed" value={fmtNum(mempoolStats.total)} accent="violet" />
        <Stat label="Pending fees" value={`${fmtTdc(mempoolStats.totalFees)} TDC`} accent="cyan" />
        <Stat label="Avg fee rate" value={`${mempoolStats.avgFeeRate} sat/vB`} accent="amber" />
        <Stat label="PQ ratio" value={`${(mempoolStats.pqRatio * 100).toFixed(1)}%`} accent="green" />
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" />
          </span>
          live
        </div>
      </Card>

      {/* KPI ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Box}      label="Block Height" value={fmtNum(mockDataEngine.getTip())} sub={`tip ${Math.floor(health.tipAgeSec)}s old`} accent="violet" />
        <KpiCard icon={Zap}      label="Hashrate"     value={health.hashrate} sub="+2.4% / 24h" accent="cyan" />
        <KpiCard icon={TrendingUp} label="TDC Price"  value="$0.4127" sub="+5.82% / 24h" accent="green" />
        <HealthGaugeCard score={healthScore} />
      </div>

      {/* FEE ESTIMATOR + BLOCK STRIP */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 p-5">
          <SectionTitle icon={Gauge}>Fee Estimator</SectionTitle>
          <div className="space-y-3 mt-4">
            <FeeTier tier="Next Block"     data={fees.fast}   color="violet" urgency="high" />
            <FeeTier tier="~30 minutes"    data={fees.medium} color="cyan"   urgency="med"  />
            <FeeTier tier="~1 hour"        data={fees.slow}   color="amber"  urgency="low"  />
          </div>
          <p className="mt-4 text-[10px] text-slate-500 leading-relaxed">
            Confidence intervals based on rolling mempool fee distribution. Falcon-512 transactions
            require ~3× the vsize of ECDSA, pricing them slightly higher per tx.
          </p>
        </Card>

        <Card className="lg:col-span-2 p-5">
          <SectionTitle icon={Layers}>Recent Blocks</SectionTitle>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
            {recentBlocks.map((b, i) => (
              <BlockChip key={b.height} block={b} idx={i} onClick={() => navigate({ name: "block", height: b.height })} />
            ))}
          </div>
        </Card>
      </div>

      {/* MEMPOOL DEPTH + LIVE FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3 p-5">
          <SectionTitle icon={Activity}>Mempool Depth by Fee Rate</SectionTitle>
          <div className="h-64 mt-4">
            <ResponsiveContainer>
              <BarChart data={depthChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.08)" />
                <XAxis dataKey="bucket" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={{ stroke: "rgba(124,58,237,0.2)" }} label={{ value: "sat/vByte", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={{ stroke: "rgba(124,58,237,0.2)" }} />
                <Tooltip
                  contentStyle={{ background: "#0a0a1a", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: "#a78bfa" }}
                />
                <Bar dataKey="falcon" stackId="a" fill="#7c3aed" name="Falcon-512" radius={[0, 0, 0, 0]} />
                <Bar dataKey="ecdsa"  stackId="a" fill="#06b6d4" name="ECDSA"      radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 text-[10px] text-slate-400 mt-1">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500" /> Falcon-512 (PQ)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-cyan-500" /> ECDSA (legacy)</span>
          </div>
        </Card>

        <Card className="lg:col-span-2 p-5">
          <SectionTitle icon={Activity}>Live Transactions</SectionTitle>
          <div className="mt-4 space-y-1.5 max-h-72 overflow-y-auto pr-1 custom-scroll">
            {liveTx.map((t) => (
              <button
                key={t.txid}
                onClick={() => navigate({ name: "tx", txid: t.txid, _tx: t })}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-violet-500/5 border border-transparent hover:border-violet-500/20 transition-all text-left group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {t.isFalcon
                    ? <Shield size={12} className="text-violet-400 flex-shrink-0" />
                    : <ShieldAlert size={12} className="text-amber-500 flex-shrink-0" />}
                  <span className="font-mono text-[11px] text-slate-300 truncate">{trunc(t.txid, 10, 6)}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] flex-shrink-0">
                  <span className="text-violet-300 font-mono">{fmtTdc(t.totalOut)} TDC</span>
                  <span className="text-slate-500">{t.feeRate} s/vB</span>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* NETWORK HEALTH */}
      <Card className="p-5">
        <SectionTitle icon={Wifi}>Network Health</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
          <HealthMetric icon={Globe}        label="Peers"          value={health.peerCount}                            ok={health.peerCount >= 8} />
          <HealthMetric icon={CheckCircle2} label="Sync status"    value={health.synced ? "Synced" : "Syncing"}        ok={health.synced} />
          <HealthMetric icon={Clock}        label="Tip age"        value={`${Math.floor(health.tipAgeSec)}s`}          ok={health.tipAgeSec < 900} />
          <HealthMetric icon={Shield}       label="PQ adoption"    value={`${(health.pqAdoption * 100).toFixed(1)}%`} ok={health.pqAdoption > 0.6} />
          <HealthMetric icon={Zap}          label="Hashrate"       value={health.hashrate}                              ok />
        </div>
      </Card>
    </div>
  );
};

const Stat = ({ label, value, accent }) => {
  const colors = { violet: "text-violet-300", cyan: "text-cyan-300", amber: "text-amber-300", green: "text-emerald-300" };
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`text-sm font-mono font-medium ${colors[accent]}`}>{value}</span>
    </div>
  );
};

const KpiCard = ({ icon: Icon, label, value, sub, accent }) => {
  const ring = { violet: "from-violet-500/20", cyan: "from-cyan-500/20", green: "from-emerald-500/20" };
  const txt  = { violet: "text-violet-400",   cyan: "text-cyan-400",   green: "text-emerald-400" };
  return (
    <Card className="p-5 relative overflow-hidden group">
      <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-radial ${ring[accent]} to-transparent opacity-50 group-hover:opacity-80 transition-opacity`} />
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500 relative">
        <Icon size={13} className={txt[accent]} /> {label}
      </div>
      <div className="mt-2 text-2xl font-mono font-medium text-slate-100 relative">{value}</div>
      <div className="mt-1 text-[10px] text-slate-500 relative">{sub}</div>
    </Card>
  );
};

const HealthGaugeCard = ({ score }) => {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  const data = [{ name: "score", value: score, fill: color }];
  return (
    <Card className="p-5 relative overflow-hidden">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">
        <Gauge size={13} className="text-violet-400" /> Chain Health
      </div>
      <div className="flex items-center gap-3 mt-1">
        <div className="w-20 h-20 -ml-2">
          <ResponsiveContainer>
            <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background={{ fill: "rgba(124,58,237,0.1)" }} dataKey="value" cornerRadius={20} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div className="text-2xl font-mono font-medium" style={{ color }}>{score}</div>
          <div className="text-[10px] text-slate-500">composite score</div>
        </div>
      </div>
    </Card>
  );
};

const FeeTier = ({ tier, data, color, urgency }) => {
  const colorMap = {
    violet: { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-300", dot: "bg-violet-400" },
    cyan:   { bg: "bg-cyan-500/10",   border: "border-cyan-500/30",   text: "text-cyan-300",   dot: "bg-cyan-400" },
    amber:  { bg: "bg-amber-500/10",  border: "border-amber-500/30",  text: "text-amber-300",  dot: "bg-amber-400" },
  };
  const c = colorMap[color];
  return (
    <div className={`relative rounded-xl border ${c.border} ${c.bg} p-3 transition-all hover:scale-[1.015]`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`relative flex h-2 w-2`}>
            {urgency === "high" && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${c.dot} opacity-60`} />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${c.dot}`} />
          </span>
          <span className={`text-[11px] font-medium ${c.text}`}>{tier}</span>
        </div>
        <span className="text-[9px] text-slate-500">{data.eta}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-xl font-mono font-medium ${c.text}`}>{data.rate}</span>
        <span className="text-[10px] text-slate-400">sat/vB</span>
        <span className="text-[10px] text-slate-500 ml-auto font-mono">{data.low}–{data.high}</span>
      </div>
      <div className="mt-1 text-[10px] text-slate-500">≈ {(data.rate * 250 / 1e8).toFixed(8)} TDC / typical tx</div>
    </div>
  );
};

const BlockChip = ({ block, idx, onClick }) => (
  <button
    onClick={onClick}
    className="flex-shrink-0 w-40 rounded-xl border border-violet-500/20 hover:border-violet-500/50 bg-gradient-to-br from-violet-500/5 to-cyan-500/5 hover:from-violet-500/10 hover:to-cyan-500/10 p-3 text-left transition-all relative overflow-hidden group"
    style={{ animation: idx === 0 ? "pulse-violet 2s ease-in-out infinite" : "none" }}
  >
    {idx === 0 && <div className="absolute top-1.5 right-1.5"><Pill color="green">live</Pill></div>}
    <div className="text-[9px] uppercase tracking-wider text-violet-400/70">Block</div>
    <div className="text-base font-mono font-medium text-violet-200 mt-0.5">#{fmtNum(block.height)}</div>
    <div className="mt-2 space-y-0.5 text-[10px] font-mono text-slate-400">
      <div>{fmtNum(block.txCount)} txs</div>
      <div>{(block.size / 1024).toFixed(0)} kB</div>
      <div className="text-slate-500">{ago(block.timestamp)}</div>
    </div>
    <div className="mt-2">
      <div className="flex items-center justify-between text-[9px] mb-0.5">
        <span className="text-slate-500">PQ</span>
        <span className={block.pqRatio > 0.9 ? "text-emerald-400" : "text-violet-400"}>{(block.pqRatio * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1 rounded-full bg-slate-700/50 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${block.pqRatio * 100}%` }} />
      </div>
    </div>
    <div className="mt-2 text-[9px] text-slate-500 truncate">⛏ {block.miner}</div>
  </button>
);

const SectionTitle = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-2">
    <Icon size={14} className="text-violet-400" />
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-300">{children}</h3>
  </div>
);

const HealthMetric = ({ icon: Icon, label, value, ok }) => (
  <div className="flex items-center gap-3">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${ok ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
      <Icon size={15} />
    </div>
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-mono text-slate-200">{value}</div>
    </div>
  </div>
);

/* ============================================================
 * BLOCKS LIST
 * ============================================================ */
const BlocksView = ({ navigate }) => {
  const [page, setPage] = useState(0);
  const blocks = mockDataEngine.getBlockPage(page, 25);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionTitle icon={Layers}>All Blocks</SectionTitle>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
            className="px-3 py-1 rounded-md text-xs border border-violet-500/30 text-violet-300 disabled:opacity-30 hover:bg-violet-500/10">‹ Newer</button>
          <span className="text-xs text-slate-400 font-mono">page {page + 1}</span>
          <button onClick={() => setPage(page + 1)}
            className="px-3 py-1 rounded-md text-xs border border-violet-500/30 text-violet-300 hover:bg-violet-500/10">Older ›</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-violet-500/15">
              <th className="text-left py-2 px-2 font-medium">Height</th>
              <th className="text-left py-2 px-2 font-medium">Time</th>
              <th className="text-left py-2 px-2 font-medium">Miner</th>
              <th className="text-right py-2 px-2 font-medium">Txs</th>
              <th className="text-right py-2 px-2 font-medium">Size</th>
              <th className="text-right py-2 px-2 font-medium">Fees (TDC)</th>
              <th className="text-right py-2 px-2 font-medium">Reward</th>
              <th className="text-left py-2 px-2 font-medium">PQ adoption</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => (
              <tr key={b.height}
                  onClick={() => navigate({ name: "block", height: b.height })}
                  className="border-b border-violet-500/5 hover:bg-violet-500/5 cursor-pointer transition-colors">
                <td className="py-2.5 px-2 font-mono text-violet-300">#{fmtNum(b.height)}</td>
                <td className="py-2.5 px-2 text-slate-400">{ago(b.timestamp)}</td>
                <td className="py-2.5 px-2 text-slate-300">{b.miner}</td>
                <td className="py-2.5 px-2 text-right font-mono text-slate-300">{fmtNum(b.txCount)}</td>
                <td className="py-2.5 px-2 text-right font-mono text-slate-400">{(b.size / 1024).toFixed(0)} kB</td>
                <td className="py-2.5 px-2 text-right font-mono text-cyan-300">{fmtTdc(b.totalFees)}</td>
                <td className="py-2.5 px-2 text-right font-mono text-emerald-300">{fmtTdc(b.reward + b.totalFees)}</td>
                <td className="py-2.5 px-2 w-40">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-700/40 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${b.pqRatio * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 w-8 text-right">{(b.pqRatio * 100).toFixed(0)}%</span>
                    {b.pqRatio > 0.9 && <Pill color="green">PQ</Pill>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

/* ============================================================
 * BLOCK DETAIL
 * ============================================================ */
const BlockDetail = ({ height, navigate }) => {
  const block = mockDataEngine.generateBlock(height);
  const txs = mockDataEngine.generateTxsForBlock(height, 30);
  const isQuantumSafe = block.pqRatio > 0.9;

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ name: "blocks" })} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
        ← back to blocks
      </button>
      <Card className="p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Pill color="violet">Block</Pill>
              {isQuantumSafe && <Pill color="green"><Shield size={9} /> Quantum-safe</Pill>}
            </div>
            <h1 className="mt-2 text-3xl font-mono font-medium text-slate-100">#{fmtNum(block.height)}</h1>
            <div className="mt-1 text-[11px] text-slate-500">{new Date(block.timestamp).toLocaleString()} · {ago(block.timestamp)}</div>
          </div>
          <div className="flex gap-6 flex-wrap">
            <Metric label="Transactions" value={fmtNum(block.txCount)} />
            <Metric label="Size" value={`${(block.size / 1024).toFixed(1)} kB`} />
            <Metric label="Total fees" value={`${fmtTdc(block.totalFees)} TDC`} />
            <Metric label="Reward" value={`${fmtTdc(block.reward + block.totalFees)} TDC`} />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-[11px]">
          <KV k="Hash" v={<HashCopy value={block.hash} left={16} right={16} />} />
          <KV k="Merkle root" v={<HashCopy value={block.merkleRoot} left={16} right={16} />} />
          <KV k="Previous block" v={<HashCopy value={block.prevHash} left={16} right={16} />} />
          <KV k="Miner" v={<span className="text-slate-300">{block.miner}</span>} />
          <KV k="Difficulty" v={<span className="font-mono text-slate-300">{(+block.difficulty).toExponential(3)}</span>} />
          <KV k="Nonce" v={<span className="font-mono text-slate-300">{fmtNum(block.nonce)}</span>} />
          <KV k="Version" v={<span className="font-mono text-slate-300">0x{block.version.toString(16)}</span>} />
          <KV k="Bits" v={<span className="font-mono text-slate-300">{block.bits}</span>} />
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-slate-500 uppercase tracking-wider">Falcon-512 adoption</span>
            <span className="font-mono text-violet-300">{(block.pqRatio * 100).toFixed(1)}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-700/40 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" style={{ width: `${block.pqRatio * 100}%` }} />
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle icon={Hash}>Transactions in block ({txs.length} of {fmtNum(block.txCount)})</SectionTitle>
        <div className="mt-4 space-y-1.5 max-h-[600px] overflow-y-auto custom-scroll">
          {txs.map((t) => (
            <button key={t.txid}
                    onClick={() => navigate({ name: "tx", txid: t.txid, _tx: t })}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-violet-500/5 border border-transparent hover:border-violet-500/20 transition-all">
              <div className="flex items-center gap-3 min-w-0">
                {t.isFalcon ? <Shield size={13} className="text-violet-400" /> : <ShieldAlert size={13} className="text-amber-500" />}
                <span className="font-mono text-[11px] text-slate-300">{trunc(t.txid, 12, 8)}</span>
              </div>
              <div className="flex items-center gap-4 text-[10px]">
                <span className="text-slate-500">{t.inputs.length} → {t.outputs.length}</span>
                <span className="text-violet-300 font-mono">{fmtTdc(t.totalOut)} TDC</span>
                <span className="text-slate-500 font-mono">{t.feeRate} s/vB</span>
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
};

const Metric = ({ label, value }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className="text-base font-mono text-slate-100 mt-0.5">{value}</div>
  </div>
);
const KV = ({ k, v }) => (
  <div className="flex items-baseline gap-3 py-1 border-b border-violet-500/5">
    <span className="text-slate-500 uppercase tracking-wider text-[9px] w-28 flex-shrink-0">{k}</span>
    <span className="text-slate-300 truncate">{v}</span>
  </div>
);

/* ============================================================
 * TX DETAIL
 * ============================================================ */
const TxDetail = ({ txid, preloaded, navigate }) => {
  const tx = preloaded || mockDataEngine.generateTxsForBlock(mockDataEngine.getTip() - 5, 1)[0];
  const [showFalcon, setShowFalcon] = useState(true);

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ name: "dashboard" })} className="text-xs text-violet-400 hover:text-violet-300">← back</button>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <Pill color={tx.status === "confirmed" ? "green" : "amber"}>{tx.status}</Pill>
          {tx.isFalcon
            ? <Pill color="violet"><Shield size={9} /> Falcon-512</Pill>
            : <Pill color="amber"><ShieldAlert size={9} /> ECDSA (legacy)</Pill>}
          <Pill color="slate">{tx.confirmations} confs</Pill>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Transaction</div>
        <div className="mt-1 font-mono text-sm text-slate-100 break-all">
          <HashCopy value={tx.txid} left={32} right={20} />
        </div>
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="Block" value={`#${fmtNum(tx.blockHeight)}`} />
          <Metric label="Size" value={`${tx.size} B`} />
          <Metric label="Vsize" value={`${tx.vsize} vB`} />
          <Metric label="Weight" value={`${tx.weight} WU`} />
          <Metric label="Fee" value={`${fmtTdc(tx.fee)} TDC`} />
          <Metric label="Fee rate" value={`${tx.feeRate} sat/vB`} />
          <Metric label="Locktime" value={tx.locktime} />
          <Metric label="Version" value={tx.version} />
        </div>
      </Card>

      {/* FALCON-512 SECTION */}
      <Card className="p-5">
        <button onClick={() => setShowFalcon(!showFalcon)} className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-violet-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-violet-300">
              Post-Quantum Signature {tx.isFalcon ? "(Falcon-512)" : "(not used — ECDSA)"}
            </span>
          </div>
          <ChevronRight size={14} className={`text-violet-400 transition-transform ${showFalcon ? "rotate-90" : ""}`} />
        </button>
        {showFalcon && (
          <div className="mt-4 space-y-3">
            {tx.isFalcon ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <PqStat label="Algorithm" value="Falcon-512" />
                  <PqStat label="Security level" value="NIST Level 1 (≈AES-128)" />
                  <PqStat label="Verification" value={<span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 size={11} /> verified</span>} />
                  <PqStat label="Public key prefix" value={<HashCopy value={tx.falconPubkeyPrefix} left={16} right={8} />} />
                  <PqStat label="Signature size" value="~666 bytes" />
                  <PqStat label="Lattice basis" value="NTRU (deg 512, q=12289)" />
                </div>
                <div className="rounded-lg bg-violet-500/5 border border-violet-500/20 p-3 text-[11px] text-slate-400 leading-relaxed">
                  This transaction is signed using <span className="text-violet-300">Falcon-512</span>, a lattice-based
                  post-quantum signature scheme standardized by NIST. Unlike ECDSA, it remains secure against
                  attacks by quantum computers running Shor's algorithm.
                </div>
              </>
            ) : (
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-[11px] text-amber-200/80 leading-relaxed flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  This transaction uses <span className="text-amber-300">ECDSA</span>, which is vulnerable to a
                  sufficiently large quantum computer. Tidecoin recommends Falcon-512 addresses (prefix
                  <span className="font-mono"> tdc1q… </span>) for all new wallets.
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* IO FLOW DIAGRAM */}
      <Card className="p-5">
        <SectionTitle icon={ArrowRight}>Input → Output Flow</SectionTitle>
        <IoFlow tx={tx} navigate={navigate} />
      </Card>
    </div>
  );
};

const PqStat = ({ label, value }) => (
  <div>
    <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className="text-xs text-slate-200 mt-0.5 font-mono">{value}</div>
  </div>
);

const IoFlow = ({ tx, navigate }) => {
  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Inputs ({tx.inputs.length})</div>
        {tx.inputs.map((inp, i) => (
          <div key={i} className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
            <button onClick={() => navigate({ name: "address", address: inp.address })}
                    className="text-[11px] font-mono text-cyan-300 hover:text-cyan-200 truncate block w-full text-left">
              {trunc(inp.address, 14, 10)}
            </button>
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <Pill color={inp.scriptType === "p2falcon" ? "violet" : "slate"}>{inp.scriptType}</Pill>
              <span className="font-mono text-slate-300">{fmtTdc(inp.value)} TDC</span>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:flex items-center justify-center pt-8">
        <svg width="60" height="80" viewBox="0 0 60 80">
          <defs>
            <linearGradient id="flow" x1="0" x2="1">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
          <path d="M5 40 Q30 40 55 40" stroke="url(#flow)" strokeWidth="2" fill="none" markerEnd="url(#arrow)" />
          <defs>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="#7c3aed" />
            </marker>
          </defs>
          <text x="30" y="30" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">fee</text>
          <text x="30" y="60" textAnchor="middle" fill="#a78bfa" fontSize="9" fontFamily="monospace">{fmtTdc(tx.fee)}</text>
        </svg>
      </div>

      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Outputs ({tx.outputs.length})</div>
        {tx.outputs.map((out, i) => (
          <div key={i} className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
            <button onClick={() => navigate({ name: "address", address: out.address })}
                    className="text-[11px] font-mono text-violet-300 hover:text-violet-200 truncate block w-full text-left">
              {trunc(out.address, 14, 10)}
            </button>
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <Pill color={out.scriptType === "p2falcon" ? "violet" : "slate"}>{out.scriptType}</Pill>
              <span className="font-mono text-slate-300">{fmtTdc(out.value)} TDC</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============================================================
 * ADDRESS VIEW
 * ============================================================ */
const AddressView = ({ address, navigate }) => {
  const data = mockDataEngine.getAddress(address);
  const safe = data.isFalcon;

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ name: "dashboard" })} className="text-xs text-violet-400 hover:text-violet-300">← back</button>
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <Wallet size={16} className="text-violet-400" />
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Address</span>
          {safe
            ? <Pill color="green"><Shield size={9} /> PQ-secure</Pill>
            : <Pill color="amber"><ShieldAlert size={9} /> Quantum-vulnerable</Pill>}
        </div>
        <div className="font-mono text-sm text-slate-100 break-all">
          <HashCopy value={data.address} left={40} right={20} />
        </div>
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="Balance"        value={`${fmtTdc(data.balance)} TDC`} />
          <Metric label="Total received" value={`${fmtTdc(data.totalReceived)} TDC`} />
          <Metric label="Total sent"     value={`${fmtTdc(data.totalSent)} TDC`} />
          <Metric label="Tx count"       value={fmtNum(data.txCount)} />
        </div>

        <div className={`mt-5 rounded-lg border p-3 text-[11px] leading-relaxed ${safe ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-200/80" : "bg-amber-500/5 border-amber-500/20 text-amber-200/80"}`}>
          <div className="flex items-start gap-2">
            {safe ? <Shield size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" /> : <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />}
            <div>
              <div className="font-medium">
                {safe ? "Post-quantum secure address" : "Legacy ECDSA — quantum-vulnerable"}
              </div>
              <div className="text-[10px] mt-0.5 opacity-80">
                {safe
                  ? "This address uses Falcon-512 (NTRU lattice). Funds remain safe under Shor's algorithm."
                  : "Once a public key is exposed (i.e. on first spend), this address becomes vulnerable to a CRQC. Migrate funds to a tdc1q… address."}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionTitle icon={Box}>UTXOs ({data.utxos.length})</SectionTitle>
          <div className="mt-4 space-y-1.5 max-h-80 overflow-y-auto custom-scroll">
            {data.utxos.map((u, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] py-2 px-2 rounded hover:bg-violet-500/5">
                <HashCopy value={u.txid} left={10} right={6} />
                <span className="text-slate-500 font-mono">:{u.vout}</span>
                <span className="text-violet-300 font-mono">{fmtTdc(u.value)}</span>
                <span className="text-slate-500 text-[10px]">{u.confirmations} ✓</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle icon={Activity}>Recent transactions</SectionTitle>
          <div className="mt-4 space-y-1.5 max-h-80 overflow-y-auto custom-scroll">
            {data.txs.map((t) => (
              <button key={t.txid} onClick={() => navigate({ name: "tx", txid: t.txid })}
                className="w-full flex items-center justify-between text-[11px] py-2 px-2 rounded hover:bg-violet-500/5 border border-transparent hover:border-violet-500/20">
                <HashCopy value={t.txid} left={10} right={6} />
                <span className={`font-mono ${t.amount > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {t.amount > 0 ? "+" : ""}{fmtTdc(Math.abs(t.amount))}
                </span>
                <span className="text-slate-500 text-[10px]">#{fmtNum(t.height)}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

/* ============================================================
 * MEMPOOL VIEW
 * ============================================================ */
const MempoolView = () => {
  const stats = mockDataEngine.getMempoolStats();
  const depth = mockDataEngine.getMempoolDepthChart();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard icon={Cpu}      label="Pending txs"     value={fmtNum(stats.total)} sub="live"   accent="violet" />
        <KpiCard icon={Wallet}   label="Pending fees"    value={`${fmtTdc(stats.totalFees)} TDC`} sub="all" accent="cyan" />
        <KpiCard icon={Gauge}    label="Avg fee rate"    value={`${stats.avgFeeRate} s/vB`} sub="weighted" accent="green" />
        <KpiCard icon={Shield}   label="Falcon-512 share" value={`${(stats.pqRatio * 100).toFixed(1)}%`} sub="of pending" accent="violet" />
      </div>
      <Card className="p-5">
        <SectionTitle icon={Activity}>Fee Distribution (Falcon vs ECDSA)</SectionTitle>
        <div className="h-80 mt-4">
          <ResponsiveContainer>
            <AreaChart data={depth}>
              <defs>
                <linearGradient id="fa" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="ec" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.08)" />
              <XAxis dataKey="bucket" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#0a0a1a", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="falcon" stroke="#7c3aed" fill="url(#fa)" stackId="1" name="Falcon-512" />
              <Area type="monotone" dataKey="ecdsa"  stroke="#06b6d4" fill="url(#ec)" stackId="1" name="ECDSA" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};

/* ============================================================
 * SETTINGS PANEL
 * ============================================================ */
const SettingsPanel = ({ onClose }) => {
  const [live, setLive] = useState(CONFIG.USE_LIVE_RPC);
  const [url,  setUrl]  = useState(CONFIG.RPC_URL);
  const [user, setUser] = useState(CONFIG.RPC_USER);
  const [pass, setPass] = useState(CONFIG.RPC_PASS);
  const save = () => {
    CONFIG.USE_LIVE_RPC = live;
    CONFIG.RPC_URL = url;
    CONFIG.RPC_USER = user;
    CONFIG.RPC_PASS = pass;
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-md p-6 m-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-violet-400" />
            <h2 className="text-sm font-semibold text-slate-200">RPC Configuration</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`relative w-10 h-5 rounded-full transition-colors ${live ? "bg-violet-500" : "bg-slate-700"}`}
                 onClick={() => setLive(!live)}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${live ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </div>
            <div>
              <div className="text-xs text-slate-200 font-medium">Use live RPC</div>
              <div className="text-[10px] text-slate-500">Switch from mock data to your Tidecoin node</div>
            </div>
          </label>
          <Field label="RPC URL"  value={url}  onChange={setUrl}  mono />
          <Field label="Username" value={user} onChange={setUser} />
          <Field label="Password" value={pass} onChange={setPass} type="password" />
          <button onClick={save}
            className="w-full py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-white text-xs font-medium transition-colors">
            Save and reload data
          </button>
          <div className="text-[10px] text-slate-500 text-center">
            {live ? "⚠ Live RPC mode — requests will hit your node" : "Currently using mock data engine"}
          </div>
        </div>
      </Card>
    </div>
  );
};
const Field = ({ label, value, onChange, type = "text", mono }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
    <input
      type={type} value={value} onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 rounded-lg bg-[#0a0a1a]/80 border border-violet-500/20 focus:border-violet-500/60 focus:outline-none text-xs ${mono ? "font-mono" : ""} text-slate-200`}
    />
  </div>
);

/* ============================================================
 * NOT FOUND
 * ============================================================ */
const NotFound = ({ query, navigate }) => (
  <Card className="p-10 text-center">
    <AlertTriangle size={32} className="mx-auto text-amber-400 mb-3" />
    <h2 className="text-lg text-slate-200 font-medium">Nothing matched</h2>
    <p className="text-xs text-slate-500 mt-1">No block, transaction, or address found for <span className="font-mono text-violet-300">{trunc(query, 24, 10)}</span></p>
    <div className="mt-4 text-[11px] text-slate-400">
      Try a block height (integer), a 64-char txid, or a TDC address.
    </div>
    <button onClick={() => navigate({ name: "dashboard" })}
            className="mt-5 px-4 py-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-xs border border-violet-500/30">
      ← back to dashboard
    </button>
  </Card>
);

/* ============================================================
 * APP ROOT
 * ============================================================ */
export default function TideExplorer() {
  const [view, setView] = useState({ name: "dashboard" });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const networkHealth = mockDataEngine.getNetworkHealth();

  const navigate = useCallback((v) => {
    setView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const onSearch = (q) => {
    const r = mockDataEngine.searchAuto(q);
    if (!r) return;
    if (r.type === "block")    navigate({ name: "block", height: r.value });
    if (r.type === "tx")       navigate({ name: "tx", txid: r.value });
    if (r.type === "address")  navigate({ name: "address", address: r.value });
    if (r.type === "notfound") navigate({ name: "notfound", query: r.value });
  };

  return (
    <div className="min-h-screen text-slate-200" style={{ background: "#1a1a2e" }}>
      <style>{`
        @keyframes shimmer { 100% { transform: translateX(100%); } }
        @keyframes gradient { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        @keyframes pulse-violet {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.4); }
          50%      { box-shadow: 0 0 0 6px rgba(124, 58, 237, 0); }
        }
        body { font-family: Inter, system-ui, -apple-system, sans-serif; }
        .font-mono { font-family: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
        .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.25); border-radius: 3px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.5); }
        .bg-gradient-radial { background-image: radial-gradient(circle, var(--tw-gradient-stops)); }
      `}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />

      {/* ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <Header view={view} setView={navigate} onSearch={onSearch} openSettings={() => setSettingsOpen(true)} networkHealth={networkHealth} />

      <main className="relative mx-auto max-w-[1600px] px-6 py-6">
        {view.name === "dashboard" && <Dashboard navigate={navigate} />}
        {view.name === "blocks"    && <BlocksView navigate={navigate} />}
        {view.name === "block"     && <BlockDetail height={view.height} navigate={navigate} />}
        {view.name === "tx"        && <TxDetail txid={view.txid} preloaded={view._tx} navigate={navigate} />}
        {view.name === "address"   && <AddressView address={view.address} navigate={navigate} />}
        {view.name === "mempool"   && <MempoolView />}
        {view.name === "notfound"  && <NotFound query={view.query} navigate={navigate} />}
      </main>

      <footer className="relative mx-auto max-w-[1600px] px-6 py-6 text-[10px] text-slate-600 flex items-center justify-between border-t border-violet-500/10 mt-10">
        <span>TideExplorer · post-quantum block explorer for Tidecoin</span>
        <span className="font-mono">{CONFIG.USE_LIVE_RPC ? `LIVE · ${CONFIG.RPC_URL}` : "MOCK ENGINE"}</span>
      </footer>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
