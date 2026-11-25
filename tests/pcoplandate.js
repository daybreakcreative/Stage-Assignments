// 2026-11-25 — Planning Center's sort_date is a wall clock wearing a "Z" (it is LOCAL time, not UTC).
// The plan picker fed it to new Date() and printed the local date, which subtracts the UTC offset:
// any plan whose first time is before 8:00am Pacific (7:00am in summer) was labelled with the DAY
// BEFORE — a 6:45am Dec 6 plan read "Dec 5". Pick the plan by its label and you pull the wrong week.
// The label now reads the digits, exactly as state.service.date always has.
process.env.TZ='America/Los_Angeles';
const fs=require('fs');const path=require('path');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||path.join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document:doc}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 const labels=()=>[...doc.querySelectorAll('#pcoPlanSelect option')].map(o=>o.textContent);
 check('a 6:45am plan on Dec 6 is labelled Dec 6, not Dec 5', ()=>{
   ev(`pcoPlans=[{id:'p1',name:'Early',dates:'December 6, 2026',sortDate:'2026-12-06T06:45:00Z'}]; populatePlanSelect();`);
   const l=labels().join(' | '); if(!/Dec 6, 2026/.test(l)||/Dec 5/.test(l)) throw new Error(l);
 });
 check('an 8:00am Sunday and a 6:20pm Sunday night keep their own date', ()=>{
   ev(`pcoPlans=[{id:'p1',name:'',dates:'November 29, 2026',sortDate:'2026-11-29T08:00:00Z'},{id:'p2',name:'',dates:'November 29, 2026',sortDate:'2026-11-29T18:20:00Z'},{id:'p3',name:'',dates:'July 4, 2027',sortDate:'2027-07-04T00:30:00Z'}]; populatePlanSelect();`);
   const l=labels(); if(l.filter(x=>/Nov 29, 2026/.test(x)).length!==2) throw new Error(l.join(' | '));
   if(!l.some(x=>/Jul 4, 2027/.test(x))) throw new Error('half past midnight slid to the day before: '+l.join(' | '));
 });
 check('plans still sort nearest-first and keep their title', ()=>{
   ev(`pcoPlans=[{id:'b',name:'Later',dates:'x',sortDate:'2026-12-13T08:00:00Z'},{id:'a',name:'Sooner',dates:'y',sortDate:'2026-12-06T08:00:00Z'}]; populatePlanSelect();`);
   const l=labels(); if(!/Dec 6, 2026 — Sooner/.test(l[1])||!/Dec 13, 2026 — Later/.test(l[2])) throw new Error(l.join(' | '));
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
