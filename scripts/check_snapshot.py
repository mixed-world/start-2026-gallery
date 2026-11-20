"""Data invariants that protect the dashboard's evidence claims."""
import json
from pathlib import Path

p=json.loads((Path(__file__).resolve().parents[1]/'dist/data.json').read_text())
rows=p['projects']
assert len(rows)==p['projectCount']==len({r['id'] for r in rows})
assert sum(r['detailStatus']=='ok' for r in rows)==p['detailSuccess']
assert not p['galleryPageFailures']
for r in rows:
    assert r['officialCategory'] is None and r['submittedAt'] is None
    assert r['estimatedCategory'] in ['Gaming','Entertainment','Productivity','Unclassified']
    assert isinstance(r['likes'],int) and r['likes']>=0
    assert r['teamSize'] is None or r['teamSize']>0
    assert r['newApp'] in [None,'New build mentioned','Existing app mentioned']
    if r.get('trial'): assert r['trialEvidence']
    if r.get('newApp'): assert r['newAppEvidence']
    if r.get('priorWin'):
        assert any(b['beforeDeadline'] and b['achievedDate']<'2026-11-18' for b in r['teamAwardBadges'])
    assert r['sourceFetchedAt']<=p['snapshotCompletedAt']
print(f'Passed snapshot integrity checks: {len(rows)} unique projects, {p["detailSuccess"]} inspected; evidence-backed positives and null private fields.')
