"""Normalize derived fields offline after collection and optional badge enrichment."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from collect import estimate_category, CACHE, GALLERY

ROOT = Path(__file__).resolve().parents[1]
def run():
    target = ROOT / 'dist/data.json'
    payload = json.loads(target.read_text())
    times=[]
    for project in payload['projects']:
        estimate_category(project)
        if not project.get('teamSize'):
            project['teamSize'] = None
        cached = CACHE / hashlib.sha256(project['url'].encode()).hexdigest()
        if cached.exists():
            stamp=cached.stat().st_mtime
            times.append(stamp)
            project['sourceFetchedAt']=datetime.fromtimestamp(stamp,timezone.utc).isoformat()
        # A mention about game modes alone does not establish a pre-existing app.
        if 'existing game modes' in (project.get('newAppEvidence') or '').lower():
            project['newApp']=None
            project['newAppEvidence']=None
    for n in range(1,payload['galleryPages']+1):
        cached=CACHE / hashlib.sha256(f'{GALLERY}?page={n}'.encode()).hexdigest()
        if cached.exists(): times.append(cached.stat().st_mtime)
    payload['snapshotStartedAt']=datetime.fromtimestamp(min(times),timezone.utc).isoformat()
    payload['snapshotCompletedAt']=datetime.fromtimestamp(max(times),timezone.utc).isoformat()
    payload['datasetBuiltAt']=datetime.now(timezone.utc).isoformat()
    payload['metricDefinitions']={
        'officialCategory':'Not public; null. estimatedCategory is a keyword estimate from title and tagline.',
        'submittedAt':'Not public; null. publishedAt is a started-this-project activity date, not submission time.',
        'createdAt':'Devpost JSON-LD dateCreated; not an app launch or submission timestamp.',
        'newApp':'Narrative phrase only; New build mentioned or Existing app mentioned. Null means unknown.',
        'heroImage':'Custom gallery thumbnail, not an assessment of a dedicated hero asset.',
        'trailer':'An iframe.video-embed exists in #gallery; not necessarily a trailer or accessible video.',
        'teamSize':'Count of listed public collaborators, gallery count fallback. Null if none visible.',
        'trial':'Narrative trial/demo phrase only. Null means unknown, not no trial.',
        'priorWin':'Dated team member Devpost winner badge before 2026-11-18; prizes may include participation perks. Null means unknown.',
        'sourceFetchedAt':'HTTP response cached at this time; checkedAt can be a later parsing time.',
        'likes':'Gallery card like count; may include engagement from prior events.',
        'themes':'Narrative keyword matches, not verified capabilities.'
    }
    temporary=target.with_suffix('.final.tmp')
    temporary.write_text(json.dumps(payload,ensure_ascii=False))
    temporary.replace(target)
    print(f'Finalized {len(payload["projects"])} projects, preserved badge enrichment.')

if __name__=='__main__':run()
