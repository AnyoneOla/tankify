const canvas = document.getElementById('gameCanvas');
const renderer = new Renderer(canvas, LOGICAL_WIDTH);

let ws;
let gameState = {
    role: null, // p1 or p2
    currentView: 'login',
    terrain: null,
    p1: { x: 150, health: 100, inventory: [], score: 0 },
    p2: { x: 850, health: 100, inventory: [], score: 0 },
    projectiles: [],
    particles: [],
    isSimulating: false,
    selectedWeapon: null,
    winner: null
};

// UI Elements
const viewLogin = document.getElementById('view-login');
const viewDraft = document.getElementById('view-draft');
const viewGame = document.getElementById('view-game');
const nameInput = document.getElementById('player-name-input');
const connectBtn = document.getElementById('connect-btn');
const loginStatus = document.getElementById('login-status');

const weaponPool = document.getElementById('weapon-pool');
const fireBtn = document.getElementById('fire-btn');
const moveLeftBtn = document.getElementById('move-left-btn');
const moveRightBtn = document.getElementById('move-right-btn');
const angleSlider = document.getElementById('angle-slider');
const angleValue = document.getElementById('angle-value');
const powerSlider = document.getElementById('power-slider');
const powerValue = document.getElementById('power-value');
const gameWeaponCarousel = document.getElementById('game-weapon-carousel');
const fullscreenBtn = document.getElementById('fullscreen-btn');

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');
    gameState.currentView = viewId;
}

function init() {
    function resize() {
        const container = document.getElementById('canvas-container');
        if (container && container.clientWidth > 0) {
            renderer.resize(container.clientWidth, container.clientHeight);
        }
    }
    window.addEventListener('resize', resize);
    resize();

const restartBtn = document.getElementById('restart-btn');

    // Login
    connectBtn.addEventListener('click', () => {
        if (!nameInput.value) return;
        AudioSys.startIntroMusic();
        connectWebSocket(nameInput.value);
        connectBtn.disabled = true;
        loginStatus.innerText = "CONNECTING...";
    });

    // Fullscreen Toggle
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            fullscreenBtn.innerText = "EXIT FULLSCREEN";
        } else {
            fullscreenBtn.innerText = "ENTER FULLSCREEN";
        }
    });

    // Game Over Restart
    restartBtn.addEventListener('click', () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "RESTART" }));
            document.getElementById('game-over-screen').style.display = 'none';
        }
    });

    // Sliders
    angleSlider.addEventListener('input', (e) => { 
        angleValue.innerHTML = e.target.value + '&deg;'; 
    });
    powerSlider.addEventListener('input', (e) => { 
        powerValue.innerText = e.target.value; 
    });

    // Move Logic
    function requestMove(dir) {
        if (gameState.role !== gameState.currentTurn || gameState.isSimulating) return;
        if (gameState[gameState.role].movesLeft <= 0) return;
        
        gameState[gameState.role].movesLeft--;
        ws.send(JSON.stringify({ type: "MOVE", dir: dir }));
        lockControls();
    }
    
    if(moveLeftBtn) moveLeftBtn.addEventListener('click', () => requestMove(-1));
    if(moveRightBtn) moveRightBtn.addEventListener('click', () => requestMove(1));

    // Fire Logic
    fireBtn.addEventListener('click', () => {
        if (gameState.role !== gameState.currentTurn || gameState.isSimulating) return;
        if (!gameState.selectedWeapon) return;

        const angle = parseInt(angleSlider.value);
        const power = parseInt(powerSlider.value);
        const wp = gameState.selectedWeapon;

        // Remove from inventory
        const inv = gameState[gameState.role].inventory;
        inv.splice(inv.indexOf(wp), 1);
        renderGameCarousel();

        ws.send(JSON.stringify({
            type: "FIRE",
            angle: angle,
            power: power,
            weapon: wp
        }));
        
        lockControls();
    });

    requestAnimationFrame(gameLoop);
}

function connectWebSocket(name) {
    gameState.myName = name; // store for restart
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    
    ws.onopen = () => {
        ws.send(JSON.stringify({ name: name }));
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
    };
    
    ws.onclose = () => {
        // Hide game-over if visible
        document.getElementById('game-over-screen').style.display = 'none';
        AudioSys.stopBgMusic();
        AudioSys.stopIntroMusic();
        
        if (gameState.winner) {
            // Game ended normally, do nothing extra
        } else if (gameState.currentView !== 'login') {
            alert("Opponent disconnected! Returning to lobby.");
        } else {
            alert("Disconnected from server.");
        }
        // Reset to login
        showView('login');
        connectBtn.disabled = false;
        loginStatus.innerText = '';
        nameInput.value = gameState.myName || '';
        // Reset game state
        gameState.terrain = null;
        gameState.winner = null;
        gameState.isSimulating = false;
        gameState.projectiles = [];
        gameState.particles = [];
        gameState.p1.health = 100;
        gameState.p2.health = 100;
    };
}

function handleMessage(msg) {
    switch (msg.type) {
        case "WAITING_FOR_OPPONENT":
            loginStatus.innerText = "WAITING FOR ANOTHER PLAYER...";
            break;

        case "OPPONENT_DISCONNECTED":
            if (!gameState.winner) {
                alert("Opponent disconnected! Returning to lobby.");
                ws.close(); // This will trigger the onclose logic
            }
            break;

        case "DRAFT_START":
            try {
                showView('draft');
                AudioSys.stopWinMusic();
                AudioSys.startIntroMusic();
                gameState.role = msg.role;
                gameState.p1_name = msg.p1_name;
                gameState.p2_name = msg.p2_name;
                
                const p1NameEl = document.getElementById('draft-p1-name');
                const p2NameEl = document.getElementById('draft-p2-name');
                if (p1NameEl) p1NameEl.innerText = msg.p1_name;
                if (p2NameEl) p2NameEl.innerText = msg.p2_name;
                
                const p1InvLabel = document.getElementById('draft-p1-inv-label');
                const p2InvLabel = document.getElementById('draft-p2-inv-label');
                if (p1InvLabel) p1InvLabel.innerText = `${msg.p1_name}'s Powers`;
                if (p2InvLabel) p2InvLabel.innerText = `${msg.p2_name}'s Powers`;
                
                updateDraftUI(msg.pool, [], [], msg.draft_turn);
            } catch (e) {
                console.error("Error in DRAFT_START handler:", e);
                // Try to show the view at least
                showView('draft');
            }
            break;
            
        case "DRAFT_UPDATE":
            try {
                updateDraftUI(msg.pool, msg.p1_inventory, msg.p2_inventory, msg.draft_turn);
            } catch (e) { console.error("Error in DRAFT_UPDATE:", e); }
            break;

        case "GAME_START":
            try {
                showView('game');
                AudioSys.stopIntroMusic();
                AudioSys.startBgMusic();
                
                // Full state reset
                gameState.currentTurn = msg.first_turn;
                gameState.winner = null;
                gameState.isSimulating = false;
                gameState.projectiles = [];
                gameState.particles = [];
                gameState.fireQueue = [];
                const goScreen = document.getElementById('game-over-screen');
                if (goScreen) goScreen.style.display = 'none';
                
                gameState[gameState.role].inventory = msg.inventory;
                
                // Name assignments
                gameState.p1_name = msg.p1_name;
                gameState.p2_name = msg.p2_name;
                const gp1n = document.getElementById('game-p1-name');
                const gp2n = document.getElementById('game-p2-name');
                if (gp1n) gp1n.innerText = msg.p1_name;
                if (gp2n) gp2n.innerText = msg.p2_name;
                
                // Reset tank positions and health
                gameState.p1.x = 150;
                gameState.p2.x = 850;
                gameState.p1.health = 100;
                gameState.p2.health = 100;
                const p1h = document.getElementById('p1-health');
                const p2h = document.getElementById('p2-health');
                if (p1h) p1h.style.width = '100%';
                if (p2h) p2h.style.width = '100%';
                
                // Score display
                const p1s = document.getElementById('game-p1-score');
                const p2s = document.getElementById('game-p2-score');
                if (p1s) p1s.innerText = `Score: ${gameState.p1.score}`;
                if (p2s) p2s.innerText = `Score: ${gameState.p2.score}`;
                
                // Movement setups
                gameState.p1.movesLeft = 3;
                gameState.p2.movesLeft = 3;
                gameState.p1.targetX = gameState.p1.x;
                gameState.p2.targetX = gameState.p2.x;

                // Set terrain
                gameState.terrain = Physics.generateTerrain(msg.terrain_seed);
                gameState.p1.y = gameState.terrain[Math.floor(gameState.p1.x)];
                gameState.p2.y = gameState.terrain[Math.floor(gameState.p2.x)];
                
                // Init default weapon
                if (gameState[gameState.role].inventory.length > 0) {
                    gameState.selectedWeapon = gameState[gameState.role].inventory[0];
                }

                renderGameCarousel();
                updateGameUI();
            } catch (e) {
                console.error("Error in GAME_START handler:", e);
                showView('game');
            }
            break;

        case "MOVE":
            executeMove(msg.role, msg.dir);
            break;

        case "FIRE":
            fireProjectile(msg.role, msg.angle, msg.power, msg.weapon);
            break;

        case "NEW_TURN":
            AudioSys.playSound('turn');
            gameState.currentTurn = msg.turn;
            gameState.isSimulating = false;
            // auto select first weapon if none
            if (gameState[gameState.role].inventory.length > 0 && !gameState.selectedWeapon) {
                gameState.selectedWeapon = gameState[gameState.role].inventory[0];
            }
            renderGameCarousel();
            updateGameUI();
            break;
    }
}

// ================= DRAFT LOGIC =================
function updateDraftUI(pool, p1Inv, p2Inv, currentTurn) {
    weaponPool.innerHTML = '';
    
    document.getElementById('draft-p1-count').innerText = `${p1Inv.length}/10`;
    document.getElementById('draft-p2-count').innerText = `${p2Inv.length}/10`;
    
    const statusMsg = document.getElementById('draft-status-msg');
    if (currentTurn === gameState.role) {
        statusMsg.innerText = "YOUR PICK";
        statusMsg.style.color = gameState.role === 'p1' ? 'var(--primary)' : 'var(--secondary)';
    } else {
        const eName = currentTurn === 'p1' ? gameState.p1_name : gameState.p2_name;
        statusMsg.innerText = `${eName.toUpperCase()}'S PICK`;
        statusMsg.style.color = '#fff';
    }

    pool.forEach(wp_id => {
        const wpDef = WEAPONS_REGISTRY[wp_id];
        if (!wpDef) {
            console.warn(`Unknown weapon ID in pool: ${wp_id}`);
            return;
        }
        const el = document.createElement('div');
        el.className = 'weapon-card';
        el.innerHTML = `<div class="w-icon">${wpDef.icon}</div><div class="w-name">${wpDef.name}</div>`;
        
        el.onclick = () => {
            if (currentTurn === gameState.role) {
                AudioSys.playSound('pick');
                ws.send(JSON.stringify({ type: "DRAFT_PICK", weapon: wp_id }));
            }
        };
        weaponPool.appendChild(el);
    });
    
    // Render Inventories visually
    const renderInv = (inv, elemId) => {
        const c = document.getElementById(elemId);
        c.innerHTML = inv.map(id => `<div class="inv-item">${WEAPONS_REGISTRY[id].icon}</div>`).join("");
    };
    renderInv(p1Inv, 'draft-p1-inv');
    renderInv(p2Inv, 'draft-p2-inv');
}

// ================= GAME LOGIC =================
function renderGameCarousel() {
    gameWeaponCarousel.innerHTML = '';
    const inv = gameState[gameState.role].inventory;
    
    if (inv.length === 0) {
        gameWeaponCarousel.innerHTML = '<div style="padding:10px;color:#aaa">NO WEAPONS LEFT</div>';
        gameState.selectedWeapon = null;
        lockControls();
        return;
    }

    inv.forEach(wp_id => {
        const wpDef = WEAPONS_REGISTRY[wp_id];
        const el = document.createElement('div');
        el.className = `carousel-item ${gameState.selectedWeapon === wp_id ? 'selected' : ''}`;
        el.innerHTML = `<div class="w-icon">${wpDef.icon}</div><div class="w-name">${wpDef.name}</div>`;
        
        el.onclick = () => {
            if (gameState.role === gameState.currentTurn && !gameState.isSimulating) {
                gameState.selectedWeapon = wp_id;
                renderGameCarousel();
            }
        };
        gameWeaponCarousel.appendChild(el);
    });
}

function updateGameUI() {
    viewGame.className = `view active view-game-${gameState.currentTurn}`;
    const banner = document.getElementById('game-status-banner');
    
    if (gameState.role === gameState.currentTurn) {
        banner.innerText = "YOUR TURN";
        banner.style.color = gameState.role === 'p1' ? 'var(--primary)' : 'var(--secondary)';
        fireBtn.disabled = !gameState.selectedWeapon;
        
        let moves = gameState[gameState.role].movesLeft;
        if(moveLeftBtn) {
            moveLeftBtn.disabled = moves <= 0;
            document.getElementById('move-left-txt').innerText = `(${moves})`;
        }
        if(moveRightBtn) {
            moveRightBtn.disabled = moves <= 0;
            document.getElementById('move-right-txt').innerText = `(${moves})`;
        }
        
        // Auto invert P2 slider
        if (gameState.role === 'p2' && angleSlider.value < 90) {
            angleSlider.value = 180 - angleSlider.value;
            angleValue.innerHTML = angleSlider.value + '&deg;';
        }
    } else {
        const eName = gameState.currentTurn === 'p1' ? gameState.p1_name : gameState.p2_name;
        banner.innerText = `${eName.toUpperCase()}'S TURN`;
        banner.style.color = '#fff';
        lockControls();
    }
}

function lockControls() {
    if(fireBtn) fireBtn.disabled = true;
    if(moveLeftBtn) moveLeftBtn.disabled = true;
    if(moveRightBtn) moveRightBtn.disabled = true;
}

function executeMove(role, dir) {
    AudioSys.playSound('move');
    gameState.isSimulating = true;
    gameState.actionType = 'move';
    const tank = gameState[role];
    let nextX = tank.x;
    for (let i = 0; i < 80; i++) {
        let proposedX = nextX + dir;
        if (proposedX < 10 || Math.floor(proposedX) >= LOGICAL_WIDTH - 10) break;
        let dy = gameState.terrain[Math.floor(proposedX)] - gameState.terrain[Math.floor(nextX)];
        if (dy < -4) break; // Too steep to climb! (>75 deg grade equivalent)
        nextX = proposedX;
    }
    tank.targetX = nextX;
}

// ================= PHYSICS & PARTICLES =================

const TANK_HITBOX = 18; // radius for tank collision

function fireProjectile(role, angleDeg, power, weaponType) {
    AudioSys.playSound('shoot');
    gameState.isSimulating = true;
    gameState.actionType = 'fire';
    const angleRad = angleDeg * (Math.PI / 180);
    const velocity = (power / 100) * 18 + 4; 
    
    const startX = role === 'p1' ? gameState.p1.x : gameState.p2.x;
    const startY = role === 'p1' ? gameState.p1.y - 20 : gameState.p2.y - 20; 
    
    const vx = Math.cos(angleRad) * velocity;
    const vy = -Math.sin(angleRad) * velocity;

    // Weapon-specific launch logic
    if (weaponType === 'triple') {
        // 3 separate shots staggered
        gameState.fireQueue = gameState.fireQueue || [];
        gameState.fireQueue.push({ delay: 0, x: startX, y: startY, vx, vy, weapon: 'single', owner: role });
        gameState.fireQueue.push({ delay: 15, x: startX, y: startY, vx: vx * 0.9, vy: vy * 1.05, weapon: 'single', owner: role });
        gameState.fireQueue.push({ delay: 30, x: startX, y: startY, vx: vx * 1.1, vy: vy * 0.95, weapon: 'single', owner: role });
        gameState.fireQueueFrame = 0;
    } else if (weaponType === 'double') {
        gameState.fireQueue = gameState.fireQueue || [];
        gameState.fireQueue.push({ delay: 0, x: startX, y: startY, vx, vy, weapon: 'single', owner: role });
        gameState.fireQueue.push({ delay: 20, x: startX, y: startY, vx: vx * 1.05, vy: vy * 0.97, weapon: 'single', owner: role });
        gameState.fireQueueFrame = 0;
    } else if (weaponType === 'shotgun') {
        for (let k = 0; k < 5; k++) {
            let spread = (k - 2) * 0.15;
            createProj(startX, startY, vx + spread * velocity, vy + spread * velocity * 0.3, 'single_small');
        }
    } else if (weaponType === 'cluster') {
        const p = createProj(startX, startY, vx, vy, 'cluster');
        p.owner = role;
    } else if (weaponType === 'splitter') {
        const p = createProj(startX, startY, vx, vy, 'splitter');
        p.owner = role;
    } else if (weaponType === 'mirv') {
        const p = createProj(startX, startY, vx, vy, 'mirv');
        p.owner = role;
    } else if (weaponType === 'rain' || weaponType === 'carpet') {
        // Rain: drops from sky near target area
        const targetX = startX + vx * 30;
        gameState.fireQueue = gameState.fireQueue || [];
        const count = weaponType === 'rain' ? 15 : 10;
        const spread = weaponType === 'rain' ? 120 : 200;
        for (let k = 0; k < count; k++) {
            gameState.fireQueue.push({
                delay: k * 5,
                x: targetX + (k - count/2) * (spread / count),
                y: 20,
                vx: 0,
                vy: 3 + Math.random() * 2,
                weapon: 'single_small',
                owner: role
            });
        }
        gameState.fireQueueFrame = 0;
    } else if (weaponType === 'teleport') {
        const p = createProj(startX, startY, vx, vy, weaponType);
        p.owner = role;
    } else if (weaponType === 'dirt_mover' || weaponType === 'big_dirt') {
        const p = createProj(startX, startY, vx, vy, weaponType);
        p.owner = role;
    } else if (weaponType === 'water' || weaponType === 'oil' || weaponType === 'acid' || weaponType === 'lava' || weaponType === 'napalm') {
        const p = createProj(startX, startY, vx, vy, weaponType);
        p.owner = role;
    } else if (weaponType === 'heatseeker') {
        const p = createProj(startX, startY, vx, vy, weaponType);
        p.owner = role;
    } else {
        const p = createProj(startX, startY, vx, vy, weaponType);
        p.owner = role;
    }
}

function createProj(x, y, vx, vy, weapon) {
    const p = {
        x: x, y: y,
        vx: vx, vy: vy,
        weapon: weapon,
        trail: [],
        life: 0,
        bounces: 0
    };
    gameState.projectiles.push(p);
    return p;
}

function createExplosion(x, y, color, count, customSize=3, type='normal') {
    for (let i = 0; i < count; i++) {
        let speed = Math.random() * 6 + 1;
        let angle = Math.random() * Math.PI * 2;
        
        let pvy = Math.sin(angle) * speed;
        if (type === 'fluid') { pvy = -Math.abs(pvy) * 0.5; }

        gameState.particles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed,
            vy: pvy,
            life: 1.0,
            maxLife: 1.0,
            decay: Math.random() * 0.05 + (type==='fluid'?0.005:0.02),
            color: color,
            size: Math.random() * customSize + 1,
            type: type
        });
    }
}

function checkTankHit(px, py) {
    // Returns 'p1', 'p2', or null
    const d1 = Math.sqrt((px - gameState.p1.x)**2 + (py - gameState.p1.y)**2);
    const d2 = Math.sqrt((px - gameState.p2.x)**2 + (py - gameState.p2.y)**2);
    if (d1 < TANK_HITBOX) return 'p1';
    if (d2 < TANK_HITBOX) return 'p2';
    return null;
}

function applyDamage(hitX, hitY, dmgRadius, maxDmg) {
    AudioSys.playSound('hit');
    let totalDmgDealt = 0;
    [gameState.p1, gameState.p2].forEach((tank, index) => {
        const dx = tank.x - hitX;
        const dy = tank.y - hitY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < dmgRadius) {
            const dmg = Math.floor(maxDmg * (1 - dist/dmgRadius));
            tank.health -= dmg;
            totalDmgDealt += dmg;
            if (tank.health < 0) tank.health = 0;
            document.getElementById(`p${index+1}-health`).style.width = tank.health + '%';
        }
    });
    
    // Update scores based on damage dealt
    // The current turn player gets score for damage dealt to the opponent
    if (totalDmgDealt > 0) {
        const scorer = gameState.currentTurn;
        if (scorer) {
            gameState[scorer].score += totalDmgDealt;
            document.getElementById(`game-${scorer}-score`).innerText = `Score: ${gameState[scorer].score}`;
        }
    }
    
    checkWinner();
}

function checkWinner() {
    if (gameState.winner) return; // prevent double-fire
    
    let winner = null;
    let reason = "ALL TARGETS NEUTRALIZED";

    // 1. Health-based win
    if (gameState.p1.health <= 0) winner = 'p2';
    if (gameState.p2.health <= 0) winner = 'p1';

    // 2. Out-of-bounds win (falling)
    if (!winner) {
        if (gameState.p1.y > 1000) { winner = 'p2'; reason = `${gameState.p1_name.toUpperCase()} FELL OUT OF BOUNDS!`; }
        if (gameState.p2.y > 1000) { winner = 'p1'; reason = `${gameState.p2_name.toUpperCase()} FELL OUT OF BOUNDS!`; }
    }

    // 3. Score-based win (out of ammo)
    if (!winner && 
        gameState.p1.inventory.length === 0 && 
        gameState.p2.inventory.length === 0 &&
        gameState.projectiles.length === 0 && 
        (!gameState.fireQueue || gameState.fireQueue.length === 0)) {
        
        reason = "POWERS EXHAUSTED - HIGHEST SCORE WINS!";
        if (gameState.p1.score > gameState.p2.score) winner = 'p1';
        else if (gameState.p2.score > gameState.p1.score) winner = 'p2';
        else winner = 'draw'; // rare case
    }

    if (winner) {
        gameState.winner = winner;
        gameState.isSimulating = false;
        
        if (winner !== 'draw') {
            // Add bonus score for winning
            gameState[winner].score += 50;
            const scoreEl = document.getElementById(`game-${winner}-score`);
            if (scoreEl) scoreEl.innerText = `Score: ${gameState[winner].score}`;
        }
        
        // Show popup after a brief delay so explosion plays out
        setTimeout(() => {
            AudioSys.stopBgMusic();
            AudioSys.startWinMusic();
            
            const goScreen = document.getElementById('game-over-screen');
            if (winner === 'draw') {
                document.getElementById('go-winner').innerText = `IT'S A DRAW!`;
            } else {
                const name = winner === 'p1' ? gameState.p1_name : gameState.p2_name;
                document.getElementById('go-winner').innerText = `${name.toUpperCase()} WINS!`;
            }
            
            document.getElementById('go-scores').innerText = reason + "\n" + `${gameState.p1_name}: ${gameState.p1.score} | ${gameState.p2_name}: ${gameState.p2.score}`;
            goScreen.style.display = 'flex';
        }, 1500);
    }
}

function detonateProjectile(proj, hitX, hitY) {
    const wId = proj.weapon;
    
    // Skip detonation for tiny sub-projectiles that went off-screen
    if (hitX < 0 || hitX >= LOGICAL_WIDTH) return;

    if (wId === 'single_small') {
        Physics.createCrater(gameState.terrain, Math.floor(hitX), hitY, 20, 'destroy');
        createExplosion(hitX, hitY, '#ff4b4b', 20);
        applyDamage(hitX, hitY, 30, 15);
        return;
    }

    if (wId === 'digger' && proj.bounces === 0) {
        gameState.terrain[Math.floor(hitX)] += 60;
        const subp = createProj(hitX, hitY + 10, 0, 5, 'single');
        subp.bounces = 1;
        return;
    }

    if (wId === 'teleport') {
        const t = proj.owner === 'p1' ? gameState.p1 : gameState.p2;
        t.x = hitX;
        t.y = hitY;
        t.targetX = hitX;
        createExplosion(hitX, hitY, '#00ffcc', 20);
        return;
    }
    
    // Fluid weapons
    if (wId === 'water' || wId === 'acid' || wId === 'lava' || wId === 'oil' || wId === 'napalm') {
        const colorMap = { water: '#00aaff', acid: '#00ff00', lava: '#ff5500', oil: '#333', napalm: '#ff8800' };
        createExplosion(hitX, hitY, colorMap[wId], 80, 5, 'fluid');
        // Water/Oil push tanks - shift terrain under target
        if (wId === 'water' || wId === 'oil') {
            Physics.createCrater(gameState.terrain, Math.floor(hitX), hitY, 30, 'destroy');
            createExplosion(hitX, hitY, colorMap[wId], 40, 4, 'fluid');
        }
        // Acid/Napalm/Lava do damage
        if (wId === 'acid' || wId === 'napalm' || wId === 'lava') {
            applyDamage(hitX, hitY, 50, 20);
        }
        return;
    }

    // Dirt weapons - bury terrain upward (3x strength)
    if (wId === 'dirt_mover' || wId === 'big_dirt') {
        const r = wId === 'big_dirt' ? 240 : 150;
        Physics.createCrater(gameState.terrain, Math.floor(hitX), hitY, r, 'add');
        createExplosion(hitX, hitY, '#8B4513', r, 3, 'normal');
        // If a tank is under the new dirt, bury it
        ['p1', 'p2'].forEach(pn => {
            const t = gameState[pn];
            const tx = Math.floor(t.x);
            if (tx >= 0 && tx < LOGICAL_WIDTH) {
                t.y = gameState.terrain[tx]; // snap to new terrain
            }
        });
        return;
    }

    // Wall weapon (3x strength)
    if (wId === 'wall') {
        Physics.createCrater(gameState.terrain, Math.floor(hitX), hitY, 36, 'wall');
        createExplosion(hitX, hitY, '#888', 30);
        return;
    }

    // Canyon weapon
    if (wId === 'canyon') {
        Physics.createCrater(gameState.terrain, Math.floor(hitX), hitY, 15, 'canyon');
        createExplosion(hitX, hitY, '#aa6633', 25);
        applyDamage(hitX, hitY, 40, 10);
        return;
    }

    // Earthquake
    if (wId === 'earthquake') {
        Physics.createCrater(gameState.terrain, Math.floor(hitX), hitY, 0, 'earthquake');
        createExplosion(hitX, hitY, '#ffcc00', 50);
        applyDamage(hitX, hitY, 200, 15);
        return;
    }

    // Shield - no damage, just visual
    if (wId === 'shield') {
        createExplosion(hitX, hitY, '#00ffcc', 30);
        // Build a small wall around the owner
        const ownerTank = proj.owner === 'p1' ? gameState.p1 : gameState.p2;
        Physics.createCrater(gameState.terrain, Math.floor(ownerTank.x - 25), ownerTank.y, 8, 'wall');
        Physics.createCrater(gameState.terrain, Math.floor(ownerTank.x + 25), ownerTank.y, 8, 'wall');
        return;
    }

    // EMP - flattens terrain around enemy
    if (wId === 'emp') {
        createExplosion(hitX, hitY, '#aa00ff', 60);
        Physics.createCrater(gameState.terrain, Math.floor(hitX), hitY, 60, 'destroy');
        applyDamage(hitX, hitY, 80, 25);
        return;
    }

    // Cluster - explodes into sub-bomblets  
    if (wId === 'cluster') {
        createExplosion(hitX, hitY, '#ff8800', 30);
        for (let k = 0; k < 6; k++) {
            createProj(hitX, hitY - 10, (k - 3) * 2, -6 - Math.random() * 3, 'single_small');
        }
        return;
    }

    // Standard explosives
    let r = 40; let dmg = 30; let color = '#ff4b4b';
    
    if (wId === 'big_shot') { r = 70; dmg = 50; }
    else if (wId === 'nuke') { r = 100; dmg = 80; color = '#ffff00'; }
    else if (wId === 'sniper' || wId === 'laser') { r = 15; dmg = 45; color = '#fff'; }
    else if (wId === 'tracer') { r = 10; dmg = 10; color = '#00ffcc'; }

    Physics.createCrater(gameState.terrain, Math.floor(hitX), hitY, r, 'destroy');
    createExplosion(hitX, hitY, color, Math.max(r, 30));
    if (dmg > 0) applyDamage(hitX, hitY, r > 20 ? r * 1.5 : 40, dmg);

    // Update health bars
    document.getElementById('p1-health').style.width = gameState.p1.health + '%';
    document.getElementById('p2-health').style.width = gameState.p2.health + '%';
}

function updatePhysics() {
    if (gameState.winner) {
        // Still allow particles to decay visually
        for (let i = gameState.particles.length - 1; i >= 0; i--) {
            let p = gameState.particles[i];
            p.x += p.vx; p.y += p.vy;
            p.vy += GRAVITY * 0.5;
            p.life -= p.decay;
            if (p.life <= 0) gameState.particles.splice(i, 1);
        }
        return;
    }

    // Fire Queue processing
    if (gameState.fireQueue && gameState.fireQueue.length > 0) {
        gameState.fireQueueFrame = (gameState.fireQueueFrame || 0) + 1;
        for (let i = gameState.fireQueue.length - 1; i >= 0; i--) {
            const item = gameState.fireQueue[i];
            if (gameState.fireQueueFrame >= item.delay) {
                const p = createProj(item.x, item.y, item.vx, item.vy, item.weapon);
                if (item.owner) p.owner = item.owner;
                gameState.fireQueue.splice(i, 1);
                AudioSys.playSound('shoot');
            }
        }
    }

    // Particle Physics
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        let p = gameState.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.type === 'fluid') {
            p.vy += GRAVITY * 0.2;
            const tx = Math.floor(p.x);
            if (tx >= 0 && tx < LOGICAL_WIDTH && gameState.terrain) {
                if (p.y >= gameState.terrain[tx]) {
                    p.y = gameState.terrain[tx];
                    p.vy = 0;
                    if (tx > 0 && tx < LOGICAL_WIDTH-1) {
                         let leftEnd = gameState.terrain[tx-1];
                         let rightEnd = gameState.terrain[tx+1];
                         if (leftEnd > p.y) p.vx = -1;
                         else if (rightEnd > p.y) p.vx = 1;
                         else p.vx *= 0.5;
                    }
                }
            }
            // Fluid tank damage
            if (Math.abs(p.x - gameState.p1.x) < 15 && Math.abs(p.y - gameState.p1.y) < 15 && p.life > 0.5) {
                gameState.p1.health -= 0.1;
                if (gameState.p1.health < 0) gameState.p1.health = 0;
                document.getElementById('p1-health').style.width = gameState.p1.health + '%';
            }
            if (Math.abs(p.x - gameState.p2.x) < 15 && Math.abs(p.y - gameState.p2.y) < 15 && p.life > 0.5) {
                gameState.p2.health -= 0.1;
                if (gameState.p2.health < 0) gameState.p2.health = 0;
                document.getElementById('p2-health').style.width = gameState.p2.health + '%';
            }
            checkWinner();
        } else {
            p.vy += GRAVITY * 0.5;
        }

        p.life -= p.decay;
        if (p.life <= 0) gameState.particles.splice(i, 1);
    }

    // Projectile Physics
    for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
        let proj = gameState.projectiles[i];
        
        proj.trail.push({x: proj.x, y: proj.y});
        if (proj.trail.length > 15) proj.trail.shift();
        
        proj.x += proj.vx;
        proj.y += proj.vy;
        
        // Custom weapon flight logic
        if (proj.weapon === 'laser') {
            proj.vx *= 1.1;
            proj.vy = 0;
        } else if (proj.weapon === 'heatseeker') {
            const target = gameState.currentTurn === 'p1' ? gameState.p2 : gameState.p1;
            const pdx = target.x - proj.x;
            const pdy = target.y - proj.y;
            const dist = Math.sqrt(pdx*pdx + pdy*pdy);
            if (dist < 400) {
                 proj.vx += (pdx/dist) * 0.5;
                 proj.vy += (pdy/dist) * 0.5;
            }
            proj.vy += GRAVITY * 0.5;
        } else {
            proj.vy += GRAVITY;
        }
        
        proj.life++;

        // Mid-air splitting
        if (proj.life === 25) {
            if (proj.weapon === 'splitter') {
                gameState.projectiles.splice(i, 1);
                createProj(proj.x, proj.y, proj.vx, proj.vy, 'single');
                createProj(proj.x, proj.y, proj.vx - 1.5, proj.vy - 1, 'single');
                createProj(proj.x, proj.y, proj.vx + 1.5, proj.vy - 1, 'single');
                continue;
            } else if (proj.weapon === 'mirv' && proj.vy > 0) {
                gameState.projectiles.splice(i, 1);
                for(let k=0; k<5; k++) createProj(proj.x, proj.y, proj.vx + (k-2)*1.5, proj.vy, 'single');
                continue;
            }
        }

        // Collision Check
        let hit = false;
        let hitX = proj.x;
        let hitY = proj.y;
        
        // 1. Off-screen check
        if (proj.x < 0 || proj.x >= LOGICAL_WIDTH || proj.y > renderer.logicalHeight + 200) {
            hit = true;
        }
        // 2. Tank hitbox check (ignore hitting the firing tank for first 10 frames)
        else {
            const tankHit = checkTankHit(proj.x, proj.y);
            if (tankHit && proj.life > 10) {
                hit = true;
                hitX = proj.x;
                hitY = proj.y;
            }
        }
        // 3. Terrain collision
        if (!hit && proj.y > 0) {
            const tx = Math.floor(proj.x);
            if (tx >= 0 && tx < LOGICAL_WIDTH) {
                if (proj.y >= gameState.terrain[tx]) {
                    hit = true;
                    hitX = proj.x;
                    hitY = gameState.terrain[tx];
                }
            }
        }
        
        if (hit) {
            // Bounce-category weapons
            const wDef = WEAPONS_REGISTRY[proj.weapon];
            const wCat = wDef ? wDef.cat : '';
            if (wCat === 'Bounce' && hitY < renderer.logicalHeight && proj.bounces < 4) {
                 proj.bounces++;
                 proj.vy = -Math.abs(proj.vy) * 0.7;
                 if (proj.weapon === 'roller' || proj.weapon === 'heavy_roller') {
                      proj.vx *= 0.9;
                      proj.vy = -3;
                 }
                 if (proj.weapon === 'heavy_roller') {
                      Physics.createCrater(gameState.terrain, Math.floor(proj.x), hitY, 20, 'destroy');
                      applyDamage(proj.x, hitY, 25, 10);
                 }
                 if (proj.weapon === 'bowl') {
                      Physics.createCrater(gameState.terrain, Math.floor(proj.x), hitY, 15, 'destroy');
                      applyDamage(proj.x, hitY, 20, 8);
                 }
                 proj.y = hitY - 2;
                 continue; // keep bouncing
            }

            gameState.projectiles.splice(i, 1);
            
            // Execute detonation
            if (hitX >= 0 && hitX < LOGICAL_WIDTH) {
                detonateProjectile(proj, hitX, hitY);
            }
        }
    }
    
    // Tank Falling & Moving Phase
    if (gameState.terrain && gameState.isSimulating && gameState.projectiles.length === 0 && (!gameState.fireQueue || gameState.fireQueue.length === 0)) {
        
        let activelyMoving = false;
        
        ['p1', 'p2'].forEach(name => {
            let t = gameState[name];
            // Process horizontal move target
            if (t.targetX !== undefined && Math.abs(t.targetX - t.x) > 0.1) {
                activelyMoving = true;
                let step = Math.sign(t.targetX - t.x);
                t.x += step * 2;
                if (Math.abs(t.targetX - t.x) <= 2) t.x = t.targetX;
                t.y = gameState.terrain[Math.floor(t.x)];
            }
            
            // Vertical physics correction 
            const ty = gameState.terrain[Math.floor(t.x)];
            if (t.y < ty) { t.y += 4; activelyMoving = true; }
            else if (t.y > ty + 10) { t.y = ty; activelyMoving = true; } // allow falling into newly created holes

            // Instant death if falling off-screen
            if (t.y > 1000) {
                t.health = 0;
                checkWinner();
            }
        });

        if (activelyMoving) return;

        if (gameState.particles.length < 5) {
            if (gameState.actionType === 'fire') {
                if (gameState.role === gameState.currentTurn) {
                    ws.send(JSON.stringify({type: "TURN_END"}));
                }
            } else if (gameState.actionType === 'move') {
                gameState.actionType = null;
                updateGameUI();
            }
            gameState.isSimulating = false;
        }
    }
}

function gameLoop() {
    
    if (gameState.currentView === 'game') {
        updatePhysics();
        renderer.clear();
        
        if (gameState.terrain) {
            renderer.drawTerrain(gameState.terrain);
            
            // Calculate slopes for tanks
            let getAngle = (x) => {
                let dx = 8;
                let y1 = gameState.terrain[Math.max(0, Math.floor(x - dx))];
                let y2 = gameState.terrain[Math.min(LOGICAL_WIDTH - 1, Math.floor(x + dx))];
                return Math.atan2(y2 - y1, dx * 2);
            };

            renderer.drawTank(gameState.p1.x, gameState.p1.y, '#00e5ff', gameState.currentTurn === 'p1', getAngle(gameState.p1.x));
            renderer.drawTank(gameState.p2.x, gameState.p2.y, '#ff007f', gameState.currentTurn === 'p2', getAngle(gameState.p2.x));
        }

        // Draw Ghost Trajectory (exact terrain-intersecting arc)
        if (gameState.role === gameState.currentTurn && !gameState.isSimulating && !gameState.winner) {
             const angleRad = parseInt(angleSlider.value) * (Math.PI / 180);
             const velocity = (parseInt(powerSlider.value) / 100) * 18 + 4;
             
             const startX = gameState.role === 'p1' ? gameState.p1.x : gameState.p2.x;
             const startY = gameState.role === 'p1' ? gameState.p1.y - 20 : gameState.p2.y - 20; 
             const gvx = Math.cos(angleRad) * velocity;
             const gvy = -Math.sin(angleRad) * velocity;
             
             // Simulate until terrain or tank hit
             renderer.drawGhostArcPrecise(startX, startY, gvx, gvy, gameState.role, gameState.terrain, gameState.p1, gameState.p2);
        }
        
        for (let proj of gameState.projectiles) renderer.drawProjectile(proj);
        renderer.drawParticles(gameState.particles);
    }
    
    requestAnimationFrame(gameLoop);
}

// Start
init();
