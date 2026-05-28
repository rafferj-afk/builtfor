# BUILTFOR

> Sport-matching app that compares a user's body measurements and preferences against elite athlete profiles in 100+ sports.

Status: working prototype at v0.4.2. Single-file HTML app + Excel reference database. Built on top of peer-reviewed anthropometric data from 100+ cited sources.

---

## 1. PRODUCT OVERVIEW

### What it does
The user runs through 11 questions (~2 min) and gets back a ranked deck of sport matches in three views:
- **Best Overall** — the actual recommendation (50% body fit + 50% preference fit)
- **Built For** — sports their body suits, regardless of preferences
- **You'd Enjoy** — sports matching their stated preferences, regardless of body

Each result is a FIFA Ultimate Team-style card with a tier badge (Bronze / Silver / Gold / Diamond based on score), the sport's top demand stats, and on tap, a detailed comparison against elite-athlete profiles — including a hand-written "elite comparison" line per sport.

### Why it's different
- **Grounded in peer-reviewed science**, not vibes. Every numeric value traces back to a source.
- **Two-bucket output** (built-for vs enjoyment) instead of one mushy "compatibility" score.
- **Surfaces obscure sports** the user has never considered — pickleball, Finn-class sailing, alpine speed skiing, arm wrestling, javelin — which is the screenshot-worthy result.
- **Sex-specific data**, properly filtered. Male users get male elite-athlete profiles; female users get female. No "average human" fallback that produces worse results for everyone.

### Target audience
Initially Irish market (GAA, hurling, camogie, rugby, soccer, rowing all well-represented). Designed for both B2C (find the sport you'll stick with) and B2B (PE teachers, GAA clubs, sport development officers, Local Sports Partnerships).

---

## 2. ARCHITECTURE

### File layout
```
/project-root
  builtfor.html                          ← the entire app, single self-contained file
  sport_profile_database_v1_5.xlsx       ← source-of-truth sport data + sources
  BUILTFOR.md                            ← this file
  /build                                 ← (optional) Python scripts that built each version
```

The app is **one HTML file** containing:
- All CSS (dark theme, Anton/Archivo/JetBrains Mono fonts)
- All JS (scoring engine, question flow, gesture system, persistence)
- Embedded `SPORTS_DATA` (101 sport rows, ~90 KB)
- Embedded `ELITE_COMPARISONS` (101 hand-written one-liners)
- Embedded `ARCHETYPE_PROFILES` (6 fitness archetypes → demand vectors)
- Embedded `SPORT_CATEGORY_BUCKET` (sport category → enjoyment-boost bucket)

No backend, no build step, no dependencies. Works offline after first load. Persistence via `localStorage`.

### Why a single file
- Ships as one artifact, no hosting required for the prototype
- No CORS, no fetch failures, no deployment
- Easy to email, AirDrop, or paste into a Notion page
- When this becomes a real app, the structure ports cleanly to React Native (the scoring engine is already pure JS)

### Build process
The app was iteratively built using Python scripts (in `/build`) that patched the HTML between versions. Each version's scripts apply specific edits, copy files, and verify with Playwright headless browser tests. Going forward in Claude Code, this is unnecessary — you'd just edit `builtfor.html` directly.

---

## 3. THE SPORT DATABASE

### Source of truth
`sport_profile_database_v1_5.xlsx` — Excel workbook with 7 sheets:
- **README** — version history + conventions
- **User Input** — quiz input cells (legacy, see note below)
- **Built For / You'd Enjoy / Best Overall** — three ranked-results views (legacy)
- **Scoring** — formula-driven score per sport (legacy)
- **Profiles** — 101 sport-position rows with full anthropometric data ← **THIS IS THE LIVE DATA**
- **Sources** — bibliography (102 sources, cited with S01-S103 IDs)
- **Schema notes** — what every column means
- **Scoring weights** — documentation of the scoring model

> **Important:** The User Input / Scoring / Best Overall sheets are now OUT OF DATE relative to the live app. The app's question flow changed in v0.4 (19 → 11 questions, replaced 8 self-rated abilities with 1 archetype). The Profiles and Sources sheets are still correct and authoritative.

### Profiles sheet — column layout
| Col | Field | Notes |
|-----|-------|-------|
| A | Sport ID | e.g. SP01, SP01b (positional variant), SP01F (female), SP01Fb (female positional) |
| B | Sport | Common name |
| C | Position / Discipline | If a sport has dramatically different physical profiles by position, split into multiple rows |
| D | Category | Team field, Individual racquet, Combat striking, etc. |
| E–L | Height, Weight, BMI, BF%, wingspan/height ratio, sitting-height ratio (mean and SD where available) |
| M–U | Demand profile (1–10 scores): aerobic, anaerobic, max strength, power, speed, endurance, flexibility, coordination, reaction |
| V–AB | Categorical: team size, contact level, environment, water-based, equipment cost, entry age, injury risk |
| AC–AD | Ireland accessibility (1–10), local clubs prevalent |
| AE | Primary Source IDs (comma-separated, e.g. "S01, S02") |
| AF | Notes (caveats, position differences, sample-specific context) |
| AG | Sex (M / F) — added in v1.2, used by the scoring engine as a hard filter |

### To add a new sport
1. Find one or two solid studies. Google Scholar query: `"anthropometric profile" elite [sport name]` works well.
2. Add the study to the Sources sheet with the next available Source ID.
3. Add a row to Profiles with the structure above. Use existing rows as templates.
4. Set the Sex column correctly (M or F — see note below).
5. Re-export to JSON and inline into the app HTML (see "Export pipeline" below).
6. Add a hand-written entry to `ELITE_COMPARISONS` in the app (see "Elite comparisons" below).

### Sex tagging — important
Female-only sports (Camogie, Ladies Gaelic football, AFLW, Netball, Female-only positional rows) MUST be tagged F in column AG. We had a bug in v0.4 where Netball was wrongly tagged M because the rule was based on ID suffix. Always check this column when adding new rows.

### Elite comparisons
Each sport has a hand-written line in `ELITE_COMPARISONS` that appears in the detail view. Three rules:
1. Specific to what makes the sport's body type distinctive
2. Where the famous-name reference is unambiguous, use it (Bolt for sprinting, Phelps for swimming, Lewis for boxing)
3. One sentence, two at most. Screenshot-worthy.

Example:
> `"SP47": "Elite male high jumpers are 192 cm / 76 kg — the highest height-to-weight ratio in athletics. Long, light, springy. The body type Dick Fosbury made famous."`

### Export pipeline (spreadsheet → app)
The app's `SPORTS_DATA` is a JSON export of the Profiles sheet. To regenerate:

```python
from openpyxl import load_workbook
import json

wb = load_workbook("sport_profile_database_v1_5.xlsx", data_only=True)
prof = wb["Profiles"]
sports = []
for r in range(3, prof.max_row + 1):
    sport_id = prof.cell(row=r, column=1).value
    if not sport_id: continue
    sports.append({
        "id": sport_id,
        "sport": prof.cell(row=r, column=2).value,
        "position": prof.cell(row=r, column=3).value,
        "category": prof.cell(row=r, column=4).value,
        "physical": {
            "heightMean": prof.cell(row=r, column=5).value,
            "heightSD": prof.cell(row=r, column=6).value,
            "weightMean": prof.cell(row=r, column=7).value,
            "weightSD": prof.cell(row=r, column=8).value,
            "bmiMean": prof.cell(row=r, column=9).value,
            "bfMean": prof.cell(row=r, column=10).value,
            "wingspanRatio": prof.cell(row=r, column=11).value,
            "sittingHeightRatio": prof.cell(row=r, column=12).value,
        },
        "demands": {
            "aerobic": prof.cell(row=r, column=13).value,
            "anaerobic": prof.cell(row=r, column=14).value,
            "maxStrength": prof.cell(row=r, column=15).value,
            "power": prof.cell(row=r, column=16).value,
            "speed": prof.cell(row=r, column=17).value,
            "endurance": prof.cell(row=r, column=18).value,
            "flexibility": prof.cell(row=r, column=19).value,
            "coordination": prof.cell(row=r, column=20).value,
            "reaction": prof.cell(row=r, column=21).value,
        },
        "categorical": {
            "teamSize": prof.cell(row=r, column=22).value,
            "contact": prof.cell(row=r, column=23).value,
            "environment": prof.cell(row=r, column=24).value,
            "waterBased": prof.cell(row=r, column=25).value,
            "equipmentCost": prof.cell(row=r, column=26).value,
            "entryAge": prof.cell(row=r, column=27).value,
            "injuryRisk": prof.cell(row=r, column=28).value,
        },
        "ireland": {
            "accessibility": prof.cell(row=r, column=29).value,
            "clubsPrevalent": prof.cell(row=r, column=30).value,
        },
        "sources": prof.cell(row=r, column=31).value,
        "notes": prof.cell(row=r, column=32).value,
        "sex": prof.cell(row=r, column=33).value,
    })

# Replace the SPORTS_DATA constant in builtfor.html
import re
with open("builtfor.html") as f: html = f.read()
new_data = "const SPORTS_DATA = " + json.dumps(sports) + ";"
html = re.sub(r"const SPORTS_DATA = \[.*?\];", lambda m: new_data, html, count=1, flags=re.DOTALL)
# CAUTION: use plain string.replace(old, new) instead of re.sub if the JSON contains \u escapes — re.sub treats them as regex escapes
with open("builtfor.html", "w") as f: f.write(html)
```

---

## 4. THE SCORING ENGINE

Three scores per sport, all 0–100:

### Built-for score (physiological fit)

```
60% × physical_fit + 40% × demand_fit
```

where:
- `physical_fit` = average of four sub-fits (height, weight, body fat %, wingspan ratio)
- Each sub-fit penalises distance from the sport's mean, with the penalty scaled by the sport's published SD. Tighter SD = stricter constraint (gymnastics height penalises mismatches harder than cycling weight).
- `demand_fit` = compared to user's archetype-derived demand profile. Asymmetric penalty: being **under** the sport's demand costs full points, being **over** costs half (you can still play the sport, you're just over-built for it). This asymmetric model was added after testing revealed distance running was over-ranking on profiles that didn't fit it.

### Enjoyment score (preference fit)

Hard filters (return 0):
- Sex mismatch (M user + F sport, or vice versa) — strict filter, added v1.3
- Water non-comfort + water-based sport

Soft weights:
- Team/solo match: 20%
- Contact tolerance: 20%
- Outdoor importance: 10%
- Budget vs equipment cost: 15%
- Ireland accessibility (if user is Ireland-based): 25%
- Sex baseline (always 1 once we pass the filter): 10%

Then multiplied by:
- `categoryBoost` (1.0 or 1.15) — if the sport's category matches one of the user's "sports enjoyed" buckets
- `experienceFit` (1.0 or 0.7) — if user has never competed AND sport requires childhood entry (max entry age ≤14)

### Total score

```
total = (enjoyment === 0) ? 0 : 0.5 × built_for + 0.5 × enjoyment
```

The 50/50 split is tunable. For a "find a sport you'll stick with" market it could shift to 30/70 (enjoyment-led). For talent ID it could go 70/30 (body-led).

### Why the asymmetric demand penalty matters
The original v1.0 formula only penalised being below sport demand, treating "overqualified" as neutral. This caused distance running to over-rank for everyone (its demand profile is low on most dimensions except aerobic/endurance, so anyone who self-rated even moderate strength/power/speed wasn't penalised at all). Fixed in v0.2 by adding the 0.5× over-qualification penalty.

### Archetype → demand mapping (current values)
```javascript
const ARCHETYPE_PROFILES = {
  endurance:  { aerobic: 9, anaerobic: 7, maxStrength: 4, power: 5, speed: 6, flexibility: 5, coordination: 6, reaction: 5 },
  strength:   { aerobic: 4, anaerobic: 6, maxStrength: 9, power: 8, speed: 4, flexibility: 4, coordination: 5, reaction: 5 },
  explosive:  { aerobic: 5, anaerobic: 9, maxStrength: 7, power: 9, speed: 9, flexibility: 6, coordination: 7, reaction: 8 },
  skill:      { aerobic: 6, anaerobic: 6, maxStrength: 5, power: 6, speed: 6, flexibility: 7, coordination: 9, reaction: 9 },
  balanced:   { aerobic: 6, anaerobic: 6, maxStrength: 6, power: 6, speed: 6, flexibility: 6, coordination: 6, reaction: 6 },
  untrained:  { aerobic: 4, anaerobic: 4, maxStrength: 4, power: 4, speed: 4, flexibility: 4, coordination: 5, reaction: 5 },
};
```

These were calibrated by hand. May need tuning based on real user data.

---

## 5. THE QUIZ FLOW

11 questions, vertical-scroll (TikTok/Reels) gesture pattern:

| # | ID | Type | Captures |
|---|----|----- |----------|
| 1 | sex | choice | "Sex assigned at birth" with explanatory line — M/F only, hard filter |
| 2 | body | multi-slider | Height + weight + wingspan on one card (3 stacked sliders) |
| 3 | bodyFat | slider | Body fat % |
| 4 | archetype | archetype | One of 6 fitness archetypes — replaces 8 separate self-rated cards |
| 5 | sportsEnjoyed | multi-select | 8 sport categories; boosts enjoyment by 15% on matching sports |
| 6 | experience | choice | Never / under 2y / 2-5y / over 5y; gates sports requiring childhood entry |
| 7 | teamSolo | choice | Team / Solo / Either |
| 8 | outdoor | choice | Essential / Nice / Neutral / Indoor — graded outdoor preference |
| 9 | contact | choice | None / Light / Medium / Heavy contact tolerance |
| 10 | water | choice | Yes / No — hard filter for water sports |
| 11 | logistics | compound-choice | Budget + Ireland-based on one card |

### Gestures
- **Swipe up** → next question
- **Swipe down** → previous question
- **Tap any option** → also confirms

A pulsing chevron hint shows on the first card on first visit (localStorage-persisted, never shown again).

### Why these specific questions
Three diagnostic additions in v0.4 (sportsEnjoyed, experience, outdoor importance) genuinely move recommendations beyond what physical measurements alone can capture. The archetype consolidation traded resolution (8 separate 1-10 ratings) for completion rate — testing showed 19 questions was too many for the attention-economy reality.

### What was rejected
- Sitting-height ratio and hand size: too hard for users to self-assess accurately
- Hard "tried and disliked" filter: implicit in sportsEnjoyed
- Age: not currently used (could be added back if relevant for entry-age realism)

---

## 6. DESIGN SYSTEM

### Aesthetic direction
FIFA Ultimate Team meets Nike Run Club. Dark, electric, athletic, slightly aggressive. NOT corporate-fitness-app blue. NOT pastel wellness.

### Colours (CSS variables)
```css
--bg: #0a0a0a;            /* near-black background */
--bg-elev: #141414;       /* card backgrounds */
--surface: #1c1c1c;       /* deeper surfaces */
--text: #f5f5f5;
--text-dim: #8a8a8a;
--text-dimmer: #555;
--accent: #c8ff3d;         /* electric lime — the signature colour */
--accent-hot: #ffd83d;     /* gold — elite tier, "you" markers */
--accent-fire: #ff5e3d;    /* signal red — warnings, "back" hint */
--border: #262626;
--border-bright: #404040;
```

### Tier colours (athlete card rarities)
- Bronze (score < 60): `linear-gradient(135deg, #6b4a2a 0%, #a07242 40%, #c8915a 70%, #6b4a2a 100%)`
- Silver (60–74)
- Gold (75–84)
- Diamond (85+): includes the accent lime in the gradient

### Typography
- **Anton** (display, condensed) — sports-broadcast feel, all caps, big headers, scores
- **Archivo** — body text, button labels
- **JetBrains Mono** — eyebrows, meta data, numeric values, anything that wants to feel utilitarian

### Layout
Mobile-first, max-width 480px, centred on desktop with dark surround. Safe-area-inset padding for iOS.

### Subtle touches
- SVG fractal noise overlay at 2.5% opacity over the entire app (prevents the "generic dark theme" look)
- Radial gradients in the bg corners (lime top, fire bottom)
- Card reveal animation: staggered fade-in with slight upward translate
- Athlete cards have a holographic shine overlay on top of the tier gradient

---

## 7. KNOWN ISSUES & TECHNICAL DEBT

### Spreadsheet is out of date relative to the app
The spreadsheet's User Input / Scoring / Best Overall sheets still implement the v1.0 quiz model (19 questions, 8 self-rated abilities). They produce valid scores against the Profiles data but the inputs don't match what the app collects. The Profiles and Sources sheets are still authoritative.

**Fix path:** rewrite the spreadsheet's User Input sheet with the 11-question structure and update the Scoring formulas. Probably 2-3 hours of work. Not blocking anything if you only edit sport data going forward and let the app be the canonical scoring engine.

### Dead code in the HTML
`selectScale()` JS function and references to `.scale-*` CSS classes are still in the file. Unused since v0.4 (no question type currently uses scale-chip selectors). Harmless, slightly bloated. About 30 lines of dead code total.

### Sport data thinness flagged in `notes` column
- Arm wrestling — peer-reviewed elite anthropometric data is genuinely thin in the literature. The current profile is synthesised from biomechanics and combat-sport adjacencies. Flagged as lower-confidence.
- Pickleball — emerging sport, anthropometric studies of elite players are limited.
- Ladies Gaelic football — published data is thinner than for the men's code or camogie.
- Female team sports in winter codes — still some gaps.

### Things flagged for cleanup but not blocking
- The "comparable elite" lines are static (don't reference the user's own measurements). Considered "dynamic" personalised lines but they risk awkward fits. Static is safer.
- Tier thresholds (Bronze < 60, Silver 60–74, etc.) are uncalibrated. May need tuning once we see real-world score distributions.

---

## 8. LESSONS LEARNED (DO NOT REPEAT)

### Always run the app in a real browser before claiming it works
We had a SyntaxError in v0.4 (orphan `catch` block from a botched regex edit) that killed the entire `<script>` tag. Static checks (tag balance, function presence, regex matching) all passed. The actual error only surfaced when Playwright loaded the file. Going forward: any change that touches JS should be tested with:

```bash
node --check <extracted-script>.js   # or
node playwright-test.js              # full headless click-through
```

### Regex edits on HTML files are dangerous
We had multiple instances where a regex pattern under-matched and left orphan code behind. Specifically:
- Removing the gestures tutorial overlay left half the inner HTML behind
- Removing the v0.3 `startQuiz` body left a stray `catch (e) {}` and closing brace

Both produced silent failures. Going forward: prefer explicit `string.replace(old, new)` with full anchoring context over regex `.*?` patterns where possible. If regex is needed, verify the matched span before applying.

### Don't use `re.sub` with JSON replacement strings
JSON contains `\u` Unicode escapes. `re.sub` treats backslashes in the replacement as regex escape sequences and crashes with `bad escape \u`. Use `string.replace(old_block, new_block)` instead — it does not process escapes.

### Display: block matters for span-based progress bars
We had bars that "wouldn't show colour" because the `<span>` elements used for track and fill were inline by default and ignored width/height. Adding `display: block` fixed it. Lesson: always set `display: block` on spans that should render as boxes.

### Test on a phone, not just in dev tools
The "overlapping CONFIRM button" bug was visible on iPhone but not in desktop Chrome's mobile emulation. Real device testing surfaces real issues.

---

## 9. ROADMAP & WHAT'S NEXT

### Immediate (next session)
- Probably nothing urgent. v0.4.2 works end-to-end. Run real user testing on a few diverse body profiles and see what surprises emerge.

### Short-term polish
- Shareable card images. Render the athlete card to PNG with html2canvas or similar; add a "Share my card" button on the detail view. This is the single highest-leverage virality feature.
- Per-sport "where to start in Ireland" snippet (club locator, beginner-friendly venues). Would lift the app from "novelty" to "useful."
- Tier threshold calibration once we have real user data.

### Medium-term product
- More sports. Specifically: more obscure ones that surface as #1 matches for unusual body types. The pattern that's working: pickleball (broad tolerance), arm wrestling (counter-intuitive build), curling (precision-not-mass), Finn-class sailing (heavy-dinghy weight). More like these.
- Female data backfill: female-specific data is still thinner than male across several sports. The literature exists, just hasn't been pulled in.
- Sitting-height ratio and hand size as optional power-user inputs, not required questions. Could unlock more distinctive matching for users who want to engage deeply.

### Monetisation paths (in order of how soon they could ship)
1. **Equipment affiliate links** — match someone to climbing → starter kit recommendations at €100/€300/€1000 with affiliate links. Lowest content cost, real revenue.
2. **Deeper analysis tier (€4.99 one-time)** — extended report, more named athlete comparisons, weakness-targeted training priorities.
3. **Tailored programme (€14.99–€29.99)** — 6–12 week "getting into [sport]" plan. Higher value but expensive to produce; would need partnerships with sport-specific coaches.
4. **B2B licensing** — white-labelled version for LSPs, schools, GAA clubs, gym chains. Sport Ireland's participation/retention agenda is the natural buyer. Longer sales cycle, defensible recurring revenue. **This is the real long-term game.**

### Brand
- Name: **BUILTFOR** (decided). Stylised in all caps in display contexts, "Built For" in body copy.
- Domain status: `.com`, `.app` taken. `getbuiltfor.com` taken (and rejected). `.ie` likely available — verify with registrar. Distinctive-name alternatives discussed if needed but the user wants to stay with BUILTFOR for now.
- Tagline: current welcome screen uses "BUILT / FOR / SOMETHING." as both wordmark and tagline in one stack. Working well.

---

## 10. SCORING ENGINE — JAVASCRIPT REFERENCE

The full scoring logic, ported verbatim. This is the contract for any future port (React Native, server-side, etc.):

```javascript
function computeBuiltFor(user, sport) {
  if (user.sex !== sport.sex) return 0;

  const p = sport.physical;

  // Height fit
  let heightFit = 0.5;
  if (p.heightMean != null) {
    if (p.heightSD) {
      const overshoot = Math.max(0, Math.abs(user.height - p.heightMean) - p.heightSD);
      heightFit = Math.max(0, 1 - overshoot / p.heightSD / 3);
    } else {
      heightFit = Math.max(0, 1 - Math.abs(user.height - p.heightMean) / (p.heightMean * 0.1) / 3);
    }
  }

  // Weight fit
  let weightFit = 0.5;
  if (p.weightMean != null) {
    if (p.weightSD) {
      const overshoot = Math.max(0, Math.abs(user.weight - p.weightMean) - p.weightSD);
      weightFit = Math.max(0, 1 - overshoot / p.weightSD / 3);
    } else {
      weightFit = Math.max(0, 1 - Math.abs(user.weight - p.weightMean) / (p.weightMean * 0.15) / 3);
    }
  }

  // Body fat fit — tolerance ±5 percentage points
  let bfFit = 0.5;
  if (p.bfMean != null) {
    bfFit = Math.max(0, 1 - Math.abs(user.bodyFat - p.bfMean) / 5 / 3);
  }

  // Wingspan/height ratio fit (only when sport has data)
  let wingspanFit = (heightFit + weightFit + bfFit) / 3;
  if (p.wingspanRatio) {
    const userRatio = user.wingspan / user.height;
    wingspanFit = Math.max(0, 1 - Math.abs(userRatio - p.wingspanRatio) / 0.03 / 3);
  }

  // Demand profile fit — ASYMMETRIC: under-qual full penalty, over-qual half
  const archetype = ARCHETYPE_PROFILES[user.archetype] || ARCHETYPE_PROFILES.balanced;
  const d = sport.demands;
  const pairs = [
    [d.aerobic, archetype.aerobic],
    [d.anaerobic, archetype.anaerobic],
    [d.maxStrength, archetype.maxStrength],
    [d.power, archetype.power],
    [d.speed, archetype.speed],
    [d.flexibility, archetype.flexibility],
    [d.coordination, archetype.coordination],
    [d.reaction, archetype.reaction],
  ];
  const gap = pairs.reduce((sum, [dem, usr]) => {
    const dm = dem || 0; const us = usr || 0;
    return sum + (us < dm ? (dm - us) : 0.5 * (us - dm));
  }, 0);
  const demandFit = 100 * Math.max(0, 1 - gap / 40);

  const phys = (heightFit + weightFit + bfFit + wingspanFit) / 4;
  return Math.round((60 * phys + 0.4 * demandFit) * 10) / 10;
}

function computeEnjoyment(user, sport) {
  // Hard filters
  if (user.sex !== sport.sex) return 0;
  if (user.water === 'No' && sport.categorical.waterBased === 'Yes') return 0;

  const c = sport.categorical;

  // Team/solo
  const teamFit = (c.teamSize >= 4) ? 1 : 0.3;
  const soloFit = (c.teamSize <= 2 || (sport.category && sport.category.includes('Individual'))) ? 1 : 0.3;
  let teamSolo;
  if (user.teamSolo === 'Either') teamSolo = (teamFit + soloFit) / 2;
  else if (user.teamSolo === 'Team') teamSolo = teamFit;
  else teamSolo = soloFit;

  // Contact tolerance — overshoot costs 0.4 per level
  const contactMap = { 'None': 0, 'Light': 1, 'Medium': 2, 'Heavy': 3 };
  const sportContact = contactMap[c.contact] ?? 0;
  const userContact = contactMap[user.contact] ?? 3;
  let contactMatch = 1;
  if (sportContact > userContact) {
    contactMatch = Math.max(0, 1 - 0.4 * (sportContact - userContact));
  }

  // Environment — driven by outdoor importance preference
  let envMatch = 1;
  const sportEnv = (c.environment || '').toLowerCase();
  const isOutdoor = sportEnv.includes('outdoor');
  const isIndoor = sportEnv.includes('indoor');
  const hasBoth = isOutdoor && isIndoor;
  if (user.outdoor === 'essential')     envMatch = isOutdoor ? 1 : (hasBoth ? 0.7 : 0.3);
  else if (user.outdoor === 'nice')     envMatch = isOutdoor ? 1 : (hasBoth ? 0.85 : 0.65);
  else if (user.outdoor === 'indoor')   envMatch = isIndoor ? 1 : (hasBoth ? 0.7 : 0.4);
  // 'neutral' → 1

  // Budget vs equipment cost
  const budgetMap = { 'Low': 1, 'Medium': 2, 'High': 3 };
  const sportBudget = budgetMap[c.equipmentCost] ?? 2;
  const userBudget = budgetMap[user.budget] ?? 2;
  let budgetMatch = 1;
  if (sportBudget > userBudget) {
    budgetMatch = Math.max(0, 1 - 0.4 * (sportBudget - userBudget));
  }

  // Ireland fit
  let irelandFit = 1;
  if (user.ireland === 'Yes') {
    irelandFit = (typeof sport.ireland.accessibility === 'number') ? sport.ireland.accessibility / 10 : 0.5;
  }

  // Base score
  const baseScore = 100 * (
    0.10 +                       // sex match (1 if we got here)
    teamSolo * 0.20 +
    contactMatch * 0.20 +
    envMatch * 0.10 +
    budgetMatch * 0.15 +
    irelandFit * 0.25
  );

  // Category-enjoyed boost (max 15%)
  let categoryBoost = 1.0;
  if (Array.isArray(user.sportsEnjoyed) && user.sportsEnjoyed.length > 0) {
    const bucket = SPORT_CATEGORY_BUCKET[sport.category];
    if (bucket && user.sportsEnjoyed.includes(bucket)) categoryBoost = 1.15;
  }

  // Experience penalty if never-competed user encounters early-entry sport
  let experienceFit = 1.0;
  if (user.experience === 'none') {
    const entryAge = (sport.categorical.entryAge || '').toString();
    const match = entryAge.match(/(\d+)\s*[\-\u2013]\s*(\d+)/);
    if (match) {
      const maxEntry = parseInt(match[2], 10);
      if (maxEntry && maxEntry <= 14) experienceFit = 0.7;
    }
  }

  const finalScore = baseScore * categoryBoost * experienceFit;
  return Math.round(Math.min(100, finalScore) * 10) / 10;
}
```

---

## 11. CONVENTIONS

- Comments in the codebase are direct and acknowledge what they're doing AND why. Avoid filler.
- Variable names: `built_for` / `builtFor` interchangeable depending on context. Camel-case in JS, snake-case in Python.
- Don't add formatting that the user didn't ask for. Plain prose, minimal headers and bullets in conversations.
- When something breaks, run the headless test before declaring it fixed.
- Trust the science over intuition. If a peer-reviewed source says elite shot putters are 122 kg, that's the value — even if it seems extreme.
- The science is sex-binary at elite level. The product respects that without making it a culture-war fight (the "sex assigned at birth" framing with explanatory line).

---

## 12. WHO BUILT THIS AND WHY

The user is a sport and exercise management graduate based in Ireland. The product idea came from noticing that "find your sport" apps exist but are mostly fluff personality quizzes, while real anthropometric science exists in journals but never reaches the public. BUILTFOR bridges the two: peer-reviewed science delivered as a shareable phone-based experience.

The Irish market is the initial focus because:
- GAA (Gaelic football, hurling) sport-science literature is well-developed
- LSP / Sport Ireland are real institutional buyers for the B2B angle
- The user's domain expertise is strongest here
- Distinctive sports presence (camogie, hurling) gives the database a sport-family that doesn't exist in international competitors

The work was done across one long conversation. The final state is a working prototype shipped as a single HTML file. Ready for real-world testing, iteration on data, and eventual rebuild as a native app once the core scoring model has been validated on real users.
