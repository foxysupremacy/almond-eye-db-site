"""Unit tests for the GameTora card crawler's incremental selection.

    python -m unittest scripts/test_crawl_gametora_cards.py
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from crawl_gametora_cards import needs_crawl

CHAIN = {"eventId": 1, "nameEn": "a", "nameJp": "a", "eventType": "chain", "chainStep": 1, "choices": []}
RANDOM = {"eventId": 2, "nameEn": "b", "nameJp": "b", "eventType": "random", "choices": []}


def card(**overrides) -> dict:
    base = {
        "id": "30311",
        "nameEn": "Efforia",
        "rarity": 3,
        "type": "speed",
        "urlName": "30311-efforia",
        "eventSkills": [1],
        "hintSkills": [2],
        "eventDetails": [CHAIN, RANDOM],
    }
    base.update(overrides)
    return base


class NeedsCrawlTest(unittest.TestCase):
    def test_complete_ssr_is_skipped(self):
        self.assertFalse(needs_crawl(card()))

    def test_never_crawled_card_is_selected(self):
        self.assertTrue(needs_crawl(card(urlName=None, eventDetails=[])))

    def test_japanese_fallback_name_is_selected(self):
        self.assertTrue(needs_crawl(card(nameEn="エフフォーリア")))

    def test_card_crawled_before_events_were_published_is_selected(self):
        # Release-day crawl: slug resolved, but GameTora had no events yet.
        self.assertTrue(needs_crawl(card(type="friend", eventSkills=[], hintSkills=[], eventDetails=[])))

    def test_non_pal_ssr_without_chain_is_selected(self):
        self.assertTrue(needs_crawl(card(type="power", eventDetails=[RANDOM])))

    def test_pal_and_group_ssr_without_chain_are_skipped(self):
        for kind in ("friend", "group"):
            self.assertFalse(needs_crawl(card(type=kind, eventDetails=[RANDOM])))

    def test_r_card_without_chain_is_skipped(self):
        self.assertFalse(needs_crawl(card(rarity=1, eventDetails=[RANDOM])))

    def test_string_rarity_is_accepted(self):
        self.assertTrue(needs_crawl(card(rarity="3", eventDetails=[RANDOM])))


if __name__ == "__main__":
    unittest.main()
