// Game Configuration
const CONFIG = {
    canvas: {
        width: 375,
        height: 667
    },
    player: {
        width: 50,
        height: 70,
        jumpForce: 12,
        moveSpeed: 5,
        gravity: 0.4,        // 0.5 → 0.4 (중력 약화)
        maxVelocityY: 10     // 15 → 10 (최대 낙하 속도 감소)
    },
    platform: {
        width: 90,
        height: 30,        // Platform 두께 (12 → 20으로 증가)
        minGap: 60,
        maxGap: 120,
        initialY: 600
    },
    difficulty: {
        milestones: [500, 1000, 1500, 2000, 2500],
        speedMultipliers: [1.0, 1.3, 1.6, 2.0, 2.5, 3.0]
    },
    background: {
        transitionDistance: 500  // 배경 전환 거리 (meters) - 여기만 바꾸면 모든 디버그 범위 자동 조정!
    }
};

// Game State
class Game {
    constructor() {
        // Prevent multiple instances - STRICT ENFORCEMENT
        if (Game.instance) {
            console.error('❌❌❌ CRITICAL: Game instance already exists! Only one instance allowed. ❌❌❌');
            console.error('This will cause platform duplication bug!');
            console.trace('Duplicate Game() constructor call:');

            // Stop the old instance's game loop
            if (Game.instance.animationFrameId) {
                cancelAnimationFrame(Game.instance.animationFrameId);
                Game.instance.animationFrameId = null;
            }
            Game.instance.isRunning = false;

            console.warn('⚠️ Old instance stopped. Using existing instance instead of creating new one.');
            return Game.instance;
        }
        Game.instance = this;
        console.log('✅ First Game instance created');

        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.canvas.width;
        this.canvas.height = CONFIG.canvas.height;

        // Disable image smoothing for crisp pixel art
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;

        this.player = null;
        this.platforms = [];
        this.distance = 0;
        this.speedMultiplier = 1.0;
        this.isRunning = false;
        this.keys = {};
        this.cameraOffsetY = 0;
        this.highestY = 0; // Track highest point reached
        this.hasStartedClimbing = false; // Track if player has started climbing
        this.animationFrameId = null; // Track animation frame

        // Load background images
        this.backgroundImages = {
            bg1: new Image(),
            bg2: new Image(),
            bg3: new Image(),
            bg4: new Image()
        };
        this.backgroundImages.bg1.src = 'assets/background_1.png';
        this.backgroundImages.bg2.src = 'assets/background_2.png';
        this.backgroundImages.bg3.src = 'assets/background_3.png';
        this.backgroundImages.bg4.src = 'assets/background_4.png';

        this.backgroundImagesLoaded = false;
        Promise.all([
            new Promise(resolve => this.backgroundImages.bg1.onload = resolve),
            new Promise(resolve => this.backgroundImages.bg2.onload = resolve),
            new Promise(resolve => this.backgroundImages.bg3.onload = resolve),
            new Promise(resolve => this.backgroundImages.bg4.onload = resolve)
        ]).then(() => {
            this.backgroundImagesLoaded = true;
        });

        this.setupControls();
        this.setupUI();
    }

    setupControls() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });

        // Touch controls for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const canvasRect = this.canvas.getBoundingClientRect();
            const relativeX = touch.clientX - canvasRect.left;
            const canvasWidth = canvasRect.width;

            if (relativeX < canvasWidth / 2) {
                this.keys['ArrowLeft'] = true;
                this.keys['ArrowRight'] = false;
            } else {
                this.keys['ArrowRight'] = true;
                this.keys['ArrowLeft'] = false;
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const canvasRect = this.canvas.getBoundingClientRect();
            const relativeX = touch.clientX - canvasRect.left;
            const canvasWidth = canvasRect.width;

            if (relativeX < canvasWidth / 2) {
                this.keys['ArrowLeft'] = true;
                this.keys['ArrowRight'] = false;
            } else {
                this.keys['ArrowRight'] = true;
                this.keys['ArrowLeft'] = false;
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.keys['ArrowLeft'] = false;
            this.keys['ArrowRight'] = false;
        }, { passive: false });

        // Mouse controls
        let isMouseDown = false;
        this.canvas.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            this.handleMouseMove(e);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (isMouseDown) {
                this.handleMouseMove(e);
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            isMouseDown = false;
            this.keys['ArrowLeft'] = false;
            this.keys['ArrowRight'] = false;
        });

        this.canvas.addEventListener('mouseleave', () => {
            isMouseDown = false;
            this.keys['ArrowLeft'] = false;
            this.keys['ArrowRight'] = false;
        });
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;

        if (x < CONFIG.canvas.width / 2) {
            this.keys['ArrowLeft'] = true;
            this.keys['ArrowRight'] = false;
        } else {
            this.keys['ArrowRight'] = true;
            this.keys['ArrowLeft'] = false;
        }
    }

    setupUI() {
        // Remove any existing event listeners by cloning and replacing
        const startButton = document.getElementById('startButton');
        const restartButton = document.getElementById('restartButton');

        const newStartButton = startButton.cloneNode(true);
        const newRestartButton = restartButton.cloneNode(true);

        startButton.parentNode.replaceChild(newStartButton, startButton);
        restartButton.parentNode.replaceChild(newRestartButton, restartButton);

        // Add fresh event listeners (only once)
        newStartButton.addEventListener('click', () => {
            console.log('🎮 Start button clicked');
            this.start();
        });

        newRestartButton.addEventListener('click', () => {
            console.log('🔄 Restart button clicked');
            this.restart();
        });
    }

    start() {
        console.log('🎮 START called');

        document.getElementById('startScreen').classList.add('hidden');

        // CRITICAL: Stop ALL existing loops
        this.isRunning = false;
        this._loopRunning = false;

        // Cancel any pending animation frames
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            console.log('🛑 Cancelled existing animation frame');
        }

        // Also check for any global animation frame IDs
        if (this._pendingFrameIds && this._pendingFrameIds.length > 0) {
            this._pendingFrameIds.forEach(id => cancelAnimationFrame(id));
            console.log(`🛑 Cancelled ${this._pendingFrameIds.length} pending frames`);
            this._pendingFrameIds = [];
        } else {
            this._pendingFrameIds = [];
        }

        // Small delay to ensure previous loop stops
        setTimeout(() => {
            // Double check nothing is running
            if (this.isRunning) {
                console.error('❌ Game still running after stop! Force stopping...');
                this.isRunning = false;
            }

            this.init();
            this.isRunning = true;
            this._loopRunning = false;
            this._gameLoopCount = 0;

            console.log('🚀 Starting new game loop');
            this.gameLoop();
        }, 150);
    }

    restart() {
        // Hide game over screen elements
        document.getElementById('gameOverScreen').classList.add('hidden');
        document.getElementById('newRecordMessage').classList.add('hidden');
        document.getElementById('initialInputForm').classList.add('hidden');

        // Cancel any existing animation frame
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            console.log('🛑 Cancelled existing animation frame');
        }

        // Force stop any existing loop
        this.isRunning = false;
        this._loopRunning = false; // Reset loop flag immediately

        // Small delay to ensure previous loop stops
        setTimeout(() => {
            this.init();
            this.isRunning = true;
            this._loopRunning = false; // Reset again before starting
            this._gameLoopCount = 0; // Reset counter
            this.gameLoop();
        }, 100);
    }

    init() {
        // Initialize platforms first
        this.platforms = [];
        this.generateInitialPlatforms();

        // Initialize player on the starting platform
        const startPlatform = this.platforms[0];
        this.player = new Player(
            CONFIG.canvas.width / 2 - CONFIG.player.width / 2,
            startPlatform.y - CONFIG.player.height
        );

        // Reset game state
        this.distance = 0;
        this.speedMultiplier = 1.0;
        this.cameraOffsetY = 0;
        this.highestY = this.player.y; // Initialize with starting position
        this.hasStartedClimbing = false; // Reset climbing flag
    }

    generateInitialPlatforms() {
        // Starting platform
        this.platforms.push(new Platform(
            CONFIG.canvas.width / 2 - CONFIG.platform.width / 2,
            CONFIG.platform.initialY,
            CONFIG.platform.width,
            false
        ));

        let lastY = CONFIG.platform.initialY;

        // Generate platforms going up
        for (let i = 0; i < 15; i++) {
            const gap = Math.random() * (CONFIG.platform.maxGap - CONFIG.platform.minGap) + CONFIG.platform.minGap;
            lastY -= gap;

            const x = Math.random() * (CONFIG.canvas.width - CONFIG.platform.width);
            const isMoving = false; // No moving platforms initially

            this.platforms.push(new Platform(x, lastY, CONFIG.platform.width, isMoving));
        }
    }

    generateNewPlatform() {
        if (!this.platforms || this.platforms.length === 0) {
            console.error('❌ Cannot generate platform: platforms array is empty!');
            return;
        }

        // Find the actual topmost platform (lowest Y value)
        const topPlatform = this.platforms.reduce((highest, platform) => {
            return platform.y < highest.y ? platform : highest;
        }, this.platforms[0]);

        const gap = Math.random() * (CONFIG.platform.maxGap - CONFIG.platform.minGap) + CONFIG.platform.minGap;
        const y = topPlatform.y - gap;
        const x = Math.random() * (CONFIG.canvas.width - CONFIG.platform.width);

        // Check if a platform already exists at this position (with tolerance)
        const existingPlatform = this.platforms.find(p =>
            Math.abs(p.y - y) < 5 && Math.abs(p.x - x) < 5
        );

        if (existingPlatform) {
            console.warn(`⚠️ Platform already exists at similar position (${Math.floor(x)}, ${Math.floor(y)}), skipping...`);
            return;
        }

        // Moving platforms appear at higher difficulties
        const isMoving = this.speedMultiplier >= 1.6 && Math.random() < 0.3;

        const newPlatform = new Platform(x, y, CONFIG.platform.width, isMoving);
        this.platforms.push(newPlatform);

        // Debug in problem area
        const debugStart = CONFIG.background.transitionDistance - 20;
        const debugEnd = CONFIG.background.transitionDistance + 20;
        if (this.distance >= debugStart && this.distance <= debugEnd) {
            console.log(`➕ New platform @ (${Math.floor(x)}, ${Math.floor(y)}), topPlatform.y=${Math.floor(topPlatform.y)}, total=${this.platforms.length}, distance=${Math.floor(this.distance)}m`);
        }
    }

    updateDifficulty() {
        const milestones = CONFIG.difficulty.milestones;
        const multipliers = CONFIG.difficulty.speedMultipliers;

        for (let i = milestones.length - 1; i >= 0; i--) {
            if (this.distance >= milestones[i]) {
                this.speedMultiplier = multipliers[i + 1];
                return;
            }
        }
        this.speedMultiplier = multipliers[0];
    }

    update() { // platform, player
        if (!this.isRunning) return;

        // Debug: Check if update is being called multiple times
        if (this._updateCount === undefined) this._updateCount = 0;
        if (this._lastFrameTime === undefined) this._lastFrameTime = Date.now();

        const now = Date.now();
        const deltaTime = now - this._lastFrameTime;

        this._updateCount++;

        // Alert if update is called too frequently (less than 5ms between frames)
        if (deltaTime < 5 && deltaTime > 0) {
            console.error('⚠️ RAPID UPDATE DETECTED! Delta:', deltaTime, 'ms, Distance:', this.distance);
            console.error('  → _loopRunning:', this._loopRunning, 'isRunning:', this.isRunning);
            console.trace('Call stack:'); // Show where this is being called from
        }

        if (this._updateCount % 60 === 0) {
            console.log('Update count:', this._updateCount, 'Distance:', this.distance, 'Platforms:', this.platforms.length, 'FPS:', Math.round(1000 / deltaTime));
        }

        this._lastFrameTime = now;

        // Update player
        this.player.update(this.keys);

        // Update platforms
        this.platforms.forEach(platform => platform.update());

        // Check platform collisions
        this.platforms.forEach(platform => {
            if (this.player.checkCollision(platform)) {
                this.player.land(platform.y);
            }
        });

        // Camera follows player when going up
        if (this.player.y < CONFIG.canvas.height / 2) {
            const targetOffset = CONFIG.canvas.height / 2 - this.player.y;
            this.cameraOffsetY = targetOffset;

            // Update distance based on camera movement
            this.distance = Math.max(this.distance, Math.floor(this.cameraOffsetY / 10));
        }

        // Track highest point
        if (this.player.y < this.highestY) {
            this.highestY = this.player.y;

            // Mark that player has started climbing (moved up from starting position)
            if (!this.hasStartedClimbing && this.distance > 5) {
                this.hasStartedClimbing = true;
            }
        }

        // Remove platforms that are below screen
        const platformsBeforeFilter = this.platforms.length;
        this.platforms = this.platforms.filter(platform => {
            return platform.y + this.cameraOffsetY < CONFIG.canvas.height + 100;
        });
        const removedCount = platformsBeforeFilter - this.platforms.length;

        // Debug platform removal in problem area
        const debugStart = CONFIG.background.transitionDistance - 20;
        const debugEnd = CONFIG.background.transitionDistance + 20;
        if (this.distance >= debugStart && this.distance <= debugEnd && removedCount > 0) {
            console.log(`🗑️ Removed ${removedCount} platforms @ ${Math.floor(this.distance)}m, Remaining: ${this.platforms.length}`);
        }

        // Generate new platforms
        const platformsBefore = this.platforms.length;
        while (this.platforms.length < 15) {
            console.log("platform length : ", this.platforms.length);
            this.generateNewPlatform();
        }
        const platformsAfter = this.platforms.length;

        // Debug platform generation in problem area
        if (this.distance >= debugStart && this.distance <= debugEnd && platformsAfter > platformsBefore) {
            console.log(`🏗️ Generated ${platformsAfter - platformsBefore} platforms @ ${Math.floor(this.distance)}m, Total: ${platformsAfter}`);
        }

        // Update difficulty
        this.updateDifficulty();

        // Check game over - only after player has started climbing
        // if player falls one screen height below their highest point
        if (this.hasStartedClimbing) {
            const fallDistance = this.player.y - this.highestY;
            if (fallDistance > CONFIG.canvas.height) {
                console.log('Game Over - Fall distance:', fallDistance, 'Highest Y:', this.highestY, 'Current Y:', this.player.y);
                this.gameOver();
            }
        }

        // Update UI
        document.querySelector('.distance').textContent = this.distance + 'm';
        document.querySelector('.speed').textContent = `Speed: ${this.speedMultiplier.toFixed(1)}x`;
    }

    drawBackground() {
        if (!this.backgroundImagesLoaded) {
            // Fallback gradient while loading
            const gradient = this.ctx.createLinearGradient(0, 0, 0, CONFIG.canvas.height);
            gradient.addColorStop(0, '#87CEEB');
            gradient.addColorStop(1, '#E0F6FF');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            return;
        }

        const bgHeight = 700; // Background image height
        const bgWidth = CONFIG.canvas.width;
        const transitionDistance = CONFIG.background.transitionDistance; // meters where bg3 is positioned
        const bg3WorldY = -(transitionDistance * 10); // Convert to world Y coordinate

        // Helper to draw background tile
        const drawBgTile = (image, worldY) => {
            const screenY = worldY + this.cameraOffsetY;
            if (screenY + bgHeight >= 0 && screenY <= CONFIG.canvas.height) {
                this.ctx.drawImage(image, 0, screenY, bgWidth, bgHeight);
            }
        };

        // Calculate visible range to avoid drawing offscreen
        const screenTop = -this.cameraOffsetY;

        // Always draw the full stack: bg1 -> bg2 (repeating) -> bg3 -> bg4 (repeating)

        // Draw bg1 at ground
        drawBgTile(this.backgroundImages.bg1, 0);

        // Only draw backgrounds in visible range
        const visibleTop = screenTop - bgHeight;
        const visibleBottom = screenTop + CONFIG.canvas.height + bgHeight;

        // Draw bg2 from -700 down to just above bg3
        const bg2Start = -bgHeight;
        const bg2End = bg3WorldY + bgHeight; // Stop just before bg3

        let bg2Count = 0;
        for (let worldY = bg2Start; worldY >= bg2End && bg2Count < 30; worldY -= bgHeight) {
            // Only draw if in visible range
            if (worldY >= visibleTop && worldY <= visibleBottom) {
                drawBgTile(this.backgroundImages.bg2, worldY);
            }
            // Stop if way past visible area
            if (worldY < visibleTop - bgHeight) break;
            bg2Count++;
        }

        // Draw bg3 transition (only if in visible range)
        if (bg3WorldY >= visibleTop && bg3WorldY <= visibleBottom) {
            drawBgTile(this.backgroundImages.bg3, bg3WorldY);
        }

        // Draw bg4 above bg3 (only visible tiles)
        const bg4Start = bg3WorldY - bgHeight;

        let bg4Count = 0;
        for (let worldY = bg4Start; worldY >= visibleTop && bg4Count < 20; worldY -= bgHeight) {
            if (worldY >= visibleTop && worldY <= visibleBottom) {
                drawBgTile(this.backgroundImages.bg4, worldY);
            }
            bg4Count++;
        }

        // Debug in problem area (around transition)
        const debugStart = transitionDistance - 20;
        const debugEnd = transitionDistance + 20;
        if (this.distance >= debugStart && this.distance <= debugEnd) {
            if (!this._bgDebugLogged || Math.floor(this.distance) !== this._lastDebugDistance) {
                this._lastDebugDistance = Math.floor(this.distance);
                console.log(`🎨 BG Debug @ ${Math.floor(this.distance)}m: bg2=${bg2Count}, bg4=${bg4Count}, screenTop=${screenTop}, bg3WorldY=${bg3WorldY}`);
            }
        }
    }

    draw() {
        // Count how many times draw is called per frame (should be 1)
        if (!window._drawCallCount) window._drawCallCount = 0;
        if (!window._drawCallTime) window._drawCallTime = Date.now();

        const now = Date.now();
        if (now - window._drawCallTime < 16) {
            // Same frame (less than 16ms = same animation frame)
            window._drawCallCount++;
            if (window._drawCallCount > 1) {
                console.error(`❌❌❌ MULTIPLE DRAW CALLS IN SAME FRAME: ${window._drawCallCount} times! Multiple Game instances detected!`);
            }
        } else {
            // New frame
            window._drawCallCount = 1;
            window._drawCallTime = now;
        }

        // Draw background
        this.drawBackground();

        // Save context
        this.ctx.save();

        // Apply camera offset
        this.ctx.translate(0, this.cameraOffsetY);

        // Debug: Check for duplicate platforms in problem area
        const debugStart = CONFIG.background.transitionDistance - 20;
        const debugEnd = CONFIG.background.transitionDistance + 20;
        if (this.distance >= debugStart && this.distance <= debugEnd) {
            const platformPositions = new Map();
            this.platforms.forEach((platform, index) => {
                const key = `${Math.floor(platform.x)},${Math.floor(platform.y)}`;
                if (platformPositions.has(key)) {
                    console.error(`❌ DUPLICATE PLATFORM at (${Math.floor(platform.x)}, ${Math.floor(platform.y)}) - indices: ${platformPositions.get(key)} and ${index}`);
                } else {
                    platformPositions.set(key, index);
                }
            });
        }

        // Draw platforms
        let drawnPlatforms = 0;
        this.platforms.forEach(platform => {
            platform.draw(this.ctx);
            drawnPlatforms++;
        });

        // Debug in problem area
        if (this.distance >= debugStart && this.distance <= debugEnd) {
            if (!this._lastDrawnCount || this._lastDrawnCount !== drawnPlatforms) {
                this._lastDrawnCount = drawnPlatforms;
                console.log(`🖼️ Drawing ${drawnPlatforms} platforms @ ${Math.floor(this.distance)}m (array length: ${this.platforms.length})`);
            }
        }

        // Draw player
        this.player.draw(this.ctx);

        // Restore context
        this.ctx.restore();
    }

    gameLoop() {
        // Track total number of active game loops across all instances
        if (!window._activeGameLoops) window._activeGameLoops = 0;

        // Prevent multiple game loops
        if (this._loopRunning) {
            console.warn('⚠️ Game loop already running, skipping... Distance:', this.distance);
            return;
        }

        window._activeGameLoops++;
        if (window._activeGameLoops > 1) {
            console.error(`❌❌❌ MULTIPLE GAME LOOPS ACTIVE: ${window._activeGameLoops} loops running simultaneously!`);
        }

        this._loopRunning = true;

        // Track how many times gameLoop is called
        if (this._gameLoopCount === undefined) this._gameLoopCount = 0;
        this._gameLoopCount++;

        try {
            this.update();
            this.draw();
        } catch (error) {
            console.error('Error in game loop:', error);
            this.isRunning = false;
            if (this.animationFrameId !== null) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
        }

        this._loopRunning = false;
        window._activeGameLoops--;

        if (this.isRunning) {
            // Debug: Check if we're scheduling too many frames
            const debugStart = CONFIG.background.transitionDistance - 20;
            const debugEnd = CONFIG.background.transitionDistance + 20;
            if (this.distance >= debugStart && this.distance <= debugEnd) {
                if (this._gameLoopCount % 60 === 0) {
                    console.log(`🔄 Game loop count: ${this._gameLoopCount} @ ${Math.floor(this.distance)}m`);
                }
            }
            // Schedule next frame and store the ID
            this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
        } else {
            this.animationFrameId = null;
        }
    }

    async gameOver() {
        this.isRunning = false;

        // Cancel animation frame to fully stop the game loop
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        document.getElementById('finalDistance').textContent = this.distance;

        // Check if leaderboard is enabled and score qualifies
        if (typeof LEADERBOARD_ENABLED !== 'undefined' && LEADERBOARD_ENABLED && typeof leaderboard !== 'undefined') {
            try {
                await leaderboard.loadScores();

                if (leaderboard.isTopTen(this.distance)) {
                    this.showNewRecordForm();
                } else {
                    document.getElementById('gameOverScreen').classList.remove('hidden');
                }
            } catch (error) {
                console.error('Leaderboard error:', error);
                document.getElementById('gameOverScreen').classList.remove('hidden');
            }
        } else {
            document.getElementById('gameOverScreen').classList.remove('hidden');
        }
    }

    showNewRecordForm() {
        const newRecordMessage = document.getElementById('newRecordMessage');
        const initialInputForm = document.getElementById('initialInputForm');
        const initialInput = document.getElementById('initialInput');
        const submitButton = document.getElementById('submitInitial');

        // Show game over screen
        document.getElementById('gameOverScreen').classList.remove('hidden');

        // Show new record message and input form
        newRecordMessage.classList.remove('hidden');
        initialInputForm.classList.remove('hidden');

        // Focus on input
        initialInput.value = '';
        initialInput.focus();

        // Handle submit
        const submitHandler = async () => {
            const initial = initialInput.value.trim().toUpperCase() || 'AAA';

            // Disable input while submitting
            initialInput.disabled = true;
            submitButton.disabled = true;
            submitButton.textContent = 'Submitting...';

            const success = await leaderboard.submitScore(this.distance, initial);

            if (success) {
                // Hide form elements
                newRecordMessage.classList.add('hidden');
                initialInputForm.classList.add('hidden');

                // Show success message
                alert('Score submitted successfully!');

                // Reload leaderboard
                await leaderboard.loadScores();
            } else {
                alert('Failed to submit score. Please try again.');
            }

            // Re-enable buttons
            initialInput.disabled = false;
            submitButton.disabled = false;
            submitButton.textContent = 'Submit';

            // Remove event listener
            submitButton.removeEventListener('click', submitHandler);
            initialInput.removeEventListener('keypress', enterHandler);
        };

        const enterHandler = (e) => {
            if (e.key === 'Enter') {
                submitHandler();
            }
        };

        submitButton.addEventListener('click', submitHandler);
        initialInput.addEventListener('keypress', enterHandler);
    }
}

// Player Class
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = CONFIG.player.width;
        this.height = CONFIG.player.height;
        this.velocityX = 0;
        this.velocityY = 0;
        this.isOnGround = false;
        this.direction = 'left'; // Track facing direction (default: left)

        // Load bunny images - Jump and Fall states
        this.imageJump = new Image();
        this.imageJump.src = 'assets/Jump.png';
        this.imageFall = new Image();
        this.imageFall.src = 'assets/Fall.png';
        this.imageLoaded = false;

        // Check when images are loaded
        Promise.all([
            new Promise(resolve => this.imageJump.onload = resolve),
            new Promise(resolve => this.imageFall.onload = resolve)
        ]).then(() => {
            this.imageLoaded = true;
        });
    }

    update(keys) {
        // Horizontal movement
        if (keys['ArrowLeft'] || keys['a']) {
            this.velocityX = -CONFIG.player.moveSpeed;
            this.direction = 'left';
        } else if (keys['ArrowRight'] || keys['d']) {
            this.velocityX = CONFIG.player.moveSpeed;
            this.direction = 'right';
        } else {
            this.velocityX = 0;
        }

        // Apply gravity
        this.velocityY += CONFIG.player.gravity;

        // Limit falling speed
        if (this.velocityY > CONFIG.player.maxVelocityY) {
            this.velocityY = CONFIG.player.maxVelocityY;
        }

        // Update position
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Screen wrap
        if (this.x < -this.width) {
            this.x = CONFIG.canvas.width;
        } else if (this.x > CONFIG.canvas.width) {
            this.x = -this.width;
        }

        this.isOnGround = false;
    }

    checkCollision(platform) {
        // Only collide when falling
        if (this.velocityY <= 0) return false;

        // Check if player is above platform
        const wasAbove = this.y + this.height - this.velocityY <= platform.y;
        const isNowOn = this.y + this.height >= platform.y &&
                        this.y + this.height <= platform.y + platform.height;

        // Check horizontal overlap
        const horizontalOverlap = this.x + this.width > platform.x &&
                                  this.x < platform.x + platform.width;

        return wasAbove && isNowOn && horizontalOverlap;
    }

    land(platformY) {
        this.y = platformY - this.height;
        this.velocityY = -CONFIG.player.jumpForce;
        this.isOnGround = true;
    }

    draw(ctx) {
        if (this.imageLoaded) {
            // Choose image based on vertical velocity
            // Jump image: when moving up or just landed (velocityY <= 0)
            // Fall image: when falling down (velocityY > 0)
            const image = this.velocityY <= 0 ? this.imageJump : this.imageFall;

            // Image is facing left by default, flip if facing right
            if (this.direction === 'right') {
                ctx.save();
                ctx.translate(this.x + this.width, this.y);
                ctx.scale(-1, 1);
                ctx.drawImage(image, 0, 0, this.width, this.height);
                ctx.restore();
            } else {
                // Draw normally when facing left (default)
                ctx.drawImage(image, this.x, this.y, this.width, this.height);
            }
        } else {
            // Fallback: Draw player as a square while images load
            ctx.fillStyle = '#FF6B6B';
            ctx.fillRect(this.x, this.y, this.width, this.height);

            // Draw player outline
            ctx.strokeStyle = '#FF3333';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);

            // Draw eyes
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(this.x + 8, this.y + 8, 6, 6);
            ctx.fillRect(this.x + 18, this.y + 8, 6, 6);

            ctx.fillStyle = '#000000';
            ctx.fillRect(this.x + 10, this.y + 10, 3, 3);
            ctx.fillRect(this.x + 20, this.y + 10, 3, 3);
        }
    }
}

// Platform Class
class Platform {
    constructor(x, y, width, isMoving = false) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = CONFIG.platform.height;
        this.isMoving = isMoving;
        this.moveSpeed = 2;
        this.moveDirection = Math.random() < 0.5 ? -1 : 1;
        this.moveRange = 100;
        this.originalX = x;

        // Load SVG images
        if (!Platform.imagesLoaded) {
            Platform.fixedImage = new Image();
            Platform.fixedImage.src = 'assets/fixed_platform.svg';
            Platform.movingImage = new Image();
            Platform.movingImage.src = 'assets/moving_platform.svg';

            Platform.imagesLoading = Promise.all([
                new Promise(resolve => Platform.fixedImage.onload = resolve),
                new Promise(resolve => Platform.movingImage.onload = resolve)
            ]).then(() => {
                Platform.imagesLoaded = true;
            });
        }
    }

    update() {
        if (this.isMoving) {
            this.x += this.moveSpeed * this.moveDirection;

            // Reverse direction at boundaries
            if (Math.abs(this.x - this.originalX) > this.moveRange) {
                this.moveDirection *= -1;
            }

            // Keep platform on screen
            if (this.x < 0) {
                this.x = 0;
                this.moveDirection = 1;
            } else if (this.x + this.width > CONFIG.canvas.width) {
                this.x = CONFIG.canvas.width - this.width;
                this.moveDirection = -1;
            }
        }
    }

    draw(ctx) {
        if (Platform.imagesLoaded) {
            // Use SVG images
            const image = this.isMoving ? Platform.movingImage : Platform.fixedImage;
            ctx.drawImage(image, this.x, this.y, this.width, this.height);
        } else {
            // Fallback: Draw platform with colors while loading
            if (this.isMoving) {
                // Moving platforms are orange
                ctx.fillStyle = '#FFA500';
            } else {
                // Static platforms are green
                ctx.fillStyle = '#4CAF50';
            }

            ctx.fillRect(this.x, this.y, this.width, this.height);

            // Draw platform outline
            ctx.strokeStyle = this.isMoving ? '#FF8C00' : '#388E3C';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);

            // Add texture
            if (this.isMoving) {
                ctx.fillStyle = '#FF8C00';
                for (let i = 0; i < this.width; i += 10) {
                    ctx.fillRect(this.x + i, this.y + 2, 5, 2);
                }
            }
        }
    }
}

// Initialize game when page loads
// Use a global variable to prevent multiple instances
if (typeof window.game !== 'undefined') {
    console.error('❌❌❌ game.js loaded multiple times! Script should only load once!');
}

window.game = null;
window._gameInitialized = false;

// Use 'once' option to ensure this only runs once
window.addEventListener('load', () => {
    if (window._gameInitialized) {
        console.error('❌❌❌ Load event fired multiple times! Skipping duplicate initialization.');
        return;
    }

    window._gameInitialized = true;

    if (window.game !== null) {
        console.error('⚠️ Game instance already exists! Preventing duplicate creation.');
        return;
    }

    window.game = new Game();
    console.log('✅ Game instance created successfully');
}, { once: true });
