export function createVehicleProfile(kind, registration, capacitiesLiters) {
    if (registration.trim().length === 0)
        throw new Error('registration is required');
    if (capacitiesLiters.length !== 3)
        throw new Error('vehicle must have exactly three capacities');
    if (capacitiesLiters.some((capacity) => !Number.isFinite(capacity) || capacity <= 65)) {
        throw new Error('capacity must be greater than 65 liters');
    }
    return {
        kind,
        registration: registration.trim().toUpperCase(),
        capacitiesLiters: [capacitiesLiters[0], capacitiesLiters[1], capacitiesLiters[2]],
    };
}
