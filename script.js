// Charity Water Game - click inside the map field to interact with the tileset.

// Game state
const game = {
  drips: 20, // Starting drips (clicks)
  score: 0,
  currentLevel: 1,
  maxReveals: 6,
  tileSize: 48,
  showFog: true,
  showRevealRings: false,
  scoutMode: false,
  gameActive: true,
};

// Turn this on only when placing future assets on the tileset.
const developerTools = {
  enabled: false,
  scoutMode: false,
};

// Level list includes placeholders so future content can be plugged in easily.
const levels = [
  {
    id: 1,
    name: 'Northern Uganda',
    isPlaceholder: false,
  },
  {
    id: 2,
    name: 'Pump Network',
    isPlaceholder: true,
  },
  {
    id: 3,
    name: 'Water Route',
    isPlaceholder: true,
  },
];

const scoutPoints = [];
let tutorialShownThisSession = false;
const revealAnimationDurationMs = 850;
let revealAnimationFrameId = null;

// Edit these lines to customize the facts shown in the bottom message area.
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

// Interactive map objects. Each icon has a position, a type, and reveal state.
const gameIcons = [
  {
    x: 100,
    y: 310,
    type: 'jerrycan',
    startsRevealed: true,
    isRevealed: true,
    chainRadius: 0,
  },
  {
    x: 532,
    y: 337,
    type: 'pump',
    startsRevealed: false,
    isRevealed: false,
    chainRadius: pumpChainRevealRadius,
  },
  {
    x: 842,
    y: 381,
    type: 'jerrycan',
    startsRevealed: false,
    isRevealed: false,
    chainRadius: canChainRevealRadius,
  },
];

// Keep track of revealed circular areas for fog-of-war logic.
const firstJerryCan = gameIcons.find((icon) => icon.type === 'jerrycan');
const revealedCircles = firstJerryCan
  ? [
      {
        x: firstJerryCan.x,
        y: firstJerryCan.y,
        diameter: startingRevealRadius * 2,
        radius: startingRevealRadius,
        currentRadius: startingRevealRadius,
      },
    ]
  : [];

// Hidden town center goal location on the tileset (no visible icon required).
const townCenterGoal = {
  x: 977,
  y: 402,
};

// Game setup
const gameContainer = document.getElementById('game-area');
gameContainer.style.fontFamily = 'Arial, sans-serif';

// Grab UI elements created in HTML.
const infoDiv = document.getElementById('game-info');
const coordReadoutDiv = document.getElementById('coord-readout');
const mapField = document.getElementById('map-field');
const lastActionDiv = document.getElementById('last-action');
const endModalOverlay = document.getElementById('end-modal-overlay');
const endModalTitle = document.getElementById('end-modal-title');
const endModalMessage = document.getElementById('end-modal-message');
const resetLevelButton = document.getElementById('reset-level-btn');
const nextLevelButton = document.getElementById('next-level-btn');
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
  !coordReadoutDiv ||
  !mapField ||
  !lastActionDiv ||
  !endModalOverlay ||
  !endModalTitle ||
  !endModalMessage ||
  !resetLevelButton ||
  !nextLevelButton ||
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

// Add a fog overlay above the map so the tileset is hidden until reveal logic is added.
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

// Draw circle outlines so players can clearly see revealed boundaries in the fog.
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

// Returns true when a point is inside at least one revealed circle.
const isInsideRevealedArea = (x, y) => {
  return revealedCircles.some((circle) => {
    const dx = x - circle.x;
    const dy = y - circle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= (circle.currentRadius || 0);
  });
};

const updateRevealAnimationState = () => {
  const now = performance.now();
  let hasActiveAnimations = false;

  // Ease timing so reveal starts with impact and settles smoothly.
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

const queueNextRevealFrame = () => {
  if (revealAnimationFrameId !== null) {
    return;
  }

  revealAnimationFrameId = requestAnimationFrame(() => {
    revealAnimationFrameId = null;
    draw();
  });
};

const isTownCenterRevealed = () => {
  return isInsideRevealedArea(townCenterGoal.x, townCenterGoal.y);
};

// Convert icon types into simple emoji so beginners can see each object quickly.
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

// Map icon types to image files when available.
const getIconImagePath = (type) => {
  if (type === 'jerrycan') {
    return 'img/water-can.png';
  }

  if (type === 'pump') {
    return 'img/waterpump.png';
  }

  return '';
};

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

const resetGameIcons = () => {
  gameIcons.forEach((icon) => {
    icon.isRevealed = icon.startsRevealed;
  });
};

// Uncovering a hidden asset triggers its own reveal wave for chain reactions.
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

// Draw all currently revealed icons on the map layer (below fog).
const renderGameIcons = () => {
  const existingIcons = mapField.querySelectorAll('.game-icon');
  existingIcons.forEach((icon) => icon.remove());

  gameIcons.forEach((iconData) => {
    if (!iconData.isRevealed) {
      return;
    }

    if (!isInsideRevealedArea(iconData.x, iconData.y)) {
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

// Draw temporary scout pins so players can test possible goal spots.
const renderScoutPoints = () => {
  const existingPins = mapField.querySelectorAll('.scout-pin');
  existingPins.forEach((pin) => pin.remove());

  if (!developerTools.enabled || !game.scoutMode) {
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

// Main draw pass: process fog first, then draw visible icons.
const draw = () => {
  const hasActiveAnimations = updateRevealAnimationState();
  const chainTriggered = triggerChainReveals();

  // DOM equivalent of canvas destination-out: each revealed circle cuts a hole in fog.
  setupMapLayer();
  renderRevealRings();
  renderGameIcons();
  renderScoutPoints();

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

const showEndModal = (title, message) => {
  endModalTitle.textContent = title;
  endModalMessage.textContent = message;
  endModalOverlay.classList.remove('hidden');
};

const hideEndModal = () => {
  endModalOverlay.classList.add('hidden');
};

const showTutorialModal = (level) => {
  tutorialModalTitle.textContent = `Goal: Find the Town Center to connect it to clean water.`;
  tutorialModalMessage.textContent = 'Follow these steps to complete your mission:';
  tutorialModalSteps.innerHTML = `
    <li><span class="tutorial-step-icon">1</span><span class="tutorial-step-text">Study the image so you know the town center target.</span></li>
    <li><span class="tutorial-step-icon">2</span><span class="tutorial-step-text">Click inside revealed circles. Each click uses 1 drip.</span></li>
    <li><span class="tutorial-step-icon">3</span><span class="tutorial-step-text">Find pumps and jerrycans to reveal extra map space.</span></li>
    <li><span class="tutorial-step-icon">4</span><span class="tutorial-step-text">Keep expanding fog holes until the town center appears.</span></li>
    <li><span class="tutorial-step-icon">5</span><span class="tutorial-step-text">Finish with more drips left to earn a higher score.</span></li>
  `;
  tutorialModalOverlay.classList.remove('hidden');
  tutorialShownThisSession = true;
};

const hideTutorialModal = () => {
  tutorialModalOverlay.classList.add('hidden');
};

const showNextCharityFact = () => {
  if (charityWaterFacts.length === 0) {
    return;
  }

  lastActionDiv.innerHTML = `Fun Fact<br>${charityWaterFacts[currentFactIndex]}`;
  currentFactIndex = (currentFactIndex + 1) % charityWaterFacts.length;
};

const getCurrentLevelData = () => {
  return levels.find((level) => level.id === game.currentLevel) || levels[0];
};

const resetRevealedCirclesToStart = () => {
  revealedCircles.length = 0;

  if (firstJerryCan) {
    revealedCircles.push({
      x: firstJerryCan.x,
      y: firstJerryCan.y,
      diameter: startingRevealRadius * 2,
      radius: startingRevealRadius,
      currentRadius: startingRevealRadius,
    });
  }
};

const clearRoundVisuals = () => {
  if (revealAnimationFrameId !== null) {
    cancelAnimationFrame(revealAnimationFrameId);
    revealAnimationFrameId = null;
  }
};

const loadLevel = (levelId) => {
  const level = levels.find((entry) => entry.id === levelId);

  if (!level) {
    return;
  }

  game.currentLevel = level.id;
  game.drips = 20;
  game.score = 0;
  game.showFog = true;
  game.gameActive = true;

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
    lastActionDiv.textContent = `Level ${level.id} (${level.name}) is a placeholder. Core logic is active while assets are in progress.`;
    return;
  }

  if (developerTools.enabled && game.scoutMode) {
    lastActionDiv.textContent =
      'Scout mode is active. Click the map to collect asset coordinates.';
    return;
  }

  showNextCharityFact();

  // Show tutorial only once when the page is first loaded.
  if (!tutorialShownThisSession) {
    showTutorialModal(level);
  }
};

// Reset button refreshes the page so all game state starts fresh.
resetLevelButton.addEventListener('click', () => {
  loadLevel(game.currentLevel);
});

// Move to the next level slot (placeholder levels are supported).
nextLevelButton.addEventListener('click', () => {
  const nextLevelId = game.currentLevel + 1;

  if (nextLevelId > levels.length) {
    lastActionDiv.textContent = 'No more levels yet. Returning to Level 1.';
    loadLevel(1);
    return;
  }

  loadLevel(nextLevelId);
});

startMissionButton.addEventListener('click', () => {
  hideTutorialModal();
});

// Update the game display
const updateDisplay = () => {
  const currentLevel = getCurrentLevelData();
  infoDiv.textContent = `Level ${currentLevel.id}: ${currentLevel.name} | 💧 Drops Remaining: ${game.drips} | Score: ${game.score}`;
};

// End game function
const endGame = (won) => {
  game.gameActive = false;

  if (won) {
    // Score rules: 100 for finding the town center + 5 for each drip left.
    game.score = 100 + game.drips * 5;

    // Reveal the full map when the town center is found.
    game.showFog = false;
    draw();
  }

  updateDisplay();

  if (won) {
    showEndModal(
      'Mission Complete!',
      `You found the town center. Final score: ${game.score}`
    );
    lastActionDiv.textContent = 'Great work! Choose what to do next.';
    return;
  }

  showEndModal('Out of Drips', 'You ran out of drips. Try the level again.');
  lastActionDiv.textContent = 'Choose an option below to continue.';
};

// Handle map click interactions
const onMapClick = (event) => {
  if (!game.gameActive) {
    return;
  }

  const rect = mapField.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const tileX = Math.floor(x / game.tileSize);
  const tileY = Math.floor(y / game.tileSize);

  // Scout mode ignores game rules so you can pick target coordinates anywhere.
  if (developerTools.enabled && game.scoutMode) {
    const point = { x: Math.round(x), y: Math.round(y) };
    scoutPoints.push(point);
    draw();
    coordReadoutDiv.textContent = `Scout Mode: cursor (${point.x}, ${point.y}) | Last click #${scoutPoints.length} at (${point.x}, ${point.y})`;
    lastActionDiv.textContent = `Scout point #${scoutPoints.length}: (${point.x}, ${point.y}) on tile (${tileX}, ${tileY}).`;
    return;
  }

  // Ignore clicks outside currently revealed circles.
  if (!isInsideRevealedArea(x, y)) {
    lastActionDiv.textContent = 'That area is still hidden by fog. Click inside a revealed circle.';
    return;
  }

  // Valid reveal click: spend one drip and start a reveal wave.
  game.drips -= 1;
  revealedCircles.push(createAnimatedRevealCircle(x, y, clickRevealRadius));

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

// Update live coordinate readout while moving over the map.
const onMapMove = (event) => {
  if (!developerTools.enabled) {
    return;
  }

  const rect = mapField.getBoundingClientRect();
  const x = Math.round(event.clientX - rect.left);
  const y = Math.round(event.clientY - rect.top);
  coordReadoutDiv.textContent = game.scoutMode
    ? `Scout Mode: cursor (${x}, ${y})`
    : `Cursor (${x}, ${y})`;
};

const onMapLeave = () => {
  if (!developerTools.enabled) {
    return;
  }

  coordReadoutDiv.textContent = game.scoutMode
    ? 'Scout Mode: move over the map to see coordinates.'
    : 'Move over the map to see coordinates.';
};

// Main click listener for the map field.
mapField.addEventListener('click', onMapClick);
mapField.addEventListener('mousemove', onMapMove);
mapField.addEventListener('mouseleave', onMapLeave);

// Example listener showing how you can hook game logic into map clicks later.
mapField.addEventListener('mapTileClicked', (event) => {
  const { tileX, tileY } = event.detail;
  console.log(`mapTileClicked -> tile (${tileX}, ${tileY})`);
});

// Initialize display
game.scoutMode = developerTools.enabled && developerTools.scoutMode;
loadLevel(1);