// Host mics (redesigned): configurable host channels (count + labels + default capsule),
// hosts do NOT draw from the shared vocalist/shadow mic pool, display + summary show role+name
// only (no capsule), and legacy fixed-slot saves migrate to channels.
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
const fire=(el,type)=>el.dispatchEvent(new window.Event(type,{bubbles:true}));
window.addEventListener('load',()=>setTimeout(()=>{
 const setup=()=>{
   ev('state.inventory=[{name:"KMS105",total:1,rank:1,wireless:true},{name:"Beta 58A",total:1,rank:2,wireless:true},{name:"SM58",total:4,rank:3,wireless:false},{name:"D:Facto",total:1,rank:4,wireless:false}]');
   ev('state.config.micPrefs={leaderMics:[],people:{}}');
   ev('state.config.hostChannels=[{id:"h1",label:"HH 1",capsule:""},{id:"h2",label:"HH 2",capsule:""},{id:"h3",label:"HH 3",capsule:""},{id:"h4",label:"HH 4",capsule:""}]');
   ev('state.shadows=[]');
   ev('state.vocalists=[{id:"v1",name:"Grayson",isWL:true,leadsSongs:true,micAssigned:""}]');
   ev('state.hosts={h1:"Pastor Dave",h2:"",h3:"",h4:""}');
 };

 check('config: hostChannels defaults to 4 channels (HH 1 – HH 4)', ()=>{
   setup();
   const a=JSON.parse(ev('JSON.stringify(hostChannels())'));
   if(a.length!==4) throw new Error('expected 4 channels, got '+a.length);
   if(a[0].label!=='HH 1'||a[3].label!=='HH 4') throw new Error('labels not HH 1..HH 4: '+JSON.stringify(a));
 });

 check('pool: hosts do NOT consume the shared mic pool (vocalist keeps best; rest free for shadows)', ()=>{
   setup();
   ev('state.shadows=[{id:"s1",name:"Sam",setup:"on-stage-mic",mic:""}]');
   ev('assignMicsToVocalists()');
   if(ev('state.vocalists[0].micAssigned')!=='KMS105') throw new Error('vocalist should take best KMS105, got '+ev('state.vocalists[0].micAssigned'));
   // Pastor Dave (host) took nothing from the pool, so the shadow still gets the lowest FREE mic.
   if(ev('state.shadows[0].mic')!=='D:Facto') throw new Error('shadow should take lowest free D:Facto, got '+ev('state.shadows[0].mic'));
 });

 check('setup: renderHosts builds one name input + capsule dropdown per channel', ()=>{
   setup(); ev('renderAll=function(){}'); ev('renderHosts()');
   const rows=doc.querySelectorAll('#hostsList .host-row');
   if(rows.length!==4) throw new Error('expected 4 host rows, got '+rows.length);
   const nm=rows[0].querySelector('.host-name'), cap=rows[0].querySelector('.host-cap');
   if(!nm||!cap) throw new Error('first row missing name input or capsule dropdown');
   if(nm.value!=='Pastor Dave') throw new Error('name input should show Pastor Dave, got '+nm.value);
 });

 check('setup: typing a name updates state.hosts by channel id', ()=>{
   setup(); ev('renderAll=function(){}'); ev('renderHosts()');
   const nm=doc.querySelector('#hostsList .host-row[data-ch="h2"] .host-name');
   if(!nm) throw new Error('h2 name input missing');
   nm.value='Sarah'; fire(nm,'input');
   if(ev('(state.hosts.h2||"")')!=='Sarah') throw new Error('h2 should be Sarah, got '+ev('state.hosts.h2'));
 });

 check('setup: choosing a default capsule saves it on the channel (persists as config)', ()=>{
   setup(); ev('renderAll=function(){}'); ev('renderHosts()');
   const sel=doc.querySelector('#hostsList .host-row[data-ch="h1"] .host-cap');
   if(!sel) throw new Error('h1 capsule dropdown missing');
   sel.value='SM58'; fire(sel,'change');
   if(ev('hostChannels()[0].capsule')!=='SM58') throw new Error('h1 capsule should be SM58, got '+ev('hostChannels()[0].capsule'));
 });

 check('display: host row shows label + name only (never a mic capsule)', ()=>{
   setup(); ev('hostChannels()[0].capsule="SM58"');   // capsule set, but display must not show it
   // Pin to a non-bespoke world (orbit) so this exercises the DEFAULT #dvHostsBlock list;
   // the bespoke worlds (concrete=default, molten, corporate, terra) have their own displays (warm
   // .mw-rows / .cw-manifest / .pw-list / .tw-list, no #dvHostsBlock); orbit is the last default fallback.
   ev('state.world="orbit"; applyWorld();');
   ev('state.viewMode="display"; renderDisplayView(); state.viewMode="setup"');
   const block=doc.querySelector('#displayView #dvHostsBlock') || doc.getElementById('dvHostsBlock');
   const list=block && block.querySelector('.dv-list');
   if(!list) throw new Error('#dvHostsList missing');
   const txt=list.textContent;
   if(!/Pastor Dave/.test(txt)) throw new Error('host name missing from display: '+txt);
   if(/SM58|🎤/.test(txt)) throw new Error('display should NOT show a mic capsule: '+txt);
 });

 check('summary: print host list shows label + name, no mic', ()=>{
   setup(); ev('hostChannels()[0].capsule="SM58"');
   ev('fillSummary()');
   const list=doc.getElementById('s_hhList');
   if(!list) throw new Error('#s_hhList missing');
   if(!/Pastor Dave/.test(list.textContent)) throw new Error('host name missing in summary: '+list.textContent);
   if(/SM58|🎤/.test(list.textContent)) throw new Error('summary should not show a mic: '+list.textContent);
 });

 check('migration: legacy fixed slots → channels h1..h4 (names carried, Pastor/HH labels)', ()=>{
   const legacy='{"hosts":{"speaker":"Dave","welcomeHost1":"Sarah","welcomeHost2":"Ben","hh3":"Mike","hh3IsBaptismal":true}}';
   const H=JSON.parse(ev(`JSON.stringify(migrateHosts(${legacy}))`));
   const C=JSON.parse(ev(`JSON.stringify(migrateHostChannels({}, ${legacy}))`));
   if(H.h1!=='Dave'||H.h2!=='Sarah'||H.h3!=='Ben'||H.h4!=='Mike') throw new Error('legacy names not migrated: '+JSON.stringify(H));
   if(C.length!==4||C[0].label!=='Pastor'||C[1].label!=='HH 1') throw new Error('legacy channel labels wrong: '+JSON.stringify(C));
 });

 check('wizard: finishing the wizard writes config.hostChannels (count + labels)', ()=>{
   ev(`startWizard(); wizardData.mics=[{name:"SM58",total:1,wireless:false}]; wizardData.hostChannels=[{id:"h1",label:"Pastor",capsule:""},{id:"h2",label:"Host A",capsule:""}]; applyWizardChoices();`);
   const c=JSON.parse(ev('JSON.stringify(state.config.hostChannels)'));
   if(c.length!==2||c[0].label!=='Pastor'||c[1].label!=='Host A') throw new Error('wizard did not apply host channels: '+JSON.stringify(c));
 });

 // --- Daybreak rule: whoever is baptizing lands on HH 3, silently (no baptism flag/UI) ---
 check('pco: the baptizing pastor is reserved to HH 3; welcome hosts skip past it', ()=>{
   setup();
   const roster=JSON.stringify({data:[
     {id:'t1',attributes:{name:'Pastor Dave',team_position_name:'Speaker',status:'C'}},
     {id:'t2',attributes:{name:'Mia',team_position_name:'Welcome Host',status:'C'}},
     {id:'t3',attributes:{name:'Jon',team_position_name:'Welcome Host',status:'C'}},
     {id:'t4',attributes:{name:'Pat',team_position_name:'Pastor Baptizing',status:'C'}}
   ]});
   ev(`applyPCOPlanData({attributes:{}}, ${roster}, {data:[],included:[]})`);
   if(ev('state.hosts.h3')!=='Pat') throw new Error('baptizer should be on HH 3 (h3), got '+ev('state.hosts.h3'));
   if(ev('state.hosts.h1')!=='Pastor Dave') throw new Error('speaker should be HH 1 (h1), got '+ev('state.hosts.h1'));
   const around=[ev('state.hosts.h2'),ev('state.hosts.h4')].sort().join(',');
   if(around!=='Jon,Mia') throw new Error('welcome hosts should fill h2+h4, skipping reserved h3; got '+around);
 });

 check('pco: baptism routing writes NO baptism flag/indication onto state', ()=>{
   if(/baptis/i.test(ev('JSON.stringify(state.hosts)'))) throw new Error('state.hosts must carry no baptism text: '+ev('JSON.stringify(state.hosts)'));
   if(ev('("hh3IsBaptismal" in state) || Object.keys(state.hosts).some(k=>/baptis/i.test(k))')) throw new Error('no baptism flag allowed on state');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
