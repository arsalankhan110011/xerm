let chartRank, chartCompare;

function $(id){ return document.getElementById(id); }

function showError(msg){
  const box = $("insError");
  box.textContent = msg;
  box.classList.remove("hidden");
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

function annualByStation(year){
  const out = [];
  for (const st of WindCast.getStations()){
    const rows = window.__windcast_cache.index.byStation.get(st) || [];
    const yr = rows.filter(r => Number(r.date.slice(0,4)) === year);
    const en = yr.map(r => r.energy).filter(Number.isFinite);
    const total = en.reduce((a,b)=>a+b,0);
    out.push({ station: st, annual_kwh: total });
  }
  out.sort((a,b)=>b.annual_kwh-a.annual_kwh);
  return out;
}

function bestMonthsPerStation(year){
  const monthNames = WindCast.listMonths().reduce((acc,x)=>{acc[x.v]=x.t; return acc;},{});
  const rows = [];

  for (const st of WindCast.getStations()){
    const data = window.__windcast_cache.index.byStation.get(st) || [];
    const yr = data.filter(r => Number(r.date.slice(0,4)) === year);
    const byM = new Map();
    yr.forEach(r => {
      const m = Number(r.date.slice(5,7));
      if (!byM.has(m)) byM.set(m, []);
      if (Number.isFinite(r.energy)) byM.get(m).push(r.energy);
    });

    let bestM = null, bestV = -Infinity;
    for (const [m, arr] of byM.entries()){
      const v = arr.reduce((a,b)=>a+b,0);
      if (v > bestV){ bestV = v; bestM = m; }
    }
    rows.push({
      station: st,
      best_month: bestM ? monthNames[bestM] : "—",
      best_month_kwh: Number.isFinite(bestV)? bestV.toFixed(2) : "—"
    });
  }
  return rows;
}

function consistencyScores(year){
  const out = [];
  for (const st of WindCast.getStations()){
    const data = window.__windcast_cache.index.byStation.get(st) || [];
    const yr = data.filter(r => Number(r.date.slice(0,4)) === year);

    const sp = yr.map(r => r.speed).filter(Number.isFinite);
    const meanSp = WindCast.mean(sp);
    const varSp = sp.length ? sp.reduce((a,v)=>a+(v-meanSp)**2,0)/sp.length : NaN;
    const speedScore = Number.isFinite(varSp) ? (1/(1+varSp)) : NaN;

    const dirs = yr.map(r => r.dir).filter(Number.isFinite);
    const { r } = WindCast.circularMeanDeg(dirs);

    out.push({
      station: st,
      speed_consistency: Number.isFinite(speedScore) ? speedScore.toFixed(3) : "—",
      dir_consistency_r: Number.isFinite(r) ? r.toFixed(3) : "—"
    });
  }
  return out;
}

function renderTable(el, rows, cols){
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  cols.forEach(c => {
    const th = document.createElement("th");
    th.textContent = c.label;
    trh.appendChild(th);
  });
  thead.appendChild(trh);

  const tbody = document.createElement("tbody");
  rows.forEach(r => {
    const tr = document.createElement("tr");
    cols.forEach(c => {
      const td = document.createElement("td");
      td.textContent = r[c.key];
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  el.innerHTML = "";
  el.appendChild(table);
}

function updateAll(){
  const year = Number($("insYear").value);
  const ranking = annualByStation(year);

  const labels = ranking.map(r => r.station);
  const vals = ranking.map(r => r.annual_kwh);

  if (!chartRank){
    chartRank = makeChart($("chartRank"), {
      type:"bar",
      data:{ labels, datasets:[{ label:"Annual energy (kWh)", data: vals }] }
    });
  } else {
    chartRank.data.labels = labels;
    chartRank.data.datasets[0].data = vals;
    chartRank.update();
  }

  const a = $("cmpA").value;
  const b = $("cmpB").value;

  function monthlyEnergy(st){
    const data = window.__windcast_cache.index.byStation.get(st) || [];
    const yr = data.filter(r => Number(r.date.slice(0,4)) === year);
    return yr.map(r => ({ label: r.date.slice(0,7), v: Number.isFinite(r.energy)? r.energy : null }));
  }
  const A = monthlyEnergy(a);
  const B = monthlyEnergy(b);

  if (!chartCompare){
    chartCompare = makeChart($("chartCompare"), {
      type:"line",
      data:{
        labels: A.map(x=>x.label),
        datasets:[
          { label: `${a} (kWh)`, data: A.map(x=>x.v), tension:0.25, pointRadius:0 },
          { label: `${b} (kWh)`, data: B.map(x=>x.v), tension:0.25, pointRadius:0 },
        ]
      }
    });
  } else {
    chartCompare.data.labels = A.map(x=>x.label);
    chartCompare.data.datasets[0].label = `${a} (kWh)`;
    chartCompare.data.datasets[0].data = A.map(x=>x.v);
    chartCompare.data.datasets[1].label = `${b} (kWh)`;
    chartCompare.data.datasets[1].data = B.map(x=>x.v);
    chartCompare.update();
  }

  renderTable($("bestMonthsTable"), bestMonthsPerStation(year), [
    { key:"station", label:"Station" },
    { key:"best_month", label:"Best month" },
    { key:"best_month_kwh", label:"Energy (kWh)" }
  ]);

  renderTable($("consistencyTable"), consistencyScores(year), [
    { key:"station", label:"Station" },
    { key:"speed_consistency", label:"Speed consistency" },
    { key:"dir_consistency_r", label:"Direction consistency (r)" }
  ]);
}

async function boot(){
  try{
    const cache = await WindCast.loadAllData();
    window.__windcast_cache = cache;

    const ys = WindCast.listYears(2014, 2033);
    const ySel = $("insYear");
    ys.forEach(y=>{
      const o=document.createElement("option");
      o.value=y; o.textContent=y;
      ySel.appendChild(o);
    });
    ySel.value = 2028;
    ySel.addEventListener("change", updateAll);

    const stations = WindCast.getStations();
    const aSel = $("cmpA"), bSel = $("cmpB");
    stations.forEach(s=>{
      const o1=document.createElement("option"); o1.value=s; o1.textContent=s;
      const o2=document.createElement("option"); o2.value=s; o2.textContent=s;
      aSel.appendChild(o1); bSel.appendChild(o2);
    });
    aSel.value="Peshawar";
    bSel.value="Chitral";
    aSel.addEventListener("change", updateAll);
    bSel.addEventListener("change", updateAll);

    $("exportCsvBtn").addEventListener("click", () => {
      const year = Number($("insYear").value);
      const ranking = annualByStation(year).map((r,i)=>({
        rank: i+1,
        station: r.station,
        annual_kwh: r.annual_kwh.toFixed(4)
      }));
      const csv = WindCast.toCSV(ranking, ["rank","station","annual_kwh"]);
      const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
      WindCast.downloadBlob(`WindCast_Insights_${year}.csv`, blob);
    });

    updateAll();
  } catch(err){
    showError(err.message || String(err));
  }
}

document.addEventListener("DOMContentLoaded", boot);