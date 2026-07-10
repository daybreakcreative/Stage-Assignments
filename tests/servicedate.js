// servicedate.js — the service date defaults to the UPCOMING SUNDAY, not today.
// upcomingSunday() returns the nearest Sunday >= today as 'YYYY-MM-DD' (today if today
// is Sunday). Both DEFAULT_STATE.service.date and resetAll() use it.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
 w.confirm=()=>true;w.prompt=()=>'';
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

// Local today as YYYY-MM-DD, matching how upcomingSunday() computes (local, not UTC).
function localTodayISO(){
 const d=new Date();
 const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
 return `${y}-${m}-${day}`;
}

window.addEventListener('load',()=>setTimeout(()=>{
 ev('renderAll=function(){}; renderStage=function(){}; renderDisplayView=function(){}; renderBand=function(){}; toast=function(){};');

 check('upcomingSunday() returns a Sunday (getDay()===0)', ()=>{
   const s=ev('upcomingSunday()');
   if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('bad format: '+s);
   const day=new Date(s+'T00:00').getDay();
   if(day!==0) throw new Error('not a Sunday, getDay()='+day+' ('+s+')');
 });

 check('upcomingSunday() >= today (local ISO)', ()=>{
   const s=ev('upcomingSunday()');
   const t=localTodayISO();
   if(!(s>=t)) throw new Error('upcomingSunday '+s+' is before today '+t);
   // and it is within the next 7 days
   const diffDays=Math.round((new Date(s+'T00:00')-new Date(t+'T00:00'))/86400000);
   if(diffDays<0||diffDays>6) throw new Error('unexpected distance to Sunday: '+diffDays+' days');
 });

 check('DEFAULT_STATE.service.date is the upcoming Sunday', ()=>{
   const d=ev('DEFAULT_STATE.service.date');
   if(new Date(d+'T00:00').getDay()!==0) throw new Error('DEFAULT_STATE date not a Sunday: '+d);
   if(d!==ev('upcomingSunday()')) throw new Error('DEFAULT_STATE date ('+d+') != upcomingSunday() ('+ev('upcomingSunday()')+')');
 });

 check('resetAll() (confirm stubbed true) yields a Sunday service.date', ()=>{
   // Dirty the date first, then reset.
   ev('state.service.date="2000-01-03";'); // a Monday
   ev('resetAll()');
   const d=ev('state.service.date');
   if(new Date(d+'T00:00').getDay()!==0) throw new Error('after resetAll, date not a Sunday: '+d);
   if(d!==ev('upcomingSunday()')) throw new Error('after resetAll, date ('+d+') != upcomingSunday()');
 });

 check('app still boots (no jsdomError from calling upcomingSunday() inside DEFAULT_STATE)', ()=>{
   if(errs.some(e=>/upcomingSunday|is not defined/i.test(String(e)))) throw new Error('boot error referencing upcomingSunday');
   if(typeof ev('typeof state')==='undefined') throw new Error('no state after boot');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},200));
