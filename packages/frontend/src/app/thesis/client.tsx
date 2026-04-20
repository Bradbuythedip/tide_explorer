"use client";

import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer,
  ComposedChart, Area,
} from "recharts";

const BTC_HALVINGS = [
  { y: 2009, rate: 7200 }, { y: 2012.909, rate: 3600 }, { y: 2016.521, rate: 1800 },
  { y: 2020.361, rate: 900 }, { y: 2024.304, rate: 450 }, { y: 2028.3, rate: 225 },
  { y: 2032.3, rate: 112.5 }, { y: 2036.3, rate: 56.25 }, { y: 2040.3, rate: 28.125 },
  { y: 2044.3, rate: 14.0625 }, { y: 2048.3, rate: 7.03125 }, { y: 2052.3, rate: 3.515625 },
];

const TDC_QUARTENINGS = [
  { y: 2021, rate: 57600 }, { y: 2021.5, rate: 14400 }, { y: 2022.5, rate: 3600 },
  { y: 2024.5, rate: 900 }, { y: 2028.5, rate: 225 }, { y: 2036.5, rate: 56.25 },
  { y: 2052.5, rate: 14.0625 },
];

function rateAt(schedule: { y: number; rate: number }[], year: number) {
  let r: number | null = null;
  for (const pt of schedule) { if (year >= pt.y) r = pt.rate; }
  return r;
}

function buildEmission() {
  const d = [];
  for (let y = 2009; y <= 2060.01; y += 0.1) {
    d.push({ year: +y.toFixed(2), btc: rateAt(BTC_HALVINGS, y), tdc: y < 2021 ? null : rateAt(TDC_QUARTENINGS, y) });
  }
  return d;
}

function buildSupply() {
  const d = [];
  let bs = 0, ts = 0, py = 2009;
  for (let y = 2009; y <= 2060.01; y += 0.1) {
    const dy = y - py; py = y;
    bs += (rateAt(BTC_HALVINGS, y) ?? 0) * 365 * dy;
    ts += (y >= 2021 ? (rateAt(TDC_QUARTENINGS, y) ?? 0) : 0) * 365 * dy;
    d.push({ year: +y.toFixed(2), btc: Math.min(bs / 1e6, 21), tdc: y >= 2021 ? Math.min(ts / 1e6, 21) : null });
  }
  return d;
}

const C = { bg: "#0a0806", panel: "#13100d", border: "#2a241d", text: "#f5f1ea", muted: "#8b8278", dim: "#5a5348", btc: "#f7931a", tdc: "#00d9ff", sig: "#fbbf24", sigSoft: "rgba(251,191,36,0.12)" };

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const yr = Math.floor(label);
  const mo = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Math.floor((label - yr) * 12)] ?? "";
  return (
    <div style={{ background: "rgba(10,8,6,0.95)", border: `1px solid ${C.border}`, padding: "10px 14px", fontFamily: "monospace", fontSize: 11 }}>
      <div style={{ color: C.muted, marginBottom: 6 }}>{mo} {yr}</div>
      {payload.map((p: any, i: number) => p.value != null && (
        <div key={i} style={{ color: p.color, display: "flex", justifyContent: "space-between", gap: 18 }}>
          <span>{p.name}</span><span>{Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
        </div>
      ))}
    </div>
  );
}

export function ThesisClient() {
  const emission = useMemo(buildEmission, []);
  const supply = useMemo(buildSupply, []);
  const [scale, setScale] = useState<"log" | "linear">("log");

  const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
  const tag = (t: string) => (
    <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: C.sig, borderLeft: `1px solid ${C.sig}`, paddingLeft: 8 }}>{t}</span>
  );

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", padding: "48px 24px 96px", backgroundImage: `radial-gradient(circle at 15% 0%, rgba(247,147,26,0.06), transparent 45%), radial-gradient(circle at 85% 100%, rgba(0,217,255,0.05), transparent 50%)` }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* HEADER */}
        <header style={{ marginBottom: 72 }}>
          <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 20, borderBottom: `1px solid ${C.border}`, marginBottom: 48, flexWrap: "wrap" as const, gap: 12 }}>
            <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.2em", color: C.muted, textTransform: "uppercase" as const }}>Tidecoin / TDC · Monetary Thesis</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>v.1 · Apr 2026</div>
          </div>
          <h1 style={{ fontSize: "clamp(40px,6vw,84px)", fontWeight: 300, lineHeight: 0.95, letterSpacing: "-0.03em", margin: "0 0 28px", maxWidth: 1000 }}>
            Tidecoin emits Bitcoin&apos;s monetary policy <em style={{ color: C.sig, fontWeight: 400 }}>on purpose</em>, at two calendar dates that haven&apos;t happened yet.
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.55, color: C.muted, maxWidth: 760, margin: 0, fontStyle: "italic" }}>
            The Quartening schedule <span style={{ color: C.text }}>(0.5, 1, 2, 4, 8 years)</span> and the 40 TDC genesis reward were chosen so that daily emission rates synchronize exactly in <span style={{ color: C.sig }}>July 2028</span> and again in <span style={{ color: C.sig }}>July 2036</span>.
          </p>
        </header>

        {/* 01 EQUATION */}
        <section style={{ marginBottom: 72 }}>
          {tag("01 · The equation")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 48, marginTop: 24, alignItems: "center" }}>
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: "40px 32px", fontFamily: mono }}>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.15em", marginBottom: 24 }}>EMISSION EQUALITY CONDITION</div>
              <div style={{ fontSize: 14, color: C.muted, lineHeight: 2, marginBottom: 20 }}>
                <div>40 × 0.25ⁿ × 1440 = 50 × 0.5ᵐ × 144</div>
                <div style={{ color: C.dim }}>│</div>
                <div>8 × 0.5²ⁿ = 0.5ᵐ</div>
                <div style={{ color: C.dim }}>│</div>
              </div>
              <div style={{ fontSize: 56, fontStyle: "italic", fontWeight: 400, color: C.sig, textAlign: "center" as const, padding: "12px 0" }}>m = 2n − 3</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 20, lineHeight: 1.7 }}>n = # of TDC Quartenings<br/>m = # of BTC halvings</div>
            </div>
            <div style={{ fontSize: 17, lineHeight: 1.65 }}>
              <p style={{ margin: "0 0 18px" }}>Setting daily emissions equal gives a linear relation between Quartening count and halving count. Setting calendar times equal gives: <span style={{ fontFamily: mono, fontSize: 15, color: C.sig }}>2ⁿ = 16n − 47</span>.</p>
              <p style={{ margin: "0 0 18px", color: C.muted }}>That system has integer solutions at exactly two points.</p>
              <div style={{ fontFamily: mono, fontSize: 14, color: C.tdc }}>n=4, m=5 → Jul 2028 ⇄ Apr 2028<br/>n=5, m=7 → Jul 2036 ⇄ Apr 2036</div>
            </div>
          </div>
        </section>

        {/* 02 EMISSION CHART */}
        <section style={{ marginBottom: 72 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24, flexWrap: "wrap" as const, gap: 12 }}>
            {tag("02 · Daily emission, 2009 → 2060")}
            <div style={{ display: "flex", gap: 4, fontFamily: mono, fontSize: 11 }}>
              {(["log", "linear"] as const).map(s => (
                <button key={s} onClick={() => setScale(s)} style={{ background: scale === s ? C.text : "transparent", color: scale === s ? C.bg : C.muted, border: `1px solid ${scale === s ? C.text : C.border}`, padding: "6px 14px", cursor: "pointer", letterSpacing: "0.15em", textTransform: "uppercase" as const, fontFamily: "inherit", fontSize: "inherit" }}>{s}</button>
              ))}
            </div>
          </div>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: "32px 12px 20px", height: 520 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={emission} margin={{ top: 20, right: 30, left: 30, bottom: 20 }}>
                <CartesianGrid stroke={C.border} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="year" type="number" domain={[2009, 2060]} ticks={[2009, 2016, 2024, 2028, 2036, 2044, 2052, 2060]} tick={{ fill: C.muted, fontSize: 11 }} stroke={C.dim} tickFormatter={(y: number) => String(Math.round(y))} />
                <YAxis scale={scale} domain={scale === "log" ? [0.1, 100000] : [0, 60000]} tick={{ fill: C.muted, fontSize: 11 }} stroke={C.dim} tickFormatter={(v: number) => v >= 1000 ? `${v / 1000}k` : String(v)} />
                <Tooltip content={<Tip />} />
                <ReferenceArea x1={2028.0} x2={2028.6} fill={C.sigSoft} stroke="none" />
                <ReferenceArea x1={2036.0} x2={2036.6} fill={C.sigSoft} stroke="none" />
                <ReferenceLine x={2028.3} stroke={C.sig} strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: "CONVERGENCE · 225/day", position: "top", fill: C.sig, fontSize: 10 }} />
                <ReferenceLine x={2036.3} stroke={C.sig} strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: "56.25/day", position: "top", fill: C.sig, fontSize: 10 }} />
                <Line type="stepAfter" dataKey="btc" name="BTC" stroke={C.btc} strokeWidth={2.2} dot={false} />
                <Line type="stepAfter" dataKey="tdc" name="TDC" stroke={C.tdc} strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontFamily: mono, fontSize: 11, color: C.muted, flexWrap: "wrap" as const, gap: 16 }}>
            <div style={{ display: "flex", gap: 24 }}>
              <span><span style={{ display: "inline-block", width: 16, height: 2, background: C.btc, verticalAlign: "middle", marginRight: 8 }} />BITCOIN</span>
              <span><span style={{ display: "inline-block", width: 16, height: 2, background: C.tdc, verticalAlign: "middle", marginRight: 8 }} />TIDECOIN</span>
            </div>
          </div>
        </section>

        {/* 03 CONVERGENCE CARDS */}
        <section style={{ marginBottom: 72 }}>
          {tag("03 · The two synchronization events")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginTop: 24 }}>
            {[
              { label: "FIRST CONVERGENCE", date: "Jul 2028", cd: "in ~2y", btcR: "225 / day", tdcR: "225 / day", note: "BTC 5th halving meets TDC Q4. Both chains emit at identical rates for the first time." },
              { label: "SECOND CONVERGENCE", date: "Jul 2036", cd: "in ~10y", btcR: "56.25 / day", tdcR: "56.25 / day", note: "BTC 7th halving meets TDC Q5. Final exact emission match before both approach terminal supply." },
            ].map((c, i) => (
              <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.sig}`, padding: "28px 28px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
                  <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.2em", color: C.muted }}>{c.label}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: C.muted }}>{c.cd}</div>
                </div>
                <div style={{ fontSize: 48, fontWeight: 400, letterSpacing: "-0.02em", marginBottom: 24 }}>{c.date}</div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, fontFamily: mono, fontSize: 13 }}>
                  <div><div style={{ color: C.muted, fontSize: 10, marginBottom: 4 }}>BTC</div><div style={{ color: C.btc }}>{c.btcR}</div></div>
                  <div><div style={{ color: C.muted, fontSize: 10, marginBottom: 4 }}>TDC</div><div style={{ color: C.tdc }}>{c.tdcR}</div></div>
                </div>
                <p style={{ fontStyle: "italic", color: C.muted, lineHeight: 1.55, margin: "18px 0 0", fontSize: 14 }}>{c.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 04 SUPPLY CHART */}
        <section style={{ marginBottom: 72 }}>
          {tag("04 · Cumulative supply toward 21M cap")}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: "32px 12px 20px", height: 400, marginTop: 24 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={supply} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <defs>
                  <linearGradient id="bsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.btc} stopOpacity={0.18} /><stop offset="100%" stopColor={C.btc} stopOpacity={0} /></linearGradient>
                  <linearGradient id="tsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.tdc} stopOpacity={0.18} /><stop offset="100%" stopColor={C.tdc} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke={C.border} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="year" type="number" domain={[2009, 2060]} ticks={[2009, 2016, 2024, 2028, 2036, 2044, 2052, 2060]} tick={{ fill: C.muted, fontSize: 11 }} stroke={C.dim} tickFormatter={(y: number) => String(Math.round(y))} />
                <YAxis domain={[0, 21]} ticks={[0, 5, 10, 15, 20, 21]} tick={{ fill: C.muted, fontSize: 11 }} stroke={C.dim} tickFormatter={(v: number) => `${v}M`} />
                <Tooltip content={<Tip />} />
                <ReferenceLine y={21} stroke={C.dim} strokeDasharray="2 2" label={{ value: "21M CAP", position: "insideTopRight", fill: C.muted, fontSize: 10 }} />
                <Area type="monotone" dataKey="btc" stroke={C.btc} strokeWidth={2} fill="url(#bsg)" name="BTC supply" />
                <Area type="monotone" dataKey="tdc" stroke={C.tdc} strokeWidth={2} fill="url(#tsg)" name="TDC supply" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p style={{ color: C.muted, fontStyle: "italic", fontSize: 14, lineHeight: 1.55, marginTop: 16, maxWidth: 780 }}>
            Both chains cap at 21M. TDC front-loaded ~50% in its first 6 months (fair launch, CPU only). By 2036, both are within ~200K of terminal supply.
          </p>
        </section>

        {/* 05 SPECS */}
        <section style={{ marginBottom: 72 }}>
          {tag("05 · The specs")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0 32px", marginTop: 24 }}>
            {[
              { l: "Max supply", v: "21,000,000", s: "identical to Bitcoin" },
              { l: "Block time", v: "60 s", s: "10× faster than BTC" },
              { l: "Signature", v: "Falcon-512", s: "NIST lattice PQ", c: C.tdc },
              { l: "Launch", v: "Jan 2021", s: "fair launch, no premine" },
              { l: "Current reward", v: "0.625 TDC", s: "post-Q3; next cut Q4 Jul 2028" },
              { l: "Post-Q4 rate", v: "225 / day", s: "matches BTC post-2028", c: C.sig },
              { l: "Circulating", v: "~18.8M", s: "≈ 89.5% of cap issued" },
              { l: "Emission left", v: "~2.2M", s: "asymptotic to 21M" },
            ].map((x, i) => (
              <div key={i} style={{ borderTop: `1px solid ${C.border}`, padding: "16px 0" }}>
                <div style={{ fontFamily: mono, fontSize: 10, color: C.muted, letterSpacing: "0.16em", textTransform: "uppercase" as const, marginBottom: 8 }}>{x.l}</div>
                <div style={{ fontFamily: mono, fontSize: 28, fontWeight: 500, color: x.c ?? C.text, lineHeight: 1 }}>{x.v}</div>
                <div style={{ fontStyle: "italic", fontSize: 13, color: C.muted, marginTop: 8 }}>{x.s}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 06 PITCH */}
        <section style={{ marginBottom: 48 }}>
          {tag("06 · What this means")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 28, marginTop: 24 }}>
            {[
              { h: "The pre-2028 window is the last era of divergence.", b: "Today TDC emits ~900/day vs BTC ~450/day. On Jul 2028, that gap vanishes — forever." },
              { h: "Dilution headwind is effectively over.", b: "Forward-looking TDC inflation (~1.7%/yr) is already lower than BTC's within rounding." },
              { h: "The convergence is a Schelling-point moment.", b: "\"TDC now matches BTC monetary policy\" becomes literally true on a specific Tuesday in 2028." },
              { h: "The math is the moat.", b: "Any PQ chain can copy Falcon-512. Only Tidecoin has five years of block history on its schedule." },
            ].map((x, i) => (
              <div key={i} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
                <div style={{ fontFamily: mono, fontSize: 11, color: C.sig, letterSpacing: "0.15em", marginBottom: 12 }}>0{i + 1}</div>
                <h3 style={{ fontSize: 22, fontWeight: 400, lineHeight: 1.25, margin: "0 0 12px" }}>{x.h}</h3>
                <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{x.b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ marginTop: 96, paddingTop: 32, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 10, letterSpacing: "0.15em", color: C.muted, textTransform: "uppercase" as const, flexWrap: "wrap" as const, gap: 16 }}>
          <div>tidecoin.org · Falcon-512 · fair launch · 21M cap</div>
          <div>Not investment advice. Verify on-chain.</div>
        </footer>
      </div>
    </div>
  );
}
