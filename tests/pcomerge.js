const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + ((e.detail&&e.detail.message)||e.message)));
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc, url:'http://localhost/',
  beforeParse(window){
    window.structuredClone = window.structuredClone || (v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
    window.matchMedia = window.matchMedia || (()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
    window.scrollTo=()=>{};
    if(!window.crypto) window.crypto={};
    if(!window.crypto.randomUUID) window.crypto.randomUUID=()=>'x'+Math.random().toString(16).slice(2);
    window.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
    window.Element.prototype.setPointerCapture=function(){};
    window.Element.prototype.releasePointerCapture=function(){};
  }});
const { window } = dom;
const ev = c => window.eval(c);
const doc = window.document;
function check(label, fn){ try{ fn(); console.log('  OK  ',label);}catch(e){ console.log('  FAIL',label,'->',e.message); errors.push(label+': '+e.message);} }
window.addEventListener('load', ()=>setTimeout(()=>{

  console.log('--- applyPcoMerge: apply changes, preserve edits ---');

  function seed(){
    ev(`
      state.vocalists = [
        {id:'vJ',name:'Jake',isWL:true,leadsSongs:true,micAssigned:'Beta 58 #1'},
        {id:'vS',name:'Sophia',isWL:false,leadsSongs:false,micAssigned:'Beta 58 #2'},
        {id:'vZ',name:'Zoe',isWL:false,leadsSongs:false,micAssigned:'Beta 58 #3'}
      ];
      state.assignments = new Array(MAX_VOCALISTS).fill(null);
      state.assignments[2]='vJ'; state.assignments[3]='vS'; state.assignments[4]='vZ';
      state.config.customStagePositions = { vocal_2:{x:400,y:120}, vocal_3:{x:300,y:140} };
      state.instruments.forEach(i => { i.assignedTo=''; });
      var dr = instById('inst_drums'); if(dr){ dr.assignedTo='Sam'; }
      var eg = state.instruments.find(i=>i.label && /electric/i.test(i.label)); if(eg){ eg.assignedTo='Carl'; eg.id='inst_eg1'; }
      state.hosts = {speaker:'',welcomeHost1:'',welcomeHost2:'',hh3:'',hh3IsBaptismal:false};
    `);
  }

  check('hard-remove + decline drop people; positions/mics of others preserved; hand-added kept', ()=>{
    seed();
    const cl = { added:[], declined:[{pcoId:'tm3',name:'Sam',kind:'band',position:'drums'}],
      hardRemoved:[{pcoId:'tm2',name:'Sophia',kind:'vocalist'}],
      roleChanged:[], renamed:[], serviceOrderChanged:false, metaChanged:false, hasChanges:true };
    ev(`applyPcoMerge(${JSON.stringify(cl)}, {meta:{},people:[],serviceOrder:[]})`);
    const names = ev('state.vocalists.map(v=>v.name).join(",")');
    if (/Sophia/.test(names)) throw new Error('Sophia not removed: '+names);
    if (!/Zoe/.test(names)) throw new Error('hand-added Zoe lost: '+names);
    if (ev('state.assignments[2]')!=='vJ') throw new Error('Jake slot moved');
    if (ev('state.config.customStagePositions.vocal_2.x')!==400) throw new Error('Jake custom pos lost');
    if (ev("state.vocalists.find(v=>v.id==='vJ').micAssigned")!=='Beta 58 #1') throw new Error('Jake mic lost');
    if (ev("instById('inst_drums').assignedTo")!=='') throw new Error('Sam not cleared from drums');
  });

  check('add creates a vocalist in a free slot without disturbing existing placements', ()=>{
    seed();
    const cl = { added:[{pcoId:'tm9',name:'Mia',kind:'vocalist',position:'',host:'',isWL:false,leadsSongs:false}],
      declined:[], hardRemoved:[], roleChanged:[], renamed:[], serviceOrderChanged:false, metaChanged:false, hasChanges:true };
    ev(`applyPcoMerge(${JSON.stringify(cl)}, {meta:{},people:[],serviceOrder:[]})`);
    if (!/Mia/.test(ev('state.vocalists.map(v=>v.name).join(",")'))) throw new Error('Mia not added');
    if (ev('state.assignments[2]')!=='vJ' || ev('state.assignments[3]')!=='vS') throw new Error('existing slots disturbed');
    const mia = ev("state.vocalists.find(v=>v.name==='Mia')");
    if (ev(`state.assignments.indexOf("${mia.id}")`) < 0) throw new Error('Mia not placed in a slot');
  });

  check('role change re-slots a band member (eg->keys) and keeps a free keys slot filled', ()=>{
    seed();
    const cl = { added:[], declined:[], hardRemoved:[],
      roleChanged:[{ from:{pcoId:'tm4',name:'Carl',kind:'band',position:'eg'},
                     to:{pcoId:'tm4',name:'Carl',kind:'band',position:'keys'} }],
      renamed:[], serviceOrderChanged:false, metaChanged:false, hasChanges:true };
    ev(`applyPcoMerge(${JSON.stringify(cl)}, {meta:{},people:[],serviceOrder:[]})`);
    if (ev("instById('inst_eg1').assignedTo")==='Carl') throw new Error('Carl still on EG');
    const onKeys = ev(`state.instruments.some(i=>i.assignedTo==='Carl' && /key/i.test(i.label))`);
    if (!onKeys) throw new Error('Carl not moved to a keys slot');
  });

  check('rename updates the live name in place (host/MD override untouched)', ()=>{
    seed();
    ev(`state.hosts.speaker='Pastor Dave';`);
    const cl = { added:[], declined:[], hardRemoved:[], roleChanged:[],
      renamed:[{ from:{pcoId:'tm2',name:'Sophia',kind:'vocalist'}, to:{pcoId:'tm2',name:'Sophia Reyes',kind:'vocalist'} }],
      serviceOrderChanged:false, metaChanged:false, hasChanges:true };
    ev(`applyPcoMerge(${JSON.stringify(cl)}, {meta:{},people:[],serviceOrder:[]})`);
    if (!/Sophia Reyes/.test(ev('state.vocalists.map(v=>v.name).join(",")'))) throw new Error('rename not applied');
    if (ev('state.hosts.speaker')!=='Pastor Dave') throw new Error('host override clobbered');
  });

  check('service order + meta replaced only when flagged', ()=>{
    seed();
    ev(`state.serviceOrder=[{id:'old',title:'Old'}]; state.service={name:'X',date:'2026-01-01'};`);
    const cl = { added:[], declined:[], hardRemoved:[], roleChanged:[], renamed:[],
      serviceOrderChanged:true, metaChanged:true, hasChanges:true };
    const next = { meta:{title:'New Series',date:'2026-07-05'}, people:[],
      serviceOrder:[{id:'i1',kind:'song',title:'Song A',length:240,key:'C',leader:null,notes:'',seq:1}] };
    ev(`applyPcoMerge(${JSON.stringify(cl)}, ${JSON.stringify(next)})`);
    if (ev('state.serviceOrder[0].title')!=='Song A') throw new Error('service order not replaced');
    if (ev('state.service.name')!=='New Series' || ev('state.service.date')!=='2026-07-05') throw new Error('meta not applied');
  });

  check('a person renamed AND role-changed in one pass is moved once, not duplicated', ()=>{
    seed();
    const cl = { added:[], declined:[], hardRemoved:[],
      roleChanged:[{ from:{pcoId:'tm4',name:'Carl',kind:'band',position:'eg'},
                     to:{pcoId:'tm4',name:'Carl Jensen',kind:'band',position:'keys'} }],
      renamed:[{ from:{pcoId:'tm4',name:'Carl',kind:'band',position:'eg'},
                 to:{pcoId:'tm4',name:'Carl Jensen',kind:'band',position:'keys'} }],
      serviceOrderChanged:false, metaChanged:false, hasChanges:true };
    ev(`applyPcoMerge(${JSON.stringify(cl)}, {meta:{},people:[],serviceOrder:[]})`);
    const onKeys = ev(`state.instruments.filter(i=>i.assignedTo==='Carl Jensen').length`);
    if (onKeys !== 1) throw new Error('expected exactly one Carl Jensen slot, got '+onKeys);
    if (ev(`state.instruments.some(i=>i.assignedTo==='Carl')`)) throw new Error('old name "Carl" still present (duplicate)');
    if (ev("instById('inst_eg1').assignedTo")==='Carl Jensen') throw new Error('still on EG');
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
