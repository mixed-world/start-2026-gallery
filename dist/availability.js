/* Shared, conservative access-signal rules. No destination is claimed tested. */
(function(root){
  'use strict';
  const names={store:'Store link listed',web:'Web experience link listed',download:'Download link listed',access:'Access request link listed',share:'Meta share link listed',demo:'Demo / trial mentioned',website:'Project website listed',video:'Video only observed',unknown:'Availability unknown'};
  function inspectLink(link){
    try{
      const u=new URL(link.url),host=u.hostname.toLowerCase(),path=u.pathname.toLowerCase();
      if(!['https:','http:'].includes(u.protocol))return null;
      if(/(^|\.)meta\.com$/.test(host)&&/^\/s\//.test(path))return 'share';
      if(/(?:release-channels?|invite|request-access|testflight)/.test(path)||host==='testflight.apple.com')return 'access';
      if(/\.(apk|zip|exe|dmg|aab)$/.test(path)||host==='drive.google.com'||host==='dl.dropboxusercontent.com'||/github\.com$/.test(host)&&path.includes('/releases'))return 'download';
      if((/(^|\.)(meta|oculus)\.com$/.test(host)&&/^(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/experiences\//.test(path))||/(^|\.)(itch\.io|steampowered\.com|sidequestvr\.com)$/.test(host)||host==='play.google.com'||host==='apps.apple.com')return 'store';
      if(/\.(github\.io|vercel\.app|netlify\.app|pages\.dev|replit\.app|glitch\.me)$/.test(host))return 'web';
      if(/(^|\.)(github\.com|gitlab\.com|bitbucket\.org|youtube\.com|youtu\.be|vimeo\.com|discord\.gg|discord\.com|linkedin\.com|x\.com|twitter\.com|facebook\.com|instagram\.com|docs\.google\.com|developers\.meta\.com)$/.test(host))return 'reference';
      return 'website';
    }catch{return null;}
  }
  function availabilityFor(project){
    const groups={store:[],web:[],download:[],access:[],share:[],website:[],reference:[]};
    for(const link of project.links||[]){const type=inspectLink(link);if(type)groups[type].push(link);}
    const state=['access','store','web','download','share'].find(type=>groups[type].length)||(project.trial?'demo':groups.website.length?'website':project.trailer?'video':'unknown');
    const primary=(groups[state]||[])[0]||groups.website[0]||null;
    const reason={share:'A Meta short share URL is listed. Its destination has not been resolved; it may lead to a store page, a restricted invitation, or another Meta page.',store:'A store or distribution URL appears on the public project page. Release status, price, install access, and device compatibility have not been verified.',web:'A hosted web URL appears on the public project page. It may be a playable experience or a landing page; launch behavior has not been tested.',download:'A file, release, or download URL appears on the public project page. File contents, installability, and safety have not been tested.',access:'An invite, release-channel, or access-request URL is listed. The invitation may be restricted or expired.',demo:'The project story mentions a trial or playable demo. Access and offer terms remain unverified.',website:'A project website is listed. A public playable build has not been established.',video:'An embedded video is visible, and our rules found no store, web experience, download, or access-request link. This does not establish that no build exists.',unknown:'No public access signal was established from the captured page. Unknown does not mean unavailable.'}[state];
    return {state,label:names[state],confidence:state==='unknown'?'Unknown':state==='demo'?'Developer-reported':'Observed',reason,primaryUrl:primary?.url||null,sourceUrl:project.url,sourceCheckedAt:project.sourceFetchedAt||project.checkedAt||null,destinationTested:false,price:null,languages:null,supportedDevices:null,...groups};
  }
  function matchesSignal(project,signal,access=availabilityFor(project)){
    if(signal==='all')return true;
    if(signal==='demo')return Boolean(project.trial);
    if(['store','web','download','access','share','website'].includes(signal))return access[signal].length>0;
    return access.state===signal;
  }
  const collections=[
    {id:'all',name:'All projects',description:'An evenly shuffled view of the complete snapshot.',confidence:'Observed',matches:()=>true},
    {id:'play',name:'Play & puzzle',description:'Titles and taglines with a leading Gaming keyword estimate.',confidence:'Estimated',matches:p=>p.estimatedCategory==='Gaming'},
    {id:'create',name:'Create & design',description:'Public titles and taglines mentioning sculpting, modeling, painting, creative tools, architecture, or design.',confidence:'Estimated',matches:p=>/\b(sculpt\w*|model[li]ng|paint\w*|creative tools?|creators?|architecture|design\w*|atelier|3d print\w*|sewing|garment)\b/i.test(p.name+' '+p.tagline)},
    {id:'unwind',name:'Unwind & explore',description:'Public titles and taglines mentioning calm, travel, cinema, nature, music, or relaxation.',confidence:'Estimated',matches:p=>/\b(relax\w*|calm\w*|travel|cinema|nature|meditat\w*|music|ocean|museum|campfire|aquarium|destinations?)\b/i.test(p.name+' '+p.tagline)},
    {id:'access',name:'Find access links',description:'Projects with a listed store, web, download, access-request, or Meta share URL. Destinations are untested.',confidence:'Observed',matches:p=>{const a=availabilityFor(p);return ['store','web','download','access','share'].some(k=>a[k].length);}},
    {id:'solo',name:'Solo creators',description:'Exactly one collaborator is listed publicly on Devpost.',confidence:'Observed',matches:p=>p.teamSize===1},
    {id:'hands',name:'Hand tracking mentions',description:'A hand-tracking keyword was found in the project story. Features are not verified.',confidence:'Estimated',matches:p=>p.themes?.includes('Hand tracking')},
    {id:'less-seen',name:'One like or fewer',description:'Projects with zero or one public likes at capture. This is an exposure filter, not an assessment of quality.',confidence:'Observed',matches:p=>p.likes<=1}
  ];
  const api={availabilityFor,inspectLink,matchesSignal,collections,names};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.GalleryAvailability=api;
})(globalThis);
