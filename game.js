// Game Configuration
const CONFIG = {
    canvas: {
        width: 375,
        height: 667
    },
    player: {
        width: 30,
        height: 30,
        jumpForce: 12,
        moveSpeed: 5,
        gravity: 0.5,
        maxVelocityY: 15
    },
    platform: {
        width: 80,
        height: 12,
        minGap: 60,
        maxGap: 120,
        initialY: 600
    },
    difficulty: {
        milestones: [500, 1000, 1500, 2000, 2500],
        speedMultipliers: [1.0, 1.3, 1.6, 2.0, 2.5, 3.0]
    }
};

// Game State
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.canvas.width;
        this.canvas.height = CONFIG.canvas.height;

        this.player = null;
        this.platforms = [];
        this.distance = 0;
        this.speedMultiplier = 1.0;
        this.isRunning = false;
        this.keys = {};
        this.cameraOffsetY = 0;
        this.highestY = 0; // Track highest point reached

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
        let touchStartX = 0;
        this.canvas.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touchX = e.touches[0].clientX;
            const canvasRect = this.canvas.getBoundingClientRect();
            const relativeX = touchX - canvasRect.left;

            if (relativeX < CONFIG.canvas.width / 2) {
                this.keys['ArrowLeft'] = true;
                this.keys['ArrowRight'] = false;
            } else {
                this.keys['ArrowRight'] = true;
                this.keys['ArrowLeft'] = false;
            }
        });

        this.canvas.addEventListener('touchend', () => {
            this.keys['ArrowLeft'] = false;
            this.keys['ArrowRight'] = false;
        });

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
        document.getElementById('startButton').addEventListener('click', () => {
            this.start();
        });

        document.getElementById('restartButton').addEventListener('click', () => {
            this.restart();
        });
    }

    start() {
        document.getElementById('startScreen').classList.add('hidden');
        this.init();
        if (!this.isRunning) {
            this.isRunning = true;
            this.gameLoop();
        }
    }

    restart() {
        document.getElementById('gameOverScreen').classList.add('hidden');
        this.init();
        if (!this.isRunning) {
            this.isRunning = true;
            this.gameLoop();
        }
    }

    init() {
        // Initialize player
        this.player = new Player(CONFIG.canvas.width / 2, CONFIG.canvas.height - 100);

        // Initialize platforms
        this.platforms = [];
        this.generateInitialPlatforms();

        // Reset game state
        this.distance = 0;
        this.speedMultiplier = 1.0;
        this.cameraOffsetY = 0;
        this.highestY = this.player.y; // Initialize with starting position
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
        const topPlatform = this.platforms[this.platforms.length - 1];
        const gap = Math.random() * (CONFIG.platform.maxGap - CONFIG.platform.minGap) + CONFIG.platform.minGap;
        const y = topPlatform.y - gap;
        const x = Math.random() * (CONFIG.canvas.width - CONFIG.platform.width);

        // Moving platforms appear at higher difficulties
        const isMoving = this.speedMultiplier >= 1.6 && Math.random() < 0.3;

        this.platforms.push(new Platform(x, y, CONFIG.platform.width, isMoving));
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

    update() {
        if (!this.isRunning) return;

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
        }

        // Remove platforms that are below screen
        this.platforms = this.platforms.filter(platform => {
            return platform.y + this.cameraOffsetY < CONFIG.canvas.height + 100;
        });

        // Generate new platforms
        while (this.platforms.length < 15) {
            this.generateNewPlatform();
        }

        // Update difficulty
        this.updateDifficulty();

        // Check game over - if player falls one screen height below their highest point
        const fallDistance = this.player.y - this.highestY;
        if (fallDistance > CONFIG.canvas.height) {
            this.gameOver();
        }

        // Update UI
        document.querySelector('.distance').textContent = this.distance + 'm';
        document.querySelector('.speed').textContent = `Speed: ${this.speedMultiplier.toFixed(1)}x`;
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);

        // Draw sky gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, CONFIG.canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#E0F6FF');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);

        // Save context
        this.ctx.save();

        // Apply camera offset
        this.ctx.translate(0, this.cameraOffsetY);

        // Draw platforms
        this.platforms.forEach(platform => platform.draw(this.ctx));

        // Draw player
        this.player.draw(this.ctx);

        // Restore context
        this.ctx.restore();
    }

    gameLoop() {
        this.update();
        this.draw();

        if (this.isRunning) {
            requestAnimationFrame(() => this.gameLoop());
        }
    }

    gameOver() {
        this.isRunning = false;
        document.getElementById('finalDistance').textContent = this.distance;
        document.getElementById('gameOverScreen').classList.remove('hidden');
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
    }

    update(keys) {
        // Horizontal movement
        if (keys['ArrowLeft'] || keys['a']) {
            this.velocityX = -CONFIG.player.moveSpeed;
        } else if (keys['ArrowRight'] || keys['d']) {
            this.velocityX = CONFIG.player.moveSpeed;
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
        // Draw player as a square
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
        // Draw platform
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

// Initialize game when page loads
window.addEventListener('load', () => {
    const game = new Game();
});
