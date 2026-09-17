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
