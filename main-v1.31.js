import { createVehicleProfile } from './domain/models.js';
import { planRoute } from './domain/planner-v1.31.js';
import { VehicleStore } from './storage/vehicleStore.js';
import { renderPlanHtml, renderDriverModeHtml } from './ui/planView-v1.26.js';
import { parsePreferredTransferOrder } from './ui/routeOptions.js';
import { addFarmerDraft, removeFarmerDraft } from './ui/farmerRows.js';
const store = new VehicleStore(localStorage);
const app = document.querySelector('#app');
if (!app)
    throw new Error('Missing #app');
let farmerRowCount = 0;
let hasCalculatedPlan = false;
let lastCalculatedPlan = null;
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
    <td data-label="Prognoza"><input data-farmer-liters="${i}" type="number" min="1" inputmode="numeric" enterkeyhint="${i < farmerRowCount - 1 ? 'next' : 'done'}" placeholder="litry"></td>
    <td data-label="Przyczepa" data-trailer-column><label class="switch-label"><input data-farmer-trailer="${i}" type="checkbox"><span>TAK</span></label></td>
    <td class="row-actions" data-label=""><button type="button" class="remove-row" data-remove-farmer="${i}" aria-label="Usuń gospodarza ${i + 1}">Usuń</button></td>
  </tr>`).join('');
}
function render() {
    app.innerHTML = `
  <header class="hero"><div><p class="eyebrow">Milk Route Planner <span class="version-badge">v1.31</span></p><h1>Planowanie komór mleczarki</h1><p>Cały plan przed wyjazdem · komory 1–6 · maksymalnie jedno przepompowanie</p><div id="connection-status" class="connection-status">Sprawdzam połączenie…</div></div><div class="reserve-badge">65 l<br><small>stałego zapasu / komorę</small></div></header>

  <main>
    <section class="panel">
      <div class="section-heading"><div><h2>1. Pojazdy i pojemności</h2><p>Wybierz zapisany pojazd albo wpisz pojemności ręcznie.</p></div></div>
      <div class="saved-grid">
        <div class="saved-profile-control">
          <label>Zapisane auto<select id="saved-truck"><option value="">— wybierz —</option>${profileOptions('truck')}</select></label>
          <button type="button" class="delete-profile" data-delete-profile="truck" disabled>Usuń zapisane auto</button>
        </div>
        <div class="saved-profile-control">
          <label>Zapisana przyczepa<select id="saved-trailer"><option value="">— wybierz —</option>${profileOptions('trailer')}</select></label>
          <button type="button" class="delete-profile" data-delete-profile="trailer" disabled>Usuń zapisaną przyczepę</button>
        </div>
      </div>
      <div class="vehicle-grid">
        ${vehicleFields('truck', 'Auto · komory 1–3', [5300, 5300, 5300])}
        <div id="trailer-wrap">${vehicleFields('trailer', 'Przyczepa · komory 4–6', [5100, 5000, 6500])}</div>
      </div>
      <label class="trailer-toggle"><input id="use-trailer" type="checkbox" checked> Jadę z przyczepą</label>
    </section>

    <section class="panel">
      <div class="section-heading"><div><h2>2. Gospodarze</h2><p>Kolejność jest stała. Wersja offline — wpisz dane ręcznie.</p></div><div class="farmer-toolbar" data-farmer-list-content hidden><button id="add-farmer" class="secondary add-farmer-button">+ Dodaj wiersz</button></div></div>
      <div class="trailer-access-note"><strong>Przyczepa TAK</strong> = możliwy wjazd z przyczepą na dane gospodarstwo.</div>
      <div class="farmer-count-control">
        <label>Liczba gospodarzy na trasie
          <input id="farmer-count" type="number" min="1" max="60" inputmode="numeric" placeholder="np. 24" value="${farmerRowCount || ''}">
        </label>
        <button id="set-farmer-count" type="button" class="secondary">Utwórz listę</button>
        <small>Wpisz liczbę gospodarzy, a aplikacja przygotuje dokładnie tyle wierszy.</small>
      </div>
      <div class="table-scroll" data-farmer-list-content hidden><table id="farmer-table" class="farmer-table"><thead><tr><th>LP</th><th>Gospodarz</th><th>Prognoza</th><th data-trailer-column>Wjazd przyczepą</th><th></th></tr></thead><tbody id="farmer-body">${farmerRows()}</tbody></table></div>
      <div class="route-summary" data-farmer-list-content hidden>
        <div><span>Gospodarze</span><strong id="summary-farmers">0</strong></div>
        <div><span>Suma prognoz</span><strong id="summary-liters">0 l</strong></div>
        <div data-summary-trailer><span>Wjazd przyczepą</span><strong id="summary-trailer">0</strong></div>
        <button id="clear-route" type="button" class="clear-route-button">Wyczyść trasę</button>
      </div>
      <div class="route-options" data-farmer-list-content hidden>
        <label>Preferowane przepompowanie po gospodarzu
          <input id="preferred-transfer-order" type="number" min="1" placeholder="auto">
          <small>Zostaw puste, a aplikacja spróbuje wybrać naturalny punkt automatycznie.</small>
        </label>
      </div>
      <div class="actions" data-farmer-list-content hidden><button id="calculate" class="primary">Policz cały plan</button></div>
    </section>

    <div id="plan-output"></div>
  </main>
  <div id="confirm-modal" class="confirm-modal" hidden aria-hidden="true">
    <div class="confirm-backdrop" data-confirm-cancel></div>
    <div class="confirm-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <div class="confirm-icon">!</div>
      <div class="confirm-copy">
        <h3 id="confirm-title">Potwierdź</h3>
        <p id="confirm-message"></p>
      </div>
      <div class="confirm-actions">
        <button type="button" class="secondary" data-confirm-cancel>Anuluj</button>
        <button type="button" class="danger-button" id="confirm-accept">Usuń</button>
      </div>
    </div>
  </div>`;
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
function syncDeleteProfileButtons() {
    document.querySelectorAll('[data-delete-profile]').forEach((button) => {
        const kind = button.dataset.deleteProfile;
        const select = document.querySelector(`#saved-${kind}`);
        button.disabled = !select?.value;
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
    const countInput = document.querySelector('#farmer-count');
    if (countInput)
        countInput.value = farmerRowCount > 0 ? String(farmerRowCount) : '';
    syncFarmerListVisibility();
    syncTrailerAvailability(trailerEnabled);
    updateRouteSummary();
}
function updateRouteSummary() {
    const drafts = readFarmerDrafts();
    const liters = drafts.reduce((sum, row) => sum + (Number(row.liters) || 0), 0);
    const trailerCount = drafts.filter((row) => row.trailerAccess).length;
    const farmersEl = document.querySelector('#summary-farmers');
    const litersEl = document.querySelector('#summary-liters');
    const trailerEl = document.querySelector('#summary-trailer');
    const trailerSummary = document.querySelector('[data-summary-trailer]');
    if (farmersEl)
        farmersEl.textContent = String(farmerRowCount);
    if (litersEl)
        litersEl.textContent = `${liters.toLocaleString('pl-PL')} l`;
    if (trailerEl)
        trailerEl.textContent = String(trailerCount);
    if (trailerSummary)
        trailerSummary.hidden = !(document.querySelector('#use-trailer')?.checked ?? false);
    document.querySelectorAll('[data-farmer-liters]').forEach((input) => {
        const row = input.closest('tr');
        row?.classList.toggle('large-pickup', (Number(input.value) || 0) >= 4000);
    });
}
function focusFarmerFromError(message) {
    const match = String(message).match(/gospodarz(?:u)?\s+(\d+)/i);
    if (!match)
        return false;
    const index = Number(match[1]) - 1;
    const input = document.querySelector(`[data-farmer-liters="${index}"]`) || document.querySelector(`[data-farmer-name="${index}"]`);
    const row = input?.closest('tr');
    if (!input)
        return false;
    row?.classList.add('farmer-error-focus');
    input.focus({ preventScroll: true });
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => row?.classList.remove('farmer-error-focus'), 1800);
    return true;
}
function syncFarmerListVisibility() {
    const visible = farmerRowCount > 0;
    document.querySelectorAll('[data-farmer-list-content]').forEach((element) => {
        element.hidden = !visible;
    });
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
function animateActionButton(button, className = 'action-pulse', duration = 550) {
    if (!button)
        return;
    button.classList.remove(className);
    void button.offsetWidth;
    button.classList.add(className);
    window.setTimeout(() => button.classList.remove(className), duration);
}
function showConfirmDialog({ title = 'Potwierdź', message, confirmText = 'Usuń' }) {
    const modal = document.querySelector('#confirm-modal');
    const titleEl = document.querySelector('#confirm-title');
    const messageEl = document.querySelector('#confirm-message');
    const accept = document.querySelector('#confirm-accept');
    if (!modal || !titleEl || !messageEl || !accept)
        return Promise.resolve(false);
    titleEl.textContent = title;
    messageEl.textContent = message;
    accept.textContent = confirmText;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => accept.focus());
    return new Promise((resolve) => {
        const finish = (result) => {
            modal.hidden = true;
            modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('modal-open');
            modal.removeEventListener('click', onClick);
            window.removeEventListener('keydown', onKeyDown);
            resolve(result);
        };
        const onClick = (event) => {
            if (event.target === accept) {
                finish(true);
                return;
            }
            if (event.target.closest('[data-confirm-cancel]'))
                finish(false);
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape')
                finish(false);
        };
        modal.addEventListener('click', onClick);
        window.addEventListener('keydown', onKeyDown);
    });
}
function markPlanStale() {
    if (!hasCalculatedPlan)
        return;
    const output = document.querySelector('#plan-output');
    if (!output || output.querySelector('.plan-stale-banner'))
        return;
    output.classList.add('plan-stale');
    output.insertAdjacentHTML('afterbegin', `
      <div class="plan-stale-banner">
        <div><strong>Plan nieaktualny</strong><span>Dane trasy zostały zmienione po ostatnim obliczeniu.</span></div>
        <button type="button" class="primary" data-recalculate-plan>Policz ponownie</button>
      </div>`);
    output.querySelector('[data-recalculate-plan]')?.addEventListener('click', () => {
        document.querySelector('#calculate')?.click();
    });
}
function clearPlanStale() {
    const output = document.querySelector('#plan-output');
    output?.classList.remove('plan-stale');
    output?.querySelector('.plan-stale-banner')?.remove();
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
        updateRouteSummary();
        markPlanStale();
    });
    document.querySelector('#saved-truck')?.addEventListener('change', (event) => {
        const reg = event.target.value;
        const profile = store.loadAll().find((p) => p.kind === 'truck' && p.registration === reg);
        if (profile) {
            fillProfile('truck', profile);
            markPlanStale();
        }
        syncDeleteProfileButtons();
    updateRouteSummary();
    });
    document.querySelector('#saved-trailer')?.addEventListener('change', (event) => {
        const reg = event.target.value;
        const profile = store.loadAll().find((p) => p.kind === 'trailer' && p.registration === reg);
        if (profile) {
            fillProfile('trailer', profile);
            markPlanStale();
        }
        syncDeleteProfileButtons();
    });
    document.querySelectorAll('[data-delete-profile]').forEach((button) => button.addEventListener('click', () => {
        const kind = button.dataset.deleteProfile;
        const select = document.querySelector(`#saved-${kind}`);
        const registration = select?.value ?? '';
        if (!registration)
            return;
        const label = kind === 'truck' ? 'auto' : 'przyczepę';
        if (!confirm(`Usunąć zapisane ${label} ${registration}?`))
            return;
        store.delete(kind, registration);
        if (select) {
            select.innerHTML = `<option value="">— wybierz —</option>${profileOptions(kind)}`;
            select.value = '';
        }
        syncDeleteProfileButtons();
    }));
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
    document.querySelector('#set-farmer-count')?.addEventListener('click', async () => {
        const input = document.querySelector('#farmer-count');
        const requested = Number(input?.value);
        if (!Number.isInteger(requested) || requested < 1 || requested > 60) {
            alert('Wpisz liczbę gospodarzy od 1 do 60.');
            return;
        }
        const drafts = readFarmerDrafts();
        if (requested < drafts.length) {
            const removed = drafts.slice(requested);
            const hasData = removed.some((row) => row.name.trim() || row.liters.trim() || row.trailerAccess);
            if (hasData) {
            const confirmed = await showConfirmDialog({
                title: 'Zmniejszyć listę gospodarzy?',
                message: `Lista zostanie zmniejszona do ${requested} pozycji. Dane z dalszych wierszy zostaną usunięte.`,
                confirmText: 'Zmniejsz listę',
            });
            if (!confirmed)
                return;
        }
        }
        const next = drafts.slice(0, requested);
        while (next.length < requested)
            next.push({ name: '', liters: '', trailerAccess: false });
        writeFarmerDrafts(next);
        markPlanStale();
        if (input)
            input.value = String(farmerRowCount);
        animateActionButton(document.querySelector('#set-farmer-count'));
    });
    document.querySelector('#add-farmer')?.addEventListener('click', (event) => {
        writeFarmerDrafts(addFarmerDraft(readFarmerDrafts()));
        markPlanStale();
        const countInput = document.querySelector('#farmer-count');
        if (countInput)
            countInput.value = String(farmerRowCount);
        animateActionButton(event.currentTarget, 'row-added', 500);
    });
    const moveToNextForecast = (input) => {
        const index = Number(input.dataset.farmerLiters);
        const next = document.querySelector(`[data-farmer-liters="${index + 1}"]`);
        if (next) {
            next.focus({ preventScroll: true });
            next.select();
            next.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return true;
        }
        input.blur();
        return false;
    };
    let enterNavigationLocked = false;
    document.querySelector('#farmer-body')?.addEventListener('keydown', (event) => {
        const input = event.target instanceof Element ? event.target.closest('[data-farmer-liters]') : null;
        const isEnter = event.key === 'Enter' || event.key === 'NumpadEnter' || event.keyCode === 13;
        if (!input || !isEnter)
            return;
        event.preventDefault();
        if (enterNavigationLocked || event.repeat)
            return;
        enterNavigationLocked = true;
        moveToNextForecast(input);
    });
    document.querySelector('#farmer-body')?.addEventListener('keyup', (event) => {
        const isEnter = event.key === 'Enter' || event.key === 'NumpadEnter' || event.keyCode === 13;
        if (isEnter)
            enterNavigationLocked = false;
    });
    window.addEventListener('blur', () => {
        enterNavigationLocked = false;
    });
    document.querySelector('#farmer-body')?.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-remove-farmer]');
        if (!button)
            return;
        const index = Number(button.dataset.removeFarmer);
        const drafts = readFarmerDrafts();
        const draft = drafts[index];
        const label = draft?.name.trim() || `Gospodarz ${index + 1}`;
        const confirmed = await showConfirmDialog({
            title: 'Usunąć gospodarza?',
            message: `Wiersz ${index + 1}: ${label} zostanie usunięty z trasy.`,
            confirmText: 'Usuń gospodarza',
        });
        if (!confirmed)
            return;
        writeFarmerDrafts(removeFarmerDraft(drafts, index));
        updateRouteSummary();
        markPlanStale();
    });
    document.querySelector('#clear-route')?.addEventListener('click', async () => {
        const confirmed = await showConfirmDialog({
            title: 'Wyczyścić trasę?',
            message: 'Wszystkie gospodarstwa, prognozy, ustawienia wjazdu przyczepy i aktualny plan zostaną usunięte. Zapisane profile pojazdów pozostaną bez zmian.',
            confirmText: 'Wyczyść trasę',
        });
        if (!confirmed)
            return;
        farmerRowCount = 0;
        hasCalculatedPlan = false;
        lastCalculatedPlan = null;
        const body = document.querySelector('#farmer-body');
        if (body)
            body.innerHTML = '';
        const countInput = document.querySelector('#farmer-count');
        if (countInput)
            countInput.value = '';
        const preferred = document.querySelector('#preferred-transfer-order');
        if (preferred)
            preferred.value = '';
        const output = document.querySelector('#plan-output');
        if (output)
            output.innerHTML = '';
        syncFarmerListVisibility();
        updateRouteSummary();
        document.querySelector('#farmer-count')?.focus();
    });
    document.querySelector('#calculate')?.addEventListener('click', (event) => {
        animateActionButton(event.currentTarget, 'calculate-pulse', 650);
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
            output.innerHTML = `<div class="plan-result-toolbar"><div class="precalc-summary">Policzono dla: <strong>${farmers.length} gospodarzy</strong> · <strong>${farmers.reduce((sum, farmer) => sum + farmer.forecastLiters, 0).toLocaleString('pl-PL')} l</strong>${useTrailer ? ` · <strong>${farmers.filter((farmer) => farmer.trailerAccess).length} z wjazdem przyczepą</strong>` : ''}</div><button type="button" id="open-driver-mode" class="driver-mode-button">Tryb kierowcy</button></div>` + renderPlanHtml(plan);
            hasCalculatedPlan = true;
            lastCalculatedPlan = plan;
            document.querySelector('#open-driver-mode')?.addEventListener('click', () => {
                if (!lastCalculatedPlan)
                    return;
                document.body.insertAdjacentHTML('beforeend', renderDriverModeHtml(lastCalculatedPlan));
                document.body.classList.add('driver-mode-open');
                document.querySelector('#exit-driver-mode')?.addEventListener('click', () => {
                    document.querySelector('#driver-mode')?.remove();
                    document.body.classList.remove('driver-mode-open');
                });
            });
            clearPlanStale();
            output.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        catch (error) {
            hasCalculatedPlan = false;
            lastCalculatedPlan = null;
            const message = error instanceof Error ? error.message : String(error);
            output.innerHTML = `<section class="panel error-panel"><h2>Sprawdź dane</h2><p>${message}</p></section>`;
            focusFarmerFromError(message);
        }
    });
    const routePanel = document.querySelector('main');
    routePanel?.addEventListener('input', (event) => {
        const target = event.target;
        if (!(target instanceof Element))
            return;
        if (target.matches('[data-farmer-name],[data-farmer-liters],#preferred-transfer-order,#truck-c0,#truck-c1,#truck-c2,#trailer-c0,#trailer-c1,#trailer-c2')) {
            if (target.matches('[data-farmer-liters]'))
                updateRouteSummary();
            markPlanStale();
        }
    });
    routePanel?.addEventListener('change', (event) => {
        const target = event.target;
        if (!(target instanceof Element))
            return;
        if (target.matches('[data-farmer-trailer],#use-trailer,#saved-truck,#saved-trailer')) {
            if (target.matches('[data-farmer-trailer],#use-trailer'))
                updateRouteSummary();
            markPlanStale();
        }
    });
    syncFarmerListVisibility();
    syncTrailerAvailability(document.querySelector('#use-trailer')?.checked ?? false);
    syncDeleteProfileButtons();
}
render();
updateConnectionStatus();
window.addEventListener('offline', updateConnectionStatus);
window.addEventListener('online', updateConnectionStatus);
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}
