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

  console.log('--- derivePcoModel ---');
  const TM = JSON.stringify({ data: [
    { id:'tm1', attributes:{ name:'Jake Williams', team_position_name:'Worship Leader', status:'C' } },
    { id:'tm2', attributes:{ name:'Sophia Davis',  team_position_name:'Vocals',         status:'C' } },
    { id:'tm3', attributes:{ name:'Sam Rodriguez',  team_position_name:'Drums',          status:'D' } },
    { id:'tm4', attributes:{ name:'Carlos Brown',   team_position_name:'Keys',           status:'C' } },
    { id:'tm5', attributes:{ name:'Pat Usher',      team_position_name:'Usher',          status:'C' } }
  ]});
  const PLAN = JSON.stringify({ attributes:{ series_title:'Grace', sort_date:'2026-07-05T10:00:00Z' } });
  const ITEMS = JSON.stringify({ data:[
    { id:'i1', attributes:{ sequence:2, item_type:'song', title:'Song B', length:300, key_name:'G' } },
    { id:'i2', attributes:{ sequence:1, item_type:'song', title:'Song A', length:240, key_name:'C' } }
  ], included:[] });

  check('derivePcoModel returns people with pcoId + status, ignores Ushers', ()=>{
    const m = ev(`derivePcoModel(${PLAN}, ${TM}, ${ITEMS})`);
    const ids = m.people.map(p=>p.pcoId).sort().join(',');
    if (ids !== 'tm1,tm2,tm3,tm4') throw new Error('people wrong: '+ids);   // tm5 Usher ignored
    const jake = m.people.find(p=>p.pcoId==='tm1');
    if (jake.kind!=='vocalist' || !jake.isWL) throw new Error('Jake not WL vocalist');
    const sam = m.people.find(p=>p.pcoId==='tm3');
    if (sam.status!=='D' || sam.kind!=='band' || sam.position!=='drums') throw new Error('Sam not declined drummer');
  });
  check('derivePcoModel meta + service order sorted by sequence', ()=>{
    const m = ev(`derivePcoModel(${PLAN}, ${TM}, ${ITEMS})`);
    if (m.meta.title!=='Grace' || m.meta.date!=='2026-07-05') throw new Error('meta wrong: '+JSON.stringify(m.meta));
    if (m.serviceOrder.map(s=>s.title).join(',')!=='Song A,Song B') throw new Error('order wrong');
    if (m.serviceOrder[0].key!=='C') throw new Error('key not parsed');
  });

  check('derivePcoModel parses leader + description notes on a service item', ()=>{
    const items = JSON.stringify({ data:[
      { id:'i1', attributes:{ sequence:1, item_type:'song', title:'Song A', length:240, key_name:'C', description:'Capo 2' } }
    ], included:[
      { type:'ItemNote', attributes:{ category_name:'Song Leader', content:'Jake' }, relationships:{ item:{ data:{ id:'i1' } } } },
      { type:'ItemNote', attributes:{ category_name:'General', content:'Pad swell' }, relationships:{ item:{ data:{ id:'i1' } } } }
    ]});
    const m = ev(`derivePcoModel(${PLAN}, ${TM}, ${items})`);
    const s = m.serviceOrder[0];
    if (s.leader!=='Jake') throw new Error('leader not parsed: '+s.leader);
    if (!/Capo 2/.test(s.notes) || !/Pad swell/.test(s.notes)) throw new Error('notes not combined: '+s.notes);
  });
  check('a destructive pull writes state.pcoBaseline with planId + people', ()=>{
    ev(`state.pcoConfig.selectedPlanId='p9';`);
    ev(`applyPCOPlanData(${PLAN}, ${TM}, ${ITEMS})`);
    if (!ev('state.pcoBaseline')) throw new Error('baseline not written');
    if (ev('state.pcoBaseline.planId')!=='p9') throw new Error('planId missing');
    if (ev('state.pcoBaseline.people.length') < 1) throw new Error('no people in baseline');
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
