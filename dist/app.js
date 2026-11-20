'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number = value => Number(value || 0).toLocaleString('en-GB');
const percent = (n,d) => {if(!d)return '—';const v=n/d*100;if(v>0&&v<.1)return '<0.1%';if(v<100&&v>99.9)return '>99.9%';return `${v>0&&v<1||v>99&&v<100?v.toFixed(1):Math.round(v)}%`;};
const median = values => { const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b),n=sorted.length; return n ? (sorted[Math.floor((n-1)/2)]+sorted[Math.floor(n/2)])/2 : null; };
const medianText = values => {const n=median(values);return n===null?'—':number(n);};
const colors = {Gaming:'#719054',Entertainment:'#6385ce',Productivity:'#dba271',Unclassified:'#bdc7c0'};
const categories = Object.keys(colors);
const dateKey = value => value ? new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)) : null;
const dateText = value => value ? new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)) : 'Not public';
const dateTime = value => value ? new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(new Date(value)) : 'Not public';
function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?esc(u.href):'#';}catch{return '#';}}
function badge(category){return `<span class="category-chip"><span class="dot" style="background:${colors[category]||colors.Unclassified}"></span>${esc(category||'Unclassified')}</span>`;}
function observed(value){return value===true?'<span class="yes-mark" title="Observed on public page">✓</span>':value===false?'<span class="no-mark" title="None observed on public page">—</span>':'<span class="unknown" title="Unavailable">?</span>';}
const empty = message => `<div class="empty">${esc(message)}</div>`;
const state={data:null,filtered:[],page:0};
const filterIds=['search','category','team','video','hero','trial','new','win','store','min-likes','date-from','date-to'];
const defaults={search:'',category:'all',team:'all',video:'all',hero:'all',trial:'all',new:'all',win:'all',store:'all','min-likes':'0','date-from':'','date-to':''};

function matches(p){
  const val=id=>$(id).value;
  const q=val('search').trim().toLocaleLowerCase();
  if(q && ![p.name,p.tagline,...(p.tags||[]),...(p.team||[]).map(t=>t.name)].join(' ').toLocaleLowerCase().includes(q))return false;
  if(val('category')!=='all'&&p.estimatedCategory!==val('category'))return false;
  if(val('team')==='solo'&&p.teamSize!==1)return false;
  if(val('team')==='small'&&!(p.teamSize>=2&&p.teamSize<=3))return false;
  if(val('team')==='large'&&(!p.teamSize||p.teamSize<4))return false;
  for(const [control,field] of [['video','trailer'],['hero','heroImage']]){
    if(val(control)==='yes'&&p[field]!==true)return false;
    if(val(control)==='no'&&p[field]!==false)return false;
    if(val(control)==='unknown'&&typeof p[field]==='boolean')return false;
  }
  if(val('trial')==='yes'&&!p.trial)return false;
  if(val('trial')==='unknown'&&p.trial)return false;
  if(val('new')==='new'&&p.newApp!=='New build mentioned')return false;
  if(val('new')==='existing'&&p.newApp!=='Existing app mentioned')return false;
  if(val('new')==='unknown'&&p.newApp)return false;
  if(val('win')==='yes'&&!p.priorWin)return false;
  if(val('win')==='unknown'&&p.priorWin)return false;
  if(val('store')==='yes'&&!p.storeLinks?.length)return false;
  if(val('store')==='no'&&(!p.links||p.storeLinks?.length))return false;
  if(p.likes<Number(val('min-likes')||0))return false;
  const day=dateKey(p.publishedAt);
  if(val('date-from')&&(!day||day<val('date-from')))return false;
  if(val('date-to')&&(!day||day>val('date-to')))return false;
  return true;
}

function render(){
  if(!state.data)return;
  state.filtered=state.data.projects.filter(matches);
  const rows=state.filtered,known=rows.filter(p=>p.detailStatus==='ok');
  const likes=rows.reduce((n,p)=>n+p.likes,0),solo=rows.filter(p=>p.teamSize===1).length;
  const topCount=Math.ceil(rows.length*.1),topLikes=rows.map(p=>p.likes).sort((a,b)=>b-a).slice(0,topCount).reduce((a,b)=>a+b,0);
  $('selection-count').textContent=`${number(rows.length)} of ${number(state.data.projectCount)} projects in view`;
  const active=filterIds.filter(id=>$(id).value!==defaults[id]).length;
  $('filter-count').textContent=active?`(${active})`:'';
  $('stats').innerHTML=[
    {label:'Projects in view',value:number(rows.length),bottom:`${percent(rows.length,state.data.projectCount)} of the captured gallery`,symbol:'▦',primary:true},
    {label:'Public likes',value:number(likes),bottom:`Median <strong>${medianText(rows.map(p=>p.likes))}</strong> per project`,symbol:'♡'},
    {label:'Median team size',value:medianText(rows.map(p=>p.teamSize)),bottom:`<strong>${percent(solo,rows.length)}</strong> are solo creators`,symbol:'♧'},
    {label:'Embedded video coverage',value:percent(known.filter(p=>p.trailer).length,known.length),bottom:`${number(known.filter(p=>p.trailer).length)} of ${number(known.length)} inspected pages`,symbol:'▷'}
  ].map(s=>`<article class="stat ${s.primary?'primary':''}"><div class="stat-label">${s.label}<span class="symbol" aria-hidden="true">${s.symbol}</span></div><div class="stat-value">${s.value}</div><p class="stat-bottom">${s.bottom}</p></article>`).join('');
  renderCategory(rows);renderTimeline(rows);renderTeams(rows);renderMedia(known);renderScatter(rows);renderTech(known);renderSpotlights(rows);renderBenchmarks(rows);renderThemes(known);renderEvidence(rows);
  renderTable();
  $('stats').title=likes?`The top ${topCount} projects (top 10%, rounded up) account for ${percent(topLikes,likes)} of likes in this view.`:'';
}

function renderCategory(rows){
  const counts=categories.map(c=>rows.filter(p=>p.estimatedCategory===c).length);
  let total=0;
  const stops=counts.map((n,i)=>{let start=total;total+=rows.length?n/rows.length*100:0;return `${colors[categories[i]]} ${start}% ${total}%`;});
  $('category-ring').style.background=rows.length?`conic-gradient(${stops.join(',')})`:'#e7ece3';
  $('category-ring').setAttribute('aria-label',categories.map((c,i)=>`${c}: ${counts[i]}`).join(', '));
  $('classified-share').textContent=percent(rows.length-counts[3],rows.length);
  $('category-bars').innerHTML=categories.map((c,i)=>`<button class="category-row" data-category="${c}" title="Filter by estimated category ${c}"><div class="category-row-head"><span class="dot" style="background:${colors[c]}"></span>${c}<strong>${number(counts[i])}</strong><small>${percent(counts[i],rows.length)}</small></div><div class="bar-track"><div class="bar-fill" style="background:${colors[c]};width:${rows.length?counts[i]/rows.length*100:0}%"></div></div></button>`).join('');
}

function renderTimeline(rows){
  const field=$('date-mode').value,dated=rows.filter(p=>p[field]);
  if(!dated.length){$('timeline').innerHTML=empty('No date evidence in this view.');$('timeline-note').textContent='Exact submission times are not public.';return;}
  const times=dated.map(p=>new Date(p[field]).valueOf());
  const first=Math.min(...times),last=Math.max(...times),days=(last-first)/86400000;
  let group=days>100?'month':days>20?'week':'day';
  const buckets=new Map();
  for(const p of dated){
    let key=dateKey(p[field]);
    if(group==='month')key=key.slice(0,7)+'-01';
    if(group==='week'){const d=new Date(key+'T12:00:00Z'),day=d.getUTCDay();d.setUTCDate(d.getUTCDate()-((day+6)%7));key=d.toISOString().slice(0,10);}
    buckets.set(key,(buckets.get(key)||0)+1);
  }
  let entries=[...buckets].sort((a,b)=>a[0].localeCompare(b[0]));
  const max=Math.max(...entries.map(e=>e[1]));
  const stride=Math.max(1,Math.ceil(entries.length/8));
  $('timeline').innerHTML=entries.map(([day,count],i)=>{
    const label=group==='month'?new Intl.DateTimeFormat('en-GB',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(day)):new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(day));
    return `<div class="timeline-col"><button data-day="${day}" data-group="${group}" style="height:${Math.max(1,count/max*80)}%" title="${esc(label)}${group==='week'?' week':''}: ${number(count)} projects" aria-label="${esc(label)}: ${number(count)} projects${field==='publishedAt'?', filter this period':''}" ${field!=='publishedAt'?'disabled':''}>${count===max?`<span>${number(count)}</span>`:''}</button><small>${i%stride===0||i===entries.length-1?label:''}</small></div>`;
  }).join('');
  $('timeline-note').textContent=`${number(dated.length)} dated / ${number(rows.length)} projects · ${group==='day'?'Daily':group==='week'?'Weekly':'Monthly'} occupied periods · Berlin time. ${field==='publishedAt'?'“Started this project” activity, not submission time. Click a bar to filter.':'Metadata creation date, not submission time.'}`;
}

function renderTeams(rows){
  const creators=new Map();for(const p of rows){for(const t of p.team||[])creators.set(t.url,(creators.get(t.url)||0)+1);}
  $('team-note').textContent=`${number(creators.size)} distinct listed profiles; ${number([...creators.values()].filter(n=>n>1).length)} appear on multiple projects in this view. ${number(rows.filter(p=>!p.teamSize).length)} projects have no visible team count. Listed collaborators may differ from full development teams.`;
  const groups=[['1',p=>p.teamSize===1],['2',p=>p.teamSize===2],['3',p=>p.teamSize===3],['4',p=>p.teamSize===4],['5+',p=>p.teamSize>=5],['Unknown',p=>!p.teamSize]],counts=groups.map(g=>rows.filter(g[1]).length),max=Math.max(1,...counts);
  $('team-chart').innerHTML=rows.length?groups.map(([label],i)=>`<div class="team-col"><span>${number(counts[i])}</span><div class="team-bar" style="height:${counts[i]/max*120}px" title="${label} members: ${number(counts[i])} projects (${percent(counts[i],rows.length)})"></div><small>${label}${i===5?'':i===0?' member':' members'}</small></div>`).join(''):empty('No projects match these filters.');
}

function measures(target,entries,denominator,options={}){
  const max=options.relative?Math.max(1,...entries.map(e=>e[1])):denominator;
  $(target).innerHTML=denominator?entries.map(([label,count,color])=>`<div class="measure-row"><div><span>${esc(label)}</span><strong><small>${number(count)}${options.noun?' '+options.noun:''}</small>${percent(count,denominator)}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${max?count/max*100:0}%;${color?'background:'+color:''}"></div></div></div>`).join(''):empty('No inspected projects in this view.');
}
function renderMedia(rows){measures('media-chart',[
  ['Custom cover image',rows.filter(p=>p.heroImage).length],['Embedded video',rows.filter(p=>p.trailer).length],['At least one screenshot',rows.filter(p=>p.screenshots>0).length],['Store / access link listed',rows.filter(p=>['store','web','download','access','share'].some(k=>GalleryAvailability.availabilityFor(p)[k].length)).length],['Public source link',rows.filter(p=>p.sourceLinks?.length).length]
],rows.length);}
function renderTech(rows){
  const tags={};for(const p of rows){for(const t of new Set((p.tags||[]).map(t=>t.toLowerCase().trim()))){if(t)tags[t]=(tags[t]||0)+1;}}
  const entries=Object.entries(tags).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,7);
  measures('tech-chart',entries,rows.length,{relative:true});
  if(rows.length&&!entries.length)$('tech-chart').innerHTML=empty('No technology tags listed.');
}
function renderThemes(rows){
  const names=['Hand tracking','Mixed reality','Seated','AI mentions','Multiplayer','Accessibility'];
  measures('themes-chart',names.map(t=>[t,rows.filter(p=>p.themes?.includes(t)).length]),rows.length);
}
function renderEvidence(rows){
  const known=rows.filter(p=>p.detailStatus==='ok'),likes=rows.reduce((n,p)=>n+p.likes,0),top=Math.ceil(rows.length*.1),topLikes=rows.map(p=>p.likes).sort((a,b)=>b-a).slice(0,top).reduce((a,b)=>a+b,0);
  measures('evidence-chart',[
    ['Team winner badge before deadline',rows.filter(p=>p.priorWin).length],
    ['Trial / demo mentioned',known.filter(p=>p.trial).length],
    ['New build mentioned',known.filter(p=>p.newApp==='New build mentioned').length],
    ['Existing app mentioned',known.filter(p=>p.newApp==='Existing app mentioned').length],
    ['Story of 300+ words',known.filter(p=>p.storyWords>=300).length]
  ],rows.length);
  if(rows.length)$('evidence-chart').insertAdjacentHTML('beforeend',`<div class="footnote">Official category and exact submission time: <strong>not public</strong>.<br>Attention concentration: the top ${number(top)} projects (top 10%, rounded up) hold <strong>${percent(topLikes,likes)}</strong> of likes.</div>`);
}

function renderScatter(rows){
  rows=rows.filter(p=>p.teamSize>0);
  if(!rows.length){$('scatter').innerHTML=empty('No projects match these filters.');return;}
  const width=520,height=215,left=40,right=16,top=14,bottom=39,plotWidth=width-left-right,plotHeight=height-top-bottom;
  const maxX=Math.max(2,...rows.map(p=>p.teamSize)),maxY=Math.max(1,...rows.map(p=>p.likes));
  const x=n=>left+(n-1)/Math.max(1,maxX-1)*plotWidth;
  const y=n=>top+plotHeight-(n/maxY)*plotHeight;
  let content='';
  for(let i=0;i<=4;i++){const n=Math.round(i*maxY/4);content+=`<line x1="${left}" y1="${y(n)}" x2="${width-right}" y2="${y(n)}" stroke="#e8ede3"/><text x="${left-8}" y="${y(n)+3}" text-anchor="end">${n}</text>`;}
  const ticks=[...new Set([1,2,3,4,maxX].filter(n=>n<=maxX))];
  for(const n of ticks)content+=`<text x="${x(n)}" y="${height-20}" text-anchor="middle">${n}</text>`;
  content+=`<text x="${width/2}" y="${height-1}" text-anchor="middle">Listed team members</text><text x="${left}" y="9">Likes</text>`;
  content+=rows.map(p=>`<circle data-project="${esc(p.id)}" cx="${x(p.teamSize||1)}" cy="${y(p.likes)}" r="4.2" fill="${colors[p.estimatedCategory]||colors.Unclassified}" opacity=".45"><title>${esc(p.name)}: ${p.likes} likes, ${p.teamSize} members</title></circle>`).join('');
  $('scatter').innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Scatter plot of listed team members versus Devpost likes; ${rows.length} projects, maximum ${maxY} likes">${content}</svg>`;
}

function renderSpotlights(rows){
  const top=[...rows].sort((a,b)=>b.likes-a.likes||a.name.localeCompare(b.name)).slice(0,3);
  $('spotlights').innerHTML=top.length?top.map((p,i)=>`<button class="spotlight" data-project="${esc(p.id)}"><img class="spotlight-image" src="${safeUrl(p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"><div class="spotlight-content"><span class="rank">${String(i+1).padStart(2,'0')} / MOST LIKED</span><h3>${esc(p.name)}</h3><small>♡ ${number(p.likes)} likes · ${p.teamSize?number(p.teamSize):'Unknown'} ${p.teamSize===1?'member':'members'}</small></div></button>`).join(''):empty('No projects match these filters.');
}
function renderBenchmarks(rows){
  $('benchmarks').innerHTML=categories.map(c=>{
    const group=rows.filter(p=>p.estimatedCategory===c),known=group.filter(p=>p.detailStatus==='ok'),n=group.length;
    return `<tr><td>${badge(c)}</td><td>${number(n)}</td><td>${medianText(group.map(p=>p.likes))}</td><td>${n?(group.reduce((s,p)=>s+p.likes,0)/n).toFixed(1):'—'}</td><td>${percent(group.filter(p=>p.teamSize===1).length,n)}</td><td title="${known.length} inspected projects">${percent(known.filter(p=>p.trailer).length,known.length)}</td><td>${medianText(known.map(p=>p.screenshots))}</td></tr>`;
  }).join('');
}

function renderTable(){
  const sort=$('sort').value,size=Number($('page-size').value),rows=[...state.filtered];
  rows.sort((a,b)=>{
    if(sort==='name')return a.name.localeCompare(b.name);
    if(sort==='newest')return (new Date(b.publishedAt||0)-new Date(a.publishedAt||0))||a.name.localeCompare(b.name);
    const field={likes:'likes',team:'teamSize',screenshots:'screenshots',words:'storyWords'}[sort]||'likes';
    return (b[field]||0)-(a[field]||0)||a.name.localeCompare(b.name);
  });
  const pages=Math.ceil(rows.length/size);state.page=Math.max(0,Math.min(state.page,pages-1));
  const start=state.page*size,shown=rows.slice(start,start+size);
  $('table-total').textContent=number(rows.length);
  $('project-rows').innerHTML=shown.length?shown.map(p=>`<tr><td><button class="project-name" data-project="${esc(p.id)}">${esc(p.name)}</button><span class="project-tagline">${esc(p.tagline)}</span></td><td>${badge(p.estimatedCategory)}</td><td>${p.newApp?`<span class="evidence-mention" title="Narrative mention; not the official submission answer">${esc(p.newApp)}</span>`:'<span class="unknown">Not established</span>'}</td><td>${p.publishedAt?dateText(p.publishedAt):'<span class="unknown">Not public</span>'}</td><td>${p.teamSize?number(p.teamSize):'<span class="unknown">Unknown</span>'}</td><td><strong>${number(p.likes)}</strong></td><td>${observed(p.heroImage)}</td><td>${observed(p.trailer)}</td><td>${p.screenshots??'<span class="unknown">?</span>'}</td><td>${p.trial?'<span class="evidence-mention">Mentioned</span>':'<span class="unknown">Not established</span>'}</td><td>${p.priorWin?'<span class="evidence-mention">Winner badge</span>':'<span class="unknown">Not established</span>'}</td></tr>`).join(''):'<tr><td colspan="11"><div class="empty">No projects match these filters. Try resetting your selection.</div></td></tr>';
  $('page-info').textContent=rows.length?`${number(start+1)}–${number(Math.min(start+size,rows.length))} of ${number(rows.length)} · Page ${state.page+1} of ${pages}`:'0 projects';
  $('prev').disabled=state.page===0;$('next').disabled=state.page>=pages-1;
}

function openProject(id){ GalleryTools.openProject(id); }

function exportCsv(){
  const fields=['id','name','url','tagline','estimatedCategory','officialCategory','newApp','newAppEvidence','submittedAt','publishedAt','createdAt','teamSize','likes','comments','heroImage','trailer','screenshots','availabilityStatus','availabilityConfidence','trial','trialEvidence','priorWin','priorWinEvidence','teamAwardProfilesChecked','teamAwardProfilesTotal','storyWords','tags','themes','storeLinks','sourceLinks','checkedAt','detailStatus'];
  const cell=v=>{const value=Array.isArray(v)?v.map(x=>typeof x==='object'?x.url:x).join(' | '):(v??'');let s=String(value);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const csv='\ufeff'+fields.join(',')+'\r\n'+state.filtered.map(p=>fields.map(f=>cell(p[f])).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`start-2026-gallery-${new Date(state.data.snapshotCompletedAt).toISOString().slice(0,10)}-${state.filtered.length}-projects.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

for(const id of filterIds){$(id).addEventListener(id==='search'||id==='min-likes'?'input':'change',()=>{state.page=0;render();});}
$('more-filters').addEventListener('click',()=>{const open=$('extra-filters').hidden;$('extra-filters').hidden=!open;$('more-filters').setAttribute('aria-expanded',String(open));});
$('reset').addEventListener('click',()=>{for(const id of filterIds)$(id).value=defaults[id];state.page=0;render();});
$('date-mode').addEventListener('change',()=>renderTimeline(state.filtered));
$('sort').addEventListener('change',()=>{state.page=0;renderTable();});$('page-size').addEventListener('change',()=>{state.page=0;renderTable();});
$('prev').addEventListener('click',()=>{state.page--;renderTable();});$('next').addEventListener('click',()=>{state.page++;renderTable();});
$('export-top').addEventListener('click',exportCsv);$('export-table').addEventListener('click',exportCsv);
$('close-dialog').addEventListener('click',()=>$('project-dialog').close());
$('project-dialog').addEventListener('click',e=>{if(e.target===$('project-dialog')){const r=$('project-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('project-dialog').close();}});
document.addEventListener('click',e=>{
  const project=e.target.closest('[data-project]');if(project){openProject(project.dataset.project);return;}
  const category=e.target.closest('[data-category]');if(category){$('category').value=category.dataset.category;state.page=0;render();return;}
  const day=e.target.closest('[data-day]');if(day&&!day.disabled){let start=day.dataset.day,end=new Date(start+'T12:00:00Z');if(day.dataset.group==='month'){end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);}if(day.dataset.group==='week')end.setUTCDate(end.getUTCDate()+6);$('date-from').value=start;$('date-to').value=end.toISOString().slice(0,10);$('extra-filters').hidden=false;$('more-filters').setAttribute('aria-expanded','true');state.page=0;render();}
});
document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('nav a').forEach(x=>x.classList.toggle('active',x===a));}));

async function boot(){
  try{
    const response=await fetch('data.json');if(!response.ok)throw new Error(`Dataset returned HTTP ${response.status}`);
    const data=await response.json();if(!Array.isArray(data.projects)||!data.projects.length)throw new Error('No project dataset available.');
    state.data=data;
    GalleryTools.init(data);
    $('snapshot-label').textContent=`Snapshot · ${dateText(data.snapshotCompletedAt)}`;
    $('footer-date').textContent=`Captured ${dateTime(data.snapshotCompletedAt)}`;
    const delta=data.reportedTotal-data.projectCount;
    $('coverage-note').innerHTML=`<strong>${number(data.projectCount)} unique projects captured</strong> across ${data.galleryPages} gallery pages · ${number(data.detailSuccess)} detail pages inspected.${delta?` Gallery reports ${number(data.reportedTotal)}; ${delta} fewer unique IDs captured during pagination.`:''} <a href="#methodology">Understand the data</a>`;
    $('method-coverage').textContent=`Collection: ${dateTime(data.snapshotStartedAt)} to ${dateTime(data.snapshotCompletedAt)}. ${number(data.projectCount)} unique IDs from a reported ${number(data.reportedTotal)} gallery entries; ${number(data.detailSuccess)} details inspected, ${number(data.projectCount-data.detailSuccess)} unavailable. ${data.galleryPageFailures?.length||0} gallery page failures. Prior-win enrichment: ${number(data.awardsProfilesChecked)} of ${number(data.awardsProfilesTotal)} unique achievement profiles inspected${data.awardsEnrichedAt?', completed '+dateTime(data.awardsEnrichedAt):''}.`;
    $('wins-method').textContent='Previous-win evidence means at least one listed member has a dated Devpost winner badge achieved before 18 November 2026. Badge levels are not treated as exact win counts. Devpost awards may include participation or submission perks; these badges establish platform prize history, not necessarily a competitive or Meta award. Missing evidence and off-platform wins remain unknown.';
    render();
  }catch(error){$('load-error').hidden=false;$('load-error').textContent='The snapshot could not be loaded. '+error.message+' Please reload or check the dataset file.';$('coverage-note').textContent='Snapshot unavailable.';$('snapshot-label').textContent='Data unavailable';}
}
boot();
