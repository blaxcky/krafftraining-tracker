const { chromium, _android } = require('playwright');
const assert = require('node:assert/strict');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function poll(check, label) { const until = Date.now()+30000; do { if(await check()) return; await sleep(100); } while(Date.now()<until); throw new Error(`Timeout: ${label}`); }
(async () => {
  let browser, device, context, page;
  if(process.env.NATIVE) { device=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()==='emulator-5580');page=await(await device.webView({pkg:'com.blaxcky.krafttrainingtracker'})).page(); }
  else { browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined,args:['--no-sandbox']});context=await browser.newContext({viewport:{width:412,height:850},hasTouch:true,isMobile:true});page=await context.newPage(); }
  const cdp = device ? await page.context().newCDPSession(page) : null;
  async function tap(locator) {
    if (!cdp) return locator.tap();
    await locator.click({trial:true});
    await locator.evaluate(element => { window.__qaClicked = false; element.addEventListener('click', () => { window.__qaClicked = true; }, { once: true }); });
    const box = await locator.boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await poll(() => page.evaluate(() => window.__qaClicked), 'native click delivery');
  }
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  if(context) await page.goto('http://127.0.0.1:8080');
  await poll(()=>page.evaluate(()=>typeof trainingSync!=='undefined' && trainingSync.ready),'app init');
  assert.equal(await page.evaluate(()=>FIREBASE_CONFIG.projectId), 'demo-training-sync');
  await tap(page.locator('#tab-settings'));
  if (await page.locator('#sync-logout').isVisible()) await tap(page.locator('#sync-logout'));
  await poll(() => page.evaluate(() => !trainingSync.user), 'logged out fixture');
  await page.evaluate(() => localStorage.removeItem('krafttraining_sync_owner'));

  await page.evaluate(async()=>{if(await storage.getCurrentTraining())await storage.endTraining();const e=await storage.addExercise('Button QA',68,0,35);await storage.startTraining();await app.loadTraining();app.switchTab('training',{animate:false});});
  const card=page.locator('.exercise-swipe').filter({hasText:'Button QA'}).last();const id=Number(await card.getAttribute('data-training-exercise-id'));
  const exercise=()=>page.evaluate(async id=>(await storage.getCurrentTraining()).exercises.find(e=>e.id===id),id);
  await tap(card.locator('[onclick*="toggleTrainingExerciseLock"]'));await poll(()=>card.locator('.weight-adj-btn').first().isEnabled(),'unlock');
  await tap(card.locator('.weight-adj-btn').last());await poll(async()=>(await exercise()).baseWeight===69,'plus');
  await tap(card.locator('.weight-adj-btn').first());await poll(async()=>(await exercise()).baseWeight===68,'minus');
  const plates=card.locator('label').filter({has:page.locator('input[type=checkbox]')});
  await tap(plates.nth(1));await poll(async()=>(await exercise()).additionalPlates===2,'plate 2');await sleep(200);
  await tap(plates.first());await poll(async()=>(await exercise()).additionalPlates===0,'plates off');await sleep(200);
  await tap(plates.first());await poll(async()=>(await exercise()).additionalPlates===1,'plate 1');
  await page.reload();await poll(()=>page.evaluate(()=>trainingSync.ready),'reload');
  assert.equal((await exercise()).baseWeight,68);assert.equal((await exercise()).additionalPlates,1);
  await tap(page.locator('#tab-training'));assert(await card.locator('.weight-adj-btn').first().isDisabled());
  await card.click({trial:true});const box=await card.boundingBox();await page.mouse.move(box.x+30,box.y+25);await page.mouse.down();await page.mouse.move(box.x+220,box.y+25,{steps:12});await page.mouse.up();await poll(async()=>(await exercise()).completed,'swipe');
  await page.evaluate(()=>storage.addCardioToSession('QA cardio',120));await tap(page.locator('#end-training-btn'));await poll(()=>page.evaluate(async()=>!(await storage.getCurrentTraining())),'finish');
  const jobs=()=>page.evaluate(()=>SyncCore.listJobs(storage.db));assert((await jobs()).some(j=>j.payload.strengthKcal===35 && j.payload.cardioKcal===120));
  await tap(page.locator('#tab-settings'));
  const email=`sync-${Date.now()}@example.test`,password='Example-test-1234';
  const signup=await fetch('http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});assert(signup.ok);const account=await signup.json();
  if(await page.locator('#sync-logout').isVisible())await tap(page.locator('#sync-logout'));
  await page.fill('#sync-email',email);await page.fill('#sync-password',password);await tap(page.locator('#sync-login'));await poll(()=>page.evaluate(()=>Boolean(trainingSync.user)),'login');
  if(await page.locator('#sync-claim').isVisible())await tap(page.locator('#sync-claim'));
  await poll(async()=>(await jobs()).filter(j=>j.owner?.uid===account.localId).every(j=>j.status==='synced') && (await jobs()).some(j=>j.owner?.uid===account.localId),'sync');
  const synced=(await jobs()).filter(j=>j.owner?.uid===account.localId);assert(synced.length>0);
  await tap(page.locator('[data-sync-now]').last());await poll(()=>page.evaluate(()=>!trainingSync.busy),'repeat');
  if(context) {
    await context.setOffline(true);
    await page.evaluate(async()=>{await storage.startTraining();await app.loadTraining();app.switchTab('training',{animate:false});});
    await tap(page.locator('#end-training-btn'));await poll(async()=>(await jobs()).some(j=>j.status==='pending' && j.owner?.uid===account.localId),'offline queue');
    await page.reload();await poll(()=>page.evaluate(()=>trainingSync.ready),'offline reload');assert((await jobs()).some(j=>j.status==='pending'));
    await context.setOffline(false);await page.evaluate(()=>trainingSync.run(true));await poll(async()=>(await jobs()).filter(j=>j.owner?.uid===account.localId).every(j=>j.status==='synced'),'reconnect');
  }
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),await page.evaluate(()=>innerWidth));
  await page.screenshot({path:process.env.NATIVE?'/tmp/training-sync-android.png':'/tmp/training-sync-browser.png'});
  console.log('PASS touch controls, swipe, persistence, finalization, login, explicit claim, server sync, replay'+(context?', offline reload and reconnect':''));
  await browser?.close();await device?.close();
})().catch(error=>{console.error(error);process.exit(1)});
