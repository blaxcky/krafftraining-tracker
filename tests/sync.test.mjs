import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { changeCurrent, sessionIdentity, sessionPayload, importEntries, finishTraining, ensureIdentity, listJobs, updateJob, claimJobs, mutateTraining, samePayload, deliverJob } from '../js/sync-core.mjs';
const owner = { uid: 'alice', projectId: 'demo-training-sync' };
async function database() {
  return new Promise((resolve,reject) => { const r=indexedDB.open(crypto.randomUUID(),2);r.onupgradeneeded=()=>r.result.createObjectStore('training',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error); });
}
function training(extra={}) { const startedAt=new Date('2000-01-01T21:50:00Z'); return {id:'current',active:true,startedAt,...sessionIdentity(startedAt,owner),exercises:[{completed:true,calories:15},{completed:false,calories:20},{type:'header',completed:true,calories:80},{completed:false,skipped:true,calories:50}],cardioEntries:[{calories:100}],...extra}; }
const put=(db,value)=>mutateTraining(db,store=>store.put(value));
test('separate sums; skipped/open exercises excluded; import IDs are stable',()=>{const t=training();const p=sessionPayload(t);assert.equal(p.strengthKcal,15);assert.equal(p.cardioKcal,100);const rows=new Map();for(let i=0;i<4;i++)for(const row of importEntries(p))rows.set(row.id,row);assert.equal(rows.size,2);assert.equal([...rows.values()].reduce((n,r)=>n+r.calories,0),115);assert(samePayload(p,{...p,receivedAt:'different'}));assert(!samePayload(p,{...p,strengthKcal:16}));});
test('zero, strength only and cardio only produce no spurious entries',()=>{for(const [s,c,count] of [[0,0,0],[20,0,1],[0,30,1]])assert.equal(importEntries({...sessionPayload(training()),strengthKcal:s,cardioKcal:c}).length,count);});
test('start date and zone persist across midnight and later timezone changes',()=>{const t=training({activityDate:'2026-09-27',timeZone:'Europe/Vienna'});const p=sessionPayload(t,new Date('2026-09-28T00:30:00Z'));assert.equal(p.activityDate,'2026-09-27');assert.equal(p.timeZone,'Europe/Vienna');});
test('legacy active training gets one durable identity',async()=>{const db=await database();const t=training();delete t.sessionId;await put(db,t);const first=await ensureIdentity(db,owner);const second=await ensureIdentity(db,{uid:'bob',projectId:owner.projectId});assert.equal(first.sessionId,second.sessionId);assert.deepEqual(second.syncOwner,owner);});
test('concurrent finalization enqueues once and deletes current only after commit',async()=>{const db=await database();await put(db,training());const results=await Promise.all([finishTraining(db,owner),finishTraining(db,owner)]);assert.equal(results.filter(Boolean).length,1);assert.equal((await listJobs(db)).length,1);assert.equal(await ensureIdentity(db,owner),null);});
test('failed finalization preserves active training and creates no job',async()=>{const db=await database();const t=training({cardioEntries:[{calories:-1}]});await put(db,t);await assert.rejects(finishTraining(db,owner));assert.equal((await ensureIdentity(db,owner)).sessionId,t.sessionId);assert.equal((await listJobs(db)).length,0);});
test('database abort on duplicate key rolls deletion back',async()=>{const db=await database();const t=training();await put(db,t);await put(db,{id:`sync:${t.sessionId}`,kind:'firestore-sync'});await assert.rejects(finishTraining(db,owner));assert.equal((await ensureIdentity(db,owner)).sessionId,t.sessionId);});
test('queue exceeds five backups, survives reopen and never reassigns bound jobs',async()=>{let db=await database();const name=db.name;for(let i=0;i<8;i++){await put(db,training({syncOwner:i===0?owner:null}));await finishTraining(db,null);}db.close();db=await new Promise(resolve=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);});const jobs=await listJobs(db);assert.equal(jobs.length,8);await claimJobs(db,jobs.map(j=>j.id),{uid:'bob',projectId:owner.projectId});assert.equal((await listJobs(db)).filter(j=>j.owner.uid==='alice').length,1);assert.equal((await listJobs(db)).filter(j=>j.owner.uid==='bob').length,7);});
test('server success followed by crash replays without double counting',async()=>{const db=await database();await put(db,training());const job=await finishTraining(db,owner);const remote=new Map();const write=async p=>{if(remote.has(p.sessionId)){assert(samePayload(remote.get(p.sessionId),p));return;}remote.set(p.sessionId,p);};await deliverJob(job,write);assert.equal((await listJobs(db))[0].status,'pending');await updateJob(db,job.id,await deliverJob(job,write));assert.equal(remote.size,1);assert.equal((await listJobs(db))[0].status,'synced');await updateJob(db,job.id,{status:'error'});assert.equal((await listJobs(db))[0].status,'synced');});
test('two same-day sessions have distinct identities',()=>{const a=training(),b=training();assert.notEqual(a.sessionId,b.sessionId);assert.equal(a.activityDate,b.activityDate);});

test('late edits cannot resurrect a finished session; earlier edits reach the snapshot', async()=>{
  const db=await database();await put(db,training());
  await Promise.all([changeCurrent(db,t=>{t.cardioEntries.push({calories:40})}),finishTraining(db,owner)]);
  assert.equal((await listJobs(db))[0].payload.cardioKcal,140);
  assert.equal(await changeCurrent(db,t=>{t.cardioEntries.push({calories:99})}),null);
  assert.equal(await ensureIdentity(db,owner),null);
});
