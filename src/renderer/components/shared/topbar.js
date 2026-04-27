const workflowSteps = [
  { id: 'create-project', label: 'Create Project' },
  { id: 'plot-creation', label: 'Plot' },
  { id: 'characters', label: 'Characters' },
  { id: 'scenes', label: 'Scenes' },
  { id: 'chapters', label: 'Chapters' },
  { id: 'daily-prompts', label: 'Challenges' },
];

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getPlainText(value = '') {
  const parsed = window.parseRichTextValue?.(value);
  const temp = document.createElement('div');
  temp.innerHTML = parsed?.html || String(value || '');
  return (temp.textContent || temp.innerText || '').trim().replace(/\s+/g, ' ');
}

function hasText(value = '') {
  return getPlainText(value).length > 0;
}

function hasAnyText(...values) {
  return values.some((value) => hasText(value));
}

function getPrimaryCharacter(project, typeTag = 'protagonist') {
  return (project?.characters || []).find((character) => (character.typeTags || []).includes(typeTag)) || null;
}

function hasCharacterNotes(character) {
  return hasAnyText(character?.appearance, character?.background, character?.secrets, character?.desires, character?.other);
}

function hasSectionNotes(project) {
  return (project?.plotSections || []).some((section) => (
    Number(section.targetWords || 0) > 0
    || hasAnyText(section.description, section.notes)
  ));
}

const storyCompletionPhases = [
  {
    id: 'setup',
    label: 'Project setup',
    color: '#378ADD',
    items: [
      { id: 's1', title: 'Create a new project', hint: 'Home -> New Project', page: 'create-project', isDone: (project) => Boolean(project?.id) },
      { id: 's2', title: 'Set a title and subtitle or hook', hint: 'Your subtitle is the one-line sell for the story.', page: 'create-project', isDone: (project) => Boolean(project?.title && project?.subtitle) },
      { id: 's3', title: 'Enter your author name', hint: 'Used on community and exports.', page: 'create-project', isDone: (project) => Boolean(project?.authorName) },
      { id: 's4', title: 'Set a word count goal', hint: 'Adjust to your genre and draft size.', page: 'create-project', isDone: (project) => Number(project?.wordCountGoal || 0) > 0 },
      { id: 's5', title: 'Set a target completion date', hint: 'Even a rough deadline helps.', page: 'create-project', isDone: (project) => Boolean(project?.targetCompletionDate) },
      { id: 's6', title: 'Select up to two genres', hint: 'Unlocks genre guidance on the plot page.', page: 'create-project', isDone: (project) => (project?.genres || []).length > 0 },
      { id: 's7', title: 'Add story tags', hint: 'Tropes, tone, fandom, and discovery tags.', page: 'plot-creation', target: 'details[data-plot-block="project-tags"]', optional: true, isDone: (project) => (project?.tags || []).length > 0 },
      { id: 's8', title: 'Upload a cover thumbnail', hint: 'Shows on your project card and community page.', page: 'create-project', optional: true, isDone: (project) => Boolean(project?.thumbnail) },
    ],
  },
  {
    id: 'plot',
    label: 'Plot & structure',
    color: '#1D9E75',
    items: [
      { id: 'p1', title: 'Write your premise', hint: 'Who wants what, and what stands in the way?', page: 'plot-creation', target: 'details[data-plot-block="premise-stakes"]', isDone: (project) => hasText(project?.plotWorkbook?.premise) },
      { id: 'p2', title: 'Define the stakes', hint: 'What does your protagonist lose if they fail?', page: 'plot-creation', target: 'details[data-plot-block="premise-stakes"]', isDone: (project) => hasText(project?.plotWorkbook?.stakes) },
      { id: 'p3', title: 'Write a story outline', hint: 'A broad beat-by-beat map can stay rough.', page: 'plot-creation', target: 'details[data-plot-block="outline"]', isDone: (project) => hasText(project?.plotWorkbook?.outline) },
      { id: 'p4', title: 'Fill in plot section notes', hint: 'Use section targets to shape each story area.', page: 'plot-creation', target: 'details[data-plot-block="section-targets"]', isDone: hasSectionNotes },
      { id: 'p5', title: 'Add general plot notes', hint: 'Themes, loose threads, and reminders.', page: 'plot-creation', target: 'details[data-plot-block="plot-notes"]', optional: true, isDone: (project) => hasText(project?.plotWorkbook?.notes) },
      { id: 'p6', title: 'Add story tags on the plot page', hint: 'Edit tags as the story evolves.', page: 'plot-creation', target: 'details[data-plot-block="project-tags"]', optional: true, isDone: (project) => (project?.tags || []).length > 0 },
    ],
  },
  {
    id: 'characters',
    label: 'Characters',
    color: '#D4537E',
    items: [
      { id: 'c1', title: 'Create your protagonist', hint: 'Name them and assign the Protagonist type tag.', page: 'characters', target: '#add-character', isDone: (project) => Boolean(getPrimaryCharacter(project, 'protagonist')) },
      { id: 'c2', title: 'Set protagonist character type tags', hint: 'Protagonist, love interest, antagonist, foil, and more.', page: 'characters', target: '.entity-editor-card', isDone: (project) => (getPrimaryCharacter(project, 'protagonist')?.typeTags || []).length > 0 },
      { id: 'c3', title: 'Set protagonist narrative tags', hint: 'These directly influence prompt generation.', page: 'characters', target: '.entity-editor-card', isDone: (project) => (getPrimaryCharacter(project, 'protagonist')?.narrativeTags || []).length > 0 },
      { id: 'c4', title: 'Write protagonist appearance notes', hint: 'Helps you stay consistent across chapters.', page: 'characters', target: '.entity-editor-card', isDone: (project) => hasText(getPrimaryCharacter(project, 'protagonist')?.appearance) },
      { id: 'c5', title: 'Write protagonist background', hint: 'What shaped them before the story starts.', page: 'characters', target: '.entity-editor-card', isDone: (project) => hasText(getPrimaryCharacter(project, 'protagonist')?.background) },
      { id: 'c6', title: 'Write protagonist secrets', hint: 'What they hide from others and themselves.', page: 'characters', target: '.entity-editor-card', optional: true, isDone: (project) => hasText(getPrimaryCharacter(project, 'protagonist')?.secrets) },
      { id: 'c7', title: 'Create your antagonist or opposing force', hint: 'Assign the Antagonist type tag.', page: 'characters', target: '#add-character', isDone: (project) => Boolean(getPrimaryCharacter(project, 'antagonist')) },
      { id: 'c8', title: 'Tag and document supporting characters', hint: 'Give supporting cast names, tags, and notes.', page: 'characters', target: '.entity-editor-card', optional: true, isDone: (project) => (project?.characters || []).filter((character) => !(character.typeTags || []).includes('protagonist')).some((character) => character.name && ((character.typeTags || []).length || (character.narrativeTags || []).length) && hasCharacterNotes(character)) },
      { id: 'c9', title: 'Upload character images', hint: 'Reference images help with visualization.', page: 'characters', target: '.entity-editor-card', optional: true, isDone: (project) => (project?.characters || []).some((character) => Boolean(character.image)) },
    ],
  },
  {
    id: 'world',
    label: 'World & locations',
    color: '#BA7517',
    items: [
      { id: 'w1', title: 'Create your primary setting as a location', hint: 'Locations page -> New Location.', page: 'locations', isDone: (project) => (project?.locations || []).length > 0 },
      { id: 'w2', title: 'Set location type', hint: 'Country, city, planet, space, water, or general area.', page: 'locations', isDone: (project) => (project?.locations || []).some((location) => Boolean(location.type)) },
      { id: 'w3', title: 'Fill in climate, temperature, and season', hint: 'Set the physical world your characters inhabit.', page: 'locations', isDone: (project) => (project?.locations || []).some((location) => location.climate && location.temperature && location.season) },
      { id: 'w4', title: 'Add time of day and social dynamic', hint: 'Especially useful for fantasy and sci-fi world building.', page: 'locations', isDone: (project) => (project?.locations || []).some((location) => location.timeOfDay && location.socialDynamic) },
      { id: 'w5', title: 'Write location notes in Other', hint: 'Culture, history, rules, or anything that matters.', page: 'locations', optional: true, isDone: (project) => (project?.locations || []).some((location) => hasText(location.other)) },
      { id: 'w6', title: 'Create secondary locations', hint: 'Any recurring place deserves its own entry.', page: 'locations', optional: true, isDone: (project) => (project?.locations || []).length > 1 },
    ],
  },
  {
    id: 'scenes',
    label: 'Scenes',
    color: '#7F77DD',
    items: [
      { id: 'sc1', title: 'Map out your key scenes before writing', hint: 'Start with the scenes you can see clearly.', page: 'scenes', target: '#add-scene', isDone: (project) => (project?.scenes || []).length > 0 },
      { id: 'sc2', title: 'Give each scene a title', hint: 'Even a working title helps navigation.', page: 'scenes', target: '.entity-editor-card', isDone: (project) => (project?.scenes || []).some((scene) => scene.title && !/^scene\s+\d+$/i.test(scene.title)) },
      { id: 'sc3', title: 'Link each scene to a chapter', hint: 'Connect your scene map to the writing editor.', page: 'scenes', target: '.entity-editor-card', isDone: (project) => (project?.scenes || []).some((scene) => Boolean(scene.linkedChapterId)) },
      { id: 'sc4', title: 'Assign story beat tags to each scene', hint: 'Setup, Crisis, Climax, Revelation, and more.', page: 'scenes', target: '.entity-editor-card', isDone: (project) => (project?.scenes || []).some((scene) => (scene.tags || []).some((tag) => ['Setup', 'Disruption', 'Flashback', 'Internal Conflict', 'Revelation', 'Crisis', 'Climax', 'Aftermath', 'Resolution'].includes(tag))) },
      { id: 'sc5', title: 'Assign mood, atmosphere, and scene type tags', hint: 'Tense, Intimate, Confrontation, Dream Sequence, etc.', page: 'scenes', target: '.entity-editor-card', isDone: (project) => (project?.scenes || []).some((scene) => (scene.tags || []).length >= 2) },
      { id: 'sc6', title: 'Write a scene summary', hint: 'What needs to happen for the story to move forward?', page: 'scenes', target: '.entity-editor-card', isDone: (project) => (project?.scenes || []).some((scene) => hasText(scene.summary)) },
      { id: 'sc7', title: 'Add narration style and pacing tags', hint: 'Close POV, Slow Burn, Cliffhanger, and more.', page: 'scenes', target: '.entity-editor-card', optional: true, isDone: (project) => (project?.scenes || []).some((scene) => (scene.tags || []).some((tag) => ['Close POV', 'Distant Narrator', 'Multiple POV', 'Unreliable', 'Stream of Thought', 'Epistolary', 'In Medias Res', 'Retrospective', 'Fast-Paced', 'Slow Burn', 'Cliffhanger', 'Breathless', 'Languid'].includes(tag))) },
      { id: 'sc8', title: 'Tag key items and symbols', hint: 'Weapon, Letter, Mirror, Fire, or a custom symbol.', page: 'scenes', target: '.entity-editor-card', optional: true, isDone: (project) => (project?.scenes || []).some((scene) => (scene.tags || []).some((tag) => ['Weapon', 'Letter', 'Artifact', 'Mirror', 'Door', 'Blood', 'Fire', 'Photo', 'Map', 'Key', 'Poison', 'Ritual Object'].includes(tag) || !storyBuiltInSceneTags.has(tag))) },
      { id: 'sc9', title: 'Upload scene reference images', hint: 'Mood boards, locations, or visual inspiration.', page: 'scenes', target: '.entity-editor-card', optional: true, isDone: (project) => (project?.scenes || []).some((scene) => Boolean(scene.image)) },
    ],
  },
  {
    id: 'chapters',
    label: 'Chapters & writing',
    color: '#E24B4A',
    items: [
      { id: 'ch1', title: 'Create your first chapter', hint: 'Chapters page -> New Chapter.', page: 'chapters', target: '#chapter-add-quick', isDone: (project) => (project?.chapters || []).length > 0 },
      { id: 'ch2', title: 'Set a chapter title', hint: 'Working titles are fine.', page: 'chapters', target: '.chapter-writing-workspace', isDone: (project) => (project?.chapters || []).some((chapter) => chapter.title && !/^chapter\s+\d+$/i.test(chapter.title)) },
      { id: 'ch3', title: 'Assign a plot section', hint: 'Keeps your structure visible.', page: 'chapters', target: '.chapter-writing-workspace', isDone: (project) => (project?.chapters || []).some((chapter) => Boolean(chapter.sectionId)) },
      { id: 'ch4', title: 'Set a chapter word count target', hint: 'Pace chapters against the overall goal.', page: 'chapters', target: '.chapter-writing-workspace', isDone: (project) => (project?.chapters || []).some((chapter) => Number(chapter.targetWords || 0) > 0) },
      { id: 'ch5', title: 'Write your draft in the chapter editor', hint: 'Use the editor controls to write comfortably.', page: 'chapters', target: '.chapter-writing-workspace', isDone: (project) => (project?.chapters || []).some((chapter) => hasText(chapter.content)) },
      { id: 'ch6', title: 'Create all remaining chapters', hint: 'Add chapters as you go.', page: 'chapters', target: '#plot-sections-panel', isDone: (project) => (project?.chapters || []).length >= Math.max(2, (project?.plotSections || []).length || 2) },
      { id: 'ch7', title: 'Reach your project word count goal', hint: 'Track progress from the home dashboard.', page: 'home', isDone: (project) => Number(project?.wordCountGoal || 0) > 0 && Number(project?.currentWordCount || 0) >= Number(project?.wordCountGoal || 0) },
    ],
  },
  {
    id: 'prompts',
    label: 'Daily prompts',
    color: '#888780',
    items: [
      { id: 'dp1', title: 'Generate your first daily prompt', hint: 'Prompts are scored from your project data.', page: 'daily-prompts', isDone: (project) => (project?.dailyPromptHistory || []).length > 0 },
      { id: 'dp2', title: 'Choose a prompt mode', hint: 'Sequential follows beats; Wild picks freely.', page: 'daily-prompts', isDone: (project) => Boolean(project?.dailyPromptState?.mode || (project?.dailyPromptHistory || []).length) },
      { id: 'dp3', title: 'Write a response to the prompt', hint: 'Aim for the word count shown on the card.', page: 'daily-prompts', isDone: (project) => (project?.dailyPromptHistory || []).some((entry) => hasText(entry.answer)) },
      { id: 'dp4', title: 'Insert completed prompt responses into a chapter', hint: 'Insert activates after the response is ready.', page: 'daily-prompts', isDone: (project) => (project?.dailyPromptHistory || []).some((entry) => Boolean(entry.answerInsertedAt)) },
      { id: 'dp5', title: 'Build a daily writing habit with prompts', hint: 'Fresh prompts adapt as your draft evolves.', page: 'daily-prompts', optional: true, isDone: (project) => (project?.dailyPromptHistory || []).filter((entry) => entry.answerInsertedAt).length >= 5 },
    ],
  },
  {
    id: 'community',
    label: 'Community & sharing',
    color: '#5DCAA5',
    items: [
      { id: 'cm1', title: 'Sign in to your Inkbug account', hint: 'Required to share to the community feed.', page: 'community', isDone: () => Boolean(window.__inkbugHasSession) },
      { id: 'cm2', title: 'Share your project to the community', hint: 'Tags make your story discoverable.', page: 'community', isDone: (project) => Boolean(project?.isPublic) },
      { id: 'cm3', title: 'Browse other writers projects', hint: 'Filter by tags to find stories in your lane.', page: 'community', optional: true, isDone: () => false },
      { id: 'cm4', title: 'Collaborate on a shared project', hint: 'Use collaboration features when you are ready.', page: 'community', optional: true, isDone: () => false },
    ],
  },
];

const storyBuiltInSceneTags = new Set([
  'Setup', 'Disruption', 'Flashback', 'Internal Conflict', 'Revelation', 'Crisis', 'Climax', 'Aftermath', 'Resolution',
  'Tense', 'Eerie', 'Melancholic', 'Hopeful', 'Dread', 'Bittersweet', 'Peaceful', 'Chaotic', 'Intimate', 'Ominous', 'Triumphant', 'Desperate',
  'Confrontation', 'Chase', 'Discovery', 'Reunion', 'Betrayal', 'Farewell', 'Negotiation', 'Seduction', 'Battle', 'Escape', 'Interrogation', 'Quiet Moment', 'Monologue', 'Dream Sequence',
  'Close POV', 'Distant Narrator', 'Multiple POV', 'Unreliable', 'Stream of Thought', 'Epistolary', 'In Medias Res', 'Retrospective',
  'Fast-Paced', 'Slow Burn', 'Cliffhanger', 'Breathless', 'Languid',
  'Enclosed Space', 'Open Wilderness', 'Urban', 'Night', 'Storm', 'Silence', 'Crowd', 'Ruin', 'Sacred Space',
  'Weapon', 'Letter', 'Artifact', 'Mirror', 'Door', 'Blood', 'Fire', 'Photo', 'Map', 'Key', 'Poison', 'Ritual Object',
]);

const milestoneDefinitions = [
  {
    id: 'first-chapter',
    label: 'First Chapter',
    description: 'You started the manuscript.',
    isUnlocked(project) {
      return (project?.chapters || []).length >= 1;
    },
  },
  {
    id: 'five-chapters',
    label: 'Five Chapters',
    description: 'The story is growing — five chapters in.',
    isUnlocked(project) {
      return (project?.chapters || []).length >= 5;
    },
  },
  {
    id: 'ten-chapters',
    label: 'Ten Chapters',
    description: 'Double digits. This manuscript has real shape.',
    isUnlocked(project) {
      return (project?.chapters || []).length >= 10;
    },
  },
  {
    id: 'plot-ready',
    label: 'Plot Ready',
    description: 'Your story foundation is taking shape.',
    isUnlocked(project) {
      const workbook = project?.plotWorkbook || {};
      return Boolean(workbook.premise || workbook.stakes || workbook.notes);
    },
  },
  {
    id: 'story-outlined',
    label: 'Story Outlined',
    description: 'The spine of the story is written down.',
    isUnlocked(project) {
      const raw = project?.plotWorkbook?.outline || '';
      const temp = document.createElement('div');
      temp.innerHTML = raw;
      return (temp.textContent || temp.innerText || '').trim().length >= 50;
    },
  },
  {
    id: 'first-character',
    label: 'First Character',
    description: 'Your cast is coming to life.',
    isUnlocked(project) {
      return (project?.characters || []).length >= 1;
    },
  },
  {
    id: 'first-scene',
    label: 'Scene Set',
    description: 'You built the first scene in the scene bank.',
    isUnlocked(project) {
      return (project?.scenes || []).length >= 1;
    },
  },
  {
    id: 'first-location',
    label: 'World Builder',
    description: 'Your story now has a place to live.',
    isUnlocked(project) {
      return (project?.locations || []).length >= 1;
    },
  },
  {
    id: 'first-prompt-insert',
    label: 'Prompt Win',
    description: 'You turned a challenge into manuscript pages.',
    isUnlocked(project) {
      return (project?.dailyPromptHistory || []).some((entry) => entry.answerInsertedAt);
    },
  },
  {
    id: 'five-prompt-inserts',
    label: '5 Prompt Wins',
    description: 'Five challenges conquered and on the page.',
    isUnlocked(project) {
      return (project?.dailyPromptHistory || []).filter((entry) => entry.answerInsertedAt).length >= 5;
    },
  },
  {
    id: 'one-thousand-words',
    label: '1K Written',
    description: 'The first thousand words are always the hardest.',
    isUnlocked(project) {
      return Number(project?.currentWordCount || 0) >= 1000;
    },
  },
  {
    id: 'five-thousand-words',
    label: '5K Written',
    description: 'You crossed the 5,000 word mark.',
    isUnlocked(project) {
      return Number(project?.currentWordCount || 0) >= 5000;
    },
  },
  {
    id: 'ten-thousand-words',
    label: '10K Written',
    description: 'Ten thousand words of story on the page.',
    isUnlocked(project) {
      return Number(project?.currentWordCount || 0) >= 10000;
    },
  },
  {
    id: 'twenty-five-thousand-words',
    label: '25K Written',
    description: 'A quarter of a novel. Keep going.',
    isUnlocked(project) {
      return Number(project?.currentWordCount || 0) >= 25000;
    },
  },
  {
    id: 'fifty-thousand-words',
    label: '50K Written',
    description: 'NaNoWriMo territory. Remarkable.',
    isUnlocked(project) {
      return Number(project?.currentWordCount || 0) >= 50000;
    },
  },
  {
    id: 'goal-complete',
    label: 'Goal Complete',
    description: 'You hit your current manuscript goal.',
    isUnlocked(project) {
      const goal = Number(project?.wordCountGoal || 0);
      return goal > 0 && Number(project?.currentWordCount || 0) >= goal;
    },
  },
  {
    id: 'seven-day-streak',
    label: '7 Day Streak',
    description: 'A full week of writing momentum.',
    isUnlocked(project) {
      return Number(project?.streakState?.current || 0) >= 7;
    },
  },
  {
    id: 'thirty-day-streak',
    label: '30 Day Streak',
    description: 'A month of showing up. That is discipline.',
    isUnlocked(project) {
      return Number(project?.streakState?.current || 0) >= 30;
    },
  },
];

function buildDayKey(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

function computeChallengeStreak(project) {
  const entries = [...new Set((project?.dailyPromptHistory || [])
    .map((entry) => buildDayKey(entry.answerInsertedAt || entry.insertedAt))
    .filter(Boolean))]
    .sort();

  if (!entries.length) {
    return 0;
  }

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (entries.includes(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getProjectMilestoneSnapshot(project) {
  const unlockedMilestones = milestoneDefinitions
    .filter((milestone) => milestone.isUnlocked(project))
    .map((milestone) => milestone.id);

  return {
    unlockedMilestones,
    visibleBadges: milestoneDefinitions.filter((milestone) => unlockedMilestones.includes(milestone.id)),
  };
}

function getNextStepRecommendation(project) {
  if (!project) {
    return {
      page: 'create-project',
      label: 'Create Project',
      title: 'Start a new book workspace',
      description: 'Create a project so the guided writing flow can open up around it.',
    };
  }

  const workbook = project.plotWorkbook || {};
  const chapters = project.chapters || [];
  const characters = project.characters || [];
  const scenes = project.scenes || [];
  const completedChallenges = (project.dailyPromptHistory || []).filter((entry) => entry.answerInsertedAt).length;

  if (!workbook.premise && !workbook.stakes && !workbook.notes) {
    return {
      page: 'plot-creation',
      label: 'Build Plot',
      title: 'Shape the story foundation',
      description: 'Add your premise, stakes, and plot notes so the rest of the workflow has a strong spine.',
    };
  }

  if (!characters.length) {
    return {
      page: 'characters',
      label: 'Add Characters',
      title: 'Build your core cast',
      description: 'Create at least one character profile so prompts and chapters have someone to follow.',
    };
  }

  if (!scenes.length) {
    return {
      page: 'scenes',
      label: 'Sketch Scenes',
      title: 'Map out a few scene ideas',
      description: 'A couple of scene cards will make the chapter drafting flow feel much easier.',
    };
  }

  if (!chapters.length) {
    return {
      page: 'chapters',
      label: 'Draft Chapters',
      title: 'Start the manuscript',
      description: 'Add your first chapter and begin turning your plan into pages.',
    };
  }

  if (!completedChallenges) {
    return {
      page: 'daily-prompts',
      label: 'Try Challenges',
      title: 'Turn a prompt into pages',
      description: 'Use a daily challenge to generate fresh writing and insert it into your manuscript.',
    };
  }

  return {
    page: 'chapters',
    label: 'Keep Writing',
    title: 'Return to the manuscript',
    description: 'Your workspace is set up. The best next step is to keep drafting while the story is warm.',
  };
}

const CHECKLIST_STORAGE_KEY = 'inkbug_checklist_v1';
const CHECKLIST_COLLAPSED_KEY = 'inkbug_checklist_collapsed';
const PHASE_COLLAPSED_PREFIX = 'inkbug_phase_collapsed_v1_';

function getPhaseCollapsedState(phaseId) {
  const val = localStorage.getItem(PHASE_COLLAPSED_PREFIX + phaseId);
  if (val === null) return null; // no override
  return val === '1';
}

function setPhaseCollapsedState(phaseId, collapsed) {
  localStorage.setItem(PHASE_COLLAPSED_PREFIX + phaseId, collapsed ? '1' : '0');
}

function clearPhaseCollapsedState(phaseId) {
  localStorage.removeItem(PHASE_COLLAPSED_PREFIX + phaseId);
}
const PROJECT_REQUIRED_PAGES = new Set([
  'plot-creation',
  'characters',
  'locations',
  'scenes',
  'chapters',
  'daily-prompts',
  'community',
  'sharing',
]);

function getChecklistProjectKey(project) {
  return project?.id || 'global';
}

function loadChecklistState() {
  try {
    return JSON.parse(localStorage.getItem(CHECKLIST_STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveChecklistState(state) {
  localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(state || {}));
}

function getProjectChecklistState(project) {
  const state = loadChecklistState();
  const projectKey = getChecklistProjectKey(project);
  return state[projectKey] || {};
}

function setProjectChecklistItem(project, itemId, done) {
  const state = loadChecklistState();
  const projectKey = getChecklistProjectKey(project);
  const projectState = { ...(state[projectKey] || {}) };
  if (done) {
    projectState[itemId] = true;
  } else {
    delete projectState[itemId];
  }
  state[projectKey] = projectState;
  saveChecklistState(state);
}

function resetProjectChecklist(project) {
  localStorage.removeItem(CHECKLIST_STORAGE_KEY);
}

function getStoryChecklistSnapshot(project) {
  const checklistState = getProjectChecklistState(project);
  const phases = storyCompletionPhases.map((phase) => {
    const items = phase.items.map((item) => {
      let autoDone = false;
      try { autoDone = Boolean(item.isDone?.(project)); } catch { /* noop */ }
      const manualDone = Boolean(checklistState[item.id]);
      const done = autoDone || manualDone;
      if (autoDone && !manualDone && project) {
        setProjectChecklistItem(project, item.id, true);
      }
      return { ...item, done };
    });

    const doneItems = items.filter((item) => item.done);
    const allDone = items.length > 0 && doneItems.length === items.length;
    const userOverride = getPhaseCollapsedState(phase.id);
    // Auto-collapse when all done unless user explicitly reopened it
    const isOpen = userOverride !== null ? !userOverride : !allDone;
    return {
      ...phase,
      items,
      doneCount: doneItems.length,
      percent: items.length ? Math.round((doneItems.length / items.length) * 100) : 0,
      allDone,
      isOpen,
    };
  });
  const allItems = phases.flatMap((phase) => phase.items);
  const doneCount = allItems.filter((item) => item.done).length;

  return {
    phases,
    doneCount,
    totalCount: allItems.length,
    percent: allItems.length ? Math.round((doneCount / allItems.length) * 100) : 0,
  };
}

function projectHasChecklistProgress(project) {
  return storyCompletionPhases.some((phase) => phase.items.some((item) => {
    try {
      return Boolean(item.isDone?.(project));
    } catch {
      return false;
    }
  }));
}

function renderTopbarNextSteps(project) {
  const snapshot = getStoryChecklistSnapshot(project);
  const storedCollapsed = localStorage.getItem(CHECKLIST_COLLAPSED_KEY);
  const isCollapsed = storedCollapsed == null ? projectHasChecklistProgress(project) : storedCollapsed === '1';

  return `
    <section class="topbar-next-steps ${isCollapsed ? 'is-collapsed' : 'is-expanded'}" aria-label="Next Steps">
      <button class="topbar-next-steps-trigger" type="button" data-checklist-toggle aria-expanded="${isCollapsed ? 'false' : 'true'}">
        <span class="topbar-next-steps-chevron" aria-hidden="true">${isCollapsed ? '&#9656;' : '&#9662;'}</span>
        <span class="topbar-next-steps-trigger-title">Next Steps - ${snapshot.doneCount} of ${snapshot.totalCount}</span>
        <span class="topbar-next-steps-percent">${snapshot.percent}%</span>
        <span class="topbar-next-steps-trigger-bar" style="--checklist-progress:${snapshot.percent}%"></span>
      </button>
      <div class="topbar-next-steps-body">
        <div class="topbar-next-steps-head">
          <h3 class="topbar-next-steps-title">${snapshot.doneCount} of ${snapshot.totalCount} complete</h3>
          <div class="topbar-next-steps-head-actions">
            <span class="topbar-next-steps-percent">${snapshot.percent}%</span>
            <button class="topbar-next-steps-reset" type="button" data-checklist-reset>Reset</button>
          </div>
        </div>
        <div class="topbar-next-steps-progress">
          <span style="width:${snapshot.percent}%"></span>
        </div>
        <div class="topbar-next-steps-list">
        ${snapshot.phases.map((phase) => `
          <details
            class="topbar-next-step-phase ${phase.allDone ? 'is-all-done' : ''}"
            style="--phase-color:${phase.color}"
            data-phase-id="${escapeHtml(phase.id)}"
            ${phase.isOpen ? 'open' : ''}
          >
            <summary class="topbar-next-step-phase-head">
              <span class="topbar-next-step-phase-label">
                <span class="topbar-next-step-phase-dot" aria-hidden="true"></span>
                ${escapeHtml(phase.label)}
                ${phase.allDone ? '<span class="topbar-next-step-phase-done-badge">Done</span>' : ''}
              </span>
              <span class="topbar-next-step-phase-head-right">
                <span class="topbar-next-step-phase-count">${phase.doneCount}/${phase.items.length}</span>
                <span class="topbar-next-step-phase-chevron" aria-hidden="true">&#9662;</span>
              </span>
            </summary>
            <div class="topbar-next-step-phase-body">
              <div class="topbar-next-step-phase-progress"><span style="width:${phase.percent}%;"></span></div>
              <div class="topbar-next-step-items">
                ${phase.items.map((item) => `
                  <div
                    class="topbar-next-step-row ${item.done ? 'is-done' : 'is-todo'}"
                    data-topbar-next-page="${escapeHtml(item.page || 'home')}"
                    data-topbar-next-target="${escapeHtml(item.target || '')}"
                    data-checklist-item="${escapeHtml(item.id)}"
                    role="button"
                    tabindex="0"
                  >
                    <button
                      class="topbar-next-step-check"
                      type="button"
                      data-checklist-toggle-item="${escapeHtml(item.id)}"
                      aria-pressed="${item.done ? 'true' : 'false'}"
                      aria-label="${item.done ? 'Mark incomplete' : 'Mark complete'}: ${escapeHtml(item.title)}"
                    >${item.done ? '&#10003;' : ''}</button>
                    <span class="topbar-next-step-copy" data-topbar-next-copy>
                      <span class="topbar-next-step-title-line">
                        <span class="topbar-next-step-label">${escapeHtml(item.title)}</span>
                        ${item.optional ? '<span class="topbar-next-step-optional">optional</span>' : ''}
                      </span>
                      <span class="topbar-next-step-hint">${escapeHtml(item.hint || '')}</span>
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>
          </details>
        `).join('')}
        </div>
      </div>
    </section>
  `;
}

window.getProjectMilestoneSnapshot = getProjectMilestoneSnapshot;
window.getProjectMilestoneDefinitions = function getProjectMilestoneDefinitions() {
  return milestoneDefinitions.map((milestone) => ({ ...milestone }));
};

window.updateTopBarSaveState = function updateTopBarSaveState(saveStatus = {}) {
  const container = document.getElementById('topbar-container');
  if (!container) {
    return false;
  }

  const saveState = container.querySelector('.topbar-save-state');
  if (!saveState) {
    return false;
  }

  const saveTone = saveStatus.tone || 'neutral';
  const saveText = saveStatus.text || 'Ready to write';
  saveState.className = `topbar-save-state is-${saveTone}`;
  saveState.textContent = saveText;
  return true;
};

window.renderTopBar = function renderTopBar(currentPage, currentProject, saveStatus = {}) {
  const container = document.getElementById('topbar-container');
  if (!container) {
    return;
  }

  if (typeof window.__inkbugHasSession === 'undefined') {
    window.__inkbugHasSession = false;
    window.api?.auth?.getSession?.()
      .then((session) => {
        const hasSession = Boolean(session?.user || session?.id || session?.access_token);
        if (window.__inkbugHasSession !== hasSession) {
          window.__inkbugHasSession = hasSession;
          window.renderTopBar?.(currentPage, currentProject, saveStatus);
        }
      })
      .catch(() => {
        window.__inkbugHasSession = false;
      });
  }

  const hasProject = Boolean(currentProject);
  const goal = Number(currentProject?.wordCountGoal || 0);
  const words = Number(currentProject?.currentWordCount || 0);
  const progressPercent = goal > 0 ? Math.min(100, Math.round((words / goal) * 100)) : 0;
  const completedChallenges = (currentProject?.dailyPromptHistory || [])
    .filter((entry) => entry.answerInsertedAt)
    .length;
  const streak = Number(currentProject?.streakState?.current || 0);
  const activeStepIndex = workflowSteps.findIndex((step) => step.id === currentPage);
  const saveTone = saveStatus.tone || 'neutral';
  const saveText = saveStatus.text || 'Ready to write';

  const isTopbarOpen = localStorage.getItem('topbarCollapsed') !== '1';

  container.innerHTML = `
    <details class="topbar-details"${isTopbarOpen ? ' open' : ''}>
      <summary class="topbar-summary">
        <div class="topbar-summary-left">
          <p class="topbar-kicker">${hasProject ? 'Current Workspace' : 'Welcome'}</p>
          <div class="topbar-title-row">
            <h2 class="topbar-title">${hasProject ? currentProject.title : 'Inkbug Beta'}</h2>
            ${hasProject ? `<span class="topbar-save-state is-${saveTone}">${saveText}</span>` : ''}
          </div>
          <p class="topbar-subtitle">
            ${hasProject
              ? `${words.toLocaleString()} of ${goal.toLocaleString()} words tracked`
              : 'Create a project to unlock the full guided writing workflow.'}
          </p>
        </div>
        <div class="topbar-summary-right">
          <span
            class="topbar-collapse-hint"
            title="For more writing room, collapse header"
            aria-label="For more writing room, collapse header"
          >
            <svg class="topbar-collapse-hint-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 7l6-4 6 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M4 13l6 4 6-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M10 3v14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </span>
          ${!localStorage.getItem('topbarHintDismissed') ? `
            <div class="topbar-collapse-bubble" id="topbar-collapse-bubble" role="status" aria-live="polite">
              <span>Click here to collapse header</span>
              <button type="button" class="topbar-collapse-bubble-close" aria-label="Dismiss hint">×</button>
            </div>
          ` : ''}
          <span class="topbar-summary-chevron" aria-hidden="true">▾</span>
        </div>
      </summary>
      <div class="topbar-shell">
        <div class="topbar-main">
          <div class="topbar-metrics">
            ${hasProject ? `
              <div class="topbar-metric">
                <span class="topbar-metric-value">${progressPercent}%</span>
                <span class="topbar-metric-label">Novel progress</span>
              </div>
              <div class="topbar-metric">
                <span class="topbar-metric-value">${completedChallenges}</span>
                <span class="topbar-metric-label">Challenge wins</span>
              </div>
              <div class="topbar-metric">
                <span class="topbar-metric-value">${streak}</span>
                <span class="topbar-metric-label">Writing streak</span>
              </div>
            ` : ''}
          </div>
          <div class="topbar-actions">
            ${hasProject ? `
              <button
                id="topbar-reference"
                class="btn btn-ghost ${window.isReferenceDrawerOpen?.() ? 'is-active' : ''}"
                type="button"
              >
                Reference
              </button>
            ` : ''}
            ${hasProject ? '<button id="topbar-quick-prompt" class="btn btn-ghost" type="button" title="Jump to Writing Challenges">Quick Prompt</button>' : ''}
            <button id="topbar-new-project" class="btn btn-save" type="button">New Project</button>
          </div>
        </div>
        ${hasProject ? renderTopbarNextSteps(currentProject) : ''}
      </div>
    </details>
    <div class="topbar-tracker">
      ${workflowSteps.map((step, index) => {
    const isLocked = !hasProject && step.id !== 'create-project';
    const isActive = step.id === currentPage;
    const isDone = hasProject && activeStepIndex > -1 && index < activeStepIndex;
    return `
          <button
            type="button"
            class="topbar-step ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''} ${isLocked ? 'is-locked' : ''}"
            data-topbar-step="${step.id}"
            ${isLocked ? 'disabled' : ''}
          >
            <span class="topbar-step-index">${index + 1}</span>
            <span>${step.label}</span>
          </button>
        `;
  }).join('')}
    </div>
  `;

  container.querySelector('#topbar-new-project')?.addEventListener('click', () => {
    window.navigate('create-project', { project: null });
  });
  container.querySelector('#topbar-quick-prompt')?.addEventListener('click', () => {
    window.navigate('daily-prompts');
  });
  container.querySelector('#topbar-reference')?.addEventListener('click', () => {
    window.toggleReferenceDrawer();
  });
  container.querySelector('.topbar-details')?.addEventListener('toggle', (e) => {
    if (e.target.open) {
      localStorage.removeItem('topbarCollapsed');
    } else {
      localStorage.setItem('topbarCollapsed', '1');
    }
  });


  const bubble = container.querySelector('#topbar-collapse-bubble');
  if (bubble) {
    const dismissBubble = () => {
      localStorage.setItem('topbarHintDismissed', '1');
      bubble.classList.add('is-hiding');
      setTimeout(() => bubble.remove(), 300);
    };
    bubble.querySelector('.topbar-collapse-bubble-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissBubble();
    });
    container.querySelector('.topbar-summary')?.addEventListener('click', dismissBubble, { once: true });
    setTimeout(dismissBubble, 8000);
  }

  container.querySelectorAll('[data-topbar-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const { topbarStep } = button.dataset;
      if (topbarStep === 'create-project') {
        window.navigate('create-project', { project: null });
        return;
      }

      window.navigate(topbarStep);
    });
  });
  container.querySelector('[data-checklist-toggle]')?.addEventListener('click', () => {
    const nextCollapsed = !container.querySelector('.topbar-next-steps')?.classList.contains('is-collapsed');
    localStorage.setItem(CHECKLIST_COLLAPSED_KEY, nextCollapsed ? '1' : '0');
    window.renderTopBar?.(currentPage, currentProject, saveStatus);
  });

  container.querySelector('[data-checklist-reset]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    storyCompletionPhases.forEach((phase) => clearPhaseCollapsedState(phase.id));
    resetProjectChecklist(currentProject);
    window.renderTopBar?.(currentPage, currentProject, saveStatus);
  });

  container.querySelectorAll('[data-checklist-toggle-item]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const itemId = button.dataset.checklistToggleItem;
      setProjectChecklistItem(currentProject, itemId, button.getAttribute('aria-pressed') !== 'true');
      window.renderTopBar?.(currentPage, currentProject, saveStatus);
    });
  });

  container.querySelectorAll('[data-phase-id]').forEach((details) => {
    details.addEventListener('toggle', () => {
      const phaseId = details.dataset.phaseId;
      setPhaseCollapsedState(phaseId, !details.open);
    });
  });

  function scrollToTarget(selector) {
    if (!selector) return;
    const el = document.querySelector(selector);
    if (!el) return;

    // Open any closed <details> ancestors
    let node = el.parentElement;
    while (node && node !== document.body) {
      if (node.tagName === 'DETAILS' && !node.open) node.open = true;
      node = node.parentElement;
    }
    if (el.tagName === 'DETAILS' && !el.open) el.open = true;

    // Walk up to nearest visible ancestor (offsetParent===null means hidden via display:none)
    let scrollTarget = el;
    while (scrollTarget && scrollTarget !== document.body && scrollTarget.offsetParent === null) {
      scrollTarget = scrollTarget.parentElement;
    }
    if (!scrollTarget || scrollTarget === document.body) return;

    // Scroll the workspace to top first so movement is always visible, then scroll to target
    const workspace = document.getElementById('app-workspace');
    if (workspace) workspace.scrollTop = 0;

    requestAnimationFrame(() => {
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      flashTarget(scrollTarget);
    });
  }

  function flashTarget(el) {
    el.classList.remove('topbar-nav-flash');
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add('topbar-nav-flash');
    el.addEventListener('animationend', () => el.classList.remove('topbar-nav-flash'), { once: true });
  }

  async function navigateFromChecklist(page, target) {
    if (page === 'create-project') {
      if (page !== currentPage) {
        await window.navigate('create-project', { project: currentProject ?? null });
      }
      if (target) scrollToTarget(target);
      return;
    }

    if (!hasProject && PROJECT_REQUIRED_PAGES.has(page)) {
      window.navigate('home');
      window.updateTopBarSaveState?.({
        tone: 'warning',
        text: 'Select or create a project first',
      });
      return;
    }

    if (page) {
      if (page !== currentPage) {
        await window.navigate(page);
        if (target) scrollToTarget(target);
      } else {
        // Already on the right page — just scroll and flash the target
        if (target) scrollToTarget(target);
      }
    }
  }

  container.querySelectorAll('[data-topbar-next-page]').forEach((row) => {
    row.addEventListener('click', () => {
      const page = row.dataset.topbarNextPage;
      const target = row.dataset.topbarNextTarget || null;
      navigateFromChecklist(page, target);
    });
    row.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      const page = row.dataset.topbarNextPage;
      const target = row.dataset.topbarNextTarget || null;
      navigateFromChecklist(page, target);
    });
  });
};
