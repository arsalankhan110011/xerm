function $(id){ return document.getElementById(id); }

function fmt(x, d=2){
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(d);
}

function makeTable(rows){
  const table = document.createElement("table");
  const tbody = document.createElement("tbody");
  rows.forEach(r => {
    const tr = document.createElement("tr");
    const td1 = document.createElement("td"); td1.textContent = r.k;
    const td2 = document.createElement("td"); td2.textContent = r.v;
    tr.appendChild(td1); tr.appendChild(td2);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function renderReport(p){
  const main = $("main");
  main.innerHTML = `
    <header class="report-header">
      <div class="report-brand">
        <img class="brand-logo" src="./assets/logo.png" alt="WindCast logo" onerror="this.style.display='none'"/>
        <div>
          <div class="report-title">WindCast Report</div>
          <div class="muted small">Wind Energy Forecasting • KPK, Pakistan</div>
        </div>
      </div>
      <div class="report-meta">
        <div><span class="muted">Generated:</span> <span id="repGenerated">—</span></div>
        <div><span class="muted">Location:</span> <span id="repLocation">—</span></div>
        <div><span class="muted">Range:</span> <span id="repRange">—</span></div>
      </div>
    </header>

    <section class="report-section">
      <h2>Requester information</h2>
      <div class="report-grid">
        <div><span class="muted">Name</span><div id="repName">—</div></div>
        <div><span class="muted">Organization</span><div id="repOrg">—</div></div>
        <div><span class="muted">Purpose</span><div id="repPurpose">—</div></div>
      </div>
      <div class="report-notes">
        <span class="muted">Site notes</span>
        <div id="repNotes">—</div>
      </div>
    </section>

    <section class="report-section">
      <h2>Key indicators</h2>
      <div id="repKpiTable" class="table-wrap"></div>
      <p class="muted small">KPIs follow the selected range. Scenario estimate is screening-only.</p>
    </section>

    <section class="report-section">
      <h2>Charts</h2>
      <div class="report-charts">
        <figure class="report-figure">
          <figcaption>Wind speed (m/s)</figcaption>
          <img id="repImgSpeed" alt="Wind speed chart" />
        </figure>
        <figure class="report-figure">
          <figcaption>Wind energy potential (kWh)</figcaption>
          <img id="repImgEnergy" alt="Wind energy chart" />
        </figure>
        <figure class="report-figure">
          <figcaption>Wind direction (deg)</figcaption>
          <img id="repImgDir" alt="Wind direction chart" />
        </figure>
      </div>

      <div class="placeholder-block" style="margin-top:16px">
        <div class="placeholder-title">Map snapshot placeholder</div>
        <div class="placeholder-sub">Optional: add leaflet snapshot export later</div>
      </div>
    </section>

    <section class="report-section">
      <h2>Recommendations & assumptions</h2>
      <div id="repRecs" class="report-recs">—</div>
      <h3>Assumptions</h3>
      <div id="repAssumptions" class="table-wrap"></div>
    </section>

    <section class="report-section">
      <h2>Conclusion</h2>
      <div id="repConclusion">—</div>
      <div class="disclaimer">
        <strong>Disclaimer:</strong> This report is generated from precomputed monthly forecasts and simplified assumptions.
        It is intended for decision support and academic demonstration, not guaranteed production.
      </div>
    </section>

    <footer class="report-footer">
      <button class="btn btn-primary" onclick="window.print()">Print / Save as PDF</button>
      <span class="muted small">Tip: choose “Save as PDF” in the print dialog.</span>
    </footer>
  `;

  $("repGenerated").textContent = new Date(p.generatedAt).toLocaleString();
  $("repLocation").textContent = p.locationLabel + (p.nearestTxt ? ` (Nearest: ${p.nearestTxt})` : "");
  $("repRange").textContent = `${p.startYear}–${p.endYear}`;

  $("repName").textContent = p.requester.name || "—";
  $("repOrg").textContent = p.requester.org || "—";
  $("repPurpose").textContent = p.requester.purpose || "—";
  $("repNotes").textContent = p.requester.notes || "—";

  const k = p.kpis;
  const kpiRows = [
    { k: "Mean wind speed (m/s)", v: fmt(k.meanSpeed,2) },
    { k: "Annual energy baseline (kWh/year)", v: fmt(k.annualEnergy,2) },
    { k: "Dominant direction", v: (Number.isFinite(k.dominantDeg) ? `${k.dominantCompass} (${fmt(k.dominantDeg,0)}°)` : "—") },
    { k: "Direction concentration (r)", v: fmt(k.dirConcentration,3) },
    { k: "Feasibility badge", v: k.feasibility || "—" },
    { k: "Scenario estimated annual kWh", v: fmt(k.scenarioAnnualKwh,2) }
  ];

  const wrap = $("repKpiTable");
  wrap.innerHTML = "";
  wrap.appendChild(makeTable(kpiRows));

  if (p.charts.speedPng) $("repImgSpeed").src = p.charts.speedPng;
  if (p.charts.energyPng) $("repImgEnergy").src = p.charts.energyPng;
  if (p.charts.dirPng) $("repImgDir").src = p.charts.dirPng;

  $("repAssumptions").innerHTML = "";
  $("repAssumptions").appendChild(makeTable([
    { k:"Installation type", v: p.controls.installType },
    { k:"Turbine rated capacity (kW)", v: String(p.controls.turbineSizeKw) },
    { k:"Hub height (m)", v: String(p.controls.hubHeight) },
    { k:"Losses (%)", v: String(p.controls.losses) },
    { k:"Capacity factor class", v: p.controls.capacityFactor },
  ]));

  $("repConclusion").innerHTML = `
    Based on the selected range (${p.startYear}–${p.endYear}), the site screening indicates a <strong>${k.feasibility}</strong>
    feasibility signal. For deployment decisions, confirm with site measurements, terrain assessment, and detailed design.
  `;

  // recommendations load
  WindCast.loadAllData().then(cache => {
    const baseStation = p.recommendationBaseStation;
    const year = p.recYear;
    const recs = cache.recs.filter(r => r.station === baseStation && Number(r.year) === Number(year));
    const r0 = recs[0];

    const recBox = $("repRecs");
    if (!r0){
      recBox.textContent = `No recommendation found for ${baseStation} (${year}).`;
      return;
    }

    const label = (p.stationMode === "station")
      ? `${baseStation} • ${year}`
      : `Estimated location • using nearest station: ${baseStation} • ${year}`;

    recBox.innerHTML = `
      <div class="muted small">${label}</div>
      <div style="margin-top:10px">
        <strong>Turbine type:</strong> ${r0.turbine_type}<br/>
        <strong>Capacity:</strong> ${r0.capacity_text ?? `${r0.capacity_kw} kW`}<br/>
        <strong>Height:</strong> ${r0.height_text ?? `${r0.height_m} m`}<br/>
        <strong>Facing:</strong> ${r0.facing}<br/>
        <strong>Hybrid advice:</strong> ${r0.hybrid ?? "—"}<br/>
        <strong>Notes:</strong> ${r0.notes ?? "—"}
      </div>
    `;
  });
}

function boot(){
  const raw = localStorage.getItem("windcast_report_payload") || sessionStorage.getItem("windcast_report_payload");
  const empty = $("reportEmpty");

  if (!raw){
    empty.classList.remove("hidden");
    $("tryLoadLast").addEventListener("click", () => {
      const raw2 = localStorage.getItem("windcast_report_payload") || sessionStorage.getItem("windcast_report_payload");
      if (!raw2) return;
      empty.classList.add("hidden");
      renderReport(JSON.parse(raw2));
    });
    return;
  }

  empty.classList.add("hidden");
  renderReport(JSON.parse(raw));
}

document.addEventListener("DOMContentLoaded", boot);
