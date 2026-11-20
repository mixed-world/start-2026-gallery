'use strict';
const el=id=>document.getElementById(id),G=GalleryTools,A=GalleryAvailability;
const html=G.escape,href=G.url;
const query=new URLSearchParams(location.search);
const state={data:null,projects:[],filtered:[],limit:12,view:query.get('view')==='saved'?'saved':'browse',shared:null,compare:new Set()};
const listParam=query.get('list');
if(listParam)state.shared=[...new Set(listParam.split(',').filter(id=>/^\d+$/.test(id)))].slice(0,100);
function hash(value){let n=2166136261;for(const c of value)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
function saveQuery(){
  const params=new URLSearchParams();if(state.view==='saved')params.set('view','saved');
  if(state.shared)params.set('list',state.shared.join(','));
  if(el('discover-search').value.trim())params.set('q',el('discover-search').value.trim());
  if(el('collection').value!=='all')params.set('collection',el('collection').value);
  if(el('availability').value!=='all')params.set('access',el('availability').value);
  if(el('discover-sort').value!=='mix')params.set('order',el('discover-sort').value);
  history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);
}
function activeBase(){
  if(state.shared)return state.projects.filter(p=>state.shared.includes(p.id));
  if(state.view==='saved'){const saved=new Set(G.savedIds());return state.projects.filter(p=>saved.has(p.id));}
  return state.projects;
}
function collection(){return A.collections.find(c=>c.id===el('collection').value)||A.collections[0];}
function filter(){
  const q=el('discover-search').value.trim().toLocaleLowerCase(),c=collection(),access=el('availability').value;
  state.filtered=activeBase().filter(p=>c.matches(p)&&(access==='all'||p.access.state===access)&&(!q||[p.name,p.tagline,...(p.tags||[]),...(p.team||[]).map(m=>m.name)].join(' ').toLocaleLowerCase().includes(q)));
  const order=el('discover-sort').value,seed=state.data.snapshotCompletedAt.slice(0,10);
  state.filtered.sort((a,b)=>order==='name'?a.name.localeCompare(b.name):order==='likes'?b.likes-a.likes||a.name.localeCompare(b.name):hash(seed+a.id)-hash(seed+b.id));
}
function render(){
  if(!state.data)return;
  filter();const savedView=state.view==='saved'||state.shared!==null,c=collection();
  el('view-eyebrow').textContent=state.shared?'A SHARED SELECTION':savedView?'YOUR SHORTLIST':'MAKE A DISCOVERY';
  el('view-title').textContent=state.shared?'Someone saved you a few ideas.':savedView?'Your “come back to this” list.':c.id==='all'?'A few good places to start.':c.name;
  el('view-description').innerHTML=state.shared?'This selection contains only public project IDs. Save individual projects to keep them on this device.':savedView?'Saved on this device. Select two or three projects to compare.':c.id==='all'?'Explore a shuffled mix. Save anything that catches your eye.':`${G.confidence(c.confidence)} ${html(c.description)}`;
  document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===(savedView?'saved':'browse')));
  el('results-count').textContent=`${state.filtered.length.toLocaleString('en-GB')} ${state.filtered.length===1?'project':'projects'}${savedView?' in this selection':' in this view'}`;
  el('share-list').hidden=!savedView;el('share-list').disabled=activeBase().length===0;
  el('compare').hidden=!savedView;el('compare').disabled=state.compare.size<2;
  el('compare-count').textContent=state.compare.size;
  el('surprise').disabled=state.filtered.length===0;
  const shown=state.filtered.slice(0,state.limit);
  el('project-grid').innerHTML=shown.length?shown.map(p=>card(p,savedView)).join(''):`<div class="empty"><div>${savedView?'Your selection has no matching projects. Save a project from discovery to start a shortlist.':'No projects match this combination. Try another collection or reset your filters.'}<br><a href="index.html#discover">Browse the full gallery</a></div></div>`;
  el('load-more').hidden=state.limit>=state.filtered.length;
  el('shown-count').textContent=state.filtered.length?`${shown.length.toLocaleString('en-GB')} of ${state.filtered.length.toLocaleString('en-GB')} projects shown`:'';
  G.sync();saveQuery();
}
function card(p,savedView){
  const a=p.access;
  return `<article class="discovery-card"><button class="project-cover-button" data-open="${html(p.id)}" aria-label="View ${html(p.name)}">${p.heroImage?`<img src="${href(p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span class="cover-fallback" aria-hidden="true">${html(p.name.slice(0,1))}</span>`}</button><div class="card-content"><div class="card-access ${a.state==='unknown'?'unknown-access':''}" title="${html(a.reason)}">${html(a.label)}</div><button class="card-name" data-open="${html(p.id)}">${html(p.name)}</button><p class="card-description">${html(p.tagline||'Open the public project page to explore this idea.')}</p><div class="card-signals">${G.confidence(a.confidence)}<span>${p.teamSize?(p.teamSize===1?'Solo creator':p.teamSize+' listed members'):'Team unknown'}</span></div>${savedView?`<label class="compare-toggle"><input type="checkbox" data-compare="${html(p.id)}" ${state.compare.has(p.id)?'checked':''}> Compare this project</label>`:''}<div class="card-actions"><button class="project-open" data-open="${html(p.id)}">Details & access</button><button class="button save-button" data-save="${html(p.id)}">Save</button></div></div></article>`;
}
function renderGuides(){
  const guides=[['play','Play & puzzle','Find a new challenge, a tabletop world, or a little friendly competition.','▧'],['create','Create & design','Shape an idea, make something, or discover a different kind of creative tool.','◈'],['unwind','Unwind & explore','Follow a story, find a calmer moment, or see somewhere new.','✳']];
  el('guide-cards').innerHTML=guides.map(([id,title,copy,symbol])=>{const c=A.collections.find(x=>x.id===id);return `<button class="guide-card" data-collection="${id}"><span class="guide-symbol" aria-hidden="true">${symbol}</span><h3>${title}</h3><p>${copy}</p><small>${state.projects.filter(c.matches).length.toLocaleString('en-GB')} matching projects · keyword-guided</small></button>`;}).join('');
}
function randomProject(){if(!state.filtered.length)return;const n=new Uint32Array(1);crypto.getRandomValues(n);G.openProject(state.filtered[n[0]%state.filtered.length].id);}
function openCompare(){
  const picks=state.projects.filter(p=>state.compare.has(p.id)).slice(0,3);if(picks.length<2)return;
  el('comparison').style.gridTemplateColumns=`repeat(${picks.length},minmax(0,1fr))`;
  if(matchMedia('(max-width:700px)').matches)el('comparison').style.gridTemplateColumns='1fr';
  el('comparison').innerHTML=picks.map(p=>`<article class="compare-card"><h3>${html(p.name)}</h3><dl><dt>Access signal</dt><dd>${html(p.access.label)}<br>${G.confidence(p.access.confidence)}</dd><dt>Evidence</dt><dd>${html(p.access.reason)}</dd><dt>Price / devices / languages</dt><dd>Unknown</dd><dt>Trial / demo</dt><dd>${p.trial?'Mentioned in project story':'Not established'}<br>${G.confidence(p.trial?'Developer-reported':'Unknown')}</dd><dt>Category estimate</dt><dd>${html(p.estimatedCategory)}<br>${G.confidence(p.estimatedCategory==='Unclassified'?'Unknown':'Estimated')}</dd><dt>Listed collaborators</dt><dd>${p.teamSize||'Unknown'}</dd><dt>Self-reported tools</dt><dd>${html((p.tags||[]).slice(0,10).join(', ')||'None listed')}</dd><dt>Source captured</dt><dd>${G.date(p.access.sourceCheckedAt)}</dd></dl><button class="button" data-comparison-open="${html(p.id)}">Project details</button></article>`).join('');
  el('compare-dialog').showModal();
}
async function share(){
  const ids=activeBase().map(p=>p.id);if(!ids.length)return;
  const selected=ids.slice(0,100),target=new URL('index.html',location.href);target.searchParams.set('list',selected.join(','));target.hash='discover';
  if(ids.length>100)G.announce('Sharing the first 100 projects. Use a smaller selection to share fewer.');
  try{await navigator.clipboard.writeText(target.href);G.announce(`Link copied for ${selected.length} public projects. Only project IDs are shared.`);}catch{el('share-fallback').hidden=false;el('share-url').value=target.href;el('share-url').focus();el('share-url').select();}
}
for(const id of ['discover-search','collection','availability','discover-sort'])el(id).addEventListener(id==='discover-search'?'input':'change',()=>{state.limit=12;render();});
el('clear-filters').addEventListener('click',()=>{el('discover-search').value='';el('collection').value='all';el('availability').value='all';el('discover-sort').value='mix';state.limit=12;render();});
el('load-more').addEventListener('click',()=>{state.limit+=12;render();});
el('surprise').addEventListener('click',randomProject);el('surprise-top').addEventListener('click',randomProject);
el('open-confidence').addEventListener('click',()=>el('confidence-dialog').showModal());
el('close-dialog').addEventListener('click',()=>el('project-dialog').close());
el('compare').addEventListener('click',openCompare);el('share-list').addEventListener('click',share);
document.addEventListener('click',event=>{
  const guide=event.target.closest('[data-collection]');if(guide){el('collection').value=guide.dataset.collection;state.view='browse';state.shared=null;state.compare.clear();state.limit=12;render();el('discover').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  const nav=event.target.closest('[data-nav]');if(nav){event.preventDefault();state.view=nav.dataset.nav==='saved'?'saved':'browse';state.shared=null;state.compare.clear();state.limit=12;el('discover-search').value='';el('collection').value='all';el('availability').value='all';render();el('discover').scrollIntoView({behavior:'instant'});}
  const close=event.target.closest('[data-close]');if(close)el(close.dataset.close).close();
  const open=event.target.closest('[data-comparison-open]');if(open){el('compare-dialog').close();G.openProject(open.dataset.comparisonOpen);}
});
document.addEventListener('change',event=>{const toggle=event.target.closest('[data-compare]');if(!toggle)return;const id=toggle.dataset.compare;if(toggle.checked){if(state.compare.size>=3){toggle.checked=false;G.announce('Choose up to three projects to compare.');return;}state.compare.add(id);}else state.compare.delete(id);el('compare-count').textContent=state.compare.size;el('compare').disabled=state.compare.size<2;});
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
window.addEventListener('shortlistchange',()=>{if(state.view==='saved'&&!state.shared)state.compare=new Set([...state.compare].filter(id=>G.savedIds().includes(id)));render();});
window.addEventListener('popstate',()=>location.reload());
async function boot(){
  try{
    const response=await fetch('data.json');if(!response.ok)throw new Error(`Snapshot HTTP ${response.status}`);
    state.data=await response.json();if(!Array.isArray(state.data.projects)||!state.data.projects.length)throw new Error('The snapshot contains no projects.');
    state.projects=state.data.projects.map(p=>({...p,access:A.availabilityFor(p)}));
    if(state.shared)state.shared=state.shared.filter(id=>state.projects.some(p=>p.id===id));
    G.init(state.data);el('snapshot-date').textContent=`Snapshot · ${G.date(state.data.snapshotCompletedAt)}`;
    const store=state.projects.filter(p=>['store','web','download','access','share'].some(k=>p.access[k].length)).length,web=state.projects.filter(p=>p.access.web.length).length;
    el('overview-strip').innerHTML=`<span><strong>${state.projects.length.toLocaleString('en-GB')}</strong> projects captured</span><span><strong>${store.toLocaleString('en-GB')}</strong> with access links listed</span><span><strong>${web.toLocaleString('en-GB')}</strong> with hosted web links</span><a href="analytics.html">Explore the detailed analytics</a>`;
    el('coverage-copy').textContent=`${state.data.projectCount.toLocaleString('en-GB')} unique projects from ${state.data.galleryPages} pages, captured ${G.date(state.data.snapshotCompletedAt)}. Devpost reported ${state.data.reportedTotal.toLocaleString('en-GB')} entries; repeated or changing entries can produce a smaller unique count. All ${state.data.detailSuccess.toLocaleString('en-GB')} captured detail pages were inspected.`;
    for(const c of A.collections.slice(1)){const option=document.createElement('option');option.value=c.id;option.textContent=c.name;el('collection').append(option);}
    for(const [id,key]of [['discover-search','q'],['collection','collection'],['availability','access'],['discover-sort','order']]){const value=query.get(key);if(value!==null){if(el(id).tagName==='SELECT'){if([...el(id).options].some(o=>o.value===value))el(id).value=value;}else el(id).value=value;}}
    renderGuides();render();
  }catch(error){el('discovery-error').hidden=false;el('discovery-error').textContent=`The saved snapshot could not be loaded. ${error.message} Please reload the page.`;el('results-count').textContent='Snapshot unavailable';}
}
boot();
