import type { PersistJob } from "@/lib/contracts/queue";

// T-001: stub. T-022 publica en QStash cuando hay token y persiste en Neon (T-020);
// sin token ejecuta la persistencia inline. Mientras tanto no hace nada.
export async function enqueuePersist(_job: PersistJob): Promise<void> {
  void _job;
}
