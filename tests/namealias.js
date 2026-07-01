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

  console.log('--- preferred-name aliases ---');
  check('setPreferredName records alias + renames the live vocalist + carries setup bucket', ()=>{
    ev(`state.nameAliases={}; state.setupItems={}; state.config.setupDefaults={vocals:{selections:{options:['v_stand']},customOptions:[]}};`);
    ev(`state.vocalists=[{id:'v1',name:'Catherine Smith',isWL:false,leadsSongs:false,micAssigned:''}];`);
    const oldK = ev(`stableSetupKey('Catherine Smith','vocalist','vocals')`);
    ev(`seedPersonSetup('${oldK}','vocals');`);
    ev(`setPreferredName('Catherine Smith','Cat')`);
    if (ev(`state.vocalists[0].name`) !== 'Cat') throw new Error('vocalist not renamed');
    if (ev(`state.nameAliases['catherine smith']`) !== 'Cat') throw new Error('alias not recorded');
    const newK = ev(`stableSetupKey('Cat','vocalist','vocals')`);
    if (!ev(`state.setupItems['${newK}']`)) throw new Error('setup bucket not carried to new key');
    if (ev(`state.setupItems['${oldK}']`)) throw new Error('old setup key not removed');
  });
  check('applyNameAlias returns preferred for an aliased official name', ()=>{
    if (ev(`applyNameAlias('Catherine Smith')`) !== 'Cat') throw new Error('alias not applied');
    if (ev(`applyNameAlias('Someone Else')`) !== 'Someone Else') throw new Error('non-aliased name changed');
  });
  check('re-editing an aliased name updates the SAME official key (reverse lookup)', ()=>{
    ev(`setPreferredName('Cat','Cathy')`);
    if (ev(`state.nameAliases['catherine smith']`) !== 'Cathy') throw new Error('official key not updated on re-edit: '+JSON.stringify(ev('state.nameAliases')));
    if (ev(`applyNameAlias('Catherine Smith')`) !== 'Cathy') throw new Error('re-edited alias not applied');
  });
  check('reverting the preferred name back to the official name clears the alias', ()=>{
    ev(`state.nameAliases={}; state.vocalists=[{id:'v9',name:'Bob Jones',isWL:false,leadsSongs:false,micAssigned:''}];`);
    ev(`setPreferredName('Bob Jones','Bobby')`);
    if (ev(`state.nameAliases['bob jones']`) !== 'Bobby') throw new Error('alias not recorded first');
    ev(`setPreferredName('Bobby','Bob Jones')`);
    if (ev(`'bob jones' in state.nameAliases`)) throw new Error('alias not cleared on revert: '+JSON.stringify(ev('state.nameAliases')));
    if (ev(`state.vocalists[0].name`) !== 'Bob Jones') throw new Error('name not reverted');
  });
  check('setPreferredName re-keys micPrefs.people and musicianPreferences', ()=>{
    ev(`state.nameAliases={}; state.musicianPreferences={};`);
    ev(`state.config.micPrefs = state.config.micPrefs || {}; state.config.micPrefs.people = {};`);
    ev(`state.instruments.forEach(i=>{i.assignedTo='';i.vocalistPlayer=null;}); var __b=instById('inst_bass')||state.instruments[0]; __b.assignedTo='Jonathan Reed';`);
    ev(`state.config.micPrefs.people['jonathan reed'] = {remembered:'SM58'};`);
    ev(`state.musicianPreferences['jonathan reed|bass'] = {askedAt:'x'};`);
    ev(`setPreferredName('Jonathan Reed','Jon')`);
    if (ev(`(instById('inst_bass')||state.instruments[0]).assignedTo`) !== 'Jon') throw new Error('band assignedTo not renamed');
    if (!ev(`state.config.micPrefs.people['jon']`)) throw new Error('micPref not re-keyed');
    if (ev(`state.config.micPrefs.people['jonathan reed']`)) throw new Error('old micPref key not removed');
    if (!ev(`state.musicianPreferences['jon|bass']`)) throw new Error('musicianPref not re-keyed');
    if (ev(`state.musicianPreferences['jonathan reed|bass']`)) throw new Error('old musicianPref key not removed');
  });
  check('setPreferredName renames hosts and shadows', ()=>{
    ev(`state.nameAliases={}; state.hosts={speaker:'Pastor Dave'}; state.shadows=[{id:'s1',name:'Pastor Dave'}];`);
    ev(`setPreferredName('Pastor Dave','Dave')`);
    if (ev(`state.hosts.speaker`) !== 'Dave') throw new Error('host not renamed');
    if (ev(`state.shadows[0].name`) !== 'Dave') throw new Error('shadow not renamed');
  });

  console.log('--- alias applied on PCO pulls ---');
  check('a merge-derived person gets the preferred name', ()=>{
    ev(`state.nameAliases={'catherine smith':'Cathy'};`);
    const TM = JSON.stringify({ data:[{id:'tm1',attributes:{name:'Catherine Smith',team_position_name:'Vocals',status:'C'}}] });
    const m = ev(`derivePcoModel({attributes:{}}, ${TM}, {data:[],included:[]})`);
    const p = m.people.find(x=>x.pcoId==='tm1');
    if (p.name !== 'Cathy') throw new Error('derivePcoModel did not apply alias: '+p.name);
  });
  check('applyPCOPlanData applies alias to a vocalist on a full pull', ()=>{
    ev(`state.nameAliases={'catherine smith':'Cathy'};`);
    ev(`state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.shadows=[]; state.hosts={};`);
    ev(`state.instruments.forEach(i=>{i.assignedTo='';i.vocalistPlayer=null;});`);
    const TM = JSON.stringify({ data:[{id:'tm2',attributes:{name:'Catherine Smith',team_position_name:'Vocals',status:'C'}}] });
    ev(`applyPCOPlanData({attributes:{}}, ${TM}, {data:[],included:[]})`);
    if (!ev(`state.vocalists.some(v=>v.name==='Cathy')`)) throw new Error('pull did not apply alias to vocalist: '+ev('JSON.stringify(state.vocalists.map(v=>v.name))'));
  });
  check('applyPCOPlanData aliases the acoustic pre-pass consistently (ag link still matches)', ()=>{
    ev(`state.nameAliases={'greg allman':'Greg'};`);
    ev(`state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.shadows=[]; state.hosts={};`);
    ev(`state.instruments.forEach(i=>{i.assignedTo='';i.vocalistPlayer=null;});`);
    // Same person listed as both a vocalist and acoustic guitar → should be linked as vocalistPlayer of AG
    const TM = JSON.stringify({ data:[
      {id:'tmA',attributes:{name:'Greg Allman',team_position_name:'Vocals',status:'C'}},
      {id:'tmB',attributes:{name:'Greg Allman',team_position_name:'Acoustic Guitar',status:'C'}}
    ] });
    ev(`applyPCOPlanData({attributes:{}}, ${TM}, {data:[],included:[]})`);
    const linked = ev(`(()=>{const v=state.vocalists.find(v=>v.name==='Greg'); if(!v) return 'novoc'; const ag=instById('inst_ag'); return ag && ag.vocalistPlayer===v.id ? 'ok' : 'notlinked';})()`);
    if (linked !== 'ok') throw new Error('acoustic pre-pass alias mismatch: '+linked);
  });

  console.log('--- post-pull popup #pp_name field ---');
  check('pref-vocal step renders #pp_name prefilled with the person name', ()=>{
    ev(`
      state.nameAliases={};
      state.config.setupDefaults = { vocals: { selections:{ options:['v_stand'] }, customOptions:[] } };
      state.musicianPreferences = {};
      state.shadowPreferences = state.shadowPreferences || {};
      state.setupItems = {};
      state.vocalists = [{ id:'vv', name:'Catherine Smith', isWL:false, leadsSongs:false, micAssigned:'' }];
      state.assignments = new Array(MAX_VOCALISTS).fill(null);
      state.shadows = [];
      state.instruments.forEach(i=>{i.assignedTo='';i.vocalistPlayer=null;});
    `);
    ev(`openPostPullPopup({})`);
    const inp = doc.getElementById('pp_name');
    if (!inp) throw new Error('#pp_name not rendered on pref-vocal step');
    if (inp.value !== 'Catherine Smith') throw new Error('#pp_name not prefilled: '+inp.value);
  });
  check('editing #pp_name + saving renames the vocalist and records the alias', ()=>{
    const inp = doc.getElementById('pp_name');
    inp.value = 'Cat';
    ev(`savePostPullStep()`);
    if (ev(`state.vocalists[0].name`) !== 'Cat') throw new Error('vocalist not renamed via popup: '+ev('state.vocalists[0].name'));
    if (ev(`state.nameAliases['catherine smith']`) !== 'Cat') throw new Error('alias not recorded via popup: '+JSON.stringify(ev('state.nameAliases')));
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 200));
