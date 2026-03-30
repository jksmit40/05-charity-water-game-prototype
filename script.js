// Charity Water Game - click inside the map field to interact with the tileset.

/*
Beginner Reading Guide (recommended order)
1. Start at "Core State + Config" to see the main variables and tuning values.
2. Skim "DOM Elements" to understand which HTML pieces JS controls.
3. Read "Level Flow" to see how a round is reset and started.
4. Read "Click + Input Handlers" to understand what happens on each click.
5. Return to "Render Helpers" + draw() to see how fog and icons update each frame.
*/

// -------------------------------
// Section: Core State + Config
// -------------------------------

// Game state
const game = {
  drips: 20, // Starting drips (clicks)
  score: 0, // Cumulative score across completed levels in the current run
  currentLevel: 1,
  maxReveals: 6,
  tileSize: 48,
  showFog: true,
  showRevealRings: false,
  scoutMode: false,
  gameActive: true,
  // NEW FEATURE: Tracks which difficulty mode player chose after Level 1.
  // If true, they chose to carry over leftover drops (harder = 20 points per drop on Level 2).
  // If false, they reset to 20 drops (easier = 5 points per drop on Level 2).
  usedCarryoverDrops: false,
};

// NEW FEATURE: Session high score tracking.
// This stores the best score the player achieves during this page session.
// When they beat it, the game shows a "🎉 NEW HIGH SCORE!" celebration message.
let sessionHighScore = 0;

// Turn this on only when placing future assets on the tileset.
const developerTools = {
  enabled: false,
  scoutMode: false,
};

// Safety lock: keep false for normal student/player perspective.
// Set to true only when you intentionally want URL controls like ?scout=1.
const allowUrlDebugTools = false;

// Optional URL controls for placing assets while designing levels.
// Example when unlocked: ?scout=1 (enables both dev tools and scout mode)
const urlParams = new URLSearchParams(window.location.search);
if (allowUrlDebugTools) {
  if (urlParams.get('dev') === '1' || urlParams.get('scout') === '1') {
    developerTools.enabled = true;
  }
  if (urlParams.get('scout') === '1') {
    developerTools.scoutMode = true;
  }
}

const requestedStartLevel = Number(urlParams.get('level'));
const hasRequestedStartLevel = Number.isInteger(requestedStartLevel) && requestedStartLevel >= 1;

// Level list includes placeholders so future content can be plugged in easily.
const levels = [
  {
    id: 1,
    name: 'Northern Uganda',
    tilesetImage: 'img/tileset.png',
    tilesetFit: 'cover',
    isPlaceholder: false,
  },
  {
    id: 2,
    name: 'South Ethiopia',
    tilesetImage: 'img/desert_map_lvl_2.png',
    // Stretch image to fill the full map area (no side gaps).
    tilesetFit: '100% 100%',
    isPlaceholder: false,
  },
];

const scoutPoints = [];
let tutorialShownThisSession = false;
const revealAnimationDurationMs = 850;
let revealAnimationFrameId = null;

// NEW FEATURE: Background music for gameplay.
// The audio loops quietly throughout both levels to create an immersive atmosphere.
// Volume is set to 0.25 (25%) so it doesn't overwhelm the game.
// Music starts when the player clicks "Start Mission" or advances to the next level.
const levelStartMusicPath = 'music/John_Bartmann_-_07_-_African_Moon(chosic.com).mp3';
const levelStartAudio = new Audio(levelStartMusicPath);
levelStartAudio.preload = 'auto'; // Load the audio file ahead of time for smooth playback
levelStartAudio.loop = true; // Play continuously
levelStartAudio.volume = 0.25; // Set volume to 25%

// NEW FEATURE: Water droplet click sound effect.
// Plays each time a player clicks to place a drop in a revealed area.
// This provides immediate audio feedback for player actions.
const dropletSoundPath = 'music/floraphonic-water-droplet-4-165639.mp3';
const dropletSound = new Audio(dropletSoundPath);
dropletSound.preload = 'auto'; // Load the sound ahead of time
dropletSound.volume = 0.5; // Set volume to 50%

// Edit these lines to customize the facts shown in the top message area.
const charityWaterFacts = [
  'charity: water\'s first location was a Northern Uganda refugee camp in 2006.',
  'charity: water has funded over 100,000 water projects around the world.',
  'Every charity: water project is tracked so supporters can see impact updates.',
  'Access to clean water helps children spend more time in school.',
  'Clean water closer to home can reduce hours spent walking to collect water.',
  'Reliable water access supports healthier families and stronger local economies.',
];
let currentFactIndex = 0;

// Tuning values for reveal mechanics.
const startingRevealRadius = 75;
const clickRevealRadius = 100;
const pumpChainRevealRadius = 150;
const canChainRevealRadius = 125;

// Per-level editable layouts used by scout mode.
const levelLayouts = {
  1: {
    icons: [
      {
        id: 'start-can',
        x: 100,
        y: 310,
        type: 'jerrycan',
        startsRevealed: true,
        isRevealed: true,
        chainRadius: 0,
      },
      {
        id: 'pump-1',
        x: 532,
        y: 337,
        type: 'pump',
        startsRevealed: false,
        isRevealed: false,
        chainRadius: pumpChainRevealRadius,
      },
      {
        id: 'bonus-can',
        x: 842,
        y: 381,
        type: 'jerrycan',
        startsRevealed: false,
        isRevealed: false,
        chainRadius: canChainRevealRadius,
      },
    ],
    townCenterGoal: {
      x: 977,
      y: 402,
    },
  },
  2: {
    // Starter positions for level 2. Scout mode can replace these quickly.
    icons: [
      {
        id: 'start-can',
        x: 172,
        y: 466,
        type: 'jerrycan',
        startsRevealed: true,
        isRevealed: true,
        chainRadius: 0,
      },
      {
        id: 'pump-1',
        x: 557,
        y: 408,
        type: 'pump',
        startsRevealed: false,
        isRevealed: false,
        chainRadius: pumpChainRevealRadius,
      },
      {
        id: 'bonus-can',
        x: 318,
        y: 271,
        type: 'jerrycan',
        startsRevealed: false,
        isRevealed: false,
        chainRadius: canChainRevealRadius,
      },
      {
        // Extra chain can near the pump to create a nicer uncover sequence.
        id: 'bonus-can-2',
        x: 660,
        y: 352,
        type: 'jerrycan',
        startsRevealed: false,
        isRevealed: false,
        chainRadius: canChainRevealRadius,
      },
    ],
    townCenterGoal: {
      x: 738,
      y: 148,
    },
  },
};

let gameIcons = [];
let townCenterGoal = { x: 0, y: 0 };
const revealedCircles = [];

// Scout mode placement state.
let scoutPlacementTarget = 'none';

// Small helper so repeated scout-mode checks read like plain English.
const isScoutModeActive = () => {
  return developerTools.enabled && game.scoutMode;
};

// -------------------------------
// Section: DOM Elements
// -------------------------------

// Game setup
const gameContainer = document.getElementById('game-area');
gameContainer.style.fontFamily = 'Arial, sans-serif';

// Grab UI elements created in HTML.
const infoDiv = document.getElementById('game-info');
const funFactDiv = document.getElementById('fun-fact');
const coordReadoutDiv = document.getElementById('coord-readout');
const mapField = document.getElementById('map-field');
const lastActionDiv = document.getElementById('last-action');
const endModalOverlay = document.getElementById('end-modal-overlay');
const endModalTitle = document.getElementById('end-modal-title');
const endModalMessage = document.getElementById('end-modal-message');
const resetLevelButton = document.getElementById('reset-level-btn');
const nextLevelButton = document.getElementById('next-level-btn');
const carryoverLevelButton = document.getElementById('carryover-level-btn');
const endModalLinks = document.getElementById('end-modal-links');
const tutorialModalOverlay = document.getElementById('tutorial-modal-overlay');
const tutorialModalTitle = document.getElementById('tutorial-modal-title');
const tutorialModalMessage = document.getElementById('tutorial-modal-message');
const tutorialModalSteps = document.getElementById('tutorial-modal-steps');
const tutorialTargetImage = document.getElementById('tutorial-target-image');
const tutorialTargetFallback = document.getElementById('tutorial-target-fallback');
const startMissionButton = document.getElementById('start-mission-btn');

if (
  !gameContainer ||
  !infoDiv ||
  !funFactDiv ||
  !coordReadoutDiv ||
  !mapField ||
  !lastActionDiv ||
  !endModalOverlay ||
  !endModalTitle ||
  !endModalMessage ||
  !resetLevelButton ||
  !nextLevelButton ||
  !carryoverLevelButton ||
  !endModalLinks ||
  !tutorialModalOverlay ||
  !tutorialModalTitle ||
  !tutorialModalMessage ||
  !tutorialModalSteps ||
  !tutorialTargetImage ||
  !tutorialTargetFallback ||
  !startMissionButton
) {
  throw new Error('Missing required game UI elements in index.html');
}

// Show fallback text if the tutorial target image file is missing.
tutorialTargetImage.addEventListener('error', () => {
  tutorialTargetImage.style.display = 'none';
  tutorialTargetFallback.classList.remove('hidden');
});

tutorialTargetImage.addEventListener('load', () => {
  tutorialTargetImage.style.display = 'block';
  tutorialTargetFallback.classList.add('hidden');
});

// Keep coordinate/scout tools hidden for normal player gameplay.
if (!developerTools.enabled) {
  coordReadoutDiv.style.display = 'none';
}

// -------------------------------
// Section: Render Helpers
// -------------------------------

// Build the fog layer every frame.
// We use an SVG mask where white keeps fog visible and black cuts holes in the fog.
// Each reveal circle becomes one black hole in this mask.
const setupMapLayer = () => {
  const existingFogLayers = mapField.querySelectorAll('.fog-layer');
  existingFogLayers.forEach((layer) => layer.remove());

  if (!game.showFog) {
    return;
  }

  const fogLayer = document.createElement('div');
  fogLayer.className = 'fog-layer';

  // Use an SVG mask so every revealed circle reliably cuts a hole in the fog.
  const mapWidth = mapField.clientWidth;
  const mapHeight = mapField.clientHeight;
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  const defs = document.createElementNS(svgNs, 'defs');
  const mask = document.createElementNS(svgNs, 'mask');
  const maskRect = document.createElementNS(svgNs, 'rect');
  const fogRect = document.createElementNS(svgNs, 'rect');

  svg.setAttribute('class', 'fog-svg');
  svg.setAttribute('viewBox', `0 0 ${mapWidth} ${mapHeight}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');

  mask.setAttribute('id', 'fog-cutout-mask');
  mask.setAttribute('maskUnits', 'userSpaceOnUse');
  mask.setAttribute('x', '0');
  mask.setAttribute('y', '0');
  mask.setAttribute('width', String(mapWidth));
  mask.setAttribute('height', String(mapHeight));

  maskRect.setAttribute('x', '0');
  maskRect.setAttribute('y', '0');
  maskRect.setAttribute('width', String(mapWidth));
  maskRect.setAttribute('height', String(mapHeight));
  maskRect.setAttribute('fill', 'white');
  mask.appendChild(maskRect);

  revealedCircles.forEach((circle) => {
    const hole = document.createElementNS(svgNs, 'circle');
    hole.setAttribute('cx', String(circle.x));
    hole.setAttribute('cy', String(circle.y));
    hole.setAttribute('r', String(circle.currentRadius || 0));
    hole.setAttribute('fill', 'black');
    mask.appendChild(hole);
  });

  defs.appendChild(mask);
  svg.appendChild(defs);

  fogRect.setAttribute('x', '0');
  fogRect.setAttribute('y', '0');
  fogRect.setAttribute('width', String(mapWidth));
  fogRect.setAttribute('height', String(mapHeight));
  fogRect.setAttribute('fill', '#6e747e');
  fogRect.setAttribute('mask', 'url(#fog-cutout-mask)');
  svg.appendChild(fogRect);

  fogLayer.appendChild(svg);

  mapField.appendChild(fogLayer);
};

// Optional debug/teaching helper.
// If showRevealRings is turned on, this draws outlines of reveal areas.
const renderRevealRings = () => {
  const existingRings = mapField.querySelectorAll('.reveal-ring');
  existingRings.forEach((ring) => ring.remove());

  if (!game.showFog || !game.showRevealRings) {
    return;
  }

  revealedCircles.forEach((circle) => {
    const currentDiameter = (circle.currentRadius || 0) * 2;
    const ring = document.createElement('div');
    ring.className = 'reveal-ring';
    ring.style.left = `${circle.x}px`;
    ring.style.top = `${circle.y}px`;
    ring.style.width = `${currentDiameter}px`;
    ring.style.height = `${currentDiameter}px`;
    mapField.appendChild(ring);
  });
};

// Rule check used by many systems.
// Returns true if a map point is inside any currently revealed area.
const isInsideRevealedArea = (x, y) => {
  return revealedCircles.some((circle) => {
    const dx = x - circle.x;
    const dy = y - circle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= (circle.currentRadius || 0);
  });
};

// Progresses animated reveal circles from radius 0 to full radius over time.
// This runs inside draw() so animation stays in sync with rendering.
const updateRevealAnimationState = () => {
  const now = performance.now();
  let hasActiveAnimations = false;

  // Ease timing so reveal starts with impact and settles smoothly.
  // Simple easing helper:
  // start fast enough to feel responsive, then settle smoothly.
  const easeInOutCubic = (progress) => {
    if (progress < 0.5) {
      return 4 * progress * progress * progress;
    }

    return 1 - Math.pow(-2 * progress + 2, 3) / 2;
  };

  revealedCircles.forEach((circle) => {
    if (!circle.revealStartedAt) {
      circle.currentRadius = circle.radius;
      return;
    }

    const elapsed = now - circle.revealStartedAt;
    const progress = Math.min(elapsed / circle.revealDurationMs, 1);
    const easedProgress = easeInOutCubic(progress);
    circle.currentRadius = circle.radius * easedProgress;

    if (progress >= 1) {
      delete circle.revealStartedAt;
      delete circle.revealDurationMs;
      circle.currentRadius = circle.radius;
      return;
    }

    hasActiveAnimations = true;
  });

  return hasActiveAnimations;
};

// Ensures only one requestAnimationFrame is queued at a time.
// Prevents stacking many animation loops accidentally.
const queueNextRevealFrame = () => {
  if (revealAnimationFrameId !== null) {
    return;
  }

  revealAnimationFrameId = requestAnimationFrame(() => {
    revealAnimationFrameId = null;
    draw();
  });
};

// -------------------------------
// Section: Game Rules + Data Helpers
// -------------------------------

// Win check helper for readability.
const isTownCenterRevealed = () => {
  return isInsideRevealedArea(townCenterGoal.x, townCenterGoal.y);
};

// Fallback symbol map if an icon image is missing.
const getIconSymbol = (type) => {
  if (type === 'jerrycan') {
    return '';
  }

  if (type === 'pump') {
    return '🚰';
  }

  if (type === 'village') {
    return '🏘️';
  }

  return '❓';
};

// Map each icon type to its image asset path.
const getIconImagePath = (type) => {
  if (type === 'jerrycan') {
    return 'img/water-can.png';
  }

  if (type === 'pump') {
    return 'img/waterpump.png';
  }

  return '';
};

// Factory for a reveal wave object.
// New circles begin at radius 0 and expand with animation.
const createAnimatedRevealCircle = (x, y, radius) => {
  return {
    x: Math.round(x),
    y: Math.round(y),
    diameter: radius * 2,
    radius,
    currentRadius: 0,
    revealStartedAt: performance.now(),
    revealDurationMs: revealAnimationDurationMs,
  };
};

const cloneIconData = (icon) => {
  return {
    id: icon.id,
    x: icon.x,
    y: icon.y,
    type: icon.type,
    startsRevealed: icon.startsRevealed,
    isRevealed: icon.isRevealed,
    chainRadius: icon.chainRadius,
  };
};

const getLevelLayout = (levelId) => {
  return levelLayouts[levelId] || levelLayouts[1];
};

const applyLevelLayout = (levelId) => {
  const layout = getLevelLayout(levelId);
  gameIcons = layout.icons.map((icon) => cloneIconData(icon));
  townCenterGoal = {
    x: layout.townCenterGoal.x,
    y: layout.townCenterGoal.y,
  };
};

const saveCurrentLayoutToLevel = (levelId) => {
  levelLayouts[levelId] = {
    icons: gameIcons.map((icon) => cloneIconData(icon)),
    townCenterGoal: {
      x: townCenterGoal.x,
      y: townCenterGoal.y,
    },
  };
};

const getScoutTargetLabel = (target) => {
  if (target === 'start-can') {
    return 'Start Jerrycan';
  }

  if (target === 'pump-1') {
    return 'Pump';
  }

  if (target === 'bonus-can') {
    return 'Bonus Jerrycan';
  }

  if (target === 'bonus-can-2') {
    return 'Bonus Jerrycan 2';
  }

  if (target === 'town-center') {
    return 'Town Center Goal';
  }

  return 'None';
};

const placeScoutTargetAt = (x, y) => {
  const roundedX = Math.round(x);
  const roundedY = Math.round(y);

  if (scoutPlacementTarget === 'town-center') {
    townCenterGoal.x = roundedX;
    townCenterGoal.y = roundedY;
    saveCurrentLayoutToLevel(game.currentLevel);
    return true;
  }

  if (scoutPlacementTarget === 'none') {
    return false;
  }

  const icon = gameIcons.find((entry) => entry.id === scoutPlacementTarget);
  if (!icon) {
    return false;
  }

  icon.x = roundedX;
  icon.y = roundedY;

  // Keep the opening reveal centered on the start jerrycan.
  if (scoutPlacementTarget === 'start-can') {
    resetRevealedCirclesToStart();
  }

  saveCurrentLayoutToLevel(game.currentLevel);
  return true;
};

const exportCurrentLevelLayout = () => {
  const exportData = {
    level: game.currentLevel,
    icons: gameIcons.map((icon) => ({
      id: icon.id,
      x: icon.x,
      y: icon.y,
      type: icon.type,
      startsRevealed: icon.startsRevealed,
      chainRadius: icon.chainRadius,
    })),
    townCenterGoal: {
      x: townCenterGoal.x,
      y: townCenterGoal.y,
    },
  };

  const pretty = JSON.stringify(exportData, null, 2);
  console.log('Scout Export -> copy these coordinates into levelLayouts if needed:\n', pretty);
  return pretty;
};

// Resets icons to level-start visibility (used on load/reset).
const resetGameIcons = () => {
  gameIcons.forEach((icon) => {
    icon.isRevealed = icon.startsRevealed;
  });
};

// Chain reaction mechanic:
// if a hidden asset is now inside revealed fog holes, reveal that asset and
// spawn its own reveal circle (pump/can bonuses).
const triggerChainReveals = () => {
  let chainTriggered = false;

  gameIcons.forEach((icon) => {
    if (icon.isRevealed) {
      return;
    }

    if (!isInsideRevealedArea(icon.x, icon.y)) {
      return;
    }

    icon.isRevealed = true;

    if (icon.chainRadius > 0) {
      revealedCircles.push(
        createAnimatedRevealCircle(icon.x, icon.y, icon.chainRadius)
      );
      chainTriggered = true;
    }
  });

  return chainTriggered;
};

// Draw currently visible icons.
// Icons must be flagged revealed AND be inside visible map space.
const renderGameIcons = () => {
  const existingIcons = mapField.querySelectorAll('.game-icon');
  existingIcons.forEach((icon) => icon.remove());

  gameIcons.forEach((iconData) => {
    if (!iconData.isRevealed) {
      return;
    }

    if (game.showFog && !isInsideRevealedArea(iconData.x, iconData.y)) {
      return;
    }

    const iconImagePath = getIconImagePath(iconData.type);

    if (iconImagePath) {
      const iconElement = document.createElement('img');
      iconElement.className = 'game-icon';
      iconElement.classList.add(`icon-${iconData.type}`);
      iconElement.src = iconImagePath;
      iconElement.alt = iconData.type;
      iconElement.style.left = `${iconData.x}px`;
      iconElement.style.top = `${iconData.y}px`;
      mapField.appendChild(iconElement);
      return;
    }

    const iconElement = document.createElement('span');
    iconElement.className = 'game-icon';
    iconElement.textContent = getIconSymbol(iconData.type);
    iconElement.style.left = `${iconData.x}px`;
    iconElement.style.top = `${iconData.y}px`;
    iconElement.setAttribute('aria-label', iconData.type);
    mapField.appendChild(iconElement);
  });
};

// Draw scout pins for coordinate gathering sessions.
const renderScoutPoints = () => {
  const existingPins = mapField.querySelectorAll('.scout-pin');
  existingPins.forEach((pin) => pin.remove());

  if (!isScoutModeActive()) {
    return;
  }

  scoutPoints.forEach((point, index) => {
    const pin = document.createElement('span');
    pin.className = 'scout-pin';
    pin.style.left = `${point.x}px`;
    pin.style.top = `${point.y}px`;
    pin.textContent = String(index + 1);
    pin.setAttribute('aria-label', `Scout point ${index + 1}`);
    mapField.appendChild(pin);
  });
};

// Shows the current win location while scouting.
const renderScoutGoalMarker = () => {
  const existingMarker = mapField.querySelector('.scout-goal-marker');
  if (existingMarker) {
    existingMarker.remove();
  }

  if (!isScoutModeActive()) {
    return;
  }

  const marker = document.createElement('span');
  marker.className = 'scout-goal-marker';
  marker.style.left = `${townCenterGoal.x}px`;
  marker.style.top = `${townCenterGoal.y}px`;
  marker.textContent = '🎯';
  marker.setAttribute('aria-label', 'Town center goal marker');
  mapField.appendChild(marker);
};

// Main render loop.
// 1) advance animations
// 2) resolve chain reactions
// 3) draw fog + icons
// 4) evaluate win/lose
const draw = () => {
  const hasActiveAnimations = updateRevealAnimationState();
  const chainTriggered = triggerChainReveals();

  // DOM equivalent of canvas destination-out: each revealed circle cuts a hole in fog.
  setupMapLayer();
  renderRevealRings();
  renderGameIcons();
  renderScoutPoints();
  renderScoutGoalMarker();

  if (game.gameActive && isTownCenterRevealed()) {
    endGame(true);
    return;
  }

  if (game.gameActive && game.drips <= 0 && !hasActiveAnimations && !chainTriggered) {
    endGame(false);
    return;
  }

  if (hasActiveAnimations || chainTriggered) {
    queueNextRevealFrame();
  }
};

// -------------------------------
// Section: UI Messaging + Modals
// -------------------------------

const showEndModal = (title, message) => {
  console.log('showEndModal called');
  // NEW FEATURE: Ensure tutorial modal is hidden before showing end modal.
  // This prevents the higher z-index tutorial from blocking the end modal.
  hideTutorialModal();
  endModalTitle.textContent = title;
  endModalMessage.textContent = message;
  console.log('Before removing hidden:', endModalOverlay.className);
  // Remove the 'hidden' class to make the modal visible.
  endModalOverlay.classList.remove('hidden');
  console.log('After removing hidden:', endModalOverlay.className);
};

const hideEndModal = () => {
  // Hide the end modal and reset UI elements for the next level.
  // Clears the modal, links, and carryover button so they're ready for the next round.
  endModalOverlay.classList.add('hidden');
  endModalLinks.classList.add('hidden');
  carryoverLevelButton.classList.add('hidden');
  nextLevelButton.textContent =
    game.currentLevel >= levels.length ? 'Play Level 1 Again' : 'Next Level (Reset Drops)';
};

const playLevelStartMusic = () => {
  // NEW FEATURE: Smart music player for looping background audio.
  // Check if music is already playing (not paused).
  // If it IS playing, return early to avoid restarting it.
  // This lets the music continue smoothly when the player advances between levels.
  if (!levelStartAudio.paused) {
    return;
  }

  // If music isn't playing, start it now.
  levelStartAudio.play().catch(() => {
    // Ignore autoplay/missing-file errors to keep gameplay smooth.
  });
};

// Tutorial shown at level start (once per page session).
const showTutorialModal = (level) => {
  tutorialModalTitle.textContent = `Goal: Find the Town Center to connect it to clean water.`;
  tutorialModalMessage.textContent = 'Follow these steps to complete your mission:';
  tutorialModalSteps.innerHTML = `
    <li><span class="tutorial-step-icon">1</span><span class="tutorial-step-text">Study the image so you know the town center target.</span></li>
    <li><span class="tutorial-step-icon">2</span><span class="tutorial-step-text">Click inside revealed circles. Each click uses 1 drops.</span></li>
    <li><span class="tutorial-step-icon">3</span><span class="tutorial-step-text">Find pumps and jerrycans to reveal extra map space.</span></li>
    <li><span class="tutorial-step-icon">4</span><span class="tutorial-step-text">Keep expanding fog holes until the town center appears.</span></li>
    <li><span class="tutorial-step-icon">5</span><span class="tutorial-step-text">Finish with more drops left to earn a higher score.</span></li>
  `;
  tutorialModalOverlay.classList.remove('hidden');
  tutorialShownThisSession = true;
};

const hideTutorialModal = () => {
  tutorialModalOverlay.classList.add('hidden');
};

// Rotates through the fact list one entry per call.
// Modulo (%) wraps back to the first fact after the last one.
const showNextCharityFact = () => {
  if (charityWaterFacts.length === 0) {
    return;
  }

  funFactDiv.textContent = `Fun Fact: ${charityWaterFacts[currentFactIndex]}`;
  currentFactIndex = (currentFactIndex + 1) % charityWaterFacts.length;
};

const getCurrentLevelData = () => {
  return levels.find((level) => level.id === game.currentLevel) || levels[0];
};

// Updates the map background image for each level.
// If no image is defined, we keep the existing CSS default.
const applyLevelTileset = (level) => {
  if (!level || !level.tilesetImage) {
    mapField.style.removeProperty('--tileset-image');
    mapField.style.removeProperty('--tileset-fit');
    return;
  }

  mapField.style.setProperty('--tileset-image', `url("${level.tilesetImage}")`);
  mapField.style.setProperty('--tileset-fit', level.tilesetFit || 'cover');
};

// Rebuilds the initial revealed circle around the starting jerrycan.
const resetRevealedCirclesToStart = () => {
  revealedCircles.length = 0;

  const startJerryCan = gameIcons.find((icon) => icon.id === 'start-can');

  if (startJerryCan) {
    revealedCircles.push({
      x: startJerryCan.x,
      y: startJerryCan.y,
      diameter: startingRevealRadius * 2,
      radius: startingRevealRadius,
      currentRadius: startingRevealRadius,
    });
  }
};

// Stops any in-flight animation frame when resetting/transitioning levels.
const clearRoundVisuals = () => {
  if (revealAnimationFrameId !== null) {
    cancelAnimationFrame(revealAnimationFrameId);
    revealAnimationFrameId = null;
  }
};

// -------------------------------
// Section: Level Flow
// -------------------------------

// Level initializer:
// resets drips/visual state, redraws map, then shows opening UI text.
// Score is cumulative and is only reset when starting a brand-new run.
const loadLevel = (levelId, options = {}) => {
  const level = levels.find((entry) => entry.id === levelId);

  if (!level) {
    return;
  }

  game.currentLevel = level.id;
  game.drips = Number.isInteger(options.startDrips) ? options.startDrips : 20;
  game.showFog = !isScoutModeActive();
  game.gameActive = true;
  applyLevelLayout(level.id);
  applyLevelTileset(level);

  scoutPoints.length = 0;
  currentFactIndex = 0;
  resetGameIcons();
  resetRevealedCirclesToStart();
  clearRoundVisuals();
  hideEndModal();
  hideTutorialModal();
  draw();
  updateDisplay();
  onMapLeave();

  if (level.isPlaceholder) {
    funFactDiv.textContent = 'Fun Fact: More facts for this level will be added soon.';
    lastActionDiv.textContent = `Level ${level.id} (${level.name}) is a placeholder. Core logic is active while assets are in progress.`;
    return;
  }

  if (isScoutModeActive()) {
    funFactDiv.textContent = 'Fun Fact: Scout mode helps you place game items while designing levels.';
    lastActionDiv.textContent =
      'Scout mode is active. Keys: 1 Start Can, 2 Pump, 3 Bonus Can, 4 Town Goal, 5 Bonus Can 2, 0 Pointer Only, E Export Layout.';
    return;
  }

  showNextCharityFact();

  // Show tutorial only once when the page is first loaded.
  if (!tutorialShownThisSession) {
    showTutorialModal(level);
  }
};

// Reset button: Reloads the current level with fresh drops.
resetLevelButton.addEventListener('click', () => {
  // Clear the carryover flag so we start with normal 20 drops.
  game.usedCarryoverDrops = false;
  // Reload the current level completely.
  loadLevel(game.currentLevel);
});

// "Next Level (Reset to 20 Drops)" button: Standard difficulty progression.
// This button appears after Level 1 and moves to Level 2 with fresh drops (5 points per drop).
nextLevelButton.addEventListener('click', () => {
  // Standard next level button: always reset drops to 20 for standard difficulty.
  const shouldResetDrops = true;
  const nextLevelId = game.currentLevel + 1;

  if (nextLevelId > levels.length) {
    // If there are no more levels, reset the game and go back to Level 1.
    game.score = 0;
    lastActionDiv.textContent = 'No more levels yet. Returning to Level 1.';
    loadLevel(1);
    playLevelStartMusic();
    return;
  }

  // Clear carryover flag and load the next level with default 20 drops.
  game.usedCarryoverDrops = false;
  const startingDrips = shouldResetDrops ? 20 : game.drips;
  loadLevel(nextLevelId, { startDrips: startingDrips });
  playLevelStartMusic();
});

carryoverLevelButton.addEventListener('click', () => {
  // NEW FEATURE: "Use Leftover Drops" button handler.
  // When clicked, this button carries over the player's remaining drops to the next level.
  // It also sets usedCarryoverDrops = true so the scoring system knows to apply 20 points/drop.
  const nextLevelId = game.currentLevel + 1;

  if (nextLevelId > levels.length) {
    game.score = 0;
    game.usedCarryoverDrops = false;
    lastActionDiv.textContent = 'No more levels yet. Returning to Level 1.';
    loadLevel(1);
    playLevelStartMusic();
    return;
  }

  // Mark that we're using the harder difficulty mode.
  game.usedCarryoverDrops = true;
  // Load the next level, passing the current drop count as the starting amount.
  loadLevel(nextLevelId, { startDrips: game.drips });
  playLevelStartMusic();
});

startMissionButton.addEventListener('click', () => {
  hideTutorialModal();
  playLevelStartMusic();
});

// -------------------------------
// Section: Score + End States
// -------------------------------

// Refreshes the HUD line at the top of the game.
const updateDisplay = () => {
  const currentLevel = getCurrentLevelData();
  infoDiv.textContent = `Level ${currentLevel.id}: ${currentLevel.name} | 💧 Drops Remaining: ${game.drips} | Score: ${game.score}`;
};

// Handles win/lose transitions and end modal messaging.
const endGame = (won) => {
  console.log('endGame called with won =', won);
  game.gameActive = false;
  let isNewHighScore = false;

  if (won) {
    // NEW FEATURE: Difficulty-based scoring.
    // Level 2 with carryover drops is HARDER, so each drop is worth MORE points (20 instead of 5).
    // This rewards players who choose the challenge!
    // Score calculation: 100 base points + (drops left × points per drop)
    const dropPointValue = game.currentLevel === 2 && game.usedCarryoverDrops ? 20 : 5;
    const levelScore = 100 + game.drips * dropPointValue;
    game.score += levelScore;

    // NEW FEATURE: Session high score tracking.
    // Compare current score to the best score so far this session.
    // If it's the new best, update sessionHighScore and set the celebration flag.
    isNewHighScore = game.score > sessionHighScore;
    if (isNewHighScore) {
      sessionHighScore = game.score;
    }

    // Reveal the full map when the town center is found.
    game.showFog = false;

    // Show all assets when the level is complete.
    gameIcons.forEach((icon) => {
      icon.isRevealed = true;
    });

    draw();
  }

  updateDisplay();

  if (won) {
    console.log('Showing end modal for level', game.currentLevel);
    // NEW FEATURE: Two-button difficulty choice after Level 1.
    // After completing Level 1, show the carryover button so players can choose:
    // - "Next Level (Reset to 20 Drops)" - easier, but 5 points per drop
    // - "Next Level (Use Leftover Drops)" - harder, but 20 points per drop
    const canChooseCarryover = game.currentLevel === 1;
    carryoverLevelButton.classList.toggle('hidden', !canChooseCarryover);
    nextLevelButton.textContent = canChooseCarryover
      ? 'Next Level (Reset to 20 Drops)'
      : game.currentLevel >= levels.length
      ? 'Play Level 1 Again'
      : 'Next Level (Reset Drops)';
    endModalLinks.classList.remove('hidden');
    // NEW FEATURE: Display celebration message if they beat their best score.
    const scoreMessage = isNewHighScore
      ? `You found the town center. 🎉 NEW HIGH SCORE! Total score: ${game.score}`
      : `You found the town center. Level score added. Total score: ${game.score}`;
    console.log('Calling showEndModal with message:', scoreMessage);
    showEndModal('Mission Complete!', scoreMessage);
    console.log('Modal overlay hidden class:', endModalOverlay.classList.contains('hidden'));
    lastActionDiv.textContent = 'Great work! Choose what to do next.';
    return;
  }

  endModalLinks.classList.add('hidden');
  showEndModal('Out of Drips', 'You ran out of drips. Try the level again.');
  lastActionDiv.textContent = 'Choose an option below to continue.';
};

// -------------------------------
// Section: Click + Input Handlers
// -------------------------------

// Converts raw browser click coordinates to map-local pixel and tile coordinates.
const getMapClickData = (event) => {
  const rect = mapField.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  return {
    x,
    y,
    tileX: Math.floor(x / game.tileSize),
    tileY: Math.floor(y / game.tileSize),
  };
};

// Scout mode click behavior: store coordinate and show helper readout.
const handleScoutClick = (x, y, tileX, tileY) => {
  const point = { x: Math.round(x), y: Math.round(y) };
  scoutPoints.push(point);

  const didPlaceTarget = placeScoutTargetAt(point.x, point.y);
  const targetLabel = getScoutTargetLabel(scoutPlacementTarget);
  draw();
  coordReadoutDiv.textContent = `Scout Mode: target ${targetLabel} | cursor (${point.x}, ${point.y}) | Last click #${scoutPoints.length}`;

  if (didPlaceTarget) {
    lastActionDiv.textContent = `Placed ${targetLabel} at (${point.x}, ${point.y}) on tile (${tileX}, ${tileY}).`;
    return;
  }

  lastActionDiv.textContent = `Scout point #${scoutPoints.length}: (${point.x}, ${point.y}) on tile (${tileX}, ${tileY}).`;
};

// Normal gameplay click behavior: spend one drop and create a reveal wave.
const handleRevealClick = (x, y) => {
  game.drips -= 1;
  revealedCircles.push(createAnimatedRevealCircle(x, y, clickRevealRadius));
  // NEW FEATURE: Play water droplet sound on click.
  // Rewind to start and play the sound effect for immediate audio feedback.
  dropletSound.currentTime = 0;
  dropletSound.play().catch(() => {
    // Silently ignore if sound fails to play (e.g., autoplay restrictions).
  });
};

// Central click handler for gameplay and scout mode.
const onMapClick = (event) => {
  if (!game.gameActive) {
    return;
  }

  const { x, y, tileX, tileY } = getMapClickData(event);

  // Scout mode ignores game rules so you can pick target coordinates anywhere.
  if (isScoutModeActive()) {
    handleScoutClick(x, y, tileX, tileY);
    return;
  }

  // Ignore clicks outside currently revealed circles.
  if (!isInsideRevealedArea(x, y)) {
    lastActionDiv.textContent = 'That area is still hidden by fog. Click inside a revealed circle.';
    return;
  }

  // Prevent spending extra drips while the round is finishing.
  if (game.drips <= 0) {
    lastActionDiv.textContent = 'No drips left. Wait for the round result.';
    return;
  }

  // Valid reveal click: spend one drip and start a reveal wave.
  handleRevealClick(x, y);

  showNextCharityFact();

  // Fire a custom event so future game logic can listen for map clicks.
  const mapClickEvent = new CustomEvent('mapTileClicked', {
    detail: {
      x: Math.round(x),
      y: Math.round(y),
      tileX,
      tileY,
    },
  });
  mapField.dispatchEvent(mapClickEvent);

  draw();
  updateDisplay();
};

// Updates live cursor coordinates (developer/scout mode only).
const onMapMove = (event) => {
  if (!developerTools.enabled) {
    return;
  }

  const rect = mapField.getBoundingClientRect();
  const x = Math.round(event.clientX - rect.left);
  const y = Math.round(event.clientY - rect.top);
  const targetLabel = getScoutTargetLabel(scoutPlacementTarget);
  coordReadoutDiv.textContent = game.scoutMode
    ? `Scout Mode: target ${targetLabel} | cursor (${x}, ${y})`
    : `Cursor (${x}, ${y})`;
};

// Reset the coordinate helper message when cursor leaves the map.
const onMapLeave = () => {
  if (!developerTools.enabled) {
    return;
  }

  const targetLabel = getScoutTargetLabel(scoutPlacementTarget);
  coordReadoutDiv.textContent = game.scoutMode
    ? `Scout Mode: target ${targetLabel} | move over the map to see coordinates.`
    : 'Move over the map to see coordinates.';
};

// Scout keyboard shortcuts:
// 1 start-can, 2 pump, 3 bonus-can, 4 town-center, 0 coordinate-only, E export.
const onDocumentKeyDown = (event) => {
  if (!isScoutModeActive()) {
    return;
  }

  const key = event.key.toLowerCase();

  if (key === '1') {
    scoutPlacementTarget = 'start-can';
  } else if (key === '2') {
    scoutPlacementTarget = 'pump-1';
  } else if (key === '3') {
    scoutPlacementTarget = 'bonus-can';
  } else if (key === '4') {
    scoutPlacementTarget = 'town-center';
  } else if (key === '5') {
    scoutPlacementTarget = 'bonus-can-2';
  } else if (key === '0') {
    scoutPlacementTarget = 'none';
  } else if (key === 'e') {
    exportCurrentLevelLayout();
    lastActionDiv.textContent = 'Layout exported to console. Copy the JSON from DevTools console output.';
    coordReadoutDiv.textContent = `Scout Mode: target ${getScoutTargetLabel(scoutPlacementTarget)} | export ready`;
    return;
  } else if (key === ']') {
    const nextLevelId = game.currentLevel + 1 > levels.length ? 1 : game.currentLevel + 1;
    loadLevel(nextLevelId);
    lastActionDiv.textContent = `Scout mode switched to Level ${nextLevelId}.`;
    return;
  } else if (key === '[') {
    const previousLevelId = game.currentLevel - 1 < 1 ? levels.length : game.currentLevel - 1;
    loadLevel(previousLevelId);
    lastActionDiv.textContent = `Scout mode switched to Level ${previousLevelId}.`;
    return;
  } else {
    return;
  }

  const selectedTargetLabel = getScoutTargetLabel(scoutPlacementTarget);
  lastActionDiv.textContent = `Scout target set to ${selectedTargetLabel}. Click the map to place it.`;
  coordReadoutDiv.textContent = `Scout Mode: target ${selectedTargetLabel} | move over the map to see coordinates.`;
};

// Main click listener for the map field.
mapField.addEventListener('click', onMapClick);
mapField.addEventListener('mousemove', onMapMove);
mapField.addEventListener('mouseleave', onMapLeave);
document.addEventListener('keydown', onDocumentKeyDown);

// Example listener showing how you can hook game logic into map clicks later.
mapField.addEventListener('mapTileClicked', (event) => {
  const { tileX, tileY } = event.detail;
  console.log(`mapTileClicked -> tile (${tileX}, ${tileY})`);
});

// Initialize display
game.scoutMode = developerTools.enabled && developerTools.scoutMode;
const initialLevelId = hasRequestedStartLevel
  ? Math.min(requestedStartLevel, levels.length)
  : 1;
loadLevel(initialLevelId);