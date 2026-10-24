import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const expected=JSON.parse(fs.readFileSync(process.env.JEET_INITIAL_BACKUP_FILE,'utf8')).data;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const url='file://'+path.resolve('android/app/src/main/assets/www/index.html');
  await page.goto(url);await page.getByRole('heading',{name:/نسخة أقوى منك/}).waitFor();
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('jeet.v1')));
  const state=await read();assert.deepEqual(state.sessions,expected.sessions);assert.deepEqual(state.measures,expected.measures);
  assert.equal(state.sessions.length,2);assert.equal(state.sessions.flatMap(s=>s.exercises).flatMap(e=>e.sets).length,18);
  await page.reload();await page.getByRole('heading',{name:/نسخة أقوى منك/}).waitFor();assert.deepEqual((await read()).sessions,state.sessions);
  await page.getByRole('button',{name:'التمرين',exact:true}).click();assert.equal(await page.getByLabel('جدول الحصة').inputValue(),'legs');
  await page.getByRole('button',{name:'المزيد',exact:true}).click();
  await page.getByRole('button',{name:'مسح بيانات هذا الجهاز'}).click();await page.getByRole('button',{name:'مسح البيانات',exact:true}).click();
  await page.reload();await page.getByRole('heading',{name:/نسخة أقوى منك/}).waitFor();assert.equal((await read()).sessions.length,0);
  assert.deepEqual(errors,[]);
  console.log('Personal APK verified: both sessions, every set, measurement, persistence, next plan and no reseeding after reset.');
}finally{await browser.close();}
