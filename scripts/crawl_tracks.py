"""
Crawl GameTora track pages and extract structured geometry data.

Two modes:
  A) Direct API   — if we find the AJAX endpoint (fast, no browser needed)
  B) Playwright   — headless browser renders JS, we scrape the DOM

Usage:
  python crawl_tracks.py                    # crawl all tracks (Playwright mode)
  python crawl_tracks.py --tokyo-only       # test: Tokyo 2400m turf only
  python crawl_tracks.py --api-url <url>    # use direct API if known
"""

import json
import re
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Track registry — slug → (race_track_id, distances)
# ---------------------------------------------------------------------------
TRACKS = {
    "sapporo":   (10001, [1500, 1800, 2000, 2600]),
    "hakodate":  (10002, [1200, 1800, 2000, 2600]),
    "fukushima": (10003, [1200, 1800, 2000, 2600]),
    "niigata":   (10004, [1400, 1600, 1800, 2000, 2200, 2400]),
    "tokyo":     (10005, [1400, 1600, 1800, 2000, 2400, 2500]),
    "nakayama":  (10006, [1200, 1600, 1800, 2000, 2200, 2500, 3600]),
    "chukyo":    (10007, [1200, 1400, 1600, 2000, 2200]),
    "kyoto":     (10008, [1400, 1600, 1800, 2000, 2200, 2400, 3000, 3200]),
    "hanshin":   (10009, [1400, 1600, 1800, 2000, 2200, 2400, 2600, 3000, 3200]),
    "kokura":    (10010, [1200, 1800, 2000, 2600]),
    "ooi":       (10011, [1200, 1400, 1600, 1800, 2000, 2600]),
    "kawasaki":  (10012, [900, 1400, 1500, 1600, 2000, 2100]),
    "funabashi": (10013, [1000, 1200, 1500, 1600, 1700, 1800, 2000, 2200, 2400]),
    "morioka":   (10014, [1000, 1200, 1400, 1600, 1800, 2000, 2400]),
}

SURFACES = ["turf", "dirt"]

OUTPUT_DIR = Path("data/track_data")


# ===========================================================================
# Mode A — Direct API (if endpoint is known)
# ===========================================================================

def crawl_via_api(api_url_template: str):
    """
    If the AJAX API endpoint is found (e.g., from browser DevTools),
    call it directly for each track × distance × surface.
    """
    import requests

    OUTPUT_DIR.mkdir(exist_ok=True)

    for slug, (track_id, distances) in TRACKS.items():
        for dist in distances:
            for surf in SURFACES:
                url = api_url_template.format(
                    slug=slug, track_id=track_id, distance=dist, surface=surf
                )
                resp = requests.get(url, timeout=30)
                if resp.status_code == 404:
                    continue  # this distance/surface combo doesn't exist
                resp.raise_for_status()

                data = resp.json() if "application/json" in resp.headers.get("content-type", "") else None
                fname = OUTPUT_DIR / f"{slug}_{dist}_{surf}.json"
                fname.write_text(json.dumps(data if data else {"_raw_html": resp.text}, ensure_ascii=False, indent=2))

                print(f"  ✓ {slug} {dist}m {surf}")
                time.sleep(0.5)  # be polite


# ===========================================================================
# Mode B — Playwright (browser automation)
# ===========================================================================

def crawl_via_playwright(tokyo_only: bool = False):
    """
    Launch headless Chromium, navigate to each track page,
    wait for data tables to render, extract structured data from DOM.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright not installed. Run: pip install playwright && playwright install chromium")
        sys.exit(1)

    OUTPUT_DIR.mkdir(exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        targets = [("tokyo", 10005, [2400])] if tokyo_only else [
            (slug, tid, distances) for slug, tid, distances in TRACKS.items()
        ]

        for slug, track_id, distances in targets:
            for dist in distances:
                for surf in SURFACES:
                    url = f"https://gametora.com/umamusume/racetracks/{slug}#{dist}-{surf}"
                    print(f"Loading: {url}")

                    try:
                        page.goto(url, wait_until="networkidle", timeout=30000)
                        # Wait for data tables to appear (the error text should be gone)
                        page.wait_for_selector("table", timeout=10000)
                    except Exception as e:
                        print(f"  ⚠ {slug} {dist}m {surf}: {e}")
                        continue

                    # Check for error state
                    error_text = page.query_selector("text=Error:")
                    if error_text:
                        print(f"  ✗ {slug} {dist}m {surf}: error state — skipping")
                        continue

                    # Extract structured data from DOM
                    track_data = extract_from_dom(page, slug, track_id, dist, surf)
                    fname = OUTPUT_DIR / f"{slug}_{dist}_{surf}.json"
                    fname.write_text(json.dumps(track_data, ensure_ascii=False, indent=2))
                    print(f"  ✓ {slug} {dist}m {surf} → {fname}")

                    time.sleep(1)  # be polite

        browser.close()


def extract_from_dom(page, slug: str, track_id: int, distance: int, surface: str) -> dict:
    """
    Extract track data from the rendered DOM.
    This needs to be tuned once we see the actual page structure.
    The selectors below are educated guesses — adjust after inspecting the page.
    """

    def _parse_table(heading_text: str) -> list[dict]:
        """Find a table by its preceding heading text, return rows as dicts."""
        # Look for heading containing the text, then find the next table
        heading = page.query_selector(f'*:has-text("{heading_text}")')
        if not heading:
            return []

        # The table might be a sibling or child of the heading's container
        # Try common patterns
        table = page.evaluate("""
            (headingText) => {
                const headings = document.querySelectorAll('h2, h3, h4, th, .heading, .title');
                for (const h of headings) {
                    if (h.textContent.includes(headingText)) {
                        // Find nearest table: next sibling, parent sibling, or ancestor sibling
                        let el = h.nextElementSibling;
                        while (el) {
                            if (el.tagName === 'TABLE') return el.outerHTML;
                            const t = el.querySelector('table');
                            if (t) return t.outerHTML;
                            el = el.nextElementSibling;
                        }
                        // Try parent's next sibling
                        el = h.parentElement.nextElementSibling;
                        while (el) {
                            if (el.tagName === 'TABLE') return el.outerHTML;
                            const t = el.querySelector('table');
                            if (t) return t.outerHTML;
                            el = el.nextElementSibling;
                        }
                    }
                }
                return null;
            }
        """, heading_text)

        if not table:
            return []

        # Parse the HTML table into list of dicts
        rows = page.evaluate("""
            (html) => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const table = doc.querySelector('table');
                const headers = [];
                const rows = [];

                // Get headers from first row
                const ths = table.querySelectorAll('thead th, tr:first-child th, tr:first-child td');
                ths.forEach(th => headers.push(th.textContent.trim().toLowerCase().replace(/\\s+/g, '_')));

                // Get data rows
                const trs = table.querySelectorAll('tbody tr, tr');
                let started = false;
                for (const tr of trs) {
                    const tds = tr.querySelectorAll('td');
                    if (tds.length === 0) continue;
                    // Skip header row
                    if (tr.querySelector('th') && !started) { started = true; continue; }
                    started = true;

                    const row = {};
                    tds.forEach((td, i) => {
                        const key = headers[i] || `col_${i}`;
                        row[key] = td.textContent.trim();
                    });
                    if (Object.keys(row).length > 0) rows.push(row);
                }
                return rows;
            }
        """, table)

        return rows

    # Parse numbers from text like "325 m", "2.0", "Uphill (1.5)"
    def _parse_meters(text: str) -> float | None:
        m = re.search(r'(\d+\.?\d*)\s*m', text)
        return float(m.group(1)) if m else None

    def _parse_gradient(text: str) -> float | None:
        # "Uphill (1.5)" or "Downhill (-1.5)" or "2.0"
        m = re.search(r'\((-?\d+\.?\d*)\)', text)
        if m:
            return float(m.group(1))
        m = re.search(r'(-?\d+\.?\d*)', text)
        return float(m.group(1)) if m else None

    # ---- Extract each section ----
    raw_phases = _parse_table("Phase") or _parse_table("Early")
    raw_corners = _parse_table("Corner")
    raw_slopes = _parse_table("Slope") or _parse_table("Gradient")
    raw_straights = _parse_table("Straight")

    # Normalize phases
    phases = []
    phase_map = {"early": 0, "mid": 1, "late": 2, "last": 3,
                 "序盤": 0, "中盤": 1, "終盤": 2, "追込": 3}
    for row in raw_phases:
        name = row.get("phase", row.get("name", "")).lower()
        start = _parse_meters(row.get("start", row.get("start_m", "")))
        end = _parse_meters(row.get("end", row.get("end_m", "")))
        if name and start is not None and end is not None:
            pid = None
            for k, v in phase_map.items():
                if k in name:
                    pid = v
                    break
            phases.append({"phase_id": pid, "label_jp": name, "start_m": start, "end_m": end})

    # Normalize corners
    corners = []
    for row in raw_corners:
        label = row.get("corner", row.get("name", ""))
        start = _parse_meters(row.get("start", row.get("start_m", "")))
        end = _parse_meters(row.get("end", row.get("end_m", "")))
        if label and start is not None and end is not None:
            corners.append({"label": label, "start_m": start, "end_m": end})

    # Normalize slopes
    slopes = []
    for row in raw_slopes:
        start = _parse_meters(row.get("start", row.get("start_m", "")))
        end = _parse_meters(row.get("end", row.get("end_m", "")))
        grad = _parse_gradient(row.get("gradient", row.get("direction", "")))
        direction = "uphill" if (grad or 0) > 0 else "downhill"
        if start is not None and end is not None:
            slopes.append({"start_m": start, "end_m": end, "gradient_pct": abs(grad) if grad else None, "direction": direction})

    # Normalize straights
    straights = []
    for row in raw_straights:
        label = row.get("straight", row.get("name", ""))
        start = _parse_meters(row.get("start", row.get("start_m", "")))
        end = _parse_meters(row.get("end", row.get("end_m", "")))
        if start is not None and end is not None:
            straights.append({"label": label, "start_m": start, "end_m": end})

    return {
        "slug": slug,
        "race_track_id": track_id,
        "distance": distance,
        "surface": surface,
        "phases": phases,
        "corners": corners,
        "slopes": slopes,
        "straights": straights,
    }


# ===========================================================================
# CLI
# ===========================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Crawl GameTora track pages")
    parser.add_argument("--tokyo-only", action="store_true", help="Test: only Tokyo 2400m")
    parser.add_argument("--api-url", type=str, help="Direct API URL template, e.g. 'https://gametora.com/api/track/{slug}/{distance}/{surface}'")
    args = parser.parse_args()

    if args.api_url:
        crawl_via_api(args.api_url)
    else:
        crawl_via_playwright(tokyo_only=args.tokyo_only)
