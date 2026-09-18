import { usableCapacity } from './capacityPolicy.js';
const pairTarget = (truckIndex) => truckIndex + 3;
const PRACTICAL_MARGIN_LITERS = 300;
export function planRoute(input) {
    const preferredTransferOrder = input.preferredTransferAfterFarmerOrder ?? inferPreferredTransferOrder(input.farmers);
    const maxTransfers = input.trailer ? Math.max(0, input.farmers.length - 1) : 0;
    let lastFailure = failure('Nie udało się ułożyć trasy.');
    for (let allowedTransfers = 0; allowedTransfers <= maxTransfers; allowedTransfers++) {
        const result = searchRoute(input, allowedTransfers, preferredTransferOrder);
        if (result.feasible)
            return result;
        lastFailure = result;
    }
    return lastFailure;
}
function searchRoute(input, allowedTransfers, preferredTransferOrder) {
    const capacities = [
        ...input.truck.capacitiesLiters.map(usableCapacity),
        ...(input.trailer ? input.trailer.capacitiesLiters.map(usableCapacity) : [0, 0, 0]),
    ];
    const beamWidth = input.beamWidth ?? 4000;
    let states = [{
        loads: [0, 0, 0, 0, 0, 0],
        rows: [],
        transfers: [],
        directTrailerLiters: 0,
        splitExtra: 0,
        tightPlacementPenalty: 0,
        transferPreferencePenalty: 0,
    }];
    for (let farmerIndex = 0; farmerIndex < input.farmers.length; farmerIndex++) {
        const farmer = input.farmers[farmerIndex];
        if (farmer.forecastLiters <= 0)
            return failure('Prognoza każdego gospodarza musi być większa od zera.');
        const next = [];
        const remainingFarmers = input.farmers.slice(farmerIndex + 1);
        for (const state of states) {
            for (const placement of placementCandidates(state.loads, capacities, farmer, Boolean(input.trailer), remainingFarmers)) {
                const placed = applyPlacement(state, farmer, placement, capacities);
                next.push(placed);
                if (input.trailer && placed.transfers.length < allowedTransfers)
                    next.push(...transferVariants(placed, capacities, farmer.order, preferredTransferOrder));
            }
        }
        if (next.length === 0)
            return failure(`Brak miejsca przy gospodarzu ${farmer.order}: ${farmer.name}.`);
        states = dedupeAndRank(next, capacities, beamWidth, remainingFarmers, Boolean(input.trailer));
    }
    const feasible = states.filter((state) => state.transfers.length <= allowedTransfers);
    if (feasible.length === 0)
        return failure('Nie udało się ułożyć trasy przy tej liczbie przepompowań.');
    feasible.sort((a, b) => compareStates(a, b, capacities));
    return buildResult(feasible[0], capacities);
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
function placementCandidates(loads, capacities, farmer, hasTrailer, remainingFarmers = []) {
    const accessible = farmer.trailerAccess && hasTrailer ? [0, 1, 2, 3, 4, 5] : [0, 1, 2];
    const free = accessible.map((i) => ({ i, free: capacities[i] - loads[i] })).filter((x) => x.free > 0);
    const volume = farmer.forecastLiters;

    // Normal case: if the whole pickup fits in one currently available compartment,
    // keep the farm together.
    const singleSlots = free.filter((x) => x.free >= volume);
    const singles = singleSlots.map((x) => [{ compartment: x.i, liters: volume }]);

    const theoreticalSingleSlots = accessible.filter((i) => capacities[i] >= volume);

    if (singles.length > 0) {
        // If there is only one large compartment capable of taking this farm,
        // check whether a later, larger farm also depends on exactly that same
        // compartment. The larger farm gets priority; the smaller current farm
        // receives split alternatives across the smaller compartments.
        if (theoreticalSingleSlots.length === 1) {
            const scarce = theoreticalSingleSlots[0];
            const largerFutureNeedsSame = remainingFarmers.some((future) => {
                if (future.forecastLiters <= volume)
                    return false;
                const futureAccessible = future.trailerAccess && hasTrailer ? [0, 1, 2, 3, 4, 5] : [0, 1, 2];
                const futureSingleSlots = futureAccessible.filter((i) => capacities[i] >= future.forecastLiters);
                return futureSingleSlots.length === 1 && futureSingleSlots[0] === scarce;
            });

            if (largerFutureNeedsSame) {
                const splitFree = free.filter((x) => x.i !== scarce);
                const splitOut = [];
                for (let k = 2; k <= splitFree.length; k++) {
                    const combos = combinations(splitFree, k)
                        .filter((combo) => combo.reduce((sum, x) => sum + x.free, 0) >= volume);
                    if (combos.length === 0)
                        continue;
                    splitOut.push(...placementsFromCombos(combos, volume));
                    if (splitOut.length > 0)
                        break;
                }
                if (splitOut.length > 0)
                    return uniquePlacements([...singles, ...splitOut]);
            }
        }
        return singles;
    }

    // Exception for the smaller farm: if it would normally fit only in one large
    // compartment, but that compartment is already occupied, allow the farm to
    // be split across smaller compartments instead of declaring the route impossible.
    if (theoreticalSingleSlots.length === 1) {
        const scarce = theoreticalSingleSlots[0];
        const scarceFree = capacities[scarce] - loads[scarce];
        if (scarceFree < volume) {
            const splitFree = free.filter((x) => x.i !== scarce);
            const splitOut = [];
            for (let k = 2; k <= splitFree.length; k++) {
                const combos = combinations(splitFree, k)
                    .filter((combo) => combo.reduce((sum, x) => sum + x.free, 0) >= volume);
                if (combos.length === 0)
                    continue;
                splitOut.push(...placementsFromCombos(combos, volume));
                if (splitOut.length > 0)
                    break;
            }
            if (splitOut.length > 0)
                return uniquePlacements(splitOut);
        }
    }

    // Otherwise a pickup that would fit in one empty compartment may not be split
    // merely because earlier choices used the available space badly.
    const fitsSingleWhenEmpty = theoreticalSingleSlots.length > 0;
    if (fitsSingleWhenEmpty)
        return [];

    // Large pickups are pumped continuously: when a compartment is selected,
    // it is filled to its usable limit before switching to another one.
    // Only the final compartment may be left partially filled because the farm runs out.
    let minimumK;
    for (let k = 2; k <= free.length; k++) {
        if (combinations(free, k).some((combo) => combo.reduce((sum, x) => sum + x.free, 0) >= volume)) {
            minimumK = k;
            break;
        }
    }
    if (minimumK === undefined)
        return [];

    const out = [];
    const maxK = Math.min(free.length, minimumK + 1);
    for (let k = minimumK; k <= maxK; k++) {
        const combos = combinations(free, k).filter((combo) => combo.reduce((sum, x) => sum + x.free, 0) >= volume);
        out.push(...placementsFromCombos(combos, volume));
    }
    return uniquePlacements(out);
}
function placementsFromCombos(combos, volume) {
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
            if (remaining === 0 && parts.length === combo.length)
                out.push(parts);
        }
    }
    return out;
}
function applyPlacement(state, farmer, parts, capacities) {
    const loads = [...state.loads];
    for (const part of parts)
        loads[part.compartment] += part.liters;
    let tightPlacementPenalty = state.tightPlacementPenalty ?? 0;
    if (parts.length === 1) {
        const part = parts[0];
        const freeAfter = capacities[part.compartment] - loads[part.compartment];
        if (freeAfter > 0 && freeAfter < PRACTICAL_MARGIN_LITERS)
            tightPlacementPenalty += PRACTICAL_MARGIN_LITERS - freeAfter;
    }
    return {
        ...state,
        loads,
        rows: [...state.rows, { farmer, parts }],
        directTrailerLiters: state.directTrailerLiters + parts.filter((p) => p.compartment >= 3).reduce((s, p) => s + p.liters, 0),
        splitExtra: state.splitExtra + Math.max(0, parts.length - 1),
        tightPlacementPenalty,
    };
}
function transferVariants(state, capacities, afterFarmerOrder, preferredTransferOrder) {
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
        const event = { afterFarmerOrder, pairs };
        const isFirstTransfer = state.transfers.length === 0;
        const preferencePenalty = isFirstTransfer && preferredTransferOrder !== undefined
            ? Math.abs(afterFarmerOrder - preferredTransferOrder)
            : 0;
        variants.push({
            ...state,
            loads,
            transfers: [...state.transfers, event],
            transferPreferencePenalty: (state.transferPreferencePenalty ?? 0) + preferencePenalty,
        });
    }
    return variants;
}
function buildResult(state, capacities) {
    const transfers = state.transfers ?? [];
    const rows = state.rows.map((row) => ({
        farmer: row.farmer,
        parts: row.parts.map((part) => {
            const current = part.compartment + 1;
            let target = current;
            if (current <= 3) {
                const event = transfers.find((transfer) =>
                    transfer.afterFarmerOrder >= row.farmer.order &&
                    transfer.pairs.some((pair) => pair.from === current)
                );
                if (event)
                    target = event.pairs.find((pair) => pair.from === current).to;
            }
            return { liters: part.liters, currentCompartment: current, targetCompartment: target };
        }),
    }));
    const summaries = capacities.map((capacity, i) => ({
        compartment: i + 1,
        plannedLiters: state.loads[i],
        usableCapacityLiters: capacity,
        freeLiters: capacity - state.loads[i],
    })).filter((summary) => summary.usableCapacityLiters > 0);
    return { feasible: true, rows, transfers, summaries };
}
function compareStates(a, b, capacities) {
    const aStops = a.transfers?.length ?? 0;
    const bStops = b.transfers?.length ?? 0;
    if (aStops !== bStops)
        return aStops - bStops;
    const aTight = a.tightPlacementPenalty ?? 0;
    const bTight = b.tightPlacementPenalty ?? 0;
    if (aTight !== bTight)
        return aTight - bTight;
    const aPreference = a.transferPreferencePenalty ?? 0;
    const bPreference = b.transferPreferencePenalty ?? 0;
    if (aPreference !== bPreference)
        return aPreference - bPreference;
    const aPairs = (a.transfers ?? []).reduce((sum, event) => sum + event.pairs.length, 0);
    const bPairs = (b.transfers ?? []).reduce((sum, event) => sum + event.pairs.length, 0);
    if (aPairs !== bPairs)
        return aPairs - bPairs;
    if (a.splitExtra !== b.splitExtra)
        return a.splitExtra - b.splitExtra;
    if (a.directTrailerLiters !== b.directTrailerLiters)
        return b.directTrailerLiters - a.directTrailerLiters;
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
        const transfers = state.transfers ?? [];
        const transferKey = transfers.length
            ? transfers.map((event) => `${event.afterFarmerOrder}:${event.pairs.map((p) => `${p.from}>${p.to}`).join(",")}`).join("|")
            : '-';
        const key = `${state.loads.join("/")};${transferKey}`;
        const previous = best.get(key);
        if (!previous || compareStates(state, previous, capacities) < 0)
            best.set(key, state);
    }
    const futureCache = new Map();
    const futureRisk = (state) => {
        const key = state.loads.join("/");
        if (!futureCache.has(key))
            futureCache.set(key, futurePackingPenalty(state.loads, capacities, remainingFarmers, hasTrailer));
        return futureCache.get(key);
    };
    const compareWithFuture = (a, b) => {
        const aFuture = futureRisk(a);
        const bFuture = futureRisk(b);
        if (aFuture !== bFuture)
            return aFuture - bFuture;
        return compareStates(a, b, capacities);
    };
    const ranked = [...best.values()].sort(compareWithFuture);
    if (ranked.length <= limit)
        return ranked;
    const groups = new Map();
    for (const state of ranked) {
        const count = state.transfers?.length ?? 0;
        if (!groups.has(count))
            groups.set(count, []);
        groups.get(count).push(state);
    }
    const counts = [...groups.keys()].sort((a, b) => a - b);
    const selected = [];
    const quota = Math.max(1, Math.floor(limit / Math.max(1, counts.length)));
    for (const count of counts)
        selected.push(...groups.get(count).slice(0, quota));
    if (selected.length < limit) {
        const selectedSet = new Set(selected);
        for (const state of ranked) {
            if (!selectedSet.has(state))
                selected.push(state);
            if (selected.length === limit)
                break;
        }
    }
    return selected.slice(0, limit).sort(compareWithFuture);
}
function futurePackingPenalty(loads, capacities, remainingFarmers, hasTrailer) {
    const lookahead = remainingFarmers.slice(0, 5);
    let states = [{ loads: [...loads], penalty: 0 }];

    for (const farmer of lookahead) {
        const accessible = farmer.trailerAccess && hasTrailer ? [0, 1, 2, 3, 4, 5] : [0, 1, 2];
        const maxEmptyCapacity = Math.max(...accessible.map((i) => capacities[i]));

        // Large future farms have their own continuous-fill placement logic.
        // This look-ahead is for protecting the smaller, one-compartment pickups.
        if (farmer.forecastLiters > maxEmptyCapacity)
            continue;

        const next = [];
        for (const state of states) {
            for (const compartment of accessible) {
                const free = capacities[compartment] - state.loads[compartment];
                if (free < farmer.forecastLiters)
                    continue;
                const after = free - farmer.forecastLiters;
                let extra = 0;
                if (after > 0 && after < PRACTICAL_MARGIN_LITERS)
                    extra = 10000 + (PRACTICAL_MARGIN_LITERS - after);
                const newLoads = [...state.loads];
                newLoads[compartment] += farmer.forecastLiters;
                next.push({ loads: newLoads, penalty: state.penalty + extra });
            }
        }

        if (next.length === 0)
            return 1000000 + farmer.forecastLiters;

        const deduped = new Map();
        for (const state of next) {
            const key = state.loads.join('/');
            const previous = deduped.get(key);
            if (!previous || state.penalty < previous.penalty)
                deduped.set(key, state);
        }
        states = [...deduped.values()]
            .sort((a, b) => a.penalty - b.penalty || compactnessPenalty(a.loads, capacities) - compactnessPenalty(b.loads, capacities))
            .slice(0, 24);
    }

    if (states.length === 0)
        return 1000000;
    return Math.min(...states.map((state) => state.penalty));
}

function compactnessPenalty(loads, capacities) {
    let penalty = 0;
    for (let i = 0; i < loads.length; i++) {
        if (loads[i] <= 0 || capacities[i] <= 0)
            continue;
        const free = capacities[i] - loads[i];
        if (free > 0)
            penalty += Math.min(free, 1000);
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
