export function addFarmerDraft(rows) {
    return [...rows, { name: '', liters: '', trailerAccess: false }];
}
export function removeFarmerDraft(rows, index) {
    if (!Number.isInteger(index) || index < 0 || index >= rows.length)
        return [...rows];
    return rows.filter((_, rowIndex) => rowIndex !== index);
}
export function importFarmerDrafts(imported, existing = []) {
    return imported.map((row, index) => ({
        name: row.name,
        liters: row.liters,
        trailerAccess: existing[index]?.trailerAccess ?? false,
    }));
}
