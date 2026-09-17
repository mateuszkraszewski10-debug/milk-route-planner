import { createVehicleProfile } from '../domain/models.js';
const KEY = 'milk_route_planner_vehicle_profiles_v1';
export class VehicleStore {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    loadAll() {
        const raw = this.storage.getItem(KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        return parsed.map((p) => createVehicleProfile(p.kind, p.registration, p.capacitiesLiters));
    }
    save(profile) {
        const profiles = this.loadAll();
        const next = profiles.filter((p) => !(p.kind === profile.kind && p.registration === profile.registration));
        next.push(profile);
        this.storage.setItem(KEY, JSON.stringify(next));
    }
    delete(kind, registration) {
        const next = this.loadAll().filter((p) => !(p.kind === kind && p.registration === registration));
        this.storage.setItem(KEY, JSON.stringify(next));
    }
}
