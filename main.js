import { createVehicleProfile } from './domain/models.js';
import { planRoute } from './domain/planner.js';
import { VehicleStore } from './storage/vehicleStore.js';
import { renderPlanHtml } from './ui/planView.js';
import { parsePreferredTransferOrder } from './ui/routeOptions.js';
import { addFarmerDraft, removeFarmerDraft } from './ui/farmerRows.js';
const store = new VehicleStore(localStorage);
const app = document.querySelector('#app');
if (!app)
    throw new Error('Missing #app');
let farmerRowCount = 10;
function profileOptions(kind) {
    return store.loadAll().filter((p) => p.kind === kind)
        .map((p) => `<option value="${p.registration}">${p.registration} · ${p.capacitiesLiters.join(' / ')} l</option>`)
        .join('');
}
function vehicleFields(prefix, title, defaults) {
    return `<div class="vehicle-card">
    <h3>${title}</h3>
    <label>Numer rejestracyjny<input id="${prefix}-registration" placeholder="np. BZA 12345"></label>
    <div class="capacity-row">
      ${defaults.map((v, i) => `<label>Komora ${prefix === 'truck' ? i + 1 : i + 4}<input id="${prefix}-c${i}" type="number" min="66" value="${v}"><span>l</span></label>`).join('')}
    </div>
    <button class="secondary" data-save-profile="${prefix}">Zapisz pojazd</button>
  </div>`;
}
function farmerRows() {
    return Array.from({ length: farmerRowCount }, (_, i) => `<tr>
    <td class="lp-cell" data-label="LP">${i + 1}</td>
    <td data-label="Gospodarz"><input data-farmer-name="${i}" placeholder="Gospodarz ${i + 1}"></td>
    <td data-label="Prognoza"><input data-farmer-liters="${i}" type="number" min="1" placeholder="litry"></td>
    <td data-label="Przyczepa" data-trailer-column><label class="switch-label"><input data-farmer-trailer="${i}" type="checkbox"><span>TAK</span></label></td>
    <td class="row-actions" data-label=""><button type="button" class="remove-row" data-remove-farmer="${i}" aria-label="Usuń gospodarza ${i + 1}">Usuń</button></td>
  </tr>`).join('');
}
function render() {
    app.innerHTML = `
  <header class="hero"><div><p class="eyebrow">Milk Route Planner</p><h1>Planowanie komór mleczarki</h1><p>Cały plan przed wyjazdem · komory 1–6 · maksymalnie jedno przepompowanie</p><div id="connection-status" class="connection-status">Sprawdzam połączenie…</div></div><div class="reserve-badge">65 l<br><small>stałego zapasu / komorę</small></div></header>

  <main>
    <section class="panel">
      <div class="section-heading"><div><h2>1. Pojazdy i pojemności</h2><p>Wybierz zapisany pojazd albo wpisz pojemności ręcznie.</p></div></div>
      <div class="saved-grid">
        <label>Zapisane auto<select id="saved-truck"><option value="">— wybierz —</option>${profileOptions('truck')}</select></label>
        <label>Zapisana przyczepa<select id="saved-trailer"><option value="">— wybierz —</option>${profileOptions('trailer')}</select></label>
      </div>
      <div class="vehicle-grid">
        ${vehicleFields('truck', 'Auto · komory 1–3', [5300, 5300, 5300])}
        <div id="trailer-wrap">${vehicleFields('trailer', 'Przyczepa · komory 4–6', [5100, 5000, 6500])}</div>
      </div>
      <label class="trailer-toggle"><input id="use-trailer" type="checkbox" checked> Jadę z przyczepą</label>
    </section>

    <section class="panel">
      <div class="section-heading"><div><h2>2. Gospodarze</h2><p>Kolejność jest stała. Wersja offline — wpisz dane ręcznie.</p></div><div class="farmer-toolbar"><button id="add-farmer" class="secondary">+ Dodaj wiersz</button></div></div>
      <div class="table-scroll"><table id="farmer-table" class="farmer-table"><thead><tr><th>LP</th><th>Gospodarz</th><th>Prognoza</th><th data-trailer-column>Wjazd przyczepą</th><th></th></tr></thead><tbody id="farmer-body">${farmerRows()}</tbody></table></div>
      <div class="route-options">
        <label>Preferowane przepompowanie po gospodarzu
          <input id="preferred-transfer-order" type="number" min="1" placeholder="auto">
          <small>Zostaw puste, a aplikacja spróbuje wybrać naturalny punkt automatycznie.</small>
        </label>
      </div>
      <div class="actions"><button id="calculate" class="primary">Policz cały plan</button></div>
    </section>

    <div id="plan-output"></div>
  </main>`;
    bindEvents();
}
function readProfile(prefix) {
    const registration = (document.querySelector(`#${prefix}-registration`)?.value ?? '').trim() || (prefix === 'truck' ? 'AUTO' : 'PRZYCZEPA');
    const capacities = [0, 1, 2].map((i) => Number(document.querySelector(`#${prefix}-c${i}`)?.value));
    return createVehicleProfile(prefix, registration, capacities);
}
function fillProfile(prefix, profile) {
    const reg = document.querySelector(`#${prefix}-registration`);
    if (reg)
        reg.value = profile.registration;
    profile.capacitiesLiters.forEach((capacity, i) => {
        const input = document.querySelector(`#${prefix}-c${i}`);
        if (input)
            input.value = String(capacity);
    });
}
function readFarmerDrafts() {
    return Array.from({ length: farmerRowCount }, (_, i) => ({
        name: document.querySelector(`[data-farmer-name="${i}"]`)?.value ?? '',
        liters: document.querySelector(`[data-farmer-liters="${i}"]`)?.value ?? '',
        trailerAccess: document.querySelector(`[data-farmer-trailer="${i}"]`)?.checked ?? false,
    }));
}
function writeFarmerDrafts(rows) {
    farmerRowCount = rows.length;
    const body = document.querySelector('#farmer-body');
    if (!body)
        return;
    body.innerHTML = farmerRows();
    rows.forEach((row, i) => {
        const name = document.querySelector(`[data-farmer-name="${i}"]`);
        const liters = document.querySelector(`[data-farmer-liters="${i}"]`);
        const trailer = document.querySelector(`[data-farmer-trailer="${i}"]`);
        if (name)
            name.value = row.name;
        if (liters)
            liters.value = row.liters;
        if (trailer)
            trailer.checked = row.trailerAccess;
    });
    const trailerEnabled = document.querySelector('#use-trailer')?.checked ?? false;
    syncTrailerAvailability(trailerEnabled);
}
function syncTrailerAvailability(enabled) {
    const wrap = document.querySelector('#trailer-wrap');
    if (wrap)
        wrap.classList.toggle('disabled', !enabled);
    const savedTrailer = document.querySelector('#saved-trailer');
    if (savedTrailer)
        savedTrailer.disabled = !enabled;
    const farmerTable = document.querySelector('#farmer-table');
    if (farmerTable)
        farmerTable.classList.toggle('trailer-disabled', !enabled);
    document.querySelectorAll('[data-farmer-trailer]').forEach((checkbox) => {
        checkbox.disabled = !enabled;
    });
}
function readFarmers(trailerEnabled) {
    const farmers = [];
    readFarmerDrafts().forEach((draft, i) => {
        const forecastLiters = Number(draft.liters);
        if (!forecastLiters)
            return;
        farmers.push({
            order: farmers.length + 1,
            name: draft.name.trim() || `Gospodarz ${i + 1}`,
            forecastLiters,
            trailerAccess: trailerEnabled ? draft.trailerAccess : false,
        });
    });
    return farmers;
}
function updateConnectionStatus() {
    const el = document.querySelector('#connection-status');
    if (!el)
        return;
    const online = navigator.onLine;
    el.textContent = online ? 'Aplikacja gotowa · działa także offline' : 'Tryb offline · planer działa lokalnie';
    el.classList.toggle('offline', !online);
}
function bindEvents() {
    document.querySelector('#use-trailer')?.addEventListener('change', (event) => {
        syncTrailerAvailability(event.target.checked);
    });
    document.querySelector('#saved-truck')?.addEventListener('change', (event) => {
        const reg = event.target.value;
        const profile = store.loadAll().find((p) => p.kind === 'truck' && p.registration === reg);
        if (profile)
            fillProfile('truck', profile);
    });
    document.querySelector('#saved-trailer')?.addEventListener('change', (event) => {
        const reg = event.target.value;
        const profile = store.loadAll().find((p) => p.kind === 'trailer' && p.registration === reg);
        if (profile)
            fillProfile('trailer', profile);
    });
    document.querySelectorAll('[data-save-profile]').forEach((button) => button.addEventListener('click', () => {
        const prefix = button.dataset.saveProfile;
        try {
            store.save(readProfile(prefix));
            render();
        }
        catch (error) {
            alert(error instanceof Error ? error.message : String(error));
        }
    }));
    document.querySelector('#add-farmer')?.addEventListener('click', () => {
        writeFarmerDrafts(addFarmerDraft(readFarmerDrafts()));
    });
    document.querySelector('#farmer-body')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-remove-farmer]');
        if (!button)
            return;
        const index = Number(button.dataset.removeFarmer);
        writeFarmerDrafts(removeFarmerDraft(readFarmerDrafts(), index));
    });
    document.querySelector('#calculate')?.addEventListener('click', () => {
        const output = document.querySelector('#plan-output');
        if (!output)
            return;
        try {
            const useTrailer = document.querySelector('#use-trailer')?.checked ?? false;
            const farmers = readFarmers(useTrailer);
            if (farmers.length === 0)
                throw new Error('Wpisz przynajmniej jednego gospodarza.');
            const truck = readProfile('truck');
            const trailer = useTrailer ? readProfile('trailer') : undefined;
            const preferredTransferAfterFarmerOrder = parsePreferredTransferOrder(document.querySelector('#preferred-transfer-order')?.value ?? '', farmers.length);
            const plan = planRoute({ truck, trailer, farmers, preferredTransferAfterFarmerOrder });
            output.innerHTML = renderPlanHtml(plan);
            output.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        catch (error) {
            output.innerHTML = `<section class="panel error-panel"><h2>Sprawdź dane</h2><p>${error instanceof Error ? error.message : String(error)}</p></section>`;
        }
    });
    syncTrailerAvailability(document.querySelector('#use-trailer')?.checked ?? false);
}
render();
updateConnectionStatus();
window.addEventListener('offline', updateConnectionStatus);
window.addEventListener('online', updateConnectionStatus);
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}
