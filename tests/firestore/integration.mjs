import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { writeSession } from '../../js/firestore-transport.mjs';
import { sessionIdentity, sessionPayload, importEntries } from '../../js/sync-core.mjs';
const env = await initializeTestEnvironment({projectId:'demo-training-sync',firestore:{host:'127.0.0.1',port:8180,rules:await readFile('firestore.rules','utf8')}});
try {
  const alice=env.authenticatedContext('alice').firestore();
  const bob=env.authenticatedContext('bob').firestore();
  const anon=env.unauthenticatedContext().firestore();
  const t={startedAt:new Date(),...sessionIdentity(new Date()),exercises:[{completed:true,calories:35}],cardioEntries:[{calories:120}]};
  const p=sessionPayload(t);const ref=doc(alice,'users/alice/trainingSessions',p.sessionId);
  await Promise.all([writeSession(alice,'alice',p),writeSession(alice,'alice',p)]);
  const original=(await getDoc(ref)).data();
  await writeSession(alice,'alice',p);
  assert((await getDoc(ref)).data().receivedAt.isEqual(original.receivedAt));
  assert.equal((await getDocs(collection(alice,'users/alice/trainingSessions'))).size,1);
  await assert.rejects(writeSession(alice,'alice',{...p,cardioKcal:121}),{code:'sync/conflict'});
  await assertFails(getDoc(doc(bob,ref.path)));await assertFails(getDoc(doc(anon,ref.path)));
  await assertFails(writeSession(bob,'alice',p));
  await assertFails(setDoc(ref,{...p,strengthKcal:500,receivedAt:serverTimestamp()}));
  await assertFails(deleteDoc(ref));
  for(const overrides of [{strengthKcal:-1},{cardioKcal:0.5},{secret:'extra'},{source:'other'},{receivedAt:new Date()}]) {
    const sessionId=crypto.randomUUID();await assertFails(setDoc(doc(alice,'users/alice/trainingSessions',sessionId),{...p,sessionId,receivedAt:serverTimestamp(),...overrides}));
  }
  const imported=new Map();
  for(let retry=0;retry<3;retry++) for(const row of importEntries(original)) imported.set(row.id,row);
  assert.equal(imported.size,2);assert.equal([...imported.values()].reduce((sum,row)=>sum+row.calories,0),155);
  for(const [strengthKcal,cardioKcal] of [[0,0],[10,0],[0,20]]) await assertSucceeds(writeSession(alice,'alice',{...p,sessionId:crypto.randomUUID(),strengthKcal,cardioKcal}));
  console.log('PASS Firestore: parallel replay, original receipt, immutable data, conflict, foreign/anonymous access, invalid payloads, zero categories, idempotent importer');
} finally { await env.cleanup(); }
