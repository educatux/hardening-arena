#!/usr/bin/env python3
"""Hachés CSP de quiz-app/index.html : sha256 (base64) du <script> inline et de l'attribut
style="...". Permet une CSP stricte sur /arena/ sans 'unsafe-inline'.

  hash-arena.py <index.html>   → deux lignes : ARENA_SCRIPT_HASH=<b64>  ARENA_STYLE_HASH=<b64>
"""
import base64
import hashlib
import re
import sys


def h(texte):
    return base64.b64encode(hashlib.sha256(texte.encode("utf-8")).digest()).decode()


html = open(sys.argv[1], encoding="utf-8").read()
scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
styles = re.findall(r'\sstyle="([^"]*)"', html)
if len(scripts) > 1 or len(styles) > 1:
    sys.exit(f"index.html : {len(scripts)} script(s) inline, {len(styles)} attribut(s) style — "
             "la CSP n'en autorise qu'un de chaque : adapter Caddyfile et ce script")
print(f"ARENA_SCRIPT_HASH={h(scripts[0]) if scripts else ''}")
print(f"ARENA_STYLE_HASH={h(styles[0]) if styles else ''}")
