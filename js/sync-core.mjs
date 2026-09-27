export const SOURCE = 'krafttraining-tracker';
export const PAYLOAD_FIELDS = ['schemaVersion', 'source', 'sessionId', 'startedAt', 'endedAt', 'activityDate', 'timeZone', 'strengthKcal', 'cardioKcal'];
export function sessionIdentity(startedAt, owner = null) {
  const date = new Date(startedAt);
  if (!Number.isFinite(date.getTime())) throw new Error('Ungültiger Trainingsbeginn');
  return { sessionId: crypto.randomUUID(), activityDate: `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, syncOwner: owner };
}
function kcal(value) {
  const n = Number(value ?? 0);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Ungültige Kalorien: bitte vor dem Beenden korrigieren.');
  return n;
}
export function sessionPayload(training, endedAt = new Date()) {
  if (!Number.isFinite(new Date(endedAt).getTime()) || new Date(endedAt) < new Date(training.startedAt)) throw new Error('Trainingsende liegt vor dem Beginn. Bitte Gerätezeit prüfen.');
  const strengthKcal = training.exercises.filter(e => e.type !== 'header' && e.completed === true).reduce((sum,e) => sum + kcal(e.calories), 0);
  const cardioKcal = (training.cardioEntries || []).reduce((sum,e) => sum + kcal(e.calories), 0);
  return { schemaVersion: 1, source: SOURCE, sessionId: training.sessionId, startedAt: new Date(training.startedAt).toISOString(), endedAt: new Date(endedAt).toISOString(), activityDate: training.activityDate, timeZone: training.timeZone, strengthKcal: kcal(strengthKcal), cardioKcal: kcal(cardioKcal) };
}
export function samePayload(a, b) { return PAYLOAD_FIELDS.every(key => a[key] === b[key]); }
export function importEntries(payload) {
  return [['strength', payload.strengthKcal], ['cardio', payload.cardioKcal]].filter(([,calories]) => calories > 0).map(([category, calories]) => ({ id: `${SOURCE}:${payload.sessionId}:${category}`, source: SOURCE, sessionId: payload.sessionId, category, activityDate: payload.activityDate, calories }));
}
// Every mutation resolves on transaction completion, never on request success.
export function mutateTraining(db, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('training', 'readwrite');
    let result;
    let failure;
    const fail = error => { failure = error; tx.abort(); };
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () => reject(failure || tx.error || new Error('Speichern fehlgeschlagen'));
    try { operation(tx.objectStore('training'), value => { result = value; }, fail); } catch (error) { fail(error); }
  });
}
export function ensureIdentity(db, owner) {
  return mutateTraining(db, (store, done, fail) => {
    const request = store.get('current');
    request.onsuccess = () => {
      try {
        const training = request.result;
        if (training && !training.sessionId) { Object.assign(training, sessionIdentity(training.startedAt, owner)); store.put(training); }
        done(training || null);
      } catch (error) { fail(error); }
    };
  });
}
export function finishTraining(db, owner, endedAt = new Date()) {
  return mutateTraining(db, (store, done, fail) => {
    const request = store.get('current');
    request.onsuccess = () => {
      try {
        const training = request.result;
        if (!training) { done(null); return; }
        if (!training.sessionId) Object.assign(training, sessionIdentity(training.startedAt, owner));
        const job = { id: `sync:${training.sessionId}`, kind: 'firestore-sync', owner: training.syncOwner || null, payload: sessionPayload(training, endedAt), status: 'pending', attempts: 0, nextAttemptAt: 0, planName: training.planName || 'Standard' };
        job.details = { exercises: training.exercises.filter(ex => ex.type !== 'header' && ex.completed === true).map(ex => ({ name: ex.name, calories: ex.calories })), cardio: (training.cardioEntries || []).map(entry => ({ name: entry.name, calories: entry.calories })) };
        store.add(job);
        store.delete('current');
        done(job);
      } catch (error) { fail(error); }
    };
  });
}
export function listJobs(db) {
  return new Promise((resolve,reject) => {
    const request = db.transaction('training').objectStore('training').getAll();
    request.onsuccess = () => resolve(request.result.filter(row => row.kind === 'firestore-sync'));
    request.onerror = () => reject(request.error);
  });
}
export function updateJob(db, id, changes) {
  return mutateTraining(db, (store,done) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const job = request.result;
      if (job && job.status !== 'synced') { Object.assign(job, changes); store.put(job); }
      done(job);
    };
  });
}
export function claimJobs(db, ids, owner) {
  return mutateTraining(db, (store) => {
    for (const id of ids) {
      const request = store.get(id);
      request.onsuccess = () => { const job = request.result; if (job?.kind === 'firestore-sync' && !job.owner) { job.owner = owner; store.put(job); } };
    }
  });
}
export async function deliverJob(job, transport) {
  await transport(job.payload);
  return { status: 'synced', error: '', nextAttemptAt: 0, syncedAt: new Date().toISOString() };
}
// Read and write the active session under one lock, so late UI events cannot
// recreate a session that has already been finalized by another transaction.
export function changeCurrent(db, change) {
  return mutateTraining(db, (store,done,fail) => {
    const request = store.get('current');
    request.onsuccess = () => {
      try {
        const training = request.result;
        if (!training) { done(null); return; }
        change(training);
        store.put(training);
        done(training);
      } catch (error) { fail(error); }
    };
  });
}
