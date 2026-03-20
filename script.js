// Charity Water Game - click inside the map field to interact with the tileset.

// Game state
const game = {
  drips: 20, // Starting drips (clicks)
  maxReveals: 6,
  tileSize: 48,
  gameActive: true,
  revealedAreas: new Set(), // Track clicked map tiles (tileX,tileY)
};

// Game setup
const gameContainer = document.getElementById('game-area');
gameContainer.style.fontFamily = 'Arial, sans-serif';

// Display game info
const infoDiv = document.createElement('div');
infoDiv.id = 'game-info';
gameContainer.appendChild(infoDiv);

// Create map field where the tileset image lives
const mapField = document.createElement('div');
mapField.id = 'map-field';
mapField.setAttribute('role', 'button');
mapField.setAttribute('aria-label', 'Interactive game map. Click to reveal tiles.');
gameContainer.appendChild(mapField);

// Show the most recent click result
const lastActionDiv = document.createElement('div');
lastActionDiv.id = 'last-action';
gameContainer.appendChild(lastActionDiv);

// Update the game display
const updateDisplay = () => {
  infoDiv.textContent = `Drips Remaining: ${game.drips} | Tiles Revealed: ${game.revealedAreas.size}/${game.maxReveals}`;
};

// Place a visible marker where the player clicked
const placeDropMarker = (x, y) => {
  const marker = document.createElement('span');
  marker.className = 'drop-marker';
  marker.textContent = '💧';
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  mapField.appendChild(marker);
};

// End game function
const endGame = (won) => {
  game.gameActive = false;
  lastActionDiv.textContent = won
    ? '🎉 Great work! You explored enough tiles to help the village.'
    : '💧 Out of drips! Try again!';
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
  const tileKey = `${tileX},${tileY}`;

  // Ignore repeat clicks on the same tile.
  if (game.revealedAreas.has(tileKey)) {
    lastActionDiv.textContent = `You already clicked tile (${tileX}, ${tileY}). Try a new one!`;
    return;
  }

  // One click costs one drip.
  game.drips -= 1;
  game.revealedAreas.add(tileKey);
  placeDropMarker(x, y);
  lastActionDiv.textContent = `You clicked tile (${tileX}, ${tileY}) at (${Math.round(x)}, ${Math.round(y)}).`;

  // Fire a custom event so future game logic can listen for map clicks.
  const mapClickEvent = new CustomEvent('mapTileClicked', {
    detail: {
      x: Math.round(x),
      y: Math.round(y),
      tileX,
      tileY,
      tileKey,
    },
  });
  mapField.dispatchEvent(mapClickEvent);

  updateDisplay();

  if (game.revealedAreas.size >= game.maxReveals) {
    endGame(true);
  } else if (game.drips <= 0) {
    endGame(false);
  }
};

// Main click listener for the map field.
mapField.addEventListener('click', onMapClick);

// Example listener showing how you can hook game logic into map clicks later.
mapField.addEventListener('mapTileClicked', (event) => {
  const { tileX, tileY } = event.detail;
  console.log(`mapTileClicked -> tile (${tileX}, ${tileY})`);
});

// Initialize display
updateDisplay();
lastActionDiv.textContent = 'Click anywhere on the map to reveal a tile.';