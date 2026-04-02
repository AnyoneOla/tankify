class Renderer {
    constructor(canvas, logicalWidth) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.logicalWidth = logicalWidth;
        this.scale = 1;
        this.logicalHeight = 1000;
        this.bgGradient = null;
        this.stars = [];
        for (let i = 0; i < 50; i++) {
            this.stars.push({
                x: Math.random() * this.logicalWidth,
                y: Math.random() * this.logicalHeight * 0.8,
                size: Math.random() * 1.5 + 0.5,
                alpha: Math.random() * 0.5 + 0.2
            });
        }
    }

    resize(w, h) {
        this.canvas.width = w;
        this.canvas.height = h;
        
        // Exact 1000 width scale
        this.scale = w / this.logicalWidth;
        
        // Dynamic logical height based on actual flex space
        this.logicalHeight = h / this.scale;
        
        // Centering offsets removed, fills the container perfectly!
        this.offsetX = 0;
        this.offsetY = 0;
        
        // Cache gradient
        this.bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.logicalHeight);
        this.bgGradient.addColorStop(0, '#0a0a12');
        this.bgGradient.addColorStop(0.4, '#1b1b3a');
        this.bgGradient.addColorStop(1, '#0f0f20');
    }

    clear() {
        this.ctx.resetTransform();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.scale(this.scale, this.scale);
        
        // Draw sky background strictly within logical bounds
        this.ctx.fillStyle = this.bgGradient;
        this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
        
        // Draw Stars
        this.ctx.fillStyle = '#ffffff';
        for (let s of this.stars) {
            this.ctx.globalAlpha = s.alpha + Math.sin(Date.now() * 0.002 + s.x) * 0.2;
            this.ctx.beginPath();
            this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1.0;
    }

    drawTerrain(terrain) {
        if (!terrain) return;
        
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.logicalHeight);
        
        // Downsample terrain slightly for performance if needed, but 1000 is fine.
        for (let i = 0; i < terrain.length; i++) {
            this.ctx.lineTo(i, terrain[i]);
        }
        
        this.ctx.lineTo(this.logicalWidth, this.logicalHeight);
        this.ctx.closePath();

        // Neu-Glass Terrain Edge
        this.ctx.lineWidth = 5;
        this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.8)';
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = '#00e5ff';
        this.ctx.stroke();
        
        // Terrain Fill
        this.ctx.shadowBlur = 0;
        const grad = this.ctx.createLinearGradient(0, Math.min(...terrain), 0, this.logicalHeight);
        grad.addColorStop(0, 'rgba(0, 229, 255, 0.15)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
        this.ctx.fillStyle = grad;
        this.ctx.fill();
    }

    drawTank(x, y, color, isCurrentTurn, angle = 0) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);
        
        // Ground-level glow ring (always visible)
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 22, 0, Math.PI * 2);
        this.ctx.fillStyle = color + '22';
        this.ctx.fill();
        
        // Tank Body
        this.ctx.fillStyle = isCurrentTurn ? color : '#666';
        this.ctx.shadowBlur = isCurrentTurn ? 30 : 8;
        this.ctx.shadowColor = color;
        
        // Chassis (wider)
        this.ctx.fillRect(-22, -8, 44, 14);
        
        // Dome
        this.ctx.beginPath();
        this.ctx.arc(0, -8, 14, Math.PI, 0);
        this.ctx.fill();
        
        // Barrel
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -10);
        this.ctx.lineTo(isCurrentTurn ? 20 : 0, -25);
        this.ctx.stroke();
        
        // Treads
        this.ctx.fillStyle = '#111';
        this.ctx.shadowBlur = 0;
        this.ctx.fillRect(-24, 6, 48, 10);
        
        // Turret dot
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(0, -8, 5, 0, Math.PI*2);
        this.ctx.fill();

        this.ctx.restore();
    }
    
    drawGhostArcPrecise(startX, startY, vx, vy, role, terrain, p1, p2) {
        this.ctx.beginPath();
        let px = startX;
        let py = startY;
        let pvx = vx;
        let pvy = vy;
        
        this.ctx.moveTo(px, py);
        
        const hitboxR = 18;
        
        // Simulate up to 250 frames
        for(let i = 0; i < 250; i++){
            px += pvx;
            py += pvy;
            pvy += 0.2; // GRAVITY
            
            // Check terrain collision
            const tx = Math.floor(px);
            if (tx >= 0 && tx < terrain.length && py >= terrain[tx]) {
                this.ctx.lineTo(tx, terrain[tx]);
                break;
            }
            
            // Check tank collision (only after 10 frames to skip self)
            if (i > 10) {
                const d1 = Math.sqrt((px - p1.x)**2 + (py - p1.y)**2);
                const d2 = Math.sqrt((px - p2.x)**2 + (py - p2.y)**2);
                if (d1 < hitboxR || d2 < hitboxR) {
                    this.ctx.lineTo(px, py);
                    break;
                }
            }
            
            // Off-screen
            if (px < 0 || px >= this.logicalWidth || py > this.logicalHeight + 100) break;
            
            if (i % 2 === 0) {
                 this.ctx.lineTo(px, py);
            }
        }
        
        this.ctx.strokeStyle = role === 'p1' ? 'rgba(0, 229, 255, 0.5)' : 'rgba(255, 0, 127, 0.5)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([10, 15]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    drawProjectile(proj) {
        this.ctx.beginPath();
        this.ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = '#fff';
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#fff';
        this.ctx.fill();
        
        // Trail
        if (proj.trail && proj.trail.length > 0) {
            this.ctx.shadowBlur = 0;
            this.ctx.beginPath();
            this.ctx.moveTo(proj.trail[0].x, proj.trail[0].y);
            for (let i = 1; i < proj.trail.length; i++) {
                this.ctx.lineTo(proj.trail[i].x, proj.trail[i].y);
            }
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    }

    drawParticles(particles) {
        for (let p of particles) {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1.0;
        this.ctx.shadowBlur = 0;
    }
}
