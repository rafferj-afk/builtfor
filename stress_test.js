#!/usr/bin/env node
// BUILTFOR stress test — 50 personas through the full scoring engine
// Run: node stress_test.js

const fs = require('fs');
const vm = require('vm');

// ── Extract all script blocks from builtfor.html ──────────────────────────────
const html = fs.readFileSync(__dirname + '/builtfor.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/g);
const scripts = scriptMatch ? scriptMatch.map(s => s.replace(/<\/?script>/g, '')) : [];

// ── Build a vm context with browser API shims ─────────────────────────────────
const sandbox = {
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
  window: null,
  localStorage: { setItem: () => {}, getItem: () => null, removeItem: () => {} },
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => {},
  setTimeout: () => {},
  setInterval: () => {},
  clearInterval: () => {},
  clearTimeout: () => {},
  console,
};
sandbox.window = sandbox;
vm.createContext(sandbox);

// ── Inject a scoring wrapper BEFORE running the app scripts ──────────────────
// const/let in vm scripts are lexically scoped to their script, not the sandbox.
// By appending our wrapper to the concatenated app scripts we get access to them.
const exposerScript = `
function _scoreUser(user) {
  var scored = SPORTS_DATA.map(function(sport) {
    var bf  = computeBuiltFor(user, sport);
    var enj = computeEnjoyment(user, sport);
    var total = (bf === 0 || enj === 0)
      ? 0
      : Math.round(((2 * bf * enj) / (bf + enj)) * 10) / 10;
    return { sport: sport, builtFor: bf, enjoyment: enj, total: total };
  });
  return scored;
}
function _sportCount() { return SPORTS_DATA.length; }
function _sportsMF() { return { m: SPORTS_DATA.filter(function(s){return s.sex==='M';}).length, f: SPORTS_DATA.filter(function(s){return s.sex==='F';}).length }; }
`;

// Run all app scripts concatenated + our wrapper as one vm execution so our
// wrapper can see the const-declared SPORTS_DATA etc. via lexical scope.
const fullScript = scripts.join('\n;\n') + '\n' + exposerScript;
try {
  vm.runInContext(fullScript, sandbox);
} catch (e) {
  // Suppress rendering errors that fire on load; scoring + wrapper will be loaded
}

// ── Verify we have what we need ───────────────────────────────────────────────
if (typeof sandbox._scoreUser !== 'function' || typeof sandbox._sportCount !== 'function') {
  console.error('Failed to inject scoring wrapper into vm context');
  console.error('_scoreUser:', typeof sandbox._scoreUser);
  process.exit(1);
}

const scoreAllSports = (user) => sandbox._scoreUser(user);
const sportCount     = sandbox._sportCount();
const { m: maleCount, f: femaleCount } = sandbox._sportsMF();

console.log(`\nLoaded ${sportCount} sport profiles (${maleCount} M, ${femaleCount} F)\n`);

// ── Score one user ────────────────────────────────────────────────────────────
function scoreUser(answers) {
  const scored = scoreAllSports(answers);
  return {
    overall:  [...scored].sort((a, b) => b.total    - a.total).slice(0, 5),
    builtfor: [...scored].filter(s => s.enjoyment > 0).sort((a, b) => b.builtFor  - a.builtFor).slice(0, 5),
    enjoy:    [...scored].filter(s => s.enjoyment > 0).sort((a, b) => b.enjoyment - a.enjoyment).slice(0, 5),
    excluded: scored.filter(s => s.total === 0).length,
    nonZero:  scored.filter(s => s.total > 0).length,
    maxScore: Math.max(...scored.map(s => s.total)),
    minNonZero: Math.min(...scored.filter(s => s.total > 0).map(s => s.total)),
  };
}

// ── 50 test personas ─────────────────────────────────────────────────────────
// Each has a label, a description of what we expect, and the answer set.

const personas = [
  // ── Group A: Archetypes ───────────────────────────────────────────────────
  {
    label: 'A01 — Tall lean Irish male (soccer build)',
    expect: 'Soccer, GAA, basketball in top results; water sports if no water flag',
    answers: {
      sex: 'M', age: 22, height: 181, weight: 76, bodyFat: 11, wingspanCat: 'same',
      aerobic: 8, anaerobic: 7, maxStrength: 5, power: 7, speed: 8,
      coordination: 8, flexibility: 5, reaction: 7,
      sportsEnjoyed: ['team_field'], experience: 'medium', teamSolo: 'Team',
      outdoor: 'nice', contact: 'Medium', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'A02 — Very tall heavy male (basketball build)',
    expect: 'Basketball near top; team court sports, volleyball',
    answers: {
      sex: 'M', age: 20, height: 200, weight: 100, bodyFat: 11, wingspanCat: 'longer',
      aerobic: 7, anaerobic: 8, maxStrength: 6, power: 9, speed: 8,
      coordination: 8, flexibility: 5, reaction: 8,
      sportsEnjoyed: ['team_court'], experience: 'short', teamSolo: 'Team',
      outdoor: 'neutral', contact: 'Light', water: 'Yes', budget: 'Low',
      region: 'n_am', injury: 'none',
    }
  },
  {
    label: 'A03 — Small light female endurance runner',
    expect: 'Marathon, cross-country, triathlon at top; combat/contact sports low',
    answers: {
      sex: 'F', age: 28, height: 160, weight: 48, bodyFat: 16, wingspanCat: 'same',
      aerobic: 9, anaerobic: 6, maxStrength: 3, power: 4, speed: 7,
      coordination: 6, flexibility: 7, reaction: 6,
      sportsEnjoyed: ['endurance'], experience: 'long', teamSolo: 'Solo',
      outdoor: 'essential', contact: 'None', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'A04 — Heavy powerful male (rugby / American football build)',
    expect: 'Rugby, powerlifting, combat sports top; endurance low',
    answers: {
      sex: 'M', age: 24, height: 188, weight: 115, bodyFat: 15, wingspanCat: 'same',
      aerobic: 5, anaerobic: 8, maxStrength: 9, power: 9, speed: 7,
      coordination: 6, flexibility: 4, reaction: 7,
      sportsEnjoyed: ['team_field', 'strength'], experience: 'medium', teamSolo: 'Team',
      outdoor: 'nice', contact: 'Heavy', water: 'Yes', budget: 'Medium',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'A05 — Female swimmer (tall, long wingspan)',
    expect: 'Swimming near top; water sports high',
    answers: {
      sex: 'F', age: 19, height: 174, weight: 63, bodyFat: 18, wingspanCat: 'much_longer',
      aerobic: 9, anaerobic: 7, maxStrength: 6, power: 6, speed: 7,
      coordination: 7, flexibility: 8, reaction: 7,
      sportsEnjoyed: ['water', 'endurance'], experience: 'long', teamSolo: 'Either',
      outdoor: 'neutral', contact: 'None', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },

  // ── Group B: Age spectrum ─────────────────────────────────────────────────
  {
    label: 'B01 — Young male 14, beginner, no preference',
    expect: 'Wide range of sports; trainability penalty minimal at 14',
    answers: {
      sex: 'M', age: 14, height: 165, weight: 55, bodyFat: 14, wingspanCat: 'same',
      aerobic: 5, anaerobic: 5, maxStrength: 4, power: 5, speed: 6,
      coordination: 5, flexibility: 5, reaction: 5,
      sportsEnjoyed: [], experience: 'none', teamSolo: 'Either',
      outdoor: 'nice', contact: 'Medium', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'B02 — Male 35, ex-club GAA player',
    expect: 'GAA/soccer still competitive; some trainability penalty on sprinting',
    answers: {
      sex: 'M', age: 35, height: 179, weight: 82, bodyFat: 16, wingspanCat: 'same',
      aerobic: 7, anaerobic: 6, maxStrength: 7, power: 6, speed: 6,
      coordination: 7, flexibility: 5, reaction: 6,
      sportsEnjoyed: ['team_field'], experience: 'long', teamSolo: 'Team',
      outdoor: 'nice', contact: 'Medium', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'B03 — Male 45, aerobic-dominant, endurance background',
    expect: 'Cycling, rowing, marathon preferred; gymnastics/sprint sports penalised',
    answers: {
      sex: 'M', age: 45, height: 176, weight: 72, bodyFat: 14, wingspanCat: 'same',
      aerobic: 8, anaerobic: 5, maxStrength: 5, power: 4, speed: 5,
      coordination: 6, flexibility: 6, reaction: 5,
      sportsEnjoyed: ['endurance'], experience: 'long', teamSolo: 'Solo',
      outdoor: 'essential', contact: 'None', water: 'Yes', budget: 'Medium',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'B04 — Male 58, low-impact preference, joint injury',
    expect: 'Golf, archery, bowls favoured; contact/high-injury sports heavily penalised',
    answers: {
      sex: 'M', age: 58, height: 177, weight: 85, bodyFat: 22, wingspanCat: 'same',
      aerobic: 5, anaerobic: 3, maxStrength: 4, power: 3, speed: 3,
      coordination: 5, flexibility: 4, reaction: 4,
      sportsEnjoyed: [], experience: 'short', teamSolo: 'Either',
      outdoor: 'nice', contact: 'None', water: 'No', budget: 'Medium',
      region: 'ie_uk', injury: 'joint',
    }
  },
  {
    label: 'B05 — Female 50, social, fit, low contact',
    expect: 'Cycling, tennis, golf, swimming; contact sports bottom',
    answers: {
      sex: 'F', age: 50, height: 165, weight: 62, bodyFat: 22, wingspanCat: 'same',
      aerobic: 6, anaerobic: 4, maxStrength: 5, power: 4, speed: 4,
      coordination: 6, flexibility: 7, reaction: 5,
      sportsEnjoyed: ['racquet', 'endurance'], experience: 'medium', teamSolo: 'Either',
      outdoor: 'nice', contact: 'Light', water: 'Yes', budget: 'Medium',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'B06 — Male 65, active retiree, aerobic focus',
    expect: 'Golf, bowls, cycling, endurance; fast-twitch sports heavily penalised',
    answers: {
      sex: 'M', age: 65, height: 174, weight: 78, bodyFat: 20, wingspanCat: 'same',
      aerobic: 5, anaerobic: 3, maxStrength: 4, power: 3, speed: 3,
      coordination: 5, flexibility: 4, reaction: 4,
      sportsEnjoyed: ['endurance'], experience: 'medium', teamSolo: 'Either',
      outdoor: 'essential', contact: 'None', water: 'No', budget: 'Medium',
      region: 'ie_uk', injury: 'none',
    }
  },

  // ── Group C: Budget / access edge cases ───────────────────────────────────
  {
    label: 'C01 — High-budget male, premium sports',
    expect: 'Equestrian, sailing, skiing accessible; low-cost sports also fair',
    answers: {
      sex: 'M', age: 30, height: 178, weight: 78, bodyFat: 14, wingspanCat: 'same',
      aerobic: 7, anaerobic: 6, maxStrength: 6, power: 6, speed: 6,
      coordination: 7, flexibility: 6, reaction: 6,
      sportsEnjoyed: [], experience: 'medium', teamSolo: 'Either',
      outdoor: 'essential', contact: 'Light', water: 'Yes', budget: 'High',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'C02 — Low-budget female, outdoors essential',
    expect: 'Running, GAA, cycling high; equestrian/sailing penalised',
    answers: {
      sex: 'F', age: 25, height: 167, weight: 60, bodyFat: 19, wingspanCat: 'same',
      aerobic: 7, anaerobic: 6, maxStrength: 4, power: 5, speed: 7,
      coordination: 7, flexibility: 6, reaction: 6,
      sportsEnjoyed: ['team_field', 'endurance'], experience: 'medium', teamSolo: 'Either',
      outdoor: 'essential', contact: 'Medium', water: 'No', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },

  // ── Group D: Water flags ───────────────────────────────────────────────────
  {
    label: 'D01 — Male who hates water',
    expect: 'Zero water sports in results; check excluded count increases',
    answers: {
      sex: 'M', age: 25, height: 178, weight: 78, bodyFat: 13, wingspanCat: 'much_longer',
      aerobic: 8, anaerobic: 7, maxStrength: 5, power: 6, speed: 7,
      coordination: 7, flexibility: 6, reaction: 7,
      sportsEnjoyed: [], experience: 'short', teamSolo: 'Either',
      outdoor: 'neutral', contact: 'None', water: 'No', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'D02 — Identical to D01 but water: Yes',
    expect: 'Swimming / water sports should appear; higher nonZero count vs D01',
    answers: {
      sex: 'M', age: 25, height: 178, weight: 78, bodyFat: 13, wingspanCat: 'much_longer',
      aerobic: 8, anaerobic: 7, maxStrength: 5, power: 6, speed: 7,
      coordination: 7, flexibility: 6, reaction: 7,
      sportsEnjoyed: [], experience: 'short', teamSolo: 'Either',
      outdoor: 'neutral', contact: 'None', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },

  // ── Group E: Regional differences ─────────────────────────────────────────
  {
    label: 'E01 — Irish male (GAA accessible)',
    expect: 'GAA very high; baseball low',
    answers: {
      sex: 'M', age: 23, height: 182, weight: 82, bodyFat: 12, wingspanCat: 'same',
      aerobic: 8, anaerobic: 7, maxStrength: 6, power: 7, speed: 7,
      coordination: 8, flexibility: 5, reaction: 7,
      sportsEnjoyed: ['team_field'], experience: 'long', teamSolo: 'Team',
      outdoor: 'nice', contact: 'Heavy', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'E02 — US male (same build as E01)',
    expect: 'Baseball/American football accessible; GAA low',
    answers: {
      sex: 'M', age: 23, height: 182, weight: 82, bodyFat: 12, wingspanCat: 'same',
      aerobic: 8, anaerobic: 7, maxStrength: 6, power: 7, speed: 7,
      coordination: 8, flexibility: 5, reaction: 7,
      sportsEnjoyed: ['team_field'], experience: 'long', teamSolo: 'Team',
      outdoor: 'nice', contact: 'Heavy', water: 'Yes', budget: 'Low',
      region: 'n_am', injury: 'none',
    }
  },
  {
    label: 'E03 — Australian male',
    expect: 'Rugby, AFL, cricket high; GAA low',
    answers: {
      sex: 'M', age: 23, height: 182, weight: 82, bodyFat: 12, wingspanCat: 'same',
      aerobic: 8, anaerobic: 7, maxStrength: 6, power: 7, speed: 7,
      coordination: 8, flexibility: 5, reaction: 7,
      sportsEnjoyed: ['team_field'], experience: 'long', teamSolo: 'Team',
      outdoor: 'nice', contact: 'Heavy', water: 'Yes', budget: 'Low',
      region: 'anz', injury: 'none',
    }
  },

  // ── Group F: Injury impact ─────────────────────────────────────────────────
  {
    label: 'F01 — No injury',
    expect: 'Baseline rugby/GAA player',
    answers: {
      sex: 'M', age: 26, height: 183, weight: 90, bodyFat: 13, wingspanCat: 'same',
      aerobic: 7, anaerobic: 8, maxStrength: 8, power: 8, speed: 7,
      coordination: 7, flexibility: 5, reaction: 7,
      sportsEnjoyed: ['team_field'], experience: 'long', teamSolo: 'Team',
      outdoor: 'nice', contact: 'Heavy', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'F02 — Significant injury (same as F01)',
    expect: 'Heavy-contact sports penalised; enjoyment scores drop for rugby/boxing',
    answers: {
      sex: 'M', age: 26, height: 183, weight: 90, bodyFat: 13, wingspanCat: 'same',
      aerobic: 7, anaerobic: 8, maxStrength: 8, power: 8, speed: 7,
      coordination: 7, flexibility: 5, reaction: 7,
      sportsEnjoyed: ['team_field'], experience: 'long', teamSolo: 'Team',
      outdoor: 'nice', contact: 'Heavy', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'significant',
    }
  },

  // ── Group G: Contact preference edge cases ────────────────────────────────
  {
    label: 'G01 — Zero-contact preference female',
    expect: 'No rugby/boxing; cycling, tennis, gymnastics top',
    answers: {
      sex: 'F', age: 22, height: 162, weight: 55, bodyFat: 18, wingspanCat: 'same',
      aerobic: 7, anaerobic: 6, maxStrength: 5, power: 6, speed: 7,
      coordination: 8, flexibility: 9, reaction: 7,
      sportsEnjoyed: ['technical', 'racquet'], experience: 'medium', teamSolo: 'Solo',
      outdoor: 'neutral', contact: 'None', water: 'No', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'G02 — Wants heavy contact',
    expect: 'Rugby, MMA, boxing at top of enjoy list',
    answers: {
      sex: 'M', age: 22, height: 178, weight: 88, bodyFat: 12, wingspanCat: 'same',
      aerobic: 7, anaerobic: 8, maxStrength: 8, power: 8, speed: 7,
      coordination: 7, flexibility: 5, reaction: 7,
      sportsEnjoyed: ['combat', 'team_field'], experience: 'medium', teamSolo: 'Either',
      outdoor: 'neutral', contact: 'Heavy', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },

  // ── Group H: Outdoor preference ───────────────────────────────────────────
  {
    label: 'H01 — Must be outdoors',
    expect: 'Indoor sports (basketball, squash) penalised; running/cycling/GAA top',
    answers: {
      sex: 'M', age: 28, height: 175, weight: 72, bodyFat: 13, wingspanCat: 'same',
      aerobic: 8, anaerobic: 6, maxStrength: 5, power: 6, speed: 7,
      coordination: 7, flexibility: 6, reaction: 6,
      sportsEnjoyed: ['endurance'], experience: 'medium', teamSolo: 'Either',
      outdoor: 'essential', contact: 'None', water: 'No', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'H02 — Prefers indoor',
    expect: 'Basketball, squash, gym sports top; outdoor sports penalised',
    answers: {
      sex: 'M', age: 28, height: 175, weight: 72, bodyFat: 13, wingspanCat: 'same',
      aerobic: 8, anaerobic: 6, maxStrength: 5, power: 6, speed: 7,
      coordination: 7, flexibility: 6, reaction: 6,
      sportsEnjoyed: ['endurance'], experience: 'medium', teamSolo: 'Either',
      outdoor: 'indoor', contact: 'None', water: 'No', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },

  // ── Group I: Physical extremes ────────────────────────────────────────────
  {
    label: 'I01 — Very short male (155cm)',
    expect: 'Sports with short mean heights: gymnastics, wrestling, judo; basketball low',
    answers: {
      sex: 'M', age: 25, height: 155, weight: 60, bodyFat: 14, wingspanCat: 'same',
      aerobic: 7, anaerobic: 7, maxStrength: 6, power: 7, speed: 7,
      coordination: 7, flexibility: 7, reaction: 7,
      sportsEnjoyed: [], experience: 'short', teamSolo: 'Either',
      outdoor: 'neutral', contact: 'Medium', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'I02 — Very tall male (208cm)',
    expect: 'Basketball, volleyball at top; marathon/gymnastics low',
    answers: {
      sex: 'M', age: 22, height: 208, weight: 108, bodyFat: 10, wingspanCat: 'much_longer',
      aerobic: 6, anaerobic: 7, maxStrength: 6, power: 8, speed: 7,
      coordination: 7, flexibility: 5, reaction: 7,
      sportsEnjoyed: [], experience: 'none', teamSolo: 'Team',
      outdoor: 'neutral', contact: 'Light', water: 'Yes', budget: 'Low',
      region: 'n_am', injury: 'none',
    }
  },
  {
    label: 'I03 — High body fat male (BMI ~33)',
    expect: 'Strength/power sports; endurance lower',
    answers: {
      sex: 'M', age: 30, height: 178, weight: 105, bodyFat: 32, wingspanCat: 'same',
      aerobic: 4, anaerobic: 5, maxStrength: 6, power: 6, speed: 3,
      coordination: 5, flexibility: 4, reaction: 5,
      sportsEnjoyed: ['strength'], experience: 'short', teamSolo: 'Solo',
      outdoor: 'neutral', contact: 'None', water: 'No', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'I04 — Very low body fat female (endurance runner)',
    expect: 'Marathon, triathlon, cycling top; weightlifting low',
    answers: {
      sex: 'F', age: 26, height: 163, weight: 50, bodyFat: 14, wingspanCat: 'same',
      aerobic: 9, anaerobic: 6, maxStrength: 4, power: 5, speed: 8,
      coordination: 7, flexibility: 7, reaction: 6,
      sportsEnjoyed: ['endurance'], experience: 'long', teamSolo: 'Solo',
      outdoor: 'essential', contact: 'None', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },

  // ── Group J: Demand profile edge cases ────────────────────────────────────
  {
    label: 'J01 — All physical attributes at 10 (elite male)',
    expect: 'Very high scores across the board; basketball/sprint sports near top',
    answers: {
      sex: 'M', age: 20, height: 182, weight: 82, bodyFat: 10, wingspanCat: 'longer',
      aerobic: 10, anaerobic: 10, maxStrength: 10, power: 10, speed: 10,
      coordination: 10, flexibility: 10, reaction: 10,
      sportsEnjoyed: [], experience: 'long', teamSolo: 'Either',
      outdoor: 'neutral', contact: 'Heavy', water: 'Yes', budget: 'High',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'J02 — All physical attributes at 1 (complete beginner)',
    expect: 'Low scores everywhere; golf/archery/bowls probably best fit',
    answers: {
      sex: 'M', age: 25, height: 175, weight: 78, bodyFat: 20, wingspanCat: 'same',
      aerobic: 1, anaerobic: 1, maxStrength: 1, power: 1, speed: 1,
      coordination: 1, flexibility: 1, reaction: 1,
      sportsEnjoyed: [], experience: 'none', teamSolo: 'Either',
      outdoor: 'neutral', contact: 'None', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'J03 — Aerobic 10, everything else 1',
    expect: 'Marathon, cycling, triathlon near top; power sports low',
    answers: {
      sex: 'M', age: 28, height: 170, weight: 62, bodyFat: 12, wingspanCat: 'same',
      aerobic: 10, anaerobic: 1, maxStrength: 1, power: 1, speed: 1,
      coordination: 1, flexibility: 1, reaction: 1,
      sportsEnjoyed: ['endurance'], experience: 'short', teamSolo: 'Solo',
      outdoor: 'essential', contact: 'None', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'J04 — Strength 10 + power 10, aerobic 1',
    expect: 'Powerlifting, weightlifting, throws at top; marathon at bottom',
    answers: {
      sex: 'M', age: 25, height: 178, weight: 100, bodyFat: 16, wingspanCat: 'same',
      aerobic: 1, anaerobic: 6, maxStrength: 10, power: 10, speed: 5,
      coordination: 5, flexibility: 4, reaction: 5,
      sportsEnjoyed: ['strength'], experience: 'medium', teamSolo: 'Solo',
      outdoor: 'neutral', contact: 'None', water: 'No', budget: 'Medium',
      region: 'ie_uk', injury: 'none',
    }
  },

  // ── Group K: Solo vs team preference ─────────────────────────────────────
  {
    label: 'K01 — Strongly team-oriented',
    expect: 'Soccer, rugby, basketball in enjoy; solo sports down',
    answers: {
      sex: 'M', age: 22, height: 178, weight: 78, bodyFat: 13, wingspanCat: 'same',
      aerobic: 7, anaerobic: 6, maxStrength: 6, power: 6, speed: 7,
      coordination: 7, flexibility: 5, reaction: 7,
      sportsEnjoyed: ['team_field'], experience: 'medium', teamSolo: 'Team',
      outdoor: 'neutral', contact: 'Medium', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'K02 — Strongly solo-oriented',
    expect: 'Running, cycling, tennis high; team sports enjoy score low',
    answers: {
      sex: 'M', age: 22, height: 178, weight: 78, bodyFat: 13, wingspanCat: 'same',
      aerobic: 7, anaerobic: 6, maxStrength: 6, power: 6, speed: 7,
      coordination: 7, flexibility: 5, reaction: 7,
      sportsEnjoyed: [], experience: 'medium', teamSolo: 'Solo',
      outdoor: 'neutral', contact: 'None', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },

  // ── Group L: Female profiles ───────────────────────────────────────────────
  {
    label: 'L01 — Average Irish female, all-rounder',
    expect: 'Only female profiles returned; wide spread of results',
    answers: {
      sex: 'F', age: 24, height: 165, weight: 62, bodyFat: 22, wingspanCat: 'same',
      aerobic: 6, anaerobic: 5, maxStrength: 5, power: 5, speed: 6,
      coordination: 6, flexibility: 6, reaction: 6,
      sportsEnjoyed: [], experience: 'short', teamSolo: 'Either',
      outdoor: 'neutral', contact: 'Light', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'L02 — Female combat / martial arts fan',
    expect: 'MMA, judo, boxing in enjoy list despite being female profiles',
    answers: {
      sex: 'F', age: 26, height: 163, weight: 60, bodyFat: 18, wingspanCat: 'same',
      aerobic: 7, anaerobic: 8, maxStrength: 7, power: 7, speed: 7,
      coordination: 8, flexibility: 7, reaction: 8,
      sportsEnjoyed: ['combat'], experience: 'medium', teamSolo: 'Solo',
      outdoor: 'neutral', contact: 'Heavy', water: 'No', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'L03 — Tall female (182cm), power athlete',
    expect: 'Volleyball, basketball, rowing high',
    answers: {
      sex: 'F', age: 21, height: 182, weight: 74, bodyFat: 17, wingspanCat: 'longer',
      aerobic: 7, anaerobic: 8, maxStrength: 7, power: 8, speed: 7,
      coordination: 7, flexibility: 6, reaction: 7,
      sportsEnjoyed: ['team_court'], experience: 'medium', teamSolo: 'Team',
      outdoor: 'neutral', contact: 'Light', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'L04 — Female 40, recreational tennis player',
    expect: 'Tennis, racquet sports top; some trainability penalty for sprint sports',
    answers: {
      sex: 'F', age: 40, height: 167, weight: 63, bodyFat: 24, wingspanCat: 'same',
      aerobic: 6, anaerobic: 5, maxStrength: 5, power: 5, speed: 6,
      coordination: 7, flexibility: 6, reaction: 7,
      sportsEnjoyed: ['racquet'], experience: 'long', teamSolo: 'Either',
      outdoor: 'nice', contact: 'Light', water: 'Yes', budget: 'Medium',
      region: 'ie_uk', injury: 'none',
    }
  },

  // ── Group M: Edge/stress cases ────────────────────────────────────────────
  {
    label: 'M01 — Minimum age (13)',
    expect: 'Should work; low scores for fast-twitch elite sports',
    answers: {
      sex: 'M', age: 13, height: 155, weight: 50, bodyFat: 16, wingspanCat: 'same',
      aerobic: 4, anaerobic: 4, maxStrength: 3, power: 4, speed: 5,
      coordination: 5, flexibility: 6, reaction: 5,
      sportsEnjoyed: [], experience: 'none', teamSolo: 'Team',
      outdoor: 'nice', contact: 'Light', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'M02 — Maximum age (75)',
    expect: 'Heavy trainability penalty on all fast-twitch sports; bowls/golf top',
    answers: {
      sex: 'M', age: 75, height: 172, weight: 74, bodyFat: 24, wingspanCat: 'same',
      aerobic: 4, anaerobic: 2, maxStrength: 3, power: 2, speed: 2,
      coordination: 5, flexibility: 4, reaction: 4,
      sportsEnjoyed: [], experience: 'none', teamSolo: 'Either',
      outdoor: 'nice', contact: 'None', water: 'No', budget: 'Medium',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'M03 — All preferences neutral/none, median body',
    expect: 'Broad spread; no extreme bias; serves as baseline distribution check',
    answers: {
      sex: 'M', age: 25, height: 175, weight: 75, bodyFat: 15, wingspanCat: 'same',
      aerobic: 5, anaerobic: 5, maxStrength: 5, power: 5, speed: 5,
      coordination: 5, flexibility: 5, reaction: 5,
      sportsEnjoyed: [], experience: 'none', teamSolo: 'Either',
      outdoor: 'neutral', contact: 'Medium', water: 'Yes', budget: 'Medium',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'M04 — Asia region male',
    expect: 'Badminton, table tennis high; GAA/AFL low',
    answers: {
      sex: 'M', age: 24, height: 172, weight: 66, bodyFat: 12, wingspanCat: 'same',
      aerobic: 7, anaerobic: 7, maxStrength: 5, power: 6, speed: 8,
      coordination: 8, flexibility: 7, reaction: 9,
      sportsEnjoyed: ['racquet', 'team_court'], experience: 'medium', teamSolo: 'Either',
      outdoor: 'neutral', contact: 'None', water: 'No', budget: 'Low',
      region: 'asia', injury: 'none',
    }
  },
  {
    label: 'M05 — No sportsEnjoyed history',
    expect: 'No category boost; neutral enjoyment baseline',
    answers: {
      sex: 'F', age: 27, height: 163, weight: 58, bodyFat: 20, wingspanCat: 'same',
      aerobic: 6, anaerobic: 5, maxStrength: 5, power: 5, speed: 6,
      coordination: 6, flexibility: 6, reaction: 6,
      sportsEnjoyed: [], experience: 'none', teamSolo: 'Either',
      outdoor: 'neutral', contact: 'Light', water: 'Yes', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },

  // ── Group N: Sport-specific archetype tests ───────────────────────────────
  {
    label: 'N01 — Classic marathon runner profile (M)',
    expect: 'Marathon, cross-country, triathlon at top of built-for',
    answers: {
      sex: 'M', age: 28, height: 169, weight: 58, bodyFat: 9, wingspanCat: 'same',
      aerobic: 9, anaerobic: 5, maxStrength: 3, power: 4, speed: 7,
      coordination: 6, flexibility: 6, reaction: 5,
      sportsEnjoyed: ['endurance'], experience: 'long', teamSolo: 'Solo',
      outdoor: 'essential', contact: 'None', water: 'No', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'N02 — Elite rower profile (M)',
    expect: 'Rowing near top of built-for; tall, heavy, long wingspan',
    answers: {
      sex: 'M', age: 22, height: 193, weight: 92, bodyFat: 10, wingspanCat: 'much_longer',
      aerobic: 9, anaerobic: 8, maxStrength: 8, power: 7, speed: 6,
      coordination: 7, flexibility: 6, reaction: 6,
      sportsEnjoyed: ['endurance', 'water'], experience: 'long', teamSolo: 'Either',
      outdoor: 'nice', contact: 'None', water: 'Yes', budget: 'Medium',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'N03 — Jockey profile (male, very small)',
    expect: 'Equestrian very high built-for; combat/tall sports low',
    answers: {
      sex: 'M', age: 24, height: 158, weight: 54, bodyFat: 9, wingspanCat: 'shorter',
      aerobic: 7, anaerobic: 6, maxStrength: 5, power: 5, speed: 6,
      coordination: 8, flexibility: 7, reaction: 8,
      sportsEnjoyed: [], experience: 'long', teamSolo: 'Solo',
      outdoor: 'essential', contact: 'Light', water: 'No', budget: 'High',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'N04 — Classic sprinter (M, 100m build)',
    expect: '100m/200m, sprint sports high built-for; marathon low',
    answers: {
      sex: 'M', age: 21, height: 180, weight: 78, bodyFat: 8, wingspanCat: 'longer',
      aerobic: 6, anaerobic: 10, maxStrength: 8, power: 10, speed: 10,
      coordination: 8, flexibility: 6, reaction: 9,
      sportsEnjoyed: ['explosive_cat'], experience: 'long', teamSolo: 'Solo',
      outdoor: 'neutral', contact: 'None', water: 'No', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },
  {
    label: 'N05 — Female gymnast profile',
    expect: 'Gymnastics top built-for; rugby/contact sports at zero enjoy',
    answers: {
      sex: 'F', age: 17, height: 155, weight: 48, bodyFat: 14, wingspanCat: 'same',
      aerobic: 7, anaerobic: 8, maxStrength: 7, power: 8, speed: 7,
      coordination: 9, flexibility: 10, reaction: 8,
      sportsEnjoyed: ['technical'], experience: 'long', teamSolo: 'Solo',
      outdoor: 'neutral', contact: 'None', water: 'No', budget: 'Low',
      region: 'ie_uk', injury: 'none',
    }
  },

  // ── Group O: Additional diverse scenarios ─────────────────────────────────
  {
    label: 'O01 — Brazilian male, team field, medium budget',
    expect: 'Soccer, volleyball high; GAA low (n_am region)',
    answers: {
      sex: 'M', age: 25, height: 177, weight: 73, bodyFat: 12, wingspanCat: 'same',
      aerobic: 8, anaerobic: 7, maxStrength: 6, power: 7, speed: 8,
      coordination: 8, flexibility: 7, reaction: 7,
      sportsEnjoyed: ['team_field', 'team_court'], experience: 'long', teamSolo: 'Team',
      outdoor: 'nice', contact: 'Light', water: 'Yes', budget: 'Medium',
      region: 'n_am', injury: 'none',
    }
  },
  {
    label: 'O02 — Japanese male, technical/precision preference',
    expect: 'Archery, table tennis, badminton high; asia region boosts those',
    answers: {
      sex: 'M', age: 30, height: 171, weight: 67, bodyFat: 13, wingspanCat: 'same',
      aerobic: 6, anaerobic: 5, maxStrength: 5, power: 5, speed: 6,
      coordination: 8, flexibility: 7, reaction: 8,
      sportsEnjoyed: ['technical', 'racquet'], experience: 'medium', teamSolo: 'Solo',
      outdoor: 'neutral', contact: 'Light', water: 'No', budget: 'Low',
      region: 'asia', injury: 'none',
    }
  },
  {
    label: 'O03 — Female wheelchair accessible test (low contact, joint injury)',
    expect: 'Archery, shooting, darts, equestrian should do well; contact → near zero',
    answers: {
      sex: 'F', age: 34, height: 165, weight: 68, bodyFat: 25, wingspanCat: 'same',
      aerobic: 4, anaerobic: 3, maxStrength: 4, power: 3, speed: 2,
      coordination: 6, flexibility: 3, reaction: 6,
      sportsEnjoyed: ['technical'], experience: 'short', teamSolo: 'Solo',
      outdoor: 'neutral', contact: 'None', water: 'No', budget: 'Medium',
      region: 'ie_uk', injury: 'joint',
    }
  },
  {
    label: 'O04 — Overweight male looking to start',
    expect: 'Strength sports, bowls, golf; aerobics-heavy sports mid-range',
    answers: {
      sex: 'M', age: 38, height: 178, weight: 118, bodyFat: 35, wingspanCat: 'same',
      aerobic: 3, anaerobic: 4, maxStrength: 5, power: 4, speed: 2,
      coordination: 4, flexibility: 3, reaction: 4,
      sportsEnjoyed: [], experience: 'none', teamSolo: 'Either',
      outdoor: 'neutral', contact: 'None', water: 'No', budget: 'Low',
      region: 'ie_uk', injury: 'minor',
    }
  },
  {
    label: 'O05 — Female cyclist, Europe, all-round fitness',
    expect: 'Cycling, triathlon high; correct region boosts',
    answers: {
      sex: 'F', age: 32, height: 168, weight: 59, bodyFat: 17, wingspanCat: 'same',
      aerobic: 9, anaerobic: 7, maxStrength: 6, power: 6, speed: 7,
      coordination: 7, flexibility: 6, reaction: 6,
      sportsEnjoyed: ['endurance'], experience: 'long', teamSolo: 'Solo',
      outdoor: 'essential', contact: 'None', water: 'No', budget: 'High',
      region: 'w_eu', injury: 'none',
    }
  },
];

// ── Run all personas ──────────────────────────────────────────────────────────
const results = personas.map(p => ({ ...p, result: scoreUser(p.answers) }));

// ── Output ────────────────────────────────────────────────────────────────────
function fmt(n) { return String(n).padStart(5); }
function sportName(r) {
  const s = r.sport;
  return `${s.sport}${s.position && s.position !== 'All' ? ' ('+s.position+')' : ''}`;
}

console.log('='.repeat(80));
console.log('BUILTFOR STRESS TEST — 50 PERSONAS');
console.log('='.repeat(80));

// Validation checks
let sexViolations = 0;
let waterViolations = 0;
let scoreRangeErrors = 0;

results.forEach(p => {
  const { answers, result } = p;

  // Sex filter check
  result.overall.forEach(r => {
    if (r.total > 0 && r.sport.sex !== answers.sex) {
      sexViolations++;
      console.error(`SEX VIOLATION: ${p.label} got ${r.sport.sport} (${r.sport.sex})`);
    }
  });

  // Water filter check
  if (answers.water === 'No') {
    result.overall.forEach(r => {
      if (r.total > 0 && r.sport.categorical.waterBased === 'Yes') {
        waterViolations++;
        console.error(`WATER VIOLATION: ${p.label} got ${r.sport.sport}`);
      }
    });
  }

  // Score range check
  result.overall.forEach(r => {
    if (r.total < 0 || r.total > 100 || r.builtFor < 0 || r.builtFor > 100 || r.enjoyment < 0 || r.enjoyment > 100) {
      scoreRangeErrors++;
      console.error(`RANGE ERROR in ${p.label}: bf=${r.builtFor} enj=${r.enjoyment} total=${r.total}`);
    }
  });
});

console.log(`\nValidation: ${sexViolations} sex violations | ${waterViolations} water violations | ${scoreRangeErrors} range errors`);
console.log(sexViolations + waterViolations + scoreRangeErrors === 0 ? '✓ All hard filters passed' : '✗ FILTER FAILURES DETECTED');
console.log('');

// Per-persona summary
results.forEach(p => {
  const { result } = p;
  const top5 = result.overall.slice(0, 5);
  console.log(`─── ${p.label}`);
  console.log(`    EXPECT: ${p.expect}`);
  console.log(`    ${result.nonZero} eligible sports (${result.excluded} excluded)  max=${result.maxScore}  minNonZero=${result.minNonZero}`);
  console.log(`    TOP-5 OVERALL:`);
  top5.forEach((r, i) => {
    const name = sportName(r).substring(0, 35).padEnd(35);
    console.log(`      ${i+1}. ${name}  OVR${fmt(r.total)}  BF${fmt(r.builtFor)}  ENJ${fmt(r.enjoyment)}`);
  });
  console.log('');
});

// ── Key comparisons ───────────────────────────────────────────────────────────
console.log('='.repeat(80));
console.log('KEY COMPARISONS');
console.log('='.repeat(80));

function compareTopSports(labelA, labelB, key = 'overall') {
  const a = results.find(r => r.label.startsWith(labelA));
  const b = results.find(r => r.label.startsWith(labelB));
  if (!a || !b) return;
  console.log(`\n${a.label}  vs  ${b.label}`);

  const sportsA = new Set(a.result[key].map(r => sportName(r)));
  const sportsB = new Set(b.result[key].map(r => sportName(r)));
  const shared  = [...sportsA].filter(s => sportsB.has(s));
  const onlyA   = [...sportsA].filter(s => !sportsB.has(s));
  const onlyB   = [...sportsB].filter(s => !sportsA.has(s));

  if (shared.length)  console.log(`  Shared in top-5: ${shared.join(', ')}`);
  if (onlyA.length)   console.log(`  Only in ${labelA}: ${onlyA.join(', ')}`);
  if (onlyB.length)   console.log(`  Only in ${labelB}: ${onlyB.join(', ')}`);
}

compareTopSports('D01', 'D02');   // water flag
compareTopSports('F01', 'F02');   // injury impact
compareTopSports('E01', 'E02');   // ie_uk vs n_am
compareTopSports('E01', 'E03');   // ie_uk vs anz
compareTopSports('K01', 'K02');   // team vs solo preference
compareTopSports('H01', 'H02');   // outdoor vs indoor
compareTopSports('B03', 'B06');   // age 45 vs age 65 (trainability)
compareTopSports('J01', 'J02');   // elite vs beginner

// ── Score distribution ────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(80));
console.log('SCORE DISTRIBUTION (top result across all 50 personas)');
console.log('='.repeat(80));

const allTopScores = results.map(p => p.result.maxScore);
const avg = (allTopScores.reduce((a, b) => a + b, 0) / allTopScores.length).toFixed(1);
const min = Math.min(...allTopScores);
const max = Math.max(...allTopScores);
console.log(`\nTop-1 overall score: min=${min}  avg=${avg}  max=${max}`);
console.log('\nPersonas with top score > 85 (diamond tier):');
results.filter(p => p.result.maxScore >= 85).forEach(p => {
  console.log(`  ${p.label}: ${p.result.maxScore}`);
});
console.log('\nPersonas with top score < 55 (struggling to match):');
results.filter(p => p.result.maxScore < 55).forEach(p => {
  console.log(`  ${p.label}: ${p.result.maxScore}`);
});

// ── Female coverage check ─────────────────────────────────────────────────────
console.log('\n' + '='.repeat(80));
console.log('FEMALE PROFILE COVERAGE');
console.log('='.repeat(80));
const femalePersonas = results.filter(p => p.answers.sex === 'F');
femalePersonas.forEach(p => {
  const { result } = p;
  console.log(`\n  ${p.label}`);
  console.log(`  Eligible: ${result.nonZero} / ${femaleCount} female profiles`);
  if (result.nonZero < femaleCount * 0.5) {
    console.log(`  WARNING: only ${Math.round(100 * result.nonZero / femaleCount)}% of female profiles eligible`);
  }
  result.overall.slice(0, 3).forEach(r => {
    const name = sportName(r).substring(0, 30).padEnd(30);
    console.log(`    ${name}  OVR${fmt(r.total)}  BF${fmt(r.builtFor)}  ENJ${fmt(r.enjoyment)}`);
  });
});

console.log('\n' + '='.repeat(80));
console.log('DONE');
console.log('='.repeat(80));
