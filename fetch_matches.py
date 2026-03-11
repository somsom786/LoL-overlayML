"""
fetch_matches.py — Fetches last 100 matches from Riot Match-V5 API
and saves them as JSON files for ML training.

Usage: python fetch_matches.py
"""

import requests
import time
import json
import os
import sys
from urllib.parse import quote

# ═══════════════════════════════════════════════════════════════
# CONFIGURATION — Update your API key here
# Get a fresh key from: https://developer.riotgames.com/
# ═══════════════════════════════════════════════════════════════

# Set your Riot API key here or via environment variable: RIOT_API_KEY
API_KEY = os.environ.get("RIOT_API_KEY", "YOUR_RGAPI_KEY_HERE")

# Your Riot ID (name#tag)
GAME_NAME = "jag gillar bajs"
TAG_LINE = "6666"

# Region routing:
#   Account lookups: europe, americas, asia (use your account region)
#   Match history:   europe, americas, asia (same as account)
ACCOUNT_REGION = "europe"   # EUW/EUNE/TR/RU use "europe"
MATCH_REGION = "europe"     # Must match account region

OUTPUT_DIR = "match_history"

# ═══════════════════════════════════════════════════════════════

HEADERS = {"X-Riot-Token": API_KEY.strip()}


def test_api_key():
    """Test if the API key is valid using the simplest possible endpoint."""
    print("Testing API key validity...")

    # Try multiple endpoints/regions in case one works
    test_urls = [
        f"https://{ACCOUNT_REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{quote(GAME_NAME)}/{TAG_LINE}",
        f"https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{quote(GAME_NAME)}/{TAG_LINE}",
        f"https://euw1.api.riotgames.com/lol/status/v4/platform-data",
    ]

    for url in test_urls:
        try:
            r = requests.get(url, headers=HEADERS, timeout=10)
            print(f"  {url.split('.com')[0].split('//')[1]}.api... → {r.status_code}")

            if r.status_code == 200:
                return url, r
            elif r.status_code == 403:
                print("  → 403 Forbidden: Key is valid but doesn't have access to this endpoint")
            elif r.status_code == 401:
                print("  → 401: Key not recognized")
        except requests.exceptions.RequestException as e:
            print(f"  → Connection error: {e}")

    return None, None


def get_puuid():
    """Resolve Riot ID to PUUID."""
    encoded_name = quote(GAME_NAME)
    print(f"\nResolving PUUID for {GAME_NAME}#{TAG_LINE}...")

    # Try both europe and americas routing
    for region in [ACCOUNT_REGION, "americas", "asia"]:
        url = f"https://{region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{encoded_name}/{TAG_LINE}"
        r = requests.get(url, headers=HEADERS, timeout=10)

        if r.status_code == 200:
            data = r.json()
            print(f"  Found via {region} routing!")
            return data['puuid']
        elif r.status_code == 404:
            print(f"  Not found on {region} (account may be on different region)")
        elif r.status_code == 401:
            print(f"  401 on {region} — API key issue")
            break  # No point trying other regions if key is bad

    return None


def fetch_matches(puuid):
    """Fetch match IDs in batches and download match details."""
    print(f"\nFetching match IDs (games 200-1000)...")

    all_match_ids = []
    for batch_start in range(200, 1000, 100):
        ids_url = f"https://{MATCH_REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?start={batch_start}&count=100"
        r = requests.get(ids_url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            print(f"  Batch start={batch_start}: Error {r.status_code}")
            break
        batch = r.json()
        if not batch:
            print(f"  Batch start={batch_start}: No more games")
            break
        all_match_ids.extend(batch)
        print(f"  Batch start={batch_start}: got {len(batch)} IDs (total: {len(all_match_ids)})")
        time.sleep(1.3)

    match_ids = all_match_ids
    print(f"  Total match IDs: {len(match_ids)}")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    skipped = 0
    downloaded = 0
    errors = 0

    for i, m_id in enumerate(match_ids):
        file_path = os.path.join(OUTPUT_DIR, f"{m_id}.json")
        if os.path.exists(file_path):
            skipped += 1
            continue

        print(f"  [{i+1}/{len(match_ids)}] {m_id}...", end=" ")
        detail_url = f"https://{MATCH_REGION}.api.riotgames.com/lol/match/v5/matches/{m_id}"
        detail_resp = requests.get(detail_url, headers=HEADERS, timeout=15)

        if detail_resp.status_code == 200:
            with open(file_path, "w") as f:
                json.dump(detail_resp.json(), f)
            downloaded += 1
            print("✓")
        elif detail_resp.status_code == 429:
            retry_after = int(detail_resp.headers.get('Retry-After', 20))
            print(f"Rate limited! Waiting {retry_after}s...")
            time.sleep(retry_after)
            # Retry this one
            detail_resp = requests.get(detail_url, headers=HEADERS, timeout=15)
            if detail_resp.status_code == 200:
                with open(file_path, "w") as f:
                    json.dump(detail_resp.json(), f)
                downloaded += 1
                print("✓ (retry)")
        else:
            errors += 1
            print(f"✗ ({detail_resp.status_code})")

        time.sleep(1.3)  # Rate limit: stay under 20/s and 100/2min

    print(f"\nDone! Downloaded: {downloaded}, Skipped: {skipped}, Errors: {errors}")


def main():
    print("=" * 50)
    print("Riot Match History Fetcher")
    print("=" * 50)
    print(f"Key: {API_KEY[:10]}...{API_KEY[-6:]}")
    print(f"Account: {GAME_NAME}#{TAG_LINE}")
    print(f"Region: {ACCOUNT_REGION}")
    print()

    # Step 1: Test the key
    working_url, response = test_api_key()

    if not working_url:
        print("\n" + "=" * 50)
        print("❌ API KEY IS NOT WORKING")
        print("=" * 50)
        print()
        print("Possible fixes:")
        print("  1. Go to https://developer.riotgames.com/")
        print("  2. Click 'REGENERATE API KEY'")
        print("  3. Use the COPY button (not manual select)")
        print("  4. Paste the new key in this script's API_KEY variable")
        print("  5. Wait 30 seconds, then run again")
        print()
        print("  Riot dev keys expire every 24 hours and can take")
        print("  up to 5 minutes to activate after generation.")
        sys.exit(1)

    # If test was the account endpoint, we already have the PUUID
    if "by-riot-id" in working_url and response.status_code == 200:
        puuid = response.json()['puuid']
        print(f"\nPUUID: {puuid[:15]}...")
    else:
        puuid = get_puuid()
        if not puuid:
            print("Could not resolve PUUID. Check your Riot ID.")
            sys.exit(1)

    # Step 2: Fetch matches
    fetch_matches(puuid)


if __name__ == '__main__':
    main()