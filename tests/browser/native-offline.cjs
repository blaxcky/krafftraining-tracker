const {_android}=require('playwright');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const adb=(...args)=>execFileSync(process.env.ADB_PATH || 'adb',['-s','emulator-5580',...args]);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function poll(fn,label){for(let i=0;i<300;i++){if(await fn())return;await sleep(100);}throw new Error(label);}
(async()=>{
 const device=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()==='emulator-5580');
 let page=await(await device.webView({pkg:'com.blaxcky.krafttrainingtracker'})).page();
 assert.equal(await page.evaluate(()=>FIREBASE_CONFIG.projectId),'demo-training-sync');
 assert(await page.evaluate(()=>Boolean(trainingSync.user)));
 await page.evaluate(()=>{void trainingSync.run(true)});
 await poll(()=>page.evaluate(async()=>(await SyncCore.listJobs(storage.db)).every(j=>j.status==='synced')),'initial drain');
 const before=await page.evaluate(async()=>(await SyncCore.listJobs(storage.db)).length);
 try {
  adb('reverse','--remove','tcp:8180');adb('reverse','--remove','tcp:9199');
  adb('shell','cmd','connectivity','airplane-mode','enable');adb('shell','svc','wifi','disable');
  adb('shell','am','force-stop','com.blaxcky.krafttrainingtracker');await sleep(1500);
  adb('shell','am','start','-n','com.blaxcky.krafttrainingtracker/.MainActivity');await sleep(1500);
  page=await(await device.webView({pkg:'com.blaxcky.krafttrainingtracker'})).page();
  await poll(()=>page.evaluate(()=>typeof trainingSync!=='undefined' && trainingSync.ready),'offline launch');
  page.on('dialog',d=>d.accept());
  await page.evaluate(async()=>{for(let i=0;i<6;i++){await storage.startTraining();await storage.addCardioToSession('Offline QA',i+1);await app.endTraining();}});
  assert.equal(await page.evaluate(async()=>(await SyncCore.listJobs(storage.db)).filter(j=>j.status!=='synced').length),6);
  adb('shell','am','force-stop','com.blaxcky.krafttrainingtracker');await sleep(1500);
  adb('shell','am','start','-n','com.blaxcky.krafttrainingtracker/.MainActivity');await sleep(1500);
  page=await(await device.webView({pkg:'com.blaxcky.krafttrainingtracker'})).page();
  await poll(()=>page.evaluate(()=>typeof trainingSync!=='undefined' && trainingSync.ready),'cold start');
  assert.equal(await page.evaluate(async()=>(await SyncCore.listJobs(storage.db)).length),before+6);
  assert.equal(await page.evaluate(async()=>(await SyncCore.listJobs(storage.db)).filter(j=>j.status!=='synced').length),6);
  adb('shell','cmd','connectivity','airplane-mode','disable');adb('shell','svc','wifi','enable');
  adb('reverse','tcp:8180','tcp:8180');adb('reverse','tcp:9199','tcp:9199');
  await page.evaluate(()=>{void trainingSync.run(true)});
  await poll(()=>page.evaluate(async()=>(await SyncCore.listJobs(storage.db)).every(j=>j.status==='synced')),'reconnect drain');
  console.log('PASS Android offline: six queued sessions survive process death; reconnect syncs all');
 } finally {
  adb('shell','cmd','connectivity','airplane-mode','disable');adb('shell','svc','wifi','enable');
  adb('reverse','tcp:8180','tcp:8180');adb('reverse','tcp:9199','tcp:9199');await device.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
