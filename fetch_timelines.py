"""
fetch_timelines.py — Downloads Match-V5 Timeline data for all matches.

The Timeline API gives REAL per-minute stats for every player:
  - Actual gold at each minute
  - Actual kills/deaths/assists at each minute
  - Actual CS, level, XP at each minute
  - Events: tower kills, dragon kills, baron kills, etc.

This replaces the broken interpolation approach.

Run: python fetch_timelines.py
Input:  match_history/*.json (existing match data)
Output: match_timelines/<match_id>.json
"""

import requests
import time
import json
import os
import sys

# Set your Riot API key here or via environment variable: RIOT_API_KEY
API_KEY = os.environ.get("RIOT_API_KEY", "YOUR_RGAPI_KEY_HERE")

MATCH_REGION = "europe"
MATCH_DIR = os.path.join(os.path.dirname(__file__), 'match_history')
TIMELINE_DIR = os.path.join(os.path.dirname(__file__), 'match_timelines')

HEADERS = {"X-Riot-Token": API_KEY.strip()}


def main():
    print("=" * 50)
    print("Match Timeline Fetcher")
    print("=" * 50)

    match_files = [f for f in os.listdir(MATCH_DIR) if f.endswith('.json')]
    print(f"Found {len(match_files)} matches")

    os.makedirs(TIMELINE_DIR, exist_ok=True)

    # Check how many we already have
    existing = set(f for f in os.listdir(TIMELINE_DIR) if f.endswith('.json'))
    to_fetch = [f for f in match_files if f not in existing]
    print(f"Already have: {len(existing)} timelines")
    print(f"Need to fetch: {len(to_fetch)} timelines\n")

    if not to_fetch:
        print("All timelines already downloaded!")
        return

    downloaded = 0
    errors = 0

    for i, filename in enumerate(to_fetch):
        match_id = filename.replace('.json', '')
        out_path = os.path.join(TIMELINE_DIR, filename)

        print(f"  [{i+1}/{len(to_fetch)}] {match_id}...", end=" ")

        url = f"https://{MATCH_REGION}.api.riotgames.com/lol/match/v5/matches/{match_id}/timeline"
        r = requests.get(url, headers=HEADERS, timeout=15)

        if r.status_code == 200:
            with open(out_path, 'w') as f:
                json.dump(r.json(), f)
            downloaded += 1
            print("ok")
        elif r.status_code == 429:
            retry = int(r.headers.get('Retry-After', 20))
            print(f"rate limited, waiting {retry}s...")
            time.sleep(retry)
            # Retry
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code == 200:
                with open(out_path, 'w') as f:
                    json.dump(r.json(), f)
                downloaded += 1
                print("ok (retry)")
            else:
                errors += 1
                print(f"fail ({r.status_code})")
        else:
            errors += 1
            print(f"fail ({r.status_code})")

        time.sleep(1.3)  # Rate limit

    print(f"\nDone! Downloaded: {downloaded}, Errors: {errors}")


if __name__ == '__main__':
    main()
