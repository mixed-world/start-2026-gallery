const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {availabilityFor,inspectLink,matchesSignal}=require('../dist/availability.js');
const base={url:'https://devpost.com/software/example',links:[],trailer:false,trial:null};
assert.equal(availabilityFor(base).state,'unknown');
assert.equal(availabilityFor({...base,trailer:true}).state,'video');
assert.equal(availabilityFor({...base,trial:'Mentioned'}).confidence,'Developer-reported');
assert.equal(availabilityFor({...base,links:[{url:'https://github.com/example/source'}],trailer:true}).state,'video');
assert.equal(inspectLink({url:'https://github.com/example/source/releases/tag/v1'}),'download');
assert.equal(inspectLink({url:'https://person.github.io/project/'}),'web');
assert.equal(inspectLink({url:'https://example.com/github.io/demo'}),'website');
assert.equal(inspectLink({url:'javascript:alert(1)'}),null);
assert.equal(inspectLink({url:'https://www.meta.com/s/example'}),'share');
assert.equal(inspectLink({url:'https://www.meta.com/en-gb/experiences/example/123/'}),'store');
assert.equal(inspectLink({url:'https://www.meta.com/experiences/release-channels/123/'}),'access');
assert.equal(inspectLink({url:'https://www.meta.com/experiences/sample-app/123/'}),'store');
assert.equal(inspectLink({url:'https://developers.meta.com/documentation/'}),'reference');
const overlapping={...base,trial:'Mentioned',links:[{url:'https://www.meta.com/experiences/app/123/'},{url:'https://person.github.io/app/'}]};
assert.equal(availabilityFor(overlapping).state,'store');
assert.equal(matchesSignal(overlapping,'web'),true);
assert.equal(matchesSignal(overlapping,'demo'),true);
assert.equal(matchesSignal(overlapping,'download'),false);
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/data.json'),'utf8'));
for(const project of data.projects){
  const a=availabilityFor(project);
  assert.equal(a.destinationTested,false);
  assert.equal(a.price,null);
  assert.equal(a.supportedDevices,null);
  assert.equal(a.languages,null);
  if(project.availability)assert.deepEqual(project.availability,a);
  if(['store','web','download','access','share'].includes(a.state))assert.ok(a[a.state].some(l=>l.url===a.primaryUrl));
}
for(const filename of ['index.html','analytics.html']){
  const content=fs.readFileSync(path.join(__dirname,'../dist',filename),'utf8');
  for(const m of content.matchAll(/(?:src|href)="([^"#?]+)"/g)){
    const file=m[1].split('#')[0].split('?')[0];
    if(!/^https?:/.test(file))assert.ok(fs.existsSync(path.join(__dirname,'../dist',file)),`${filename}: missing ${file}`);
  }
}
console.log(`Passed access-evidence safeguards, availability consistency for ${data.projects.length} projects, and relative asset links on both pages.`);

// Editorial placement respects matching collections and explicit sort choices.
const {featuredFor,discoveryOrder,surpriseProject,collections}=require('../dist/availability.js');
const finger=data.projects.find(p=>p.id==='1545743'),clay=data.projects.find(p=>p.id==='1545716');
assert.ok(finger&&clay);
assert.equal(featuredFor(data.projects.find(p=>p.name==='Fingerslingers')),null);
const play=collections.find(c=>c.id==='play'),create=collections.find(c=>c.id==='create');
const seed=data.snapshotCompletedAt.slice(0,10);
assert.equal(data.projects.filter(play.matches).sort((a,b)=>discoveryOrder(a,b,'mix',seed,{collection:'play'}))[0].id,finger.id);
assert.equal(data.projects.filter(create.matches).sort((a,b)=>discoveryOrder(a,b,'mix',seed,{collection:'create'}))[0].id,clay.id);
assert.equal(finger.estimatedCategory,'Unclassified'); // Raw snapshot stays intact.
const higherLiked={id:'other',name:'A different project',likes:999};
assert.equal([finger,higherLiked].sort((a,b)=>discoveryOrder(a,b,'likes',seed))[0].id,'other');
assert.equal([clay,higherLiked].sort((a,b)=>discoveryOrder(a,b,'name',seed))[0].id,'other');
const unrelated=data.projects.filter(p=>(p.name+' '+p.tagline).toLowerCase().includes('dolphin'));
assert.ok(!unrelated.some(p=>featuredFor(p)));
const stream=values=>()=>{assert.ok(values.length,'Unexpected random draw');return values.shift();};
assert.equal(surpriseProject([higherLiked,finger,clay],stream([0.1,0])).id,finger.id);
assert.equal(surpriseProject([higherLiked,finger,clay],stream([0.1,0.9])).id,clay.id);
assert.equal(surpriseProject([higherLiked,finger,clay],stream([0.9,0])).id,'other');
assert.equal(surpriseProject(unrelated,()=>0.1).id,unrelated[Math.floor(unrelated.length*0.1)].id);
assert.equal(surpriseProject([],()=>{throw Error('Empty results must not draw');}),null);
assert.equal(surpriseProject([clay,finger],stream([0.1,0]),'play').id,finger.id);
// Exhaustive discrete draws confirm the advertised 20% Featured branch while
// preserving a chance for every ordinary candidate, including one-result sets.
let featuredPicks=0,ordinaryPicks=0;
for(let branch=0;branch<100;branch++)for(let pick=0;pick<100;pick++){
 const result=surpriseProject([higherLiked,finger,clay],stream([(branch+.5)/100,(pick+.5)/100]));
 if(featuredFor(result))featuredPicks++;else ordinaryPicks++;
}
assert.equal(ordinaryPicks,2640);
assert.equal(featuredPicks,7360);
console.log('Passed Featured placement, filter eligibility, explicit sorts, and weighted Surprise me checks.');
