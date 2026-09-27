import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { samePayload } from './sync-core.mjs';
export async function writeSession(db, uid, payload) {
  const reference = doc(db, 'users', uid, 'trainingSessions', payload.sessionId);
  await runTransaction(db, async transaction => {
    const existing = await transaction.get(reference);
    if (existing.exists()) {
      if (!samePayload(existing.data(), payload)) throw Object.assign(new Error('Conflict'), { code: 'sync/conflict' });
      return;
    }
    transaction.set(reference, { ...payload, receivedAt: serverTimestamp() });
  });
}
