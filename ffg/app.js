"use strict";

// FFG Offshore Risk Solution — client calculator.
// Figures follow the cell captive model. No Thornbird or CFO Centre fee share.

var STRUCT = {
  one: { label: "One-to-one", minPremium: 5000000, capitalPct: 0.20, note: "Your own cell. Your trust owns the GBC that holds the cell." },
  many: { label: "One-to-many", minPremium: 1000000, capitalPct: 0.35, note: "A shared cell of up to 10 policies, each ring-fenced by its own class of shares. Minimum 3-year commitment." }
};
var FRONTING = 0.025;
var FFG_FEE = 0.092;
var GR_PCT = 0.03;
var GR_MIN = 30000;
var MU_TAX = 0.03;
var IBNR = 0.07;
var NCB_CYCLE = 3;
var SA_CIT = 0.27;
var CGT_INCLUSION = 0.40;
var MAX_POLICIES = 10;
var COSTS = {
  one: { setup: 4500 + 12000, annual: 2000 + 8000, sharedSetup: 0, sharedAnnual: 0 },
  many: { setup: 3000, annual: 1500, sharedSetup: 12000, sharedAnnual: 8000 }
};
var CFO_REFERRAL_ZAR = 30000;
var INV_NOTE = "FFG and Guardrisk are well versed in managing and securing low-risk, US dollar-based returns for clients.";
var DEFAULTS = { premium: "1,000,000", fx: "16.60", dep: "3", inv: "4", claims: "0", esc: "5", taxable: "20,000,000", policies: "10", divTax: "20", marginal: "45" };
var FX_PRESETS = [
  { value: "base", label: "Base: rand weakens 3% pa", dep: "3" },
  { value: "strong", label: "Rand strengthens 2% pa", dep: "-2" },
  { value: "weak", label: "Rand weakens 6% pa", dep: "6" },
  { value: "flat", label: "Flat rand", dep: "0" }
];
var RISKS = [
  { id: "crop", name: "Crop and agricultural", group: "Hard-to-insure (FFG focus)", detail: "Crop loss from hail, drought, fire and disease where local cover is scarce or costly." },
  { id: "fleet", name: "Motor fleet (trucks and vehicles)", group: "Hard-to-insure (FFG focus)", detail: "Own damage, theft and hijacking of commercial vehicles and truck fleets." },
  { id: "debtors", name: "Debtors / trade credit", group: "Hard-to-insure (FFG focus)", detail: "Bad debts from customer insolvency or protracted default." },
  { id: "expro", name: "Land expropriation / political risk", group: "Hard-to-insure (FFG focus)", detail: "Loss of land or assets through expropriation or political action, where insurable." },
  { id: "excess", name: "Excess and deductible buy-down", group: "Hard-to-insure (FFG focus)", detail: "Funds the high excesses and self-insured layers under your existing policies." },
  { id: "special", name: "Specialised assets", group: "Hard-to-insure (FFG focus)", detail: "Unusual or high-value assets that the local market will not cover in full." },
  { id: "warranty", name: "Product warranty", group: "Hard-to-insure (FFG focus)", detail: "Warranty and extended-warranty claims on products you sell." },
  { id: "md", name: "Material damage / property", group: "Property and operations", detail: "Fire, storm, flood and accidental damage to buildings, stock and contents." },
  { id: "bi", name: "Business interruption", group: "Property and operations", detail: "Lost gross profit and extra costs after an insured damage event." },
  { id: "git", name: "Goods in transit", group: "Property and operations", detail: "Loss or damage to goods while being transported." },
  { id: "plant", name: "Plant and machinery breakdown", group: "Property and operations", detail: "Sudden mechanical or electrical breakdown of plant and equipment." },
  { id: "works", name: "Contract works", group: "Property and operations", detail: "Damage to construction or installation works in progress." },
  { id: "publ", name: "Public liability", group: "Liability", detail: "Claims by third parties for injury or property damage." },
  { id: "prod", name: "Product liability", group: "Liability", detail: "Claims arising from defective products you make or supply." },
  { id: "pi", name: "Professional indemnity", group: "Liability", detail: "Claims for negligent advice or services." },
  { id: "dno", name: "Directors' and officers' liability", group: "Liability", detail: "Personal liability of directors and officers for management decisions." },
  { id: "cyber", name: "Cyber", group: "Financial and people", detail: "Data breach, ransomware, system outage and related third-party claims." },
  { id: "fidelity", name: "Employee fidelity / theft", group: "Financial and people", detail: "Theft and fraud by employees." },
  { id: "keyperson", name: "Key person", group: "Financial and people", detail: "Financial loss from the death or disability of a key person." }
];

function num(s, d) {
  var v = parseFloat(String(s).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(v) ? v : d;
}
function fmt0(v) { return Math.round(v).toLocaleString("en-US"); }
function R(v) { return (v < 0 ? "-R" : "R") + fmt0(Math.abs(v)); }
function U(v) { return (v < 0 ? "-$" : "$") + fmt0(Math.abs(v)); }
function Rm(v) { return "R" + (v / 1e6).toFixed(2) + "m"; }
function pct(v) { return (v * 100).toFixed(1).replace(/\.0$/, "") + "%"; }
function chartMax(v) {
  if (!(v > 0) || !Number.isFinite(v)) return 1;
  var p = Math.pow(10, Math.floor(Math.log10(v)));
  var steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  var need = v * 1.06;
  for (var i = 0; i < steps.length; i++) {
    var c = steps[i] * p;
    if (c + 1e-9 >= need) return Math.round(c * 1e6) / 1e6;
  }
  return 10 * p;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function runModel(o) {
  var share = 1 / o.n;
  var rows = [];
  var prevIr = 0, prevCash = 0, capHeld = 0, cumNcbZ = 0, cumOutlay = 0;
  for (var y = 1; y <= 10; y++) {
    var fx = o.fx0 * Math.pow(1 + o.dep, y - 1);
    var pz = o.P * Math.pow(1 + o.esc, y - 1) * o.n;
    var gz = pz / (1 - FRONTING);
    var pu = pz / fx;
    var ffg = pu * FFG_FEE;
    var gr = Math.max(GR_PCT * pu, GR_MIN);
    var cl = o.lr * pu;
    var ir = IBNR * pu;
    var ic = ir - prevIr;
    var ci = y === 1 ? o.cap * pu : 0;
    capHeld += ci;
    var oc = (y === 1 ? 0 : prevCash) + ci;
    var ii = o.inv * oc;
    var uw = pu - ffg - gr - cl - ic;
    var pb = uw + ii;
    var tx = Math.max(0, pb) * MU_TAX;
    var cp = oc + pu - ffg - gr - cl - tx + ii;
    var nb = y % NCB_CYCLE === 0 ? Math.max(0, cp - capHeld - ir) : 0;
    var cash = cp - nb;
    cumNcbZ += nb * fx * share;
    var c = COSTS[o.s];
    var structUsd = (y === 1 ? c.setup : 0) + c.annual + ((y === 1 ? c.sharedSetup : 0) + c.sharedAnnual) * share;
    var grossMine = gz * share;
    var taxSave = grossMine * SA_CIT;
    var capZ = ci * fx * share;
    cumOutlay += grossMine - taxSave + structUsd * fx + capZ + (y === 1 ? CFO_REFERRAL_ZAR : 0);
    rows.push({
      y: y, fx: fx, gross: grossMine, fronting: (gz - pz) * share, risk: pz * share, pu: pu * share,
      ffg: ffg * share, gr: gr * share, claims: cl * share, ibnr: ic * share, uw: uw * share,
      inv: ii * share, mtax: tx * share, ncb: nb * share, ncbZ: nb * fx * share, cumNcbZ: cumNcbZ,
      cash: cash * share, cashZ: cash * fx * share, total: cash * fx * share + cumNcbZ,
      taxSave: taxSave, afterTax: grossMine - taxSave, structZ: structUsd * fx, capZ: capZ, cumOutlay: cumOutlay
    });
    prevIr = ir;
    prevCash = cash;
  }
  return rows;
}

var state = {
  structure: "many",
  premiumS: DEFAULTS.premium,
  policiesS: DEFAULTS.policies,
  fxS: DEFAULTS.fx,
  depS: DEFAULTS.dep,
  invS: DEFAULTS.inv,
  claimsS: DEFAULTS.claims,
  escS: DEFAULTS.esc,
  taxableS: DEFAULTS.taxable,
  divTaxS: DEFAULTS.divTax,
  marginalS: DEFAULTS.marginal,
  monthsS: "12",
  ownFx: false,
  view: "zar",
  picked: ["fleet", "debtors", "md", "bi"]
};

function compute() {
  var st = STRUCT[state.structure];
  var entered = num(state.premiumS, 0);
  var belowMin = entered < st.minPremium;
  var P = Math.max(entered, st.minPremium);
  var n = state.structure === "one" ? 1 : Math.min(MAX_POLICIES, Math.max(1, Math.round(num(state.policiesS, 10))));
  var fx0 = Math.max(0.01, num(state.fxS, 16.6));
  var dep = num(state.depS, 3) / 100;
  var inv = num(state.invS, 4) / 100;
  var lr = Math.max(0, num(state.claimsS, 0)) / 100;
  var escalation = num(state.escS, 5) / 100;
  var rows = runModel({ n: n, P: P, esc: escalation, cap: st.capitalPct, fx0: fx0, dep: dep, lr: lr, inv: inv, s: state.structure });
  var y1 = rows[0];
  var y10 = rows[9];
  var taxable = num(state.taxableS, 0);
  var months = Math.min(12, Math.max(0, num(state.monthsS, 12)));
  var deduction = y1.gross * months / 12;
  var taxBefore = Math.max(0, taxable) * SA_CIT;
  var taxableAfter = taxable - deduction;
  var taxAfter = Math.max(0, taxableAfter) * SA_CIT;
  var preset = null;
  for (var i = 0; i < FX_PRESETS.length; i++) if (FX_PRESETS[i].dep === state.depS) preset = FX_PRESETS[i];
  var pickedRisks = RISKS.filter(function (r) { return state.picked.indexOf(r.id) !== -1; });
  var available = RISKS.filter(function (r) { return state.picked.indexOf(r.id) === -1; });
  return {
    st: st, entered: entered, belowMin: belowMin, P: P, n: n, fx0: fx0,
    rows: rows, y1: y1, y10: y10,
    totNcbZ: y10.cumNcbZ,
    totNcbU: rows.reduce(function (a, r) { return a + r.ncb; }, 0),
    capitalUsd: st.capitalPct * y1.pu,
    capitalZar: st.capitalPct * y1.pu * fx0,
    taxable: taxable, months: months, deduction: deduction,
    taxBefore: taxBefore, taxableAfter: taxableAfter, taxAfter: taxAfter,
    taxSaving: taxBefore - taxAfter,
    netCost: deduction - (taxBefore - taxAfter),
    fxPreset: preset ? preset.value : "custom",
    pickedRisks: pickedRisks, available: available,
    dep: dep, inv: inv, lr: lr, esc: escalation,
    claimsPct: Math.max(0, num(state.claimsS, 0)),
    depPct: num(state.depS, 3),
    invPct: num(state.invS, 4),
    escPct: num(state.escS, 5)
  };
}

function field(id, label, value) {
  return '<label class="field"><span>' + esc(label) + '</span><input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="' + esc(value) + '"></label>';
}

function callout(tone, lead, body) {
  return '<div class="callout ' + tone + '"><p class="callout-lead">' + esc(lead) + '</p><p>' + esc(body) + '</p></div>';
}

function props(items) {
  return '<dl class="props">' + items.map(function (it) {
    return '<div><dt>' + esc(it[0]) + '</dt><dd>' + esc(it[1]) + '</dd></div>';
  }).join("") + '</dl>';
}

function cell(text, pos, title) { return { text: String(text), pos: !!pos, title: title || "" }; }

function sheet(caption, headers, bodyRows, wide) {
  var head = headers.map(function (h, i) {
    return '<th scope="col"' + (i ? ' class="num"' : '') + '>' + esc(h) + '</th>';
  }).join("");
  var body = bodyRows.map(function (row) {
    var cells = row.cells.map(function (c, i) {
      var cls = ((i ? "num" : "") + (c.pos ? " pos" : "")).trim();
      var title = c.title ? ' title="' + esc(c.title) + '"' : "";
      return '<td' + (cls ? ' class="' + cls + '"' : '') + title + (i === 0 ? ' scope="row"' : '') + '>' + esc(c.text) + '</td>';
    }).join("");
    var cls = [];
    if (row.total) cls.push("total");
    if (row.sub) cls.push("sub");
    if (row.hi) cls.push("hi");
    if (row.memo) cls.push("memo");
    return '<tr' + (cls.length ? ' class="' + cls.join(" ") + '"' : '') + (row.year ? ' data-year="' + row.year + '"' : '') + '>' + cells + '</tr>';
  }).join("");
  var kind = wide === true ? "wide" : (wide === "compact" || wide === "exit") ? "compact" : wide === "irr" ? "irr" : "mid";
  var hint = kind === "mid" ? " until-mid" : kind === "irr" ? " irr-hint" : "";
  var extra = wide === "exit" ? " exit-fit" : "";
  return '<div class="sheet-wrap"><p class="scroll-hint' + hint + '">Scroll sideways for every column.</p><div class="sheet"><table class="' + kind + extra + '"><caption class="vh">' + esc(caption) + '</caption><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
}

function chartBox() {
  var pageW = document.getElementById("calculator").clientWidth || 640;
  var narrow = pageW < 860;
  return {
    w: Math.max(280, Math.floor(narrow ? pageW : (pageW - 40) / 2)),
    h: narrow ? 268 : 300
  };
}

function axisM(v) {
  var rounded = Math.round(v * 10) / 10;
  var s = Math.abs(rounded - Math.round(rounded)) < 1e-9 ? String(Math.round(rounded)) : rounded.toFixed(1);
  return "R" + s + "m";
}

function finite(v) { return Number.isFinite(v) ? v : 0; }

function lineChart(m) {
  var box = chartBox();
  var w = box.w, h = box.h;
  var pad = { l: 64, r: 12, t: 14, b: 32 };
  var iw = w - pad.l - pad.r;
  var ih = h - pad.t - pad.b;
  var series = [
    { name: "Total value (cell + bonuses)", color: "#1B2A4A", width: 2.25, dash: "", values: m.rows.map(function (r) { return r.total / 1e6; }) },
    { name: "No-claim bonuses paid to date", color: "#2F5E80", width: 1.75, dash: "", values: m.rows.map(function (r) { return r.cumNcbZ / 1e6; }) },
    { name: "Cell value", color: "#4F7390", width: 1.75, dash: "", values: m.rows.map(function (r) { return r.cashZ / 1e6; }) },
    { name: "Cumulative after-tax cost incl. capital, trust/GBC and referral", color: "#8C6239", width: 1.75, dash: "5 4", values: m.rows.map(function (r) { return r.cumOutlay / 1e6; }) }
  ];
  var peak = 0;
  series.forEach(function (sr) { sr.values.forEach(function (v) { if (Number.isFinite(v) && v > peak) peak = v; }); });
  var ceiling = chartMax(peak);
  function x(i) { return pad.l + (i / 9) * iw; }
  function y(v) {
    var c = Math.max(0, Math.min(ceiling, finite(v)));
    return pad.t + ih - (c / ceiling) * ih;
  }
  var grid = "";
  for (var t = 0; t <= 4; t++) {
    var val = ceiling * t / 4;
    var yy = y(val);
    grid += '<line x1="' + pad.l + '" y1="' + yy.toFixed(1) + '" x2="' + (w - pad.r) + '" y2="' + yy.toFixed(1) + '" stroke="' + (t === 0 ? "rgba(27,42,74,0.35)" : "rgba(27,42,74,0.12)") + '"></line>';
    grid += '<text class="axis" font-size="12" x="' + (pad.l - 8) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end">' + esc(axisM(val)) + '</text>';
  }
  for (var i = 0; i < 10; i++) {
    grid += '<text class="axis" font-size="12" x="' + x(i).toFixed(1) + '" y="' + (h - 10) + '" text-anchor="middle">Y' + (i + 1) + '</text>';
  }
  var paths = "";
  for (var s = series.length - 1; s >= 0; s--) {
    var d = series[s].values.map(function (v, idx) {
      return (idx ? "L" : "M") + x(idx).toFixed(1) + "," + y(v).toFixed(1);
    }).join("");
    paths += '<path d="' + d + '" fill="none" stroke="' + series[s].color + '" stroke-width="' + series[s].width + '" stroke-linejoin="round" stroke-linecap="round"' + (series[s].dash ? ' stroke-dasharray="' + series[s].dash + '"' : '') + '></path>';
  }
  var dots = series[0].values.map(function (v, idx) {
    return '<circle cx="' + x(idx).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3.4" fill="#1B2A4A"><title>Year ' + (idx + 1) + ' total value ' + esc(Rm(m.rows[idx].total)) + '</title></circle>';
  }).join("");
  var legend = series.map(function (sr) {
    var sw = sr.dash ? '<span class="swatch dashed"></span>' : '<span class="swatch" style="background:' + sr.color + '"></span>';
    return '<li>' + sw + esc(sr.name) + '</li>';
  }).join("");
  return '<div class="chart"><svg class="plot" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Line chart of value built against after-tax cost over ten years, in rand millions. The table below has every figure.">' + grid + paths + dots + '</svg><ul class="legend">' + legend + '</ul></div>';
}

function colChart(m) {
  var box = chartBox();
  var w = box.w, h = box.h;
  var vals = m.rows.map(function (r) { return r.ncbZ / 1e6; });
  var maxV = 0;
  vals.forEach(function (v) { if (v > maxV) maxV = v; });
  var ceiling = chartMax(maxV);
  var pad = { l: 64, r: 8, t: 28, b: 32 };
  var iw = w - pad.l - pad.r;
  var ih = h - pad.t - pad.b;
  var slot = iw / 10;
  var bw = Math.min(26, slot * 0.52);
  function y(v) {
    var c = Math.max(0, Math.min(ceiling, finite(v)));
    return pad.t + ih - (c / ceiling) * ih;
  }
  var parts = "";
  for (var t = 0; t <= 4; t++) {
    var val = ceiling * t / 4;
    var yy = y(val);
    parts += '<line x1="' + pad.l + '" y1="' + yy.toFixed(1) + '" x2="' + (w - pad.r) + '" y2="' + yy.toFixed(1) + '" stroke="' + (t === 0 ? "rgba(27,42,74,0.35)" : "rgba(27,42,74,0.12)") + '"></line>';
    parts += '<text class="axis" font-size="12" x="' + (pad.l - 8) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end">' + esc(axisM(val)) + '</text>';
  }
  var spoken = [];
  m.rows.forEach(function (r, i) {
    var cx = pad.l + slot * (i + 0.5);
    var v = vals[i];
    parts += '<text class="axis" font-size="12" x="' + cx.toFixed(1) + '" y="' + (h - 10) + '" text-anchor="middle">Y' + r.y + '</text>';
    if (v > 0) {
      var top = y(v);
      var base = y(0);
      parts += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, base - top).toFixed(1) + '" rx="2" fill="#1B2A4A"><title>Year ' + r.y + ' ' + esc(Rm(r.ncbZ)) + '</title></rect>';
      parts += '<text class="axis" font-size="11" font-weight="600" fill="#1B2A4A" x="' + cx.toFixed(1) + '" y="' + (top - 6).toFixed(1) + '" text-anchor="middle">' + esc(Rm(r.ncbZ)) + '</text>';
      spoken.push("Year " + r.y + " " + Rm(r.ncbZ));
    }
  });
  var label = spoken.length ? "No-claim bonus payouts: " + spoken.join(", ") + "." : "No no-claim bonus payouts in this scenario.";
  return '<div class="chart"><svg class="plot" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(label) + '">' + parts + '</svg></div>';
}

function sumKey(rows, key) {
  return rows.reduce(function (a, r) { return a + r[key]; }, 0);
}

function pct2(v) {
  if (!Number.isFinite(v)) return "–";
  return (v * 100).toFixed(2) + "%";
}

function nearestValue(current, values) {
  var best = values[0];
  var bestD = Math.abs(current - best);
  var i;
  for (i = 1; i < values.length; i++) {
    var d = Math.abs(current - values[i]);
    if (d < bestD - 1e-9) {
      best = values[i];
      bestD = d;
    }
  }
  return best;
}

function yearPhrase(years) {
  if (years.length === 1) return "year " + years[0];
  var parts = [];
  var start = years[0];
  var prev = years[0];
  var i;
  for (i = 1; i <= years.length; i++) {
    var y = years[i];
    if (y === prev + 1) { prev = y; continue; }
    parts.push(start === prev ? String(start) : start + "–" + prev);
    start = y;
    prev = y;
  }
  if (parts.length === 1) return "years " + parts[0];
  var last = parts.pop();
  return "years " + parts.join(", ") + " and " + last;
}

function feePack(m) {
  var c = COSTS[state.structure];
  var share = 1 / m.n;
  var setupUsd = c.setup + c.sharedSetup * share;
  var annualUsd = c.annual + c.sharedAnnual * share;
  var years = m.rows.map(function (r) {
    var fronting = Math.round(r.fronting);
    var ffg = Math.round(r.ffg * r.fx);
    var gr = Math.round(r.gr * r.fx);
    var mtax = Math.round(r.mtax * r.fx);
    var annual = Math.round(annualUsd * r.fx);
    var ongoing = fronting + ffg + gr + mtax + annual;
    var setup = r.y === 1 ? Math.round(setupUsd * r.fx) : 0;
    var referral = r.y === 1 ? CFO_REFERRAL_ZAR : 0;
    return {
      y: r.y,
      fronting: fronting,
      ffg: ffg,
      gr: gr,
      mtax: mtax,
      annual: annual,
      ongoing: ongoing,
      setup: setup,
      referral: referral,
      once: setup + referral,
      total: ongoing + setup + referral,
      minApplies: r.pu * m.n * GR_PCT < GR_MIN - 1e-6,
      ibnr: Math.round(r.ibnr * r.fx),
      gross: Math.round(r.gross)
    };
  });
  function col(key) {
    return years.reduce(function (a, y) { return a + y[key]; }, 0);
  }
  var y1 = years[0];
  var y10 = years[9];
  return {
    years: years,
    setupUsd: setupUsd,
    annualUsd: annualUsd,
    y1: y1,
    gross1: y1.gross,
    setup: col("setup"),
    referral: col("referral"),
    once: col("once"),
    fronting: col("fronting"),
    ffg: col("ffg"),
    gr: col("gr"),
    mtax: col("mtax"),
    annual: col("annual"),
    ongoing: col("ongoing"),
    total: col("total"),
    ibnr: col("ibnr"),
    pctY1: y1.gross > 0 ? y1.ongoing / y1.gross : 0,
    pctY10: y10.gross > 0 ? y10.ongoing / y10.gross : 0,
    minYears: years.filter(function (y) { return y.minApplies; }).map(function (y) { return y.y; }),
    capZ: Math.round(m.y1.capZ)
  };
}

function feeLine(label, y1, total, gross, flags) {
  return {
    sub: !!(flags && flags.sub),
    total: !!(flags && flags.total),
    memo: !!(flags && flags.memo),
    cells: [
      cell(label),
      cell(R(y1)),
      cell(gross > 0 ? pct2(y1 / gross) : "–"),
      cell(R(total))
    ]
  };
}

function guardriskLabel(minYears) {
  var base = "Guardrisk cell fee (3%, minimum " + U(GR_MIN) + " per cell a year";
  if (!minYears.length) return base + ")";
  if (minYears.length === 10) return base + "; minimum applies every year)";
  return base + "; minimum applies in " + yearPhrase(minYears) + ")";
}

function ongoingNote(pack) {
  var x = pct(pack.pctY1);
  var y = pct(pack.pctY10);
  var lower = pack.pctY10 < pack.pctY1 - 0.00005;
  if (lower && pack.minYears.length) {
    return "Ongoing fees total " + x + " of premium in year 1, falling to " + y + " by year 10 as the Guardrisk minimum is spread over a larger premium.";
  }
  if (lower) return "Ongoing fees total " + x + " of premium in year 1, falling to " + y + " by year 10.";
  if (pack.pctY10 > pack.pctY1 + 0.00005) return "Ongoing fees total " + x + " of premium in year 1 and " + y + " in year 10.";
  return "Ongoing fees total " + x + " of premium in year 1 and in year 10.";
}

function feeSection(m) {
  var f = feePack(m);
  var g = f.gross1;
  var headers = ["Item", "Year 1", "% of year-1 premium", "10-year total"];
  var onceRows = [
    feeLine("Trust and GBC setup (" + U(f.setupUsd) + ")", f.y1.setup, f.setup, g),
    feeLine("CFO Centre referral commission", f.referral, f.referral, g),
    feeLine("Once-off total", f.once, f.once, g, { sub: true })
  ];
  var ongoingRows = [
    feeLine("Fronting fee (2.5% of the gross premium)", f.y1.fronting, f.fronting, g),
    feeLine("FFG management fee (9.2% of the premium reinsured)", f.y1.ffg, f.ffg, g),
    feeLine(guardriskLabel(f.minYears), f.y1.gr, f.gr, g),
    feeLine("Mauritius tax (3% of cell profit)", f.y1.mtax, f.mtax, g),
    feeLine("Trust and GBC annual running costs (" + U(f.annualUsd) + " a year)", f.y1.annual, f.annual, g),
    feeLine("Ongoing total", f.y1.ongoing, f.ongoing, g, { sub: true }),
    feeLine("Total cost, including once-off", f.y1.total, f.total, g, { total: true }),
    feeLine("IBNR claims reserve (7% of the premium reinsured, not a fee)", f.y1.ibnr, f.ibnr, g, { memo: true })
  ];
  var perRows = f.years.map(function (y) {
    return {
      year: y.y,
      cells: [
        cell("Year " + y.y),
        cell(R(y.fronting)),
        cell(R(y.ffg)),
        cell(R(y.gr) + (y.minApplies ? " †" : "")),
        cell(R(y.mtax)),
        cell(R(y.annual)),
        cell(R(y.ongoing)),
        cell(y.once ? R(y.once) : "–"),
        cell(R(y.total))
      ]
    };
  });
  perRows.push({
    total: true,
    cells: [
      cell("10-year total"),
      cell(R(f.fronting)),
      cell(R(f.ffg)),
      cell(R(f.gr)),
      cell(R(f.mtax)),
      cell(R(f.annual)),
      cell(R(f.ongoing)),
      cell(R(f.once)),
      cell(R(f.total))
    ]
  });
  var foot = "Once-off costs are paid in year 1 and then drop off. ";
  if (f.minYears.length) foot += "† The Guardrisk minimum of " + U(GR_MIN) + " per cell applies in " + (f.minYears.length === 10 ? "every year" : yearPhrase(f.minYears)) + ".";
  else foot += "The Guardrisk fee is 3% of the premium reinsured in every year. The " + U(GR_MIN) + " minimum is not reached.";
  return '<section class="block" id="fee-summary" aria-labelledby="s-fees"><div class="block-head"><div><h2 id="s-fees">4. Fee summary schedule</h2><p class="caption" id="fee-rate-note">Fee rates are fixed for the life of the product.</p>' +
    (state.structure === "many" ? '<p class="caption">Figures are your share of a ' + m.n + '-policy cell. The Guardrisk minimum is charged per cell, then split.</p>' : '') +
    '</div></div>' +
    '<h3>Once-off costs (year 1 only)</h3>' +
    '<p class="caption">Percentages are of the year-1 gross premium of ' + esc(R(g)) + '.</p>' +
    sheet("Once-off costs in year 1", headers, onceRows, false) +
    callout("info", "Client capital into the cell: " + R(f.capZ) + ".", "Returned at exit, not a cost. It is the cash you place in the cell, and it is left out of the cost totals.") +
    '<h3 class="subhead">Ongoing costs (every year)</h3>' +
    sheet("Ongoing costs, year 1 and the 10-year total", headers, ongoingRows, false) +
    '<p class="closing" id="fee-pct-note">' + esc(ongoingNote(f)) + '</p>' +
    '<p class="closing">The IBNR line is the claims reserve held in the cell and released into later bonuses. It is not a fee, and it is left out of the totals.</p>' +
    '<h3 class="subhead">Cost by year</h3>' +
    sheet("Cost by year in rand", ["Year", "Fronting", "FFG fee", "Guardrisk", "Mauritius tax", "Running costs", "Ongoing", "Once-off", "Total"], perRows, "compact") +
    '<p class="closing">' + esc(foot) + '</p></section>';
}

function modelWith(m, over) {
  return runModel({
    n: m.n,
    P: m.P,
    esc: m.esc,
    cap: m.st.capitalPct,
    fx0: m.fx0,
    dep: over.dep !== undefined ? over.dep : m.dep,
    lr: over.lr !== undefined ? over.lr : m.lr,
    inv: over.inv !== undefined ? over.inv : m.inv,
    s: state.structure
  });
}

function markLabel(label, hi, exact, base) {
  var tags = [];
  if (base) tags.push("base");
  if (hi) tags.push(exact ? "yours" : "closest");
  return tags.length ? label + " (" + tags.join(", ") + ")" : label;
}

function claimsPaidZ(rows) {
  return rows.reduce(function (sum, r) { return sum + r.claims * r.fx; }, 0);
}

function exitCells(label, rows, hi) {
  var y10 = rows[9];
  var claimsZ = claimsPaidZ(rows);
  var net = y10.total + claimsZ - y10.cumOutlay;
  return {
    hi: hi,
    cells: [
      cell(label),
      cell(R(rows[2].ncbZ), rows[2].ncbZ > 0),
      cell(R(rows[5].ncbZ), rows[5].ncbZ > 0),
      cell(R(rows[8].ncbZ), rows[8].ncbZ > 0),
      cell(R(y10.cumNcbZ), y10.cumNcbZ > 0),
      cell(R(y10.cashZ)),
      cell(R(y10.total)),
      cell(R(y10.cumOutlay)),
      cell(R(claimsZ), claimsZ > 0),
      cell(R(net), net > 0)
    ]
  };
}

function fxExitSteps() {
  var byValue = {};
  var i;
  for (i = 0; i < FX_PRESETS.length; i++) byValue[FX_PRESETS[i].value] = FX_PRESETS[i];
  return ["strong", "flat", "base", "weak"].map(function (key) {
    var p = byValue[key];
    return { dep: num(p.dep, 0), label: p.label };
  });
}

var EXIT_HEADERS = ["Assumption", "Year 3 bonus", "Year 6 bonus", "Year 9 bonus", "Bonuses, 10 years", "Cell value, year 10", "Total value built", "Cumulative cost", "Claims paid to you", "Net value, incl. claims"];

function claimsTable(m) {
  var steps = [0, 10, 20, 30, 40, 50];
  var nearest = nearestValue(m.claimsPct, steps);
  var rows = steps.map(function (step) {
    var hi = step === nearest;
    var label = markLabel(step + "%", hi, Math.abs(m.claimsPct - step) < 1e-9, false);
    return exitCells(label, modelWith(m, { lr: step / 100 }), hi);
  });
  return sheet("No-claim bonus and exit value at different claims ratios", EXIT_HEADERS, rows, "exit");
}

function fxTable(m) {
  var steps = fxExitSteps();
  var nearest = nearestValue(m.depPct, steps.map(function (s) { return s.dep; }));
  var rows = steps.map(function (step) {
    var hi = step.dep === nearest;
    var label = markLabel(step.label, hi, Math.abs(m.depPct - step.dep) < 1e-9, false);
    return exitCells(label, modelWith(m, { dep: step.dep / 100 }), hi);
  });
  return sheet("No-claim bonus and exit value at different rand paths", EXIT_HEADERS, rows, "exit");
}

function invTable(m) {
  var steps = [0, 2, 4, 6, 8];
  var nearest = nearestValue(m.invPct, steps);
  var rows = steps.map(function (step) {
    var hi = step === nearest;
    var label = markLabel(step + "%", hi, Math.abs(m.invPct - step) < 1e-9, step === 4);
    return exitCells(label, modelWith(m, { inv: step / 100 }), hi);
  });
  return sheet("No-claim bonus and exit value at different investment returns", EXIT_HEADERS, rows, "exit");
}

function clientRisks(m) {
  var rise = m.escPct < 0
    ? "The plan assumes premiums change by " + pct(m.escPct / 100) + " a year. Lower or skipped premiums build less value."
    : "The plan assumes premiums rise " + pct(m.escPct / 100) + " a year. Lower or skipped premiums build less value.";
  var items = [
    ["Exchange rate", "The cell is held in US dollars, so if the rand strengthens, the rand value of the bonuses and the exit value goes down."],
    ["Investment return", "Returns depend on where the cell's cash is invested and are not guaranteed. " + INV_NOTE],
    ["Claims experience", "Actual claims reduce the bonuses roughly rand for rand."],
    ["Large or late claims", "A single large claim, or claims reported after the 7% reserve has been set, can absorb a whole bonus cycle."],
    ["Premium escalation", rise],
    ["Guardrisk minimum fee", "At smaller premiums the " + U(GR_MIN) + "-a-year minimum is a larger share of the premium."],
    ["Shared-cell participation", "Applies to the one-to-many cell. Each policy is ring-fenced, and the risk of under-subscription is mitigated because a shared cell only goes live once all 10 slots are filled, so shared costs are always split ten ways."],
    ["Lock-in and timing of exit", "There is a minimum 3-year commitment. Leaving between bonus cycles gives up the surplus that has built up but not yet been paid out."],
    ["Tax deduction capacity", "The premium reduces tax only to the extent the company has taxable income in that year."],
    ["Getting value out", "Bonuses are paid in US dollars to the GBC owned by your offshore trust. This risk is mitigated because the funds flow into a trust of which you are the ultimate beneficial owner (UBO), so the value stays for your benefit offshore."],
    ["Counterparty and regulatory change", "The structure relies on Guardrisk, the fronting insurer, and the South African and Mauritian regulators. Changes in their rules or standing could affect it."]
  ];
  var list = '<ul class="risk-points">' + items.map(function (it, i) {
    return '<li><p class="risk-name"><span class="risk-n">' + (i + 1) + '.</span> ' + esc(it[0]) + '</p><p>' + esc(it[1]) + '</p></li>';
  }).join("") + '</ul>';
  return '<div class="risk-panel"><h3 id="s-client-risks">Client risks and key assumptions</h3>' +
    callout("good", "The product itself is low risk.", "It has been structured and signed off jointly by FFG and CFO Centre under their joint venture, and runs through Guardrisk, an established cell captive provider. The points below are the assumptions and outcomes that can move your results, so you can plan with confidence. The fee structure is fixed for the life of the product, so fees do not change over the term.") +
    list + '</div>';
}

function clampRate(s, d) {
  var v = num(s, d) / 100;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function dividendCompare(m) {
  var divTax = clampRate(state.divTaxS, 20);
  var marginal = clampRate(state.marginalS, 45);
  var cgtRate = CGT_INCLUSION * marginal;
  var offshoreRate = (1 - SA_CIT) * (1 - divTax);
  var divOnGross = (1 - SA_CIT) * divTax;
  var gross1 = m.y1.gross;
  var usd = 0;
  var divInvested = 0;
  var preTax = 0;
  var companyTax = 0;
  var dividendsTax = 0;
  var fees = 0;
  var structCost = 0;
  var grosses = [];
  var i;
  for (i = 0; i < m.rows.length; i++) {
    var r = m.rows[i];
    usd = usd * (1 + m.inv);
    var put = r.gross * offshoreRate;
    divInvested += put;
    preTax += r.gross;
    companyTax += r.gross * SA_CIT;
    dividendsTax += r.gross * divOnGross;
    fees += r.fronting + (r.ffg + r.gr + r.mtax) * r.fx;
    structCost += r.structZ;
    grosses.push(r.gross);
    usd += put / r.fx;
  }
  var before = usd * m.y10.fx;
  var gain = before - divInvested;
  var cgt = Math.max(0, gain) * cgtRate;
  var after = before - cgt;
  var orsGross = m.y10.total + claimsPaidZ(m.rows);
  var capitalY10 = m.capitalUsd * m.y10.fx;
  var referral = CFO_REFERRAL_ZAR;
  var outside = capitalY10 + structCost + referral;
  var bonusRate = m.inv * (1 - MU_TAX);
  var fx10 = m.y10.fx;
  var grownRand = 0;
  var paidRand = 0;
  var fxOnlyRand = 0;
  for (i = 0; i < m.rows.length; i++) {
    var bonus = m.rows[i];
    if (!(bonus.ncb > 0)) continue;
    var held = Math.pow(1 + bonusRate, 10 - bonus.y);
    grownRand += bonus.ncb * held * fx10;
    paidRand += bonus.ncb * bonus.fx;
    fxOnlyRand += bonus.ncb * fx10;
  }
  var bonusUplift = grownRand - paidRand;
  var bonusFx = fxOnlyRand - paidRand;
  var bonusGrowth = grownRand - fxOnlyRand;
  var orsAfterTaxes = orsGross + bonusUplift;
  var orsFromPremium = orsAfterTaxes - outside;
  var afterTax = preTax * (1 - SA_CIT);
  var hardCost = divInvested;
  var divCfs = grosses.map(function (g, idx) {
    var out = g * offshoreRate;
    return idx === grosses.length - 1 ? -out + after : -out;
  });
  var orsCfs = grosses.map(function (g, idx) {
    var out = g * offshoreRate;
    return idx === grosses.length - 1 ? -out + orsFromPremium : -out;
  });
  var divIrr = solveIrr(divCfs);
  var orsIrr = solveIrr(orsCfs);
  return {
    divTax: divTax,
    marginal: marginal,
    cgtRate: cgtRate,
    offshoreRate: offshoreRate,
    divOnGross: divOnGross,
    combined: 1 - offshoreRate,
    orsTax: gross1 * SA_CIT,
    divTaxAmount: gross1 * divOnGross,
    year1Saving: gross1 * (1 - offshoreRate),
    orsOffshore1: gross1,
    divOffshore1: gross1 * offshoreRate,
    divInvested: divInvested,
    hardCost: hardCost,
    preTax: preTax,
    afterTax: afterTax,
    companyTax: companyTax,
    dividendsTax: dividendsTax,
    fees: fees,
    growth: before - divInvested,
    before: before,
    cgt: cgt,
    after: after,
    orsGross: orsGross,
    bonusUplift: bonusUplift,
    bonusFx: bonusFx,
    bonusGrowth: bonusGrowth,
    orsAfterTaxes: orsAfterTaxes,
    capitalY10: capitalY10,
    structCost: structCost,
    referral: referral,
    outside: outside,
    orsFromPremium: orsFromPremium,
    advantage: orsFromPremium - after,
    divIrr: divIrr,
    orsIrr: orsIrr,
    irrAdvantage: divIrr === null || orsIrr === null ? null : orsIrr - divIrr
  };
}

function moneyM(v) {
  return (v < 0 ? "-" : "") + Rm(Math.abs(v));
}

function npv(rate, cfs) {
  var sum = 0;
  var i;
  for (i = 0; i < cfs.length; i++) sum += cfs[i] / Math.pow(1 + rate, i + 1);
  return sum;
}

function solveIrr(cfs) {
  var lo = -0.999;
  var hi = 5;
  var fLo = npv(lo, cfs);
  var fHi = npv(hi, cfs);
  var guard = 0;
  while (fLo * fHi > 0 && hi < 1e6 && guard < 40) {
    hi = hi * 2 + 1;
    fHi = npv(hi, cfs);
    guard++;
  }
  if (!(fLo * fHi < 0) && fLo !== 0 && fHi !== 0) return null;
  var i;
  for (i = 0; i < 80; i++) {
    var mid = (lo + hi) / 2;
    var fMid = npv(mid, cfs);
    if (Math.abs(hi - lo) < 1e-9) return mid;
    if (fLo * fMid <= 0) { hi = mid; fHi = fMid; }
    else { lo = mid; fLo = fMid; }
  }
  return (lo + hi) / 2;
}

function irrText(v) {
  if (v === null || !isFinite(v)) return "–";
  return (v * 100).toFixed(1) + "%";
}

function ptsText(v) {
  if (v === null || !isFinite(v)) return "–";
  var n = (v * 100).toFixed(1);
  return (v > 0 ? "+" : "") + n + " pts";
}

function pointsWords(v) {
  if (v === null || !isFinite(v)) return "–";
  var n = (v * 100).toFixed(1);
  return (v > 0 ? "+" : "") + n + " points";
}

function routeCells(label, values, flags) {
  var cells = [cell(label)].concat(values.map(function (v) {
    if (v === null) return cell("–");
    if (typeof v === "string") return cell(v);
    return cell(R(v), !!(flags && flags.pos && v > 0));
  }));
  return { total: !!(flags && flags.total), cells: cells };
}

function multipleText(net, cost) {
  if (!(cost > 0) || !isFinite(net)) return "–";
  return (net / cost).toFixed(2) + "x";
}

function multipleGap(a, b) {
  if (!isFinite(a) || !isFinite(b)) return "–";
  var d = a - b;
  return (d > 0 ? "+" : "") + d.toFixed(2) + "x";
}

function scenarioModel(m, dep, inv) {
  var rows = modelWith(m, { dep: dep, inv: inv });
  var y1 = rows[0];
  return {
    inv: inv,
    dep: dep,
    lr: m.lr,
    esc: m.esc,
    fx0: m.fx0,
    n: m.n,
    P: m.P,
    st: m.st,
    rows: rows,
    y1: y1,
    y10: rows[rows.length - 1],
    capitalUsd: m.st.capitalPct * y1.pu
  };
}

function benefitStrip(c, up) {
  var irrDetail = pointsWords(c.irrAdvantage) + " on the same net investment cost of " + Rm(c.hardCost) + ".";
  irrDetail += " Upside scenario: " + irrText(up.orsIrr) + " vs " + irrText(up.divIrr) + ".";
  var bonusDetail = "Bonuses kept invested offshore to year 10: " + moneyM(c.bonusFx) + " exchange-rate gain + " + moneyM(c.bonusGrowth) + " growth.";
  var advWord = c.advantage >= 0 ? "More than the dividend route." : "Less than the dividend route.";
  var upWord = up.advantage >= 0 ? " more." : " less.";
  var advDetail = advWord + " Upside scenario: " + Rm(Math.abs(up.advantage)) + upWord;
  return '<section class="benefit" aria-labelledby="benefit-h">' +
    '<h2 id="benefit-h">The benefit of the structure</h2>' +
    '<ul class="metrics metrics-benefit">' +
    '<li><p class="metric-value" data-metric="irr">' + esc(irrText(c.orsIrr) + " vs " + irrText(c.divIrr)) + '</p><p class="metric-label">IRR: cell captive vs dividend route</p><p class="metric-detail">' + esc(irrDetail) + '</p></li>' +
    '<li><p class="metric-value' + (c.bonusUplift > 0 ? " pos" : "") + '" data-metric="bonus">' + esc(moneyM(c.bonusUplift)) + '</p><p class="metric-label">Bonus growth offshore</p><p class="metric-detail">' + esc(bonusDetail) + '</p></li>' +
    '<li><p class="metric-value' + (c.advantage > 0 ? " pos" : "") + '" data-metric="advantage">' + esc(Rm(Math.abs(c.advantage))) + '</p><p class="metric-label">Net offshore value advantage</p><p class="metric-detail">' + esc(advDetail) + '</p></li>' +
    '</ul></section>';
}

function structureSplit(c) {
  var afterAll = Math.round(c.orsAfterTaxes);
  var net = Math.round(c.orsFromPremium);
  var total = afterAll - net;
  var cap = Math.round(c.capitalY10);
  var trust = Math.round(c.structCost);
  var ref = Math.round(c.referral);
  trust += total - (cap + trust + ref);
  return { cap: cap, trust: trust, ref: ref, total: total, afterAll: afterAll, net: net };
}

function taxComparison(m) {
  var c = dividendCompare(m);
  var s = structureSplit(c);
  var divAfter = Math.round(c.after);
  var divMultiple = c.hardCost > 0 ? c.after / c.hardCost : null;
  var orsMultiple = c.hardCost > 0 ? c.orsFromPremium / c.hardCost : null;
  var breakdown = "Capital at the year-10 rate " + R(s.cap) + ", trust and GBC setup and running costs " + R(s.trust) + ", CFO Centre referral " + R(s.ref) + ".";
  var headers = ["Route", "Pre-tax amount", "After corporate tax", "After CT and dividends tax", "Net investment cost", "Bonus growth offshore", "After CT, DT and CGT", "Less: structure costs", "Net offshore value", "Value / cost", "IRR"];
  var divRow = routeCells("Route 2: Offshore diversification (dividend route)", [c.preTax, c.afterTax, c.divInvested, c.hardCost, 0, divAfter, 0, divAfter]);
  divRow.cells.push(cell(multipleText(c.after, c.hardCost)));
  divRow.cells.push(cell(irrText(c.divIrr)));
  var orsRow = routeCells("Route 1: Offshore cell captive", [c.preTax, c.afterTax, c.preTax, c.hardCost, c.bonusUplift, s.afterAll]);
  orsRow.cells.push(cell(R(-s.total), false, breakdown));
  orsRow.cells.push(cell(R(s.net), s.net > 0));
  orsRow.cells.push(cell(multipleText(c.orsFromPremium, c.hardCost), c.orsFromPremium > c.hardCost));
  orsRow.cells.push(cell(irrText(c.orsIrr)));
  var advRow = routeCells("Advantage", [0, 0, c.preTax - c.divInvested, 0, c.bonusUplift, s.afterAll - divAfter, -s.total, s.net - divAfter], { total: true, pos: true });
  advRow.cells.push(cell(multipleGap(orsMultiple, divMultiple), orsMultiple > divMultiple));
  advRow.cells.push(cell(ptsText(c.irrAdvantage), c.irrAdvantage > 0));
  var up = dividendCompare(scenarioModel(m, 0.06, 0.06));
  var ahead = moneyM(c.advantage) + (c.advantage >= 0 ? " more than the dividend route" : " versus the dividend route");
  if (c.irrAdvantage !== null) ahead += ", " + ptsText(c.irrAdvantage) + " a year on the IRR";
  var baseAdv = Math.round(c.orsFromPremium) - Math.round(c.after);
  var upAdv = Math.round(up.orsFromPremium) - Math.round(up.after);
  var scenarioRows = [
    { cells: [cell("Route 1 net offshore value"), cell(R(c.orsFromPremium)), cell(R(up.orsFromPremium))] },
    { cells: [cell("Route 2 net offshore value"), cell(R(c.after)), cell(R(up.after))] },
    { cells: [cell("Advantage (R)"), cell(R(baseAdv), baseAdv > 0), cell(R(upAdv), upAdv > 0)] },
    { cells: [cell("Route 1 IRR"), cell(irrText(c.orsIrr)), cell(irrText(up.orsIrr))] },
    { cells: [cell("Route 2 IRR"), cell(irrText(c.divIrr)), cell(irrText(up.divIrr))] },
    { cells: [cell("IRR advantage (points)"), cell(ptsText(c.irrAdvantage), c.irrAdvantage > 0), cell(ptsText(up.irrAdvantage), up.irrAdvantage > 0)] },
    { cells: [cell("Bonus growth offshore"), cell(R(c.bonusUplift), c.bonusUplift > 0), cell(R(up.bonusUplift), up.bonusUplift > 0)] }
  ];
  return {
    c: c,
    up: up,
    ahead: ahead,
    html: '<div class="tax-compare" id="tax-compare"><h3 class="subhead">Ten-year totals</h3>' +
      '<p class="caption" id="tax-compare-note">The goal is risk management and risk diversification. Route 1 is the offshore cell captive. Route 2 is offshore diversification through a dividend, and that investment is subject to capital gains tax. Net investment cost is the net Route 2 investment, the amount after corporate tax and dividends tax that is actually invested offshore. It is the hard cost used for both routes. For a fair comparison, your own capital and the trust/GBC costs paid outside the cell are deducted from the cell\'s value. Both IRRs use the same timing: that net Route 2 investment goes out at the end of each year, and the net offshore value comes in at the end of year 10.</p>' +
      '<div class="cols-3">' +
      field("div-tax", "Dividends tax (%)", state.divTaxS) +
      field("marginal", "Your marginal income tax rate (%)", state.marginalS) +
      '<div class="field"><span>Capital gains tax</span><p class="cgt-note">Inclusion rate ' + esc(pct(CGT_INCLUSION)) + ', fixed. Effective rate ' + esc(pct(c.cgtRate)) + ' (' + esc(pct(CGT_INCLUSION)) + ' × your ' + esc(pct(c.marginal)) + ' marginal rate).</p></div>' +
      '</div>' +
      '<div id="irr-table">' +
      sheet("Ten-year comparison of the offshore cell captive and the dividend route", headers, [orsRow, divRow, advRow], "irr") +
      '</div>' +
      '<div class="scenario-table" id="scenario-table">' +
      '<h3 class="subhead">Scenario: sharper rand depreciation and higher US dollar return</h3>' +
      sheet("Base inputs against rand weakening 6% a year and a 6% US dollar return", ["Result", "Base (your inputs)", "Upside (rand weakens 6% pa, USD return 6%)"], scenarioRows, false) +
      '</div>' +
      '<p class="closing" id="structure-costs-note">Cash columns are the 10-year totals. Value columns are the position at the end of year 10. The upside applies the same 6% rand weakening and 6% US dollar return to both routes. Route 1\'s bonuses are assumed to stay invested offshore in the trust and GBC on the same return and rand path as Route 2, from the year they are paid until year 10. The return is the cell\'s investment return after Mauritius tax on that income. Of the bonus growth on your inputs, ' + esc(R(c.bonusFx)) + ' is the exchange-rate gain and ' + esc(R(c.bonusGrowth)) + ' is investment growth. Route 2\'s growth is already in its year-10 value, so its bonus-growth column is zero. For Route 2, the value after CT, DT and CGT is the year-10 offshore value, and it is the same as the net offshore value. For Route 1, that column is the cell value plus bonuses grown to year 10 plus claims paid, after Mauritius tax, and no separate capital gains tax is deducted. Less: structure costs is ' + esc(breakdown) + ' Route 2 has none. After CT, DT and CGT less structure costs equals the net offshore value.</p></div>'
  };
}

function exitSection(m) {
  return '<section class="block" id="exit-value" aria-labelledby="s-exit"><div class="block-head"><div><h2 id="s-exit">5. Exit value: what could change it</h2><p class="caption">The cell is held in US dollars, so a stronger rand lowers the rand value at exit. Returns depend on where the cell\'s cash is invested. Claims reduce the bonus roughly rand for rand. Claims are paid out of your cell to your company, so higher claims lower the bonus but are returned to you as cover. None of these figures are guaranteed. Your capital and the claims reserve stay in the cell. Net value is the total value built plus claims paid to your company, minus the cumulative after-tax cost. In each table, only that one assumption changes, and the highlighted row is your current input or the nearest step shown.</p></div></div>' +
    '<h3>Claims ratio</h3>' + claimsTable(m) +
    '<h3 class="subhead">Exchange rate</h3>' + fxTable(m) +
    '<h3 class="subhead">Investment return</h3>' + invTable(m) +
    '<p class="closing">' + esc(INV_NOTE) + '</p>' +
    clientRisks(m) + '</section>';
}

function view(m) {
  var cmp = taxComparison(m);
  var shareNote = state.structure === "many" ? " Your share of a " + m.n + "-policy cell (1/" + m.n + ")." : "";
  var fxOptions = FX_PRESETS.map(function (p) {
    return '<option value="' + p.value + '"' + (p.value === m.fxPreset ? " selected" : "") + '>' + esc(p.label) + '</option>';
  }).join("");
  if (m.fxPreset === "custom") fxOptions += '<option value="custom" selected>Custom: ' + esc(state.depS) + '% pa</option>';

  var pol = "";
  for (var k = 2; k <= 10; k++) pol += '<option value="' + k + '"' + (state.policiesS === String(k) ? " selected" : "") + '>' + k + '</option>';

  var monthOpts = "";
  for (var mo = 12; mo >= 1; mo--) {
    var ml = mo === 12 ? "12 (full annual premium)" : String(mo);
    monthOpts += '<option value="' + mo + '"' + (state.monthsS === String(mo) ? " selected" : "") + '>' + ml + '</option>';
  }

  var riskOpts = m.available.map(function (r) {
    return '<option value="' + esc(r.id) + '">' + esc(r.name + " (" + r.group + ")") + '</option>';
  }).join("");
  var riskPlaceholder = m.available.length ? "Choose a risk to add…" : "All risks selected";

  var riskList = m.pickedRisks.length === 0
    ? callout("info", "No risks selected yet.", "Add at least one risk so we can prepare your cover schedule.")
    : '<ul class="risk-list">' + m.pickedRisks.map(function (r) {
      return '<li><div><p class="risk-name">' + esc(r.name) + '</p><p class="risk-group">' + esc(r.group) + '</p><p class="risk-detail">' + esc(r.detail) + '</p></div><button type="button" class="btn btn-small" data-remove="' + esc(r.id) + '" aria-label="Remove ' + esc(r.name) + '">Remove</button></li>';
    }).join("") + '</ul>';

  var benefit = benefitStrip(cmp.c, cmp.up);
  var metrics = benefit + '<ul class="metrics">' +
    '<li><p class="metric-value" data-metric="value">' + esc(Rm(m.y10.total)) + '</p><p class="metric-label">Value built after 10 years</p><p class="metric-detail">Cell value ' + esc(Rm(m.y10.cashZ)) + ' + no-claim bonuses ' + esc(Rm(m.totNcbZ)) + '</p></li>' +
    '<li><p class="metric-value pos" data-metric="ncb">' + esc(Rm(m.totNcbZ)) + '</p><p class="metric-label">No-claim bonuses paid, 10 years</p><p class="metric-detail" data-metric="ncb-detail">' + esc(U(m.totNcbU) + " in years 3, 6 and 9") + '</p></li>' +
    '<li><p class="metric-value pos" data-metric="tax">' + esc(R(cmp.c.year1Saving)) + '</p><p class="metric-label">Tax saving versus a dividend, year 1</p><p class="metric-detail">Company tax ' + esc(R(cmp.c.orsTax)) + ' and dividends tax ' + esc(R(cmp.c.divTaxAmount)) + ' avoided. After 10 years, ' + esc(cmp.ahead) + '.</p></li>' +
    '<li><p class="metric-value" data-metric="capital">' + esc(R(m.capitalZar)) + '</p><p class="metric-label">Your capital into the cell</p><p class="metric-detail">' + esc(pct(m.st.capitalPct) + " of year-1 premium (" + U(m.capitalUsd) + "), funded via your trust") + '</p></li>' +
    '</ul>';

  var structure = '<section class="block" aria-labelledby="s-structure"><div class="block-head"><div><h2 id="s-structure">1. Structure</h2></div><button type="button" class="btn" id="reset">Reset to base case</button></div>' +
    '<div class="segment" role="radiogroup" aria-label="Structure">' +
    '<label><input type="radio" name="structure" id="structure-one" value="one"' + (state.structure === "one" ? " checked" : "") + '><span>One-to-one (own cell)</span></label>' +
    '<label><input type="radio" name="structure" id="structure-many" value="many"' + (state.structure === "many" ? " checked" : "") + '><span>One-to-many (shared cell)</span></label>' +
    '</div>' +
    '<div class="cols-2"><div><h3>' + esc(m.st.label) + '</h3><p class="flow">' + esc(m.st.note) + '</p>' +
    props([
      ["Minimum premium", R(m.st.minPremium) + " a year" + (state.structure === "many" ? ", for at least 3 years" : "")],
      ["Client capital", pct(m.st.capitalPct) + " of year-1 premium, held in the cell and returned at exit"],
      ["Policies in the cell", state.structure === "one" ? "1 (yours only)" : m.n + " of a maximum " + MAX_POLICIES],
      ["No-claim bonus", "Underwriting surplus paid out every 3 years"]
    ]) +
    '</div><div class="ruled"><h3>How the cover flows</h3><p class="flow">Your company pays the premium to a South African insurer, which keeps a ' + esc(pct(FRONTING)) + ' fronting fee and reinsures the risk into your cell in Mauritius, in US dollars. The cell is administered by Guardrisk and owned through a Mauritian company (GBC) held by your offshore trust. Claims are paid from the cell; what is not needed for claims comes back to the GBC as a no-claim bonus every three years.</p></div></div></section>';

  var risks = '<section class="block" aria-labelledby="s-risks"><div class="block-head"><div><h2 id="s-risks">2. Risks to cover</h2><p class="caption">Pick from the list. Your final schedule of cover is agreed with the fronting insurer and Guardrisk after a risk review.</p></div></div>' +
    '<div class="split-add"><label class="field"><span>Add a risk</span><select id="risk-add"' + (m.available.length ? "" : " disabled") + '><option value="" disabled selected>' + esc(riskPlaceholder) + '</option>' + riskOpts + '</select></label>' +
    '<div class="btn-row"><button type="button" class="btn" id="select-all">Select all</button><button type="button" class="btn" id="clear-all">Clear all</button></div></div>' +
    riskList + '</section>';

  var assumptions = '<section class="block" aria-labelledby="s-prem"><div class="block-head"><div><h2 id="s-prem">3. Premium and assumptions</h2></div></div><div class="cols-3">' +
    '<div class="stack"><h3>Premium</h3>' +
    field("premium", "Annual premium you are willing to absorb (R, reinsured into the cell)", state.premiumS) +
    '<dl class="premium-split"><div><dt>Premium</dt><dd>' + esc(R(m.P)) + '</dd></div><div><dt>Fronting fee</dt><dd>' + esc(R(m.y1.fronting)) + '<span class="basis">' + esc(pct(FRONTING)) + ' of the gross premium</span></dd></div><div><dt>Total first-year premium, including fronting</dt><dd>' + esc(R(m.y1.gross)) + '</dd></div></dl>' +
    (state.structure === "many" ? '<label class="field"><span>Policies in the shared cell (including yours)</span><select id="policies">' + pol + '</select></label><p class="result" id="policies-note">The shared cell goes live only once all 10 slots are filled.</p>' : '') +
    field("esc", "Premium increase per year (%)", state.escS) +
    '<p class="result">You pay ' + esc(R(m.y1.gross)) + ' in year 1 including the ' + esc(pct(FRONTING)) + ' fronting fee.</p></div>' +
    '<div class="stack"><h3>Exchange rate</h3>' +
    field("fx", "Starting rate (R per US$)", state.fxS) +
    '<label class="switch"><input type="checkbox" id="own-fx"' + (state.ownFx ? " checked" : "") + '><span>Use my own rand outlook</span></label>' +
    (state.ownFx
      ? field("dep", "Rand depreciation per year (%; negative = rand strengthens)", state.depS)
      : '<label class="field"><span>Rand outlook</span><select id="fx-preset">' + fxOptions + '</select></label>') +
    '<p class="result">Year-10 rate: R' + esc(m.y10.fx.toFixed(2)) + ' per US$.</p></div>' +
    '<div class="stack"><h3>Cell performance</h3>' +
    field("inv", "Investment return on cell cash (% a year, US$)", state.invS) +
    '<p class="result">' + esc(INV_NOTE) + '</p>' +
    field("claims", "Claims ratio (% of premium reinsured)", state.claimsS) +
    '<p class="result">Fixed costs: fronting ' + esc(pct(FRONTING)) + ', FFG management fee ' + esc(pct(FFG_FEE)) + ', Guardrisk ' + esc(pct(GR_PCT)) + ' (minimum ' + esc(U(GR_MIN)) + ' per cell a year), Mauritius tax ' + esc(pct(MU_TAX)) + ', IBNR reserve ' + esc(pct(IBNR)) + '.</p></div>' +
    '</div>';

  if (m.belowMin) {
    var extra = state.structure === "one" && m.entered >= STRUCT.many.minPremium ? " Your premium qualifies for the one-to-many structure." : "";
    assumptions += callout("warn", "Below the " + m.st.label.toLowerCase() + " minimum.",
      "You entered " + R(m.entered) + ". A " + m.st.label.toLowerCase() + " cell needs at least " + R(m.st.minPremium) + " a year" + (state.structure === "many" ? " for at least 3 years" : "") + ", so the figures on this page use " + R(m.st.minPremium) + "." + extra);
  }
  if (state.structure === "one" && m.y1.pu * GR_PCT < GR_MIN) {
    assumptions += callout("info", "Guardrisk minimum applies.",
      "At " + U(m.y1.pu) + " premium reinsured, 3% is " + U(m.y1.pu * GR_PCT) + ", so the " + U(GR_MIN) + " annual minimum is charged. Above about " + R((GR_MIN / GR_PCT) * m.fx0) + " a year the 3% rate applies instead.");
  }
  assumptions += '</section>';

  var taxRows = [
    ["Taxable income", R(m.taxable), R(m.taxableAfter), false],
    ["Tax at 27%", R(m.taxBefore), R(m.taxAfter), false],
    ["Tax saving", "", R(m.taxSaving), true],
    ["Premium paid", "", R(m.deduction), false],
    ["Net after-tax cost of the premium", "", R(m.netCost), false],
    ["Net cost as % of premium", "", m.deduction > 0 ? pct(m.netCost / m.deduction) : "–", false]
  ];
  var taxBody = taxRows.map(function (row) {
    return '<tr><td scope="row">' + esc(row[0]) + '</td><td class="num">' + esc(row[1]) + '</td><td class="num' + (row[3] ? " pos" : "") + '">' + esc(row[2]) + '</td></tr>';
  }).join("");
  var tax = '<section class="block" aria-labelledby="s-tax"><div class="block-head"><div><h2 id="s-tax">6. Tax impact: year ending 28 February 2027</h2><p class="caption">South African company in a tax-paying position, corporate tax 27%, premium deductible.</p></div></div><div class="cols-2"><div class="stack"><h3>Your figures</h3>' +
    field("taxable", "Taxable income before the premium (R)", state.taxableS) +
    '<label class="field"><span>Months of premium falling in the year to 28 Feb 2027</span><select id="months">' + monthOpts + '</select></label>' +
    '<p class="result">Premium deducted: ' + esc(R(m.deduction)) + ' (' + esc(String(m.months)) + ' of 12 months of the ' + esc(R(m.y1.gross)) + ' year-1 premium, including fronting).</p></div>' +
    '<div class="sheet-wrap"><p class="scroll-hint until-mid">Scroll sideways for every column.</p><div class="sheet"><table class="mid"><caption class="vh">Tax with and without the premium</caption><thead><tr><th scope="col"><span class="vh">Item</span></th><th scope="col" class="num">Without the premium</th><th scope="col" class="num">With the premium</th></tr></thead><tbody>' + taxBody + '</tbody></table></div></div></div>';
  if (m.taxableAfter < 0 && m.taxable > 0) {
    tax += callout("warn", "Premium exceeds taxable income.", "Only " + R(m.taxable) + " of the premium reduces tax this year; the balance of " + R(-m.taxableAfter) + " becomes an assessed loss carried forward.");
  }
  tax += cmp.html + '</section>';

  var zar = m.rows.map(function (r) {
    return {
      year: r.y,
      cells: [
        cell("Year " + r.y), cell(r.fx.toFixed(2)), cell(R(r.gross)), cell(R(r.fronting)), cell(R(r.taxSave)), cell(R(r.afterTax)),
        cell(R(r.structZ + r.capZ)), cell(r.ncbZ > 0 ? R(r.ncbZ) : "–", r.ncbZ > 0), cell(R(r.cumNcbZ)), cell(R(r.cashZ)), cell(R(r.total))
      ]
    };
  });
  zar.push({
    total: true,
    cells: [
      cell("10-year total"), cell(""), cell(R(sumKey(m.rows, "gross"))), cell(R(sumKey(m.rows, "fronting"))), cell(R(sumKey(m.rows, "taxSave"))),
      cell(R(sumKey(m.rows, "afterTax"))), cell(R(sumKey(m.rows, "structZ") + sumKey(m.rows, "capZ"))), cell(R(m.totNcbZ)), cell(R(m.totNcbZ)),
      cell(R(m.y10.cashZ)), cell(R(m.y10.total))
    ]
  });
  var usd = m.rows.map(function (r) {
    return {
      year: r.y,
      cells: [
        cell("Year " + r.y), cell(U(r.pu)), cell(U(r.ffg)), cell(U(r.gr)), cell(U(r.claims)), cell(U(r.ibnr)), cell(U(r.uw)), cell(U(r.inv)),
        cell(U(r.mtax)), cell(U(r.uw + r.inv - r.mtax)), cell(r.ncb > 0 ? U(r.ncb) : "–", r.ncb > 0), cell(U(r.cash))
      ]
    };
  });
  usd.push({
    total: true,
    cells: [
      cell("10-year total"), cell(U(sumKey(m.rows, "pu"))), cell(U(sumKey(m.rows, "ffg"))), cell(U(sumKey(m.rows, "gr"))), cell(U(sumKey(m.rows, "claims"))),
      cell(U(sumKey(m.rows, "ibnr"))), cell(U(sumKey(m.rows, "uw"))), cell(U(sumKey(m.rows, "inv"))), cell(U(sumKey(m.rows, "mtax"))),
      cell(U(sumKey(m.rows, "uw") + sumKey(m.rows, "inv") - sumKey(m.rows, "mtax"))), cell(U(m.totNcbU)), cell(U(m.y10.cash))
    ]
  });

  var plan = '<section class="block" aria-labelledby="s-plan"><div class="block-head"><div><h2 id="s-plan">7. Your 10-year plan</h2><p class="caption">Policy years from inception. Rand values at each year\'s exchange rate.' + esc(shareNote) + '</p></div></div>' +
    '<div class="cols-2"><div><h3>Value built vs your after-tax cost (R millions)</h3>' + lineChart(m) + '</div><div><h3>No-claim bonus payouts (R millions)</h3>' + colChart(m) + '</div></div>' +
    '<div class="segment" role="radiogroup" aria-label="Currency view">' +
    '<label><input type="radio" name="plan-view" id="view-zar" value="zar"' + (state.view === "zar" ? " checked" : "") + '><span>Your position (R)</span></label>' +
    '<label><input type="radio" name="plan-view" id="view-usd" value="usd"' + (state.view === "usd" ? " checked" : "") + '><span>Cell account (US$)</span></label></div>' +
    (state.view === "zar"
      ? sheet("Your position in rand", ["Year", "R per US$", "Premium paid", "of which fronting", "Tax saving (27%)", "After-tax premium", "Capital + trust/GBC", "No-claim bonus", "Bonuses to date", "Cell value", "Total value"], zar, true)
      : sheet("Cell account in US dollars", ["Year", "Premium reinsured", "FFG fee", "Guardrisk", "Claims", "IBNR reserve", "Underwriting profit", "Investment income", "Mauritius tax", "Profit after tax", "No-claim bonus", "Cell cash at year end"], usd, true)) +
    '<p class="closing">Cell value is cash held in the cell at year end: your capital (' + esc(U(m.capitalUsd)) + '), the IBNR claims reserve and profits not yet paid out. Every third year the surplus above capital and reserve is paid to your GBC as a no-claim bonus. Trust and GBC running costs are paid outside the cell.</p></section>';

  return metrics + structure + risks + assumptions + feeSection(m) + exitSection(m) + tax + plan;
}

function syncLead(m) {
  function setFresh(id, value) {
    var el = document.getElementById(id);
    if (!el || el.dataset.touched === "1" || document.activeElement === el) return;
    if (el.value !== value) el.value = value;
  }
  setFresh("lead-premium", fmt0(m.entered));
  setFresh("lead-structure", m.st.label);
  setFresh("lead-risks", m.pickedRisks.length ? m.pickedRisks.map(function (r) { return r.name; }).join(", ") : "None selected");
}

var lastWidth = 0;

function render() {
  var root = document.getElementById("calculator");
  var active = document.activeElement;
  var key = null, start = null, end = null;
  if (active && root.contains(active) && active.id) {
    key = active.id;
    try {
      if (typeof active.selectionStart === "number") {
        start = active.selectionStart;
        end = active.selectionEnd;
      }
    } catch (err) { /* radio and checkbox */ }
  }
  var model = compute();
  root.innerHTML = view(model);
  syncLead(model);
  lastWidth = root.clientWidth;
  if (key) {
    var el = document.getElementById(key);
    if (el) {
      el.focus({ preventScroll: true });
      if (start !== null && el.setSelectionRange) {
        try { el.setSelectionRange(start, end); } catch (err2) { /* ignore */ }
      }
    }
  }
}

function switchStructure(s) {
  var premiumNow = num(state.premiumS, 0);
  state.structure = s;
  if (premiumNow < STRUCT[s].minPremium) state.premiumS = fmt0(STRUCT[s].minPremium);
}

function resetCase() {
  state.structure = "many";
  state.premiumS = DEFAULTS.premium;
  state.policiesS = DEFAULTS.policies;
  state.fxS = DEFAULTS.fx;
  state.depS = DEFAULTS.dep;
  state.invS = DEFAULTS.inv;
  state.claimsS = DEFAULTS.claims;
  state.escS = DEFAULTS.esc;
  state.taxableS = DEFAULTS.taxable;
  state.divTaxS = DEFAULTS.divTax;
  state.marginalS = DEFAULTS.marginal;
  state.monthsS = "12";
  state.ownFx = false;
}

function updateFrom(t) {
  switch (t.id) {
    case "premium": state.premiumS = t.value; return true;
    case "policies": state.policiesS = t.value; return true;
    case "esc": state.escS = t.value; return true;
    case "fx": state.fxS = t.value; return true;
    case "dep": state.depS = t.value; return true;
    case "inv": state.invS = t.value; return true;
    case "claims": state.claimsS = t.value; return true;
    case "taxable": state.taxableS = t.value; return true;
    case "div-tax": state.divTaxS = t.value; return true;
    case "marginal": state.marginalS = t.value; return true;
    case "months": state.monthsS = t.value; return true;
    case "own-fx": state.ownFx = t.checked; return true;
    case "fx-preset": {
      for (var i = 0; i < FX_PRESETS.length; i++) {
        if (FX_PRESETS[i].value === t.value) { state.depS = FX_PRESETS[i].dep; return true; }
      }
      return false;
    }
    case "structure-one":
    case "structure-many":
      if (t.checked) switchStructure(t.value);
      return true;
    case "view-zar":
    case "view-usd":
      if (t.checked) state.view = t.value;
      return true;
    case "risk-add":
      if (!t.value || state.picked.indexOf(t.value) !== -1) return false;
      state.picked = state.picked.concat([t.value]);
      return true;
    default:
      return false;
  }
}

function onCalc(e) {
  var t = e.target;
  if (!t || !t.id) return;
  if (t.tagName === "SELECT" && e.type !== "change") return;
  if (t.tagName !== "SELECT" && e.type === "change") return;
  if (!updateFrom(t)) return;
  render();
}

function onClick(e) {
  var btn = e.target.closest ? e.target.closest("button") : null;
  var root = document.getElementById("calculator");
  if (!btn || !root.contains(btn)) return;
  var removeId = btn.getAttribute("data-remove");
  if (btn.id === "reset") resetCase();
  else if (btn.id === "select-all") state.picked = RISKS.map(function (r) { return r.id; });
  else if (btn.id === "clear-all") state.picked = [];
  else if (removeId) state.picked = state.picked.filter(function (id) { return id !== removeId; });
  else return;
  render();
  if (removeId) {
    var add = document.getElementById("risk-add");
    if (add) add.focus({ preventScroll: true });
  }
}

var PLACEHOLDER = "PASTE_APPS_SCRIPT_WEB_APP_URL_HERE";

function endpointLive() {
  return typeof LEAD_ENDPOINT === "string" && LEAD_ENDPOINT.trim() !== "" && LEAD_ENDPOINT.trim() !== PLACEHOLDER;
}

function clearErrors() {
  document.querySelectorAll(".field-error").forEach(function (n) { n.remove(); });
  document.querySelectorAll("[aria-invalid]").forEach(function (n) { n.removeAttribute("aria-invalid"); });
}

function showError(input, message) {
  input.setAttribute("aria-invalid", "true");
  var p = document.createElement("p");
  p.className = "field-error";
  p.id = input.id + "-error";
  p.textContent = message;
  var described = input.getAttribute("aria-describedby");
  input.setAttribute("aria-describedby", described ? described + " " + p.id : p.id);
  var host = input.closest(".field") || input.closest(".consent") || input.parentNode;
  host.appendChild(p);
}

function showThanks() {
  document.getElementById("lead-form").hidden = true;
  document.getElementById("lead-unavailable").hidden = true;
  var thanks = document.getElementById("lead-thanks");
  thanks.hidden = false;
  thanks.focus({ preventScroll: false });
}

function wireLead() {
  ["lead-premium", "lead-structure", "lead-risks"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", function () { this.dataset.touched = "1"; });
  });
  var note = document.getElementById("lead-unavailable");
  if (endpointLive()) note.hidden = true;

  document.getElementById("lead-form").addEventListener("submit", function (e) {
    e.preventDefault();
    clearErrors();
    var status = document.getElementById("lead-status");
    status.textContent = "";
    if (!endpointLive()) {
      note.hidden = false;
      note.focus();
      return;
    }
    var name = document.getElementById("lead-name");
    var company = document.getElementById("lead-company");
    var role = document.getElementById("lead-role");
    var email = document.getElementById("lead-email");
    var phone = document.getElementById("lead-phone");
    var consent = document.getElementById("lead-consent");
    var first = null;
    function fail(input, message) {
      showError(input, message);
      if (!first) first = input;
    }
    if (!name.value.trim()) fail(name, "Enter your full name.");
    if (!company.value.trim()) fail(company, "Enter your company.");
    if (!role.value.trim()) fail(role, "Enter your role.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) fail(email, "Enter a valid email address.");
    if (phone.value.replace(/\D/g, "").length < 7) fail(phone, "Enter a phone number.");
    if (!consent.checked) fail(consent, "Consent is required before we can respond.");
    if (first) {
      status.textContent = "Please complete the highlighted fields.";
      first.focus();
      return;
    }
    var payload = {
      timestamp: new Date().toISOString(),
      name: name.value.trim(),
      company: company.value.trim(),
      role: role.value.trim(),
      email: email.value.trim(),
      phone: phone.value.trim(),
      structure: document.getElementById("lead-structure").value.trim(),
      premium: document.getElementById("lead-premium").value.trim(),
      risks: document.getElementById("lead-risks").value.trim(),
      message: document.getElementById("lead-message").value.trim(),
      consent: "Yes",
      page: location.href,
      honeypot: document.getElementById("lead-website").value
    };
    var btn = document.getElementById("lead-submit");
    var trapped = payload.honeypot.trim() !== "";
    btn.disabled = true;
    btn.textContent = "Sending…";
    fetch(LEAD_ENDPOINT.trim(), {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function () {
      showThanks();
    }).catch(function () {
      if (trapped) { showThanks(); return; }
      btn.disabled = false;
      btn.textContent = "Request a consultation";
      status.textContent = "We could not send your enquiry just now. Please try again in a moment.";
    });
  });

  document.getElementById("lead-form").addEventListener("input", function (e) {
    if (e.target && e.target.getAttribute("aria-invalid")) {
      e.target.removeAttribute("aria-invalid");
      var err = document.getElementById(e.target.id + "-error");
      if (err) err.remove();
    }
  });
}

var calcRoot = document.getElementById("calculator");
if (calcRoot) {
  calcRoot.addEventListener("input", onCalc);
  calcRoot.addEventListener("change", onCalc);
  calcRoot.addEventListener("click", onClick);
  var resizeTimer;
  window.addEventListener("resize", function () {
    var w = document.getElementById("calculator").clientWidth;
    if (w === lastWidth) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 120);
  });
  render();
  wireLead();
}
