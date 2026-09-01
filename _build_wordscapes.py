#!/usr/bin/env python3
"""Generate 20,000 Wordscapes levels in yesterday's style, with a 3/4/5+ wheel ramp."""
import json
import random
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT_FILE = ROOT / "wordscapes-levels.json"
GRID_W = 12
GRID_H = 12
VOWELS = set("aeiou")
TOTAL = 20000


def load_common_words():
    ns = {}
    exec((ROOT / "my_dict.py").read_text(encoding="utf-8"), ns)
    words = set()
    for key in ("easy", "medium", "hard", "long"):
        for w in ns.get(key, []):
            w = str(w).strip().lower()
            if w.isalpha() and 3 <= len(w) <= 8:
                words.add(w)
    for extra in ("deli", "ent", "wars", "raws", "ears", "likes"):
        if extra.isalpha() and 3 <= len(extra) <= 8:
            words.add(extra)
    words.discard("ass")
    return words


def can_make(word, bag):
    need = Counter(word)
    return all(need[ch] <= bag[ch] for ch in need)


def fits(grid, word, x, y, dx, dy, must_cross):
    cells = [(x + i * dx, y + i * dy) for i in range(len(word))]
    crossed = 0
    for i, (cx, cy) in enumerate(cells):
        if not (0 <= cx < GRID_W and 0 <= cy < GRID_H):
            return False
        existing = grid.get((cx, cy))
        if existing:
            if existing != word[i]:
                return False
            crossed += 1
        else:
            px, py = -dy, dx
            if grid.get((cx + px, cy + py)) or grid.get((cx - px, cy - py)):
                return False
    before = (x - dx, y - dy)
    after = (x + len(word) * dx, y + len(word) * dy)
    if grid.get(before) or grid.get(after):
        return False
    if must_cross and crossed == 0:
        return False
    return True


def place(grid, word, x, y, dx, dy):
    for i, ch in enumerate(word):
        grid[(x + i * dx, y + i * dy)] = ch


def find_spots(grid, word):
    spots = []
    letters = {}
    for (cx, cy), ch in grid.items():
        letters.setdefault(ch, []).append((cx, cy))
    for i, ch in enumerate(word):
        for gx, gy in letters.get(ch, []):
            spots.append((gx - i, gy, 1, 0))
            spots.append((gx, gy - i, 0, 1))
    return spots


def level_payload(board, seed):
    cells_x = []
    cells_y = []
    for item in board:
        dx = 1 if item["dir"] == "H" else 0
        dy = 1 if item["dir"] == "V" else 0
        for i in range(len(item["word"])):
            cells_x.append(item["x"] + i * dx)
            cells_y.append(item["y"] + i * dy)
    ox, oy = min(cells_x), min(cells_y)
    words = []
    for item in board:
        words.append({
            "word": item["word"],
            "x": item["x"] - ox,
            "y": item["y"] - oy,
            "dir": item["dir"],
        })
    return {"tiles": list(seed), "words": words}


def unique_enough(word):
    return len(set(word)) >= len(word) - 1


def good_seed(word, length):
    vowels = len(set(word) & VOWELS)
    if length <= 3:
        return len(set(word)) >= 2 and vowels >= 1
    if length == 4:
        return unique_enough(word) and vowels >= 1
    return unique_enough(word) and vowels >= 2


def wheel_length(index, rng):
    if index < 10:
        return 3
    if index < 30:
        return 4
    if index < 500:
        return 5
    if index < 1000:
        return 6
    if index < 1500:
        return 7
    if index < 2000:
        return 8
    return rng.choice([3, 4, 5, 6, 7, 8])


def level_limits(length):
    if length <= 3:
        return 2, 2, 6
    if length == 4:
        return 3, 3, 8
    if length >= 8:
        return 6, 4, 10
    return 6, 4, 8


def build_level(seed, pool, rng, min_board, max_board, min_candidates):
    bag = Counter(seed)
    candidates = [w for w in pool if 3 <= len(w) <= len(seed) and can_make(w, bag)]
    candidates = sorted(set(candidates), key=lambda w: (-len(w), w))
    if len(candidates) < min_candidates:
        return None
    grid = {}
    board = []
    x0 = max(0, (GRID_W - len(seed)) // 2)
    y0 = GRID_H // 2
    place(grid, seed, x0, y0, 1, 0)
    board.append({"word": seed, "x": x0, "y": y0, "dir": "H"})
    used = {seed}

    for word in candidates:
        if word in used or len(board) >= max_board:
            continue
        spots = find_spots(grid, word)
        rng.shuffle(spots)
        for x, y, dx, dy in spots[:60]:
            if fits(grid, word, x, y, dx, dy, True):
                place(grid, word, x, y, dx, dy)
                board.append({
                    "word": word,
                    "x": x,
                    "y": y,
                    "dir": "H" if dx else "V",
                })
                used.add(word)
                break

    if len(board) < min_board:
        return None
    return level_payload(board, seed)


def simple_level(seed):
    return level_payload([{"word": seed, "x": 0, "y": 0, "dir": "H"}], seed)


def write_index(packed):
    starts = []
    i = 1
    dec = json.JSONDecoder()
    while i < len(packed):
        while i < len(packed) and packed[i] in " \n\r\t,":
            i += 1
        if i >= len(packed) or packed[i] == "]":
            break
        _obj, end = dec.raw_decode(packed, i)
        starts.append(i)
        i = end
    index_path = ROOT / "wordscapes-levels-index.json"
    index_path.write_text(
        json.dumps({"starts": starts, "size": len(packed)}, separators=(",", ":")),
        encoding="utf-8",
    )
    print("wrote index", index_path, "levels", len(starts))


def main():
    pool = load_common_words()
    rng = random.Random(42)
    by_len = {n: [] for n in range(3, 9)}
    for w in pool:
        if 3 <= len(w) <= 8 and good_seed(w, len(w)):
            by_len[len(w)].append(w)
    cursors = {}
    for n, lst in by_len.items():
        lst.sort()
        rng.shuffle(lst)
        cursors[n] = 0

    levels = []
    used_seeds = set()
    index = 0
    attempts = 0
    while index < TOTAL and attempts < TOTAL * 80:
        attempts += 1
        length = wheel_length(index, rng)
        choices = by_len.get(length) or []
        if not choices:
            continue
        seed = None
        min_cand, min_board, max_board = level_limits(length)
        for _ in range(len(choices)):
            cand = choices[cursors[length] % len(choices)]
            cursors[length] += 1
            if cand in used_seeds and cursors[length] <= len(choices):
                continue
            bag = Counter(cand)
            n_cand = sum(1 for w in pool if 3 <= len(w) <= len(cand) and can_make(w, bag))
            if n_cand < min_cand and cursors[length] <= len(choices) * 2:
                continue
            seed = cand
            break
        if seed is None:
            seed = choices[index % len(choices)]
        used_seeds.add(seed)
        result = build_level(seed, pool, rng, min_board, max_board, min_cand)
        if not result:
            result = build_level(seed, pool, rng, max(1, min_board - 2), max_board, 1)
        if not result:
            result = simple_level(seed)
        levels.append(result)
        index += 1
        if index % 500 == 0:
            print(f"built {index}/{TOTAL} last_wheel={len(result['tiles'])}")

    packed = json.dumps(levels, separators=(",", ":"))
    OUT_FILE.write_text(packed, encoding="utf-8")
    write_index(packed)
    print("wrote", len(levels), "levels to", OUT_FILE)

    def wheel_n(i):
        return len(levels[i]["tiles"])

    print("first10", [wheel_n(i) for i in range(10)])
    print("next20", [wheel_n(i) for i in range(10, 30)])
    print("lv30", wheel_n(30), "lv499", wheel_n(499), "lv500", wheel_n(500))
    print("lv1999", wheel_n(1999), "sample2k", [wheel_n(i) for i in range(2000, 2012)])


if __name__ == "__main__":
    main()
