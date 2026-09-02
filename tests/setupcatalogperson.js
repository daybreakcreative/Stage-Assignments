// Editing the setup questions from where they're actually used: the per-person setup editor.
// Report bug_4ef7a471 — "make all of these items editable/savable … change 'House EG rig' to
// 'House Helix' and add another 'House Quad Cortex'". The catalog editor existed only in
// Advanced Settings (and the wizard); the per-person editor showed the options read-only.
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync(process.env.SA_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => console.log('JSDOM ERR', (e.detail && e.detail.message) || e.message));
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: vc, beforeParse(w) {
  w.structuredClone = w.structuredClone || (v => v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }));
  w.scrollTo = () => {}; w.confirm = () => true; w.prompt = () => 'x';
  w.Element.prototype.getBoundingClientRect = function(){ return { left:0, top:0, width:800, height:380, right:800, bottom:380, x:0, y:0, toJSON(){} }; };
  w.Element.prototype.setPointerCapture = function(){}; w.Element.prototype.releasePointerCapture = function(){};
}});
const { window } = dom;
const doc = window.document;
const ev = c => window.eval(c);
function check(label, fn){ try { fn(); console.log('  OK  ', label); } catch(e) { console.log('  FAIL', label, '->', e.message); errors.push(label + ': ' + e.message); } }
const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));

window.addEventListener('load', () => setTimeout(() => {
  ev('toast=function(){};');
  ev('state.config.setupCatalog=null;');

  const mount = doc.createElement('div');
  mount.id = 'personEditorMount';
  doc.body.appendChild(mount);
  const KEY = ev("stableSetupKey('Gio','band','eg')");
  const draw = () => ev(`renderPersonSetupEditor(document.getElementById('personEditorMount'), ${JSON.stringify(KEY)}, 'eg')`);
  draw();

  console.log('--- per-person catalog editing (bug_4ef7a471) ---');

  check('per-person setup editor exposes an "Edit questions" disclosure', () => {
    const d = mount.querySelector('.cat-edit-disclosure');
    if (!d) throw new Error('no .cat-edit-disclosure in the per-person editor');
    if (!/edit/i.test(d.querySelector('summary').textContent)) throw new Error('summary does not read as an edit control');
  });

  check('the editor renders lazily — only once the disclosure is opened', () => {
    const d = mount.querySelector('.cat-edit-disclosure');
    if (mount.querySelector('.cat-editor')) throw new Error('catalog editor rendered before the disclosure was opened');
    d.open = true; fire(d, 'toggle');
    if (!mount.querySelector('.cat-editor')) throw new Error('catalog editor did not render on open');
  });

  check('it lists a row per EG option, "House EG rig" among them', () => {
    const vals = [...mount.querySelectorAll('.cat-opt-input')].map(i => i.value);
    if (!vals.includes('House EG rig')) throw new Error('House EG rig not editable here; got ' + vals.join('|'));
  });

  check('renaming "House EG rig" → "House Helix" writes through to the church catalog', () => {
    const inp = [...mount.querySelectorAll('.cat-opt-input')].find(i => i.value === 'House EG rig');
    if (!inp) throw new Error('rename input not found');
    inp.value = 'House Helix';
    fire(inp, 'input');
    const t = ev("setupCatalogFor('eg').groups.find(g=>g.id==='rig').options.find(o=>o.id==='eg_house').text");
    if (t !== 'House Helix') throw new Error('catalog text is ' + t);
  });

  check('the rename is saved to localStorage (survives a reload)', () => {
    const raw = ev('localStorage.getItem(STORAGE_KEY)');
    if (!raw) throw new Error('nothing persisted');
    const eg = ((JSON.parse(raw).config || {}).setupCatalog || {}).eg;
    if (!eg) throw new Error('setupCatalog.eg not persisted');
    const o = eg.groups.find(g => g.id === 'rig').options.find(x => x.id === 'eg_house');
    if (!o || o.text !== 'House Helix') throw new Error('persisted text is ' + (o && o.text));
  });

  check('adding "House Quad Cortex" appends a new option to the Rig group', () => {
    const grp = [...mount.querySelectorAll('.cat-group')].find(g => g.querySelector('.cat-group-name').value === 'Rig');
    if (!grp) throw new Error('Rig section not found in the editor');
    const addInp = grp.querySelector('.cat-opt-add-input');
    addInp.value = 'House Quad Cortex';
    grp.querySelector('.cat-o-add').click();
    const texts = ev("setupCatalogFor('eg').groups.find(g=>g.id==='rig').options.map(o=>o.text).join('|')");
    if (!texts.includes('House Quad Cortex')) throw new Error('option not added: ' + texts);
  });

  check("the person's radio buttons pick up both changes without reopening the editor", () => {
    const labels = [...mount.querySelectorAll('.sp-opt')].map(l => l.textContent.trim());
    if (!labels.includes('House Helix')) throw new Error('renamed option not shown on the person: ' + labels.join('|'));
    if (!labels.includes('House Quad Cortex')) throw new Error('added option not shown on the person: ' + labels.join('|'));
    if (labels.includes('House EG rig')) throw new Error('stale "House EG rig" still listed');
  });

  check('a person can select the newly added rig and it lands on their checklist', () => {
    const lab = [...mount.querySelectorAll('.sp-opt')].find(l => l.textContent.trim() === 'House Quad Cortex');
    const radio = lab.querySelector('input[type=radio]');
    radio.checked = true;
    fire(radio, 'change');
    const lines = ev(`JSON.stringify(resolveSetupItems('eg', state.setupItems[${JSON.stringify(KEY)}].selections, state.setupItems[${JSON.stringify(KEY)}].customItems).map(l=>l.text))`);
    if (!JSON.parse(lines).includes('House Quad Cortex')) throw new Error('not on the checklist: ' + lines);
  });

  check('editing from a person does NOT touch that person\'s per-person overrides', () => {
    const b = ev(`JSON.stringify(state.setupItems[${JSON.stringify(KEY)}].customItems||[])`);
    if (JSON.parse(b).length !== 0) throw new Error('catalog edit leaked into customItems: ' + b);
  });

  check('a rename reaches OTHER people who already picked that option', () => {
    // back to factory wording, editor reopened, then a second EG player holding the factory line
    ev("catalogResetKey('eg');");
    draw();
    const d = mount.querySelector('.cat-edit-disclosure');
    d.open = true; fire(d, 'toggle');
    const OTHER = ev("stableSetupKey('Rae','band','eg')");
    ev(`seedPersonSetup(${JSON.stringify(OTHER)},'eg');
        state.setupItems[${JSON.stringify(OTHER)}].selections={rig:'eg_house'};
        rebuildPersonItems(${JSON.stringify(OTHER)},'eg');`);
    const before = JSON.parse(ev(`JSON.stringify(state.setupItems[${JSON.stringify(OTHER)}].items.map(i=>i.text))`));
    if (!before.includes('House EG rig')) throw new Error('setup for the second player is wrong: ' + before.join('|'));
    // rename it from the FIRST person's editor
    const inp = [...mount.querySelectorAll('.cat-opt-input')].find(i => i.value === 'House EG rig');
    if (!inp) throw new Error('rename input not found');
    inp.value = 'House Helix';
    fire(inp, 'input');
    const after = JSON.parse(ev(`JSON.stringify(state.setupItems[${JSON.stringify(OTHER)}].items.map(i=>i.text))`));
    if (after.includes('House EG rig')) throw new Error("other person's checklist kept the old wording: " + after.join('|'));
    if (!after.includes('House Helix')) throw new Error("other person's checklist did not pick up the rename: " + after.join('|'));
  });

  check('reset from the per-person editor restores the built-in EG questions', () => {
    mount.querySelector('.cat-reset').click();
    const t = ev("setupCatalogFor('eg').groups.find(g=>g.id==='rig').options.find(o=>o.id==='eg_house').text");
    if (t !== 'House EG rig') throw new Error('reset did not restore the factory text, got ' + t);
    const labels = [...mount.querySelectorAll('.sp-opt')].map(l => l.textContent.trim());
    if (!labels.includes('House EG rig')) throw new Error('person editor not redrawn after reset: ' + labels.join('|'));
  });

  console.log(errors.length ? `=== RESULT: ${errors.length} ISSUE(S) ===` : '=== RESULT: ALL CHECKS PASSED ===');
  process.exit(errors.length ? 1 : 0);
}, 150));
