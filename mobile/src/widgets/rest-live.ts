// No Live Activity outside iPhone builds (Android and the browser preview).
import type { RestTimer } from '@/data/repo';

export async function syncRestActivity(_timer: RestTimer | null): Promise<void> {}
