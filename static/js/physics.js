// Math and Physics utilities

const GRAVITY = 0.2;
const LOGICAL_WIDTH = 1000;

class Physics {
    static generateTerrain(seed) {
        const heights = new Array(LOGICAL_WIDTH).fill(0);
        let s = seed;
        const random = () => {
            s = Math.sin(s) * 10000;
            return s - Math.floor(s);
        };
        const p1 = random() * Math.PI * 2;
        const p2 = random() * Math.PI * 2;
        const p3 = random() * Math.PI * 2;

        // Base height 600 instead of 900 for better visibility in 1000h area
        let baseHeight = 600;
        
        for (let i = 0; i < LOGICAL_WIDTH; i++) {
            let h = baseHeight;
            // Clamped harmonics to avoid extreme peaks/valleys
            h += Math.sin(i * 0.003 + p1) * 150; 
            h += Math.sin(i * 0.01 + p2) * 50;  
            h += Math.sin(i * 0.04 + p3) * 10;   
            
            // Hard clamp to ensure visibility (leaving 200px margin at top/bottom)
            heights[i] = Math.max(300, Math.min(800, h));
        }
        
        return Physics.smoothTerrain(heights, 15);
    }

    static smoothTerrain(heights, passes) {
        let result = [...heights];
        for (let p = 0; p < passes; p++) {
            let temp = [...result];
            for (let i = 1; i < result.length - 1; i++) {
                temp[i] = (result[i-1] + result[i] + result[i+1]) / 3;
            }
            result = temp;
        }
        return result;
    }

    static createCrater(terrain, cx, cy, radius, type = 'destroy') {
        const width = terrain.length;
        for (let x = Math.max(0, cx - radius); x <= Math.min(width - 1, cx + radius); x++) {
            const dx = x - cx;
            const dy = Math.sqrt(radius * radius - dx * dx);
            
            if (type === 'destroy') {
                const topOfCrater = cy - dy;
                const bottomOfCrater = cy + dy;
                if (terrain[x] < bottomOfCrater && terrain[x] >= topOfCrater) {
                    terrain[x] = bottomOfCrater;
                } else if (terrain[x] < topOfCrater) {
                    terrain[x] += dy;
                }
            } else if (type === 'add') {
                // Creates a mound connecting to current terrain
                const topOfCrater = cy - dy;
                if (terrain[x] > topOfCrater) {
                    terrain[x] -= dy * 0.5; // Smooth mound
                }
            } else if (type === 'wall') {
                // Vertical column
                if (Math.abs(dx) < radius * 0.3) {
                    terrain[x] -= radius * 3;
                }
            } else if (type === 'canyon') {
                // Deep sliver
                if (Math.abs(dx) < radius * 0.5) {
                    terrain[x] += radius * 4;
                }
            } else if (type === 'earthquake') {
                terrain[x] = (terrain[x] * 0.95) + (1500 * 0.05); // flatten towards 1500
            }
        }
        return Physics.smoothTerrain(terrain, 2);
    }
}
