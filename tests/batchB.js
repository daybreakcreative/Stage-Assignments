// batchB: mic settings restructure — one Mics tab, no Leader Mics, no no-mic, new priority, Preferred Mic column
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const mic = id => ev(`state.vocalists.find(v=>v.id==="${id}").micAssigned`);
window.addEventListener('load',()=>setTimeout(()=>{
 ev('renderAll=function(){};toast=function(){};');

 check('only ONE mics tab remains — the "prefs" tab button + panel are gone', ()=>{
   if(doc.querySelector('.tab[data-tab="prefs"]')) throw new Error('prefs tab button still present');
   if(doc.getElementById('tab-prefs')) throw new Error('tab-prefs panel still present');
   // the single mics tab still exists and still holds the inventory + prefs editors
   if(!doc.querySelector('.tab[data-tab="inventory"]')) throw new Error('inventory (Mics) tab missing');
   if(!doc.getElementById('invEdit')) throw new Error('invEdit container missing');
   if(!doc.getElementById('prefEdit')) throw new Error('prefEdit container missing under Mics tab');
   // prefEdit must live inside the inventory panel now
   if(!doc.getElementById('tab-inventory').contains(doc.getElementById('prefEdit')))
     throw new Error('prefEdit is not inside the Mics tab panel');
 });

 // seed + render the mic settings
 const seed = () => {
   ev('state.inventory=[{name:"KMS105",total:1,rank:1,wireless:true},{name:"Beta 58A",total:2,rank:2,wireless:true},{name:"SM58",total:4,rank:3,wireless:false},{name:"D:Facto",total:1,rank:4,wireless:false}]');
   ev('state.config.micPrefs={leaderMics:[],people:{}}');
   ev('state.vocalists=[{id:"g",name:"Grayson",isWL:true,leadsSongs:true,micAssigned:""},{id:"o",name:"Mo",isWL:false,leadsSongs:false,micAssigned:""}]');
   ev('renderInvEditor()');ev('renderPrefEditor()');
 };

 check('no "Leader Mics" section/text in the mic settings DOM', ()=>{
   seed();
   const panel=doc.getElementById('tab-inventory').innerHTML;
   if(/leader mic/i.test(panel)) throw new Error('"leader mic" text still present in mic settings');
   if(doc.querySelector('#prefEdit [data-leadermic]')) throw new Error('leader-mic chip still rendered');
   if(doc.querySelector('#prefEdit .lm-grid')) throw new Error('leader-mic grid still rendered');
 });

 check('no "no mic" / "silent" verbiage anywhere in the mic settings DOM', ()=>{
   seed();
   const panel=doc.getElementById('tab-inventory').innerHTML;
   if(/no mic/i.test(panel)) throw new Error('"no mic" text still in mic settings');
   if(/silent/i.test(panel)) throw new Error('"silent" text still in mic settings');
   if(doc.querySelector('#prefEdit .pp-nomic')) throw new Error('pp-nomic checkbox still rendered');
 });

 check('vocalist card no longer renders a no-mic toggle', ()=>{
   ev('state.config.showMicCapsules=true');
   ev('state.assignments=computePositions(state.vocalists)');
   ev('renderVocalists()');
   if(doc.querySelector('#vocGrid .voc-nomic-toggle')) throw new Error('voc-nomic-toggle still on a card');
 });

 check('priority text lists the three new lines in order', ()=>{
   seed();
   const txt=doc.getElementById('prefEdit').textContent.replace(/\s+/g,' ');
   const need=[
     'Song leaders get their remembered mic',
     "A person's locked mic",
     'Otherwise, the best available mic'
   ];
   let last=-1;
   need.forEach(s=>{
     const i=txt.indexOf(s);
     if(i===-1) throw new Error('missing priority line: '+s);
     if(i<last) throw new Error('priority lines out of order at: '+s);
     last=i;
   });
   if(!/priority order/i.test(txt)) throw new Error('missing "priority order" heading text');
 });

 check('engine order: leader→remembered, locked→locked, plain→best remaining', ()=>{
   ev('state.inventory=[{name:"KMS105",total:1,rank:1},{name:"Beta 58A",total:1,rank:2},{name:"SM58",total:4,rank:3},{name:"D:Facto",total:1,rank:4}]');
   ev('state.config.micPrefs={leaderMics:[],people:{}}');
   // leader (WL) with a remembered mic, a locked non-leader, and a plain vocalist
   ev('state.vocalists=[{id:"g",name:"Grayson",isWL:true,leadsSongs:true,micAssigned:""},{id:"o",name:"Mo",isWL:false,leadsSongs:false,micAssigned:""},{id:"p",name:"Pat",isWL:false,leadsSongs:false,micAssigned:""}]');
   ev('setMicRemembered("Grayson","SM58"); saveState()');   // leader remembers SM58
   ev('setMicLock("Mo","D:Facto")');                         // Mo locked to D:Facto
   ev('assignMicsToVocalists()');
   if(mic('g')!=='SM58') throw new Error('leader should get remembered SM58, got '+mic('g'));
   if(mic('o')!=='D:Facto') throw new Error('locked Mo should get D:Facto, got '+mic('o'));
   if(mic('p')!=='KMS105') throw new Error('plain Pat should get best remaining KMS105, got '+mic('p'));
 });

 check('assignments view shows a "Preferred Mic" header (not "Mic now")', ()=>{
   seed();
   const heads=[...doc.querySelectorAll('#prefEdit .pref-table thead th')].map(th=>th.textContent.trim().toLowerCase());
   if(!heads.includes('preferred mic')) throw new Error('no "Preferred Mic" header, got '+JSON.stringify(heads));
   if(heads.some(h=>/mic now/.test(h))) throw new Error('"Mic now" header still present');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},200));
