import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Activity, Box, Search, Copy, Check, Shield, ShieldAlert,
  TrendingUp, Hash, Wallet, Layers, ChevronRight, AlertTriangle,
  CheckCircle2, ArrowRight, Radio, Pickaxe, Flame
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, AreaChart, Area
} from "recharts";

/* ============================================================
 * TideExplorer — Tidecoin (TDC) post-quantum block explorer
 * ============================================================ */
const RPC = { USE_LIVE: false, URL: "http://127.0.0.1:8332/", USER: "satoshi", PASS: "satoshi" };

const prng = (s) => { let t = s >>> 0;
  return () => { t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};
const hex = (rng, n) => { const c = "0123456789abcdef"; let s = "";
  for (let i = 0; i < n; i++) s += c[Math.floor(rng() * 16)]; return s; };
const tdcAddr = (rng, falcon = true) =>
  falcon ? "tdc1q" + hex(rng, 58) : "T" + hex(rng, 33).toUpperCase().slice(0, 33);

const fmtTdc = (sat) => {
  const t = sat / 1e8;
  if (t >= 1) return t.toFixed(4);
  if (t >= 0.0001) return t.toFixed(6);
  return t.toFixed(8);
};
const fmtNum = (n) => Math.floor(n).toLocaleString("en-US");
const ago = (ts) => {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};
const trunc = (s, l = 8, r = 6) => (s && s.length > l + r + 1 ? `${s.slice(0, l)}…${s.slice(-r)}` : s);

const MINERS = [
  { name: "TideHash", color: "#a78bfa" },
  { name: "QuantumPool", color: "#22d3ee" },
  { name: "FalconMine", color: "#34d399" },
  { name: "DeepCurrent", color: "#fbbf24" },
  { name: "AbyssCo", color: "#f472b6" },
  { name: "Solo", color: "#94a3b8" },
];

const engine = {
  _tip: 487_213,
  _mempool: [],
  _blocks: new Map(),

  init() { this._mempool = this._genMempool(2400); },

  block(h) {
    if (this._blocks.has(h)) return this._blocks.get(h);
    const rng = prng(h * 2654435761);
    const txCount = 800 + Math.floor(rng() * 2400);
    const sizeBytes = txCount * (220 + Math.floor(rng() * 180));
    const totalFees = Math.floor(10_000_000 + rng() * 90_000_000);
    const trend = Math.min(0.97, 0.55 + (h - (this._tip - 200)) / 800);
    const pqRatio = Math.max(0.35, Math.min(0.99, trend + (rng() - 0.5) * 0.18));
    const minerIdx = Math.floor(rng() * MINERS.length);
    const tsOffset = (this._tip - h) * (480 + Math.floor(rng() * 120 - 60)) * 1000;
    const b = {
      height: h,
      hash: "0000" + hex(rng, 60),
      prevHash: "0000" + hex(prng((h - 1) * 2654435761), 60),
      merkleRoot: hex(rng, 64),
      timestamp: Date.now() - tsOffset,
      txCount, sizeBytes, weight: sizeBytes * 4,
      totalFees, reward: 5_000_000_000,
      miner: MINERS[minerIdx], pqRatio,
      medianFee: 1 + Math.floor(rng() * 8),
      difficulty: (3.2e13 * (0.9 + rng() * 0.2)).toFixed(0),
      nonce: Math.floor(rng() * 4_000_000_000),
    };
    this._blocks.set(h, b);
    return b;
  },

  txsForBlock(h, count) {
    const block = this.block(h);
    const rng = prng(h * 1103515245 + 12345);
    return Array.from({ length: count }, () => this._tx(rng, h, block.timestamp, block.pqRatio));
  },

  _tx(rng, h, ts, pqRatio = 0.7) {
    const isFalcon = rng() < pqRatio;
    const inCount = 1 + Math.floor(rng() * 3);
    const outCount = 1 + Math.floor(rng() * 3);
    const inputs = [], outputs = [];
    let totalIn = 0;
    for (let i = 0; i < inCount; i++) {
      const v = Math.floor(10_000 + rng() * 5_000_000_000);
      totalIn += v;
      inputs.push({
        prevTxid: hex(rng, 64), vout: Math.floor(rng() * 4),
        address: tdcAddr(rng, isFalcon), value: v,
        scriptType: isFalcon ? "p2falcon" : "p2pkh",
      });
    }
    const fee = Math.floor(200 + rng() * 12000);
    let remaining = totalIn - fee, totalOut = 0;
    for (let i = 0; i < outCount; i++) {
      const v = i === outCount - 1 ? remaining : Math.floor(remaining * (0.2 + rng() * 0.5));
      remaining -= v; totalOut += v;
      outputs.push({
        n: i, address: tdcAddr(rng, rng() < pqRatio), value: v,
        scriptType: rng() < pqRatio ? "p2falcon" : "p2pkh",
      });
    }
    const size = 220 + inCount * 180 + outCount * 34 + (isFalcon ? 690 : 0);
    return {
      txid: hex(rng, 64), blockHeight: h,
      timestamp: ts + Math.floor(rng() * 480000),
      size, vsize: Math.floor(size * 0.75), weight: size * 4,
      fee, feeRate: +(fee / Math.floor(size * 0.75)).toFixed(1),
      inputs, outputs, totalIn, totalOut,
      confirmations: this._tip - h + 1, isFalcon,
      falconPubkeyPrefix: isFalcon ? hex(rng, 32) : null,
      locktime: 0, version: 2, status: "confirmed",
    };
  },

  _genMempool(n) {
    const rng = prng((Date.now() & 0xffff) ^ n);
    return Array.from({ length: n }, () => {
      const tx = this._tx(rng, this._tip + 1, Date.now() - Math.floor(rng() * 600000), 0.75);
      tx.status = "pending"; tx.confirmations = 0;
      return tx;
    });
  },

  tip() { return this._tip; },

  recentBlocks(n = 8) {
    return Array.from({ length: n }, (_, i) => this.block(this._tip - i));
  },

  futureBlocks(n = 5) {
    const sorted = [...this._mempool].sort((a, b) => b.feeRate - a.feeRate);
    const TARGET = 1_000_000;
    const blocks = [];
    let idx = 0;
    for (let i = 0; i < n; i++) {
      let used = 0, txCount = 0, totalFees = 0, falcon = 0;
      let minRate = Infinity, maxRate = 0;
      while (idx < sorted.length && used + sorted[idx].vsize < TARGET) {
        const t = sorted[idx];
        used += t.vsize; txCount++; totalFees += t.fee;
        if (t.isFalcon) falcon++;
        minRate = Math.min(minRate, t.feeRate);
        maxRate = Math.max(maxRate, t.feeRate);
        idx++;
      }
      blocks.push({
        offset: i + 1, height: this._tip + i + 1, txCount,
        sizeBytes: used, totalFees,
        pqRatio: txCount ? falcon / txCount : 0.75,
        feeRange: [minRate === Infinity ? 1 : minRate, maxRate || 1],
        etaSec: (i + 1) * 480,
      });
    }
    return blocks;
  },

  mempoolStats() {
    const total = this._mempool.length;
    const totalFees = this._mempool.reduce((a, t) => a + t.fee, 0);
    const totalVsize = this._mempool.reduce((a, t) => a + t.vsize, 0);
    const pqCount = this._mempool.filter((t) => t.isFalcon).length;
    return { total, totalFees, totalVsize, pqRatio: pqCount / Math.max(1, total) };
  },

  feeDistribution() {
    const buckets = [
      { label: "1", min: 1, max: 2 }, { label: "2", min: 2, max: 3 },
      { label: "3", min: 3, max: 5 }, { label: "5", min: 5, max: 8 },
      { label: "8", min: 8, max: 12 }, { label: "12", min: 12, max: 20 },
      { label: "20", min: 20, max: 35 }, { label: "35", min: 35, max: 60 },
      { label: "60", min: 60, max: 100 }, { label: "100+", min: 100, max: Infinity },
    ];
    return buckets.map((b) => {
      const txs = this._mempool.filter((t) => t.feeRate >= b.min && t.feeRate < b.max);
      const falconV = txs.filter((t) => t.isFalcon).reduce((a, t) => a + t.vsize, 0);
      const ecdsaV = txs.filter((t) => !t.isFalcon).reduce((a, t) => a + t.vsize, 0);
      return {
        bucket: b.label,
        falcon: Math.round(falconV / 1024),
        ecdsa: Math.round(ecdsaV / 1024),
        floor: b.min,
      };
    });
  },

  nextBlockCutoff() {
    const sorted = [...this._mempool].sort((a, b) => b.feeRate - a.feeRate);
    let used = 0;
    for (const t of sorted) {
      used += t.vsize;
      if (used >= 1_000_000) return t.feeRate;
    }
    return 1;
  },

  quantumSupply() {
    const recent = this.recentBlocks(50);
    const avgPq = recent.reduce((a, b) => a + b.pqRatio, 0) / recent.length;
    const totalSupply = this._tip * 50e8 * 0.85;
    const pqSafe = totalSupply * (avgPq * 0.7);
    const hashProtected = totalSupply * (1 - avgPq) * 0.55;
    const exposed = totalSupply - pqSafe - hashProtected;
    return { totalSupply, pqSafe, hashProtected, exposed, pqRatio: avgPq };
  },

  narrative() {
    const m = this.mempoolStats();
    const next = this.nextBlockCutoff();
    const tip = this.block(this._tip);
    const tipAge = Math.floor((Date.now() - tip.timestamp) / 1000);
    let mood, color;
    if (m.total < 1500) { mood = "calm"; color = "emerald"; }
    else if (m.total < 3500) { mood = "moderate"; color = "amber"; }
    else { mood = "congested"; color = "rose"; }
    return { mood, color, pending: m.total, nextRate: next, tipAge, pqRatio: m.pqRatio };
  },

  search(q) {
    if (!q) return null;
    const s = q.trim();
    if (/^\d+$/.test(s)) {
      const h = +s;
      if (h <= this._tip && h >= 0) return { type: "block", value: h };
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
    const utxos = Array.from({ length: 2 + Math.floor(rng() * 8) }, () => ({
      txid: hex(rng, 64), vout: Math.floor(rng() * 4),
      value: Math.floor(balance * (0.05 + rng() * 0.3)),
      confirmations: 1 + Math.floor(rng() * 5000),
    }));
    const txs = Array.from({ length: 25 }, () => {
      const h = this._tip - Math.floor(rng() * 5000);
      return {
        txid: hex(rng, 64), height: h,
        amount: Math.floor((rng() - 0.4) * 5e9),
        confirmations: this._tip - h + 1,
      };
    });
    return { address: addr, isFalcon: addr.startsWith("tdc1q"),
             balance, totalReceived, totalSent, txCount, utxos, txs };
  },

  tickBlock() {
    this._tip += 1;
    this._mempool = this._mempool.slice(Math.min(800, this._mempool.length));
    this._mempool.push(...this._genMempool(600 + Math.floor(Math.random() * 400)));
  },

  tickMempool() {
    const delta = Math.floor((Math.random() - 0.5) * 200);
    if (delta > 0) this._mempool.push(...this._genMempool(delta));
    else this._mempool = this._mempool.slice(0, Math.max(500, this._mempool.length + delta));
  },
};
engine.init();

/* ============================================================
 * UI PRIMITIVES
 * ============================================================ */
const Card = ({ children, className = "", ...rest }) => (
  <div
    className={`rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.025] to-white/[0.005] backdrop-blur-xl shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)] ${className}`}
    {...rest}
  >{children}</div>
);

const Pill = ({ children, color = "violet", className = "" }) => {
  const map = {
    violet: "bg-violet-500/10 text-violet-300 border-violet-500/25",
    cyan:   "bg-cyan-500/10 text-cyan-300 border-cyan-500/25",
    emerald:"bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
    amber:  "bg-amber-500/10 text-amber-300 border-amber-500/25",
    rose:   "bg-rose-500/10 text-rose-300 border-rose-500/25",
    slate:  "bg-white/[0.04] text-slate-300 border-white/10",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] ${map[color]} ${className}`}>
      {children}
    </span>
  );
};

const Mono = ({ children, className = "", style }) => (
  <span className={`font-mono ${className}`} style={{ fontFeatureSettings: '"tnum" 1', ...style }}>{children}</span>
);

const HashCopy = ({ value, left = 8, right = 6, className = "" }) => {
  const [copied, setCopied] = useState(false);
  const [hover, setHover] = useState(false);
  return (
    <span
      className={`relative inline-flex items-center gap-1.5 cursor-pointer group font-mono ${className}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      <span className="hover:text-violet-300 transition-colors">{trunc(value, left, right)}</span>
      {copied
        ? <Check size={11} className="text-emerald-400" />
        : <Copy size={11} className="opacity-0 group-hover:opacity-50 transition-opacity" />}
      {hover && (
        <span className="absolute z-50 bottom-full left-0 mb-1.5 px-2 py-1 rounded-md bg-[#05060e] border border-violet-500/40 text-[10px] font-mono text-violet-100 whitespace-nowrap shadow-2xl pointer-events-none">
          {value}
        </span>
      )}
    </span>
  );
};

const SectionLabel = ({ icon: Icon, children, action }) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      {Icon && <Icon size={12} className="text-violet-400" />}
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{children}</h3>
    </div>
    {action}
  </div>
);

const TideLogo = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <defs>
      <linearGradient id="tg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#a78bfa" />
        <stop offset="100%" stopColor="#22d3ee" />
      </linearGradient>
    </defs>
    <circle cx="20" cy="20" r="18.5" stroke="url(#tg)" strokeWidth="1.2" fill="rgba(167,139,250,0.06)" />
    <path d="M5 23 Q11 17, 17 23 T29 23 T41 23" stroke="url(#tg)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    <path d="M5 28 Q11 22, 17 28 T29 28 T41 28" stroke="url(#tg)" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.55" />
    <circle cx="20" cy="13" r="1.3" fill="#a78bfa" />
  </svg>
);

/* ============================================================
 * HEADER
 * ============================================================ */
const Header = ({ view, navigate, narrative }) => {
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
    if (!q.trim()) return;
    const r = engine.search(q);
    if (r?.type === "block") navigate({ name: "block", height: r.value });
    else if (r?.type === "tx") navigate({ name: "tx", txid: r.value });
    else if (r?.type === "address") navigate({ name: "address", address: r.value });
    else navigate({ name: "notfound", query: q });
    setQ("");
  };

  const tabs = [
    { id: "dashboard", label: "Pulse",  icon: Activity },
    { id: "blocks",    label: "Blocks", icon: Layers },
    { id: "quantum",   label: "Quantum Risk", icon: Shield },
  ];

  const moodColor = { emerald: "bg-emerald-400", amber: "bg-amber-400", rose: "bg-rose-400" };

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.05] bg-[#05060e]/85 backdrop-blur-2xl">
      <div className="h-[1.5px] w-full bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />
      <div className="mx-auto max-w-[1600px] px-6 py-3 flex items-center gap-5">
        <button onClick={() => navigate({ name: "dashboard" })} className="flex items-center gap-2.5">
          <TideLogo />
          <div className="leading-tight text-left">
            <div className="text-[14px] font-medium tracking-tight text-slate-100">TideExplorer</div>
            <div className="text-[8.5px] uppercase tracking-[0.22em] text-violet-400/60">Post-quantum · TDC</div>
          </div>
        </button>

        <nav className="hidden md:flex items-center gap-1 ml-2">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = view.name === t.id;
            return (
              <button
                key={t.id}
                onClick={() => navigate({ name: t.id })}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all
                  ${active ? "bg-violet-500/15 text-violet-200" : "text-slate-500 hover:text-slate-200"}`}
              >
                <Icon size={12} /> {t.label}
              </button>
            );
          })}
        </nav>

        <form onSubmit={submit} className="flex-1 max-w-md ml-auto relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="block height · txid · address"
            className="w-full pl-9 pr-12 py-2 rounded-lg bg-white/[0.025] border border-white/[0.06] focus:border-violet-500/40 focus:bg-white/[0.04] focus:outline-none text-[11px] font-mono text-slate-200 placeholder:text-slate-600 transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-600 border border-white/10 rounded px-1.5 py-0.5">/</kbd>
        </form>

        <div className="hidden lg:flex items-center gap-2 text-[10px] text-slate-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-70 ${moodColor[narrative.color]}`} />
            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${moodColor[narrative.color]}`} />
          </span>
          <Mono className="text-slate-300">#{fmtNum(engine.tip())}</Mono>
        </div>
      </div>
    </header>
  );
};

/* ============================================================
 * NARRATIVE TICKER
 * ============================================================ */
const NarrativeTicker = ({ narrative }) => {
  const dot = { emerald: "text-emerald-400", amber: "text-amber-400", rose: "text-rose-400" };
  return (
    <div className="flex items-center gap-3 px-5 py-3 mb-5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
      <Radio size={13} className={dot[narrative.color]} />
      <div className="text-[12px] text-slate-300">
        Mempool is <span className={`font-medium ${dot[narrative.color]}`}>{narrative.mood}</span>
        <span className="text-slate-600 mx-2">·</span>
        <Mono className="text-slate-200">{fmtNum(narrative.pending)}</Mono> pending
        <span className="text-slate-600 mx-2">·</span>
        next block clears at <Mono className="text-violet-300">{narrative.nextRate}</Mono> sat/vB
        <span className="text-slate-600 mx-2">·</span>
        <Mono className="text-cyan-300">{(narrative.pqRatio * 100).toFixed(0)}%</Mono> post-quantum
        <span className="text-slate-600 mx-2">·</span>
        tip <Mono className="text-slate-400">{narrative.tipAge}s</Mono> ago
      </div>
    </div>
  );
};

/* ============================================================
 * BLOCK TIMELINE — bidirectional, pq-tinted
 * ============================================================ */
const BlockTimeline = ({ navigate }) => {
  const past = engine.recentBlocks(8);
  const future = engine.futureBlocks(5);
  const [hovered, setHovered] = useState(null);

  return (
    <Card className="p-5 mb-5 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-50">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[200px] rounded-full bg-violet-500/[0.04] blur-3xl" />
      </div>

      <div className="relative flex items-center justify-between mb-4">
        <SectionLabel icon={Layers}>Block Timeline</SectionLabel>
        <div className="flex items-center gap-3 text-[9px] uppercase tracking-wider text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm border border-violet-400/50 border-dashed" /> projected
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-violet-400/40" /> mined
          </span>
          <span className="flex items-center gap-1.5">
            <Shield size={9} className="text-emerald-400" /> Falcon-512 fill
          </span>
        </div>
      </div>

      <div className="relative">
        <div className="flex items-stretch gap-2 overflow-x-auto pb-2 -mx-1 px-1 custom-scroll">
          {future.slice().reverse().map((b) => (
            <BlockCell key={`f${b.height}`} block={b} kind="future"
                       onHover={setHovered} onClick={() => {}} />
          ))}

          <div className="relative flex flex-col items-center justify-center px-2 flex-shrink-0">
            <div className="w-[2px] h-full bg-gradient-to-b from-transparent via-violet-400 to-transparent relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_20px_4px_rgba(167,139,250,0.5)] animate-pulse" />
            </div>
            <div className="absolute -bottom-1 text-[8px] uppercase tracking-[0.2em] text-violet-400 font-medium">now</div>
          </div>

          {past.map((b, i) => (
            <BlockCell key={b.height} block={b} kind="past" idx={i}
                       onHover={setHovered}
                       onClick={() => navigate({ name: "block", height: b.height })} />
          ))}
        </div>

        {hovered && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-slate-300 flex items-center gap-6 flex-wrap">
            {hovered.kind === "future" ? (
              <>
                <Pill color="violet">projected #{hovered.offset}</Pill>
                <StatX label="ETA" value={`~${Math.round(hovered.etaSec / 60)} min`} />
                <StatX label="fits" value={`${fmtNum(hovered.txCount)} txs`} />
                <StatX label="fee range" value={`${hovered.feeRange[0]}–${hovered.feeRange[1]} s/vB`} />
                <StatX label="filled" value={`${((hovered.sizeBytes / 1_000_000) * 100).toFixed(0)}%`} />
                <StatX label="PQ" value={`${(hovered.pqRatio * 100).toFixed(0)}%`} />
              </>
            ) : (
              <>
                <Pill color="emerald">mined</Pill>
                <StatX label="height" value={`#${fmtNum(hovered.height)}`} />
                <StatX label="age" value={`${ago(hovered.timestamp)} ago`} />
                <StatX label="txs" value={fmtNum(hovered.txCount)} />
                <StatX label="median fee" value={`${hovered.medianFee} s/vB`} />
                <StatX label="reward" value={`${fmtTdc(hovered.reward + hovered.totalFees)} TDC`} />
                <StatX label="PQ" value={`${(hovered.pqRatio * 100).toFixed(0)}%`} />
                <StatX label="miner" value={hovered.miner.name} color={hovered.miner.color} />
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

const StatX = ({ label, value, color }) => (
  <div className="flex items-baseline gap-1.5">
    <span className="text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
    <Mono className="text-slate-200" style={color ? { color } : undefined}>{value}</Mono>
  </div>
);

const BlockCell = ({ block, kind, idx = 0, onHover, onClick }) => {
  const isFuture = kind === "future";
  const pq = block.pqRatio || 0.7;
  const fillColor = pq > 0.85 ? "from-emerald-500/30" : pq > 0.6 ? "from-violet-500/30" : "from-amber-500/30";
  const borderColor = pq > 0.85 ? "border-emerald-500/30" : pq > 0.6 ? "border-violet-500/30" : "border-amber-500/30";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => onHover({ ...block, kind })}
      onMouseLeave={() => onHover(null)}
      className={`relative flex-shrink-0 w-[110px] rounded-xl border transition-all overflow-hidden group
        ${isFuture
          ? `border-dashed ${borderColor} bg-white/[0.01] hover:bg-white/[0.03]`
          : `${borderColor} bg-white/[0.02] hover:bg-white/[0.05] hover:scale-[1.03] hover:-translate-y-0.5`}
        ${idx === 0 && !isFuture ? "ring-1 ring-violet-500/40" : ""}
      `}
      style={{ height: 130 }}
    >
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${fillColor} to-transparent transition-all`}
        style={{ height: `${pq * 100}%` }}
      />

      <div className="relative h-full p-2.5 flex flex-col">
        <div className="flex items-start justify-between">
          <div className="text-[8.5px] uppercase tracking-wider text-slate-500">
            {isFuture ? `+${block.offset}` : "block"}
          </div>
          {idx === 0 && !isFuture && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" />
            </span>
          )}
        </div>

        <Mono className="text-[11px] text-slate-100 mt-0.5">#{String(block.height).slice(-6)}</Mono>

        <div className="mt-auto space-y-0.5">
          {isFuture ? (
            <>
              <Mono className="text-[10px] text-violet-300 block">
                {block.feeRange[0]}–{block.feeRange[1]} s/vB
              </Mono>
              <div className="text-[9px] text-slate-500">~{Math.round(block.etaSec / 60)} min</div>
              <div className="text-[9px] text-slate-500">{fmtNum(block.txCount)} txs</div>
            </>
          ) : (
            <>
              <Mono className="text-[10px] text-cyan-300 block">{block.medianFee} s/vB</Mono>
              <div className="text-[9px] text-slate-500">{ago(block.timestamp)} ago</div>
              <div className="text-[9px] text-slate-500">{fmtNum(block.txCount)} txs</div>
              <div className="text-[8.5px] mt-0.5 truncate" style={{ color: block.miner.color }}>
                ⛏ {block.miner.name}
              </div>
            </>
          )}
        </div>

        {pq > 0.9 && !isFuture && (
          <div className="absolute top-1.5 right-1.5">
            <Shield size={9} className="text-emerald-400" />
          </div>
        )}
      </div>
    </button>
  );
};

/* ============================================================
 * QUANTUM SUPPLY GAUGE
 * ============================================================ */
const QuantumGauge = ({ navigate }) => {
  const q = engine.quantumSupply();
  const safePct = (q.pqSafe / q.totalSupply) * 100;
  const hashPct = (q.hashProtected / q.totalSupply) * 100;
  const expPct = (q.exposed / q.totalSupply) * 100;

  return (
    <Card className="p-5 relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="flex items-center justify-between mb-1">
        <SectionLabel icon={Shield}>Quantum Supply Partition</SectionLabel>
        <button
          onClick={() => navigate({ name: "quantum" })}
          className="text-[9px] uppercase tracking-wider text-violet-400 hover:text-violet-300 flex items-center gap-1"
        >
          methodology <ChevronRight size={10} />
        </button>
      </div>

      <div className="text-[9px] text-slate-500 mb-4">
        Every TDC partitioned by post-quantum threat exposure
      </div>

      <div className="space-y-3 mb-5">
        <SupplyRow color="emerald" icon={Shield} label="PQ-secure"
                   sub="Falcon-512 outputs · safe under Shor"
                   value={fmtTdc(q.pqSafe)} pct={safePct} />
        <SupplyRow color="amber" icon={Hash} label="Hash-protected"
                   sub="ECDSA, pubkey not yet revealed"
                   value={fmtTdc(q.hashProtected)} pct={hashPct} />
        <SupplyRow color="rose" icon={ShieldAlert} label="Exposed"
                   sub="ECDSA, pubkey on-chain · vulnerable"
                   value={fmtTdc(q.exposed)} pct={expPct} />
      </div>

      <div className="space-y-1.5">
        <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.04]">
          <div className="bg-emerald-500/80" style={{ width: `${safePct}%` }} />
          <div className="bg-amber-500/80" style={{ width: `${hashPct}%` }} />
          <div className="bg-rose-500/80" style={{ width: `${expPct}%` }} />
        </div>
        <div className="flex justify-between text-[9px] text-slate-500">
          <span>0</span>
          <span>{fmtTdc(q.totalSupply)} TDC circulating</span>
        </div>
      </div>
    </Card>
  );
};

const SupplyRow = ({ color, icon: Icon, label, sub, value, pct }) => {
  const c = {
    emerald: { text: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    amber:   { text: "text-amber-300",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
    rose:    { text: "text-rose-300",    bg: "bg-rose-500/10",    border: "border-rose-500/20" },
  }[color];
  return (
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg ${c.bg} border ${c.border} flex items-center justify-center`}>
        <Icon size={14} className={c.text} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between">
          <span className={`text-[11px] font-medium ${c.text}`}>{label}</span>
          <Mono className={`text-[13px] ${c.text}`}>{pct.toFixed(1)}%</Mono>
        </div>
        <div className="text-[9px] text-slate-500 truncate">{sub}</div>
      </div>
    </div>
  );
};

/* ============================================================
 * FEE DISTRIBUTION
 * ============================================================ */
const FeeDistribution = () => {
  const data = engine.feeDistribution();
  const cutoff = engine.nextBlockCutoff();
  const cutoffIdx = data.findIndex(d => d.floor >= cutoff);
  const cutoffBucket = cutoffIdx > -1 ? data[cutoffIdx].bucket : data[0].bucket;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-1">
        <SectionLabel icon={Flame}>Mempool Fee Distribution</SectionLabel>
        <div className="flex items-center gap-3 text-[9px] text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-400/80" /> Falcon-512</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-cyan-400/80" /> ECDSA</span>
        </div>
      </div>
      <div className="text-[9px] text-slate-500 mb-3">
        Pending vsize (kB) by fee rate · vertical line = next-block cutoff
      </div>

      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="bucket"
              tick={{ fill: "#64748b", fontSize: 9 }}
              axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
              tickLine={false}
              label={{ value: "sat/vByte", position: "insideBottom", offset: -2, fill: "#475569", fontSize: 9 }}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 9 }}
              axisLine={false} tickLine={false}
              tickFormatter={(v) => `${v}k`}
            />
            <Tooltip
              cursor={{ fill: "rgba(167,139,250,0.06)" }}
              contentStyle={{
                background: "#05060e",
                border: "1px solid rgba(167,139,250,0.3)",
                borderRadius: 8, fontSize: 10, padding: "6px 10px",
              }}
              labelStyle={{ color: "#a78bfa", fontWeight: 500 }}
              formatter={(v, name) => [`${v} kB`, name]}
            />
            <Bar dataKey="falcon" stackId="a" fill="#a78bfa" name="Falcon-512" />
            <Bar dataKey="ecdsa"  stackId="a" fill="#22d3ee" name="ECDSA" radius={[3, 3, 0, 0]} />
            <ReferenceLine
              x={cutoffBucket}
              stroke="#fbbf24"
              strokeDasharray="3 3"
              strokeWidth={1.5}
              label={{ value: `next block @ ${cutoff} s/vB →`, fill: "#fbbf24", fontSize: 9, position: "insideTopRight" }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

/* ============================================================
 * LIVE EVENT FEED
 * ============================================================ */
const LiveEventFeed = () => {
  const liveTx = useMemo(() => {
    const txs = [];
    let h = engine.tip();
    while (txs.length < 12) { txs.push(...engine.txsForBlock(h, 6)); h--; }
    return txs.slice(0, 12);
  }, []);

  return (
    <Card className="p-5">
      <SectionLabel icon={Activity}>Live Activity</SectionLabel>
      <div className="space-y-1 max-h-[280px] overflow-y-auto custom-scroll pr-1">
        {liveTx.map((t, i) => (
          <div
            key={t.txid}
            className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-white/[0.03] transition-colors"
            style={{ animation: i === 0 ? "fadeSlide 0.4s ease-out" : "none" }}
          >
            <div className={`w-1 h-6 rounded-full ${t.isFalcon ? "bg-emerald-500/60" : "bg-amber-500/60"}`} />
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <Mono className="text-[10px] text-slate-400 truncate">{trunc(t.txid, 10, 6)}</Mono>
              {t.isFalcon
                ? <Shield size={9} className="text-emerald-400 flex-shrink-0" />
                : <ShieldAlert size={9} className="text-amber-500 flex-shrink-0" />}
            </div>
            <Mono className="text-[10px] text-violet-300">{fmtTdc(t.totalOut)}</Mono>
            <Mono className="text-[9px] text-slate-500 w-12 text-right">{t.feeRate} s/vB</Mono>
          </div>
        ))}
      </div>
    </Card>
  );
};

/* ============================================================
 * MINING DOMINANCE
 * ============================================================ */
const MiningDominance = () => {
  const blocks = engine.recentBlocks(20);
  const counts = {};
  blocks.forEach(b => { counts[b.miner.name] = (counts[b.miner.name] || 0) + 1; });
  const total = blocks.length;
  const sorted = Object.entries(counts)
    .map(([name, count]) => ({
      name, count, pct: (count / total) * 100,
      color: MINERS.find(m => m.name === name)?.color || "#94a3b8",
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <Card className="p-5">
      <SectionLabel icon={Pickaxe}>Mining Dominance · 20 blocks</SectionLabel>

      <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.04] mb-4">
        {sorted.map(m => (
          <div key={m.name} className="transition-all hover:brightness-125"
               style={{ width: `${m.pct}%`, background: m.color, opacity: 0.7 }}
               title={`${m.name} · ${m.pct.toFixed(0)}%`} />
        ))}
      </div>

      <div className="space-y-2">
        {sorted.map(m => (
          <div key={m.name} className="flex items-center gap-3 text-[11px]">
            <div className="w-2 h-2 rounded-sm" style={{ background: m.color }} />
            <span className="text-slate-300 flex-1">{m.name}</span>
            <Mono className="text-slate-500 w-8 text-right">{m.count}</Mono>
            <Mono className="text-slate-400 w-12 text-right">{m.pct.toFixed(0)}%</Mono>
          </div>
        ))}
      </div>
    </Card>
  );
};

/* ============================================================
 * KPI STRIP
 * ============================================================ */
const KpiStrip = () => {
  const stats = engine.mempoolStats();
  const tip = engine.block(engine.tip());
  const q = engine.quantumSupply();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <Kpi label="Block height" value={`#${fmtNum(engine.tip())}`} sub={`mined ${ago(tip.timestamp)} ago`} accent="violet" />
      <Kpi label="Hashrate"     value="342.7" unit="TH/s" sub="+2.4% / 24h" accent="cyan" />
      <Kpi label="Pending"      value={fmtNum(stats.total)} unit="txs" sub={`${(stats.totalVsize / 1e6).toFixed(1)} MvB`} accent="amber" />
      <Kpi label="PQ supply"    value={`${((q.pqSafe / q.totalSupply) * 100).toFixed(1)}`} unit="%" sub="Falcon-512 secured" accent="emerald" />
    </div>
  );
};

const Kpi = ({ label, value, unit, sub, accent }) => {
  const c = { violet: "text-violet-300", cyan: "text-cyan-300", amber: "text-amber-300", emerald: "text-emerald-300" }[accent];
  return (
    <Card className="px-4 py-3 relative overflow-hidden group">
      <div className="text-[9px] uppercase tracking-[0.15em] text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <Mono className={`text-[22px] font-medium ${c}`}>{value}</Mono>
        {unit && <span className="text-[10px] text-slate-500">{unit}</span>}
      </div>
      <div className="text-[9px] text-slate-500 mt-0.5">{sub}</div>
    </Card>
  );
};

/* ============================================================
 * DASHBOARD
 * ============================================================ */
const Dashboard = ({ navigate }) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const a = setInterval(() => { engine.tickMempool(); setTick(t => t + 1); }, 5000);
    const b = setInterval(() => { engine.tickBlock();   setTick(t => t + 1); }, 30000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);

  const narrative = engine.narrative();

  return (
    <>
      <NarrativeTicker narrative={narrative} />
      <BlockTimeline navigate={navigate} />
      <KpiStrip />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-2"><FeeDistribution /></div>
        <QuantumGauge navigate={navigate} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <LiveEventFeed />
        <MiningDominance />
      </div>
    </>
  );
};

/* ============================================================
 * BLOCKS LIST
 * ============================================================ */
const BlocksList = ({ navigate }) => {
  const [page, setPage] = useState(0);
  const PER = 25;
  const start = engine.tip() - page * PER;
  const blocks = Array.from({ length: PER }, (_, i) => engine.block(start - i));

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionLabel icon={Layers}>All Blocks</SectionLabel>
        <div className="flex items-center gap-2 text-[10px]">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
            className="px-2.5 py-1 rounded-md border border-white/10 text-slate-400 hover:text-violet-300 hover:border-violet-500/30 disabled:opacity-30 transition-colors">‹ newer</button>
          <Mono className="text-slate-500">page {page + 1}</Mono>
          <button onClick={() => setPage(page + 1)}
            className="px-2.5 py-1 rounded-md border border-white/10 text-slate-400 hover:text-violet-300 hover:border-violet-500/30 transition-colors">older ›</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-slate-500 border-b border-white/[0.05]">
              <th className="text-left py-2 px-2 font-medium">Height</th>
              <th className="text-left py-2 px-2 font-medium">Time</th>
              <th className="text-left py-2 px-2 font-medium">Miner</th>
              <th className="text-right py-2 px-2 font-medium">Txs</th>
              <th className="text-right py-2 px-2 font-medium">Size</th>
              <th className="text-right py-2 px-2 font-medium">Fees</th>
              <th className="text-right py-2 px-2 font-medium">Reward</th>
              <th className="text-left py-2 px-2 font-medium pl-4">PQ adoption</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map(b => (
              <tr key={b.height}
                  onClick={() => navigate({ name: "block", height: b.height })}
                  className="border-b border-white/[0.03] hover:bg-white/[0.025] cursor-pointer transition-colors">
                <td className="py-2.5 px-2"><Mono className="text-violet-300">#{fmtNum(b.height)}</Mono></td>
                <td className="py-2.5 px-2 text-slate-500">{ago(b.timestamp)} ago</td>
                <td className="py-2.5 px-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: b.miner.color }} />
                    <span className="text-slate-300">{b.miner.name}</span>
                  </span>
                </td>
                <td className="py-2.5 px-2 text-right"><Mono className="text-slate-300">{fmtNum(b.txCount)}</Mono></td>
                <td className="py-2.5 px-2 text-right"><Mono className="text-slate-500">{(b.sizeBytes / 1024).toFixed(0)} kB</Mono></td>
                <td className="py-2.5 px-2 text-right"><Mono className="text-cyan-300">{fmtTdc(b.totalFees)}</Mono></td>
                <td className="py-2.5 px-2 text-right"><Mono className="text-emerald-300">{fmtTdc(b.reward + b.totalFees)}</Mono></td>
                <td className="py-2.5 px-2 pl-4 w-44">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all" style={{ width: `${b.pqRatio * 100}%` }} />
                    </div>
                    <Mono className="text-[9px] text-slate-400 w-7 text-right">{(b.pqRatio * 100).toFixed(0)}%</Mono>
                    {b.pqRatio > 0.9 && <Shield size={9} className="text-emerald-400" />}
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
  const block = engine.block(height);
  const txs = engine.txsForBlock(height, 30);

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ name: "blocks" })}
              className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1">
        ← all blocks
      </button>

      <Card className="p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Pill color="violet">block</Pill>
              {block.pqRatio > 0.9 && <Pill color="emerald"><Shield size={8} /> quantum-safe</Pill>}
              <Pill color="slate">⛏ {block.miner.name}</Pill>
            </div>
            <h1 className="text-3xl font-mono font-medium text-slate-100">#{fmtNum(block.height)}</h1>
            <div className="mt-1 text-[10px] text-slate-500">
              {new Date(block.timestamp).toLocaleString()} · {ago(block.timestamp)} ago
            </div>
          </div>
          <div className="flex gap-6 flex-wrap">
            <Metric label="Transactions" value={fmtNum(block.txCount)} />
            <Metric label="Size"         value={`${(block.sizeBytes / 1024).toFixed(1)} kB`} />
            <Metric label="Fees"         value={`${fmtTdc(block.totalFees)} TDC`} />
            <Metric label="Reward"       value={`${fmtTdc(block.reward + block.totalFees)} TDC`} />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5 text-[11px]">
          <KV k="hash" v={<HashCopy value={block.hash} left={16} right={16} />} />
          <KV k="merkle root" v={<HashCopy value={block.merkleRoot} left={16} right={16} />} />
          <KV k="prev block" v={<HashCopy value={block.prevHash} left={16} right={16} />} />
          <KV k="difficulty" v={<Mono className="text-slate-300">{(+block.difficulty).toExponential(3)}</Mono>} />
          <KV k="nonce" v={<Mono className="text-slate-300">{fmtNum(block.nonce)}</Mono>} />
          <KV k="weight" v={<Mono className="text-slate-300">{fmtNum(block.weight)}</Mono>} />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider mb-1.5">
            <span className="text-slate-500">Falcon-512 adoption</span>
            <Mono className="text-violet-300">{(block.pqRatio * 100).toFixed(1)}%</Mono>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-emerald-400" style={{ width: `${block.pqRatio * 100}%` }} />
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <SectionLabel icon={Hash}>Transactions · {txs.length} of {fmtNum(block.txCount)}</SectionLabel>
        <div className="space-y-1 max-h-[600px] overflow-y-auto custom-scroll pr-1">
          {txs.map(t => (
            <button key={t.txid}
                    onClick={() => navigate({ name: "tx", txid: t.txid, _tx: t })}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06] transition-all">
              <div className={`w-1 h-7 rounded-full ${t.isFalcon ? "bg-emerald-500/60" : "bg-amber-500/60"}`} />
              <Mono className="text-[10px] text-slate-300 flex-1 text-left">{trunc(t.txid, 12, 8)}</Mono>
              <span className="text-[9px] text-slate-500">{t.inputs.length} → {t.outputs.length}</span>
              <Mono className="text-[10px] text-violet-300">{fmtTdc(t.totalOut)} TDC</Mono>
              <Mono className="text-[9px] text-slate-500 w-14 text-right">{t.feeRate} s/vB</Mono>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
};

const Metric = ({ label, value }) => (
  <div>
    <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
    <Mono className="text-base text-slate-100 mt-0.5 block">{value}</Mono>
  </div>
);

const KV = ({ k, v }) => (
  <div className="flex items-baseline gap-3 py-1 border-b border-white/[0.03]">
    <span className="text-slate-500 uppercase tracking-wider text-[9px] w-24 flex-shrink-0">{k}</span>
    <span className="text-slate-300 truncate">{v}</span>
  </div>
);

/* ============================================================
 * TX DETAIL
 * ============================================================ */
const TxDetail = ({ txid, preloaded, navigate }) => {
  const tx = preloaded || engine.txsForBlock(engine.tip() - 5, 1)[0];

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ name: "dashboard" })} className="text-[10px] text-violet-400 hover:text-violet-300">← back</button>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <Pill color="emerald">{tx.status}</Pill>
          {tx.isFalcon
            ? <Pill color="violet"><Shield size={8} /> Falcon-512</Pill>
            : <Pill color="amber"><ShieldAlert size={8} /> ECDSA legacy</Pill>}
          <Pill color="slate">{tx.confirmations} confs</Pill>
        </div>
        <div className="text-[9px] uppercase tracking-wider text-slate-500">Transaction</div>
        <div className="mt-1 font-mono text-sm text-slate-100 break-all">
          <HashCopy value={tx.txid} left={32} right={20} />
        </div>
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="Block" value={`#${fmtNum(tx.blockHeight)}`} />
          <Metric label="Size" value={`${tx.size} B`} />
          <Metric label="Vsize" value={`${tx.vsize} vB`} />
          <Metric label="Fee rate" value={`${tx.feeRate} s/vB`} />
          <Metric label="Total in" value={`${fmtTdc(tx.totalIn)} TDC`} />
          <Metric label="Total out" value={`${fmtTdc(tx.totalOut)} TDC`} />
          <Metric label="Fee" value={`${fmtTdc(tx.fee)} TDC`} />
          <Metric label="Locktime" value={tx.locktime} />
        </div>
      </Card>

      <Card className="p-5">
        <SectionLabel icon={Shield}>Post-Quantum Signature</SectionLabel>
        {tx.isFalcon ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
              <PqStat label="Algorithm" value="Falcon-512" />
              <PqStat label="Security" value="NIST L1 (~AES-128)" />
              <PqStat label="Verification" value={<span className="text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 size={11} /> verified</span>} />
              <PqStat label="Pubkey prefix" value={<HashCopy value={tx.falconPubkeyPrefix} left={16} right={8} />} />
              <PqStat label="Signature" value="~666 bytes" />
              <PqStat label="Lattice" value="NTRU deg 512, q=12289" />
            </div>
            <div className="mt-4 rounded-lg bg-violet-500/[0.04] border border-violet-500/15 p-3 text-[10.5px] text-slate-400 leading-relaxed">
              Lattice-based post-quantum signature. Secure against attacks by quantum computers running Shor's algorithm.
            </div>
          </>
        ) : (
          <div className="rounded-lg bg-amber-500/[0.04] border border-amber-500/15 p-3 text-[10.5px] text-amber-200/80 flex items-start gap-2">
            <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              ECDSA — vulnerable to a sufficiently capable quantum computer. Once this address has spent, the public key is on-chain forever and the address becomes maximally exposed.
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <SectionLabel icon={ArrowRight}>Inputs → Outputs</SectionLabel>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_40px_1fr] gap-4 items-start">
          <div className="space-y-2">
            <div className="text-[9px] uppercase tracking-wider text-slate-500">Inputs · {tx.inputs.length}</div>
            {tx.inputs.map((inp, i) => (
              <div key={i} className="rounded-lg border border-cyan-500/15 bg-cyan-500/[0.03] p-3">
                <button onClick={() => navigate({ name: "address", address: inp.address })}
                        className="text-[10px] font-mono text-cyan-300 hover:text-cyan-200 truncate block w-full text-left">
                  {trunc(inp.address, 14, 10)}
                </button>
                <div className="mt-1 flex items-center justify-between text-[9px]">
                  <Pill color={inp.scriptType === "p2falcon" ? "violet" : "slate"}>{inp.scriptType}</Pill>
                  <Mono className="text-slate-300">{fmtTdc(inp.value)}</Mono>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:flex items-center justify-center pt-10">
            <ArrowRight size={20} className="text-violet-400" />
          </div>
          <div className="space-y-2">
            <div className="text-[9px] uppercase tracking-wider text-slate-500">Outputs · {tx.outputs.length}</div>
            {tx.outputs.map((out, i) => (
              <div key={i} className="rounded-lg border border-violet-500/15 bg-violet-500/[0.03] p-3">
                <button onClick={() => navigate({ name: "address", address: out.address })}
                        className="text-[10px] font-mono text-violet-300 hover:text-violet-200 truncate block w-full text-left">
                  {trunc(out.address, 14, 10)}
                </button>
                <div className="mt-1 flex items-center justify-between text-[9px]">
                  <Pill color={out.scriptType === "p2falcon" ? "violet" : "slate"}>{out.scriptType}</Pill>
                  <Mono className="text-slate-300">{fmtTdc(out.value)}</Mono>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};

const PqStat = ({ label, value }) => (
  <div>
    <div className="text-[8.5px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className="text-[11px] text-slate-200 mt-0.5 font-mono">{value}</div>
  </div>
);

/* ============================================================
 * ADDRESS VIEW
 * ============================================================ */
const AddressView = ({ address, navigate }) => {
  const data = engine.getAddress(address);
  const safe = data.isFalcon;

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ name: "dashboard" })} className="text-[10px] text-violet-400 hover:text-violet-300">← back</button>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <Pill color="violet"><Wallet size={8} /> address</Pill>
          {safe ? <Pill color="emerald"><Shield size={8} /> PQ-secure</Pill>
                : <Pill color="rose"><ShieldAlert size={8} /> quantum-vulnerable</Pill>}
        </div>
        <div className="font-mono text-sm text-slate-100 break-all">
          <HashCopy value={data.address} left={40} right={20} />
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="Balance" value={`${fmtTdc(data.balance)} TDC`} />
          <Metric label="Received" value={`${fmtTdc(data.totalReceived)} TDC`} />
          <Metric label="Sent" value={`${fmtTdc(data.totalSent)} TDC`} />
          <Metric label="Tx count" value={fmtNum(data.txCount)} />
        </div>

        <div className={`mt-5 rounded-lg border p-3 text-[10.5px] leading-relaxed ${safe
          ? "bg-emerald-500/[0.04] border-emerald-500/15 text-emerald-200/80"
          : "bg-rose-500/[0.04] border-rose-500/15 text-rose-200/80"}`}>
          <div className="flex items-start gap-2">
            {safe ? <Shield size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                  : <AlertTriangle size={13} className="text-rose-400 mt-0.5 flex-shrink-0" />}
            <div>
              {safe
                ? "Falcon-512 (NTRU lattice). Funds remain safe under Shor's algorithm."
                : "Legacy ECDSA. Once any UTXO is spent, the public key is on-chain forever and the address becomes maximally vulnerable to a CRQC. Migrate to a tdc1q… address."}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionLabel icon={Box}>UTXOs · {data.utxos.length}</SectionLabel>
          <div className="space-y-1 max-h-72 overflow-y-auto custom-scroll">
            {data.utxos.map((u, i) => (
              <div key={i} className="flex items-center justify-between text-[10.5px] py-1.5 px-2 rounded hover:bg-white/[0.03]">
                <HashCopy value={u.txid} left={10} right={6} />
                <Mono className="text-slate-500">:{u.vout}</Mono>
                <Mono className="text-violet-300">{fmtTdc(u.value)}</Mono>
                <Mono className="text-[9px] text-slate-500">{u.confirmations} ✓</Mono>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <SectionLabel icon={Activity}>Recent transactions</SectionLabel>
          <div className="space-y-1 max-h-72 overflow-y-auto custom-scroll">
            {data.txs.map(t => (
              <button key={t.txid} onClick={() => navigate({ name: "tx", txid: t.txid })}
                className="w-full flex items-center justify-between text-[10.5px] py-1.5 px-2 rounded hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06]">
                <HashCopy value={t.txid} left={10} right={6} />
                <Mono className={t.amount > 0 ? "text-emerald-300" : "text-rose-300"}>
                  {t.amount > 0 ? "+" : ""}{fmtTdc(Math.abs(t.amount))}
                </Mono>
                <Mono className="text-[9px] text-slate-500">#{fmtNum(t.height)}</Mono>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

/* ============================================================
 * QUANTUM RISK PAGE
 * ============================================================ */
const QuantumPage = () => {
  const q = engine.quantumSupply();
  const safePct = (q.pqSafe / q.totalSupply) * 100;
  const hashPct = (q.hashProtected / q.totalSupply) * 100;
  const expPct = (q.exposed / q.totalSupply) * 100;

  const trend = Array.from({ length: 24 }, (_, i) => ({
    month: i,
    safe: 5 + i * 2.2 + Math.random() * 2,
    hash: 60 - i * 1.4,
    exposed: 35 - i * 0.8,
  }));

  return (
    <div className="space-y-5">
      <Card className="p-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-emerald-500/[0.05] blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-rose-500/[0.05] blur-3xl" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={14} className="text-violet-400" />
            <h1 className="text-[14px] font-medium tracking-tight text-slate-100">Quantum Threat Map</h1>
            <Pill color="violet">live</Pill>
          </div>
          <p className="text-[11px] text-slate-400 max-w-2xl leading-relaxed">
            Every TDC in circulation, partitioned by exposure to a cryptographically-relevant
            quantum computer. The only block explorer that shows you this.
          </p>

          <div className="mt-8">
            <div className="flex h-16 rounded-2xl overflow-hidden border border-white/[0.06]">
              <div className="bg-gradient-to-br from-emerald-500/40 to-emerald-600/30 flex flex-col items-center justify-center px-4 transition-all hover:from-emerald-500/50"
                   style={{ width: `${safePct}%` }}>
                <Mono className="text-2xl text-emerald-200 font-medium">{safePct.toFixed(1)}%</Mono>
                <span className="text-[9px] uppercase tracking-wider text-emerald-300/80">PQ-secure</span>
              </div>
              <div className="bg-gradient-to-br from-amber-500/40 to-amber-600/30 flex flex-col items-center justify-center px-4 transition-all hover:from-amber-500/50"
                   style={{ width: `${hashPct}%` }}>
                <Mono className="text-2xl text-amber-200 font-medium">{hashPct.toFixed(1)}%</Mono>
                <span className="text-[9px] uppercase tracking-wider text-amber-300/80">hash-protected</span>
              </div>
              <div className="bg-gradient-to-br from-rose-500/40 to-rose-600/30 flex flex-col items-center justify-center px-4 transition-all hover:from-rose-500/50"
                   style={{ width: `${expPct}%` }}>
                <Mono className="text-2xl text-rose-200 font-medium">{expPct.toFixed(1)}%</Mono>
                <span className="text-[9px] uppercase tracking-wider text-rose-300/80">exposed</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4">
              <BucketDetail color="emerald" icon={Shield} title="PQ-secure"
                value={fmtTdc(q.pqSafe)}
                desc="In Falcon-512 outputs (p2falcon). Safe under Shor's algorithm." />
              <BucketDetail color="amber" icon={Hash} title="Hash-protected"
                value={fmtTdc(q.hashProtected)}
                desc="ECDSA outputs whose pubkey has not yet been revealed. ~128-bit Grover security." />
              <BucketDetail color="rose" icon={ShieldAlert} title="Exposed"
                value={fmtTdc(q.exposed)}
                desc="ECDSA outputs whose pubkey has appeared on-chain via prior spends. Maximally vulnerable." />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <SectionLabel icon={TrendingUp}>Migration trend · 24 months</SectionLabel>
        <div className="h-64">
          <ResponsiveContainer>
            <AreaChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gs" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="ga" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gr" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}m`} />
              <YAxis tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: "#05060e", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 8, fontSize: 10 }} />
              <Area type="monotone" dataKey="safe"    stackId="1" stroke="#34d399" fill="url(#gs)" name="PQ-secure" />
              <Area type="monotone" dataKey="hash"    stackId="1" stroke="#fbbf24" fill="url(#ga)" name="Hash-protected" />
              <Area type="monotone" dataKey="exposed" stackId="1" stroke="#f87171" fill="url(#gr)" name="Exposed" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};

const BucketDetail = ({ color, icon: Icon, title, value, desc }) => {
  const c = {
    emerald: "border-emerald-500/20 bg-emerald-500/[0.03] text-emerald-300",
    amber:   "border-amber-500/20 bg-amber-500/[0.03] text-amber-300",
    rose:    "border-rose-500/20 bg-rose-500/[0.03] text-rose-300",
  }[color];
  return (
    <div className={`rounded-xl border ${c} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={12} />
        <span className="text-[10px] uppercase tracking-wider font-medium">{title}</span>
      </div>
      <Mono className="text-lg block">{value}</Mono>
      <div className="text-[9px] text-slate-400 mt-1 leading-relaxed">{desc}</div>
    </div>
  );
};

/* ============================================================
 * NOT FOUND
 * ============================================================ */
const NotFound = ({ query, navigate }) => (
  <Card className="p-10 text-center">
    <AlertTriangle size={28} className="mx-auto text-amber-400 mb-3" />
    <h2 className="text-base text-slate-200 font-medium">Nothing matched</h2>
    <p className="text-[11px] text-slate-500 mt-1">
      No block, transaction, or address for <Mono className="text-violet-300">{trunc(query, 24, 10)}</Mono>
    </p>
    <button onClick={() => navigate({ name: "dashboard" })}
            className="mt-5 px-4 py-2 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 text-[11px] border border-violet-500/30 transition-colors">
      ← back to pulse
    </button>
  </Card>
);

/* ============================================================
 * APP ROOT
 * ============================================================ */
export default function TideExplorer() {
  const [view, setView] = useState({ name: "dashboard" });
  const navigate = useCallback((v) => {
    setView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const narrative = engine.narrative();

  return (
    <div className="min-h-screen text-slate-200 relative" style={{ background: "#05060e" }}>
      <style>{`
        @keyframes shimmer { 100% { transform: translateX(100%); } }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        body { font-family: Inter, system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
        .font-mono { font-family: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
        .custom-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(167,139,250,0.18); border-radius: 3px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(167,139,250,0.35); }
      `}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 left-1/4 w-[800px] h-[800px] rounded-full bg-violet-600/[0.04] blur-3xl" />
        <div className="absolute top-1/4 -right-1/4 w-[600px] h-[600px] rounded-full bg-cyan-500/[0.03] blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-emerald-500/[0.02] blur-3xl" />
      </div>

      <Header view={view} navigate={navigate} narrative={narrative} />

      <main className="relative mx-auto max-w-[1600px] px-6 py-6">
        {view.name === "dashboard" && <Dashboard navigate={navigate} />}
        {view.name === "blocks"    && <BlocksList navigate={navigate} />}
        {view.name === "block"     && <BlockDetail height={view.height} navigate={navigate} />}
        {view.name === "tx"        && <TxDetail txid={view.txid} preloaded={view._tx} navigate={navigate} />}
        {view.name === "address"   && <AddressView address={view.address} navigate={navigate} />}
        {view.name === "quantum"   && <QuantumPage />}
        {view.name === "notfound"  && <NotFound query={view.query} navigate={navigate} />}
      </main>

      <footer className="relative mx-auto max-w-[1600px] px-6 py-6 text-[9px] text-slate-600 flex items-center justify-between border-t border-white/[0.04] mt-10">
        <span>TideExplorer · post-quantum block explorer for Tidecoin</span>
        <Mono>{RPC.USE_LIVE ? `LIVE · ${RPC.URL}` : "MOCK ENGINE"}</Mono>
      </footer>
    </div>
  );
}
