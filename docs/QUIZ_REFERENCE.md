# Quiz Flow Reference

## 11 Questions

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

## Gestures
- **Swipe up** → next question
- **Swipe down** → previous question
- **Tap any option** → also confirms

A pulsing chevron hint shows on the first card on first visit (localStorage-persisted, never shown again).
