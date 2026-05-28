# Known Issues & Technical Debt

## Spreadsheet Out of Date
The spreadsheet's User Input / Scoring / Best Overall sheets still implement v1.0 quiz (19 questions, 8 abilities). Profiles and Sources sheets are authoritative. Fix path: rewrite User Input sheet with 11-question structure. Not blocking if you only edit sport data and let the app be the canonical scoring engine.

## Dead Code
`selectScale()` JS function and `.scale-*` CSS classes unused since v0.4 (no question type uses scale-chip selectors). ~30 lines total. Harmless, slightly bloated.

## Sport Data Confidence Issues
- **Arm wrestling** — thin peer-reviewed data; synthesised from biomechanics and combat-sport adjacencies. Lower confidence.
- **Pickleball** — emerging sport; limited elite anthropometric studies.
- **Ladies Gaelic football** — thinner data than men's code or camogie.
- **Female winter team sports** — some gaps remain.

## Things Flagged for Cleanup (Not Blocking)
- Elite comparison lines are static (don't personalise to user measurements). Static is safer than dynamic.
- Tier thresholds (Bronze < 60, Silver 60–74, etc.) are uncalibrated. May need tuning on real user data.

## Critical Lessons Learned (Don't Repeat)
- **Always test in a real browser** before declaring something fixed. Static checks miss runtime errors.
- **Avoid regex edits on HTML** — use full `string.replace()` instead. Regex patterns can leave orphan code.
- **Don't use `re.sub()` with JSON** — backslashes in JSON (`\u`) crash regex substitution. Use plain string replace.
- **Set `display: block` on spans** that should render as boxes (height/width ignored on inline).
- **Test on real phone**, not just dev tools. Mobile emulation misses real device issues.
