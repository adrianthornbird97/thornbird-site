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
var MAX_POLICIES = 10;
var COSTS = {
  one: { setup: 4500 + 12000, annual: 2000 + 8000, sharedSetup: 0, sharedAnnual: 0 },
  many: { setup: 3000, annual: 1500, sharedSetup: 12000, sharedAnnual: 8000 }
};
var DEFAULTS = { premium: "5,000,000", fx: "16.60", dep: "3", inv: "4", claims: "0", esc: "5", taxable: "20,000,000", policies: "10" };
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
    cumOutlay += grossMine - taxSave + structUsd * fx + capZ;
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
  structure: "one",
  premiumS: DEFAULTS.premium,
  policiesS: DEFAULTS.policies,
  fxS: DEFAULTS.fx,
  depS: DEFAULTS.dep,
  invS: DEFAULTS.inv,
  claimsS: DEFAULTS.claims,
  escS: DEFAULTS.esc,
  taxableS: DEFAULTS.taxable,
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
    pickedRisks: pickedRisks, available: available
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

function cell(text, pos) { return { text: String(text), pos: !!pos }; }

function sheet(caption, headers, bodyRows, wide) {
  var head = headers.map(function (h, i) {
    return '<th scope="col"' + (i ? ' class="num"' : '') + '>' + esc(h) + '</th>';
  }).join("");
  var body = bodyRows.map(function (row) {
    var cells = row.cells.map(function (c, i) {
      var cls = ((i ? "num" : "") + (c.pos ? " pos" : "")).trim();
      return '<td' + (cls ? ' class="' + cls + '"' : '') + (i === 0 ? ' scope="row"' : '') + '>' + esc(c.text) + '</td>';
    }).join("");
    return '<tr' + (row.total ? ' class="total"' : '') + (row.year ? ' data-year="' + row.year + '"' : '') + '>' + cells + '</tr>';
  }).join("");
  return '<div class="sheet-wrap"><p class="scroll-hint' + (wide ? "" : " until-mid") + '">Scroll sideways for every column.</p><div class="sheet"><table class="' + (wide ? "wide" : "mid") + '"><caption class="vh">' + esc(caption) + '</caption><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
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
    { name: "Cumulative after-tax cost incl. capital and trust/GBC", color: "#8C6239", width: 1.75, dash: "5 4", values: m.rows.map(function (r) { return r.cumOutlay / 1e6; }) }
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

function view(m) {
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

  var metrics = '<ul class="metrics">' +
    '<li><p class="metric-value" data-metric="value">' + esc(Rm(m.y10.total)) + '</p><p class="metric-label">Value built after 10 years</p><p class="metric-detail">Cell value ' + esc(Rm(m.y10.cashZ)) + ' + no-claim bonuses ' + esc(Rm(m.totNcbZ)) + '</p></li>' +
    '<li><p class="metric-value pos" data-metric="ncb">' + esc(Rm(m.totNcbZ)) + '</p><p class="metric-label">No-claim bonuses paid, 10 years</p><p class="metric-detail" data-metric="ncb-detail">' + esc(U(m.totNcbU) + " in years 3, 6 and 9") + '</p></li>' +
    '<li><p class="metric-value pos" data-metric="tax">' + esc(R(m.taxSaving)) + '</p><p class="metric-label">Tax saving, year to 28 Feb 2027</p><p class="metric-detail">At ' + esc(pct(SA_CIT)) + ' on ' + esc(R(m.deduction)) + ' premium</p></li>' +
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
    (state.structure === "many" ? '<label class="field"><span>Policies in the shared cell (including yours)</span><select id="policies">' + pol + '</select></label>' : '') +
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
  var tax = '<section class="block" aria-labelledby="s-tax"><div class="block-head"><div><h2 id="s-tax">4. Tax impact: year ending 28 February 2027</h2><p class="caption">South African company in a tax-paying position, corporate tax 27%, premium deductible.</p></div></div><div class="cols-2"><div class="stack"><h3>Your figures</h3>' +
    field("taxable", "Taxable income before the premium (R)", state.taxableS) +
    '<label class="field"><span>Months of premium falling in the year to 28 Feb 2027</span><select id="months">' + monthOpts + '</select></label>' +
    '<p class="result">Premium deducted: ' + esc(R(m.deduction)) + ' (' + esc(String(m.months)) + ' of 12 months of the ' + esc(R(m.y1.gross)) + ' year-1 premium, including fronting).</p></div>' +
    '<div class="sheet-wrap"><p class="scroll-hint until-mid">Scroll sideways for every column.</p><div class="sheet"><table class="mid"><caption class="vh">Tax with and without the premium</caption><thead><tr><th scope="col"><span class="vh">Item</span></th><th scope="col" class="num">Without the premium</th><th scope="col" class="num">With the premium</th></tr></thead><tbody>' + taxBody + '</tbody></table></div></div></div>';
  if (m.taxableAfter < 0 && m.taxable > 0) {
    tax += callout("warn", "Premium exceeds taxable income.", "Only " + R(m.taxable) + " of the premium reduces tax this year; the balance of " + R(-m.taxableAfter) + " becomes an assessed loss carried forward.");
  }
  tax += '</section>';

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

  var plan = '<section class="block" aria-labelledby="s-plan"><div class="block-head"><div><h2 id="s-plan">5. Your 10-year plan</h2><p class="caption">Policy years from inception. Rand values at each year\'s exchange rate.' + esc(shareNote) + '</p></div></div>' +
    '<div class="cols-2"><div><h3>Value built vs your after-tax cost (R millions)</h3>' + lineChart(m) + '</div><div><h3>No-claim bonus payouts (R millions)</h3>' + colChart(m) + '</div></div>' +
    '<div class="segment" role="radiogroup" aria-label="Currency view">' +
    '<label><input type="radio" name="plan-view" id="view-zar" value="zar"' + (state.view === "zar" ? " checked" : "") + '><span>Your position (R)</span></label>' +
    '<label><input type="radio" name="plan-view" id="view-usd" value="usd"' + (state.view === "usd" ? " checked" : "") + '><span>Cell account (US$)</span></label></div>' +
    (state.view === "zar"
      ? sheet("Your position in rand", ["Year", "R per US$", "Premium paid", "of which fronting", "Tax saving (27%)", "After-tax premium", "Capital + trust/GBC", "No-claim bonus", "Bonuses to date", "Cell value", "Total value"], zar, true)
      : sheet("Cell account in US dollars", ["Year", "Premium reinsured", "FFG fee", "Guardrisk", "Claims", "IBNR reserve", "Underwriting profit", "Investment income", "Mauritius tax", "Profit after tax", "No-claim bonus", "Cell cash at year end"], usd, true)) +
    '<p class="closing">Cell value is cash held in the cell at year end: your capital (' + esc(U(m.capitalUsd)) + '), the IBNR claims reserve and profits not yet paid out. Every third year the surplus above capital and reserve is paid to your GBC as a no-claim bonus. Trust and GBC running costs are paid outside the cell.</p></section>';

  return metrics + structure + risks + assumptions + tax + plan;
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
  var premiumNow = state.premiumS;
  state.structure = s;
  if (num(premiumNow, 0) < STRUCT[s].minPremium || (s === "many" && num(premiumNow, 0) === 5000000)) {
    state.premiumS = fmt0(STRUCT[s].minPremium);
  }
  if (s === "one" && num(premiumNow, 0) < 5000000) state.premiumS = "5,000,000";
}

function resetCase() {
  state.premiumS = state.structure === "one" ? "5,000,000" : "1,000,000";
  state.policiesS = DEFAULTS.policies;
  state.fxS = DEFAULTS.fx;
  state.depS = DEFAULTS.dep;
  state.invS = DEFAULTS.inv;
  state.claimsS = DEFAULTS.claims;
  state.escS = DEFAULTS.esc;
  state.taxableS = DEFAULTS.taxable;
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
