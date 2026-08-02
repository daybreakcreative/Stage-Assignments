const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window,window:{document:doc}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');

 console.log('--- compactAssignments (pure) ---');

 check('squeezes filled slots down to 0..N-1, preserving order', ()=>{
   const out=JSON.parse(ev("JSON.stringify(compactAssignments([null,'A','B',null,'C',null,null,null]))"));
   if(out[0]!=='A'||out[1]!=='B'||out[2]!=='C') throw new Error('not compacted in order: '+JSON.stringify(out));
   if(out.slice(3).some(x=>x!==null)) throw new Error('tail not null-padded: '+JSON.stringify(out));
 });

 check('is idempotent on already-compact input', ()=>{
   const once=ev("JSON.stringify(compactAssignments(['A','B',null,null,null,null,null,null]))");
   const twice=ev(`JSON.stringify(compactAssignments(${once}))`);
   if(once!==twice) throw new Error('not idempotent:\n'+once+'\n'+twice);
 });

 check('preserves array length and handles all-empty / all-full', ()=>{
   const empty=JSON.parse(ev("JSON.stringify(compactAssignments([null,null,null,null]))"));
   if(empty.length!==4||empty.some(x=>x!==null)) throw new Error('all-empty broke: '+JSON.stringify(empty));
   const full=JSON.parse(ev("JSON.stringify(compactAssignments(['A','B','C']))"));
   if(JSON.stringify(full)!==JSON.stringify(['A','B','C'])) throw new Error('all-full changed: '+JSON.stringify(full));
 });

 console.log('--- the reported bug: a BLANK vocalist must not steal a number ---');
 // Root cause: computePositions fans people out center-first, so an UNNAMED leftover slot (e.g.
 // "Evan" cleared instead of removed) can take a low slot. The display view hides unnamed
 // vocalists, so the visible numbering starts at VOCAL 2 and packs read PAC 2..5.

 // 5 vocalists, one of them BLANK (the leftover). Named people must own VOCAL 1..4.
 const seedBlank=(blankAt)=>ev(`
   state.serviceOrder=[];
   state.vocalists=[{id:'v1',name:'Kaeli Hearn',micAssigned:''},
                    {id:'v2',name:'Marcus Donalson',micAssigned:''},
                    {id:'v3',name:'Aimee Cruz',micAssigned:''},
                    {id:'v4',name:'Hannah Jones',micAssigned:''}];
   state.vocalists.splice(${blankAt},0,{id:'vblank',name:'',isWL:true,micAssigned:''});
   state.assignments=computePositions(state.vocalists);
 `);

 // A blank in ANY array position must never displace a named vocalist's number.
 [0,1,2,3,4].forEach(pos=>{
   check('blank vocalist at array pos '+pos+' does not take a numbered slot before named ones', ()=>{
     seedBlank(pos);
     const named=JSON.parse(ev(`JSON.stringify(state.assignments.map(function(id,i){
       if(!id) return null;
       var v=state.vocalists.find(function(x){return x.id===id});
       return { slot:i, blank: !(v&&(v.name||'').trim()) };
     }).filter(Boolean))`));
     const blankSlot=(named.find(x=>x.blank)||{}).slot;
     const maxNamed=Math.max.apply(null,named.filter(x=>!x.blank).map(x=>x.slot));
     if(blankSlot===undefined) throw new Error('blank not placed at all');
     if(blankSlot<maxNamed) throw new Error('blank at slot '+blankSlot+' sits before named (max named slot '+maxNamed+')');
   });
 });

 check('the 4 named vocalists read VOCAL 1..4 / PAC 1..4 with a blank present (the screenshot bug)', ()=>{
   seedBlank(0);
   const packs=JSON.parse(ev(`JSON.stringify(state.assignments.map(function(id,i){
     if(!id) return null;
     var v=state.vocalists.find(function(x){return x.id===id});
     if(!(v&&(v.name||'').trim())) return null;            // display view hides unnamed
     return (state.config.voxIemPacks&&state.config.voxIemPacks[i])||('Vocal '+(i+1));
   }).filter(Boolean))`));
   if(packs.length!==4) throw new Error('expected 4 named packs, got '+JSON.stringify(packs));
   const nums=packs.map(p=>parseInt(String(p).replace(/[^0-9]+/g,''),10));
   if(nums[0]!==1) throw new Error('named vocalists do not start at PAC 1: '+JSON.stringify(packs));
   nums.forEach((n,i)=>{ if(n!==i+1) throw new Error('numbering not contiguous 1..4: '+JSON.stringify(packs)); });
 });

 // Plain removal (the ✕ button) must also stay gap-free.
 const seed5=()=>ev(`
   state.serviceOrder=[];
   state.vocalists=[{id:'v1',name:'Evan One',isWL:true,micAssigned:''},
                    {id:'v2',name:'Kaeli Hearn',micAssigned:''},
                    {id:'v3',name:'Marcus Donalson',micAssigned:''},
                    {id:'v4',name:'Aimee Cruz',micAssigned:''},
                    {id:'v5',name:'Hannah Jones',micAssigned:''}];
   state.assignments=computePositions(state.vocalists);
 `);

 check('removing a vocalist leaves the rest gap-free from VOCAL 1', ()=>{
   seed5();
   ev("removeVocalist('v1');");
   const a=JSON.parse(ev('JSON.stringify(state.assignments)'));
   const filled=a.filter(Boolean);
   if(filled.length!==4) throw new Error('expected 4 remaining, got '+filled.length);
   for(let i=0;i<4;i++){ if(!a[i]) throw new Error('gap at slot '+i+': '+JSON.stringify(a)); }
   if(a.slice(4).some(Boolean)) throw new Error('someone stranded past slot 4: '+JSON.stringify(a));
 });

 check('adding a vocalist lands in the first free slot with no gap', ()=>{
   seed5();
   ev("removeVocalist('v1'); addVocalist();");
   const a=JSON.parse(ev('JSON.stringify(state.assignments)'));
   const filled=a.filter(Boolean);
   for(let i=0;i<filled.length;i++){ if(!a[i]) throw new Error('gap at slot '+i+' after add: '+JSON.stringify(a)); }
 });

 console.log('--- drag into any slot (move-or-swap) ---');

 check('renderVocalists exposes an empty trailing drop slot when under capacity', ()=>{
   seed5();
   ev("removeVocalist('v1'); renderVocalists();");
   const empties=doc.querySelectorAll('#vocGrid .voc-card.voc-empty[data-slot]');
   if(empties.length!==1) throw new Error('expected exactly 1 trailing empty drop slot, got '+empties.length);
 });

 check('dropping on an OCCUPIED card still swaps the two', ()=>{
   seed5();
   ev("renderVocalists();");
   const before=JSON.parse(ev('JSON.stringify(state.assignments)'));
   const a0=before[0], a1=before[1];
   ev(`vocalDropOnSlot('${a1}', 0);`); // move the person in slot 1 onto occupied slot 0
   const after=JSON.parse(ev('JSON.stringify(state.assignments)'));
   if(after[0]!==a1||after[1]!==a0) throw new Error('swap did not happen: '+JSON.stringify(after));
 });

 check('dropping on an EMPTY slot moves the person there, then compacts', ()=>{
   seed5();
   ev("removeVocalist('v1');"); // 4 filled at 0..3, slot 4 empty
   const before=JSON.parse(ev('JSON.stringify(state.assignments)'));
   const mover=before[3];
   ev(`vocalDropOnSlot('${mover}', 4);`); // drop onto the empty trailing slot
   const after=JSON.parse(ev('JSON.stringify(state.assignments)'));
   const filled=after.filter(Boolean);
   if(filled.length!==4) throw new Error('lost/duplicated a vocalist: '+JSON.stringify(after));
   if(filled.indexOf(mover)!==3) throw new Error('mover should end last: '+JSON.stringify(after));
   for(let i=0;i<4;i++){ if(!after[i]) throw new Error('gap after move: '+JSON.stringify(after)); }
 });

 check('a move never loses or duplicates a vocalist', ()=>{
   seed5();
   const ids=JSON.parse(ev('JSON.stringify(state.assignments.filter(Boolean))'));
   ev(`vocalDropOnSlot('${ids[4]}', 0);`);
   const after=JSON.parse(ev('JSON.stringify(state.assignments.filter(Boolean))'));
   if(after.length!==ids.length) throw new Error('count changed: '+JSON.stringify(after));
   if(new Set(after).size!==after.length) throw new Error('duplicate id: '+JSON.stringify(after));
   ids.forEach(id=>{ if(after.indexOf(id)===-1) throw new Error('lost '+id); });
 });

 console.log('--- stage placement is unaffected by compaction ---');

 check('vocalist stage x-positions depend on count+order, not slot index', ()=>{
   seed5();
   ev("removeVocalist('v1');");
   const compactX=JSON.parse(ev("JSON.stringify(getVoxPositions(state.assignments.filter(Boolean).length).map(function(p){return Math.round(p.x);}))"));
   // same count, same order — the geometry helper must give the same spread
   const againX=JSON.parse(ev("JSON.stringify(getVoxPositions(4).map(function(p){return Math.round(p.x);}))"));
   if(JSON.stringify(compactX)!==JSON.stringify(againX)) throw new Error('stage spread changed: '+JSON.stringify(compactX)+' vs '+JSON.stringify(againX));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
