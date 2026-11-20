"""Enrich data.json with public team-member Devpost winner badges.

Run after collect.py: .venv/bin/python scripts/enrich_awards.py
Only a dated winner badge provides positive evidence. No badge stays unknown.
Devpost awards can include noncompetitive perks; this is platform badge history,
not a claim about Meta prizes or a count of competitive victories.
"""
import concurrent.futures as cf
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup
from collect import fetch, text

ROOT = Path(__file__).resolve().parents[1]
CUTOFF = datetime(2026, 11, 18).date()


def inspect_profile(profile):
    url = profile.rstrip('/') + '/achievements'
    result = {'url': url, 'status': 'failed', 'badges': []}
    try:
        soup = BeautifulSoup(fetch(url), 'html.parser')
        if not soup.select_one('body.action-achievements'):
            raise ValueError('Not a public achievements page')
        for tile in soup.select('.user-achievement-tile'):
            heading = text(tile.select_one('h5'))
            if not re.match(r'^(Hackathon Winner|Dual Boot Winner|Grand Prize Winner)\b', heading):
                continue
            date_text = text(tile.select_one('.achieved-at')).replace('Achieved ', '')
            try:
                achieved = datetime.strptime(date_text, '%B %d, %Y').date()
            except ValueError:
                achieved = None
            result['badges'].append({
                'title': heading,
                'description': text(tile.select_one('.content p')),
                'achievedDate': achieved.isoformat() if achieved else None,
                'beforeDeadline': bool(achieved and achieved < CUTOFF),
                'sourceUrl': url,
            })
        result['status'] = 'ok'
    except Exception as exc:
        result['error'] = str(exc)[:160]
    return profile, result


def run():
    target = ROOT / 'dist/data.json'
    payload = json.loads(target.read_text())
    profiles = sorted(set(member['url'] for project in payload['projects'] for member in project.get('team', [])))
    results = {}
    print(f'Checking {len(profiles)} unique team-member achievement pages', flush=True)
    with cf.ThreadPoolExecutor(max_workers=5) as pool:
        for profile, result in pool.map(inspect_profile, profiles):
            results[profile] = result
            if len(results) % 100 == 0:
                print(f'Achievements {len(results)}/{len(profiles)}; winner profiles {sum(any(b["beforeDeadline"] for b in r["badges"]) for r in results.values())}', flush=True)
    for project in payload['projects']:
        checks = [results[m['url']] for m in project.get('team', [])]
        badges = [{**b, 'memberName': member['name']} for member in project.get('team', []) for b in results[member['url']]['badges']]
        project['teamAwardBadges'] = badges
        project['teamAwardProfilesChecked'] = sum(c['status'] == 'ok' for c in checks)
        project['teamAwardProfilesTotal'] = len(checks)
        prior = [b for b in badges if b['beforeDeadline']]
        project['priorWin'] = 'Team winner badge visible' if prior else None
        project['priorWinEvidence'] = '; '.join(f'{b["memberName"]}: {b["title"]} (achieved {b["achievedDate"]})' for b in prior) if prior else None
    payload['awardsEnrichedAt'] = datetime.now(timezone.utc).isoformat()
    payload['awardsProfilesChecked'] = sum(r['status'] == 'ok' for r in results.values())
    payload['awardsProfilesTotal'] = len(results)
    temporary = target.with_suffix('.awards.tmp')
    temporary.write_text(json.dumps(payload, ensure_ascii=False))
    temporary.replace(target)
    (ROOT / '.cache/award-profiles.json').write_text(json.dumps(results, ensure_ascii=False))
    print(f'Saved badges for {sum(bool(p["priorWin"]) for p in payload["projects"])} projects; checked {payload["awardsProfilesChecked"]}/{len(results)} profiles', flush=True)


if __name__ == '__main__':
    run()
