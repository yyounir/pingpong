// Get the canvas element and its 2D rendering context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const gameMessage = document.getElementById('gameMessage');
const scoreDisplay = document.getElementById('scoreDisplay');
const restartButton = document.getElementById('restartButton');

// Game dimensions (will be set dynamically)
let CANVAS_WIDTH;
let CANVAS_HEIGHT;

// Paddle properties
const PADDLE_WIDTH = 10;
let PADDLE_HEIGHT; // Will be set dynamically
const PADDLE_SPEED = 6;

// Ball properties
const BALL_RADIUS = 7;
let ballX, ballY;
let ballSpeedX, ballSpeedY;
const INITIAL_BALL_SPEED = 5;

// Player paddles
let player1Y; // Left paddle (user)
let player2Y; // Right paddle (AI)

// Game state
let player1Score = 0;
let player2Score = 0;
const WINNING_SCORE = 5;
let gameRunning = false;
let animationFrameId; // To store the requestAnimationFrame ID

// Key states for paddle movement
const keys = {
    ArrowUp: false,
    ArrowDown: false
};

// Sound effects (using AudioContext for better control and multiple sounds)
let audioContext;
let paddleHitSoundBuffer;
let scoreSoundBuffer;

// Function to load sounds
async function loadSound(url) {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
}

// Function to play a sound
function playSound(buffer) {
    if (!audioContext || !buffer) return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
}

// Generate simple sound buffers dynamically
function generatePaddleHitSound() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const duration = 0.05; // seconds
    const sampleRate = audioContext.sampleRate;
    const numSamples = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
        data[i] = Math.sin(i / (sampleRate / 440) * Math.PI * 2) * 0.5; // Simple sine wave
    }
    return buffer;
}

function generateScoreSound() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const duration = 0.2; // seconds
    const sampleRate = audioContext.sampleRate;
    const numSamples = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
        data[i] = Math.sin(i / (sampleRate / 880) * Math.PI * 2) * (1 - i / numSamples); // Descending sine wave
    }
    return buffer;
}

// Initialize sounds
function initSounds() {
    paddleHitSoundBuffer = generatePaddleHitSound();
    scoreSoundBuffer = generateScoreSound();
}


// Function to set canvas size based on window size
function setCanvasSize() {
    // Max width for desktop, smaller for mobile
    CANVAS_WIDTH = Math.min(800, window.innerWidth * 0.9);
    CANVAS_HEIGHT = CANVAS_WIDTH * 0.6; // Maintain aspect ratio
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    PADDLE_HEIGHT = CANVAS_HEIGHT / 5; // Paddle height proportional to canvas height

    // Reset paddle positions based on new canvas height
    player1Y = (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2;
    player2Y = (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2;

    // Reset ball position if game is not running
    if (!gameRunning) {
        resetBall();
    }
}

// Call setCanvasSize initially and on window resize
window.addEventListener('resize', setCanvasSize);
window.onload = function() {
    setCanvasSize();
    initSounds();
    drawEverything(); // Draw initial state
};

// Function to draw a rectangle (for paddles)
function drawRect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
}

// Function to draw a circle (for ball)
function drawCircle(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2, true);
    ctx.fill();
}

// Function to draw the net
function drawNet() {
    ctx.strokeStyle = '#4a4a6b'; /* Lighter grey for net */
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]); /* Dashed line */
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 0);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]); /* Reset line dash */
}

// Function to draw scores
function drawScores() {
    ctx.font = `${CANVAS_HEIGHT * 0.1}px 'Press Start 2P'`; /* Score font size proportional to canvas height */
    ctx.fillStyle = '#e0e0e0';
    ctx.textAlign = 'center';
    ctx.fillText(player1Score, CANVAS_WIDTH / 4, CANVAS_HEIGHT / 8);
    ctx.fillText(player2Score, CANVAS_WIDTH * 3 / 4, CANVAS_HEIGHT / 8);
}

// Function to reset ball position and direction
function resetBall() {
    ballX = CANVAS_WIDTH / 2;
    ballY = CANVAS_HEIGHT / 2;
    ballSpeedX = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED; // Random initial X direction
    ballSpeedY = (Math.random() * 2 - 1) * INITIAL_BALL_SPEED * 0.5; // Random initial Y direction (less steep)
}

// Function to move paddles based on key presses
function movePaddles() {
    if (keys.ArrowUp) {
        player1Y -= PADDLE_SPEED;
    }
    if (keys.ArrowDown) {
        player1Y += PADDLE_SPEED;
    }

    // Keep player 1 paddle within canvas bounds
    if (player1Y < 0) {
        player1Y = 0;
    }
    if (player1Y > CANVAS_HEIGHT - PADDLE_HEIGHT) {
        player1Y = CANVAS_HEIGHT - PADDLE_HEIGHT;
    }

    // Simple AI for player 2 (follows the ball)
    const aiCenter = player2Y + PADDLE_HEIGHT / 2;
    if (aiCenter < ballY - 35) { // AI reacts if ball is significantly below center
        player2Y += PADDLE_SPEED * 0.8; // Slightly slower than player
    } else if (aiCenter > ballY + 35) { // AI reacts if ball is significantly above center
        player2Y -= PADDLE_SPEED * 0.8;
    }

    // Keep player 2 paddle within canvas bounds
    if (player2Y < 0) {
        player2Y = 0;
    }
    if (player2Y > CANVAS_HEIGHT - PADDLE_HEIGHT) {
        player2Y = CANVAS_HEIGHT - PADDLE_HEIGHT;
    }
}

// Function to move the ball and handle collisions
function moveBall() {
    ballX += ballSpeedX;
    ballY += ballSpeedY;

    // Collision with top/bottom walls
    if (ballY - BALL_RADIUS < 0 || ballY + BALL_RADIUS > CANVAS_HEIGHT) {
        ballSpeedY *= -1; // Reverse Y direction
        playSound(paddleHitSoundBuffer); // Play sound for wall hit
    }

    // Collision with player 1 paddle (left)
    if (ballX - BALL_RADIUS < PADDLE_WIDTH &&
        ballY > player1Y &&
        ballY < player1Y + PADDLE_HEIGHT) {
        ballSpeedX *= -1; // Reverse X direction
        // Adjust Y speed based on where it hit the paddle
        let deltaY = ballY - (player1Y + PADDLE_HEIGHT / 2);
        ballSpeedY = deltaY * 0.3; // Make it bounce more dynamically
        playSound(paddleHitSoundBuffer);
    }

    // Collision with player 2 paddle (right)
    if (ballX + BALL_RADIUS > CANVAS_WIDTH - PADDLE_WIDTH &&
        ballY > player2Y &&
        ballY < player2Y + PADDLE_HEIGHT) {
        ballSpeedX *= -1; // Reverse X direction
        // Adjust Y speed based on where it hit the paddle
        let deltaY = ballY - (player2Y + PADDLE_HEIGHT / 2);
        ballSpeedY = deltaY * 0.3;
        playSound(paddleHitSoundBuffer);
    }

    // Ball goes out of bounds (score)
    if (ballX < 0) { // Player 2 scores
        player2Score++;
        playSound(scoreSoundBuffer);
        if (player2Score >= WINNING_SCORE) {
            endGame("Your opponent Wins!");
        } else {
            resetBall();
        }
    } else if (ballX > CANVAS_WIDTH) { // Player 1 scores
        player1Score++;
        playSound(scoreSoundBuffer);
        if (player1Score >= WINNING_SCORE) {
            endGame("You Win!");
        } else {
            resetBall();
        }
    }
}

// Function to draw all game elements
function drawEverything() {
    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, '#0f0f1a'); // Redraw background

    drawNet();
    drawScores();

    // Draw player 1 paddle
    drawRect(0, player1Y, PADDLE_WIDTH, PADDLE_HEIGHT, '#00b894'); /* Greenish-blue */
    // Draw player 2 paddle
    drawRect(CANVAS_WIDTH - PADDLE_WIDTH, player2Y, PADDLE_WIDTH, PADDLE_HEIGHT, '#d63031'); /* Reddish */

    // Draw ball
    drawCircle(ballX, ballY, BALL_RADIUS, '#ffeaa7'); /* Yellowish */
}

// Main game loop
function gameLoop() {
    if (!gameRunning) return;

    movePaddles();
    moveBall();
    drawEverything();

    animationFrameId = requestAnimationFrame(gameLoop);
}

// Function to start the game
function startGame() {
    player1Score = 0;
    player2Score = 0;
    resetBall();
    gameRunning = true;
    gameMessage.style.display = 'none';
    startButton.style.display = 'none';
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId); // Cancel any existing loop
    }
    gameLoop();
}

// Function to end the game
function endGame(message) {
    gameRunning = false;
    cancelAnimationFrame(animationFrameId); // Stop the game loop
    scoreDisplay.textContent = `${message} Final Score: ${player1Score} - ${player2Score}`;
    gameMessage.style.display = 'block';
    restartButton.focus(); // Focus on restart button for accessibility
}

// Event listeners for keyboard input
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
        keys.ArrowUp = true;
        e.preventDefault(); // Prevent scrolling
    }
    if (e.key === 'ArrowDown') {
        keys.ArrowDown = true;
        e.preventDefault(); // Prevent scrolling
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') {
        keys.ArrowUp = false;
    }
    if (e.key === 'ArrowDown') {
        keys.ArrowDown = false;
    }
});

// Touch controls for mobile
let touchStartY = 0;
let lastTouchY = 0;
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent scrolling and zooming
    if (e.touches.length > 0) {
        touchStartY = e.touches[0].clientY;
        lastTouchY = e.touches[0].clientY;
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Prevent scrolling and zooming
    if (e.touches.length > 0 && gameRunning) {
        const touchCurrentY = e.touches[0].clientY;
        const deltaY = touchCurrentY - lastTouchY;
        player1Y += deltaY * 1.5; // Adjust sensitivity for touch
        lastTouchY = touchCurrentY;

        // Keep player 1 paddle within canvas bounds
        if (player1Y < 0) {
            player1Y = 0;
        }
        if (player1Y > CANVAS_HEIGHT - PADDLE_HEIGHT) {
            player1Y = CANVAS_HEIGHT - PADDLE_HEIGHT;
        }
    }
});

canvas.addEventListener('touchend', (e) => {
    // No specific action needed on touchend for continuous movement
});


// Button event listeners
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);


// UI -------------------------------------------------------------------

// Pop-up

function openPopup() {
    document.getElementById('popup').style.display = 'flex';
}
function closePopup() {
    document.getElementById('popup').style.display = 'none';
}