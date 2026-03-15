const WindCast = (() => {
  const DATA_PATHS = {
    speed: "./data/wind_speed.json",
    direction: "./data/wind_direction.json",
    energy: "./data/wind_energy_potential.json",
    recs: "./data/smart_recommendations.json",
  };

  const STATIONS = [
    { name: "Balakot", lat: 34.539665, lon: 73.350235 },
    { name: "Bannu", lat: 32.986111, lon: 70.604164 },
    { name: "Cherat", lat: 33.8167, lon: 71.8833 },
    { name: "Chitral", lat: 35.839378, lon: 71.780045 },
    { name: "Dir Upper", lat: 35.2074, lon: 71.8768 },
    { name: "Drosh", lat: 35.5684476, lon: 71.8037638 },
    { name: "Kakul", lat: 34.1875, lon: 73.26 },
    { name: "Parachinar", lat: 33.89968, lon: 70.10012 },
    { name: "Peshawar", lat: 34.025917, lon: 71.560135 },
    { name: "Saidu Sharif", lat: 34.749271, lon: 72.357063 },
  ];

  const cache = {
    loaded: false,
    speed: null,
    direction: null,
    energy: null,
    recs: null,
    merged: null,
    index: { byStation: new Map() }
  };

  function initTheme() {
    const saved = localStorage.getItem("windcast_theme");
    const init = (saved === "light" || saved === "dark") ? saved : "light";
    document.documentElement.dataset.theme = init;

    const label = document.getElementById("themeLabel");
    const icon = document.querySelector("#themeToggle .icon");
    const setLabel = () => {
      const cur = document.documentElement.dataset.theme === "light" ? "light" : "dark";
      if (label) label.textContent = cur === "light" ? "Light mode" : "Dark mode";
      if (icon) icon.textContent = cur === "light" ? "Sun" : "Moon";
    };
    setLabel();

    const btn = document.getElementById("themeToggle");
    if (btn) {
      btn.addEventListener("click", () => {
        const cur = document.documentElement.dataset.theme === "light" ? "light" : "dark";
        const next = cur === "light" ? "dark" : "light";
        document.documentElement.dataset.theme = next;
        localStorage.setItem("windcast_theme", next);
        setLabel();
      });
    }
  }

  function initHeaderState() {
    const header = document.querySelector(".site-header");
    if (!header) return;
    const sync = () => header.classList.toggle("scrolled", window.scrollY > 8);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
  }

  function initBackToTop() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "to-top";
    btn.setAttribute("aria-label", "Back to top");
    btn.textContent = "Top";
    document.body.appendChild(btn);

    const sync = () => btn.classList.toggle("show", window.scrollY > 380);
    sync();
    window.addEventListener("scroll", sync, { passive: true });

    btn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function initActiveNav() {
    const file = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
    const links = [...document.querySelectorAll(".nav .nav-link")];
    links.forEach((a) => {
      const href = (a.getAttribute("href") || "").toLowerCase().replace("./", "");
      const isActive = href === file || (file === "" && href === "index.html");
      a.classList.toggle("active", isActive);
      if (isActive) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function initReveal() {
    const els = [...document.querySelectorAll(".reveal")];
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) e.target.classList.add("in");
    }, { threshold: 0.12 });
    els.forEach(el => io.observe(el));
  }

  function initSectionQuickNav() {
    const nav = document.querySelector(".explore-quicknav");
    if (!nav) return;

    const sections = [...nav.querySelectorAll(".quick-link[href^='#']")]
      .map((link) => {
        const id = link.getAttribute("href")?.slice(1);
        const section = id ? document.getElementById(id) : null;
        return section ? { link, section } : null;
      })
      .filter(Boolean);

    if (!sections.length) return;

    const setActive = (id) => {
      sections.forEach(({ link, section }) => {
        const active = section.id === id;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    };

    setActive(sections[0].section.id);

    const io = new IntersectionObserver((entries) => {
      const current = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (current?.target?.id) setActive(current.target.id);
    }, {
      rootMargin: "-18% 0px -55% 0px",
      threshold: [0.2, 0.35, 0.6]
    });

    sections.forEach(({ section }) => io.observe(section));
  }

  function isISODate(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function monthKey(dateStr) { return dateStr.slice(0, 7); }

  function validateRecords(arr, requiredKeys, label) {
    if (!Array.isArray(arr)) throw new Error(`${label}: Expected an array.`);
    for (let i = 0; i < Math.min(arr.length, 200); i++) {
      const row = arr[i];
      for (const k of requiredKeys) {
        if (!(k in row)) throw new Error(`${label}: Missing key "${k}" at index ${i}.`);
      }
    }
  }

  async function fetchJson(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
    return res.json();
  }

  function buildMerged(speed, direction, energy) {
    const merged = new Map();

    function upsert(station, date, patch) {
      const key = `${station}|${monthKey(date)}`;
      const existing = merged.get(key) || { station, date, month: monthKey(date) };
      merged.set(key, { ...existing, ...patch });
    }

    speed.forEach(r => upsert(r.station, r.date, { speed: Number(r.value) }));
    energy.forEach(r => upsert(r.station, r.date, { energy: Number(r.value_kwh) }));
    direction.forEach(r => upsert(r.station, r.date, { dir: Number(r.value_deg) }));

    const byStation = new Map();
    for (const row of merged.values()) {
      if (!byStation.has(row.station)) byStation.set(row.station, []);
      byStation.get(row.station).push(row);
    }
    for (const [s, rows] of byStation.entries()) rows.sort((a,b) => (a.date < b.date ? -1 : 1));

    return { merged, byStation };
  }

  async function loadAllData() {
    if (cache.loaded) return cache;

    const [speed, direction, energy, recs] = await Promise.all([
      fetchJson(DATA_PATHS.speed),
      fetchJson(DATA_PATHS.direction),
      fetchJson(DATA_PATHS.energy),
      fetchJson(DATA_PATHS.recs),
    ]);

    validateRecords(speed, ["station", "date", "value"], "wind_speed.json");
    validateRecords(direction, ["station", "date", "value_deg"], "wind_direction.json");
    validateRecords(energy, ["station", "date", "value_kwh"], "wind_energy_potential.json");
    validateRecords(recs, ["station", "year", "turbine_type", "height_m", "facing", "capacity_kw"], "smart_recommendations.json");

    for (const r of speed.slice(0, 50)) if (!isISODate(r.date)) throw new Error("wind_speed.json: invalid date format");
    for (const r of direction.slice(0, 50)) if (!isISODate(r.date)) throw new Error("wind_direction.json: invalid date format");
    for (const r of energy.slice(0, 50)) if (!isISODate(r.date)) throw new Error("wind_energy_potential.json: invalid date format");

    const { merged, byStation } = buildMerged(speed, direction, energy);

    cache.speed = speed;
    cache.direction = direction;
    cache.energy = energy;
    cache.recs = recs;
    cache.merged = merged;
    cache.index.byStation = byStation;
    cache.loaded = true;

    return cache;
  }

  function getStations() { return STATIONS.map(s => s.name); }

  function inYearRange(dateStr, startYear, endYear) {
    const y = Number(dateStr.slice(0, 4));
    return y >= startYear && y <= endYear;
  }

  function seriesForStation(station, startYear, endYear) {
    const rows = cache.index.byStation.get(station) || [];
    return rows.filter(r => inYearRange(r.date, startYear, endYear));
  }

  function listYears(min=2014, max=2033) {
    const ys = [];
    for (let y=min; y<=max; y++) ys.push(y);
    return ys;
  }

  function listMonths() {
    return [
      {v:1, t:"Jan"}, {v:2, t:"Feb"}, {v:3, t:"Mar"}, {v:4, t:"Apr"},
      {v:5, t:"May"}, {v:6, t:"Jun"}, {v:7, t:"Jul"}, {v:8, t:"Aug"},
      {v:9, t:"Sep"}, {v:10,t:"Oct"}, {v:11,t:"Nov"}, {v:12,t:"Dec"},
    ];
  }

  function mean(arr) {
    if (!arr.length) return NaN;
    return arr.reduce((a,b)=>a+b,0)/arr.length;
  }

  function circularMeanDeg(anglesDeg, weights=null) {
    if (!anglesDeg.length) return { meanDeg: NaN, r: NaN };
    let sx=0, sy=0, sw=0;
    for (let i=0;i<anglesDeg.length;i++){
      const w = weights ? weights[i] : 1;
      const a = anglesDeg[i] * Math.PI/180;
      sx += w * Math.cos(a);
      sy += w * Math.sin(a);
      sw += w;
    }
    sx /= sw; sy /= sw;
    const r = Math.sqrt(sx*sx + sy*sy);
    let meanRad = Math.atan2(sy, sx);
    let meanDeg = (meanRad * 180/Math.PI);
    if (meanDeg < 0) meanDeg += 360;
    return { meanDeg, r };
  }

  function degToCompass(deg) {
    if (!Number.isFinite(deg)) return "—";
    const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
    const idx = Math.round(deg / 22.5) % 16;
    return dirs[idx];
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (d) => d * Math.PI/180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 +
      Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(a));
  }

  function nearestStations(lat, lon, k=3) {
    const d = STATIONS.map(s => ({
      name: s.name, lat: s.lat, lon: s.lon,
      km: haversineKm(lat, lon, s.lat, s.lon),
    }));
    d.sort((a,b)=>a.km-b.km);
    return d.slice(0, k);
  }

  function idwWeights(distKm, p=2) {
    const eps = 0.0001;
    const w = distKm.map(d => 1 / Math.pow(Math.max(d, eps), p));
    const sum = w.reduce((a,b)=>a+b,0);
    return w.map(x => x/sum);
  }

  function estimateSeries(lat, lon, startYear, endYear, k=3) {
    const near = nearestStations(lat, lon, k);
    const w = idwWeights(near.map(n=>n.km), 2);

    const base = seriesForStation(near[0].name, startYear, endYear);
    const out = base.map((row, i) => {
      const sers = near.map(n => seriesForStation(n.name, startYear, endYear));
      const speeds = sers.map(x => x[i]?.speed ?? NaN);
      const energies = sers.map(x => x[i]?.energy ?? NaN);
      const dirs = sers.map(x => x[i]?.dir ?? NaN);

      const sp = speeds.reduce((acc,v,idx)=>acc + (Number.isFinite(v)? v*w[idx] : 0), 0);
      const en = energies.reduce((acc,v,idx)=>acc + (Number.isFinite(v)? v*w[idx] : 0), 0);

      const dirFinite = dirs.map((d,idx)=>({d, w:w[idx]})).filter(x=>Number.isFinite(x.d));
      const { meanDeg, r } = circularMeanDeg(dirFinite.map(x=>x.d), dirFinite.map(x=>x.w));

      return { station:"Estimated", date: row.date, month: row.month, speed: sp, energy: en, dir: meanDeg, dir_r: r };
    });

    return { series: out, nearest: near, weights: w };
  }

  function downloadDataUrl(filename, dataUrl) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    downloadDataUrl(filename, url);
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
  }

  function toCSV(rows, headers) {
    const esc = (v) => `"${String(v ?? "").replaceAll('"','""')}"`;
    const lines = [];
    lines.push(headers.map(esc).join(","));
    for (const r of rows) lines.push(headers.map(h => esc(r[h])).join(","));
    return lines.join("\n");
  }

  return {
    initTheme, initReveal,
    initActiveNav,
    initHeaderState,
    initBackToTop,
    initSectionQuickNav,
    loadAllData,
    STATIONS,
    getStations,
    listYears, listMonths,
    seriesForStation,
    estimateSeries,
    circularMeanDeg, degToCompass,
    mean,
    downloadDataUrl,
    downloadBlob,
    toCSV
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  WindCast.initTheme();
  WindCast.initActiveNav();
  WindCast.initHeaderState();
  WindCast.initBackToTop();
  WindCast.initReveal();
  WindCast.initSectionQuickNav();
});
