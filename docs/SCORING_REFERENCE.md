# Scoring Engine Reference

## Three Scores Per Sport (0–100)

### Built-for Score (Physiological Fit)

60% × physical_fit + 40% × demand_fit

- **physical_fit** = average of four sub-fits (height, weight, body fat %, wingspan ratio)
- Each sub-fit penalises distance from the sport's mean, scaled by the sport's SD
- Tighter SD = stricter constraint

### Demand Fit (Asymmetric Penalty)

- Being **under** the sport's demand = full penalty
- Being **over** = half penalty (you're overqualified, not disqualified)

### Enjoyment Score (Preference Fit)

**Hard filters (return 0):**
- Sex mismatch
- Water non-comfort + water-based sport

**Soft weights:**
- Team/solo match: 20%
- Contact tolerance: 20%
- Outdoor importance: 10%
- Budget vs equipment cost: 15%
- Ireland accessibility: 25%
- Sex baseline: 10%

Then multiplied by:
- `categoryBoost` (1.0 or 1.15) — if sport category matches user's enjoyed sports
- `experienceFit` (1.0 or 0.7) — if user never competed AND sport requires childhood entry

### Total Score

total = (enjoyment === 0) ? 0 : 0.5 × built_for + 0.5 × enjoyment

50/50 split is tunable.

## Archetype Profiles

```javascript
const ARCHETYPE\_PROFILES = {
  endurance:  { aerobic: 9, anaerobic: 7, maxStrength: 4, power: 5, speed: 6, flexibility: 5, coordination: 6, reaction: 5 },
  strength:   { aerobic: 4, anaerobic: 6, maxStrength: 9, power: 8, speed: 4, flexibility: 4, coordination: 5, reaction: 5 },
  explosive:  { aerobic: 5, anaerobic: 9, maxStrength: 7, power: 9, speed: 9, flexibility: 6, coordination: 7, reaction: 8 },
  skill:      { aerobic: 6, anaerobic: 6, maxStrength: 5, power: 6, speed: 6, flexibility: 7, coordination: 9, reaction: 9 },
  balanced:   { aerobic: 6, anaerobic: 6, maxStrength: 6, power: 6, speed: 6, flexibility: 6, coordination: 6, reaction: 6 },
  untrained:  { aerobic: 4, anaerobic: 4, maxStrength: 4, power: 4, speed: 4, flexibility: 4, coordination: 5, reaction: 5 },
};
