import { usableCapacity } from './capacityPolicy.js';
const pairTarget = (truckIndex) => truckIndex + 3;
export function planRoute(input) {
    const noTransfer = searchRoute(input, null);
    if (noTransfer.feasible)
        return noTransfer;
    const preferredTransferOrder = input.preferredTransferAfterFarmerOrder ?? inferPreferredTransferOrder(input.farmers);
    if (input.trailer && preferredTransferOrder !== undefined) {
        const preferred = searchRoute(input, preferredTransferOrder);
        if (preferred.feasible)
            return preferred;
    }
    return searchRoute(input, undefined);
}
function searchRoute(input, onlyTransferAfterOrder) {
    const capacities = [
        ...input.truck.capacitiesLiters.map(usableCapacity),
        ...(input.trailer ? input.trailer.capacitiesLiters.map(usableCapacity) : [0, 0, 0]),
    ];
    const beamWidth = input.beamWidth ?? 4000;
    let states = [{ loads: [0, 0, 0, 0, 0, 0], rows: [], directTrailerLiters: 0, splitExtra: 0 }];
    for (let farmerIndex = 0; farmerIndex < input.farmers.length; farmerIndex++) {
        const farmer = input.farmers[farmerIndex];
        if (farmer.forecastLiters <= 0) {
            return failure('Prognoza każdego gospodarza musi być większa od zera.');
        }
        const next = [];
        for (const state of states) {
            for (const placement of placementCandidates(state.loads, capacities, farmer, Boolean(input.trailer))) {
                const placed = applyPlacement(state, farmer, placement);
                next.push(placed);
                const transferAllowedHere = onlyTransferAfterOrder !== null && (onlyTransferAfterOrder === undefined || farmer.order === onlyTransferAfterOrder);
                if (!placed.transfer && input.trailer && transferAllowedHere) {
                    next.push(...transferVariants(placed, capacities, farmer.order));
                }
            }
        }
        if (next.length === 0)
            return failure(`Brak miejsca przy gospodarzu ${farmer.order}: ${farmer.name}.`);
        const remainingFarmers = input.farmers.slice(farmerIndex + 1);
        states = dedupeAndRank(next, capacities, beamWidth, remainingFarmers, Boolean(input.trailer));
    }
    states.sort((a, b) => compareStates(a, b, capacities));
    const best = states[0];
    return buildResult(best, capacities);
}
export function inferPreferredTransferOrder(farmers) {
    let candidate;
    for (let i = 0; i < farmers.length - 1; i++) {
        if (farmers[i].trailerAccess && !farmers[i + 1].trailerAccess)
            candidate = farmers[i].order;
    }
    return candidate;
}
function failure(reason) {
    return { feasible: false, rows: [], transfers: [], summaries: [], reason };
}
function placementCandidates(loads, capacities, farmer, hasTrailer) {
    const accessible = farmer.trailerAccess && hasTrailer ? [0, 1, 2, 3, 4, 5] : [0, 1, 2];
    const free = accessible.map((i) => ({ i, free: capacities[i] - loads[i] })).filter((x) => x.free > 0);
    const volume = farmer.forecastLiters;
    const singles = free.filter((x) => x.free >= volume).map((x) => [{ compartment: x.i, liters: volume }]);
    if (singles.length > 0)
        return singles;
    const fitsSingleWhenEmpty = accessible.some((i) => capacities[i] >= volume);
    if (fitsSingleWhenEmpty)
        return [];
    for (let k = 2; k <= free.length; k++) {
        const combos = combinations(free, k).filter((combo) => combo.reduce((sum, x) => sum + x.free, 0) >= volume);
        if (combos.length === 0)
            continue;
        const out = [];
        for (const combo of combos) {
            for (let remainderAt = 0; remainderAt < combo.length; remainderAt++) {
                let remaining = volume;
                const parts = [];
                for (let offset = 1; offset <= combo.length; offset++) {
                    const idx = (remainderAt + offset) % combo.length;
                    if (idx === remainderAt)
                        continue;
                    const take = Math.min(combo[idx].free, remaining);
                    if (take > 0)
                        parts.push({ compartment: combo[idx].i, liters: take });
                    remaining -= take;
                }
                if (remaining > 0 && remaining <= combo[remainderAt].free) {
                    parts.push({ compartment: combo[remainderAt].i, liters: remaining });
                    remaining = 0;
                }
                if (remaining === 0 && parts.length === k)
                    out.push(parts);
            }
        }
        return uniquePlacements(out);
    }
    return [];
}
function applyPlacement(state, farmer, parts) {
    const loads = [...state.loads];
    for (const part of parts)
        loads[part.compartment] += part.liters;
    return {
        ...state,
        loads,
        rows: [...state.rows, { farmer, parts }],
        directTrailerLiters: state.directTrailerLiters + parts.filter((p) => p.compartment >= 3).reduce((s, p) => s + p.liters, 0),
        splitExtra: state.splitExtra + Math.max(0, parts.length - 1),
    };
}
function transferVariants(state, capacities, afterFarmerOrder) {
    const eligible = [0, 1, 2].filter((from) => {
        const liters = state.loads[from];
        const to = pairTarget(from);
        return liters > 0 && capacities[to] - state.loads[to] >= liters;
    });
    const variants = [];
    for (let mask = 1; mask < (1 << eligible.length); mask++) {
        const loads = [...state.loads];
        const pairs = [];
        for (let bit = 0; bit < eligible.length; bit++) {
            if ((mask & (1 << bit)) === 0)
                continue;
            const from = eligible[bit];
            const to = pairTarget(from);
            const liters = loads[from];
            loads[to] += liters;
            loads[from] = 0;
            pairs.push({ from: from + 1, to: to + 1, liters });
        }
        variants.push({ ...state, loads, transfer: { afterFarmerOrder, pairs } });
    }
    return variants;
}
function buildResult(state, capacities) {
    const transferred = new Map();
    if (state.transfer)
        for (const pair of state.transfer.pairs)
            transferred.set(pair.from, pair.to);
    const transferOrder = state.transfer?.afterFarmerOrder ?? -1;
    const rows = state.rows.map((row) => ({
        farmer: row.farmer,
        parts: row.parts.map((part) => {
            const current = part.compartment + 1;
            const target = row.farmer.order <= transferOrder && transferred.has(current) ? transferred.get(current) : current;
            return { liters: part.liters, currentCompartment: current, targetCompartment: target };
        }),
    }));
    const summaries = capacities.map((capacity, i) => ({
        compartment: i + 1,
        plannedLiters: state.loads[i],
        usableCapacityLiters: capacity,
        freeLiters: capacity - state.loads[i],
    })).filter((summary) => summary.usableCapacityLiters > 0);
    return { feasible: true, rows, transfers: state.transfer ? [state.transfer] : [], summaries };
}
function compareStates(a, b, capacities) {
    if (a.directTrailerLiters !== b.directTrailerLiters)
        return b.directTrailerLiters - a.directTrailerLiters;
    const aStops = a.transfer ? 1 : 0;
    const bStops = b.transfer ? 1 : 0;
    if (aStops !== bStops)
        return aStops - bStops;
    const aPairs = a.transfer?.pairs.length ?? 0;
    const bPairs = b.transfer?.pairs.length ?? 0;
    if (aPairs !== bPairs)
        return aPairs - bPairs;
    if (a.splitExtra !== b.splitExtra)
        return a.splitExtra - b.splitExtra;
    return bufferPenalty(a.loads, capacities) - bufferPenalty(b.loads, capacities);
}
function bufferPenalty(loads, capacities) {
    let penalty = 0;
    for (let i = 0; i < loads.length; i++) {
        if (loads[i] <= 0 || capacities[i] <= 0)
            continue;
        const free = capacities[i] - loads[i];
        if (free < 250)
            penalty += 250 - free;
    }
    return penalty;
}
function dedupeAndRank(states, capacities, limit, remainingFarmers = [], hasTrailer = false) {
    const best = new Map();
    for (const state of states) {
        const transferKey = state.transfer
            ? `${state.transfer.afterFarmerOrder}:${state.transfer.pairs.map((p) => `${p.from}>${p.to}`).join(',')}`
            : '-';
        const key = `${state.loads.join('/')};${transferKey}`;
        const previous = best.get(key);
        if (!previous || compareStatesForFuture(state, previous, capacities, remainingFarmers, hasTrailer) < 0)
            best.set(key, state);
    }
    const ranked = [...best.values()].sort((a, b) => compareStatesForFuture(a, b, capacities, remainingFarmers, hasTrailer));
    if (ranked.length <= limit)
        return ranked;
    // A route may require exactly one transfer later. If all transferred states are
    // pruned merely because "no transfer yet" scores better, the search can report
    // a false impossibility near the end of an otherwise feasible route. Preserve
    // search diversity between both phases of the route.
    const withoutTransfer = ranked.filter((state) => !state.transfer);
    const withTransfer = ranked.filter((state) => Boolean(state.transfer));
    if (withoutTransfer.length === 0 || withTransfer.length === 0)
        return ranked.slice(0, limit);
    const transferQuota = Math.min(withTransfer.length, Math.floor(limit / 2));
    const noTransferQuota = Math.min(withoutTransfer.length, limit - transferQuota);
    const selected = [
        ...withoutTransfer.slice(0, noTransferQuota),
        ...withTransfer.slice(0, transferQuota),
    ];
    if (selected.length < limit) {
        const selectedSet = new Set(selected);
        for (const state of ranked) {
            if (!selectedSet.has(state))
                selected.push(state);
            if (selected.length === limit)
                break;
        }
    }
    return selected.sort((a, b) => compareStatesForFuture(a, b, capacities, remainingFarmers, hasTrailer));
}
function compareStatesForFuture(a, b, capacities, remainingFarmers, hasTrailer) {
    const aFuture = futureSingleCompartmentPenalty(a.loads, capacities, remainingFarmers, hasTrailer);
    const bFuture = futureSingleCompartmentPenalty(b.loads, capacities, remainingFarmers, hasTrailer);
    if (aFuture !== bFuture)
        return aFuture - bFuture;
    return compareStates(a, b, capacities);
}
function futureSingleCompartmentPenalty(loads, capacities, remainingFarmers, hasTrailer) {
    let penalty = 0;
    for (const farmer of remainingFarmers) {
        const accessible = farmer.trailerAccess && hasTrailer ? [0, 1, 2, 3, 4, 5] : [0, 1, 2];
        const maxEmptyCapacity = Math.max(...accessible.map((i) => capacities[i]));
        if (farmer.forecastLiters > maxEmptyCapacity)
            continue;
        const maxFree = Math.max(...accessible.map((i) => capacities[i] - loads[i]));
        if (maxFree < farmer.forecastLiters) {
            penalty += 1000000 + (farmer.forecastLiters - maxFree);
        }
    }
    return penalty;
}
function combinations(items, k) {
    const result = [];
    const walk = (start, chosen) => {
        if (chosen.length === k) {
            result.push([...chosen]);
            return;
        }
        for (let i = start; i < items.length; i++)
            walk(i + 1, [...chosen, items[i]]);
    };
    walk(0, []);
    return result;
}
function uniquePlacements(placements) {
    const seen = new Set();
    return placements.filter((parts) => {
        const key = [...parts].sort((a, b) => a.compartment - b.compartment).map((p) => `${p.compartment}:${p.liters}`).join('|');
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
