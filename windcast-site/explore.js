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
  if (!Number.isFinite(x)) return "-";
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

function applyCoordinateInputs(){
  const latText = $("latitudeInput")?.value.trim() ?? "";
  const lonText = $("longitudeInput")?.value.trim() ?? "";
  applyCoordinates(latText, lonText);
}

function setCurrentLocationButtonState(isLoading){
  const btn = $("useCurrentLocationBtn");
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "Locating..." : "Use My Location";
}

function populateStationSelect(stations){
  const sel = $("stationSelect");
  if (!sel) return;
  sel.innerHTML = `<option value="">Select one of the 10 stations</option>`;
  stations.forEach((station) => {
    const opt = document.createElement("option");
    opt.value = station;
    opt.textContent = station;
    sel.appendChild(opt);
  });
}

function syncStationSelect(value){
  const sel = $("stationSelect");
  if (!sel) return;
  sel.value = value || "";
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

function cssVar(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function monthNameFromDate(dateStr){
  const m = Number(dateStr?.slice(5,7));
  const hit = WindCast.listMonths().find(x => x.v === m);
  return hit?.t ?? "—";
}

function setText(id, value){
  const el = $(id);
  if (el) el.textContent = value;
}

function makeGradient(ctx, area, topColor, bottomColor){
  const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  g.addColorStop(0, topColor);
  g.addColorStop(1, bottomColor);
  return g;
}

function commonChartOptions(unitLabel, extra = {}){
  return {
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: true,
        labels: {
          usePointStyle: true,
          pointStyle: "rectRounded",
          boxWidth: 18,
          color: cssVar("--ink-soft"),
          font: { weight: "700" }
        }
      },
      tooltip: {
        enabled: true,
        displayColors: false,
        backgroundColor: "rgba(14, 29, 52, 0.92)",
        titleColor: "#ffffff",
        bodyColor: "rgba(255,255,255,0.92)",
        padding: 12,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y, 2)}${unitLabel ? ` ${unitLabel}` : ""}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: {
          autoSkip: true,
          maxTicksLimit: 8,
          color: cssVar("--ink-soft"),
          maxRotation: 0
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(125, 145, 173, 0.18)",
          drawBorder: false
        },
        ticks: {
          color: cssVar("--ink-soft")
        }
      }
    },
    ...extra
  };
}

function applyChartTheme(chart, kind){
  if (!chart?.ctx || !chart.chartArea) return;
  const area = chart.chartArea;
  const ds = chart.data.datasets[0];

  if (kind === "speed"){
    ds.borderColor = cssVar("--azure");
    ds.backgroundColor = makeGradient(chart.ctx, area, "rgba(42, 111, 187, 0.34)", "rgba(42, 111, 187, 0.02)");
    ds.fill = true;
    ds.borderWidth = 3;
    ds.pointHoverRadius = 4;
    ds.pointRadius = 0;
    ds.pointHitRadius = 16;
  }

  if (kind === "energy"){
    ds.backgroundColor = makeGradient(chart.ctx, area, "rgba(15, 123, 115, 0.85)", "rgba(42, 111, 187, 0.30)");
    ds.borderColor = cssVar("--teal");
    ds.borderWidth = 1;
    ds.borderRadius = 8;
    ds.borderSkipped = false;
    ds.maxBarThickness = 18;
  }

  if (kind === "dir"){
    ds.borderColor = cssVar("--gold");
    ds.backgroundColor = makeGradient(chart.ctx, area, "rgba(183, 128, 47, 0.22)", "rgba(183, 128, 47, 0.02)");
    ds.fill = true;
    ds.borderWidth = 3;
    ds.pointRadius = 0;
    ds.pointHoverRadius = 4;
    ds.pointHitRadius = 16;
    ds.segment = {
      borderColor: (ctx) => {
        const y0 = ctx.p0?.parsed?.y;
        const y1 = ctx.p1?.parsed?.y;
        if (Number.isFinite(y0) && Number.isFinite(y1) && Math.abs(y1 - y0) > 180) return "rgba(183, 128, 47, 0.18)";
        return cssVar("--gold");
      }
    };
  }
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
  const stationSelect = $("stationSelect");
  const latInput = $("latitudeInput");
  const lonInput = $("longitudeInput");
  const applyCoordsBtn = $("applyCoordsBtn");
  const useCurrentLocationBtn = $("useCurrentLocationBtn");

  populateStationSelect(stations);

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

  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    closeBox();
    applyLocation(input.value.trim());
  });

  document.addEventListener("click", (e) => {
    if (!box.contains(e.target) && e.target !== input) closeBox();
  });

  $("applyStationBtn").addEventListener("click", () => applyLocation(input.value.trim()));
  stationSelect?.addEventListener("change", () => {
    const value = stationSelect.value;
    if (!value) return;
    input.value = value;
    closeBox();
    applyLocation(value);
  });

  [latInput, lonInput].forEach(el => {
    el?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      applyCoordinateInputs();
    });
  });

  applyCoordsBtn?.addEventListener("click", applyCoordinateInputs);
  useCurrentLocationBtn?.addEventListener("click", useCurrentLocation);
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
    syncStationSelect(text);
    refreshAll();
    return;
  }

  // Non-station: geocode -> estimate
  try{
    const geo = await geocodePlaceName(text);
    if (!Number.isFinite(geo.lat) || !Number.isFinite(geo.lon)) throw new Error("Geocoding returned invalid coordinates.");

    state.stationMode = "estimated";
    state.station = text;
    state.displayLabel = `Estimated: ${text}`;
    state.lat = geo.lat;
    state.lon = geo.lon;
    syncStationSelect("");

    refreshAll();
  } catch(err){
    showError(err.message || String(err));
    setSummaryContent(`<div><strong>${text}</strong></div><div class="muted">Unable to estimate this location. Try another name.</div>`);
  }
}

function applyCoordinates(latText, lonText){
  clearError();
  if (!latText || !lonText){
    showError("Please enter both latitude and longitude.");
    return;
  }

  const lat = Number(latText);
  const lon = Number(lonText);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)){
    showError("Latitude and longitude must be valid numbers.");
    return;
  }
  if (lat < -90 || lat > 90){
    showError("Latitude must be between -90 and 90.");
    return;
  }
  if (lon < -180 || lon > 180){
    showError("Longitude must be between -180 and 180.");
    return;
  }

  setSummaryLoading();
  state.stationMode = "estimated";
  state.station = `Coordinates ${fmt(lat,4)}, ${fmt(lon,4)}`;
  state.displayLabel = `Estimated: ${fmt(lat,4)}, ${fmt(lon,4)}`;
  state.lat = lat;
  state.lon = lon;
  state.nearest = null;
  syncStationSelect("");
  refreshAll();
}

function useCurrentLocation(){
  clearError();
  if (!("geolocation" in navigator)){
    showError("Geolocation is not supported in this browser.");
    return;
  }

  setSummaryLoading();
  setCurrentLocationButtonState(true);

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords?.latitude;
      const lon = position.coords?.longitude;
      $("latitudeInput").value = Number.isFinite(lat) ? String(lat) : "";
      $("longitudeInput").value = Number.isFinite(lon) ? String(lon) : "";
      setCurrentLocationButtonState(false);
      applyCoordinates(String(lat), String(lon));
    },
    (error) => {
      setCurrentLocationButtonState(false);
      const code = error?.code;
      if (code === 1) showError("Location access was denied. Allow permission and try again.");
      else if (code === 2) showError("Current location is unavailable right now. Try again.");
      else if (code === 3) showError("Location request timed out. Try again.");
      else showError("Unable to get your current location.");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000
    }
  );
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
  if (!Number.isFinite(meanSpeed)) return "-";
  if (meanSpeed >= 6.0) return "Good";
  if (meanSpeed >= 4.5) return "Moderate";
  return "Poor";
}

function dirConfidenceLabel(r){
  if (!Number.isFinite(r)) return "-";
  if (r >= 0.85) return "High";
  if (r >= 0.65) return "Medium";
  return "Low";
}

function setNeedle(deg){
  const needle = $("needle");
  if (!Number.isFinite(deg)) {
    needle.style.transform = `translate(-50%,-100%) rotate(0deg)`;
    $("dominantDirLabel").textContent = "-";
    return;
  }
  needle.style.transform = `translate(-50%,-100%) rotate(${deg}deg)`;
  $("dominantDirLabel").textContent = `${WindCast.degToCompass(deg)} • ${fmt(deg,0)}°`;
}

function refreshKPIsAndScenario(){
  const { series } = getActiveSeries();
  const speeds = series.map(r => r.speed).filter(Number.isFinite);
  const energies = series.map(r => r.energy).filter(Number.isFinite);
  const dirs = series.map(r => r.dir).filter(Number.isFinite);

  const mSpeed = WindCast.mean(speeds);
  $("kpiSpeed").textContent = Number.isFinite(mSpeed) ? fmt(mSpeed,2) : "-";

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
  $("kpiBestMonths").textContent = mm.length ? mm.map(x => monthNames[x.m]).join(", ") : "-";

  // baseline annual energy = mean monthly * 12 (from dataset)
  const baseMonthly = WindCast.mean(energies);
  const annual = Number.isFinite(baseMonthly) ? baseMonthly*12 : NaN;
  $("kpiEnergy").textContent = Number.isFinite(annual) ? fmt(annual,0) : "-";

  const { meanDeg, r } = WindCast.circularMeanDeg(dirs);
  $("kpiDir").textContent = Number.isFinite(meanDeg) ? `${WindCast.degToCompass(meanDeg)} (${fmt(meanDeg,0)}°)` : "-";
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
  const { meanDeg, r } = WindCast.circularMeanDeg(dirs);
  setNeedle(meanDeg);

  const speeds = speedData.filter(Number.isFinite);
  const energies = energyData.filter(Number.isFinite);
  const meanSpeed = WindCast.mean(speeds);
  const meanEnergy = WindCast.mean(energies);
  const peakSpeed = speeds.length ? Math.max(...speeds) : NaN;
  const peakEnergy = energies.length ? Math.max(...energies) : NaN;
  const minDir = dirs.length ? Math.min(...dirs) : NaN;
  const maxDir = dirs.length ? Math.max(...dirs) : NaN;
  const speedPeakRow = series.find(r => Number.isFinite(r.speed) && r.speed === peakSpeed);
  const energyPeakRow = series.find(r => Number.isFinite(r.energy) && r.energy === peakEnergy);
  const rangeEnergyTotal = energies.reduce((acc, v) => acc + v, 0);

  setText("speedChartAvg", Number.isFinite(meanSpeed) ? `${fmt(meanSpeed,2)} m/s` : "—");
  setText("speedChartPeak", Number.isFinite(peakSpeed) ? `${fmt(peakSpeed,2)} m/s` : "—");
  setText("speedChartBest", speedPeakRow ? `${monthNameFromDate(speedPeakRow.date)} ${speedPeakRow.date.slice(0,4)}` : "—");

  setText("energyChartAvg", Number.isFinite(meanEnergy) ? `${fmt(meanEnergy,2)} kWh` : "—");
  setText("energyChartPeak", energyPeakRow ? `${fmt(peakEnergy,2)} kWh` : "—");
  setText("energyChartTotal", energies.length ? `${fmt(rangeEnergyTotal,0)} kWh` : "—");

  const dominantDirText = Number.isFinite(meanDeg) ? `${WindCast.degToCompass(meanDeg)} • ${fmt(meanDeg,0)}°` : "—";
  setText("dirChartDominant", dominantDirText);
  setText("dirChartConfidence", dirConfidenceLabel(r));
  setText("dirChartTrend", dominantDirText);
  setText("dirChartMin", Number.isFinite(minDir) ? `${fmt(minDir,0)}°` : "—");
  setText("dirChartMax", Number.isFinite(maxDir) ? `${fmt(maxDir,0)}°` : "—");

  if (!chartSpeed){
    chartSpeed = makeChart($("chartSpeed"), {
      type: "line",
      data: { labels, datasets: [{ label: "Wind speed", data: speedData, tension: 0.38, pointRadius: 0 }] },
      options: commonChartOptions("m/s", {
        scales: {
          x: {
            grid: { display: false, drawBorder: false },
            ticks: { autoSkip: true, maxTicksLimit: 8, color: cssVar("--ink-soft"), maxRotation: 0 }
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(125, 145, 173, 0.18)", drawBorder: false },
            ticks: {
              color: cssVar("--ink-soft"),
              callback: (v) => `${v} m/s`
            }
          }
        }
      })
    });

    chartEnergy = makeChart($("chartEnergy"), {
      type: "bar",
      data: { labels, datasets: [{ label: "Energy potential", data: energyData }] },
      options: commonChartOptions("kWh", {
        scales: {
          x: {
            grid: { display: false, drawBorder: false },
            ticks: { autoSkip: true, maxTicksLimit: 8, color: cssVar("--ink-soft"), maxRotation: 0 }
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(125, 145, 173, 0.18)", drawBorder: false },
            ticks: {
              color: cssVar("--ink-soft"),
              callback: (v) => `${v} kWh`
            }
          }
        }
      })
    });

    chartDir = makeChart($("chartDir"), {
      type: "line",
      data: { labels, datasets: [{ label: "Direction", data: dirData, tension: 0.3, pointRadius: 0, spanGaps: false }] },
      options: commonChartOptions("deg", {
        scales: {
          x: {
            grid: { display: false, drawBorder: false },
            ticks: { autoSkip: true, maxTicksLimit: 8, color: cssVar("--ink-soft"), maxRotation: 0 }
          },
          y: {
            min: 0,
            max: 360,
            grid: { color: "rgba(125, 145, 173, 0.18)", drawBorder: false },
            ticks: {
              stepSize: 90,
              color: cssVar("--ink-soft"),
              callback: (v) => ({ 0: "N", 90: "E", 180: "S", 270: "W", 360: "N" }[v] ?? `${v}°`)
            }
          }
        }
      })
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

  applyChartTheme(chartSpeed, "speed");
  applyChartTheme(chartEnergy, "energy");
  applyChartTheme(chartDir, "dir");
  chartSpeed.update("none");
  chartEnergy.update("none");
  chartDir.update("none");

  // summary card
  if (state.stationMode === "station"){
    setSummaryContent(`
      <div><strong>${state.displayLabel}</strong> <span class="muted small">• Station</span></div>
      <div class="muted">Range: ${state.startYear}-${state.endYear} • Charts show selected range only</div>
      <div class="muted small">Use Report Builder to export a professional report.</div>
    `);
  } else {
    const nearTxt = (meta?.nearest || []).map(n => `${n.name} (${n.km.toFixed(1)} km)`).join(", ");
    setSummaryContent(`
      <div><strong>${state.displayLabel}</strong> <span class="muted small">• Estimated</span></div>
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
  notes.textContent = "-";

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
    ? `${baseStation} • ${year}`
    : `Estimated • Using nearest station: ${baseStation} • ${year}`;

  panel.classList.remove("skeleton");
  panel.innerHTML = `
    <div class="muted small">${label}</div>
    <div class="rec-kv">
      <div class="kv"><div class="k">Turbine type</div><div class="v">${r.turbine_type}</div></div>
      <div class="kv"><div class="k">Capacity</div><div class="v">${r.capacity_text ?? `${r.capacity_kw} kW`}</div></div>
      <div class="kv"><div class="k">Recommended height</div><div class="v">${r.height_text ?? `${r.height_m} m`}</div></div>
      <div class="kv"><div class="k">Facing / prevailing</div><div class="v">${r.facing}</div></div>
      <div class="kv"><div class="k">Hybrid advice</div><div class="v">${r.hybrid ?? "-"}</div></div>
    </div>
  `;
  notes.textContent = r.notes ?? "-";
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
    $("themeToggle")?.addEventListener("click", () => {
      window.requestAnimationFrame(() => renderCharts());
    });

    // map deep-link: ?station=...
    const params = new URLSearchParams(window.location.search);
    const st = params.get("station");
    if (st && WindCast.getStations().includes(st)){
      state.station = st;
      state.displayLabel = st;
      state.stationMode = "station";
      $("stationSearch").value = st;
      syncStationSelect(st);
    } else {
      $("stationSearch").value = state.station;
      syncStationSelect(state.station);
    }

    refreshAll();
  } catch(err){
    showError(err.message || String(err));
  }
}

document.addEventListener("DOMContentLoaded", boot);

