/**
 * Book Buddy — Offline Prompt Scoring Engine
 */

const NARRATIVE_TAG_MAP = {
  'protagonist focus':      'Protagonist Focus',
  'antagonist presence':    'Antagonist Presence',
  'mentorship':             'Mentorship',
  'mentor':                 'Mentorship',
  'catalyst':               'Protagonist Focus',
  'trickster':              'Moral Dilemma',
  'wildcard':               'Internal Struggle',
  'cynical':                'Internal Struggle',
  'idealistic':             'Character Growth',
  'impulsive':              'Fear-Driven',
  'calculated':             'Ambition',
  'charismatic':            'Protagonist Focus',
  'withdrawn':              'Isolation',
  'stoic':                  'Emotional Vulnerability',
  'volatile':               'Relationship Tension',
  'empathetic':             'Emotional Vulnerability',
  'deceptive':              'Moral Dilemma',
  'naive':                  'Identity Conflict',
  'perceptive':             'Internal Struggle',
  'internal struggle':      'Internal Struggle',
  'conflicted':             'Internal Struggle',
  'emotional vulnerability':'Emotional Vulnerability',
  'vulnerability':          'Emotional Vulnerability',
  'emotional':              'Emotional Vulnerability',
  'identity conflict':      'Identity Conflict',
  'identity crisis':        'Identity Conflict',
  'character growth':       'Character Growth',
  'growth':                 'Character Growth',
  'transformation':         'Transformation',
  'redemption arc':         'Redemption Arc',
  'redemption':             'Redemption Arc',
  'denial':                 'Internal Struggle',
  'acceptance':             'Character Growth',
  'unraveling':             'Emotional Vulnerability',
  'disillusionment':        'Identity Conflict',
  'ambition':               'Ambition',
  'ambitious':              'Ambition',
  'fear-driven':            'Fear-Driven',
  'fear':                   'Fear-Driven',
  'obsession':              'Obsession',
  'obsessive':              'Obsession',
  'guilt':                  'Guilt',
  'haunted':                'Guilt',
  'grief':                  'Guilt',
  'vengeance':              'Obsession',
  'duty-bound':             'Moral Dilemma',
  'survival':               'Fear-Driven',
  'belonging':              'Emotional Vulnerability',
  'power-hungry':           'Ambition',
  'protective':             'Relationship Tension',
  'self-destructive':       'Guilt',
  'relationship tension':   'Relationship Tension',
  'tension':                'Relationship Tension',
  'isolation':              'Isolation',
  'isolated':               'Isolation',
  'rebellion':              'Rebellion',
  'rebel':                  'Rebellion',
  'defiant':                'Rebellion',
  'moral dilemma':          'Moral Dilemma',
  'morally grey':           'Moral Dilemma',
  'loyalty conflict':       'Moral Dilemma',
  'betrayal':               'Relationship Tension',
  'codependency':           'Relationship Tension',
  'rivalry':                'Antagonist Presence',
  'unrequited':             'Emotional Vulnerability',
  'unreliable narrator':    'Internal Struggle',
  'introspective':          'Emotional Vulnerability',
  'dry wit':                'Moral Dilemma',
  'stream of consciousness':'Internal Struggle',
  'deadpan':                'Isolation',
  'poetic':                 'Emotional Vulnerability',
};

const ROLE_TAG_MAP = {
  'protagonist':    'Protagonist Focus',
  'antagonist':     'Antagonist Presence',
  'love-interest':  'Relationship Tension',
  'confidant':      'Mentorship',
  'deuteragonist':  'Protagonist Focus',
  'foil':           'Internal Struggle',
  'tertiary':       'Protagonist Focus',
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
  'tense':              'Crisis',
  'eerie':              'Disruption',
  'melancholic':        'Internal Conflict',
  'hopeful':            'Resolution',
  'dread':              'Crisis',
  'bittersweet':        'Aftermath',
  'peaceful':           'Setup',
  'chaotic':            'Climax',
  'intimate':           'Internal Conflict',
  'ominous':            'Disruption',
  'triumphant':         'Resolution',
  'desperate':          'Crisis',
  'chase':              'Crisis',
  'reunion':            'Revelation',
  'betrayal':           'Crisis',
  'farewell':           'Aftermath',
  'negotiation':        'Internal Conflict',
  'seduction':          'Internal Conflict',
  'battle':             'Climax',
  'escape':             'Crisis',
  'interrogation':      'Revelation',
  'quiet moment':       'Internal Conflict',
  'monologue':          'Internal Conflict',
  'dream sequence':     'Flashback',
  'close pov':          'Internal Conflict',
  'distant narrator':   'Setup',
  'multiple pov':       'Revelation',
  'unreliable':         'Internal Conflict',
  'stream of thought':  'Internal Conflict',
  'epistolary':         'Revelation',
  'in medias res':      'Disruption',
  'retrospective':      'Flashback',
  'fast-paced':         'Crisis',
  'slow burn':          'Internal Conflict',
  'cliffhanger':        'Crisis',
  'breathless':         'Climax',
  'languid':            'Flashback',
  'enclosed space':     'Crisis',
  'open wilderness':    'Setup',
  'urban':              'Setup',
  'night':              'Disruption',
  'storm':              'Crisis',
  'silence':            'Internal Conflict',
  'crowd':              'Climax',
  'ruin':               'Aftermath',
  'sacred space':       'Resolution',
  'weapon':             'Climax',
  'letter':             'Revelation',
  'artifact':           'Revelation',
  'mirror':             'Internal Conflict',
  'door':               'Disruption',
  'blood':              'Climax',
  'fire':               'Crisis',
  'photo':              'Flashback',
  'map':                'Setup',
  'key':                'Revelation',
  'poison':             'Crisis',
  'ritual object':      'Revelation',
};

// Maps storyBeatTags → mood tones (used to infer entry mood when moodTone is absent)
const BEAT_TO_MOOD = {
  'Setup':             ['reflective'],
  'Disruption':        ['tense'],
  'Internal Conflict': ['vulnerable', 'dark'],
  'Flashback':         ['reflective'],
  'Revelation':        ['tense', 'paranoid'],
  'Crisis':            ['tense', 'dread'],
  'Climax':            ['tense', 'driven'],
  'Aftermath':         ['reflective', 'hopeful'],
  'Resolution':        ['hopeful', 'reflective'],
};

// Maps characterTags → mood tones (for entry mood inference)
const CHAR_TAG_TO_MOOD = {
  'Protagonist Focus':      ['driven'],
  'Antagonist Presence':    ['tense', 'dark'],
  'Relationship Tension':   ['intimate', 'tense'],
  'Mentorship':             ['hopeful', 'intimate'],
  'Internal Struggle':      ['vulnerable', 'dark'],
  'Emotional Vulnerability':['vulnerable', 'intimate'],
  'Identity Conflict':      ['vulnerable', 'paranoid'],
  'Character Growth':       ['transformative', 'hopeful'],
  'Moral Dilemma':          ['dark', 'vulnerable'],
  'Redemption Arc':         ['hopeful', 'transformative'],
  'Transformation':         ['transformative'],
  'Isolation':              ['dark', 'paranoid'],
  'Rebellion':              ['tense', 'driven'],
  'Guilt':                  ['dark', 'vulnerable'],
  'Fear-Driven':            ['tense', 'dread'],
  'Obsession':              ['driven', 'dark'],
  'Ambition':               ['driven'],
};

// Maps project signals (narrative tags, roles, scene beats) → mood tones for extraction
const SIGNAL_TO_MOOD = {
  // from character narrativeTags (already normalized lowercase)
  'guilt':                   ['dark', 'vulnerable'],
  'haunted':                 ['dark', 'dread'],
  'fear-driven':             ['tense', 'dread'],
  'fear':                    ['tense', 'dread'],
  'obsession':               ['driven', 'dark'],
  'obsessive':               ['driven', 'dark'],
  'ambition':                ['driven'],
  'ambitious':               ['driven'],
  'emotional vulnerability':  ['vulnerable', 'intimate'],
  'vulnerability':           ['vulnerable'],
  'emotional':               ['vulnerable'],
  'redemption arc':          ['hopeful', 'transformative'],
  'redemption':              ['hopeful', 'transformative'],
  'character growth':        ['transformative', 'hopeful'],
  'growth':                  ['transformative', 'hopeful'],
  'transformation':          ['transformative'],
  'isolation':               ['dark', 'paranoid'],
  'isolated':                ['dark', 'paranoid'],
  'rebellion':               ['tense', 'driven'],
  'rebel':                   ['tense', 'driven'],
  'defiant':                 ['tense', 'driven'],
  'internal struggle':       ['vulnerable', 'dark'],
  'conflicted':              ['vulnerable', 'dark'],
  'identity conflict':       ['vulnerable', 'paranoid'],
  'identity crisis':         ['vulnerable', 'paranoid'],
  'moral dilemma':           ['dark', 'vulnerable'],
  'morally grey':            ['dark', 'vulnerable'],
  'relationship tension':    ['intimate', 'tense'],
  'tension':                 ['tense'],
  'mentorship':              ['hopeful', 'intimate'],
  'mentor':                  ['hopeful', 'intimate'],
  // from character typeTags (already lowercase)
  'protagonist':             ['driven'],
  'antagonist':              ['tense', 'dark'],
  'love-interest':           ['intimate'],
  'confidant':               ['intimate', 'hopeful'],
  // from mapped storyBeatTags (already normalized)
  'setup':                   ['reflective'],
  'disruption':              ['tense'],
  'internal conflict':       ['vulnerable', 'dark'],
  'flashback':               ['reflective'],
  'revelation':              ['tense', 'paranoid'],
  'crisis':                  ['tense', 'dread'],
  'climax':                  ['tense', 'driven'],
  'aftermath':               ['reflective', 'hopeful'],
  'resolution':              ['hopeful'],
};

// Genre-level baseline moods (fallback when no other signals are present)
const GENRE_MOOD_BASELINE = {
  'memoir':                 ['reflective'],
  'horror':                 ['dread'],
  'high fantasy':           ['driven'],
  'action':                 ['driven'],
  'mystery':                ['tense'],
  'psychological thriller': ['paranoid', 'tense'],
  'romance':                ['intimate'],
  'romance fantasy':        ['intimate', 'hopeful'],
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

function extractMoodTags(project) {
  const moods = new Set();
  const characters = project.characters || [];
  const scenes = project.scenes || [];
  const genres = (project.genres || []).map((g) => String(g).toLowerCase());

  // Genre baseline
  genres.forEach((g) => {
    const baseline = Object.entries(GENRE_MOOD_BASELINE).find(([k]) => g.includes(k));
    if (baseline) baseline[1].forEach((m) => moods.add(m));
  });

  // Character signals: typeTags + narrativeTags
  characters.forEach((char) => {
    (char.typeTags || []).forEach((role) => {
      (SIGNAL_TO_MOOD[role.toLowerCase()] || []).forEach((m) => moods.add(m));
    });
    (char.narrativeTags || []).forEach((tag) => {
      (SIGNAL_TO_MOOD[tag.toLowerCase().trim()] || []).forEach((m) => moods.add(m));
    });
  });

  // Scene beat signals
  scenes.forEach((scene) => {
    (scene.tags || []).forEach((tag) => {
      const normalized = tag.toLowerCase().trim();
      const beatKey = SCENE_TAG_MAP[normalized];
      if (beatKey) {
        (SIGNAL_TO_MOOD[beatKey.toLowerCase()] || []).forEach((m) => moods.add(m));
      }
    });
  });

  return [...moods];
}

// Derives effective mood tones for a prompt entry.
// Uses explicit moodTone if present; otherwise infers from storyBeatTags and characterTags.
function deriveEntryMoodTags(entry) {
  if (entry.moodTone?.length) return entry.moodTone;

  const moods = new Set();
  (entry.storyBeatTags || []).forEach((tag) => {
    (BEAT_TO_MOOD[tag] || []).forEach((m) => moods.add(m));
  });
  (entry.characterTags || []).forEach((tag) => {
    (CHAR_TAG_TO_MOOD[tag] || []).forEach((m) => moods.add(m));
  });
  return [...moods];
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
  const entryMoodTags = new Set(deriveEntryMoodTags(entry));
  const entryPromptText = (entry.prompt || '').toLowerCase();

  // Draft position match — highest weight, a writer mid-draft shouldn't get Exposition prompts
  signals.draftPositionTags.forEach((tag) => {
    if (entryBeatTags.has(tag)) score += 10;
  });

  // Scene beat tags — active scene defines the emotional territory
  signals.sceneBeatTags.forEach((tag) => {
    if (entryBeatTags.has(tag)) score += 7;
  });

  // Mood tone intersection — atmosphere the writer is working in
  signals.moodTags.forEach((mood) => {
    if (entryMoodTags.has(mood)) score += 4;
  });

  // Character tag intersection — character context shapes the voice
  signals.characterTags.forEach((tag) => {
    if (entryCharTags.has(tag)) score += 5;
  });

  // Project-level tag fuzzy match — lowest confidence signal
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
    moodTags:          extractMoodTags(project),
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
    moodTags:          extractMoodTags(project),
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
