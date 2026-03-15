function $(id){ return document.getElementById(id); }

function showError(msg){
  const box = $("mapError");
  box.textContent = msg;
  box.classList.remove("hidden");
}

let map, heatLayer, markersLayer, tileLayer;

function monthIndexFromDate(dateStr){ return Number(dateStr.slice(5,7)); }

function pickMonthRowForStation(station, year, month){
  const rows = window.__windcast_cache.index.byStation.get(station) || [];
  return rows.find(r => Number(r.date.slice(0,4)) === year && monthIndexFromDate(r.date) === month);
}

function buildHeatPoints(metric, year, month){
  const pts = [];
  for (const s of WindCast.STATIONS){
    const row = pickMonthRowForStation(s.name, year, month);
    const v = metric === "energy" ? row?.energy : row?.speed;
    if (Number.isFinite(v)) pts.push([s.lat, s.lon, v]);
  }
  return pts;
}

function updateHeat(){
  const metric = $("mapMetric").value;
  const year = Number($("mapYear").value);
  const month = Number($("mapMonth").value);

  const pts = buildHeatPoints(metric, year, month);

  if (heatLayer) heatLayer.remove();
  heatLayer = L.heatLayer(pts, { radius: 35, blur: 28, maxZoom: 8 }).addTo(map);
}

function addMarkers(){
  if (markersLayer) markersLayer.remove();
  markersLayer = L.layerGroup().addTo(map);

  const year = Number($("mapYear").value);
  const month = Number($("mapMonth").value);

  for (const s of WindCast.STATIONS){
    const row = pickMonthRowForStation(s.name, year, month);
    const sp = row?.speed, en = row?.energy;
    const html = `
      <div style="min-width:220px">
        <div><strong>${s.name}</strong></div>
        <div style="margin-top:6px;color:#666">
          Speed: ${Number.isFinite(sp)? sp.toFixed(2):"—"} m/s<br/>
          Energy: ${Number.isFinite(en)? en.toFixed(2):"—"} kWh
        </div>
        <div style="margin-top:10px">
          <a href="./explore.html?station=${encodeURIComponent(s.name)}">Open in Explore →</a>
        </div>
      </div>
    `;
    L.marker([s.lat, s.lon]).addTo(markersLayer).bindPopup(html);
  }
}

function setBasemap(mode){
  if (tileLayer) tileLayer.remove();

  // English-style basemap (Carto Positron) vs default OSM
  const enUrl = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  const localUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  tileLayer = L.tileLayer(mode === "en" ? enUrl : localUrl, {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
}

async function boot(){
  try{
    const cache = await WindCast.loadAllData();
    window.__windcast_cache = cache;

    map = L.map("leafletMap", { zoomControl: true }).setView([34.4, 71.7], 7);

    setBasemap("en");

    const ys = WindCast.listYears(2014, 2033);
    const ySel = $("mapYear");
    ys.forEach(y => {
      const o = document.createElement("option");
      o.value = y; o.textContent = y;
      ySel.appendChild(o);
    });
    ySel.value = 2028;

    const mSel = $("mapMonth");
    WindCast.listMonths().forEach(m => {
      const o = document.createElement("option");
      o.value = m.v; o.textContent = `${m.t} (${m.v})`;
      mSel.appendChild(o);
    });
    mSel.value = 7;

    $("mapBasemap").addEventListener("change", () => {
      setBasemap($("mapBasemap").value);
    });

    $("mapMetric").addEventListener("change", updateHeat);
    ySel.addEventListener("change", () => { updateHeat(); addMarkers(); });
    mSel.addEventListener("change", () => { updateHeat(); addMarkers(); });

    updateHeat();
    addMarkers();
  } catch(err){
    showError(err.message || String(err));
  }
}

document.addEventListener("DOMContentLoaded", boot);