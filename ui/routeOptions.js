export function parsePreferredTransferOrder(value, farmerCount) {
    const trimmed = value.trim();
    if (!trimmed)
        return undefined;
    const order = Number(trimmed);
    if (!Number.isInteger(order) || order < 1 || order > farmerCount) {
        throw new Error(`Preferowane przepompowanie musi być numerem gospodarza 1–${farmerCount}.`);
    }
    return order;
}
