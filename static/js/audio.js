class AudioEngine {
    constructor() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn("AudioContext not supported");
            this.ctx = null;
        }
        this.enabled = true;
        this.bgMusic = null;
        this.introMusic = null;
        this.winMusic = null;
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    // Load and play an MP3 from the /static/music/ folder
    playMusic(filename, loop = true, volume = 0.3) {
        if (!this.enabled) return null;
        try {
            this.resume();
            const audio = new Audio(`/static/music/${filename}`);
            audio.loop = loop;
            audio.volume = volume;
            audio.play().catch(e => {
                console.log(`Music play deferred or failed for ${filename}:`, e.message);
            });
            return audio;
        } catch (e) {
            console.error(`Failed to play music ${filename}:`, e);
            return null;
        }
    }

    startBgMusic() {
        if (!this.enabled || this.bgMusic) return;
        this.bgMusic = this.playMusic('bg.mp3', true, 0.4); // 40% volume
    }

    stopBgMusic() {
        if (this.bgMusic) {
            try { this.bgMusic.pause(); } catch(e) {}
            this.bgMusic = null;
        }
    }

    startIntroMusic() {
        if (!this.enabled || this.introMusic) return;
        this.introMusic = this.playMusic('intro.mp3', true, 0.9); // 90% volume
    }

    stopIntroMusic() {
        if (this.introMusic) {
            try { this.introMusic.pause(); } catch(e) {}
            this.introMusic = null;
        }
    }

    startWinMusic() {
        if (!this.enabled || this.winMusic) return;
        this.winMusic = this.playMusic('win.mp3', false, 0.8); // 80% volume
    }

    stopWinMusic() {
        if (this.winMusic) {
            try { this.winMusic.pause(); } catch(e) {}
            this.winMusic = null;
        }
    }

    playSound(type) {
        if (!this.enabled) return;
        this.resume();

        const now = this.ctx.currentTime;

        if (type === 'shoot') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } 
        else if (type === 'hit') {
            const bufferSize = this.ctx.sampleRate * 0.4;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now);
            filter.frequency.linearRampToValueAtTime(80, now + 0.4);
            const gain = this.ctx.createGain();
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            noise.start(now);
            noise.stop(now + 0.4);
        }
        else if (type === 'move') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(80, now);
            osc.frequency.linearRampToValueAtTime(60, now + 0.15);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        }
        else if (type === 'turn') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(900, now + 0.12);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        }
        else if (type === 'win') {
            // Victory fanfare: ascending triad
            [0, 0.15, 0.30].forEach((offset, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.type = 'sine';
                const freqs = [523, 659, 784];
                osc.frequency.setValueAtTime(freqs[idx], now + offset);
                gain.gain.setValueAtTime(0.3, now + offset);
                gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.6);
                osc.start(now + offset);
                osc.stop(now + offset + 0.6);
            });
        }
        else if (type === 'pick') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.linearRampToValueAtTime(660, now + 0.08);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        }
    }
}

const AudioSys = new AudioEngine();
// Try to start intro music on first interaction
window.addEventListener('click', () => AudioSys.resume(), { once: true });
