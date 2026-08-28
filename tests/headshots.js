// Headshots on the display come from PCO (photo_thumbnail_url), stored as a URL only —
// never image bytes — so localStorage stays small. No photo / offline => initials.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document:doc}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');

 const seed=()=>ev(`
   state.serviceOrder=[];
   state.peoplePhotos={};
   state.config.display=state.config.display||{}; delete state.config.display.showHeadshots;
   state.vocalists=[{id:'v1',name:'Kaeli Hearn',micAssigned:'KMS105'},
                    {id:'v2',name:'Marcus Donalson',micAssigned:'D:Facto'}];
   state.assignments=['v1','v2',null,null,null,null,null,null];
   state.instruments=[{id:'i1',label:'Bass',assignedTo:'Evan Forniss',pack:'Bass'}];
   state.shadows=[]; state.hosts={}; state.mdSoloName=null; state.musicDirectorId=null;
 `);

 console.log('--- store ---');

 check('rememberPersonPhoto stores by normalised full name; personPhotoUrl reads it back', ()=>{
   seed();
   ev("rememberPersonPhoto('Kaeli Hearn','https://example.test/k.jpg');");
   if(ev("personPhotoUrl('kaeli hearn')")!=='https://example.test/k.jpg') throw new Error('not stored/normalised');
 });

 check('a blank name or blank url is ignored (no junk keys)', ()=>{
   seed();
   ev("rememberPersonPhoto('','http://x'); rememberPersonPhoto('Nobody','');");
   if(Object.keys(JSON.parse(ev('JSON.stringify(state.peoplePhotos)'))).length!==0) throw new Error('junk stored');
 });

 check('we store the URL only — never base64 image bytes', ()=>{
   seed();
   ev("rememberPersonPhoto('Kaeli Hearn','https://example.test/k.jpg');");
   const raw=ev('JSON.stringify(state.peoplePhotos)');
   if(/data:image/.test(raw)) throw new Error('image bytes leaked into state');
   if(raw.length>300) throw new Error('photo store unexpectedly large: '+raw.length);
 });

 check('personInitials handles one and two names', ()=>{
   if(ev("personInitials('Kaeli Hearn')")!=='KH') throw new Error('two-name initials wrong');
   if(ev("personInitials('Santi')")!=='S') throw new Error('one-name initials wrong');
   if(ev("personInitials('')")!=='?') throw new Error('empty should be ?');
 });

 console.log('--- display render ---');

 check('a vocalist WITH a photo renders an <img> avatar', ()=>{
   seed();
   ev("rememberPersonPhoto('Kaeli Hearn','https://example.test/k.jpg'); renderDisplayView();");
   const img=doc.querySelector('#dvVocGrid .dv-avatar img');
   if(!img) throw new Error('no avatar image rendered');
   if(img.getAttribute('src')!=='https://example.test/k.jpg') throw new Error('wrong src');
 });

 check('a vocalist WITHOUT a photo renders initials, not a broken image', ()=>{
   seed();
   ev("renderDisplayView();");
   const av=doc.querySelector('#dvVocGrid .dv-avatar');
   if(!av) throw new Error('no avatar node');
   if(av.querySelector('img')) throw new Error('should not render an img with no photo');
   if(!/^[A-Z?]{1,2}$/.test(av.textContent.trim())) throw new Error('expected initials, got '+av.textContent);
 });

 check('band rows get an avatar too', ()=>{
   seed();
   ev("rememberPersonPhoto('Evan Forniss','https://example.test/e.jpg'); renderDisplayView();");
   const img=doc.querySelector('#dvBandList .dv-avatar img');
   if(!img) throw new Error('no band avatar');
 });

 check('the toggle OFF removes every avatar from the display', ()=>{
   seed();
   ev("rememberPersonPhoto('Kaeli Hearn','https://example.test/k.jpg'); state.config.display.showHeadshots=false; renderDisplayView();");
   if(doc.querySelector('#dvVocGrid .dv-avatar')) throw new Error('avatar still rendered with toggle off');
   if(doc.querySelector('#dvBandList .dv-avatar')) throw new Error('band avatar still rendered with toggle off');
 });

 check('headshots default ON when the setting was never touched', ()=>{
   seed();
   ev("renderDisplayView();");
   if(!doc.querySelector('#dvVocGrid .dv-avatar')) throw new Error('should default to ON');
 });

 check('the name is still rendered next to the avatar', ()=>{
   seed();
   ev("rememberPersonPhoto('Kaeli Hearn','https://example.test/k.jpg'); renderDisplayView();");
   const t=doc.getElementById('dvVocGrid').textContent;
   if(t.indexOf('Kaeli')===-1) throw new Error('name lost: '+t.slice(0,80));
 });

 check('a dead photo URL falls back to initials via onerror', ()=>{
   seed();
   ev("rememberPersonPhoto('Kaeli Hearn','https://example.test/gone.jpg'); renderDisplayView();");
   const img=doc.querySelector('#dvVocGrid .dv-avatar img');
   if(!img.getAttribute('onerror')) throw new Error('no onerror fallback wired');
   if(img.getAttribute('onerror').indexOf('is-initials')===-1) throw new Error('onerror does not restore initials');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exit(errs.length?1:0);
},150));
