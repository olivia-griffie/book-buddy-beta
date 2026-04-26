/**
 * Book Buddy - Offline Prompt Scoring Engine
 */

const NARRATIVE_TAG_MAP = {
  'protagonist focus': 'Protagonist Focus',
  'antagonist presence': 'Antagonist Presence',
  mentorship: 'Mentorship',
  mentor: 'Mentorship',
  catalyst: 'Protagonist Focus',
  trickster: 'Moral Dilemma',
  wildcard: 'Internal Struggle',
  cynical: 'Internal Struggle',
  idealistic: 'Character Growth',
  impulsive: 'Fear-Driven',
  calculated: 'Ambition',
  charismatic: 'Protagonist Focus',
  withdrawn: 'Isolation',
  stoic: 'Emotional Vulnerability',
  volatile: 'Relationship Tension',
  empathetic: 'Emotional Vulnerability',
  deceptive: 'Moral Dilemma',
  naive: 'Identity Conflict',
  perceptive: 'Internal Struggle',
  'internal struggle': 'Internal Struggle',
  conflicted: 'Internal Struggle',
  'emotional vulnerability': 'Emotional Vulnerability',
  vulnerability: 'Emotional Vulnerability',
  emotional: 'Emotional Vulnerability',
  'identity conflict': 'Identity Conflict',
  'identity crisis': 'Identity Conflict',
  'character growth': 'Character Growth',
  growth: 'Character Growth',
  transformation: 'Transformation',
  'redemption arc': 'Redemption Arc',
  redemption: 'Redemption Arc',
  denial: 'Internal Struggle',
  acceptance: 'Character Growth',
  unraveling: 'Emotional Vulnerability',
  disillusionment: 'Identity Conflict',
  ambition: 'Ambition',
  ambitious: 'Ambition',
  'fear-driven': 'Fear-Driven',
  fear: 'Fear-Driven',
  obsession: 'Obsession',
  obsessive: 'Obsession',
  guilt: 'Guilt',
  haunted: 'Guilt',
  grief: 'Guilt',
  vengeance: 'Obsession',
  'duty-bound': 'Moral Dilemma',
  survival: 'Fear-Driven',
  belonging: 'Emotional Vulnerability',
  'power-hungry': 'Ambition',
  protective: 'Relationship Tension',
  'self-destructive': 'Guilt',
  'relationship tension': 'Relationship Tension',
  tension: 'Relationship Tension',
  isolation: 'Isolation',
  isolated: 'Isolation',
  rebellion: 'Rebellion',
  rebel: 'Rebellion',
  defiant: 'Rebellion',
  'moral dilemma': 'Moral Dilemma',
  'morally grey': 'Moral Dilemma',
  'loyalty conflict': 'Moral Dilemma',
  betrayal: 'Relationship Tension',
  codependency: 'Relationship Tension',
  rivalry: 'Antagonist Presence',
  unrequited: 'Emotional Vulnerability',
  'unreliable narrator': 'Internal Struggle',
  introspective: 'Emotional Vulnerability',
  'dry wit': 'Moral Dilemma',
  'stream of consciousness': 'Internal Struggle',
  deadpan: 'Isolation',
  poetic: 'Emotional Vulnerability',
};

const ROLE_TAG_MAP = {
  protagonist: 'Protagonist Focus',
  antagonist: 'Antagonist Presence',
  'love-interest': 'Relationship Tension',
  confidant: 'Mentorship',
  deuteragonist: 'Protagonist Focus',
  foil: 'Internal Struggle',
  tertiary: 'Protagonist Focus',
};

const SCENE_TAG_MAP = {
  setup: 'Setup',
  introduction: 'Setup',
  establishing: 'Setup',
  disruption: 'Disruption',
  inciting: 'Disruption',
  catalyst: 'Disruption',
  conflict: 'Internal Conflict',
  'internal conflict': 'Internal Conflict',
  doubt: 'Internal Conflict',
  flashback: 'Flashback',
  memory: 'Flashback',
  backstory: 'Flashback',
  revelation: 'Revelation',
  reveal: 'Revelation',
  twist: 'Revelation',
  discovery: 'Revelation',
  crisis: 'Crisis',
  'turning point': 'Crisis',
  'breaking point': 'Crisis',
  climax: 'Climax',
  confrontation: 'Climax',
  peak: 'Climax',
  aftermath: 'Aftermath',
  fallout: 'Aftermath',
  consequence: 'Aftermath',
  resolution: 'Resolution',
  closure: 'Resolution',
  ending: 'Resolution',
  tense: 'Crisis',
  eerie: 'Disruption',
  melancholic: 'Internal Conflict',
  hopeful: 'Resolution',
  dread: 'Crisis',
  bittersweet: 'Aftermath',
  peaceful: 'Setup',
  chaotic: 'Climax',
  intimate: 'Internal Conflict',
  ominous: 'Disruption',
  triumphant: 'Resolution',
  desperate: 'Crisis',
  chase: 'Crisis',
  reunion: 'Revelation',
  betrayal: 'Crisis',
  farewell: 'Aftermath',
  negotiation: 'Internal Conflict',
  seduction: 'Internal Conflict',
  battle: 'Climax',
  escape: 'Crisis',
  interrogation: 'Revelation',
  'quiet moment': 'Internal Conflict',
  monologue: 'Internal Conflict',
  'dream sequence': 'Flashback',
  'close pov': 'Internal Conflict',
  'distant narrator': 'Setup',
  'multiple pov': 'Revelation',
  unreliable: 'Internal Conflict',
  'stream of thought': 'Internal Conflict',
  epistolary: 'Revelation',
  'in medias res': 'Disruption',
  retrospective: 'Flashback',
  'fast-paced': 'Crisis',
  'slow burn': 'Internal Conflict',
  cliffhanger: 'Crisis',
  breathless: 'Climax',
  languid: 'Flashback',
  'enclosed space': 'Crisis',
  'open wilderness': 'Setup',
  urban: 'Setup',
  night: 'Disruption',
  storm: 'Crisis',
  silence: 'Internal Conflict',
  crowd: 'Climax',
  ruin: 'Aftermath',
  'sacred space': 'Resolution',
  weapon: 'Climax',
  letter: 'Revelation',
  artifact: 'Revelation',
  mirror: 'Internal Conflict',
  door: 'Disruption',
  blood: 'Climax',
  fire: 'Crisis',
  photo: 'Flashback',
  map: 'Setup',
  key: 'Revelation',
  poison: 'Crisis',
  'ritual object': 'Revelation',
};

const BEAT_TO_MOOD = {
  Setup: ['reflective'],
  Disruption: ['tense'],
  'Internal Conflict': ['vulnerable', 'dark'],
  Flashback: ['reflective'],
  Revelation: ['tense', 'paranoid'],
  Crisis: ['tense', 'dread'],
  Climax: ['tense', 'driven'],
  Aftermath: ['reflective', 'hopeful'],
  Resolution: ['hopeful', 'reflective'],
};

const CHAR_TAG_TO_MOOD = {
  'Protagonist Focus': ['driven'],
  'Antagonist Presence': ['tense', 'dark'],
  'Relationship Tension': ['intimate', 'tense'],
  Mentorship: ['hopeful', 'intimate'],
  'Internal Struggle': ['vulnerable', 'dark'],
  'Emotional Vulnerability': ['vulnerable', 'intimate'],
  'Identity Conflict': ['vulnerable', 'paranoid'],
  'Character Growth': ['transformative', 'hopeful'],
  'Moral Dilemma': ['dark', 'vulnerable'],
  'Redemption Arc': ['hopeful', 'transformative'],
  Transformation: ['transformative'],
  Isolation: ['dark', 'paranoid'],
  Rebellion: ['tense', 'driven'],
  Guilt: ['dark', 'vulnerable'],
  'Fear-Driven': ['tense', 'dread'],
  Obsession: ['driven', 'dark'],
  Ambition: ['driven'],
};

const SIGNAL_TO_MOOD = {
  guilt: ['dark', 'vulnerable'],
  haunted: ['dark', 'dread'],
  'fear-driven': ['tense', 'dread'],
  fear: ['tense', 'dread'],
  obsession: ['driven', 'dark'],
  obsessive: ['driven', 'dark'],
  ambition: ['driven'],
  ambitious: ['driven'],
  'emotional vulnerability': ['vulnerable', 'intimate'],
  vulnerability: ['vulnerable'],
  emotional: ['vulnerable'],
  'redemption arc': ['hopeful', 'transformative'],
  redemption: ['hopeful', 'transformative'],
  'character growth': ['transformative', 'hopeful'],
  growth: ['transformative', 'hopeful'],
  transformation: ['transformative'],
  isolation: ['dark', 'paranoid'],
  isolated: ['dark', 'paranoid'],
  rebellion: ['tense', 'driven'],
  rebel: ['tense', 'driven'],
  defiant: ['tense', 'driven'],
  'internal struggle': ['vulnerable', 'dark'],
  conflicted: ['vulnerable', 'dark'],
  'identity conflict': ['vulnerable', 'paranoid'],
  'identity crisis': ['vulnerable', 'paranoid'],
  'moral dilemma': ['dark', 'vulnerable'],
  'morally grey': ['dark', 'vulnerable'],
  'relationship tension': ['intimate', 'tense'],
  tension: ['tense'],
  mentorship: ['hopeful', 'intimate'],
  mentor: ['hopeful', 'intimate'],
  protagonist: ['driven'],
  antagonist: ['tense', 'dark'],
  'love-interest': ['intimate'],
  confidant: ['intimate', 'hopeful'],
  setup: ['reflective'],
  disruption: ['tense'],
  'internal conflict': ['vulnerable', 'dark'],
  flashback: ['reflective'],
  revelation: ['tense', 'paranoid'],
  crisis: ['tense', 'dread'],
  climax: ['tense', 'driven'],
  aftermath: ['reflective', 'hopeful'],
  resolution: ['hopeful'],
};

const GENRE_MOOD_BASELINE = {
  memoir: ['reflective'],
  horror: ['dread'],
  'high fantasy': ['driven'],
  action: ['driven'],
  mystery: ['tense'],
  'psychological thriller': ['paranoid', 'tense'],
  romance: ['intimate'],
  'romance fantasy': ['intimate', 'hopeful'],
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

function normalizeSignal(value = '') {
  return String(value || '').toLowerCase().trim();
}

function normalizeList(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function getSectionIds(entity) {
  return Array.isArray(entity?.sectionIds)
    ? entity.sectionIds
    : (entity?.sectionId ? [entity.sectionId] : []);
}

function getPreferredActiveChapter(project, options = {}) {
  const chapters = project.chapters || [];
  const explicitId = options.activeChapterId
    || project.activeChapterId
    || project.lastSessionMeta?.chapterIds?.[0]
    || project.dailyPromptState?.activeChapterId
    || '';

  return chapters.find((chapter) => chapter.id === explicitId)
    || chapters[chapters.length - 1]
    || null;
}

function getActiveContext(project, options = {}) {
  const chapters = project.chapters || [];
  const scenes = project.scenes || [];
  const characters = project.characters || [];
  const locations = project.locations || [];
  const activeChapter = getPreferredActiveChapter(project, options);
  const activeChapterIds = uniqueValues([
    activeChapter?.id,
    ...(project.lastSessionMeta?.chapterIds || []),
  ]);
  const activeSectionIds = uniqueValues([
    activeChapter?.sectionId,
    ...(activeChapter?.sectionIds || []),
  ]);

  let activeScenes = scenes.filter((scene) => (
    activeChapterIds.includes(scene.linkedChapterId)
    || getSectionIds(scene).some((id) => activeSectionIds.includes(id))
  ));
  if (!activeScenes.length && scenes.length) {
    activeScenes = [scenes[scenes.length - 1]];
  }

  const activeSceneIds = activeScenes.map((scene) => scene.id);
  const activeSceneSectionIds = uniqueValues(activeScenes.flatMap((scene) => getSectionIds(scene)));
  const contextSectionIds = uniqueValues([...activeSectionIds, ...activeSceneSectionIds]);

  let activeCharacters = characters.filter((character) => (
    getSectionIds(character).some((id) => contextSectionIds.includes(id))
    || activeChapterIds.includes(character.chapterIntro)
    || activeSceneIds.includes(character.deathScene)
    || activeSceneIds.includes(character.romanceScenes)
  ));
  if (!activeCharacters.length) {
    activeCharacters = characters;
  }

  let activeLocations = locations.filter((location) => getSectionIds(location).some((id) => contextSectionIds.includes(id)));
  if (!activeLocations.length && locations.length) {
    activeLocations = [locations[locations.length - 1]];
  }

  return {
    activeChapter,
    activeChapters: activeChapter ? [activeChapter] : chapters.slice(-1),
    activeScenes,
    activeCharacters,
    activeLocations,
    contextSectionIds,
  };
}

function mapCharacterTags(characters) {
  const tags = new Set();
  characters.forEach((char) => {
    (char.typeTags || []).forEach((role) => {
      const mapped = ROLE_TAG_MAP[role];
      if (mapped) tags.add(mapped);
    });
    (char.narrativeTags || []).forEach((tag) => {
      const mapped = NARRATIVE_TAG_MAP[normalizeSignal(tag)];
      if (mapped) tags.add(mapped);
    });
  });
  return [...tags];
}

function extractCharacterTags(project, options = {}) {
  const context = getActiveContext(project, options);
  return mapCharacterTags(options.scope === 'global' ? (project.characters || []) : context.activeCharacters);
}

function mapSceneBeatTags(scenes) {
  const tags = new Set();
  scenes.forEach((scene) => {
    (scene.tags || []).forEach((tag) => {
      const mapped = SCENE_TAG_MAP[normalizeSignal(tag)];
      if (mapped) tags.add(mapped);
    });
  });
  return [...tags];
}

function extractSceneBeatTags(project, options = {}) {
  const context = getActiveContext(project, options);
  return mapSceneBeatTags(options.scope === 'global' ? (project.scenes || []) : context.activeScenes);
}

function extractProjectTags(project) {
  return (project.tags || []).map((tag) => normalizeSignal(tag)).filter(Boolean);
}

function extractMoodTags(project) {
  const moods = new Set();
  const characters = project.characters || [];
  const scenes = project.scenes || [];
  const genres = (project.genres || []).map((genre) => normalizeSignal(genre));

  genres.forEach((genre) => {
    const baseline = Object.entries(GENRE_MOOD_BASELINE).find(([key]) => genre.includes(key));
    if (baseline) baseline[1].forEach((mood) => moods.add(mood));
  });

  characters.forEach((char) => {
    (char.typeTags || []).forEach((role) => {
      (SIGNAL_TO_MOOD[normalizeSignal(role)] || []).forEach((mood) => moods.add(mood));
    });
    (char.narrativeTags || []).forEach((tag) => {
      (SIGNAL_TO_MOOD[normalizeSignal(tag)] || []).forEach((mood) => moods.add(mood));
    });
  });

  scenes.forEach((scene) => {
    (scene.tags || []).forEach((tag) => {
      const beatKey = SCENE_TAG_MAP[normalizeSignal(tag)];
      if (beatKey) {
        (SIGNAL_TO_MOOD[normalizeSignal(beatKey)] || []).forEach((mood) => moods.add(mood));
      }
    });
  });

  return [...moods];
}

function deriveEntryMoodTags(entry) {
  if (entry.moodTone?.length) return entry.moodTone;

  const moods = new Set();
  (entry.storyBeatTags || []).forEach((tag) => {
    (BEAT_TO_MOOD[tag] || []).forEach((mood) => moods.add(mood));
  });
  (entry.characterTags || []).forEach((tag) => {
    (CHAR_TAG_TO_MOOD[tag] || []).forEach((mood) => moods.add(mood));
  });
  return [...moods];
}

function extractDraftPositionTags(project) {
  const goal = Number(project.wordCountGoal || 0);
  const current = Number(project.currentWordCount || 0);
  if (!goal || !current) return [];

  const progress = Math.min(current / goal, 1.0);
  const bucket = DRAFT_POSITION_BEATS.find((entry) => progress <= entry.max);
  return bucket ? bucket.tags : [];
}

function buildScoringSignals(project, options = {}) {
  const context = getActiveContext(project, options);
  return {
    activeCharacterTags: mapCharacterTags(context.activeCharacters),
    globalCharacterTags: mapCharacterTags(project.characters || []),
    activeSceneBeatTags: mapSceneBeatTags(context.activeScenes),
    globalSceneBeatTags: mapSceneBeatTags(project.scenes || []),
    moodTags: extractMoodTags(project),
    projectTags: extractProjectTags(project),
    draftPositionTags: extractDraftPositionTags(project),
    promptType: normalizeSignal(options.promptType || project.dailyPromptState?.promptType || ''),
    promptFocusTags: normalizeList(options.promptFocusTags || project.dailyPromptState?.promptFocusTags || []).map(normalizeSignal),
    context,
  };
}

function addReason(reasons, label, values, weight) {
  uniqueValues(values).forEach((value) => reasons.push({ label, value, weight }));
}

function scoreEntry(entry, signals, options = {}) {
  let score = 0;
  const entryCharTags = new Set(entry.characterTags || []);
  const entryBeatTags = new Set(entry.storyBeatTags || []);
  const entryMoodTags = new Set(deriveEntryMoodTags(entry));
  const entryPromptType = normalizeSignal(entry.promptType || '');
  const entryFocusTags = new Set(normalizeList(entry.promptFocusTags).map(normalizeSignal));
  const entryPromptText = normalizeSignal(entry.prompt || '');
  const reasons = [];

  if (signals.promptType && entryPromptType && signals.promptType === entryPromptType) {
    score += 8;
    addReason(reasons, 'Prompt Type', [entry.promptType], 8);
  }

  const matchedFocusTags = signals.promptFocusTags.filter((tag) => entryFocusTags.has(tag) || entryPromptText.includes(tag));
  if (matchedFocusTags.length) {
    score += matchedFocusTags.length * 6;
    addReason(reasons, 'Prompt Focus', matchedFocusTags, 6);
  }

  signals.draftPositionTags.forEach((tag) => {
    if (entryBeatTags.has(tag)) {
      score += 10;
      addReason(reasons, 'Draft Position', [tag], 10);
    }
  });

  signals.activeSceneBeatTags.forEach((tag) => {
    if (entryBeatTags.has(tag)) {
      score += 11;
      addReason(reasons, 'Active Scene', [tag], 11);
    }
  });

  signals.activeCharacterTags.forEach((tag) => {
    if (entryCharTags.has(tag)) {
      score += 9;
      addReason(reasons, 'Active Character', [tag], 9);
    }
  });

  signals.globalSceneBeatTags.forEach((tag) => {
    if (entryBeatTags.has(tag) && !signals.activeSceneBeatTags.includes(tag)) {
      score += 3;
      addReason(reasons, 'Project Scene', [tag], 3);
    }
  });

  signals.globalCharacterTags.forEach((tag) => {
    if (entryCharTags.has(tag) && !signals.activeCharacterTags.includes(tag)) {
      score += 2;
      addReason(reasons, 'Project Character', [tag], 2);
    }
  });

  signals.moodTags.forEach((mood) => {
    if (entryMoodTags.has(mood)) {
      score += 4;
      addReason(reasons, 'Mood', [mood], 4);
    }
  });

  signals.projectTags.forEach((tag) => {
    if (entryPromptText.includes(tag)) {
      score += 2;
      addReason(reasons, 'Project Tag', [tag], 2);
    }
  });

  if (!options.includeDetails) {
    return score;
  }

  const matchedTags = uniqueValues(reasons.map((reason) => reason.value));
  const scoreReason = reasons
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 5)
    .map((reason) => reason.value)
    .join(' + ');

  return {
    score,
    matchedTags,
    scoreReason: scoreReason || 'Genre match',
  };
}

function weightedPickN(entries, signals, recentHistory, count) {
  const recentPromptTexts = new Set((recentHistory || []).slice(-20).map((entry) => entry.prompt));
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

function injectCharacterTokens(promptText, project, options = {}) {
  const characters = project.characters || [];
  const context = getActiveContext(project, options);
  const getByRole = (role) => characters.find((character) => (character.typeTags || []).includes(role));
  const protagonist = getByRole('protagonist');
  const antagonist = getByRole('antagonist');
  const loveInterest = getByRole('love-interest');
  const confidant = getByRole('confidant');
  const location = context.activeLocations[0] || (project.locations || []).slice(-1)[0];
  const scene = context.activeScenes[0] || (project.scenes || []).slice(-1)[0];

  let text = promptText;
  const replacements = {
    '{{protagonist}}': protagonist?.name || 'the protagonist',
    '{{antagonist}}': antagonist?.name || 'the antagonist',
    '{{loveInterest}}': loveInterest?.name || 'the love interest',
    '{{confidant}}': confidant?.name || 'the confidant',
    '{{location}}': location?.name || 'the location',
    '{{scene}}': scene?.title || 'the scene',
  };

  Object.entries(replacements).forEach(([token, replacement]) => {
    text = text.split(token).join(replacement);
  });

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

function selectScoredPrompts({
  taggedPool,
  fallbackPool,
  project,
  count = 1,
  recentHistory = [],
  promptType = '',
  promptFocusTags = [],
  activeChapterId = '',
} = {}) {
  const safeProject = project || {};
  const signals = buildScoringSignals(safeProject, { promptType, promptFocusTags, activeChapterId });
  const selectedGenreKeys = (safeProject.genres || []).map((genre) => normalizeSignal(genre));
  const safeTaggedPool = taggedPool || [];
  const genreMatchedTaggedPool = safeTaggedPool.filter((entry) => {
    const entryGenre = normalizeSignal(entry.genre || '');
    return selectedGenreKeys.some((genre) => entryGenre.includes(genre));
  });
  const pool = genreMatchedTaggedPool.length
    ? genreMatchedTaggedPool
    : safeTaggedPool.length
      ? safeTaggedPool
      : (fallbackPool || []);
  const selected = weightedPickN(pool, signals, recentHistory, count);

  return selected.map((entry) => {
    const details = scoreEntry(entry, signals, { includeDetails: true });
    return {
      ...entry,
      prompt: injectCharacterTokens(entry.prompt || '', safeProject, { activeChapterId }),
      _score: details.score,
      matchedTags: details.matchedTags,
      scoreReason: details.scoreReason,
    };
  });
}

function debugTopScored(taggedPool, project, topN = 10) {
  const signals = buildScoringSignals(project || {});
  return (taggedPool || [])
    .map((entry) => ({ entry, ...scoreEntry(entry, signals, { includeDetails: true }) }))
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
