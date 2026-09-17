export const TECHNICAL_RESERVE_LITERS = 65;
export function usableCapacity(nominalCapacityLiters) {
    if (!Number.isFinite(nominalCapacityLiters) || nominalCapacityLiters <= TECHNICAL_RESERVE_LITERS) {
        throw new Error('nominal capacity must be greater than technical reserve');
    }
    return nominalCapacityLiters - TECHNICAL_RESERVE_LITERS;
}
