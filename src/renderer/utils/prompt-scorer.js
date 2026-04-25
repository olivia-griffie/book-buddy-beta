/**
 * Book Buddy — Offline Prompt Scoring Engine
 */

const NARRATIVE_TAG_MAP = {
  'redemption':           'Redemption Arc',
  'redemption arc':       'Redemption Arc',
  'transformation':       'Transformation',
  'character growth':     'Character Growth',
  'growth':               'Character Growth',
  'moral dilemma':        'Moral Dilemma',
  'morally grey':         'Moral Dilemma',
  'identity conflict':    'Identity Conflict',
  'identity crisis':      'Identity Conflict',
  'guilt':                'Guilt',
  'haunted':              'Guilt',
  'fear':                 'Fear-Driven',
  'fear-driven':          'Fear-Driven',
  'obsession':            'Obsession',
  'obsessive':            'Obsession',
  'ambition':             'Ambition',
  'ambitious':            'Ambition',
  'vulnerability':        'Emotional Vulnerability',
  'emotional':            'Emotional Vulnerability',
  'emotional vulnerability': 'Emotional Vulnerability',
  'isolation':            'Isolation',
  'isolated':             'Isolation',
  'rebel':                'Rebellion',
  'rebellion':            'Rebellion',
  'defiant':              'Rebellion',
  'mentor':               'Mentorship',
  'mentorship':           'Mentorship',
  'relationship tension': 'Relationship Tension',
  'tension':              'Relationship Tension',
  'internal struggle':    'Internal Struggle',
  'conflicted':           'Internal Struggle',
};

const ROLE_TAG_MAP = {
  'protagonist':    'Protagonist Focus',
  'antagonist':     'Antagonist Presence',
  'love-interest':  'Relationship Tension',
  'confidant':      'Mentorship',
  'deuteragonist':  'Protagonist Focus',
  'foil':           'Internal Struggle',
};

const SCENE_TAG_MAP = {
  'setup':              'Setup',
  'introduction':       'Setup',
  'establishing':       'Setup',
  'disruption':         'Disruption',
  'inciting':           'Disruption',
  'catalyst':           'Disruption',
  'conflict':           'Internal Conflict',
  'internal conflict':  'Internal Conflict',
  'doubt':              'Internal Conflict',
  'flashback':          'Flashback',
  'memory':             'Flashback',
  'backstory':          'Flashback',
  'revelation':         'Revelation',
  'reveal':             'Revelation',
  'twist':              'Revelation',
  'discovery':          'Revelation',
  'crisis':             'Crisis',
  'turning point':      'Crisis',
  'breaking point':     'Crisis',
  'climax':             'Climax',
  'confrontation':      'Climax',
  'peak':               'Climax',
  'aftermath':          'Aftermath',
  'fallout':            'Aftermath',
  'consequence':        'Aftermath',
  'resolution':         'Resolution',
  'closure':            'Resolution',
  'ending':             'Resolution',
};

const DRAFT_POSITION_BEATS = [
  { max: 0.12, tags: ['Setup'] },
  { max: 0.25, tags: ['Disruption', 'Internal Conflict'] },
  { max: 0.45, tags: ['Internal Conflict', 'Flashback'] },
  { max: 0.60, tags: ['Revelation', 'Internal Conflict'] },
  { max: 0.75, tags: ['Crisis', 'Revelation'] },
  { max: 0.88, tags: ['Climax', 'Crisis'] },
  { max: 1.00, tags: ['Aftermath', 'Resolution'] },
];

function extractCharacterTags(project) {
  const tags = new Set();
  const characters = project.characters || [];

  characters.forEach((char) => {
    (char.typeTags || []).forEach((role) => {
      const mapped = ROLE_TAG_MAP[role];
      if (mapped) tags.add(mapped);
    });

    (char.narrativeTags || []).forEach((tag) => {
      const normalized = String(tag).toLowerCase().trim();
      const mapped = NARRATIVE_TAG_MAP[normalized];
      if (mapped) tags.add(mapped);
    });
  });

  return [...tags];
}

function extractSceneBeatTags(project) {
  const tags = new Set();
  const scenes = project.scenes || [];

  scenes.forEach((scene) => {
    (scene.tags || []).forEach((tag) => {
      const normalized = String(tag).toLowerCase().trim();
      const mapped = SCENE_TAG_MAP[normalized];
      if (mapped) tags.add(mapped);
    });
  });

  return [...tags];
}

function extractProjectTags(project) {
  return (project.tags || []).map((t) => String(t).toLowerCase().trim()).filter(Boolean);
}

function extractDraftPositionTags(project) {
  const goal = Number(project.wordCountGoal || 0);
  const current = Number(project.currentWordCount || 0);

  if (!goal || !current) return [];

  const progress = Math.min(current / goal, 1.0);
  const bucket = DRAFT_POSITION_BEATS.find((b) => progress <= b.max);
  return bucket ? bucket.tags : [];
}

function scoreEntry(entry, signals) {
  let score = 0;

  const entryCharTags = new Set(entry.characterTags || []);
  const entryBeatTags = new Set(entry.storyBeatTags || []);
  const entryPromptText = (entry.prompt || '').toLowerCase();

  signals.draftPositionTags.forEach((tag) => {
    if (entryBeatTags.has(tag)) score += 10;
  });

  signals.sceneBeatTags.forEach((tag) => {
    if (entryBeatTags.has(tag)) score += 7;
  });

  signals.characterTags.forEach((tag) => {
    if (entryCharTags.has(tag)) score += 5;
  });

  signals.projectTags.forEach((tag) => {
    if (entryPromptText.includes(tag)) score += 2;
  });

  return score;
}

function weightedPickN(entries, signals, recentHistory, count) {
  const recentPromptTexts = new Set(
    (recentHistory || []).slice(-20).map((h) => h.prompt),
  );

  const scored = entries.map((entry) => {
    let weight = scoreEntry(entry, signals) + 1;
    if (recentPromptTexts.has(entry.prompt)) weight = Math.max(1, weight * 0.1);
    return { entry, weight };
  });

  const selected = [];
  const pool = [...scored];

  while (pool.length && selected.length < count) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let rand = Math.random() * totalWeight;

    for (let i = 0; i < pool.length; i++) {
      rand -= pool[i].weight;
      if (rand <= 0) {
        selected.push(pool[i].entry);
        pool.splice(i, 1);
        break;
      }
    }
  }

  return selected;
}

function injectCharacterTokens(promptText, project) {
  const characters = project.characters || [];

  const getByRole = (role) => characters.find((c) => (c.typeTags || []).includes(role));
  const protagonist = getByRole('protagonist');
  const antagonist = getByRole('antagonist');
  const loveInterest = getByRole('love-interest');
  const confidant = getByRole('confidant');

  const location = (project.locations || []).slice(-1)[0];
  const scene = (project.scenes || []).slice(-1)[0];

  let text = promptText;

  if (protagonist?.name) {
    text = text
      .replace(/\bthe protagonist\b/gi, protagonist.name)
      .replace(/\bthe narrator\b/gi, protagonist.name)
      .replace(/\bthe hero\b/gi, protagonist.name)
      .replace(/\byour main character\b/gi, protagonist.name);
  }

  if (antagonist?.name) {
    text = text
      .replace(/\bthe antagonist\b/gi, antagonist.name)
      .replace(/\bthe villain\b/gi, antagonist.name)
      .replace(/\bthe opposing force\b/gi, antagonist.name);
  }

  if (loveInterest?.name) {
    text = text.replace(/\bthe love interest\b/gi, loveInterest.name);
  }

  if (confidant?.name) {
    text = text.replace(/\bthe confidant\b/gi, confidant.name);
  }

  if (location?.name) {
    text = text
      .replace(/\ba key location\b/gi, location.name)
      .replace(/\bthe location\b/gi, location.name)
      .replace(/\bthe setting\b/gi, location.name);
  }

  if (scene?.title) {
    text = text.replace(/\bthe scene\b/gi, scene.title);
  }

  return text;
}

function selectScoredPrompts({ taggedPool, fallbackPool, project, count = 1, recentHistory = [] }) {
  const signals = {
    characterTags:     extractCharacterTags(project),
    sceneBeatTags:     extractSceneBeatTags(project),
    projectTags:       extractProjectTags(project),
    draftPositionTags: extractDraftPositionTags(project),
  };

  const pool = taggedPool?.length ? taggedPool : fallbackPool;
  const selected = weightedPickN(pool, signals, recentHistory, count);

  return selected.map((entry) => ({
    ...entry,
    prompt: injectCharacterTokens(entry.prompt || '', project),
    _score: scoreEntry(entry, signals),
  }));
}

function debugTopScored(taggedPool, project, topN = 10) {
  const signals = {
    characterTags:     extractCharacterTags(project),
    sceneBeatTags:     extractSceneBeatTags(project),
    projectTags:       extractProjectTags(project),
    draftPositionTags: extractDraftPositionTags(project),
  };

  return taggedPool
    .map((entry) => ({ entry, score: scoreEntry(entry, signals) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

if (typeof window !== 'undefined') {
  window.selectScoredPrompts = selectScoredPrompts;
  window.debugTopScored = debugTopScored;
}

if (typeof module !== 'undefined') {
  module.exports = { selectScoredPrompts, debugTopScored };
}
