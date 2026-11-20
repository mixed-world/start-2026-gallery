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
