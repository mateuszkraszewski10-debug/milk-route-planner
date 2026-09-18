import { planRoute } from './domain/planner-v1.33.js';

self.addEventListener('message', (event) => {
  try {
    const plan = planRoute(event.data);
    self.postMessage({ ok: true, plan });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
