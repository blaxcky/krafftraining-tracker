import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { writeSession } from './firestore-transport.mjs';
import * as core from './sync-core.mjs';

globalThis.SyncCore = core;
const config = globalThis.FIREBASE_CONFIG || {};
const ownerKey = 'krafttraining_sync_owner';
const byId = id => document.getElementById(id);
const friendlyError = error => {
  const code = String(error?.code || '');
  if (code.includes('conflict')) return 'Konflikt: Diese Trainings-ID enthält bereits andere Daten. Es wurde nichts überschrieben.';
  if (/permission-denied/.test(code)) return 'Zugriff verweigert. Firestore-Regeln und Konto prüfen.';
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)) return 'Anmeldung fehlgeschlagen. E-Mail und Passwort prüfen.';
  if (/unauthenticated|user-disabled|user-token-expired/.test(code)) return 'Anmeldung abgelaufen oder Konto gesperrt. Bitte erneut anmelden.';
  if (/too-many-requests/.test(code)) return 'Zu viele Versuche. Bitte später erneut versuchen.';
  if (/unavailable|network|deadline-exceeded/.test(code)) return 'Wartet auf Verbindung';
  return 'Synchronisierung fehlgeschlagen. Bitte erneut versuchen.';
};
class FirestoreSync {
  constructor() { this.auth = null; this.db = null; this.user = null; this.ready = false; this.busy = false; this.message = ''; this.timer = null; }
  owner() {
    if (this.user) return { uid: this.user.uid, projectId: config.projectId };
    try { const owner = JSON.parse(localStorage.getItem(ownerKey)); return owner?.uid && owner?.projectId ? owner : null; } catch { return null; }
  }
  async init(storage) {
    this.storage = storage;
    byId('sync-login-form').addEventListener('submit', event => { event.preventDefault(); void this.login(); });
    byId('sync-logout').addEventListener('click', () => this.accountAction(() => signOut(this.auth)));
    byId('sync-reset').addEventListener('click', () => this.accountAction(async () => { await sendPasswordResetEmail(this.auth, byId('sync-email').value.trim()); this.message = 'Falls ein Konto existiert, wurde eine E-Mail zum Zurücksetzen angefordert.'; }));
    byId('sync-claim').addEventListener('click', () => void this.claim());
    document.querySelectorAll('[data-sync-now]').forEach(button => button.addEventListener('click', () => void this.run(true)));
    window.addEventListener('online', () => void this.run());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void this.run(); });
    if (!['apiKey','projectId','appId','authDomain'].every(key => typeof config[key] === 'string' && config[key])) { this.message = 'Firestore ist noch nicht eingerichtet. Trainings werden lokal vorgemerkt.'; await this.render(); return; }
    try {
      const firebase = initializeApp(config);
      this.auth = getAuth(firebase);
      this.db = getFirestore(firebase);
      if (__FIREBASE_EMULATORS__) {
        connectAuthEmulator(this.auth, 'http://127.0.0.1:9199', { disableWarnings: true });
        connectFirestoreEmulator(this.db, '127.0.0.1', 8180);
      }
      onAuthStateChanged(this.auth, user => {
        this.user = user; this.ready = true;
        if (user) localStorage.setItem(ownerKey, JSON.stringify(this.owner()));
        this.message = ''; void this.run();
      }, error => { this.message = friendlyError(error); void this.render(); });
    } catch (error) { this.message = friendlyError(error); }
    await this.render();
  }
  async accountAction(action) {
    if (!this.auth) return;
    try { await action(); } catch (error) { this.message = friendlyError(error); }
    await this.render();
  }
  async login() {
    const password = byId('sync-password').value;
    byId('sync-password').value = '';
    await this.accountAction(() => signInWithEmailAndPassword(this.auth, byId('sync-email').value.trim(), password));
  }
  async claim() {
    const user = this.user;
    if (!user) return;
    const jobs = (await core.listJobs(this.storage.db)).filter(job => !job.owner);
    if (!jobs.length || !confirm(`${jobs.length} lokale Trainings dem Konto ${user.email} zuordnen und synchronisieren?`)) return;
    if (this.user?.uid !== user.uid) return;
    await core.claimJobs(this.storage.db, jobs.map(job => job.id), { uid: user.uid, projectId: config.projectId });
    await this.run(true);
  }
  async write(payload, uid) {
    await writeSession(this.db, uid, payload);
  }

  async run(force = false) {
    if (this.busy) return;
    clearTimeout(this.timer);
    if (!this.ready || !this.user) { await this.render(); return; }
    this.busy = true; this.message = '';
    try {
      await this.render();
      const uid = this.user.uid;
      const jobs = await core.listJobs(this.storage.db);
      for (const job of jobs) {
        if (this.user?.uid !== uid) break;
        if (job.status === 'synced' || job.owner?.uid !== uid || job.owner?.projectId !== config.projectId) continue;
        if (!force && (job.status === 'error' || job.nextAttemptAt > Date.now())) continue;
        try {
          const result = await core.deliverJob(job, payload => this.write(payload, uid));
          await core.updateJob(this.storage.db, job.id, result);
        } catch (error) {
          const attempts = job.attempts + 1;
          const transient = /unavailable|network|deadline-exceeded|aborted|resource-exhausted/.test(String(error.code));
          await core.updateJob(this.storage.db, job.id, { status: transient ? 'pending' : 'error', attempts, error: friendlyError(error), nextAttemptAt: Date.now() + Math.min(300000, 2000 * 2 ** Math.min(attempts, 8)) + Math.floor(Math.random()*1000) });
        }
      }
    } catch (error) { this.message = friendlyError(error); }
    finally {
      this.busy = false;
      await this.render();
      const pending = (await core.listJobs(this.storage.db)).filter(job => job.status === 'pending' && job.owner?.uid === this.user?.uid && job.owner?.projectId === config.projectId);
      if (pending.length) this.timer = setTimeout(() => void this.run(), Math.max(1000, Math.min(...pending.map(job => job.nextAttemptAt)) - Date.now()));
    }
  }
  async render() {
    const jobs = await core.listJobs(this.storage.db);
    const mine = jobs.filter(job => job.owner?.uid === this.user?.uid && job.owner?.projectId === config.projectId);
    const unassigned = jobs.filter(job => !job.owner);
    const pending = mine.filter(job => job.status !== 'synced');
    const foreign = jobs.filter(job => job.owner && (job.owner.uid !== this.user?.uid || job.owner.projectId !== config.projectId) && job.status !== 'synced');
    const status = this.message || (!this.user ? 'Anmeldung erforderlich' : this.busy ? 'Wird synchronisiert' : pending.find(job => job.error)?.error || (pending.length ? 'Wartet auf Verbindung' : mine.length ? 'Mit Firestore synchronisiert' : 'Keine abgeschlossenen Trainings zur Synchronisierung'));
    document.querySelectorAll('[data-sync-status]').forEach(node => { node.textContent = `${status}${pending.length ? ` · ${pending.length} ausstehend` : ''}${unassigned.length ? ` · ${unassigned.length} ohne Kontozuordnung` : ''}${foreign.length ? ` · ${foreign.length} für ein anderes Konto/Projekt vorgemerkt` : ''}`; });
    byId('sync-account').textContent = this.user ? `Angemeldet: ${this.user.email}` : 'Nicht angemeldet';
    byId('sync-login-form').classList.toggle('hidden', Boolean(this.user));
    byId('sync-login').disabled = !this.auth;
    byId('sync-reset').disabled = !this.auth;
    byId('sync-logout').classList.toggle('hidden', !this.user);
    byId('sync-claim').classList.toggle('hidden', !this.user || !unassigned.length);
    byId('sync-claim').textContent = `${unassigned.length} lokale Trainings zuordnen`;
    document.querySelectorAll('[data-sync-now]').forEach(button => { button.disabled = this.busy; });
    if (typeof app !== 'undefined' && app?.renderRecentTrainingSnapshots) void app.renderRecentTrainingSnapshots();
  }
}
globalThis.trainingSync = new FirestoreSync();
