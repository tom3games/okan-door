#!/bin/zsh
# 切り絵の元画像を生成する。生画像はリポジトリの外（_art_raw/okan-door）に置く
cd ~/Desktop/claudecode/okan-door/art
G=~/.claude/skills/3d-homepage/scripts/codex_imagegen.py
R=~/Desktop/claudecode/_art_raw/okan-door
MOM=~/Desktop/claudecode/kobito-vs-okan/art/raw/mom_a.png
DAD=~/Desktop/claudecode/kobito-vs-okan/img/dad_walk.webp
step=$1
if [[ $step == 1 ]]; then
  for k in hero_a mom_door_a mom_door_b mom_door_c items; do
    python3 $G $R/$k.png prompts/$k.md $MOM --quality high --size 1536x1024 > logs/$k.log 2>&1 && echo "$k ok" || echo "$k FAIL" &
  done
  wait
else
  python3 $G $R/fam_a.png prompts/fam_a.md $MOM $R/dad_ref.png --quality high --size 1536x1024 > logs/fam_a.log 2>&1 && echo "fam_a ok" || echo "fam_a FAIL" &
  for k in hero_b hero_c; do
    python3 $G $R/$k.png prompts/$k.md $R/hero_a.png --quality high --size 1536x1024 > logs/$k.log 2>&1 && echo "$k ok" || echo "$k FAIL" &
  done
  wait
fi
