let chartRank, chartCompare;

function $(id){ return document.getElementById(id); }

function formatKwh(value, digits = 2){
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(digits)} kWh`;
}

function sum(values){
  return values.filter(Number.isFinite).reduce((a,b)=>a+b,0);
}

function showError(msg){
  const box = $("insError");
  box.textContent = msg;
  box.classList.remove("hidden");
}

function setText(id, value){
  const el = $(id);
  if (el) el.textContent = value;
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
    const total = sum(yr.map(r => r.energy));
    out.push({ station: st, annual_kwh: total });
  }
  out.sort((a,b)=>b.annual_kwh-a.annual_kwh);
  return out;
}

function bestMonthsPerStation(year){
  const monthNames = WindCast.listMonths().reduce((acc, x) => {
    acc[x.v] = x.t;
    return acc;
  }, {});
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

    let bestM = null;
    let bestV = -Infinity;
    for (const [m, arr] of byM.entries()){
      const v = sum(arr);
      if (v > bestV){
        bestV = v;
        bestM = m;
      }
    }

    rows.push({
      station: st,
      best_month: bestM ? monthNames[bestM] : "-",
      best_month_kwh: Number.isFinite(bestV) ? bestV : NaN
    });
  }

  rows.sort((a,b)=>(b.best_month_kwh || -Infinity) - (a.best_month_kwh || -Infinity));
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
    const overall = Number.isFinite(speedScore) && Number.isFinite(r) ? ((speedScore + r) / 2) : NaN;

    out.push({
      station: st,
      speed_consistency: speedScore,
      dir_consistency_r: r,
      overall_consistency: overall
    });
  }

  out.sort((a,b)=>(b.overall_consistency || -Infinity) - (a.overall_consistency || -Infinity));
  return out;
}

function monthlyEnergy(station, year){
  const data = window.__windcast_cache.index.byStation.get(station) || [];
  const yr = data.filter(r => Number(r.date.slice(0,4)) === year);
  return yr.map(r => ({
    label: r.date.slice(0,7),
    month: Number(r.date.slice(5,7)),
    v: Number.isFinite(r.energy) ? r.energy : null
  }));
}

function overallPeakMonth(year){
  const monthNames = WindCast.listMonths().reduce((acc, x) => {
    acc[x.v] = x.t;
    return acc;
  }, {});
  const totals = new Map();

  for (const st of WindCast.getStations()){
    const rows = window.__windcast_cache.index.byStation.get(st) || [];
    rows
      .filter(r => Number(r.date.slice(0,4)) === year && Number.isFinite(r.energy))
      .forEach(r => {
        const month = Number(r.date.slice(5,7));
        totals.set(month, (totals.get(month) || 0) + r.energy);
      });
  }

  let bestMonth = null;
  let bestValue = -Infinity;
  for (const [month, total] of totals.entries()){
    if (total > bestValue){
      bestMonth = month;
      bestValue = total;
    }
  }

  return {
    month: bestMonth ? monthNames[bestMonth] : "-",
    total_kwh: Number.isFinite(bestValue) ? bestValue : NaN
  };
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
      td.textContent = c.format ? c.format(r[c.key], r) : r[c.key];
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
  const bestMonths = bestMonthsPerStation(year);
  const consistency = consistencyScores(year);

  const labels = ranking.map(r => r.station);
  const vals = ranking.map(r => r.annual_kwh);
  const leader = ranking[0];
  const runnerUp = ranking[1];
  const annualTotal = sum(vals);
  const peakMonth = overallPeakMonth(year);
  const mostConsistent = consistency[0];

  setText("summaryLeaderStation", leader?.station || "-");
  setText("summaryLeaderMeta", leader ? `${formatKwh(leader.annual_kwh)} in ${year}` : "-");
  setText("summaryGapValue", leader && runnerUp ? formatKwh(leader.annual_kwh - runnerUp.annual_kwh) : "-");
  setText("summaryGapMeta", leader && runnerUp ? `${leader.station} ahead of ${runnerUp.station}` : "-");
  setText("summaryPeakMonth", peakMonth.month);
  setText("summaryPeakMeta", Number.isFinite(peakMonth.total_kwh) ? `${formatKwh(peakMonth.total_kwh)} across all stations` : "-");
  setText("summaryConsistencyStation", mostConsistent?.station || "-");
  setText("summaryConsistencyMeta", mostConsistent ? `Overall score ${mostConsistent.overall_consistency.toFixed(3)}` : "-");

  setText("rankLeaderStat", leader ? `${leader.station} (${formatKwh(leader.annual_kwh)})` : "-");
  setText("rankGapStat", leader && runnerUp ? formatKwh(leader.annual_kwh - runnerUp.annual_kwh) : "-");
  setText("rankTotalStat", formatKwh(annualTotal));

  if (!chartRank){
    chartRank = makeChart($("chartRank"), {
      type:"bar",
      data:{
        labels,
        datasets:[{
          label:"Annual energy (kWh)",
          data: vals,
          backgroundColor: vals.map((_, i) => i === 0 ? "rgba(42,111,187,0.82)" : "rgba(122,190,238,0.72)"),
          borderColor: vals.map((_, i) => i === 0 ? "rgba(13,59,102,1)" : "rgba(84,160,219,1)"),
          borderWidth: 1.2,
          borderRadius: 8
        }]
      },
      options:{
        scales:{
          x:{ ticks:{ maxRotation: 28, minRotation: 28 } },
          y:{ beginAtZero: true }
        }
      }
    });
  } else {
    chartRank.data.labels = labels;
    chartRank.data.datasets[0].data = vals;
    chartRank.data.datasets[0].backgroundColor = vals.map((_, i) => i === 0 ? "rgba(42,111,187,0.82)" : "rgba(122,190,238,0.72)");
    chartRank.data.datasets[0].borderColor = vals.map((_, i) => i === 0 ? "rgba(13,59,102,1)" : "rgba(84,160,219,1)");
    chartRank.update();
  }

  const a = $("cmpA").value;
  const b = $("cmpB").value;
  const A = monthlyEnergy(a, year);
  const B = monthlyEnergy(b, year);
  const totalA = sum(A.map(x=>x.v));
  const totalB = sum(B.map(x=>x.v));
  const winner = totalA === totalB ? "Tie" : (totalA > totalB ? a : b);
  const gap = Math.abs(totalA - totalB);
  const peakA = A.reduce((best, row) => (row.v ?? -Infinity) > (best.v ?? -Infinity) ? row : best, { v: -Infinity, label: "-" });
  const peakB = B.reduce((best, row) => (row.v ?? -Infinity) > (best.v ?? -Infinity) ? row : best, { v: -Infinity, label: "-" });
  const strongerPeak = (peakA.v ?? -Infinity) >= (peakB.v ?? -Infinity)
    ? { station: a, row: peakA }
    : { station: b, row: peakB };

  setText("compareWinnerStat", winner === "Tie" ? `Tie (${formatKwh(totalA)})` : `${winner} (${formatKwh(Math.max(totalA, totalB))})`);
  setText("comparePeakStat", Number.isFinite(strongerPeak.row.v) ? `${strongerPeak.station} in ${strongerPeak.row.label}` : "-");
  setText("compareGapStat", formatKwh(gap));
  setText(
    "compareNarrative",
    winner === "Tie"
      ? `${a} and ${b} finish the year level on total energy, so the monthly pattern is the main difference.`
      : `${winner} finishes ${formatKwh(gap)} ahead. ${strongerPeak.station} also records the strongest single month in ${strongerPeak.row.label}.`
  );

  if (!chartCompare){
    chartCompare = makeChart($("chartCompare"), {
      type:"line",
      data:{
        labels: A.map(x=>x.label),
        datasets:[
          {
            label: `${a} (kWh)`,
            data: A.map(x=>x.v),
            tension:0.28,
            pointRadius:0,
            borderColor:"rgba(61,156,229,1)",
            backgroundColor:"rgba(61,156,229,0.14)",
            borderWidth:3
          },
          {
            label: `${b} (kWh)`,
            data: B.map(x=>x.v),
            tension:0.28,
            pointRadius:0,
            borderColor:"rgba(255,96,130,1)",
            backgroundColor:"rgba(255,96,130,0.12)",
            borderWidth:3
          }
        ]
      },
      options:{
        scales:{ y:{ beginAtZero: true } }
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

  renderTable($("bestMonthsTable"), bestMonths, [
    { key:"station", label:"Station" },
    { key:"best_month", label:"Best month" },
    { key:"best_month_kwh", label:"Energy (kWh)", format: (v) => formatKwh(v) }
  ]);

  renderTable($("consistencyTable"), consistency, [
    { key:"station", label:"Station" },
    { key:"speed_consistency", label:"Speed consistency", format: (v) => Number.isFinite(v) ? v.toFixed(3) : "-" },
    { key:"dir_consistency_r", label:"Direction consistency (r)", format: (v) => Number.isFinite(v) ? v.toFixed(3) : "-" },
    { key:"overall_consistency", label:"Overall", format: (v) => Number.isFinite(v) ? v.toFixed(3) : "-" }
  ]);
}

async function boot(){
  try{
    const cache = await WindCast.loadAllData();
    window.__windcast_cache = cache;

    const ys = WindCast.listYears(2014, 2033);
    const ySel = $("insYear");
    ys.forEach(y => {
      const o = document.createElement("option");
      o.value = y;
      o.textContent = y;
      ySel.appendChild(o);
    });
    ySel.value = 2028;
    ySel.addEventListener("change", updateAll);

    const stations = WindCast.getStations();
    const aSel = $("cmpA");
    const bSel = $("cmpB");
    stations.forEach(s => {
      const o1 = document.createElement("option");
      o1.value = s;
      o1.textContent = s;
      const o2 = document.createElement("option");
      o2.value = s;
      o2.textContent = s;
      aSel.appendChild(o1);
      bSel.appendChild(o2);
    });
    aSel.value = "Peshawar";
    bSel.value = "Chitral";
    aSel.addEventListener("change", updateAll);
    bSel.addEventListener("change", updateAll);

    $("exportCsvBtn").addEventListener("click", () => {
      const selectedYear = Number($("insYear").value);
      const rows = annualByStation(selectedYear).map((r, i) => ({
        rank: i + 1,
        station: r.station,
        annual_kwh: r.annual_kwh.toFixed(4)
      }));
      const csv = WindCast.toCSV(rows, ["rank","station","annual_kwh"]);
      const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
      WindCast.downloadBlob(`WindCast_Insights_${selectedYear}.csv`, blob);
    });

    updateAll();
  } catch(err){
    showError(err.message || String(err));
  }
}

document.addEventListener("DOMContentLoaded", boot);
