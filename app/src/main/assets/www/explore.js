let chartSpeed, chartEnergy, chartDir;

const state = {
  station: "Peshawar",
  stationMode: "station",      // station | estimated
  displayLabel: "Peshawar",
  lat: null,
  lon: null,
  nearest: null,
  startYear: 2024,
  endYear: 2033,
  recYear: 2028,
  controls: {
    installType: "rooftop",
    turbineSizeKw: 1.0,
    hubHeight: 12,
    losses: 12,
    capacityFactor: "med"
  }
};

function $(id){ return document.getElementById(id); }

function showError(msg){
  const box = $("exploreError");
  box.textContent = msg;
  box.classList.remove("hidden");
}

function clearError(){
  const box = $("exploreError");
  box.textContent = "";
  box.classList.add("hidden");
}

function fmt(x, d=2){
  if (!Number.isFinite(x)) return "â€”";
  return x.toFixed(d);
}

function setSummaryLoading(){
  const s = $("locationSummary");
  s.classList.add("skeleton");
  s.innerHTML = `<div class="skeleton-line w40"></div><div class="skeleton-line w70"></div><div class="skeleton-line w60"></div>`;
}

function setSummaryContent(html){
  const s = $("locationSummary");
  s.classList.remove("skeleton");
  s.innerHTML = html;
}

function makeChart(ctx, config){
  return new Chart(ctx, {
    ...config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: { legend: { display: true }, tooltip: { enabled: true } },
      ...config.options
    }
  });
}

function populateYearSelects(){
  const ys = WindCast.listYears(2014, 2033);
  const sy = $("startYear");
  const ey = $("endYear");
  sy.innerHTML = ""; ey.innerHTML = "";

  ys.forEach(y => {
    const o1 = document.createElement("option"); o1.value = y; o1.textContent = y;
    const o2 = document.createElement("option"); o2.value = y; o2.textContent = y;
    sy.appendChild(o1); ey.appendChild(o2);
  });

  sy.value = state.startYear;
  ey.value = state.endYear;

  sy.addEventListener("change", () => {
    state.startYear = Number(sy.value);
    if (state.endYear < state.startYear) { state.endYear = state.startYear; ey.value = state.endYear; }
    refreshAll();
  });

  ey.addEventListener("change", () => {
    state.endYear = Number(ey.value);
    if (state.endYear < state.startYear) { state.startYear = state.endYear; sy.value = state.startYear; }
    refreshAll();
  });

  document.querySelectorAll("[data-preset]").forEach(btn => {
    btn.addEventListener("click", () => {
      const p = btn.dataset.preset;
      if (p === "hist"){ state.startYear = 2014; state.endYear = 2023; }
      if (p === "fcst"){ state.startYear = 2024; state.endYear = 2033; }
      if (p === "n1"){ state.startYear = 2024; state.endYear = 2024; }
      if (p === "n3"){ state.startYear = 2024; state.endYear = 2026; }
      if (p === "n5"){ state.startYear = 2024; state.endYear = 2028; }
      sy.value = state.startYear;
      ey.value = state.endYear;
      refreshAll();
    });
  });
}

function initControls(){
  $("installType").value = state.controls.installType;
  $("turbineSizeKw").value = state.controls.turbineSizeKw;
  $("hubHeight").value = state.controls.hubHeight;
  $("losses").value = state.controls.losses;
  $("capacityFactor").value = state.controls.capacityFactor;

  $("hubHeightVal").textContent = String(state.controls.hubHeight);
  $("lossesVal").textContent = String(state.controls.losses);

  function updateScenarioHelpText(){
    const hubH = Number(state.controls.hubHeight);
    const losses = Number(state.controls.losses);
    const cf = state.controls.capacityFactor;

    const hubHelp = $("hubHeightHelp");
    const lossesHelp = $("lossesHelp");
    const cfHelp = $("cfHelp");

    if (hubHelp){
      if (hubH < 10) hubHelp.textContent = "Lower hub height: easier installation, usually lower wind capture.";
      else if (hubH <= 25) hubHelp.textContent = "Moderate hub height: balanced for many practical setups.";
      else hubHelp.textContent = "Higher hub height: potentially better wind, but may need stronger structure and budget.";
    }

    if (lossesHelp){
      if (losses <= 8) lossesHelp.textContent = "Low-loss assumption: optimistic; use when site/setup is very good.";
      else if (losses <= 18) lossesHelp.textContent = "Balanced-loss assumption: good default for early screening.";
      else lossesHelp.textContent = "High-loss assumption: conservative; useful when conditions are uncertain.";
    }

    if (cfHelp){
      if (cf === "low") cfHelp.textContent = "Low CF is conservative and safer when data confidence is limited.";
      else if (cf === "med") cfHelp.textContent = "Medium CF is the recommended default for most users.";
      else cfHelp.textContent = "High CF is optimistic; use only with strong local wind evidence.";
    }
  }

  function syncControlsToUi(){
    $("installType").value = state.controls.installType;
    $("turbineSizeKw").value = state.controls.turbineSizeKw;
    $("hubHeight").value = state.controls.hubHeight;
    $("losses").value = state.controls.losses;
    $("capacityFactor").value = state.controls.capacityFactor;
    $("hubHeightVal").textContent = String(state.controls.hubHeight);
    $("lossesVal").textContent = String(state.controls.losses);
    updateScenarioHelpText();
  }

  $("installType").addEventListener("change", () => { state.controls.installType = $("installType").value; updateScenarioHelpText(); refreshKPIsAndScenario(); });
  $("capacityFactor").addEventListener("change", () => { state.controls.capacityFactor = $("capacityFactor").value; updateScenarioHelpText(); refreshKPIsAndScenario(); });
  $("turbineSizeKw").addEventListener("input", () => { state.controls.turbineSizeKw = Number($("turbineSizeKw").value || 1); refreshKPIsAndScenario(); });

  $("hubHeight").addEventListener("input", () => {
    state.controls.hubHeight = Number($("hubHeight").value);
    $("hubHeightVal").textContent = String(state.controls.hubHeight);
    updateScenarioHelpText();
    refreshKPIsAndScenario();
  });

  $("losses").addEventListener("input", () => {
    state.controls.losses = Number($("losses").value);
    $("lossesVal").textContent = String(state.controls.losses);
    updateScenarioHelpText();
    refreshKPIsAndScenario();
  });

  document.querySelectorAll("[data-scenario-preset]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-scenario-preset]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const p = btn.dataset.scenarioPreset;
      if (p === "home"){
        state.controls.installType = "rooftop";
        state.controls.turbineSizeKw = 1.0;
        state.controls.hubHeight = 12;
        state.controls.losses = 12;
        state.controls.capacityFactor = "med";
      } else if (p === "school"){
        state.controls.installType = "rooftop";
        state.controls.turbineSizeKw = 2.5;
        state.controls.hubHeight = 18;
        state.controls.losses = 14;
        state.controls.capacityFactor = "med";
      } else if (p === "openland"){
        state.controls.installType = "open_land";
        state.controls.turbineSizeKw = 5.0;
        state.controls.hubHeight = 30;
        state.controls.losses = 10;
        state.controls.capacityFactor = "high";
      }
      syncControlsToUi();
      refreshKPIsAndScenario();
    });
  });

  updateScenarioHelpText();
}

function initSearch(stations){
  const input = $("stationSearch");
  const box = $("stationAutocomplete");

  function closeBox(){ box.classList.remove("open"); box.innerHTML = ""; }
  function openBox(items){
    box.classList.add("open");
    box.innerHTML = "";
    items.forEach(name => {
      const div = document.createElement("div");
      div.className = "item";
      div.textContent = name;
      div.addEventListener("click", () => {
        input.value = name;
        closeBox();
        applyLocation(name);
      });
      box.appendChild(div);
    });
  }

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q){ closeBox(); return; }
    const matches = stations.filter(s => s.toLowerCase().includes(q)).slice(0, 8);
    if (matches.length) openBox(matches);
    else closeBox();
  });

  document.addEventListener("click", (e) => {
    if (!box.contains(e.target) && e.target !== input) closeBox();
  });

  $("applyStationBtn").addEventListener("click", () => applyLocation(input.value.trim()));
}

async function geocodePlaceName(name){
  // Client-side geocoding using OSM Nominatim (no backend). We cache responses to be polite.
  const key = `windcast_geo_${name.toLowerCase()}`;
  const cached = localStorage.getItem(key);
  if (cached) return JSON.parse(cached);

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name + ", Khyber Pakhtunkhwa, Pakistan")}&limit=1`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json" }
  });
  if (!res.ok) throw new Error("Geocoding service failed. Try another location name.");
  const data = await res.json();
  if (!data?.length) throw new Error("Location not found. Try a nearby city/area name.");
  const hit = data[0];
  const out = { lat: Number(hit.lat), lon: Number(hit.lon), display: hit.display_name };
  localStorage.setItem(key, JSON.stringify(out));
  return out;
}

async function applyLocation(text){
  clearError();
  if (!text){ showError("Please enter a station or a location name."); return; }

  const stations = WindCast.getStations();
  setSummaryLoading();

  // Exact station
  if (stations.includes(text)){
    state.stationMode = "station";
    state.station = text;
    state.displayLabel = text;
    state.lat = null; state.lon = null; state.nearest = null;
    refreshAll();
    return;
  }

  // Non-station: geocode â†’ estimate
  try{
    const geo = await geocodePlaceName(text);
    if (!Number.isFinite(geo.lat) || !Number.isFinite(geo.lon)) throw new Error("Geocoding returned invalid coordinates.");

    state.stationMode = "estimated";
    state.station = text;
    state.displayLabel = `Estimated: ${text}`;
    state.lat = geo.lat;
    state.lon = geo.lon;

    refreshAll();
  } catch(err){
    showError(err.message || String(err));
    setSummaryContent(`<div><strong>${text}</strong></div><div class="muted">Unable to estimate this location. Try another name.</div>`);
  }
}

function getActiveSeries(){
  if (state.stationMode === "station"){
    return { series: WindCast.seriesForStation(state.station, state.startYear, state.endYear), meta: null };
  }
  const est = WindCast.estimateSeries(state.lat, state.lon, state.startYear, state.endYear, 3);
  state.nearest = est.nearest;
  return { series: est.series, meta: est };
}

function updateRecYearDropdown(){
  const sel = $("recYear");
  sel.innerHTML = "";
  for (let y = state.startYear; y <= state.endYear; y++){
    const o = document.createElement("option");
    o.value = y; o.textContent = y;
    sel.appendChild(o);
  }
  const mid = Math.round((state.startYear + state.endYear)/2);
  state.recYear = Math.min(Math.max(mid, state.startYear), state.endYear);
  sel.value = state.recYear;

  sel.onchange = () => {
    state.recYear = Number(sel.value);
    renderRecommendations();
  };
}

function feasibilityBadge(meanSpeed){
  if (!Number.isFinite(meanSpeed)) return "â€”";
  if (meanSpeed >= 6.0) return "Good";
  if (meanSpeed >= 4.5) return "Moderate";
  return "Poor";
}

function dirConfidenceLabel(r){
  if (!Number.isFinite(r)) return "â€”";
  if (r >= 0.85) return "High";
  if (r >= 0.65) return "Medium";
  return "Low";
}

function setNeedle(deg){
  const needle = $("needle");
  if (!Number.isFinite(deg)) {
    needle.style.transform = `translate(-50%,-100%) rotate(0deg)`;
    $("dominantDirLabel").textContent = "â€”";
    return;
  }
  needle.style.transform = `translate(-50%,-100%) rotate(${deg}deg)`;
  $("dominantDirLabel").textContent = `${WindCast.degToCompass(deg)} â€¢ ${fmt(deg,0)}Â°`;
}

function refreshKPIsAndScenario(){
  const { series } = getActiveSeries();
  const speeds = series.map(r => r.speed).filter(Number.isFinite);
  const energies = series.map(r => r.energy).filter(Number.isFinite);
  const dirs = series.map(r => r.dir).filter(Number.isFinite);

  const mSpeed = WindCast.mean(speeds);
  $("kpiSpeed").textContent = Number.isFinite(mSpeed) ? fmt(mSpeed,2) : "â€”";

  // best months by mean speed
  const byMonth = new Map();
  series.forEach(r => {
    const m = Number(r.date.slice(5,7));
    if (!byMonth.has(m)) byMonth.set(m, []);
    if (Number.isFinite(r.speed)) byMonth.get(m).push(r.speed);
  });
  const monthNames = WindCast.listMonths().reduce((acc,x)=>{acc[x.v]=x.t; return acc;},{});
  const mm = [...byMonth.entries()].map(([m, arr]) => ({ m, v: WindCast.mean(arr) }))
    .sort((a,b)=>b.v-a.v).slice(0,2).filter(x=>Number.isFinite(x.v));
  $("kpiBestMonths").textContent = mm.length ? mm.map(x => monthNames[x.m]).join(", ") : "â€”";

  // baseline annual energy = mean monthly * 12 (from dataset)
  const baseMonthly = WindCast.mean(energies);
  const annual = Number.isFinite(baseMonthly) ? baseMonthly*12 : NaN;
  $("kpiEnergy").textContent = Number.isFinite(annual) ? fmt(annual,0) : "â€”";

  const { meanDeg, r } = WindCast.circularMeanDeg(dirs);
  $("kpiDir").textContent = Number.isFinite(meanDeg) ? `${WindCast.degToCompass(meanDeg)} (${fmt(meanDeg,0)}Â°)` : "â€”";
  $("kpiDirConf").textContent = `confidence: ${dirConfidenceLabel(r)}`;

  $("kpiFeas").textContent = feasibilityBadge(mSpeed);

  // Scenario estimate (visible + responsive)
  const cfMap = { low: 0.12, med: 0.20, high: 0.28 };
  const cf = cfMap[state.controls.capacityFactor] ?? 0.20;

  const turbineKw = Math.max(Number(state.controls.turbineSizeKw) || 1, 0.1);
  const lossesFrac = Math.min(Math.max(Number(state.controls.losses)/100, 0), 0.30);

  const height = Math.max(Number(state.controls.hubHeight) || 10, 3);
  const heightFactor = 1 + 0.12 * Math.log(height / 10); // gentle

  // scale dataset annual to chosen turbine size (baseline is "per reference"; we keep it screening-only)
  // scenario = annual_baseline * turbineKw * heightFactor * cf * (1-losses)
  const scenario = Number.isFinite(annual)
    ? annual * turbineKw * heightFactor * cf * (1 - lossesFrac)
    : NaN;

  $("scenarioKwh").textContent = Number.isFinite(scenario) ? `${fmt(scenario,0)} kWh/year` : "—";

  const cfLabelMap = { low: "Low CF", med: "Medium CF", high: "High CF" };
  if ($("resultInstallTag")) $("resultInstallTag").textContent = state.controls.installType === "open_land" ? "Open land" : "Rooftop";
  if ($("resultKwTag")) $("resultKwTag").textContent = `${fmt(turbineKw,1)} kW`;
  if ($("resultHeightTag")) $("resultHeightTag").textContent = `${fmt(height,0)} m`;
  if ($("resultLossesTag")) $("resultLossesTag").textContent = `${fmt(Number(state.controls.losses),0)}% losses`;
  if ($("resultCfTag")) $("resultCfTag").textContent = cfLabelMap[state.controls.capacityFactor] ?? "Medium CF";
}

function renderCharts(){
  const { series, meta } = getActiveSeries();
  const labels = series.map(r => r.date.slice(0,7));
  const speedData = series.map(r => Number.isFinite(r.speed) ? r.speed : null);
  const energyData = series.map(r => Number.isFinite(r.energy) ? r.energy : null);
  const dirData = series.map(r => Number.isFinite(r.dir) ? r.dir : null);

  const dirs = series.map(r => r.dir).filter(Number.isFinite);
  const { meanDeg } = WindCast.circularMeanDeg(dirs);
  setNeedle(meanDeg);

  if (!chartSpeed){
    chartSpeed = makeChart($("chartSpeed"), {
      type: "line",
      data: { labels, datasets: [{ label: "Wind speed (m/s)", data: speedData, tension: 0.25, pointRadius: 0 }] }
    });

    chartEnergy = makeChart($("chartEnergy"), {
      type: "bar",
      data: { labels, datasets: [{ label: "Energy potential (kWh)", data: energyData }] }
    });

    chartDir = makeChart($("chartDir"), {
      type: "line",
      data: { labels, datasets: [{ label: "Direction (deg)", data: dirData, tension: 0.25, pointRadius: 0 }] },
      options: { scales: { y: { min:0, max:360, ticks:{ stepSize:90 } } } }
    });
  } else {
    chartSpeed.data.labels = labels;
    chartSpeed.data.datasets[0].data = speedData;
    chartSpeed.update();

    chartEnergy.data.labels = labels;
    chartEnergy.data.datasets[0].data = energyData;
    chartEnergy.update();

    chartDir.data.labels = labels;
    chartDir.data.datasets[0].data = dirData;
    chartDir.update();
  }

  // summary card
  if (state.stationMode === "station"){
    setSummaryContent(`
      <div><strong>${state.displayLabel}</strong> <span class="muted small">â€¢ Station</span></div>
      <div class="muted">Range: ${state.startYear}â€“${state.endYear} â€¢ Charts show selected range only</div>
      <div class="muted small">Use Report Builder to export a professional report.</div>
    `);
  } else {
    const nearTxt = (meta?.nearest || []).map(n => `${n.name} (${n.km.toFixed(1)} km)`).join(", ");
    setSummaryContent(`
      <div><strong>${state.displayLabel}</strong> <span class="muted small">â€¢ Estimated</span></div>
      <div class="muted">Coordinates: ${fmt(state.lat,4)}, ${fmt(state.lon,4)}</div>
      <div class="muted small">Nearest stations: ${nearTxt}</div>
    `);
  }
}

function renderRecommendations(){
  const panel = $("recPanel");
  const notes = $("recNotes");
  panel.classList.add("skeleton");
  panel.innerHTML = `<div class="skeleton-line w60"></div><div class="skeleton-line w80"></div><div class="skeleton-line w70"></div>`;
  notes.textContent = "â€”";

  const baseStation = (state.stationMode === "station") ? state.station : (state.nearest?.[0]?.name ?? null);
  if (!baseStation){
    panel.classList.remove("skeleton");
    panel.innerHTML = `<div class="muted">Select a location to view recommendations.</div>`;
    return;
  }

  const year = state.recYear;
  const recs = window.__windcast_cache.recs.filter(r => r.station === baseStation && Number(r.year) === Number(year));

  if (!recs.length){
    panel.classList.remove("skeleton");
    panel.innerHTML = `<div class="muted">No recommendation found for ${baseStation} (${year}).</div>`;
    return;
  }

  const r = recs[0];
  const label = (state.stationMode === "station")
    ? `${baseStation} â€¢ ${year}`
    : `Estimated â€¢ Using nearest station: ${baseStation} â€¢ ${year}`;

  panel.classList.remove("skeleton");
  panel.innerHTML = `
    <div class="muted small">${label}</div>
    <div class="rec-kv">
      <div class="kv"><div class="k">Turbine type</div><div class="v">${r.turbine_type}</div></div>
      <div class="kv"><div class="k">Capacity</div><div class="v">${r.capacity_text ?? `${r.capacity_kw} kW`}</div></div>
      <div class="kv"><div class="k">Recommended height</div><div class="v">${r.height_text ?? `${r.height_m} m`}</div></div>
      <div class="kv"><div class="k">Facing / prevailing</div><div class="v">${r.facing}</div></div>
      <div class="kv"><div class="k">Hybrid advice</div><div class="v">${r.hybrid ?? "â€”"}</div></div>
    </div>
  `;
  notes.textContent = r.notes ?? "â€”";
}

function bindExportButtons(){
  document.querySelectorAll("[data-export]").forEach(btn => {
    btn.addEventListener("click", () => {
      const which = btn.dataset.export;
      const map = { speed: chartSpeed, energy: chartEnergy, dir: chartDir };
      const chart = map[which];
      if (!chart) return;
      const dataUrl = chart.toBase64Image("image/png", 1);
      const safe = (state.displayLabel || "site").replaceAll(/[^\w]+/g,"_");
      WindCast.downloadDataUrl(`WindCast_${safe}_${which}_${state.startYear}-${state.endYear}.png`, dataUrl);
    });
  });
}

function bindReportBuilder(){
  const drawer = $("reportDrawer");
  const openBtn = $("openReportBuilder");
  const closeBtn = $("closeReportBuilder");
  const backdrop = $("drawerBackdrop");
  const genBtn = $("generateReportBtn");

  if (!drawer || !openBtn || !closeBtn || !backdrop || !genBtn) {
    showError("Report Builder controls are missing on this page.");
    return;
  }

  const open = () => { drawer.classList.add("open"); drawer.setAttribute("aria-hidden","false"); };
  const close = () => { drawer.classList.remove("open"); drawer.setAttribute("aria-hidden","true"); };

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("open")) close();
  });

  genBtn.addEventListener("click", () => {
    try {
      const payload = buildReportPayload();
      const raw = JSON.stringify(payload);
      localStorage.setItem("windcast_report_payload", raw);
      sessionStorage.setItem("windcast_report_payload", raw);

      const win = window.open("./report.html", "_blank");
      if (!win) {
        // Popup blockers: fall back to same-tab navigation.
        window.location.href = "./report.html";
      }
      close();
    } catch (err) {
      showError(`Failed to generate report: ${err?.message || String(err)}`);
    }
  });
}

function buildReportPayload(){
  const { series, meta } = getActiveSeries();
  const speeds = series.map(r => r.speed).filter(Number.isFinite);
  const energies = series.map(r => r.energy).filter(Number.isFinite);
  const dirs = series.map(r => r.dir).filter(Number.isFinite);

  const mSpeed = WindCast.mean(speeds);
  const { meanDeg, r } = WindCast.circularMeanDeg(dirs);
  const baseMonthly = WindCast.mean(energies);
  const annual = Number.isFinite(baseMonthly) ? baseMonthly*12 : NaN;

  // scenario snapshot (same as KPI)
  const cfMap = { low: 0.12, med: 0.20, high: 0.28 };
  const cf = cfMap[state.controls.capacityFactor] ?? 0.20;
  const turbineKw = Math.max(Number(state.controls.turbineSizeKw) || 1, 0.1);
  const lossesFrac = Math.min(Math.max(Number(state.controls.losses)/100, 0), 0.30);
  const height = Math.max(Number(state.controls.hubHeight) || 10, 3);
  const heightFactor = 1 + 0.12 * Math.log(height / 10);
  const scenario = Number.isFinite(annual) ? annual * turbineKw * heightFactor * cf * (1 - lossesFrac) : NaN;

  const nearestTxt = (state.stationMode === "estimated" && meta?.nearest)
    ? meta.nearest.map(n => `${n.name} (${n.km.toFixed(1)} km)`).join(", ")
    : null;

  return {
    generatedAt: new Date().toISOString(),
    stationMode: state.stationMode,
    locationLabel: state.displayLabel,
    nearestTxt,
    lat: state.lat,
    lon: state.lon,
    startYear: state.startYear,
    endYear: state.endYear,
    recYear: state.recYear,
    requester: {
      name: $("rbName").value.trim(),
      org: $("rbOrg").value.trim(),
      purpose: $("rbPurpose").value.trim(),
      notes: $("rbNotes").value.trim()
    },
    kpis: {
      meanSpeed: mSpeed,
      annualEnergy: annual,
      dominantDeg: meanDeg,
      dominantCompass: WindCast.degToCompass(meanDeg),
      dirConcentration: r,
      feasibility: feasibilityBadge(mSpeed),
      scenarioAnnualKwh: scenario
    },
    controls: { ...state.controls },
    charts: {
      speedPng: chartSpeed?.toBase64Image("image/png", 1) ?? null,
      energyPng: chartEnergy?.toBase64Image("image/png", 1) ?? null,
      dirPng: chartDir?.toBase64Image("image/png", 1) ?? null
    },
    recommendationBaseStation: state.stationMode === "station" ? state.station : (state.nearest?.[0]?.name ?? null),
  };
}

function refreshAll(){
  updateRecYearDropdown();
  renderCharts();
  refreshKPIsAndScenario();
  renderRecommendations();
}

async function boot(){
  try{
    clearError();
    setSummaryLoading();

    const cache = await WindCast.loadAllData();
    window.__windcast_cache = cache;

    populateYearSelects();
    initControls();
    initSearch(WindCast.getStations());
    bindExportButtons();
    bindReportBuilder();

    // map deep-link: ?station=...
    const params = new URLSearchParams(window.location.search);
    const st = params.get("station");
    if (st && WindCast.getStations().includes(st)){
      state.station = st;
      state.displayLabel = st;
      state.stationMode = "station";
      $("stationSearch").value = st;
    } else {
      $("stationSearch").value = state.station;
    }

    refreshAll();
  } catch(err){
    showError(err.message || String(err));
  }
}

document.addEventListener("DOMContentLoaded", boot);

