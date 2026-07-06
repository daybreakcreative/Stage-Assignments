// #9 Stage 1 — IEM mix names drop the redundant " Pack" suffix, and loadState migrates
// old saves ("Misc 2 Pack" → "Misc 2") across instruments, shadows, presets, vocal, shadowPack.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{

 check('stripPackName strips the " Pack" suffix and never blanks a name', ()=>{
   if(ev(`stripPackName('Misc 2 Pack')`)!=='Misc 2') throw new Error('Misc 2 Pack -> '+ev(`stripPackName('Misc 2 Pack')`));
   if(ev(`stripPackName('Vocal 3 Pack')`)!=='Vocal 3') throw new Error('Vocal 3 Pack');
   if(ev(`stripPackName('EG')`)!=='EG') throw new Error('idempotent: EG should stay EG');
   if(ev(`stripPackName('Pack')`)!=='Pack') throw new Error('a name that is only "Pack" must not blank out');
 });

 check('defaults carry no " Pack" suffix (inventory, instruments, vocal, shadow)', ()=>{
   if(ev(`DEFAULT_IEM_PACK_PRESETS.some(p=>/ pack$/i.test(p))`)) throw new Error('default presets still suffixed');
   if(ev(`DEFAULT_INSTRUMENTS.some(i=>/ pack$/i.test(i.pack||''))`)) throw new Error('default instrument packs still suffixed');
   if(ev(`(DEFAULT_STATE.config.voxIemPacks||[]).some(p=>/ pack$/i.test(p))`)) throw new Error('default vocal packs still suffixed');
   if(/ pack$/i.test(ev(`DEFAULT_STATE.config.shadowPack`))) throw new Error('default shadowPack still suffixed');
 });

 check('iemPackFor fallback (unassigned pack) has no " Pack" suffix', ()=>{
   ev(`state.instruments=[{id:'x',label:'Keys',pack:''}]`);
   const v=ev(`iemPackFor('x')`);
   if(/ pack$/i.test(v)) throw new Error('iemPackFor fallback still suffixed: '+v);
 });

 check('loadState migrates a legacy save: strips " Pack" everywhere', ()=>{
   const old = {
     instruments:[{id:'inst_drums',label:'Drums',pack:'Drum Pack'}],
     shadows:[{id:'s1',name:'Bri',pack:'EG Pack'}],
     config:{ iemPackPresets:['Misc 1 Pack','Misc 2 Pack'], voxIemPacks:['Vocal 1 Pack','Vocal 2 Pack'], shadowPack:'Misc 2 Pack' }
   };
   ev(`localStorage.setItem('stageAssign.v3', ${JSON.stringify(JSON.stringify(old))})`);
   ev(`window.__m = loadState()`);
   if(ev(`window.__m.instruments[0].pack`)!=='Drum') throw new Error('inst pack not migrated: '+ev(`window.__m.instruments[0].pack`));
   if(ev(`window.__m.shadows[0].pack`)!=='EG') throw new Error('shadow pack not migrated');
   if(ev(`window.__m.config.iemPackPresets.join('|')`)!=='Misc 1|Misc 2') throw new Error('presets not migrated: '+ev(`window.__m.config.iemPackPresets.join('|')`));
   if(ev(`window.__m.config.voxIemPacks.slice(0,2).join('|')`)!=='Vocal 1|Vocal 2') throw new Error('vox not migrated');
   if(ev(`window.__m.config.shadowPack`)!=='Misc 2') throw new Error('shadowPack not migrated');
   ev(`localStorage.removeItem('stageAssign.v3')`);
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
