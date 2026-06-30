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
async function check(label, fn){ try{ await fn(); console.log('  OK  ',label);}catch(e){ console.log('  FAIL',label,'->',e.message); errors.push(label+': '+e.message);} }
window.addEventListener('load', ()=>setTimeout(async ()=>{

  console.log('--- pcoMergeRefresh guards ---');

  // Stub network + connection. Track fetches. pcoTokens must be truthy so the connection guard passes.
  ev(`
    window.__fetchCount = 0;
    window.__nextTM = { data:[ {id:'tm1',attributes:{name:'Jake',team_position_name:'Worship Leader',status:'C'}} ] };
    pcoFetch = async function(p){
      window.__fetchCount++;
      if (/team_members/.test(p)) return window.__nextTM;
      if (/\\/plans\\//.test(p) && !/items/.test(p)) return { data:{ attributes:{ title:'T', sort_date:'2026-07-05T00:00:00Z' } } };
      return { data:[], included:[] };
    };
    pcoTokens = { access_token:'tok', expires_at: 9999999999999 };
    state.pcoConfig.selectedServiceTypeId='st1';
    state.pcoConfig.selectedPlanId='p1';
    state.config.autoRefreshPaused=false;
  `);

  await check('skips quietly when no plan selected', async()=>{
    ev(`state.pcoConfig.selectedPlanId=''; window.__fetchCount=0;`);
    await ev('pcoMergeRefresh()');
    if (ev('window.__fetchCount')!==0) throw new Error('fetched with no plan');
    ev(`state.pcoConfig.selectedPlanId='p1';`);
  });
  await check('skips while editing layout', async()=>{
    ev(`document.body.classList.add('stage-editing'); window.__fetchCount=0;`);
    await ev('pcoMergeRefresh()');
    ev(`document.body.classList.remove('stage-editing');`);
    if (ev('window.__fetchCount')!==0) throw new Error('fetched while editing');
  });
  await check('skips when paused', async()=>{
    ev(`state.config.autoRefreshPaused=true; window.__fetchCount=0;`);
    await ev('pcoMergeRefresh()');
    ev(`state.config.autoRefreshPaused=false;`);
    if (ev('window.__fetchCount')!==0) throw new Error('fetched while paused');
  });
  await check('a real refresh fetches, merges, and updates the baseline', async()=>{
    ev(`state.pcoBaseline = { planId:'p1', meta:{title:'T',date:'2026-07-05'}, serviceOrder:[], people:[] };
        state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); window.__fetchCount=0;`);
    await ev('pcoMergeRefresh()');
    if (ev('window.__fetchCount') < 1) throw new Error('did not fetch');
    if (!/Jake/.test(ev('state.vocalists.map(v=>v.name).join(",")'))) throw new Error('Jake not merged in');
    if (ev('state.pcoBaseline.people.length')!==1) throw new Error('baseline not updated');
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
