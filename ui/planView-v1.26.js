function esc(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
export function renderPlanHtml(plan) {
    if (!plan.feasible) {
        return `<section class="panel error-panel"><h2>Brak wykonalnego planu</h2><p>${esc(plan.reason ?? 'Nie udało się ułożyć trasy.')}</p></section>`;
    }
    const transferByOrder = new Map(plan.transfers.map((t) => [t.afterFarmerOrder, t]));
    const rows = [];
    for (const row of plan.rows) {
        const parts = row.parts.map((part) => {
            if (part.targetCompartment !== part.currentCompartment) {
                return `<span class="assignment staging"><strong>${part.liters} l</strong> — Docelowo ${part.targetCompartment} <small>(teraz ${part.currentCompartment})</small></span>`;
            }
            return `<span class="assignment"><strong>${part.liters} l</strong> — komora ${part.targetCompartment}</span>`;
        }).join('');
        rows.push(`<div class="plan-row">
      <div class="plan-order">${row.farmer.order}</div>
      <div class="plan-farmer"><strong>${esc(row.farmer.name)}</strong><small>${row.farmer.forecastLiters} l · przyczepa: ${row.farmer.trailerAccess ? 'TAK' : 'NIE'}</small></div>
      <div class="plan-assignment">${parts}</div>
    </div>`);
        const transfer = transferByOrder.get(row.farmer.order);
        if (transfer) {
            rows.push(`<div class="transfer-event"><strong>PRZEPOMPOWANIE po gospodarzu ${transfer.afterFarmerOrder}</strong>${transfer.pairs.map((p) => `<span>${p.from} → ${p.to} · ${p.liters} l</span>`).join('')}</div>`);
        }
    }
    const summaries = plan.summaries.map((s) => `
    <div class="tank-card">
      <div class="tank-title">Komora ${s.compartment}</div>
      <div class="tank-value">${s.plannedLiters} / ${s.usableCapacityLiters} l</div>
      <div class="tank-free">wolne roboczo: <strong>${s.freeLiters} l</strong></div>
    </div>`).join('');
    return `<section class="panel"><div class="section-heading"><div><h2>Gotowy plan kursu</h2><p>Sprawdź plan przed wyjazdem.</p></div></div><div class="plan-list">${rows.join('')}</div><h3>Stan końcowy komór</h3><div class="tank-grid">${summaries}</div></section>`;
}

export function renderDriverModeHtml(plan) {
    if (!plan.feasible)
        return '';
    const transferByOrder = new Map(plan.transfers.map((t) => [t.afterFarmerOrder, t]));
    const rows = [];
    for (const row of plan.rows) {
        const parts = row.parts.map((part) => {
            if (part.targetCompartment !== part.currentCompartment) {
                return `<div class="driver-assignment staging"><strong>${part.liters} l</strong><span>teraz ${part.currentCompartment} → docelowo ${part.targetCompartment}</span></div>`;
            }
            return `<div class="driver-assignment"><strong>${part.liters} l</strong><span>komora ${part.targetCompartment}</span></div>`;
        }).join('');
        rows.push(`<section class="driver-stop">
          <div class="driver-stop-number">${row.farmer.order}</div>
          <div class="driver-stop-data">
            <div class="driver-stop-liters">${row.farmer.forecastLiters.toLocaleString('pl-PL')} l</div>
            <div class="driver-assignments">${parts}</div>
          </div>
        </section>`);
        const transfer = transferByOrder.get(row.farmer.order);
        if (transfer) {
            rows.push(`<section class="driver-transfer">
              <div class="driver-transfer-title">PRZEPOMPOWANIE PO ${transfer.afterFarmerOrder}</div>
              <div class="driver-transfer-pairs">${transfer.pairs.map((p) => `<strong>${p.from} → ${p.to} · ${p.liters} l</strong>`).join('')}</div>
            </section>`);
        }
    }
    return `<div id="driver-mode" class="driver-mode" role="dialog" aria-modal="true" aria-label="Tryb kierowcy">
      <header class="driver-header">
        <div><span>Milk Route Planner</span><h2>Tryb kierowcy</h2></div>
        <button type="button" id="exit-driver-mode" class="driver-exit">Wróć do edycji</button>
      </header>
      <main class="driver-route">${rows.join('')}</main>
    </div>`;
}
