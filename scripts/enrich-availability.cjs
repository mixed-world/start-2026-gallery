const fs=require('node:fs');
const path=require('node:path');
const {availabilityFor}=require('../dist/availability.js');
const target=path.resolve(__dirname,'../dist/data.json');
const data=JSON.parse(fs.readFileSync(target,'utf8'));
for(const p of data.projects){p.availability=availabilityFor(p);p.availabilityStatus=p.availability.state;p.availabilityConfidence=p.availability.confidence;}
(data.metricDefinitions||={}).availability='A conservative public access signal, derived from listed URLs or developer statements. No linked destination, install, release status, price, language, or device compatibility is verified.';
data.availabilityDerivedAt=new Date().toISOString();
fs.writeFileSync(target+'.tmp',JSON.stringify(data));fs.renameSync(target+'.tmp',target);
const counts={};for(const p of data.projects)counts[p.availabilityStatus]=(counts[p.availabilityStatus]||0)+1;
console.log('Access signals:',counts);
