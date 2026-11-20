"""Rebuild the public Devpost gallery snapshot. No login, cookies or private APIs.
Run: .venv/bin/python scripts/collect.py (resumes cached successful requests).
"""
import concurrent.futures as cf
import hashlib
import json
import math
import re
import time
import warnings
from datetime import datetime, timezone
from pathlib import Path

warnings.filterwarnings('ignore', message='urllib3 v2 only supports')
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache'
CACHE.mkdir(exist_ok=True)
GALLERY = 'https://start-developer-competition-26.devpost.com/project-gallery'
START = datetime.now(timezone.utc).isoformat()

def fetch(url):
    file = CACHE / hashlib.sha256(url.encode()).hexdigest()
    if file.exists():
        return file.read_text()
    for attempt in range(4):
        try:
            response = requests.get(url, timeout=35, headers={'User-Agent': 'GalleryObservatory/1.0 (public project research)'})
            response.raise_for_status()
            if 'Just a moment...' in response.text:
                raise RuntimeError('Cloudflare challenge')
            file.write_text(response.text)
            time.sleep(.12)
            return response.text
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)

def text(el):
    return el.get_text(' ', strip=True) if el else ''

def page(number):
    soup = BeautifulSoup(fetch(f'{GALLERY}?page={number}'), 'html.parser')
    items = []
    for el in soup.select('.gallery-item'):
        image = el.select_one('figure img')
        def count(selector):
            value = re.sub(r'[^0-9]', '', text(el.select_one(selector)))
            return int(value) if value else 0
        items.append(dict(id=el['data-software-id'], name=text(el.select_one('h5')),
                          tagline=text(el.select_one('.tagline')),
                          url=el.select_one('a.link-to-software')['href'],
                          image=image.get('src') if image else None,
                          likes=count('.like-count'), comments=count('.comment-count'),
                          teamSize=len(el.select('.members .user-profile-link')),
                          galleryPage=number))
    return number, items

def evidence_sentences(story, regex):
    for sentence in re.split(r'(?<=[.!?])\s+|\n+', story):
        match = re.search(regex, sentence, re.I)
        if match:
            start = max(0, match.start() - 120)
            return sentence[start:start + 380]
    return None

def estimate_category(item):
    context = item['name'] + ' ' + item['tagline']
    scores = {
        'Gaming': len(re.findall(r'\b(games?|gaming|shooters?|roguelites?|roguelikes?|puzzles?|rpg|rts|arcade|combat|battles?|racing|simulators?|survival|players?|multiplayer|gameplay|boss|quests?|adventure|real.time strategy|rhythm|soccer|hockey|duels?|fighters?|fight|skatepark|skateboarding|fingerboarding|tabletop sports)\b', context, re.I)),
        'Productivity': len(re.findall(r'\b(productivity|workspace|workspaces|design|designer|modeling|modelling|creators?|atelier|construction|training|surgery|anatomy|learning|education|educational|study|studying|notes|planning|workflow|coding|sculpt(?:ing)?|clay canvas|3d printing|architecture|spreadsheets?|meditation|therapy|outfit planner|food ordering|garment|sewing)\b', context, re.I)),
        'Entertainment': len(re.findall(r'\b(entertainment|cinema|movies?|films?|music|musical|concert|concerts|travel|tourism|destinations?|watch|watching|storytelling|theater|theatre|relax|relaxation|campfire|aquarium|museum|art gallery|virtual pets?|companions?|penguin|dolphins?|guitarist|instruments?|relaxing)\b', context, re.I))
    }
    ranked = sorted(scores, key=scores.get, reverse=True)
    category = ranked[0] if scores[ranked[0]] > 0 and scores[ranked[0]] > scores[ranked[1]] else 'Unclassified'
    item.update(estimatedCategory=category, categoryEvidence=context[:500] if category != 'Unclassified' else None)

def detail(item):
    try:
        soup = BeautifulSoup(fetch(item['url']), 'html.parser')
        structured = soup.select_one('#software-json-ld')
        ld = json.loads(structured.string) if structured else {}
        main = soup.select_one('#app-details-left')
        story_node = main.select_one('#gallery + div') if main else None
        story = story_node.get_text('\n', strip=True) if story_node else ''
        tags = [text(t) for t in soup.select('#built-with .cp-tag')]
        members = []
        for member in soup.select('#app-team .software-team-member'):
            a = member.select_one('a.user-profile-link')
            img = member.select_one('img')
            if a:
                members.append({'url': a['href'], 'name': img.get('alt', '') if img else text(a)})
        images = soup.select('#gallery img.software_photo_image')
        videos = [e.get('src') for e in soup.select('#gallery iframe.video-embed')]
        links = [{'url': a['href'], 'label': text(a)} for a in soup.select('.app-links a[href]')]
        updates = soup.select('time.timeago[datetime]')
        # The activity feed's 'started this project' date is not the submission time.
        published = next((e['datetime'] for e in updates if 'started this project' in text(e.find_parent('p') or e.parent.parent)), None)
        thumbnail = item.get('image', '') or ''
        hero = bool(thumbnail and 'placeholder' not in thumbnail and 'defaults/' not in thumbnail)
        item.update(detailStatus='ok', team=members, teamSize=len(members) or item['teamSize'],
                    tags=tags, heroImage=hero, trailer=bool(videos), videoUrls=videos,
                    screenshots=len(images), links=links, storyWords=len(story.split()),
                    createdAt=ld.get('dateCreated'), publishedAt=published,
                    submittedAt=None, officialCategory=None, newApp=None,
                    trial=None, priorWin=None,
                    hackathons=[{'name': text(a), 'url': a['href']} for a in soup.select('#submissions .software-list-content p > a')],
                    checkedAt=datetime.now(timezone.utc).isoformat(),
                    sourceFetchedAt=datetime.fromtimestamp((CACHE / hashlib.sha256(item['url'].encode()).hexdigest()).stat().st_mtime, timezone.utc).isoformat())
        # Inferences and mentions are separate from organizer-selected/private answers.
        estimate_category(item)
        trial_pattern = r'\b(free trial|trial version|trial available|offers? a trial|playable demo|free demo|demo (?:is )?available|download (?:the |a )?demo)\b'
        trial_evidence = evidence_sentences(story, trial_pattern)
        if trial_evidence:
            item.update(trial='Mentioned', trialEvidence=trial_evidence)
        new_evidence = evidence_sentences(story, r'\b(brand.new (?:app|game|project)|new (?:app|game) (?:built|created|developed)|built from scratch|created from scratch|started from scratch|existing app|existing game|previously released|already (?:on|available)|originally released)\b')
        if new_evidence:
            item.update(newApp=('Existing app mentioned' if re.search(r'existing app|existing game|previously released|already (?:on|available)|originally released', new_evidence, re.I) else 'New build mentioned'), newAppEvidence=new_evidence)
        item['storeLinks'] = [l for l in links if re.search(r'(meta\.com/(?:experiences|s/)|oculus\.com/experiences|store\.steampowered\.com|itch\.io)', l['url'], re.I)]
        item['sourceLinks'] = [l for l in links if re.search(r'(github\.com|gitlab\.com|bitbucket\.org)', l['url'], re.I)]
        item['themes'] = [name for name,pattern in {
            'Hand tracking':r'\b(hand.tracking|hand.tracked|hands.first|hands.only|bare hands|no controllers)\b',
            'Mixed reality':r'\b(mixed.reality|passthrough|\bMR\b)\b',
            'Seated':r'\b(seated|sitting|sit down|from your (?:seat|desk|couch))\b',
            'AI mentions':r'\b(AI|artificial intelligence|LLM|generative)\b',
            'Multiplayer':r'\b(multiplayer|co.op|multi.player)\b',
            'Accessibility':r'\b(accessibility|accessible|disabilities|disability)\b'
        }.items() if re.search(pattern, story, re.I)]
        prior = soup.select('#submissions [class*="winner"], #submissions [class*="award"], #submissions [class*="prize"]')
        if prior:
            item.update(priorWin='Project award visible', priorWinEvidence='; '.join(text(e) for e in prior))
        return item
    except Exception as exc:
        item.update(detailStatus='failed', detailError=str(exc)[:160], estimatedCategory='Unclassified')
        return item

def run():
    initial = BeautifulSoup(fetch(GALLERY + '?page=1'), 'html.parser')
    total = int(text(initial.select_one('.pagination-info b:last-child')))
    pages = math.ceil(total / 24)
    print(f'Gallery reports {total} projects across {pages} pages', flush=True)
    indexed = {}
    failures = []
    with cf.ThreadPoolExecutor(max_workers=5) as pool:
        tasks = {pool.submit(page, n): n for n in range(1, pages + 1)}
        for fut in cf.as_completed(tasks):
            try:
                n, items = fut.result()
                indexed[n] = items
                if n % 10 == 0: print(f'Gallery page {n}/{pages}', flush=True)
            except Exception as exc:
                failures.append({'page': tasks[fut], 'error': str(exc)})
    items = list({p['id']: p for n in sorted(indexed) for p in indexed[n]}.values())
    (ROOT / '.cache/gallery.json').write_text(json.dumps(items))
    print(f'{len(items)} unique gallery projects. Fetching details…', flush=True)
    output = []
    with cf.ThreadPoolExecutor(max_workers=5) as pool:
        for item in pool.map(detail, items):
            output.append(item)
            if len(output) % 100 == 0:
                print(f'Details {len(output)}/{len(items)}; failures {sum(p["detailStatus"] != "ok" for p in output)}', flush=True)
                (ROOT / '.cache/progress.json').write_text(json.dumps(output))
    cache_files = [f for f in CACHE.iterdir() if re.fullmatch(r'[a-f0-9]{64}', f.name)]
    fetched_start = min(f.stat().st_mtime for f in cache_files)
    fetched_end = max(f.stat().st_mtime for f in cache_files)
    payload = dict(sourceUrl=GALLERY, snapshotStartedAt=datetime.fromtimestamp(fetched_start, timezone.utc).isoformat(),
                   snapshotCompletedAt=datetime.fromtimestamp(fetched_end, timezone.utc).isoformat(),
                   datasetBuiltAt=datetime.now(timezone.utc).isoformat(),
                   reportedTotal=total, galleryPages=pages, galleryPageFailures=failures,
                   projectCount=len(items), detailSuccess=sum(p['detailStatus']=='ok' for p in output),
                   projects=output)
    target = ROOT / 'dist/data.json'
    temp = target.with_suffix('.tmp')
    temp.write_text(json.dumps(payload, ensure_ascii=False))
    temp.replace(target)
    print(f'Saved {target}: {len(output)} projects, {payload["detailSuccess"]} detail pages', flush=True)

if __name__ == '__main__':
    run()
