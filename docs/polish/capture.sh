#!/bin/bash
# Usage: capture.sh <base-url> <out-dir> [session-name]
# Takes the same set of screenshots of Bara every time, so before/after sets line up.
set -u
BASE="${1%/}"; OUT="$2"; S="${3:-bara-capture}"
mkdir -p "$OUT"
ab() { agent-browser --session "$S" "$@"; }
shoot_kisah() { # $1 = prefix
  ab open "$BASE/kisah/" >/dev/null; ab wait 2500 >/dev/null
  for f in 0 0.25 0.5 0.75 1; do
    ab eval "window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * $f)" >/dev/null
    ab wait 1800 >/dev/null
    ab screenshot "$OUT/$1-kisah-$f.png" >/dev/null
  done
}
for vp in "desktop 1440 900" "mobile 390 844"; do
  set -- $vp; name=$1
  ab set viewport $2 $3 >/dev/null
  ab set media light >/dev/null
  ab open "$BASE/" >/dev/null; ab wait 4000 >/dev/null
  ab screenshot "$OUT/$name-pantau.png" >/dev/null
  ab screenshot --full "$OUT/$name-pantau-full.png" >/dev/null
  ab open "$BASE/metode/" >/dev/null; ab wait 1500 >/dev/null
  ab screenshot --full "$OUT/$name-metode-full.png" >/dev/null
  shoot_kisah "$name"
  ab set media dark >/dev/null
  ab open "$BASE/" >/dev/null; ab wait 4000 >/dev/null
  ab screenshot "$OUT/$name-pantau-dark.png" >/dev/null
  ab open "$BASE/metode/" >/dev/null; ab wait 1500 >/dev/null
  ab screenshot "$OUT/$name-metode-dark.png" >/dev/null
done
ab close >/dev/null 2>&1
ls "$OUT"
