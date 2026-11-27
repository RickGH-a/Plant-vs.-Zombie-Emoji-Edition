        // ---------------------------------------------------------------------------------
        // Web Audio engine: procedural sound effects + a sequenced, multi-section soundtrack.
        // Everything is synthesized (no files): oscillators, filtered noise, envelopes.
        // ---------------------------------------------------------------------------------
        let audioCtx = null, masterGain = null, sfxBus = null, musicBus = null, noiseBuf = null;
        let isBgmOn = (() => { try { return localStorage.getItem('pvzMusicOn') !== '0'; } catch (_) { return true; } })();
        let audioVoices = 0;

        function initAudio() {
            if (!audioCtx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return;
                audioCtx = new AC();
                const comp = audioCtx.createDynamicsCompressor();
                comp.threshold.value = -16; comp.knee.value = 20; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
                masterGain = audioCtx.createGain(); masterGain.gain.value = 0.9;
                sfxBus = audioCtx.createGain(); sfxBus.gain.value = 1;
                musicBus = audioCtx.createGain(); musicBus.gain.value = 0.42;
                sfxBus.connect(masterGain); musicBus.connect(masterGain); masterGain.connect(comp); comp.connect(audioCtx.destination);
                noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
                const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            }
            if (audioCtx.state === 'suspended') audioCtx.resume();
            musicSync();
        }
        // Tone: o = {type, to (slide target), vol, delay, atk, lp (lowpass), bus, detune}
        function tn(freq, dur, o = {}) {
            if (!audioCtx) return;
            const isMusic = o.bus === musicBus;
            if (!isMusic && audioVoices > (perfLevel >= 2 ? 9 : perfLevel === 1 ? 15 : 22)) return;
            const t = audioCtx.currentTime + (o.delay || 0);
            const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
            osc.type = o.type || 'sine';
            osc.frequency.setValueAtTime(freq, t);
            if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + dur);
            if (o.detune) osc.detune.value = o.detune;
            const atk = o.atk || 0.006, vol = o.vol == null ? 0.2 : o.vol;
            g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + atk);
            g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, atk + 0.02));
            let node = osc;
            if (o.lp) { const f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
            node.connect(g); g.connect(o.bus || sfxBus);
            osc.start(t); osc.stop(t + dur + 0.05);
            if (!isMusic) { audioVoices++; osc.onended = () => { audioVoices--; }; }
        }
        // Noise burst: o = {ft (filter type), f1, f2 (sweep target), q, vol, delay, atk, bus}
        function nz(dur, o = {}) {
            if (!audioCtx) return;
            const isMusic = o.bus === musicBus;
            if (!isMusic && audioVoices > (perfLevel >= 2 ? 9 : perfLevel === 1 ? 15 : 22)) return;
            const t = audioCtx.currentTime + (o.delay || 0);
            const src = audioCtx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
            const f = audioCtx.createBiquadFilter(); f.type = o.ft || 'lowpass'; f.Q.value = o.q || 0.7;
            f.frequency.setValueAtTime(o.f1 || 1000, t);
            if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + dur);
            const g = audioCtx.createGain(), atk = o.atk || 0.004, vol = o.vol == null ? 0.2 : o.vol;
            g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + atk);
            g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, atk + 0.02));
            src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
            src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
            if (!isMusic) { audioVoices++; src.onended = () => { audioVoices--; }; }
        }
        const rr = (a, b) => a + Math.random() * (b - a);

        const SFX = {
            plant() { nz(0.12, { ft: 'bandpass', f1: 900, f2: 400, vol: 0.12 }); tn(180, 0.14, { to: 320, vol: 0.22 }); tn(440, 0.09, { delay: 0.05, type: 'triangle', vol: 0.08 }); },
            dig() { nz(0.18, { ft: 'lowpass', f1: 700, vol: 0.28 }); tn(110, 0.12, { to: 70, vol: 0.18 }); },
            shoot() { const p = rr(0.92, 1.1); tn(640 * p, 0.09, { to: 230 * p, vol: 0.16 }); nz(0.04, { ft: 'highpass', f1: 3000, vol: 0.04 }); },
            iceshot() { tn(900, 0.12, { to: 500, vol: 0.12 }); tn(1800, 0.1, { delay: 0.02, vol: 0.05 }); },
            fireshot() { nz(0.16, { ft: 'bandpass', f1: 600, f2: 1800, q: 1, vol: 0.14 }); tn(300, 0.12, { to: 160, type: 'sawtooth', lp: 900, vol: 0.06 }); },
            needle() { tn(2100, 0.07, { to: 1300, type: 'triangle', vol: 0.09 }); nz(0.03, { ft: 'highpass', f1: 5000, vol: 0.05 }); },
            lob() { tn(190, 0.2, { to: 430, vol: 0.26 }); nz(0.14, { ft: 'bandpass', f1: 500, f2: 1300, vol: 0.1 }); },
            cannonshot() { nz(0.5, { ft: 'lowpass', f1: 900, f2: 70, vol: 0.5 }); tn(80, 0.4, { to: 30, vol: 0.55 }); nz(0.3, { ft: 'bandpass', f1: 400, f2: 2000, delay: 0.05, vol: 0.15 }); },
            rotoshot() { tn(900, 0.16, { to: 350, type: 'triangle', vol: 0.15 }); nz(0.14, { ft: 'bandpass', f1: 1800, f2: 500, vol: 0.12 }); tn(160, 0.1, { to: 100, vol: 0.18 }); },
            pea_hit() { tn(210, 0.07, { to: 90, type: 'triangle', vol: 0.2 }); nz(0.05, { ft: 'lowpass', f1: 1500, vol: 0.1 }); },
            hit() { tn(140, 0.08, { to: 60, type: 'square', vol: 0.1 }); nz(0.05, { ft: 'lowpass', f1: 1200, vol: 0.1 }); },
            thunk() { tn(150, 0.11, { to: 65, type: 'triangle', vol: 0.32 }); nz(0.06, { ft: 'lowpass', f1: 900, vol: 0.16 }); },
            pop() { tn(900, 0.05, { to: 300, vol: 0.2 }); nz(0.04, { ft: 'highpass', f1: 3500, vol: 0.08 }); },
            boing() { tn(220, 0.12, { to: 540, vol: 0.2 }); tn(540, 0.22, { delay: 0.12, to: 250, vol: 0.18 }); },
            splat() { nz(0.2, { ft: 'lowpass', f1: 1400, f2: 300, vol: 0.38 }); tn(130, 0.15, { to: 48, vol: 0.34 }); nz(0.12, { ft: 'bandpass', f1: 2200, delay: 0.04, vol: 0.1 }); },
            bonk() { tn(330, 0.11, { to: 110, vol: 0.36 }); nz(0.04, { ft: 'bandpass', f1: 1300, vol: 0.2 }); tn(660, 0.05, { vol: 0.08 }); },
            smack() { nz(0.07, { ft: 'bandpass', f1: 1500, vol: 0.32 }); tn(210, 0.09, { to: 100, vol: 0.22 }); },
            prick() { tn(1500, 0.05, { to: 900, type: 'square', vol: 0.05 }); },
            sunpop() { tn(500, 0.12, { to: 900, vol: 0.1 }); tn(1100, 0.1, { delay: 0.06, vol: 0.06 }); },
            sun() { tn(880, 0.35, { vol: 0.14 }); tn(1318, 0.4, { delay: 0.07, vol: 0.1 }); tn(1760, 0.3, { delay: 0.14, vol: 0.05 }); },
            bean() { [523, 659, 784, 1047].forEach((f, i) => tn(f, 0.2, { delay: i * 0.06, type: 'triangle', vol: 0.15 })); },
            super() { [262, 330, 392, 523, 659].forEach((f, i) => tn(f, 0.28, { delay: i * 0.05, type: 'triangle', vol: 0.15 })); tn(200, 0.5, { to: 900, type: 'sawtooth', lp: 1500, vol: 0.08 }); nz(0.5, { ft: 'highpass', f1: 2500, vol: 0.06, atk: 0.2 }); },
            boom() { nz(0.75, { ft: 'lowpass', f1: 2600, f2: 70, vol: 0.55 }); tn(95, 0.55, { to: 28, vol: 0.55 }); tn(55, 0.6, { to: 25, vol: 0.4 }); },
            mower() { tn(70, 0.6, { to: 220, type: 'sawtooth', lp: 700, vol: 0.2 }); nz(0.6, { ft: 'bandpass', f1: 300, f2: 1400, vol: 0.2 }); },
            chomp() { for (let i = 0; i < 3; i++) { nz(0.07, { ft: 'bandpass', f1: rr(1400, 2200), q: 2, vol: 0.26, delay: i * 0.09 }); tn(rr(100, 130), 0.08, { to: 65, type: 'triangle', vol: 0.18, delay: i * 0.09 }); } tn(150, 0.14, { delay: 0.3, to: 60, vol: 0.14 }); },
            zap() { for (let i = 0; i < 9; i++) tn(rr(180, 1500), 0.035, { type: 'sawtooth', delay: i * 0.024, vol: 0.07, lp: 3500 }); nz(0.28, { ft: 'highpass', f1: 3800, vol: 0.12 }); tn(58, 0.3, { type: 'sawtooth', lp: 250, vol: 0.1 }); nz(0.03, { ft: 'highpass', f1: 2000, vol: 0.32 }); },
            bigzap() { SFX.zap(); nz(0.6, { ft: 'lowpass', f1: 1500, f2: 100, vol: 0.4, delay: 0.05 }); tn(45, 0.5, { to: 25, vol: 0.45, delay: 0.05 }); for (let i = 0; i < 10; i++) tn(rr(300, 2400), 0.03, { type: 'square', delay: 0.05 + i * 0.03, vol: 0.05, lp: 4000 }); },
            ice() { [2093, 2637, 3136, 3951].forEach((f, i) => tn(f, 0.22, { delay: i * 0.035, vol: 0.07 })); nz(0.2, { ft: 'highpass', f1: 6000, vol: 0.09 }); },
            freeze() { SFX.ice(); nz(0.35, { ft: 'bandpass', f1: 2500, f2: 800, vol: 0.18 }); tn(160, 0.25, { to: 80, type: 'triangle', vol: 0.2, delay: 0.1 }); },
            fire() { nz(0.5, { ft: 'bandpass', f1: 400, f2: 2200, q: 0.8, vol: 0.3, atk: 0.08 }); for (let i = 0; i < 6; i++) nz(0.03, { ft: 'highpass', f1: 3000, vol: 0.18, delay: rr(0.05, 0.45) }); tn(110, 0.45, { to: 70, type: 'sawtooth', lp: 400, vol: 0.12 }); },
            whoosh() { nz(0.95, { ft: 'bandpass', f1: 300, f2: 1800, q: 0.6, vol: 0.34, atk: 0.35 }); nz(0.6, { ft: 'bandpass', f1: 1800, f2: 400, delay: 0.5, vol: 0.2 }); },
            vault() { nz(0.25, { ft: 'bandpass', f1: 400, f2: 1600, vol: 0.25 }); tn(260, 0.22, { to: 700, vol: 0.2 }); tn(160, 0.15, { delay: 0.3, to: 70, type: 'triangle', vol: 0.25 }); },
            groan(p = 1) { p *= rr(0.9, 1.15); tn(105 * p, 0.8, { to: 66 * p, type: 'sawtooth', lp: 380, vol: 0.12, atk: 0.12 }); tn(110 * p, 0.8, { to: 70 * p, type: 'sawtooth', lp: 380, vol: 0.1, atk: 0.12, detune: 25 }); nz(0.6, { ft: 'bandpass', f1: 320, q: 2, vol: 0.05 }); },
            roar() { tn(72, 1.2, { to: 40, type: 'sawtooth', lp: 520, vol: 0.28, atk: 0.1 }); tn(76, 1.2, { to: 44, type: 'square', lp: 450, vol: 0.14, atk: 0.1, detune: 30 }); nz(1, { ft: 'lowpass', f1: 700, f2: 200, vol: 0.28 }); },
            slam() { SFX.boom(); nz(0.5, { ft: 'bandpass', f1: 600, f2: 150, vol: 0.3, delay: 0.05 }); for (let i = 0; i < 4; i++) nz(0.04, { ft: 'highpass', f1: 2000, vol: 0.2, delay: 0.1 + i * 0.07 }); },
            step() { tn(60, 0.12, { to: 38, vol: 0.28 }); nz(0.07, { ft: 'lowpass', f1: 500, vol: 0.12 }); },
            cluck() { for (let i = 0; i < 3; i++) { tn(rr(700, 950), 0.06, { to: rr(450, 600), type: 'square', lp: 2200, vol: 0.07, delay: i * 0.09 }); } },
            snort() { nz(0.3, { ft: 'bandpass', f1: 220, q: 1.2, vol: 0.3 }); tn(58, 0.22, { to: 36, vol: 0.38 }); tn(58, 0.22, { to: 36, vol: 0.38, delay: 0.17 }); },
            piano() { [220, 262, 330, 440].forEach((f, i) => { tn(f, 0.9, { type: 'triangle', vol: 0.1, delay: i * 0.025 }); tn(f * 2, 0.4, { vol: 0.03, delay: i * 0.025 }); }); nz(0.03, { ft: 'bandpass', f1: 2500, vol: 0.1 }); },
            funk() { [110, 110, 131, 165, 147].forEach((f, i) => { tn(f, 0.12, { type: 'square', lp: 900, vol: 0.12, delay: i * 0.11 }); nz(0.03, { ft: 'highpass', f1: 7000, vol: 0.06, delay: i * 0.11 }); }); tn(1200, 0.35, { to: 600, type: 'sawtooth', lp: 1800, vol: 0.04, delay: 0.1 }); },
            rip() { nz(0.32, { ft: 'bandpass', f1: 2200, f2: 5200, q: 1.2, vol: 0.3 }); tn(150, 0.45, { to: 90, type: 'sawtooth', lp: 500, vol: 0.18, delay: 0.1 }); },
            rumble() { nz(0.9, { ft: 'lowpass', f1: 220, vol: 0.5, atk: 0.1 }); tn(45, 0.9, { to: 30, vol: 0.4, atk: 0.1 }); for (let i = 0; i < 5; i++) nz(0.04, { ft: 'bandpass', f1: rr(500, 1500), vol: 0.14, delay: rr(0.1, 0.8) }); },
            cannonfire() { SFX.thunk(); tn(240, 0.5, { to: 900, type: 'triangle', vol: 0.14, delay: 0.05 }); nz(0.25, { ft: 'bandpass', f1: 800, f2: 2500, vol: 0.14, delay: 0.05 }); },
            zdie() { tn(190, 0.55, { to: 48, type: 'sawtooth', lp: 650, vol: 0.14, atk: 0.02 }); nz(0.18, { ft: 'lowpass', f1: 800, vol: 0.18, delay: 0.38 }); tn(90, 0.12, { to: 40, vol: 0.3, delay: 0.4 }); },
            garlic() { tn(230, 0.2, { to: 120, type: 'sawtooth', lp: 900, vol: 0.12 }); nz(0.15, { ft: 'bandpass', f1: 1000, vol: 0.1 }); },
            roto() { nz(1.1, { ft: 'bandpass', f1: 300, f2: 2600, q: 0.8, vol: 0.28, atk: 0.3 }); tn(200, 1.1, { to: 1000, type: 'triangle', vol: 0.1, atk: 0.3 }); for (let i = 0; i < 7; i++) tn(500 + i * 60, 0.08, { type: 'sine', vol: 0.05, delay: i * 0.12 }); },
            rotodrop() { tn(1900, 0.55, { to: 220, vol: 0.18 }); nz(0.5, { ft: 'bandpass', f1: 3000, f2: 500, vol: 0.15 }); },
            steal() { [1318, 1047, 784, 523].forEach((f, i) => tn(f, 0.25, { delay: i * 0.08, type: 'triangle', vol: 0.14 })); nz(0.35, { ft: 'bandpass', f1: 3000, f2: 800, vol: 0.08 }); },
            levelup() { [392, 494, 587, 784].forEach((f, i) => tn(f, 0.4, { delay: i * 0.09, type: 'triangle', vol: 0.16 })); },
            wave() { playWaveHorn(false); }
        };
        const soundLast = {};
        function playSound(type, arg) {
            if (!audioCtx) return;
            const nowMs = performance.now();
            // Under heavy fire the sound effects thin out so the audio thread and GC stay calm.
            const load = (typeof projectiles !== 'undefined' ? projectiles.length : 0) + (typeof diagShots !== 'undefined' ? diagShots.length : 0);
            const mul = (load > 200 ? 2.6 : load > 100 ? 1.8 : load > 50 ? 1.3 : 1) * (1 + perfLevel * 0.9);
            const gap = ((type === 'hit' || type === 'pea_hit' || type === 'shoot') ? 90 : 55) * mul;
            if (nowMs - (soundLast[type] || 0) < gap) return;
            if (load > 40 && nowMs - (soundLast.__any || 0) < 22) return;
            soundLast[type] = nowMs; soundLast.__any = nowMs;
            const fn = SFX[type] || SFX.hit;
            try { fn(arg); } catch (e) {}
        }
        // Which sound a projectile makes when it hits a zombie.
        var _hitSnd = null;
        function hitSoundFor(t) {
            return (_hitSnd || (_hitSnd = { ...NP_HIT, normal: 'pea_hit', ice: 'ice', fire: 'fire', lightning: 'zap', citron: 'bigzap', rotobaga: 'thunk', primal: 'bonk', cabbage: 'thunk', corn: 'pop', butter: 'boing', melon: 'splat', wintermelon: 'splat', coconut: 'boom', giantpea: 'bonk', needle: 'needle', 'electric-needle': 'zap' }))[t] || 'hit';
        }
        function superSoundFor(k) {
            return ({ cherrybomb: 'boom', jalapeno: 'fire', firepea: 'fire', firedragon: 'fire', snowpea: 'ice', snowdragon: 'freeze', iceberglettuce: 'freeze', lightningreed: 'bigzap', blover: 'whoosh', potatomine: 'boom', coconutcannon: 'cannonshot', bonkchoy: 'bonk', celery: 'smack', sunflower: 'sun', twinsunflower: 'sun', sunshroom: 'sun', garlic: 'garlic', rotobaga: 'roto', citron: 'bigzap', wallnut: 'thunk', tallnut: 'thunk' })[k] || 'super';
        }
        // Wave warning: war-horn blasts, heartbeat taiko, rising siren, zombie groan chorus.
        function playWaveHorn(final) {
            if (!audioCtx) return;
            const blasts = final ? [0, 0.8, 1.6, 2.4] : [0, 0.75, 1.5];
            blasts.forEach((d, i) => {
                const f = 98 * Math.pow(1.05, i);
                tn(f, 0.7, { type: 'sawtooth', lp: 800, vol: 0.2, delay: d, atk: 0.06 });
                tn(f * 1.414, 0.7, { type: 'sawtooth', lp: 800, vol: 0.14, delay: d, atk: 0.06 });
                tn(f / 2, 0.7, { type: 'square', lp: 300, vol: 0.18, delay: d, atk: 0.06 });
            });
            for (let i = 0; i < (final ? 10 : 7); i++) { tn(85, 0.28, { to: 38, vol: 0.5, delay: 0.1 + i * 0.3 }); nz(0.1, { ft: 'bandpass', f1: 400, vol: 0.2, delay: 0.1 + i * 0.3 }); }
            nz(2.2, { ft: 'bandpass', f1: 200, f2: 2400, q: 0.9, vol: 0.18, atk: 1.6, delay: 0.2 });
            if (final) for (let i = 0; i < 6; i++) tn(i % 2 ? 620 : 880, 0.38, { to: i % 2 ? 880 : 620, type: 'sawtooth', lp: 1800, vol: 0.06, delay: 0.3 + i * 0.4 });
            [0.9, 1.2, 1.5, 1.8].forEach((d, i) => { tn(100 + i * 9, 0.9, { to: 62, type: 'sawtooth', lp: 360, vol: 0.09, delay: d, atk: 0.15 }); });
        }

        // ---------------------------- Soundtrack ----------------------------
        const NOTE_IDX = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
        function nf(name) {
            const m = /^([a-g])(#|b)?(\d)$/.exec(name); if (!m) return 0;
            const semi = NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12 * (Number(m[3]) + 1);
            return 440 * Math.pow(2, (semi - 69) / 12);
        }
        const CH = {
            Am: { r: 'a2', n: ['a3', 'c4', 'e4'] }, F: { r: 'f2', n: ['f3', 'a3', 'c4'] }, C: { r: 'c3', n: ['c4', 'e4', 'g4'] },
            G: { r: 'g2', n: ['g3', 'b3', 'd4'] }, E: { r: 'e2', n: ['e3', 'g#3', 'b3'] }, Dm: { r: 'd3', n: ['d4', 'f4', 'a4'] }, Bb: { r: 'bb2', n: ['bb3', 'd4', 'f4'] }
        };
        const SECTIONS = {
            A: { chords: ['Am', 'F', 'C', 'G'], style: 'theme', mel: [
                'a4 - - - c5 - e5 - a5 - g5 - e5 - c5 -', 'f4 - - - a4 - c5 - f5 - e5 - c5 - a4 -',
                'g4 - - - c5 - e5 - g5 - e5 - c5 - g4 -', 'g4 - b4 - d5 - g5 - f5 - d5 - b4 - g4 -'] },
            B: { chords: ['Am', 'F', 'C', 'E'], style: 'arp', mel: [
                'e5 - - e5 - c5 a4 - c5 - e5 - a5 - - -', 'c5 - - c5 - a4 f4 - a4 - c5 - f5 - - -',
                'e5 - - e5 - g5 c5 - e5 - g5 - c6 - - -', 'b4 - - b4 - d5 g#4 - b4 - e5 - g#5 - - -'] },
            C: { chords: ['F', 'G', 'Am', 'Am'], style: 'calm', mel: [
                'a4 - - - - - - - c5 - - - - - a4 -', 'b4 - - - - - - - d5 - - - - - b4 -',
                'c5 - - - e5 - - - a5 - - - e5 - - -', 'e5 - - - - - d5 - c5 - - - a4 - - -'] },
            D: { chords: ['Dm', 'Am', 'Bb', 'E'], style: 'tense', mel: [
                'd5 - f5 - a5 - f5 - d5 - f5 - a5 - f5 -', 'c5 - e5 - a5 - e5 - c5 - e5 - a5 - e5 -',
                'd5 - f5 - bb5 - f5 - d5 - f5 - bb5 - a5 -', 'g#4 - b4 - e5 - g#5 - b5 - g#5 - e5 - b4 -'] }
        };
        const SONG = ['A', 'A', 'B', 'C', 'A', 'B', 'D', 'D'];
        Object.values(SECTIONS).forEach(s => { s.melN = s.mel.map(b => b.split(' ').map(t => t === '-' ? 0 : nf(t))); });
        let musicTimer = null, musicNext = 0, musicStep = 0, musicBar = 0, musicIntensity = 1;

        function computeIntensity() {
            let lvl = 1;
            if (typeof currentWave !== 'undefined' && typeof maxWaves !== 'undefined' && maxWaves > 1 && currentWave >= maxWaves) lvl = 2;
            if (zombies && zombies.some(z => !z.isTomb && z.x < 28)) lvl = 3;
            if (zombies && zombies.some(z => z.isBoss)) lvl = Math.max(lvl, 2);
            return lvl;
        }
        function kick(t, v = 0.55) { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.22); }
        function mnz(t, dur, ft, f, vol, q = 0.7) { const s = audioCtx.createBufferSource(); s.buffer = noiseBuf; const fl = audioCtx.createBiquadFilter(); fl.type = ft; fl.frequency.value = f; fl.Q.value = q; const g = audioCtx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(fl); fl.connect(g); g.connect(musicBus); s.start(t, Math.random()); s.stop(t + dur + 0.02); }
        function mtone(t, f, dur, type, vol, lp, atk = 0.01) { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); let n = o; if (lp) { const fl = audioCtx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); n = fl; } n.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.03); }

        function scheduleMusicStep(step, t, spb) {
            const bar = Math.floor(step / 16), s16 = step % 16;
            const secIdx = Math.floor(bar / 4) % SONG.length, barInSec = bar % 4;
            const sec = SECTIONS[SONG[secIdx]], ch = CH[sec.chords[barInSec]], lvl = musicIntensity;
            const calm = sec.style === 'calm', tense = sec.style === 'tense', arp = sec.style === 'arp';
            const lastBarOfSection = barInSec === 3;
            // Bass
            if (!calm || lvl >= 2) {
                const bassSteps = tense ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 3, 6, 8, 11, 14];
                if (bassSteps.includes(s16)) {
                    const base = nf(ch.r), f = (s16 === 6 || s16 === 14) && !tense ? base * 1.5 : (s16 === 11 ? base * 2 : base);
                    mtone(t, f, spb * (tense ? 1.6 : 2.2), 'sawtooth', 0.15, 420);
                }
            } else if (s16 === 0) { mtone(t, nf(ch.r), spb * 14, 'sine', 0.16, 300, 0.2); }
            // Pad (strings) on the first step of each bar
            if (s16 === 0) ch.n.forEach((n, i) => { const f = nf(n); mtone(t, f, spb * 15, 'sawtooth', calm ? 0.035 : 0.018, calm ? 900 : 650, 0.35); mtone(t, f * 1.004, spb * 15, 'sawtooth', calm ? 0.03 : 0.014, 700, 0.35); });
            // Chord stabs (off-beats) in driving sections
            if (!calm && [2, 6, 10, 14].includes(s16) && lvl >= 1) ch.n.forEach(n => mtone(t, nf(n) * 2, spb * 1.1, 'square', 0.022, 1800));
            // Arpeggio
            if (arp || (tense && lvl >= 2)) { const a = [0, 1, 2, 1][s16 % 4]; if (s16 % 2 === 0 || arp) mtone(t, nf(ch.n[a]) * 2, spb * 0.9, 'triangle', 0.05, 3000); }
            // Lead melody
            const mf = sec.melN[barInSec][s16];
            if (mf) {
                mtone(t, mf, spb * (calm ? 3.4 : 1.9), calm ? 'sine' : 'triangle', calm ? 0.11 : 0.12, 3200, calm ? 0.04 : 0.008);
                if (!calm) mtone(t, mf, spb * 1.2, 'square', 0.03, 2200);
                if (secIdx % 8 >= 4 || lvl >= 3) mtone(t, mf * 2, spb * 1.2, 'sine', 0.04, 4000); // octave shimmer on repeats / danger
            }
            // Drums
            const drums = !calm || lvl >= 2;
            if (drums) {
                const kicks = lvl >= 3 || tense ? [0, 4, 8, 10, 12] : [0, 8, 10];
                if (kicks.includes(s16)) kick(t, 0.5);
                if (s16 === 4 || s16 === 12) { mnz(t, 0.14, 'bandpass', 1800, 0.22, 0.8); mtone(t, 190, 0.1, 'triangle', 0.12); }
                const hatStep = (lvl >= 2 || tense) ? 1 : 2;
                if (s16 % hatStep === 0) mnz(t, 0.04, 'highpass', 7000, (s16 % 4 === 2 ? 0.1 : 0.06));
                if (lastBarOfSection && s16 >= 12 && (tense || secIdx % 2 === 1)) { mnz(t, 0.09, 'bandpass', 2000, 0.2); } // snare-roll fill
            } else if (s16 === 0 || s16 === 8) { mnz(t, 0.05, 'highpass', 8000, 0.05); }
            // Danger heartbeat when zombies are close to the house
            if (lvl >= 3 && (s16 === 0 || s16 === 3)) mtone(t, 55, 0.25, 'sine', 0.3);
        }
        function musicTick() {
            if (!audioCtx || !isBgmOn || typeof isRunning === 'undefined' || !isRunning) { musicNext = 0; return; }
            const bpm = 116 + musicIntensity * 8;
            const spb = 60 / bpm / 4; // seconds per 16th note
            if (!musicNext || musicNext < audioCtx.currentTime - 0.3) { musicNext = audioCtx.currentTime + 0.06; }
            while (musicNext < audioCtx.currentTime + 0.25) {
                if (musicStep % 16 === 0) musicIntensity = computeIntensity();
                scheduleMusicStep(musicStep, musicNext, spb);
                musicNext += spb; musicStep++;
            }
        }
        function musicSync() {
            if (audioCtx && isBgmOn && !musicTimer) musicTimer = setInterval(musicTick, 70);
            if ((!audioCtx || !isBgmOn) && musicTimer) { clearInterval(musicTimer); musicTimer = null; }
            const btn = document.getElementById('bgm-btn');
            if (btn) {
                btn.textContent = isBgmOn ? '🔊 Sound On' : '🔇 Sound Off';
                btn.className = isBgmOn ? 'px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 active:scale-95 text-white font-bold rounded-lg shadow transition-all text-sm' : 'px-3 py-1.5 bg-indigo-800 hover:bg-indigo-700 active:scale-95 text-slate-300 font-bold rounded-lg shadow transition-all text-sm';
            }
        }
        function toggleBGM() {
            isBgmOn = !isBgmOn;
            try { localStorage.setItem('pvzMusicOn', isBgmOn ? '1' : '0'); } catch (_) {}
            initAudio(); musicSync();
            if (isBgmOn) { musicStep = 0; musicNext = 0; }
        }
        document.addEventListener('DOMContentLoaded', musicSync);

        // Game Constants & Config
        const ROWS = 5;
        const COLS = 8;
        
        // Canonical PvZ2 reference data for the added plants. The attack icon is the
        // projectile / effect players should see; non-attacking support plants say so.
        const PVZ2_PLANT_LORE = {
            laserbean:{attack:'🔴',attackName:'Piercing laser beam',description:'Fires an instant laser down its whole lane that damages every zombie in it.',characteristic:'Pierces every zombie in the lane at once.',plantFood:'Fires four rapid giant lasers down its lane and sweeps every other lane with a laser too.'},
            infinut:{attack:'🛡️',attackName:'No attack (force-field wall)',description:'A wall with a force field that absorbs damage, then recharges itself after a short time.',characteristic:'Shield breaks, then regenerates endlessly.',plantFood:'Becomes invincible for several seconds with a restored shield and shocks nearby zombies.'},
            magnetshroom:{attack:'🧲',attackName:'Magnetic pull (no projectile)',description:'Rips metal buckets, helmets and vehicle parts off nearby zombies, damaging and stunning them.',characteristic:'Only affects metal-armored zombies, once each.',plantFood:'Pulls metal off every zombie on the lawn and yanks the rest toward it.'},
            thymewarp:{attack:'⏳',attackName:'Time rewind (instant use)',description:'Rewinds time around it: nearby zombies are thrown back and frozen in time while plants recover health.',characteristic:'Single-use support plant.',plantFood:'Warps the whole lawn: every zombie is pushed back and frozen, every plant heals.'},
            intensivecarrot:{attack:'🥕',attackName:'No attack (revives plants)',description:'When another plant is destroyed, this carrot is consumed to bring it back to life.',characteristic:'Single-use guardian that revives one fallen plant.',plantFood:'Heals every plant fully and revives plants that fell in the last 12 seconds.'},
            primalsunflower:{attack:'☀️',attackName:'Produces sun (no projectile)',description:'Produces two small suns each cycle and a big Primal Sun every third cycle.',characteristic:'Faster, richer sun than a normal Sunflower.',plantFood:'Bursts out eight suns around itself.'},
            primalpotatomine:{attack:'💥',attackName:'Contact area explosion',description:'Arms quickly, then explodes on contact, blasting and stunning every zombie in a 3x3 area.',characteristic:'Single-use explosive; arms in 3 seconds.',plantFood:'Detonates mines on six zombies across the lawn.'},
            bowlingbulb:{attack:'🎳',attackName:'Bouncing bowling bulb',description:'Rolls a bulb that knocks zombies back and bounces into neighbouring lanes, hitting up to five zombies.',characteristic:'Bulb ricochets between lanes.',plantFood:'Rolls a giant bulb down every lane that hits up to twelve zombies each.'},
            grimrose:{attack:'🥀',attackName:'Cursed thorns',description:'Throws cursed thorns that deal damage over time; the curse spreads to nearby zombies when a cursed zombie dies.',characteristic:'Curse spreads on death.',plantFood:'Curses every zombie on the lawn with a strong damage-over-time curse.'},
            shadowshroom:{attack:'🌑',attackName:'Shadow bolt',description:'Fires shadow bolts that slow and weaken zombies (they bite for less) while healing nearby plants.',characteristic:'Life-steal for plants around it.',plantFood:'Shadow nova hurts, slows and weakens every zombie and heals every plant.'},
            dusklobber:{attack:'🌘',attackName:'Lobbed dusk spore',description:'Lobs a dusk spore that splashes nearby zombies and curses them with damage over time.',characteristic:'Area damage plus curse.',plantFood:'Rains dusk meteors on eight zombies.'},
            chomper:{attack:'🦷',attackName:'Swallows zombies whole',description:'Swallows a nearby zombie in one bite, then digests it for a while. Giants are only bitten for heavy damage.',characteristic:'Vulnerable while digesting.',plantFood:'Devours up to eight zombies instantly without needing to digest.'},
            sweetpotato:{attack:'🍯',attackName:'Caramel slap + heal aura',description:'Heals the plants around it and slaps nearby zombies with sticky caramel that slows them.',characteristic:'Support plant with a light attack.',plantFood:'Heals all plants fully and gives them a sugar rush (faster attacks).'},
            sapling:{attack:'🍯',attackName:'Lobbed sticky sap',description:'Lobs sap that splashes and sticks zombies in place, slowing them heavily.',characteristic:'Heavy slow with splash.',plantFood:'Floods the lawn with sap: every zombie is nearly frozen in place.'},
            electricblueberry:{attack:'⚡',attackName:'Electric discharge',description:'Periodically discharges electricity that shocks and stuns every zombie in a 3x3 area around it.',characteristic:'Area stun when zombies get close.',plantFood:'Lightning storm hits every zombie on the lawn.'},
            electricpeashooter:{attack:'🟡',attackName:'Electric pea',description:'Fires electric peas that stun the zombie they hit and arc to a second zombie.',characteristic:'Chain lightning peas.',plantFood:'Bolts of lightning strike up to ten zombies.'},
            torchwood:{attack:'🔥',attackName:'Ignites peas (no projectile)',description:'Peas that pass through it become fireballs; zombies that chew on it catch fire.',characteristic:'Turns ice peas into normal peas, normal peas into fire peas.',plantFood:'Inferno: sets its lane ablaze and ignites every pea on the lawn for a while.'},
            iceberglettuce:{attack:'🧊',attackName:'Contact freeze (no projectile)',description:'A one-use ice plant that freezes the first zombie that steps on it.',characteristic:'Instantly freezes a zombie on contact; it is consumed after triggering.',plantFood:'Freezes every grounded zombie on the lawn.'},
            gravebuster:{attack:'🪦',attackName:'No attack',description:'A utility plant that is planted directly on a grave to consume and remove it.',characteristic:'Removes graves and does not attack zombies.',plantFood:'No Plant Food effect.'},
            twinsunflower:{attack:'☀️',attackName:'Sun production (no projectile)',description:'Produces twice as much sun as a normal Sunflower.',characteristic:'Economy plant; produces two sun pickups per production cycle.',plantFood:'Immediately produces 250 sun.'},
            coconutcannon:{attack:'🥥',attackName:'Coconut cannonball',description:'Tap it to fire a fast artillery shell down its lane that explodes in a medium area on impact. After each shot it rests for 8 seconds.',characteristic:'Must be tapped/activated to fire its cannon; high-cost explosive lane attack.',plantFood:'Fires a huge cannonball that pushes zombies it hits toward the right side of the lawn before exploding.'},
            spikerock:{attack:'🌵',attackName:'Ground spikes',description:'Damages ground-based zombies that walk over it and can destroy multiple rolling zombies.',characteristic:'Ground hazard; can withstand and damage rolling obstacles that destroy Spikeweed.',plantFood:'Covers its entire lane with metal spikes, damaging grounded zombies and drawing them toward Spikerock.'},
            peapod:{attack:'🟢',attackName:'Peas',description:'Shoots peas down its lane. Additional Pea Pods can be planted on the same tile to stack up to five heads.',characteristic:'Stacks on one tile; each added pod increases its rate of pea fire, up to five.',plantFood:'Summons a giant Peashooter that fires five giant peas.'},
            melonpult:{attack:'🍉',attackName:'Lobbed melon',description:'Lobs melons down its lane; each melon deals heavy impact damage and splash damage to nearby zombies.',characteristic:'Area-damage lobber with a high sun cost and slow firing cadence.',plantFood:'Launches melons at every zombie on the lawn, dealing impact and splash damage.'},
            tallnut:{attack:'🛡️',attackName:'No attack (defensive)',description:'A heavy-duty defensive plant that blocks zombies and low-flying zombies that can pass over shorter defenses.',characteristic:'Very high toughness; blocks low-flying zombies.',plantFood:'Heals itself and gains an additional hard armor shell.'},
            wintermelon:{attack:'🍈',attackName:'Frozen melon',description:'Lobs heavy frozen melons that deal splash damage and slow groups of zombies.',characteristic:'Combines area damage with a lane-wide slowing role through its splash hits.',plantFood:'Launches frozen melons at every zombie, dealing impact and splash damage.'},
            lightningreed:{attack:'⚡',attackName:'Arcing lightning',description:'Calls down chain lightning that jumps between every zombie in its own lane and both neighbouring lanes, across the whole lawn width. It has no regular bullet - only the chain.',characteristic:'Chain-lightning attacker that can hit clustered zombies across nearby lanes.',plantFood:'Creates a storm cloud that damages random zombies across the lawn.'},
            rotobaga:{attack:'🥔',attackName:'Diagonal rutabaga shots',description:'Shoots rutabaga projectiles along the four diagonal directions wherever targets are present. When it dies it lifts every zombie in its tile and the four diagonal neighbor tiles into the air and drops them for heavy damage.',characteristic:'Four-direction diagonal attacker; death-drop damage scales from killing a Lv1 Conehead (plant Lv1) to killing a Lv7 Football Zombie (plant Lv5).',plantFood:'Shoots multiple huge rutabagas in all four directions.'},
            citron:{attack:'🔵',attackName:'Charged plasma ball',description:'Charges up and fires a powerful plasma ball, wrapped in crackling lightning, straight down its lane for massive single-target damage.',characteristic:'Slow-charging, high-damage energy attacker; waits for a target before firing.',plantFood:'Fires a giant plasma ball that flings zombies aside and deals heavy damage to powerful or mechanical targets.'},
            tileturnip:{attack:'🟪',attackName:'Creates a Power Tile (no projectile)',description:'Creates a Power Tile on its planting tile. When a plant-food-powered plant is used on a Power Tile, the effect can be shared with other matching Power Tiles.',characteristic:'Support plant that creates a linked Power Tile; it does not attack zombies.',plantFood:'No Plant Food effect.'},
            sunshroom:{attack:'☀️',attackName:'Sun production (no projectile)',description:'Starts by producing small suns, then grows and produces normal suns, and eventually large suns.',characteristic:'Low-cost economy mushroom whose sun output increases as it matures.',plantFood:'Instantly grows to full size and produces a large amount of sun.'},
            celery:{attack:'🥬',attackName:'Two-way ambush melee',description:'Waits for zombies to approach from either side, then pops up and bashes them, including zombies behind it. Very tough (20x health) with double the ambush range.',characteristic:'Ambush melee plant; attacks zombies up to about three tiles in either direction.',plantFood:'Heals itself to full health and spawns three additional Celery Stalkers on the lawn.'},
            primalpeashooter:{attack:'🪨',attackName:'Heavy rock pea',description:'Shoots heavy rock-like peas that briefly stun zombies and have a chance to knock them backward.',characteristic:'Control shooter; its heavy peas stun and occasionally knock back targets.',plantFood:'Shoots several powerful peas that can knock zombies backward.'},
            powerlily:{attack:'🫘',attackName:'Produces Plant Food (no projectile)',description:'Creates one Plant Food for the player when planted.',characteristic:'Single-use support plant; provides one Plant Food and does not attack.',plantFood:'No Plant Food effect.'},
            jalapeno:{attack:'🔥',attackName:'Lane-wide fire blast',description:'Explodes and destroys zombies across its entire row.',characteristic:'Single-use explosive; clears the lane it is planted in.',plantFood:'No Plant Food effect.'}
        };

        const PLANT_TYPES = {
            sunflower: { cost: 50, hp: 100, emoji: '🌻', name: 'Sunflower', animClass: 'anim-sunflower', cd: 7500 },
            peashooter: { cost: 100, hp: 100, emoji: '🌱', name: 'Peashooter', animClass: 'anim-plant-idle', cd: 7500 },
            snowpea: { cost: 175, hp: 100, emoji: '❄️', name: 'Snow Pea', animClass: 'anim-plant-idle', cd: 7500 },
            firepea: { cost: 175, hp: 100, emoji: '🔥', name: 'Fire Pea', animClass: 'anim-plant-idle', cd: 7500 },
            wallnut: { cost: 50, hp: 1188, emoji: '🌰', name: 'Wall-nut', animClass: 'anim-plant-idle', cd: 30000 },
            cherrybomb: { cost: 150, hp: 50, emoji: '🍒', name: 'Cherry Bomb', animClass: 'anim-plant-idle', cd: 25000 },
            potatomine: { cost: 25, hp: 100, emoji: '🥔', name: 'Potato Mine', animClass: 'anim-plant-idle', cd: 12000 },
            bonkchoy: { cost: 150, hp: 150, emoji: '🥊', name: 'Bonk Choy', animClass: 'anim-plant-idle', cd: 10000 },
            gatlingpea: { cost: 400, hp: 120, emoji: '🔫', name: 'Gatling Pea', animClass: 'anim-plant-idle', cd: 15000 },
            spikeweed: { cost: 100, hp: 200, emoji: '🌵', name: 'Spikeweed', animClass: 'anim-spike', cd: 7500 },
            cabbagetosser: { cost: 100, hp: 100, emoji: '🥬', name: 'Cabbage Tosser', animClass: 'anim-plant-idle', cd: 7500 },
            corntosser: { cost: 125, hp: 100, emoji: '🌽', name: 'Corn Tosser', animClass: 'anim-plant-idle', cd: 8000 },
            garlic: { cost: 50, hp: 800, emoji: '🧄', name: 'Garlic', animClass: 'anim-plant-idle', cd: 10000 },
            firedragon: { cost: 200, hp: 150, emoji: '🐉', name: 'Fire Dragon', animClass: 'anim-plant-idle', cd: 12000 },
            snowdragon: { cost: 225, hp: 150, emoji: '🧊', name: 'Snow Dragon', animClass: 'anim-plant-idle', cd: 12000 },
            cactus: { cost: 125, hp: 100, emoji: '🪴', name: 'Cactus', animClass: 'anim-plant-idle', cd: 7500 },
            blover: { cost: 100, hp: 50, emoji: '🍀', name: 'Blover', animClass: 'anim-plant-idle', cd: 15000 },
            iceberglettuce: { cost: 75, hp: 80, emoji: '🧿', name: 'Iceberg Lettuce', animClass: 'anim-iceberg', cd: 18000 },
            gravebuster: { cost: 75, hp: 250, emoji: '🪦', name: 'Grave Buster', animClass: 'anim-gravebuster', cd: 12000 },
            twinsunflower: { cost: 125, hp: 100, emoji: '🌼', name: 'Twin Sunflower', animClass: 'anim-sunflower', cd: 9000 },
            coconutcannon: { cost: 300, hp: 180, emoji: '🥥', name: 'Coconut Cannon', animClass: 'anim-cannon', cd: 18000 },
            spikerock: { cost: 250, hp: 500, emoji: '🪨', name: 'Spikerock', animClass: 'anim-spike', cd: 12000 },
            peapod: { cost: 200, hp: 120, emoji: '🫛', name: 'Pea Pod', animClass: 'anim-peapod', cd: 12000 },
            melonpult: { cost: 300, hp: 120, emoji: '🍉', name: 'Melon-pult', animClass: 'anim-lobber', cd: 15000 },
            tallnut: { cost: 125, hp: 2400, emoji: '🥜', name: 'Tall-nut', animClass: 'anim-defender', cd: 36000 },
            wintermelon: { cost: 500, hp: 140, emoji: '🍈', name: 'Winter Melon', animClass: 'anim-lobber', cd: 18000 },
            lightningreed: { cost: 125, hp: 100, emoji: '🌾', name: 'Lightning Reed', animClass: 'anim-electric-plant', cd: 9000 },
            rotobaga: { cost: 150, hp: 110, emoji: '🍠', name: 'Rotobaga', animClass: 'anim-rotobaga', cd: 9000 },
            citron: { cost: 350, hp: 160, emoji: '🍊', name: 'Citron', animClass: 'anim-citron', cd: 16000 },
            tileturnip: { cost: 125, hp: 120, emoji: '🟪', name: 'Tile Turnip', animClass: 'anim-tile', cd: 18000 },
            sunshroom: { cost: 25, hp: 80, emoji: '🍄', name: 'Sun-shroom', animClass: 'anim-sunflower', cd: 7500 },
            celery: { cost: 150, hp: 2000, emoji: '🥒', name: 'Celery Stalker', animClass: 'anim-ambush', cd: 10000 },
            primalpeashooter: { cost: 175, hp: 140, emoji: '🦖', name: 'Primal Peashooter', animClass: 'anim-peashooter', cd: 8000 },
            powerlily: { cost: 175, hp: 100, emoji: '🪷', name: 'Power Lily', animClass: 'anim-support', cd: 25000 },
            jalapeno: { cost: 125, hp: 60, emoji: '🌶️', name: 'Jalapeño', animClass: 'anim-fire-wave', cd: 25000 },
            laserbean: { cost: 200, hp: 100, emoji: '🔦', name: 'Laser Bean', animClass: 'anim-plant-idle', cd: 7500 },
            infinut: { cost: 175, hp: 1333, emoji: '♾️', name: 'Infi-nut', animClass: 'anim-defender', cd: 40000 },
            magnetshroom: { cost: 100, hp: 100, emoji: '🧲', name: 'Magnet-shroom', animClass: 'anim-np-wobble', cd: 12000 },
            thymewarp: { cost: 125, hp: 60, emoji: '⏳', name: 'Thyme Warp', animClass: 'anim-np-clock', cd: 25000 },
            intensivecarrot: { cost: 125, hp: 150, emoji: '🥕', name: 'Intensive Carrot', animClass: 'anim-np-bounce', cd: 25000 },
            primalsunflower: { cost: 75, hp: 100, emoji: '🌞', name: 'Primal Sunflower', animClass: 'anim-sunflower', cd: 7500 },
            primalpotatomine: { cost: 50, hp: 100, emoji: '🥔', name: 'Primal Potato Mine', animClass: 'anim-plant-idle', cd: 18000 },
            bowlingbulb: { cost: 125, hp: 100, emoji: '🎳', name: 'Bowling Bulb', animClass: 'anim-np-bounce', cd: 9000 },
            grimrose: { cost: 175, hp: 110, emoji: '🥀', name: 'Grim-rose', animClass: 'anim-np-wobble', cd: 10000 },
            shadowshroom: { cost: 125, hp: 100, emoji: '🌑', name: 'Shadow-shroom', animClass: 'anim-np-wobble', cd: 9000 },
            dusklobber: { cost: 200, hp: 100, emoji: '🌘', name: 'Dusk Lobber', animClass: 'anim-lobber', cd: 9000 },
            chomper: { cost: 150, hp: 160, emoji: '🦷', name: 'Chomper', animClass: 'anim-np-bounce', cd: 12000 },
            sweetpotato: { cost: 100, hp: 130, emoji: '🍭', name: 'Sweet Potato', animClass: 'anim-np-bounce', cd: 9000 },
            sapling: { cost: 125, hp: 100, emoji: '🌳', name: 'Sap-ling', animClass: 'anim-lobber', cd: 8000 },
            electricblueberry: { cost: 175, hp: 90, emoji: '🫐', name: 'Electric Blueberry', animClass: 'anim-electric-plant', cd: 12000 },
            electricpeashooter: { cost: 175, hp: 100, emoji: '🟡', name: 'Electric Peashooter', animClass: 'anim-electric-plant', cd: 8000 },
            torchwood: { cost: 175, hp: 220, emoji: '🪵', name: 'Torchwood', animClass: 'anim-np-flicker', cd: 9000 }
        };

        const ZOMBIE_TYPES = {
            basic: { hp: 100, maxHp: 100, speed: 0.12, emoji: '🧟', damage: 24.0 },
            cone: { hp: 147, maxHp: 147, speed: 0.1, emoji: '🪖', damage: 24.0 },
            bucket: { hp: 267, maxHp: 267, speed: 0.08, emoji: '🪣', damage: 30.0 },
            football: { hp: 333, maxHp: 333, speed: 0.22, emoji: '🏈', damage: 40.0 },
            pyramid: { hp: 467, maxHp: 467, speed: 0.06, emoji: '🔺', damage: 50.0 },
            polevault: { hp: 133, maxHp: 133, speed: 0.24, emoji: '🏃', damage: 30.0, canVault: true },
            newspaper: { hp: 167, maxHp: 167, speed: 0.09, emoji: '📰', damage: 24.0, enraged: false },
            disco: { hp: 233, maxHp: 233, speed: 0.08, emoji: '🕺', damage: 30.0 },
            gargantuar: { hp: 1111, maxHp: 1111, speed: 0.10, emoji: '👹', damage: 300.0, hasImp: true },
            imp: { hp: 53, maxHp: 53, speed: 0.25, emoji: '👶', damage: 15.0 },
            impcannon: { hp: 420, maxHp: 420, speed: 0.045, emoji: '💣', damage: 28, impCannon: true },
            barrelroller: { hp: 520, maxHp: 520, speed: 0.16, emoji: '🛢️', damage: 55, barrel: true },
            gargantuarpirate: { hp: 1350, maxHp: 1350, speed: 0.095, emoji: '🏴\u200d☠️', damage: 330, hasImp: true },
            jollyroger: { hp: 300, maxHp: 300, speed: 0.105, emoji: '⚓', damage: 32 },
            camel: { hp: 360, maxHp: 360, speed: 0.075, emoji: '🐪', damage: 36, camelShield: true },
            explorer: { hp: 210, maxHp: 210, speed: 0.14, emoji: '🧭', damage: 30, explorer: true },
            tombraiser: { hp: 330, maxHp: 330, speed: 0.07, emoji: '⚱️', damage: 38, tombRaiser: true },
            tomb: { hp: 650, maxHp: 650, speed: 0, emoji: '🏚️', damage: 0, tomb: true },
            pharaoh: { hp: 700, maxHp: 700, speed: 0.055, emoji: '👑', damage: 58 },
            mummygargantuar: { hp: 1450, maxHp: 1450, speed: 0.075, emoji: '👻', damage: 360, hasImp: true },
            chickenwrangler: { hp: 280, maxHp: 280, speed: 0.11, emoji: '🤠', damage: 34, chickenWrangler: true },
            chicken: { hp: 38, maxHp: 38, speed: 0.42, emoji: '🐔', damage: 12 },
            zombiebull: { hp: 900, maxHp: 900, speed: 0.19, emoji: '🐂', damage: 85, bull: true },
            wildwestgargantuar: { hp: 1500, maxHp: 1500, speed: 0.09, emoji: '🦍', damage: 380, hasImp: true },
            pianist: { hp: 480, maxHp: 480, speed: 0.085, emoji: '🎹', damage: 42, pianist: true },
            biologistmutant: { hp: 330, maxHp: 330, speed: 0.085, emoji: '🥽', damage: 30, mutationHead: '🥽', biologist: true },
            mendelmutant: { hp: 1500, maxHp: 1500, speed: 0, emoji: '🧙‍♂️', damage: 0, mutationHead: '🧙‍♂️', mendel: true, elite: true, stationary: true },
            darwinmutant: { hp: 1900, maxHp: 1900, speed: 0, emoji: '🧬', damage: 0, mutationHead: '🧬', darwin: true, elite: true, stationary: true },
            wallnutmutant:{hp:520,maxHp:520,speed:.075,emoji:'🌰',damage:40,mutationHead:'🌰',mutant:'wallnut'},
            peamutant:{hp:145,maxHp:145,speed:.12,emoji:'🌱',damage:24,mutationHead:'🌱',mutant:'peashooter'},
            sunmutant:{hp:155,maxHp:155,speed:.105,emoji:'🌻',damage:24,mutationHead:'🌻',mutant:'sunflower'},
            snowpeamutant:{hp:165,maxHp:165,speed:.10,emoji:'❄️',damage:24,mutationHead:'❄️',mutant:'snowpea'},
            cherrymutant:{hp:180,maxHp:180,speed:.105,emoji:'🍒',damage:25,mutationHead:'🍒',mutant:'cherrybomb'},
            gatlingmutant:{hp:235,maxHp:235,speed:.085,emoji:'🔫',damage:28,mutationHead:'🔫',mutant:'gatlingpea'},
            tallnutmutant:{hp:880,maxHp:880,speed:.052,emoji:'🥜',damage:52,mutationHead:'🥜',mutant:'tallnut'},
            firepeamutant:{hp:175,maxHp:175,speed:.10,emoji:'🔥',damage:24,mutationHead:'🔥',mutant:'firepea'},
            bonkmutant:{hp:210,maxHp:210,speed:.115,emoji:'🥊',damage:32,mutationHead:'🥊',mutant:'bonkchoy'},
            firedragonmutant:{hp:285,maxHp:285,speed:.07,emoji:'🐉',damage:30,mutationHead:'🐉',mutant:'firedragon'},
            twinsunmutant:{hp:190,maxHp:190,speed:.095,emoji:'🌼',damage:26,mutationHead:'🌼',mutant:'twinsunflower'},
            jalapenomutant:{hp:200,maxHp:200,speed:.095,emoji:'🌶️',damage:26,mutationHead:'🌶️',mutant:'jalapeno'},
            rotobagamutant:{hp:210,maxHp:210,speed:.11,emoji:'🍠',damage:25,mutationHead:'🍠',mutant:'rotobaga',flying:true},
            snowdragonmutant:{hp:280,maxHp:280,speed:.07,emoji:'🧊',damage:30,mutationHead:'🧊',mutant:'snowdragon'},
            icebergmutant:{hp:175,maxHp:175,speed:.10,emoji:'🧿',damage:24,mutationHead:'🧿',mutant:'iceberglettuce'},
            blowermutant:{hp:165,maxHp:165,speed:.12,emoji:'🍀',damage:24,mutationHead:'🍀',mutant:'blover'},
            inertia:{hp:260,maxHp:260,speed:.11,emoji:'🧱',damage:23,inertia:true},
            fma_zombie:{hp:980,maxHp:980,speed:.09,emoji:'🛞',damage:47,mass:true},
            newton3_zombie:{hp:340,maxHp:340,speed:.21,emoji:'🛰️',damage:21,newton3:true},
            relativity_zombie:{hp:390,maxHp:390,speed:.14,emoji:'🪐',damage:19,relativity:true},
            photon_zombie:{hp:175,maxHp:175,speed:.28,emoji:'💡',damage:16,photon:true},
            tesla_zombie:{hp:560,maxHp:560,speed:.12,emoji:'⚡',damage:25,tesla:true},
            schrodinger_zombie:{hp:460,maxHp:460,speed:.13,emoji:'🧫',damage:21,schrodinger:true},
            hawking_zombie:{hp:1200,maxHp:1200,speed:0,emoji:'🌌',damage:0,hawking:true,elite:true,stationary:true},
            newton_elite:{hp:1550,maxHp:1550,speed:0,emoji:'🍎',damage:0,elite:true,stationary:true,newtonElite:true},
            einstein_elite:{hp:3600,maxHp:3600,speed:0,emoji:'🧠',damage:0,elite:true,stationary:true,einsteinElite:true},
            pendulum:{hp:465,maxHp:465,speed:.15,emoji:'🎐',damage:21,pendulum:true},
            skater_zombie:{hp:630,maxHp:630,speed:.38,emoji:'🛼',damage:56,skater:true},
            refractor_zombie:{hp:520,maxHp:520,speed:.13,emoji:'🔮',damage:25,refractor:true}
        };

        // v64: World 3 (DNA mutants) are tougher than before.
        Object.keys(ZOMBIE_TYPES).forEach(k => { const t = ZOMBIE_TYPES[k]; if (t.mutant && !t.elite) { t.hp = Math.round(t.hp * 1.6); t.maxHp = Math.round(t.maxHp * 1.6); t.damage = Math.round(t.damage * 1.35 * 10) / 10; t.speed = +(t.speed * 1.1).toFixed(4); } });
        ['biologistmutant'].forEach(k => { const t = ZOMBIE_TYPES[k]; t.hp = Math.round(t.hp * 1.6); t.maxHp = Math.round(t.maxHp * 1.6); t.damage = Math.round(t.damage * 1.35); t.speed = +(t.speed * 1.1).toFixed(4); });
        ['mendelmutant', 'darwinmutant'].forEach(k => { const t = ZOMBIE_TYPES[k]; t.hp = Math.round(t.hp * 1.4); t.maxHp = Math.round(t.maxHp * 1.4); });

        const ZOMBIE_DISPLAY_NAMES = {
            impcannon:'Imp Cannon', barrelroller:'Barrel Roller Zombie', gargantuarpirate:'Gargantuar Pirate',
            jollyroger:'Jolly Roger Zombie', camel:'Camel Zombie', explorer:'Explorer Zombie',
            tombraiser:'Tomb Raiser Zombie', tomb:'Zombie-Spawning Tomb', pharaoh:'Pharaoh Zombie',
            mummygargantuar:'Mummified Gargantuar', chickenwrangler:'Chicken Wrangler Zombie',
            chicken:'Zombie Chicken', zombiebull:'Zombie Bull', wildwestgargantuar:'Wild West Gargantuar',
            pianist:'Pianist Zombie', biologistmutant:'Biologist Zombie', mendelmutant:'Mendel Zombie (Elite)', darwinmutant:'Darwin Zombie (Elite)', wallnutmutant:'Wall-nut DNA Zombie', peamutant:'Peashooter DNA Zombie',
            sunmutant:'Sunflower DNA Zombie', snowpeamutant:'Snow Pea DNA Zombie', cherrymutant:'Cherry Bomb DNA Zombie',
            gatlingmutant:'Gatling Pea DNA Zombie', tallnutmutant:'Tall-nut DNA Zombie', firepeamutant:'Fire Pea DNA Zombie',
            bonkmutant:'Bonk Choy DNA Zombie', firedragonmutant:'Fire Dragon DNA Zombie', twinsunmutant:'Twin Sunflower DNA Zombie',
            jalapenomutant:'Jalapeño DNA Zombie', rotobagamutant:'Rotobaga DNA Zombie', snowdragonmutant:'Snow Dragon DNA Zombie',
            icebergmutant:'Iceberg Lettuce DNA Zombie', blowermutant:'Blover DNA Zombie',
            inertia:'Newton’s First Law Inertia Zombie', fma_zombie:'F = ma Juggernaut',
            newton3_zombie:'Action–Reaction Rocket Zombie', relativity_zombie:'Time-Dilation Zombie',
            photon_zombie:'Photon Zombie', tesla_zombie:'Nikola Tesla Zombie',
            schrodinger_zombie:'Schrödinger’s Zombie', hawking_zombie:'Hawking Black Hole Elite', newton_elite:'Newton Elite', einstein_elite:'Einstein Elite Boss',
            pendulum:'Pendulum Zombie', skater_zombie:'Frictionless Skater Zombie',
            refractor_zombie:'Refractor Mirror Zombie'
        };

        const LEVELS = {
            1: { name: 'Day Lawn', maxWaves: 3, allowedZombies: ['basic'] },
            2: { name: 'Cone Attack', maxWaves: 4, allowedZombies: ['basic', 'cone', 'newspaper'] },
            3: { name: 'Vault & Sports', maxWaves: 5, allowedZombies: ['basic', 'cone', 'polevault', 'football'] },
            4: { name: 'Disco Night', maxWaves: 5, allowedZombies: ['basic', 'cone', 'bucket', 'newspaper', 'disco'] },
            5: { name: 'Pyramid Assault', maxWaves: 6, allowedZombies: ['basic', 'cone', 'bucket', 'pyramid', 'football'] },
            6: { name: 'Heavy Armor Wave', maxWaves: 6, allowedZombies: ['cone', 'bucket', 'pyramid', 'newspaper'] },
            7: { name: 'Football Frenzy', maxWaves: 7, allowedZombies: ['basic', 'football', 'polevault', 'bucket'] },
            8: { name: 'Disco & Pole Vault', maxWaves: 7, allowedZombies: ['disco', 'polevault', 'pyramid', 'football'] },
            9: { name: 'Gargantuar Rush', maxWaves: 8, allowedZombies: ['bucket', 'football', 'pyramid', 'gargantuar'] },
            10: { name: 'Ultimate Zombie Boss', maxWaves: 10, allowedZombies: ['basic', 'cone', 'bucket', 'football', 'pyramid', 'polevault', 'newspaper', 'disco', 'gargantuar'] },
            11: { name: 'Zomboss Showdown', maxWaves: 1, allowedZombies: ['basic', 'cone', 'bucket', 'football', 'pyramid', 'gargantuar'] },
            12: { name: 'Pirate Seas', maxWaves: 5, map: 2, allowedZombies: ['jollyroger','barrelroller','impcannon','gargantuarpirate'] },
            13: { name: 'Rolling Barrel Bay', maxWaves: 6, map: 2, allowedZombies: ['barrelroller','impcannon','jollyroger','chickenwrangler'] },
            14: { name: 'Ancient Tombs', maxWaves: 6, map: 2, allowedZombies: ['camel','explorer','tombraiser','tomb','pharaoh'] },
            15: { name: 'Mummy Kingdom', maxWaves: 7, map: 2, allowedZombies: ['tombraiser','tomb','pharaoh','mummygargantuar'] },
            16: { name: 'Chicken Stampede', maxWaves: 7, map: 2, allowedZombies: ['chickenwrangler','chicken','zombiebull','jollyroger'] },
            17: { name: 'Wild West Showdown', maxWaves: 8, map: 2, allowedZombies: ['zombiebull','wildwestgargantuar','chickenwrangler','chicken','pianist'] },
            18: { name: 'Frontier Grand Finale', maxWaves: 10, map: 2, allowedZombies: ['impcannon','barrelroller','gargantuarpirate','camel','explorer','tombraiser','tomb','pharaoh','mummygargantuar','chickenwrangler','chicken','zombiebull','wildwestgargantuar','pianist'] },
            19: { name: 'Mutation Meadow', maxWaves: 5, map: 3, allowedZombies: ['wallnutmutant','peamutant','sunmutant','snowpeamutant'] },
            20: { name: 'Armored Genome', maxWaves: 6, map: 3, allowedZombies: ['wallnutmutant','tallnutmutant','gatlingmutant','bonkmutant','blowermutant'] },
            21: { name: 'Thermal Mutation Lab', maxWaves: 6, map: 3, allowedZombies: ['firepeamutant','cherrymutant','jalapenomutant','firepeamutant','biologistmutant'] },
            22: { name: 'Frostbite Experiments', maxWaves: 7, map: 3, allowedZombies: ['snowpeamutant','snowdragonmutant','icebergmutant','blowermutant','biologistmutant'] },
            23: { name: 'Overgrown Genome', maxWaves: 7, map: 3, allowedZombies: ['rotobagamutant','bonkmutant','sunmutant','twinsunmutant','biologistmutant','mendelmutant'] },
            24: { name: 'Three-Lane Specimens', maxWaves: 8, map: 3, allowedZombies: ['firedragonmutant','snowdragonmutant','gatlingmutant','rotobagamutant','biologistmutant','mendelmutant','darwinmutant'] },
            25: { name: 'Unstable DNA', maxWaves: 9, map: 3, allowedZombies: ['cherrymutant','jalapenomutant','icebergmutant','tallnutmutant','blowermutant','firepeamutant','biologistmutant','mendelmutant','darwinmutant'] },
            26: { name: 'Mutation Mastermind', maxWaves: 10, map: 3, allowedZombies: ['wallnutmutant','peamutant','sunmutant','snowpeamutant','cherrymutant','gatlingmutant','tallnutmutant','firepeamutant','bonkmutant','firedragonmutant','twinsunmutant','jalapenomutant','rotobagamutant','snowdragonmutant','icebergmutant','blowermutant','biologistmutant','mendelmutant','darwinmutant'] },
            27: { name: 'Newton’s First Law', maxWaves: 5, map: 4, allowedZombies: ['inertia','pendulum','basic'] },
            28: { name: 'Force & Acceleration', maxWaves: 6, map: 4, allowedZombies: ['fma_zombie','inertia','newton3_zombie','cone'] },
            29: { name: 'Action–Reaction Reactor', maxWaves: 6, map: 4, allowedZombies: ['newton3_zombie','fma_zombie','pendulum','football','newton_elite'] },
            30: { name: 'Relativity Chamber', maxWaves: 7, map: 4, allowedZombies: ['relativity_zombie','photon_zombie','inertia','newton3_zombie'] },
            31: { name: 'Optics & Electromagnetism', maxWaves: 7, map: 4, allowedZombies: ['tesla_zombie','refractor_zombie','photon_zombie','fma_zombie'] },
            32: { name: 'Quantum Superposition', maxWaves: 8, map: 4, allowedZombies: ['schrodinger_zombie','relativity_zombie','refractor_zombie','pendulum'] },
            33: { name: 'Singularity Studies', maxWaves: 9, map: 4, allowedZombies: ['einstein_elite','hawking_zombie','tesla_zombie','fma_zombie','photon_zombie','schrodinger_zombie'] },
            34: { name: 'The Grand Unified Lab', maxWaves: 10, map: 4, allowedZombies: ['einstein_elite','newton_elite','inertia','fma_zombie','newton3_zombie','relativity_zombie','photon_zombie','tesla_zombie','schrodinger_zombie','hawking_zombie','pendulum','skater_zombie','refractor_zombie'] }
        };

        // Zombie levels (tiers). Level 1 = the original stats.
        // Attack: 100% at level 1 -> 1000% at level 7 (grows faster at higher levels). Health: 100% -> 500% (levels 1-6), 1000% at level 7.
        const TIER_COUNT = 7;
        const ZOMBIE_HEALTH_MULT = [1, 2.6, 4.2, 6, 8.5, 12, 22];
        const ZOMBIE_ATTACK_MULT = [1, 1.9, 3.2, 5, 7.5, 11, 17];
        // Fertilizer for clearing a stage at a zombie level for the FIRST time only.
        const TIER_REWARDS = [1, 2, 3, 4, 5, 10, 20];
        function clampTier(t) { return Math.max(1, Math.min(TIER_COUNT, Math.floor(Number(t)) || 1)); }
        // v65: Worlds 1-3 use a middle-ground curve (stronger than the original, weaker than v64); World 4 keeps the strong curve.
        const ZOMBIE_HEALTH_MULT_W13 = [1, 2, 3.2, 4, 6, 9, 13];
        const ZOMBIE_ATTACK_MULT_W13 = [1, 1.7, 2.6, 4, 5.5, 8, 11.5];
        function zombieHealthMult(t) { return (currentLevel <= 26 ? ZOMBIE_HEALTH_MULT_W13 : ZOMBIE_HEALTH_MULT)[clampTier(t) - 1]; }
        function zombieAttackMult(t) { return (currentLevel <= 26 ? ZOMBIE_ATTACK_MULT_W13 : ZOMBIE_ATTACK_MULT)[clampTier(t) - 1]; }
        function formatMult(m) { return `${Math.round(m * 100)}%`; }


        const GATLING_FUSIONS={
            peashooter:{name:'Martial Pea',projectile:'normal',emoji:'🟢',dmgMul:1,threeLanes:true},
            snowpea:{name:'Snow Gatlin',projectile:'ice',emoji:'🧊',dmgMul:1,splash:'slow'},
            firepea:{name:'Fire Gatlin',projectile:'fire',emoji:'🔥',dmgMul:.55,splash:'burn'},
            peapod:{name:'Gatlin Pod',projectile:'normal',emoji:'🟢',dmgMul:1,directions:true},
            primalpeashooter:{name:'Primal Gatlin',projectile:'primal',emoji:'🪨',dmgMul:.5,splash:'primal'}
        };
        const GATLING_FUSION_KEYS=Object.keys(GATLING_FUSIONS);
        const GATLING_FUSION_UNLOCKS=[
            {key:'peashooter',level:19,tier:1},
            {key:'snowpea',level:20,tier:2},
            {key:'firepea',level:21,tier:2},
            {key:'peapod',level:23,tier:3},
            {key:'primalpeashooter',level:25,tier:4}
        ];
        function isGatlingFusionUnlocked(key){if(typeof plantProgress!=='undefined'&&plantProgress&&(plantProgress.fusionsUnlocked||[]).includes(key))return true;const r=GATLING_FUSION_UNLOCKS.find(x=>x.key===key);return !!r&&isTierCleared(r.level,r.tier);}
        function gatlingFusionUnlockText(key){const r=GATLING_FUSION_UNLOCKS.find(x=>x.key===key);return r?`Clear World 3 Level ${r.level} · Zombie Level ${r.tier}`:'Complete its World 3 milestone';}
        // ---- Gatling combination volleys ----
        // Normal attack: 4 bullets per path (same 120ms rhythm as the Gatling Pea), using the COMBINED plant's bullet.
        // Ability: the Gatling Pea's ability rhythm (70ms) and bullet count, again with the combined plant's bullet.
        // Martial Pea = 3 lanes. Gatlin Pod = one 4-bullet direction per pea pod (1-5 pods => 1-5 directions).
        const GATLING_SHOT_GAP=120, GATLING_ABILITY_GAP=70, FUSION_MAX_ABILITY_SHOTS=120;
        const POD_DIR_ANGLES=[0,-28,28,-55,55];
        function podDirCount(p){return Math.max(1,Math.min(5,p.podCount||1));}
        function podRayHitsZombie(p,angDeg,z){
            const rowPx=layerH/ROWS, dx=((z.x+4)-((p.c+.5)/COLS)*100)/100*layerW;
            const dy=(z.r-p.r)*rowPx, ray=Math.tan(angDeg*Math.PI/180)*Math.max(0,dx);
            return Math.abs(ray-dy)<rowPx*.6;
        }
        function fusionHasTarget(p){
            const f=GATLING_FUSIONS[p.combinedWith];if(!f)return false;
            const left=(p.c/COLS)*100-2;
            if(f.directions){
                const n=podDirCount(p);
                for(let k=0;k<zombies.length;k++){const z=zombies[k];if(z.x<=left||z.hp<=0)continue;for(let i=0;i<n;i++)if(podRayHitsZombie(p,POD_DIR_ANGLES[i],z))return true;}
                return false;
            }
            const span=f.threeLanes?1:0;
            for(let k=0;k<zombies.length;k++){const z=zombies[k];if(Math.abs(z.r-p.r)<=span&&z.x>left)return true;}
            return false;
        }
        function fireFusionVolley(p,ability=false){
            const f=GATLING_FUSIONS[p.combinedWith];if(!f)return false;
            const now=Date.now();
            const baseX=((p.c+.5)/COLS)*100, baseY=((p.r+.5)/ROWS)*100;
            const boost=(p.tileBoostUntil||0)>now?(p.tileBoost||1):1;
            const lvl=p.level||1, gap=ability?GATLING_ABILITY_GAP:GATLING_SHOT_GAP;
            let perPath=ability?Math.round(16*levelAbilityMultiplier(lvl)):4;
            const snd=f.projectile==='ice'?'iceshot':f.projectile==='fire'?'fireshot':'shoot';
            if(f.directions){
                const n=podDirCount(p);
                if(ability)perPath=Math.min(perPath,Math.floor(FUSION_MAX_ABILITY_SHOTS/n));
                for(let d=0;d<n;d++){
                    const a=POD_DIR_ANGLES[d]*Math.PI/180, vx=Math.cos(a), vy=Math.sin(a)*layerW/layerH;
                    for(let k=0;k<perPath;k++)diagShots.push({id:now+Math.random(),x:baseX,y:baseY,px:baseX,py:baseY,vx,vy,startAt:now+k*gap,ownerLevel:lvl,boost,dmg:20*f.dmgMul,combo:true,emoji:f.emoji,ang:POD_DIR_ANGLES[d],snd:(k%2===0)?'shoot':null});
                }
            } else {
                const rows=(f.threeLanes||ability)?[p.r-1,p.r,p.r+1].filter(r=>r>=0&&r<ROWS):[p.r];
                if(ability)perPath=Math.min(perPath,Math.floor(FUSION_MAX_ABILITY_SHOTS/rows.length));
                rows.forEach((r,ri)=>{for(let k=0;k<perPath;k++){let bigP=false;if(!ability&&f.projectile==='primal'){p.primalShots=(p.primalShots||0)+1;bigP=p.primalShots%5===0;}projectiles.push({id:now+Math.random(),r,ownerType:'gatlingpea',ownerLevel:lvl,x:baseX,px:baseX,speed:ability?1.1:1,type:f.projectile,comboSplash:f.splash||null,dmgMul:bigP?1:f.dmgMul,emoji:f.emoji,bigPrimal:bigP,ownerBoost:boost,startAt:now+k*gap,snd:(ri===0&&k%2===0)?snd:null});}});
            }
            p.lastActionTime=now;p.shootingAnim=true;plantParticles(p,['✨','💥'],3);setTimeout(()=>p.shootingAnim=false,600);return true;
        }
        // State Variables
        let currentLevel = 1;
        let currentTier = 1;
        let pendingStage = 1;
        let currentMapWorld = 1;
        let mapThenPlantSelect = false;
        const COMPLETED_GAME_LEVELS_KEY = 'emojiPvZCompletedLevels_v1'; // legacy (stage-only) progress
        const COMPLETED_TIERS_KEY = 'emojiPvZCompletedTiers_v2';
        function normalizeCompletedTiers(raw) {
            const out = {};
            if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
                for (let l = 1; l <= 34; l++) {
                    const arr = raw[l] || raw[String(l)];
                    if (Array.isArray(arr)) {
                        const clean = [...new Set(arr.map(Number).filter(n => n >= 1 && n <= TIER_COUNT))].sort((a, b) => a - b);
                        if (clean.length) out[l] = clean;
                    }
                }
            }
            return out;
        }
        // Old saves only knew "stage cleared"; treat those as zombie level 1 cleared (reward already claimed).
        function migrateLegacyLevels(list) {
            const out = {};
            if (Array.isArray(list)) list.map(Number).filter(n => n >= 1 && n <= 34).forEach(l => { out[l] = [1]; });
            return out;
        }
        let completedTiers = (() => {
            try {
                const saved = localStorage.getItem(COMPLETED_TIERS_KEY);
                if (saved) return normalizeCompletedTiers(JSON.parse(saved));
                return migrateLegacyLevels(JSON.parse(localStorage.getItem(COMPLETED_GAME_LEVELS_KEY) || '[]'));
            } catch (_) { return {}; }
        })();
        function saveCompletedTiers() {
            try { localStorage.setItem(COMPLETED_TIERS_KEY, JSON.stringify(completedTiers)); } catch (_) {}
        }
        function isTierCleared(level, tier) { return (completedTiers[level] || []).includes(tier); }
        function tiersClearedCount(level) { return (completedTiers[level] || []).length; }
        function totalTiersCleared() { let n = 0; for (let l = 1; l <= 34; l++) n += tiersClearedCount(l); return n; }
        function selectedLevelLabel() { return `Level ${currentLevel} · ${LEVELS[currentLevel].name} · Zombie Lv ${currentTier}`; }
        const WORLD_RANGES = { 1:[1,11], 2:[12,18], 3:[19,26], 4:[27,34] };
        function worldClearCount(world) {
            const range = WORLD_RANGES[world];
            if (!range) return 0;
            let count = 0;
            for (let level = range[0]; level <= range[1]; level++) {
                if (tiersClearedCount(level) > 0) count++;
            }
            return count;
        }
        function worldUnlockRequirement(world) {
            if (world <= 1 || world > 4) return 0;
            const previous = WORLD_RANGES[world - 1];
            return Math.ceil((previous[1] - previous[0] + 1) / 3);
        }
        function isWorldUnlocked(world) {
            if (world === 1 || (plantProgress && plantProgress.cheatAll)) return true;
            if (world < 1 || world > 4) return false;
            return worldClearCount(world - 1) >= worldUnlockRequirement(world);
        }
        function unlockedWorldCount() {
            let n = 1;
            for (let w = 2; w <= 4; w++) if (isWorldUnlocked(w)) n = w; else break;
            return n;
        }
        function worldForLevel(level) {
            return level <= 11 ? 1 : level <= 18 ? 2 : level <= 26 ? 3 : 4;
        }
        function isAdventureLevelUnlocked(level) {
            if (level < 1 || level > 34) return false;
            if (plantProgress && plantProgress.cheatAll) return true;
            const world = worldForLevel(level);
            if (!isWorldUnlocked(world)) return false;
            const range = WORLD_RANGES[world];
            // World 1 is fully open from the beginning. In later worlds, Level 1
            // opens with the world; each following stage opens after any-tier clear
            // of the immediately preceding stage.
            if (world === 1 || level === range[0]) return true;
            return tiersClearedCount(level - 1) > 0;
        }
        let selectedDeck = ['sunflower', 'peashooter', 'wallnut', 'cherrybomb', 'potatomine', 'bonkchoy', 'spikeweed', 'cabbagetosser'];
        let sun = 150;
        let energyBeans = 1;
        let MAX_ENERGY_BEANS = 4;
        let selectedSeed = null;
        let energyBeanActive = false;
        let isRunning = false;
        let gameLoopId = null;
        // The battle clock advances by one simulation tick per update, independent of wall time.
        // Faster modes run the same simulation ticks more frequently, so timers and movement accelerate together.
        const realDateNow = Date.now.bind(Date);
        let gameClock = realDateNow();
        let gameClockActive = false;
        let gameSpeedIndex = 0;
        const GAME_SPEEDS = [1, 2, 3, 5];
        Date.now = function() { return gameClockActive ? gameClock : realDateNow(); };
        let currentWave = 1;
        let physicsAnomaly = null;
        let maxWaves = 3;
        let zombiesKilled = 0;
        let totalZombiesInWave = 0;
        let zombiesSpawned = 0;
        let lastSunDropTime = 0;
        let lastZombieSpawnTime = 0;

        let seedCooldowns = {};

        let plants = [];
        let zombies = [];
        let airDrops = [];
        let diagShots = [];
        const plantRegistry = new Map();
        let projectiles = [];
        let suns = [];
        let energyBeanDrops = [];
        let mowers = [];
        // Visual effects must live in game state because renderGame() rebuilds gameLayer every frame.
        let visualEffects = [];
        let lastRenderTime = 0;
        const MAX_VISUAL_EFFECTS = 40;
        let layerW = 800, layerH = 500, tickPerf = 0;
        const COCONUT_REST_MS = 8000;
        // Keep up to 28 particles across the whole lawn, with a per-tile cap to
        // prevent one crowded lane from consuming the entire particle budget.
        const MAX_PARTICLE_EFFECTS = 28;
        const MAX_PARTICLES_PER_BLOCK = 5;

        // Persistent plant progression and daily challenge system.
        const PLANT_PROGRESS_KEY = 'emojiPvZPlantProgress_v1';
        // Index = current level; value = fertilizer needed to reach the next level (Lv1->2 costs 2).
        const PLANT_LEVEL_COSTS = [0, 3, 8, 15, 30];
        const HEALTH_FOCUS_PLANTS = new Set(['wallnut','tallnut','garlic','sunflower','gravebuster','tileturnip','spikeweed','spikerock','blover','potatomine','infinut','intensivecarrot','sweetpotato','primalsunflower','primalpotatomine','thymewarp']);
        let profilePlantKey = null;
        let dailyMissionState = loadDailyMissionState();
        let missionRunState = { usedBeans:false, placed:{} };

        const STARTER_PLANTS = ['sunflower','peashooter','wallnut','cherrybomb','potatomine','bonkchoy','spikeweed','cabbagetosser','corntosser','garlic'];
        // 25 of the 42 non-starter plants (~60%) belong to the permanent store pool; the other ~40% are campaign rewards.
        const STORE_PLANT_POOL = ['snowpea','firepea','gatlingpea','firedragon','snowdragon','cactus','blover','peapod','lightningreed','rotobaga','tileturnip','celery','jalapeno','citron','sunshroom','sweetpotato','primalsunflower','bowlingbulb','magnetshroom','sapling','torchwood','electricpeashooter','chomper','thymewarp','grimrose'];
        // The remaining 10 plants are earned from campaign milestones across both worlds.
        const CAMPAIGN_PLANT_REWARDS = [
            {plant:'iceberglettuce',level:1,tier:1},
            {plant:'gravebuster',level:3,tier:1},
            {plant:'twinsunflower',level:5,tier:2},
            {plant:'tallnut',level:7,tier:2},
            {plant:'primalpeashooter',level:9,tier:3},
            {plant:'coconutcannon',level:11,tier:4},
            {plant:'spikerock',level:12,tier:2},
            {plant:'melonpult',level:14,tier:3},
            {plant:'wintermelon',level:16,tier:4},
            {plant:'powerlily',level:18,tier:5},
            {plant:'laserbean',level:19,tier:1},
            {plant:'infinut',level:20,tier:1},
            {plant:'intensivecarrot',level:21,tier:2},
            {plant:'primalpotatomine',level:22,tier:2},
            {plant:'shadowshroom',level:23,tier:2},
            {plant:'dusklobber',level:24,tier:3},
            {plant:'electricblueberry',level:25,tier:3}
        ];
        const STORE_PLANT_PRICES = {snowpea:10,sunshroom:11,firepea:11,cactus:11,celery:12,blover:12,peapod:13,jalapeno:13,rotobaga:14,tileturnip:14,lightningreed:15,gatlingpea:16,citron:17,snowdragon:19,firedragon:20,sweetpotato:11,primalsunflower:11,bowlingbulb:12,magnetshroom:13,sapling:14,torchwood:14,electricpeashooter:15,chomper:16,thymewarp:16,grimrose:18};
        function starterUnlocks() { return [...STARTER_PLANTS]; }
        function normalizePlantProgress(raw) {
            const data = raw && typeof raw === 'object' ? raw : {};
            const levels = data.levels && typeof data.levels === 'object' ? data.levels : {};
            const selectedLevels = data.selectedLevels && typeof data.selectedLevels === 'object' ? data.selectedLevels : {};
            // Migration: preserve starter plants, plants already in the player's old deck, and plants with prior upgrades.
            const owned = Array.isArray(data.unlockedPlants) ? data.unlockedPlants.filter(k=>PLANT_TYPES[k]) : [...STARTER_PLANTS, ...selectedDeck, ...Object.keys(levels)];
            return { fertilizer:Math.max(0,Number(data.fertilizer)||0), levels, selectedLevels, unlockedPlants:[...new Set([...STARTER_PLANTS,...owned])], cheatAll:!!data.cheatAll, chestsClaimed:(Array.isArray(data.chestsClaimed)?data.chestsClaimed:[]).map(Number).filter(n=>n>=0&&n<12).filter((n,i,a)=>a.indexOf(n)===i), fusionsUnlocked:(Array.isArray(data.fusionsUnlocked)?data.fusionsUnlocked:[]).filter(k=>typeof k==='string'), lastWinDay:typeof data.lastWinDay==='string'?data.lastWinDay:'' };
        }
        // Growth chests: unlocked by the total number of first-time clears (stage x zombie level pairs).
        const CHEST_C1 = ['snowpea','firepea','cactus'];
        const CHEST_C2 = ['peapod','lightningreed','sunshroom','rotobaga','celery'];
        const CHEST_C3 = ['jalapeno','blover','firedragon','snowdragon'];
        const CHEST_C4 = ['tileturnip','citron','gatlingpea'];
        const CHEST_NEW_B = ['electricpeashooter','chomper','bowlingbulb','torchwood'];
        const CHEST_NEW_Q = ['magnetshroom','sapling','thymewarp','grimrose'];
        const CHEST_DEFS = [
            { need:5, picks:1, fert:10, plants:[...CHEST_C1], name:'Seedling Chest', icon:'🎁' },
            { need:10, picks:1, fert:20, plants:[...CHEST_C1,...CHEST_C2], name:'Sprout Chest', icon:'📦' },
            { need:15, picks:1, fert:30, plants:[...CHEST_C2,...CHEST_C3], name:'Bloom Chest', icon:'🧰' },
            { need:20, picks:2, fert:40, plants:[...CHEST_C2,...CHEST_C3,...CHEST_C4], name:'Harvest Chest', icon:'👑' },
            // Late-game chests. Each one offers the plants of the previous TWO chests (nothing older) plus a few newer store plants.
            { need:35, picks:2, fert:50, plants:[...new Set([...CHEST_C2,...CHEST_C3,...CHEST_C4])].concat(CHEST_NEW_B), name:'Botanist Chest', icon:'🧑‍🔬' },
            { need:60, picks:2, fert:75, plants:[...new Set([...CHEST_C2,...CHEST_C3,...CHEST_C4])].concat(CHEST_NEW_B), fusions:true, badge:'bronze', name:'Mutation Chest', icon:'🧬' },
            { need:100, picks:3, fert:120, plants:[...new Set([...CHEST_C2,...CHEST_C3,...CHEST_C4])].concat(CHEST_NEW_B, CHEST_NEW_Q), fusions:true, badge:'silver', name:'Quantum Chest', icon:'⚛️' },
            { need:150, auto:true, fert:200, plants:[], badge:'gold', name:'Grand Unification Chest', icon:'🌌' },
            { need:230, auto:true, fert:300, plants:[], badge:'prestige', name:'Prestige Chest', icon:'💎' }
        ];
        // Chest options are strings: a plain plant key, 'fus:<key>' for a Gatling fusion, or 'fert'.
        function chestFusionKeys() { return GATLING_FUSION_UNLOCKS.map(r => r.key).filter((k, i, a) => a.indexOf(k) === i && GATLING_FUSIONS[k]); }
        function chestOptions(d) { return [...d.plants, ...(d.fusions ? chestFusionKeys().map(k => 'fus:' + k) : []), 'fert']; }
        function chestOptionOwned(k) { return k === 'fert' ? false : k.startsWith('fus:') ? isGatlingFusionUnlocked(k.slice(4)) : isPlantUnlocked(k); }
        const BADGE_DEFS = {
            bronze:   { chest: 5, name: 'Mutation Pioneer', sub: '60 clears', icon: '🧬', cls: 'bronze' },
            silver:   { chest: 6, name: 'Quantum Master',   sub: '100 clears', icon: '⚛️', cls: 'silver' },
            gold:     { chest: 7, name: 'Grand Unifier',    sub: '150 clears', icon: '🌌', cls: 'gold' },
            prestige: { chest: 8, name: 'Prestige Legend',  sub: '230 clears', icon: '👑', cls: 'prestige' }
        };
        function chestState(i) {
            const d = CHEST_DEFS[i], total = totalTiersCleared();
            if ((plantProgress.chestsClaimed||[]).includes(i)) return 'claimed';
            return total >= d.need ? 'ready' : 'locked';
        }
        function pendingChestCount() { return CHEST_DEFS.filter((_,i)=>chestState(i)==='ready').length; }
        function levelClearBonus(l) { return 3 + Math.round((Math.max(1,Math.min(26,l)) - 1) * 7 / 25); }
        function loadPlantProgress() {
            try { return normalizePlantProgress(JSON.parse(localStorage.getItem(PLANT_PROGRESS_KEY)) || {}); }
            catch (_) { return normalizePlantProgress({}); }
        }
        let plantProgress = loadPlantProgress();
        function isPlantUnlocked(key) { return !!(plantProgress.unlockedPlants || []).includes(key); }
        function unlockPlant(key) {
            if (!PLANT_TYPES[key]) return false;
            plantProgress.unlockedPlants = [...new Set([...(plantProgress.unlockedPlants||STARTER_PLANTS),key])];
            savePlantProgress();
            return true;
        }
        function savePlantProgress() {
            try { localStorage.setItem(PLANT_PROGRESS_KEY, JSON.stringify(plantProgress)); } catch (_) {}
            updateFertilizerHome();
        }
        function plantLevel(key) { return Math.max(1, Math.min(5, Number(plantProgress.levels[key] || 1))); }
        function selectedPlantLevel(key) { return Math.max(1, Math.min(plantLevel(key), Number(plantProgress.selectedLevels[key] || plantLevel(key)))); }
        function plantStatFocus(key) { return HEALTH_FOCUS_PLANTS.has(key) ? 'health' : 'attack'; }
        function levelHealth(key, level) { const lv = Math.max(1, Math.min(5, Number(level) || 1)); const perLevel = plantStatFocus(key) === 'health' ? 1.68 : 1.55; return PLANT_TYPES[key].hp * (OLD_BASIC_HEALTH.has(key) ? 1.3 : 1) * lv45Boost(key, lv, 'hp') * Math.pow(perLevel, lv - 1); }
        // Original basic plants are stronger: +40% attack damage, +30% health (Wall-nut keeps its own tuning), Sunflower makes more sun.
        const OLD_BASIC_ATTACK = new Set(['peashooter','snowpea','firepea','cherrybomb','potatomine','bonkchoy','gatlingpea','spikeweed','cabbagetosser']);
        const OLD_BASIC_HEALTH = new Set(['sunflower','peashooter','snowpea','firepea','cherrybomb','potatomine','bonkchoy','gatlingpea','spikeweed','cabbagetosser']);
        // Extra Level 4 / Level 5 power. Older plants get a big bonus; Grim-rose, Shadow-shroom and Dusk Lobber a smaller one.
        const LV45_STRONG = new Set(['peashooter','snowpea','firepea','wallnut','tallnut','cherrybomb','potatomine','bonkchoy','gatlingpea','spikeweed','cabbagetosser','garlic','cactus','spikerock','snowdragon','firedragon','celery','primalpeashooter','jalapeno','bowlingbulb','rotobaga','citron','lightningreed','wintermelon','melonpult','peapod']);
        const LV45_WEAK = new Set(['grimrose','shadowshroom']);
        function lv45Boost(key, level, kind) {
            const lv = Number(level) || 1; if (lv < 4) return 1;
            const i = lv >= 5 ? 1 : 0;
            if (key === 'dusklobber') { const d = { atk: [1.10, 1.15], hp: [1.1, 1.25], ab: [1.1, 1.25] }; return d[kind][i]; }
            if (LV45_STRONG.has(key)) {
                // Defensive plants (nuts etc.) get +25% health at Level 5, everything else +40%.
                const hp5 = (typeof HEALTH_FOCUS_PLANTS !== 'undefined' && HEALTH_FOCUS_PLANTS.has(key)) ? 1.25 : 1.40;
                const t = { atk: [1.15, 1.25], hp: [1.15, hp5], ab: [1.10, 1.30] };
                return t[kind][i];
            }
            if (LV45_WEAK.has(key)) { const t = { atk: [1.15, 1.35], hp: [1.1, 1.25], ab: [1.1, 1.25] }; return t[kind][i]; }
            return 1;
        }
        // Extra Level 5 damage so Level 5 plants can hurt Level 7 zombies (without making them easy).
        // Weak / utility plants get more; plants that already hit hard get only a little. Level 4 gets half of the extra.
        const L5_DAMAGE_EXTRA = {spikeweed:1.6,cactus:1.6,corntosser:1.7,snowpea:1.6,peapod:1.6,shadowshroom:1.45,electricpeashooter:1.4,laserbean:1.4,cabbagetosser:1.35,
            firepea:1.3,lightningreed:1.3,bowlingbulb:1.3,snowdragon:1.5,firedragon:1.3,wintermelon:1.2,melonpult:1.2,rotobaga:1.15,citron:1.1,celery:1.1,spikerock:1.05};
        function l5Extra(key, level) {
            const f = L5_DAMAGE_EXTRA[key]; const lv = Number(level) || 1;
            if (!f || lv < 4) return 1;
            return lv >= 5 ? f : 1 + (f - 1) * 0.5;
        }
        function levelAttackMultiplier(key, level) {
            return levelAttackMultiplierBase(key, level) * lv45Boost(key, level, 'atk') * l5Extra(key, level);
        }
        function levelAttackMultiplierBase(key, level) {
            const lv = Math.max(1, Math.min(5, Number(level) || 1));
            if (key === 'spikerock') return [1, 1.5, 2.5, 4, 8][lv - 1];
            if (key === 'rotobaga') return [1, 1.5, 2.3, 3.5, 5][lv - 1];
            if (key === 'coconutcannon') return Math.pow(3, lv - 1);
            return (plantStatFocus(key) === 'attack' ? Math.pow(1.30, lv - 1) : 1) * (OLD_BASIC_ATTACK.has(key) ? 1.4 : 1);
        }
        function plantDamageMultiplier(plant) { return levelAttackMultiplier(plant.type,plant.level||1) * ((plant.tileBoostUntil||0)>Date.now() ? (plant.tileBoost||1) : 1); }
        function levelAbilityMultiplier(level, key) { return [1, 1.7, 2.6, 3.8, 5.3][Math.max(0, Math.min(4, (level || 1) - 1))] * (key ? lv45Boost(key, level, 'ab') : 1); }
        function levelDurationMultiplier(level) { return [1, 1.5, 2.1, 2.8, 3.6][Math.max(0, Math.min(4, (level || 1) - 1))]; }
        function levelBurnDamage(level) { return 8 * levelAbilityMultiplier(level); }
        function levelBurnDuration(level) { return 12000 * levelDurationMultiplier(level); }
        function levelFreezeDuration(level) { return 3000 * levelDurationMultiplier(level); }
        function plantAbilityDescription(key, level) {
            const mult = levelAbilityMultiplier(level, key), duration = levelDurationMultiplier(level);
            const special = {
                sunflower: `Generates ${Math.round(300 * 0.9 * mult)} sunlight.`, wallnut: `Restores the plant to full health (${Math.round(levelHealth(key,level))} HP).`, garlic: `Fully restores health and strengthens zombie redirection; healing scales with level.`,
                potatomine: `Creates ${Math.min(7,2+(level||1))} fully grown Potato Mines; each mine's blast damage is ${Math.round(levelAttackMultiplier('potatomine',level)*100)}% of Level 1.`,
                firedragon: `Sweeps three lanes, dealing ${Math.round((450/7)*mult)} impact damage, then burns for ${Math.round(levelBurnDamage(level))} damage every 0.5s for ${+(12*duration).toFixed(1)}s.`,
                snowdragon: `Sweeps three lanes, dealing ${Math.round((300/7)*mult)} damage and freezing affected zombies for ${(3*duration).toFixed(1)} seconds.`,
                cactus: `Permanently becomes an electric cactus; chain lightning damage and chain reach increase with level.`,
                bonkchoy: `Unleashes ${Math.max(2,Math.round(2*mult))} rounds of a stronger plant-food barrage against zombies in every lane.`, cabbagetosser: `Launches ${Math.max(2,Math.round(2*mult))} rounds of stronger plant-food cabbages at zombies in every lane.`, corntosser: `Launches ${Math.max(2,Math.round(2*mult))} rounds of corn and butter shots; barrage damage and stun power scale with level.`,
                spikeweed: `Deals ${Math.round(100*mult)}% Level 1 damage to every zombie crossing its lane during the ability.`, blover: `Blows zombies much farther back; push distance increases to ${Math.round(35*mult)}% of the lawn.`, cherrybomb: `Deals ${Math.round(500*mult)} damage in its blast area.`
            };
            if (PVZ2_PLANT_LORE[key]) return PVZ2_PLANT_LORE[key].plantFood;
            return special[key] || `Fires a powered-up volley with ${Math.round(mult*100)}% of Level 1 ability strength.`;
        }
        // Damage a plant's normal attack does at a given level (mirrors the combat code).
        function plantDamageText(key, level) {
            const m = levelAttackMultiplier(key, level), r = n => Math.round(n * 10) / 10;
            switch (key) {
                case 'peashooter': return `${r(26*m)} per pea`;
                case 'snowpea': return `${r(20*m)} per pea`;
                case 'gatlingpea': return `${r(20*m)} per pea (4 peas per volley)`;
                case 'firepea': return `${r(45*m)} per fireball`;
                case 'cactus': return `${r(20*m)} per needle (${r(24*m)} once electric)`;
                case 'cabbagetosser': return `${r(40*m)} per cabbage`;
                case 'corntosser': return `${r(20*m)} per kernel / ${r(40*m)} per butter`;
                case 'bonkchoy': return `${r(25*m)} per punch (area, all zombies in range)`;
                case 'firedragon': return `${r(34.5*m)} per breath`;
                case 'snowdragon': return `${r(16*m)} per breath`;
                case 'spikeweed': return `${r(0.8*m*20)} per second`;
                case 'potatomine': return `${r(500*m)} explosion`;
                case 'cherrybomb': return `${r(500*levelAbilityMultiplier(level,key))} explosion`;
                case 'coconutcannon': return `${r(160*m)} splash · ${Math.pow(2,Math.max(0,Math.min(4,(level||1)-1))).toFixed(0)}x shell speed`;
                case 'melonpult': return `${r(95*m)} splash`;
                case 'wintermelon': return `${r(80*m)} splash + slow`;
                case 'citron': return `${r(260*m)} charged shot`;
                case 'lightningreed': return `${r(22*m)} chain damage`;
                case 'rotobaga': return `${r(38*levelAttackMultiplier('rotobaga',level))} multi-lane; ${rotoDropDamage(level)} when it dies`;
                case 'primalpeashooter': return `${r(55*m)} + knockback`;
                case 'spikerock': return `${r(2.2*levelAttackMultiplier('spikerock',level)*20)} contact damage/sec`;
                case 'celery': return `${r(48*m)} melee (2x range)`;
                case 'laserbean': return `${r(54.4*m)} laser to every zombie in the lane`;
                case 'electricpeashooter': return `${r(40*m)} per pea + stun, ${r(32*m)} on each of 2 chained zombies`;
                case 'shadowshroom': return `${r(35*m)} per bolt + weaken`;
                case 'dusklobber': return `${r(112*m)} splash + curse`;
                case 'sapling': return `${r(45*m)} splash + heavy slow`;
                case 'bowlingbulb': return `${r(100*m)} per bounce (up to 5 hits)`;
                case 'grimrose': return `${r(48*m)} + ${r(11.2*m)}/sec curse`;
                case 'chomper': return `Swallows 1 zombie (${r(1040*m)} vs giants)`;
                case 'sweetpotato': return `${r(51.2*Math.pow(1.3,(level||1)-1))} slap + heals neighbours`;
                case 'electricblueberry': return `${r(112*m)} area shock + stun`;
                case 'magnetshroom': return `${r(264*m)}+ per metal item stripped`;
                case 'torchwood': return `Ignites peas; burns attackers`;
                case 'primalpotatomine': return `${r(1440*Math.pow(1.3,(level||1)-1))} contact blast (3x3)`;
                case 'thymewarp': return `${r(88*Math.pow(1.3,(level||1)-1))} + time freeze`;
                default: return null;
            }
        }
        function plantStatsHtml(key, level) {
            const dmg = plantDamageText(key, level);
            const hp = Math.round(levelHealth(key, level));
            const sunNote = ['sunflower','twinsunflower','sunshroom'].includes(key) ? `<span class="text-amber-300 font-bold">☀️ Sun pickup: ${Math.round((key==='twinsunflower'?80:key==='sunshroom'?15:50)*Math.pow(1.18,level-1))}</span>` : '';
            return `<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs"><span class="text-rose-300 font-bold">❤️ Health: ${hp}</span><span class="text-orange-300 font-bold">⚔️ Damage: ${dmg || 'None (support plant)'}</span>${sunNote}</div>`;
        }
        // Daily missions follow the player's LOCAL calendar day (not UTC), so they refresh at local midnight.
        function localDateKey() {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        }
        // Make sure the missions in memory belong to today; otherwise roll today's missions.
        function ensureTodaysMissions() {
            if (!dailyMissionState || dailyMissionState.date !== localDateKey()) {
                dailyMissionState = loadDailyMissionState();
                saveDailyMissionState();
            }
        }
        function loadDailyMissionState() {
            const today = localDateKey();
            try {
                const saved = JSON.parse(localStorage.getItem('emojiPvZDailyMissions_v2'));
                if (saved && saved.date === today && Array.isArray(saved.missions)) return saved;
            } catch (_) {}
            const seed = Number(today.replaceAll('-','')) || 1;
            const counters = [
                { id:'kills', title:'Zombie Hunter', type:'count', stat:'kills', target:[20,25,30][seed%3], reward:3, detail:'Defeat zombies (win or lose, across all battles today).' },
                { id:'sun', title:'Sun Collector', type:'count', stat:'sun', target:[300,400,500][(seed>>2)%3], reward:2, detail:'Collect sun today.' },
                { id:'plants', title:'Green Thumb', type:'count', stat:'plants', target:[10,12,15][(seed>>1)%3], reward:2, detail:'Plant plants on the lawn today.' }
            ];
            const a = seed % 3, b = (a + 1 + ((seed >> 3) % 2)) % 3;
            const favs = ['peashooter','wallnut','cherrybomb','potatomine','bonkchoy','spikeweed','cabbagetosser','corntosser','garlic'];
            const fav = favs[seed % favs.length];
            const twists = [
                { id:'nobeans', title:'Bean Saver', type:'noBeans', reward:3, detail:'Win a battle without using an Energy Bean.' },
                { id:'sunleft', title:'Sun Hoarder', type:'sunLeft', target:300, reward:3, detail:'Win a battle with at least 300 sun left over.' },
                { id:'win', title:'Garden Victory', type:'winAny', reward:3, detail:'Win any battle.' }
            ];
            return { date: today, missions: [
                {...counters[a], progress:0, done:false}, {...counters[b], progress:0, done:false},
                { id:'fav', title:`Fan of ${PLANT_TYPES[fav].name}`, type:'usePlant', target:fav, need:2, reward:4, detail:`Win a battle after planting ${PLANT_TYPES[fav].name} at least 2 times.`, done:false },
                {...twists[(seed >> 4) % 3], done:false}
            ]};
        }
        function saveDailyMissionState() { try { localStorage.setItem('emojiPvZDailyMissions_v2', JSON.stringify(dailyMissionState)); } catch (_) {} }

        // Portable save codes are self-contained, so they work across devices without a server.
        const PORTABLE_SAVE_VERSION = 1;
        function savePayload() {
            return { v: PORTABLE_SAVE_VERSION, plantProgress, selectedDeck, currentLevel, currentTier, completedTiers, starRecords, account, mastery, savedAt: new Date().toISOString() };
        }
        function checksumSave(text) { let h=2166136261; for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(36).toUpperCase(); }
        // UTF-8-safe Base64URL helpers. These avoid deprecated escape()/unescape() and
        // produce clear errors for truncated, malformed, or non-UTF-8 pasted codes.
        function bytesToBase64(bytes) {
            let binary = '';
            const chunkSize = 0x8000;
            for (let i = 0; i < bytes.length; i += chunkSize) {
                binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
            }
            return btoa(binary);
        }
        function base64ToBytes(base64) {
            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 === 1) {
                throw new Error('The save code contains invalid Base64 characters or is incomplete. Please copy the entire code again.');
            }
            const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
            let binary;
            try { binary = atob(padded); }
            catch (_) { throw new Error('The save code could not be decoded. It may have been cut off or altered while copying.'); }
            return Uint8Array.from(binary, ch => ch.charCodeAt(0));
        }
        function encodeSaveCode(payload) {
            if (typeof TextEncoder === 'undefined') throw new Error('This browser is too old for secure save codes. Please use a recent version of Chrome, Edge, or Firefox.');
            const json = JSON.stringify(payload);
            const bytes = new TextEncoder().encode(json);
            const body = bytesToBase64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
            return `PVZ1-${body}-${checksumSave(json)}`;
        }
        function decodeSaveCode(code) {
            // Robustly accept codes copied with line wrapping, spaces, Markdown fences,
            // quotes, BOMs, and zero-width formatting characters.
            let clean = String(code || '').normalize('NFKC')
                .replace(/[\uFEFF\u200B-\u200D\u2060]/g, '')
                .replace(/\s+/g, '');
            clean = clean.replace(/^[`'"“”‘’]+|[`'"“”‘’]+$/g, '');
            const prefixAt = clean.indexOf('PVZ1-');
            if (prefixAt < 0) throw new Error('That save-code format is not recognized. Make sure you copied the complete code beginning with PVZ1-.');
            const token = clean.slice(prefixAt).replace(/[^A-Za-z0-9_-].*$/, '');
            const lastDash = token.lastIndexOf('-');
            if (lastDash <= 5 || lastDash === token.length - 1) throw new Error('The save code is incomplete. Copy the entire code beginning with PVZ1-.');
            const body = token.slice(5, lastDash);
            const checksum = token.slice(lastDash + 1);
            if (!/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9]+$/.test(checksum)) throw new Error('The save code contains invalid characters. Copy it again without editing it.');
            const b64 = body.replace(/-/g, '+').replace(/_/g, '/');
            const bytes = base64ToBytes(b64);
            if (typeof TextDecoder === 'undefined') throw new Error('This browser is too old to restore save codes. Please use a recent version of Chrome, Edge, or Firefox.');
            let json;
            try { json = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
            catch (_) { throw new Error('The save code text is damaged or was copied with missing characters. Please generate a fresh code.'); }
            if (checksumSave(json) !== checksum.toUpperCase()) throw new Error('The save code checksum does not match. It was likely truncated or altered while copying. Generate a fresh code and copy it in one piece.');
            let data;
            try { data = JSON.parse(json); }
            catch (_) { throw new Error('The save code data is invalid. Please generate a fresh code.'); }
            if (!data || data.v !== PORTABLE_SAVE_VERSION || !data.plantProgress || typeof data.plantProgress !== 'object' || Array.isArray(data.plantProgress) || !Array.isArray(data.selectedDeck)) {
                throw new Error('This save code version or data format is not supported by this game version.');
            }
            if (data.plantProgress.levels != null && (typeof data.plantProgress.levels !== 'object' || Array.isArray(data.plantProgress.levels))) throw new Error('The save code has invalid plant-level data.');
            if (data.plantProgress.selectedLevels != null && (typeof data.plantProgress.selectedLevels !== 'object' || Array.isArray(data.plantProgress.selectedLevels))) throw new Error('The save code has invalid selected plant-level data.');
            if (data.plantProgress.unlockedPlants != null && !Array.isArray(data.plantProgress.unlockedPlants)) throw new Error('The save code has invalid unlocked-plant data.');
            if (data.completedTiers != null && (typeof data.completedTiers !== 'object' || Array.isArray(data.completedTiers))) throw new Error('The save code has invalid stage-completion data.');
            return data;
        }
        function setSaveStatus(message, isError=false) { const el=document.getElementById('save-code-status'); if(el){el.textContent=message;el.className='text-xs mt-2 '+(isError?'text-rose-300':'text-emerald-300');} }
        function generateMasteryTestSave(tier) {
            const presets = { 1: { rank: 10, label: 'Novice' }, 2: { rank: 18, label: 'Apprentice' }, 3: { rank: 30, label: 'Adept' }, 4: { rank: 40, label: 'Expert' } };
            const preset = presets[tier]; if (!preset) return;
            const keys = Object.keys(PLANT_TYPES);
            const levels = {}, selectedLevels = {}, testMastery = {};
            keys.forEach(k => {
                levels[k] = 1; selectedLevels[k] = 1;
                const c = mastCat(k), R = mastRef(k);
                testMastery[k] = { planted: tier === 1 ? 20 : tier === 2 ? 20 : tier === 3 ? 100 : 200,
                    dmg: c === 'atk' ? Math.round(R * (tier === 1 ? 0 : tier === 2 ? 20 : tier === 3 ? 20 : 60)) : 0,
                    taken: c === 'def' ? Math.round(R * (tier === 1 ? 0 : tier === 2 ? 10 : tier === 3 ? 10 : 80)) : 0,
                    sup: c === 'sup' ? Math.round(R * (tier === 1 ? 0 : tier === 2 ? 10 : tier === 3 ? 10 : 70)) : 0,
                    beans: tier >= 3 && !MAST_NOBEAN.includes(k) ? (tier === 3 ? 50 : 100) : 0, tier };
            });
            const rankXP = RANK_XP_CUM[preset.rank];
            const payload = { v: PORTABLE_SAVE_VERSION,
                plantProgress: { fertilizer: 250, levels, selectedLevels, unlockedPlants: keys, cheatAll: false, chestsClaimed: [5,6,7,8], fusionsUnlocked: [], lastWinDay: '' },
                selectedDeck: ['sunflower','peashooter','wallnut','cherrybomb','potatomine','bonkchoy','spikeweed','cabbagetosser'],
                currentLevel: 1, currentTier: 1, completedTiers: {}, starRecords: {},
                account: { xp: rankXP, rewarded: preset.rank }, mastery: testMastery, savedAt: new Date().toISOString() };
            const code = encodeSaveCode(payload);
            const input = document.getElementById('save-code-input'), output = document.getElementById('save-code-output');
            if (input) input.value = code; if (output) output.value = code;
            setSaveStatus('Generated ' + preset.label + ' test save: all plants unlocked, all plants at Mastery ' + tier + ', Gardener Rank ' + preset.rank + '. Click Restore Progress to load it.');
        }
        function generateSaveCode() {
            try { const code=encodeSaveCode(savePayload()); const out=document.getElementById('save-code-output'); if(out)out.value=code; try{localStorage.setItem('emojiPvZLatestSaveCode_v1',code);}catch(_){} setSaveStatus('Save code generated. Copy it and keep it somewhere safe.'); }
            catch(e){setSaveStatus('Could not generate a save code: '+e.message,true);}
        }
        async function copySaveCode() { const out=document.getElementById('save-code-output'); if(!out||!out.value){generateSaveCode();} const value=document.getElementById('save-code-output')?.value||''; if(!value)return; try{await navigator.clipboard.writeText(value);setSaveStatus('Save code copied to clipboard.');}catch(_){out.focus();out.select();setSaveStatus('Select the code above and press Ctrl+C to copy it.');} }
        const CHEAT_CODE = 'PVZ-APEX-ALL-LEVELS-GATLING';
        const LEGACY_CHEAT_CODE = 'PVZ-OMEGA-7K4Q-UNLOCK';
        const TEST_PACKS = {
            'PVZ-TEST-M1-BRONZE': { tier: 1, rank: 10, chests: 5 },
            'PVZ-TEST-M2-SILVER': { tier: 2, rank: 18, chests: 6 },
            'PVZ-TEST-M3-GOLD': { tier: 3, rank: 30, chests: 7 },
            'PVZ-TEST-M4-DIAMOND': { tier: 4, rank: 40, chests: 8 },
            'PVZ-TEST-MIXED-ALL-BADGES': { tier: 0, rank: 50, chests: 9 }
        };
        function applyMasteryTestPack(pack, code) {
            applyCheatUnlockAll();
            const keys = Object.keys(PLANT_TYPES);
            account = { xp: RANK_XP_CUM[pack.rank], rewarded: pack.rank }; saveAccount(); applyAccountPerks();
            plantProgress.chestsClaimed = CHEST_DEFS.map((_, i) => i).slice(0, pack.chests);
            mastery = {};
            keys.forEach((k, i) => {
                const n = pack.tier || (i % 5) + 1, m = masteryOf(k), R = mastRef(k), c = mastCat(k);
                const mm = n >= 5 ? { atk: 150, def: 170, sup: 160 }[c] : n >= 4 ? { atk: 60, def: 80, sup: 70 }[c] : n >= 2 ? { atk: 20, def: 10, sup: 10 }[c] : 0;
                m.planted = [0, 20, 20, 100, 200, 400][n]; m.beans = MAST_NOBEAN.includes(k) ? 0 : [0, 0, 0, 50, 100, 300][n];
                m.dmg = m.taken = m.sup = Math.round(R * mm); m.tier = n;
            });
            saveMastery(); applyMasteryEffects(); savePlantProgress(); renderSelectionScreen(); updateFertilizerHome(); try { renderHomeRank(); renderHomeBadges(); } catch (_) {}
            const st = document.getElementById('save-code-status'); if (st) st.textContent = '🧪 Test pack ' + code + ': ' + (pack.tier ? 'every plant at ' + MAST_NAMES[pack.tier] + ' mastery' : 'plants spread across all 5 mastery tiers') + ', Gardener Rank ' + pack.rank + '.';
            missionToast('🧪 Test pack loaded');
        }
        function applyCheatUnlockAll() {
            const keys = Object.keys(PLANT_TYPES);
            plantProgress.unlockedPlants = [...new Set([...(plantProgress.unlockedPlants || []), ...keys])];
            plantProgress.levels = { ...(plantProgress.levels || {}) }; plantProgress.selectedLevels = { ...(plantProgress.selectedLevels || {}) };
            keys.forEach(k => { plantProgress.levels[k] = 5; plantProgress.selectedLevels[k] = 5; });
            plantProgress.cheatAll = true;
            // Mark every stage and every zombie tier as cleared; fusion unlocks
            // depend on individual World 3 stage-tier clear records.
            completedTiers = {};
            for (let stage = 1; stage <= 34; stage++) completedTiers[stage] = Array.from({length:TIER_COUNT}, (_,i)=>i+1);
            saveCompletedTiers();
            // Achievements: every star, every growth chest + badge, every Gatling fusion.
            starRecords = {};
            for (let stage = 1; stage <= 34; stage++) for (let t = 1; t <= TIER_COUNT; t++) starRecords[starKey(stage, t)] = 3;
            saveStarRecords();
            plantProgress.chestsClaimed = CHEST_DEFS.map((_, i) => i);
            plantProgress.fusionsUnlocked = Object.keys(GATLING_FUSIONS);
            plantProgress.fertilizer = Math.max(plantProgress.fertilizer || 0, 999);
            // Max Gardener Rank (every perk + title badge)
            account = { xp: TOTAL_RANK_XP, rewarded: MAX_RANK }; saveAccount(); applyAccountPerks();
            // Every plant mastery (Master tier with all goals met)
            mastery = {};
            keys.forEach(k => { const m = masteryOf(k), R = mastRef(k); m.planted = 400; m.beans = MAST_NOBEAN.includes(k) ? 0 : 300; m.dmg = Math.round(R * 150); m.taken = Math.round(R * 170); m.sup = Math.round(R * 160); m.tier = 5; });
            saveMastery(); applyMasteryEffects();
            savePlantProgress(); renderSelectionScreen(); updateFertilizerHome(); try { renderHomeRank(); } catch (_) {}
            const st = document.getElementById('save-code-status'); if (st) st.textContent = '🔓 Cheat activated: every plant (max level), stage, zombie level, 3-star record, chest, badge, Gardener Rank 50 and Master-level plant mastery is unlocked!';
            missionToast('🔓 Everything unlocked, max rank and all masteries!');
        }
        function restoreSaveCode() {
            let enteredCheat = ((document.getElementById('save-code-input') || {}).value || '').trim().toUpperCase().replace(/\s+/g, '');
            if (TEST_PACKS[enteredCheat]) { applyMasteryTestPack(TEST_PACKS[enteredCheat], enteredCheat); return; }
            if (enteredCheat === CHEAT_CODE || enteredCheat === LEGACY_CHEAT_CODE) { applyCheatUnlockAll(); return; }
            const masteryCheats = {
                'PVZ-MASTERY-NOVICE': 1,
                'PVZ-MASTERY-APPRENTICE': 2,
                'PVZ-MASTERY-ADEPT': 3,
                'PVZ-MASTERY-EXPERT': 4
            };
            if (masteryCheats[enteredCheat]) {
                generateMasteryTestSave(masteryCheats[enteredCheat]);
                enteredCheat = '';
            }
            try {
                const input=document.getElementById('save-code-input'); const data=decodeSaveCode(input?.value);
                const rawLevels={...(data.plantProgress.levels||{})}, rawSelected={...(data.plantProgress.selectedLevels||{})};
                Object.keys(rawLevels).forEach(k=>{if(!PLANT_TYPES[k]) delete rawLevels[k]; else rawLevels[k]=Math.max(1,Math.min(5,Math.floor(Number(rawLevels[k])||1)));});
                Object.keys(rawSelected).forEach(k=>{if(!PLANT_TYPES[k]) delete rawSelected[k]; else rawSelected[k]=Math.max(1,Math.min(Number(rawLevels[k]||1),Math.floor(Number(rawSelected[k])||1)));});
                const restoredProgress=normalizePlantProgress({...data.plantProgress,unlockedPlants:Array.isArray(data.plantProgress.unlockedPlants)?data.plantProgress.unlockedPlants.filter(k=>PLANT_TYPES[k]):[...(data.selectedDeck||[])],levels:rawLevels,selectedLevels:rawSelected});
                const restoredDeck=data.selectedDeck.filter(k=>PLANT_TYPES[k] && restoredProgress.unlockedPlants.includes(k)).slice(0,8);
                // Commit only after the complete payload has passed validation.
                plantProgress=restoredProgress;
                // Never restore old missions from a code: keep (or refresh) today's current missions.
                ensureTodaysMissions();
                selectedDeck=restoredDeck;
                if(!selectedDeck.length) selectedDeck=['sunflower','peashooter','wallnut','cherrybomb','potatomine','bonkchoy','spikeweed','cabbagetosser'];
                currentLevel=Math.max(1,Math.min(26,Number(data.currentLevel)||1));
                currentTier=clampTier(data.currentTier);
                // New saves carry per-zombie-level clears; older saves only list cleared stages (counted as zombie level 1).
                completedTiers = data.completedTiers ? normalizeCompletedTiers(data.completedTiers) : migrateLegacyLevels(data.completedGameLevels);
                saveCompletedTiers();
                starRecords = normalizeStarRecords(data.starRecords); saveStarRecords();
                account = normalizeAccount(data.account); saveAccount(); applyAccountPerks(); mastery = normalizeMastery(data.mastery); saveMastery(); applyMasteryEffects();
                savePlantProgress();saveDailyMissionState();
                try{localStorage.setItem('emojiPvZLatestSaveCode_v1',String(input.value).trim());}catch(_){}
                renderSelectionScreen();renderDailyMissions();renderAdventureMap();
                const out=document.getElementById('save-code-output');if(out)out.value=String(input.value).trim();
                setSaveStatus('Progress restored successfully! Your plants, fertilizer, missions, deck, level selection, and zombie-level clears are back.');
            } catch(e) { setSaveStatus(e.message||'Could not restore that save code.',true); }
        }
        function loadLatestSaveCodeField() { try { const code=localStorage.getItem('emojiPvZLatestSaveCode_v1'); const out=document.getElementById('save-code-output'); if(code&&out)out.value=code; } catch(_) {} }
        function renderDailyMissions() {
            ensureTodaysMissions();
            const el = document.getElementById('daily-missions-list'); if (!el) return;
            el.innerHTML = '';
            dailyMissionState.missions.forEach(m => {
                const card = document.createElement('div');
                card.className = 'rounded-lg border p-2 ' + (m.done ? 'border-emerald-500/50 bg-emerald-950/30' : 'border-slate-700 bg-slate-800');
                const pct = m.type === 'count' ? Math.round(100 * Math.min(m.progress || 0, m.target) / m.target) : (m.done ? 100 : 0);
                const prog = m.type === 'count' ? `<div class="h-1.5 rounded bg-slate-700 mt-1.5 overflow-hidden"><div class="h-full bg-emerald-400" style="width:${pct}%"></div></div><div class="text-[10px] text-slate-300 mt-0.5">${Math.min(m.progress||0,m.target)} / ${m.target}</div>` : '';
                card.innerHTML = `<div class="flex justify-between gap-2"><span class="text-xs font-black ${m.done?'text-emerald-300':'text-slate-200'}">${m.done?'✓ ':''}${m.title}</span><span class="text-xs text-amber-300 font-bold">+${m.reward} 🧪</span></div><div class="text-[10px] text-slate-400 mt-1">${m.done?'Completed for today!':m.detail}</div>${m.done?'':prog}`;
                el.appendChild(card);
            });
            updateFertilizerHome();
        }
        function updateChestBadge() {
            const b = document.getElementById('home-chest-btn'); if (!b) return;
            const n = pendingChestCount();
            b.innerHTML = `🎁 Chests${n ? ` <span class="ml-1 px-1.5 rounded-full bg-rose-500 text-white text-xs">${n}</span>` : ''}`;
            b.classList.toggle('animate-pulse', n > 0);
        }
        let chestOpenIndex = -1, chestPicks = [];
        function openChests() {
            let ov = document.getElementById('chest-overlay');
            if (!ov) { ov = document.createElement('div'); ov.id = 'chest-overlay'; ov.className = 'fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-sm overflow-y-auto p-4'; document.body.appendChild(ov); }
            ov.classList.remove('hidden'); chestOpenIndex = -1; chestPicks = []; renderChests();
        }
        function closeChests() { const ov = document.getElementById('chest-overlay'); if (ov) ov.classList.add('hidden'); updateFertilizerHome(); }
        function chestOptionLabel(d, k) {
            if (k === 'fert') return `<div class="text-4xl">🧪</div><div class="font-black text-amber-300 text-sm">${d.fert} Fertilizer</div>`;
            const owned = chestOptionOwned(k);
            if (k.startsWith('fus:')) { const f = GATLING_FUSIONS[k.slice(4)]; return `<div class="text-4xl">${f.emoji}</div><div class="font-black text-slate-100 text-sm">${f.name}</div><div class="text-[10px] text-cyan-300">Gatlin Fusion</div><div class="text-[10px] text-slate-400">${owned ? 'Already unlocked' : 'New fusion'}</div>`; }
            return `<div class="text-4xl">${PLANT_TYPES[k].emoji}</div><div class="font-black text-slate-100 text-sm">${PLANT_TYPES[k].name}</div><div class="text-[10px] text-slate-400">${owned ? 'Already owned' : 'New plant'}</div>`;
        }
        function chestNeed(d) { const avail = chestOptions(d).filter(k => k === 'fert' || !chestOptionOwned(k)).length; return Math.min(d.picks || 1, avail); }
        function renderChests() {
            const ov = document.getElementById('chest-overlay'); if (!ov) return;
            const total = totalTiersCleared();
            if (chestOpenIndex >= 0) {
                const i = chestOpenIndex, d = CHEST_DEFS[i];
                const body = chestOptions(d).map(k => {
                    const owned = chestOptionOwned(k), sel = chestPicks.includes(k);
                    return `<button ${owned ? 'disabled' : ''} onclick="pickChestOption('${k}')" class="rounded-xl border-2 p-3 text-center ${owned ? 'opacity-40 cursor-not-allowed border-slate-700 bg-slate-800' : sel ? 'border-emerald-400 bg-emerald-900/50' : 'border-slate-600 bg-slate-800 hover:border-amber-400'}">${chestOptionLabel(d, k)}</button>`;
                }).join('');
                const need = chestNeed(d);
                ov.innerHTML = `<div class="max-w-2xl mx-auto bg-slate-900 border border-amber-500/40 rounded-2xl p-4"><div class="text-center mb-3"><div class="text-5xl">${d.icon}</div><h2 class="text-xl font-black text-amber-300">${d.name}</h2>${d.badge ? `<p class="text-[11px] font-bold text-cyan-300">🏅 Opening this chest also awards the ${BADGE_DEFS[d.badge].name} badge!</p>` : ''}<p class="text-xs text-slate-300">Choose ${d.picks === 1 ? 'one reward' : d.picks + ' rewards'} (${chestPicks.length}/${need} chosen)</p></div><div class="grid grid-cols-2 sm:grid-cols-4 gap-2">${body}</div><div class="flex gap-2 justify-center mt-4"><button onclick="chestOpenIndex=-1;chestPicks=[];renderChests()" class="px-4 py-2 rounded-xl bg-slate-700 text-white font-bold text-sm">Back</button><button id="chest-confirm" ${chestPicks.length === need ? '' : 'disabled'} onclick="confirmChest()" class="px-5 py-2 rounded-xl bg-emerald-600 disabled:opacity-40 text-white font-black text-sm">Claim</button></div></div>`;
                return;
            }
            const cards = CHEST_DEFS.map((d, i) => {
                const st = chestState(i);
                const openCall = d.auto ? `claimAutoChest(${i})` : `chestOpenIndex=${i};chestPicks=[];renderChests()`;
                const info = st === 'claimed' ? '<div class="text-emerald-300 text-xs font-bold">✓ Claimed</div>' : st === 'ready' ? `<button onclick="${openCall}" class="mt-1 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-black text-xs animate-pulse">Open!</button>` : `<div class="text-slate-400 text-xs">🔒 ${Math.min(total, d.need)} / ${d.need} first clears</div>`;
                const prize = d.auto ? `🧪 ${d.fert} Fertilizer` : `Pick ${d.picks}: ${d.plants.slice(0, 7).map(k => PLANT_TYPES[k].emoji).join(' ')}${d.plants.length > 7 ? ' …' : ''}${d.fusions ? ' 🔫' : ''} 🧪${d.fert}`;
                const badge = d.badge ? `<div class="text-[10px] font-black mt-0.5 ${'badge-chip-' + d.badge}">🏅 ${BADGE_DEFS[d.badge].name} badge</div>` : '';
                return `<div class="rounded-xl border p-3 text-center ${st === 'ready' ? 'border-amber-400 bg-amber-950/30' : 'border-slate-700 bg-slate-800'}"><div class="text-4xl ${st === 'locked' ? 'grayscale opacity-60' : ''}">${d.icon}</div><div class="font-black text-slate-100 text-sm">${d.name}</div><div class="text-[10px] text-slate-400 mb-1">${prize}</div>${badge}${info}</div>`;
            }).join('');
            ov.innerHTML = `<div class="max-w-3xl mx-auto bg-slate-900 border border-amber-500/40 rounded-2xl p-4"><div class="flex justify-between items-center mb-1"><h2 class="text-xl font-black text-amber-300">🎁 Growth Chests</h2><button onclick="closeChests()" class="px-3 py-1 rounded-lg bg-slate-700 text-white font-bold text-sm">Close</button></div><p class="text-xs text-slate-400 mb-3">Every first-time clear of a stage at any zombie level counts. You have ${total} so far (${34 * TIER_COUNT} possible).</p><div class="grid grid-cols-2 sm:grid-cols-3 gap-2">${cards}</div></div>`;
        }
        function pickChestOption(key) {
            const d = CHEST_DEFS[chestOpenIndex]; if (!d) return;
            const need = chestNeed(d);
            if (chestPicks.includes(key)) chestPicks = chestPicks.filter(k => k !== key);
            else if ((d.picks || 1) === 1) chestPicks = [key];
            else if (chestPicks.length < need) chestPicks.push(key);
            renderChests();
        }
        function finishChestClaim(i, d) {
            plantProgress.chestsClaimed = [...new Set([...(plantProgress.chestsClaimed || []), i])];
            savePlantProgress(); chestOpenIndex = -1; chestPicks = [];
            missionToast(d.badge ? `🏅 ${BADGE_DEFS[d.badge].name} badge earned!` : 'Chest claimed!');
            renderSelectionScreen(); renderChests(); renderHomeBadges(d.badge ? d.badge : null);
        }
        function confirmChest() {
            const i = chestOpenIndex, d = CHEST_DEFS[i]; if (!d || chestState(i) !== 'ready') return;
            chestPicks.forEach(k => {
                if (k === 'fert') plantProgress.fertilizer = (plantProgress.fertilizer || 0) + d.fert;
                else if (k.startsWith('fus:')) { const fk = k.slice(4); if (!isGatlingFusionUnlocked(fk)) plantProgress.fusionsUnlocked = [...(plantProgress.fusionsUnlocked || []), fk]; }
                else if (!isPlantUnlocked(k)) unlockPlant(k);
            });
            finishChestClaim(i, d);
        }
        function claimAutoChest(i) {
            const d = CHEST_DEFS[i]; if (!d || chestState(i) !== 'ready') return;
            plantProgress.fertilizer = (plantProgress.fertilizer || 0) + d.fert;
            finishChestClaim(i, d);
        }
        // ---------- Home-screen badges ----------
        function earnedBadges() { return Object.keys(BADGE_DEFS).filter(k => (plantProgress.chestsClaimed || []).includes(BADGE_DEFS[k].chest)); }
        // ---- Hall of Honor: every badge (milestone, rank title, plant mastery) ----
        const HONOR_PIN_KEY = 'pvzHonorPins_v1';
        const RANK_BADGE_CLS = { 10: 'emerald', 18: 'amethyst', 30: 'gold', 35: 'silver', 40: 'diamond', 45: 'ember', 50: 'prestige' };
        const MAST_BADGE_CLS = ['', 'bronze', 'silver', 'gold', 'diamond', 'prestige'];
        function allHonorBadges() {
            const out = [];
            earnedBadges().forEach(k => { const b = BADGE_DEFS[k]; out.push({ id: 'c:' + k, kind: 'Milestones', name: b.name, sub: b.sub, icon: b.icon, cls: b.cls, score: { bronze: 60, silver: 70, gold: 80, prestige: 90 }[k] || 60 }); });
            try { const r = accountRank(); TITLE_BADGES.forEach(b => { if (r >= b.rank) out.push({ id: 'r:' + b.rank, kind: 'Rank Titles', name: b.name, sub: 'Rank ' + b.rank, icon: b.icon, cls: RANK_BADGE_CLS[b.rank] || 'gold', score: 40 + b.rank }); }); } catch (_) {}
            Object.keys(mastery || {}).forEach(k => { const t = mastTier(k); if (t >= 1 && PLANT_TYPES[k]) out.push({ id: 'p:' + k, kind: 'Plant Mastery', name: PLANT_TYPES[k].name, sub: MAST_NAMES[t] + ' Mastery', icon: PLANT_TYPES[k].emoji, cls: MAST_BADGE_CLS[t], score: 20 + t * 12, tier: t }); });
            return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
        }
        function honorPins() {
            try {
                const raw=localStorage.getItem(HONOR_PIN_KEY);
                if(raw===null)return null; // No preference saved: use the default five.
                const a=JSON.parse(raw);
                return Array.isArray(a)?a.slice(0,5):[];
            } catch (_) { return []; }
        }
        function saveHonorPins(a) { try { localStorage.setItem(HONOR_PIN_KEY, JSON.stringify(a.slice(0, 5))); } catch (_) {} }
        function featuredBadges(all) {
            const saved=honorPins();
            const ids=saved===null?all.slice(0,5).map(b=>b.id):saved;
            return ids.map(id=>all.find(b=>b.id===id)).filter(Boolean).slice(0,5);
        }
        function honorBadgeHTML(b, extra) {
            const sparks = n => Array.from({ length: n }, (_, i) => `<i class="bd-spark" style="--a:${(360 / n) * i}deg;--d:${(i % 3) * 0.6}s">✦</i>`).join('');
            const hi = b.cls === 'prestige' || b.cls === 'diamond';
            return `<div class="bd-wrap ${extra || ''}"><div class="bd bd-${b.cls}"><div class="bd-rays"></div><div class="bd-ring"></div><div class="bd-face"><span class="bd-icon">${b.icon}</span></div><div class="bd-shine"></div><div class="bd-orbit">${sparks(hi ? 8 : 5)}</div></div><div class="bd-ribbon bd-r-${b.cls}${b.name.length > 15 ? ' bd-long' : ''}">${b.name}</div><div class="bd-sub">${b.sub}</div></div>`;
        }
        function renderHomeBadges(justEarned) {
            const box = document.getElementById('home-badges'); if (!box) return;
            const all = allHonorBadges();
            if (!all.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
            box.classList.remove('hidden');
            const jid = justEarned ? 'c:' + justEarned : null;
            box.onclick = openHonorScreen;
            box.innerHTML = `<div class="bd-title">🏅 HALL OF HONOR</div><div class="bd-row">${featuredBadges(all).map(b => honorBadgeHTML(b, b.id === jid ? 'bd-new' : '')).join('')}</div><div class="bd-more">▸ Tap to view all ${all.length} badge${all.length === 1 ? '' : 's'}</div>`;
        }
        function openHonorScreen() {
            let ov = document.getElementById('honor-screen');
            if (!ov) { ov = document.createElement('div'); ov.id = 'honor-screen'; document.body.appendChild(ov); }
            ov.style.display = 'block'; document.body.style.overflow = 'hidden';
            renderHonorScreen();
        }
        function closeHonorScreen() { const ov = document.getElementById('honor-screen'); if (ov) ov.style.display = 'none'; document.body.style.overflow = ''; renderHomeBadges(); }
        function toggleHonorPin(id) {
            const all=allHonorBadges();
            let cur=honorPins();
            if(cur===null)cur=all.slice(0,5).map(b=>b.id);
            if(cur.includes(id))cur=cur.filter(x=>x!==id);
            else {if(cur.length>=5)cur.shift();cur.push(id);}
            saveHonorPins(cur);
            // Update the existing list in place. Rebuilding every badge animation
            // on each click caused a noticeable pause and could reset the selection.
            const ov=document.getElementById('honor-screen');
            if(ov)ov.querySelectorAll('.hs-item').forEach(item=>{
                const badgeId=item.getAttribute('data-badge-id');
                item.classList.toggle('on',cur.includes(badgeId));
            });
            renderHomeBadges();
        }
        function renderHonorScreen() {
            const ov = document.getElementById('honor-screen'); if (!ov) return;
            const all = allHonorBadges(), feat = new Set(featuredBadges(all).map(b => b.id));
            const secs = ['Milestones', 'Rank Titles', 'Plant Mastery'];
            ov.innerHTML = `<div class="hs-top"><button class="hs-back" onclick="closeHonorScreen()">← Back</button><div class="hs-h">🏅 HALL OF HONOR</div><div class="hs-c">${all.length} badges</div></div>
              <div class="hs-hint">Tap a badge to show it on your home screen (up to 5). ★ = featured.</div>
              ${secs.map(sec => { const L = all.filter(b => b.kind === sec); return L.length ? `<div class="hs-sec"><div class="hs-st">${sec} <span>${L.length}</span></div><div class="hs-grid">${L.map(b => `<div class="hs-item${feat.has(b.id) ? ' on' : ''}" data-badge-id="${b.id}" onclick="toggleHonorPin('${b.id}')">${honorBadgeHTML(b)}<i class="hs-pin">★</i></div>`).join('')}</div></div>` : ''; }).join('')}`;
        }
        function updateFertilizerHome() { updateChestBadge(); renderHomeBadges(); renderHomeRank(); const e=document.getElementById('fertilizer-home-count'); if(e)e.textContent=plantProgress.fertilizer||0; const f=document.getElementById('fertilizer-balance'); if(f)f.textContent=`${plantProgress.fertilizer||0} Fertilizer`; }
        function resetMissionRunState() { missionRunState = { usedBeans:false, placed:{} }; }
        function missionToast(text) {
            const t = document.createElement('div');
            t.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-xl bg-emerald-700 text-white font-black text-sm shadow-lg border border-emerald-300/60 pointer-events-none';
            t.textContent = text; document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
        }
        function missionAdd(stat, n) {
            if (!dailyMissionState) return;
            let changed = false;
            dailyMissionState.missions.forEach(m => {
                if (m.type !== 'count' || m.stat !== stat || m.done) return;
                m.progress = Math.min(m.target, (m.progress || 0) + n); changed = true;
                if (m.progress >= m.target) { m.done = true; plantProgress.fertilizer = (plantProgress.fertilizer || 0) + m.reward; savePlantProgress(); runXP.missions += m.reward * 50; missionToast(`Mission complete: ${m.title}! +${m.reward} 🧪 · +${m.reward * 50} XP after the battle`); }
            });
            if (changed && stat !== 'kills' && stat !== 'sun') saveDailyMissionState();
        }
        function missionPlantPlaced(key) { missionRunState.placed[key] = (missionRunState.placed[key] || 0) + 1; missionAdd('plants', 1); }
        function missionBeanUsed() { missionRunState.usedBeans = true; }
        function finishDailyMissions(won) {
            ensureTodaysMissions();
            if (won) dailyMissionState.missions.forEach(m => {
                if (m.done) return;
                let ok = false;
                if (m.type === 'winAny') ok = true;
                else if (m.type === 'usePlant') ok = (missionRunState.placed[m.target] || 0) >= (m.need || 2);
                else if (m.type === 'noBeans') ok = !missionRunState.usedBeans;
                else if (m.type === 'sunLeft') ok = sun >= m.target;
                if (ok) { m.done = true; plantProgress.fertilizer = (plantProgress.fertilizer || 0) + m.reward; runXP.missions += m.reward * 50; }
            });
            saveDailyMissionState(); savePlantProgress(); renderDailyMissions();
        }
        function openPlantProfile(key) {
            if (!PLANT_TYPES[key]) return;
            profilePlantKey=key;
            const owned=isPlantUnlocked(key);
            const info=PLANT_TYPES[key], level=owned?plantLevel(key):1;
            document.getElementById('profile-title').textContent=info.name+(owned?'':' · Locked');
            document.getElementById('profile-emoji').textContent=info.emoji;
            document.getElementById('profile-level').textContent=owned?`Level ${level} / 5`:'Not unlocked · Level 1 stats preview';
            const lore=PVZ2_PLANT_LORE[key];
            document.getElementById('profile-focus').textContent=plantStatFocus(key)==='health'?'Upgrade path: +32% health per level':'+30% basic attack power per level';
            let lorePanel=document.getElementById('profile-pvz2-lore');
            if(!lorePanel){lorePanel=document.createElement('section');lorePanel.id='profile-pvz2-lore';lorePanel.className='bg-slate-900 border border-sky-500/30 rounded-xl p-4 mb-4';document.getElementById('profile-level-list').before(lorePanel);}
            const gp=GUIDE_PLANT[key];lorePanel.classList.toggle('hidden',!gp);
            if(gp)lorePanel.innerHTML=`<div class="font-black text-sky-300 mb-2">🌿 Plant Almanac</div><p class="text-sm text-slate-300 mb-2"><b>Normal attack:</b> ${gp[0]}</p><p class="text-sm text-amber-200"><b>Ability (Plant Food):</b> ${gp[1]}</p>`;
            const list=document.getElementById('profile-level-list');list.innerHTML='';
            for(let lv=1;lv<=5;lv++){
                const unlocked=owned && lv<=level, row=document.createElement('div');
                row.className='rounded-lg border p-3 '+(unlocked?'border-emerald-700/60 bg-slate-900':'border-slate-700 bg-slate-900/40 opacity-60');
                row.innerHTML=`<div class="flex items-center justify-between mb-1"><b class="text-sm ${unlocked?'text-emerald-300':'text-slate-500'}">Level ${lv} ${unlocked?'✓':'🔒'}</b><span class="text-[10px] text-slate-400">${lv===1?'Base stats':`Upgrade cost: ${PLANT_LEVEL_COSTS[lv-1]} 🧪`}</span></div>${plantStatsHtml(key,lv)}<div class="text-xs text-sky-300 mt-1">${PVZ2_PLANT_LORE[key]?'Plant Food:':'Ability:'} ${plantAbilityDescription(key,lv)}</div>`;
                list.appendChild(row);
            }
            const next=level+1, cost=PLANT_LEVEL_COSTS[level]||0;
            document.getElementById('next-upgrade-cost').textContent=!owned?'LOCKED':level>=5?'MAX LEVEL':`Cost: ${cost} 🧪`;
            document.getElementById('upgrade-next-desc').textContent=!owned?'Unlock this plant in the store or by completing its campaign milestone to upgrade it.':level>=5?'This plant has reached its maximum level.':`${plantStatFocus(key)==='health'?'+32% maximum health':'+30% basic attack power'}; abilities gain increasingly powerful effects, including longer status durations. Unlock Level ${next}.`;
            const btn=document.getElementById('upgrade-plant-btn');btn.disabled=!owned||level>=5||(plantProgress.fertilizer||0)<cost;btn.textContent=!owned?'🔒 Unlock plant to upgrade':level>=5?'MAX LEVEL':`⬆️ Upgrade to Level ${next} (${cost} 🧪)`;
            const choices=document.getElementById('profile-use-levels');choices.innerHTML='';
            const usePanel=choices.parentElement; if(usePanel)usePanel.classList.toggle('hidden',!owned);
            if(owned)for(let lv=1;lv<=level;lv++){const b=document.createElement('button');b.className='px-3 py-2 rounded-lg border text-sm font-bold '+(selectedPlantLevel(key)===lv?'border-amber-400 bg-amber-500/20 text-amber-200':'border-slate-600 bg-slate-800 text-slate-300');b.textContent=`Level ${lv} ${selectedPlantLevel(key)===lv?'✓':''}`;b.onclick=()=>{plantProgress.selectedLevels[key]=lv;savePlantProgress();openPlantProfile(key);renderSelectionScreen();};choices.appendChild(b);}
            renderProfileMastery(key);updateFertilizerHome();document.getElementById('plant-profile-screen').classList.remove('hidden');
        }
        function closePlantProfile(){document.getElementById('plant-profile-screen').classList.add('hidden');profilePlantKey=null;}
        function upgradeProfilePlant(){if(!profilePlantKey)return;const lv=plantLevel(profilePlantKey);if(lv>=5)return;const cost=PLANT_LEVEL_COSTS[lv];if((plantProgress.fertilizer||0)<cost)return;plantProgress.fertilizer-=cost;plantProgress.levels[profilePlantKey]=lv+1;plantProgress.selectedLevels[profilePlantKey]=lv+1;savePlantProgress();renderSelectionScreen();openPlantProfile(profilePlantKey);awardXP(50*(lv+1));}


        // The few Tailwind utilities that game-layer elements use (Tailwind can't style inside a shadow tree).
        const SHADOW_UTILITY_CSS = `
.absolute{position:absolute}.inset-0{inset:0}.flex{display:flex}.flex-col{flex-direction:column}
.items-center{align-items:center}.justify-center{justify-content:center}.p-2{padding:.5rem}
.pointer-events-none{pointer-events:none}.pointer-events-auto{pointer-events:auto}.cursor-pointer{cursor:pointer}.select-none{user-select:none;-webkit-user-select:none}
.z-30{z-index:30}.z-40{z-index:40}.z-50{z-index:50}
.text-sm{font-size:.875rem;line-height:1.25rem}.text-base{font-size:1rem;line-height:1.5rem}.text-xl{font-size:1.25rem;line-height:1.75rem}
.text-2xl{font-size:1.5rem;line-height:2rem}.text-3xl{font-size:1.875rem;line-height:2.25rem}.text-4xl{font-size:2.25rem;line-height:2.5rem}
.text-5xl{font-size:3rem;line-height:1}.text-6xl{font-size:3.75rem;line-height:1}
.font-extrabold{font-weight:800}.text-amber-300{color:#fcd34d}.text-emerald-300{color:#6ee7b7}.text-cyan-200{color:#a5f3fc}
.bg-cyan-400\\/20{background-color:rgba(34,211,238,.2)}
.transition-all{transition:all .15s cubic-bezier(.4,0,.2,1)}.duration-500{transition-duration:.5s}
.animate-pulse{animation:twPulse 2s cubic-bezier(.4,0,.6,1) infinite}@keyframes twPulse{50%{opacity:.5}}
@media (min-width:640px){
.sm\\:text-base{font-size:1rem;line-height:1.5rem}.sm\\:text-2xl{font-size:1.5rem;line-height:2rem}.sm\\:text-3xl{font-size:1.875rem;line-height:2.25rem}
.sm\\:text-4xl{font-size:2.25rem;line-height:2.5rem}.sm\\:text-5xl{font-size:3rem;line-height:1}.sm\\:text-6xl{font-size:3.75rem;line-height:1}}
`;

        // DOM Element Cache
        let boardEl, gameLayerEl, sunCountEl, beanCountEl, waveNumEl, maxWavesEl, zombiesKilledEl, startBtn, modal;

        function initDOMReferences() {
            boardEl = document.getElementById('lawn-board');
            // The lawn's moving parts live in a Shadow DOM. The Tailwind CDN script watches the main document
            // for DOM/class changes and recompiles CSS when it sees them; changes inside a shadow tree are
            // invisible to it, so hundreds of entity updates per second no longer wake it up.
            const host = document.getElementById('game-layer');
            const shadow = host.attachShadow({ mode: 'open' });
            const css = document.createElement('style');
            css.textContent = (document.getElementById('pvz-styles') || {}).textContent + SHADOW_UTILITY_CSS;
            const layer = document.createElement('div');
            layer.style.cssText = 'position:absolute;inset:0';
            shadow.append(css, layer);
            gameLayerEl = layer;
            projCanvas = document.createElement('canvas');
            projCanvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:15;pointer-events:none';
            layer.appendChild(projCanvas); projCtx = projCanvas.getContext('2d');
            layerW = layer.clientWidth || layerW; layerH = layer.clientHeight || layerH;
            try { new ResizeObserver(() => { layerW = layer.clientWidth || layerW; layerH = layer.clientHeight || layerH; }).observe(layer); } catch (err) {}
            sunCountEl = document.getElementById('sun-count');
            beanCountEl = document.getElementById('bean-count');
            waveNumEl = document.getElementById('wave-num');
            maxWavesEl = document.getElementById('max-waves');
            zombiesKilledEl = document.getElementById('zombies-killed');
            startBtn = document.getElementById('start-btn');
            modal = document.getElementById('modal');
            updateFieldUI();
        }

        // Pre-Game Selection Screen
        function renderSelectionScreen() {
            const availableContainer = document.getElementById('available-plants-grid');
            const deckContainer = document.getElementById('selected-deck-bar');
            const deckCountText = document.getElementById('deck-count-text');

            if (!availableContainer || !deckContainer || !deckCountText) return;

            deckCountText.textContent = selectedDeck.length;
            const levelLabel = document.getElementById('selected-level-name');
            if (levelLabel) levelLabel.textContent = selectedLevelLabel();
            const psLabel = document.getElementById('ps-level-name');
            if (psLabel) psLabel.textContent = selectedLevelLabel();

            deckContainer.innerHTML = '';
            for (let i = 0; i < 8; i++) {
                const plantKey = selectedDeck[i];
                const slotEl = document.createElement('div');
                slotEl.className = 'flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800 border-2 min-w-[70px] min-h-[70px] transition-all cursor-pointer relative';
                
                if (plantKey && PLANT_TYPES[plantKey]) {
                    const info = PLANT_TYPES[plantKey];
                    slotEl.classList.add('border-amber-400', 'hover:border-red-400');
                    slotEl.innerHTML = `
                        <span class="text-2xl">${info.emoji}</span>
                        <span class="text-[10px] font-bold text-slate-200">${info.name}</span>
                        <span class="text-xs font-black text-amber-400">☀️ ${info.cost}</span>
                        <span class="text-[9px] text-emerald-300">Lv. ${plantLevel(plantKey)}</span>
                    `;
                    slotEl.dataset.plant = plantKey; slotEl.className += mastCardCls(plantKey); slotEl.insertAdjacentHTML('beforeend', mastPip(plantKey));
                    slotEl.onclick = () => removeFromDeck(plantKey);
                    slotEl.oncontextmenu = (event) => { event.preventDefault(); openPlantProfile(plantKey); };
                } else {
                    slotEl.classList.add('border-dashed', 'border-slate-700', 'bg-slate-900/50');
                    slotEl.innerHTML = `<span class="text-xs text-slate-600 font-bold">Empty Slot</span>`;
                }
                deckContainer.appendChild(slotEl);
            }

            availableContainer.innerHTML = '';
            Object.keys(PLANT_TYPES).forEach(key => {
                const info = PLANT_TYPES[key];
                const isSelected = selectedDeck.includes(key);
                const owned = isPlantUnlocked(key);
                const card = document.createElement('div');
                card.className = `flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800 border-2 transition-all relative min-h-[80px] ${!owned?'border-slate-800 opacity-70 grayscale':isSelected?'border-slate-700 opacity-40 grayscale cursor-not-allowed':'border-slate-700 hover:border-amber-400 hover:scale-105 bg-slate-800/90 cursor-pointer'}`;
                card.innerHTML = `
                    <span class="text-2xl">${owned?info.emoji:'🔒'}</span>
                    <span class="text-[10px] font-bold text-slate-200 text-center leading-tight mt-0.5">${info.name}</span>
                    ${owned?`<span class="text-xs font-black text-amber-400 mt-0.5">☀️ ${info.cost}</span><span class="text-[9px] font-bold text-emerald-300">Lv. ${plantLevel(key)}</span><span class="text-[8px] text-slate-500">ⓘ: details &amp; upgrade</span>`:`<span class="text-[9px] text-rose-300">Not unlocked</span><span class="text-[8px] text-slate-500">Click: how to unlock</span>`}
                `;
                card.oncontextmenu = (event) => { event.preventDefault(); openPlantProfile(key); };
                card.dataset.plant = key;
                if (!owned) card.dataset.locked = '1';
                const infoBtn = document.createElement('button');
                infoBtn.type = 'button'; infoBtn.className = 'ps-info'; infoBtn.textContent = 'ⓘ'; infoBtn.title = 'Details & upgrades';
                infoBtn.onclick = (event) => { event.stopPropagation(); openPlantProfile(key); };
                card.appendChild(infoBtn);
                if (owned && !isSelected) card.onclick = () => addToDeck(key);
                else if (!owned) card.onclick = () => openPlantProfile(key);
                if (owned) { card.className += mastCardCls(key); card.insertAdjacentHTML('beforeend', mastPip(key)); }
                availableContainer.appendChild(card);
            });
        }

        function addToDeck(plantKey) {
            if (!isPlantUnlocked(plantKey)) return;
            initAudio();
            if (selectedDeck.length >= 8) {
                playSound('hit');
                return;
            }
            if (!selectedDeck.includes(plantKey)) {
                selectedDeck.push(plantKey);
                playSound('plant');
                renderSelectionScreen();
            }
        }

        function removeFromDeck(plantKey) {
            initAudio();
            selectedDeck = selectedDeck.filter(k => k !== plantKey);
            playSound('plant');
            renderSelectionScreen();
        }

        function localDateStamp(date=new Date()) { const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0'); return `${y}-${m}-${d}`; }
        function dailyStorePlants() {
            const stamp=localDateStamp();
            // Deterministic daily selection: the five offers stay fixed for the whole day, even after purchases.
            const rank=key=>{let h=2166136261;const value=stamp+':'+key;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
            const todaysFive=STORE_PLANT_POOL.slice().sort((a,b)=>rank(a)-rank(b)).slice(0,5);
            return todaysFive.filter(key=>!isPlantUnlocked(key));
        }
        function openSaveScreen() {
            const screen=document.getElementById('save-progress-screen');
            if(screen)screen.classList.remove('hidden');
            loadLatestSaveCodeField();
        }
        function closeSaveScreen() { const screen=document.getElementById('save-progress-screen'); if(screen)screen.classList.add('hidden'); }

        let activeGuideTab='plants';
        function openGuideScreen(tab='plants') {
            switchGuideTab(tab);
            renderPlantGuide();
            renderZombieGuide();
            document.getElementById('guide-screen').classList.remove('hidden');
        }
        function closeGuideScreen() { document.getElementById('guide-screen').classList.add('hidden'); }
        function switchGuideTab(tab) {
            activeGuideTab=tab==='zombies'?'zombies':'plants';
            document.getElementById('guide-plants-panel').classList.toggle('hidden',activeGuideTab!=='plants');
            document.getElementById('guide-zombies-panel').classList.toggle('hidden',activeGuideTab!=='zombies');
            document.getElementById('guide-plants-tab').className='px-4 py-2 rounded-lg text-white text-sm font-black '+(activeGuideTab==='plants'?'bg-emerald-700':'bg-slate-700');
            document.getElementById('guide-zombies-tab').className='px-4 py-2 rounded-lg text-white text-sm font-black '+(activeGuideTab==='zombies'?'bg-violet-700':'bg-slate-700');
        }
        // ---------------- Guide data: how every plant / zombie attacks normally and what its ability does ----------------
        const GUIDE_PLANT = {
            sunflower: ['No attack. Every 10 seconds it produces a 50-sun pickup (more at higher levels).', 'Plant Food: instantly gives you 300 sun (scales with level).'],
            peashooter: ['Fires one green pea every 1.8 seconds down its lane while a zombie is in that lane (26 damage).', 'Plant Food: fires a rapid volley of 10 peas down its lane (more at higher levels).'],
            snowpea: ['Fires a frozen pea every 2 seconds at zombies in its lane (20 damage) that slows the zombie to half speed.', 'Plant Food: fires a rapid volley of 10 frozen peas down its lane.'],
            firepea: ['Fires a fireball every 1.9 seconds at zombies in its lane (45 damage).', 'Plant Food: fires a rapid volley of 10 fireballs down its lane.'],
            wallnut: ['No attack. It blocks zombies with a large pool of health.', 'Plant Food: fully restores its health.'],
            cherrybomb: ['Explodes the moment it is planted, dealing 500 damage to every zombie in the 3x3 area around it, then disappears.', 'Plant Food: it triggers its explosion again with ability-level strength (it only exists for a split second, so you will rarely use this).'],
            potatomine: ['Takes 5 seconds to arm. Once armed, the first zombie that touches it triggers a 500-damage explosion and the mine is used up.', 'Plant Food: plants 3 or more fully armed Potato Mines (more at higher levels) on random empty tiles.'],
            bonkchoy: ['Punches every zombie within about 1.5 tiles in its lane and the lanes next to it, 25 damage per punch, about three times a second.', 'Plant Food: unleashes a barrage of boxing-glove strikes at every zombie on the lawn.'],
            gatlingpea: ['Fires a burst of 4 peas every 2 seconds down its lane (20 damage each). A partner plant can be fused onto it to change its shots.', 'Plant Food: fires a huge volley of 16 peas (or a boosted volley of its fused partner).'],
            spikeweed: ['A ground trap. Zombies that walk over it take continuous damage; ordinary zombies walk straight over it without stopping.', 'Plant Food: deals 200 damage (scaled by level) to every zombie in its lane.'],
            cabbagetosser: ['Lobs a cabbage over obstacles at the closest zombie in its lane (40 damage).', 'Plant Food: rains butter and cabbage volleys onto every zombie on the lawn.'],
            corntosser: ['Lobs corn kernels (20 damage) and sometimes butter (40 damage) that stuns the zombie for 2 seconds.', 'Plant Food: rains butter and kernel volleys onto every zombie on the lawn.'],
            garlic: ['No attack. A zombie biting it gets its lane changed to a neighbouring lane, and the bite damages the garlic.', 'Plant Food: fully restores its health.'],
            firedragon: ['Breathes fire (34.5 damage) on all zombies up to 40% of the lawn ahead of it, in its lane and the lanes above and below, every 1.6 seconds.', 'Plant Food: sweeps fire across 3 lanes, dealing heavy damage and setting zombies ablaze.'],
            snowdragon: ['Breathes frost (16 damage) on all zombies in range across 3 lanes every 1.6 seconds, slowing them.', 'Plant Food: sweeps ice across 3 lanes, damaging and freezing zombies solid.'],
            cactus: ['Shoots needles that pierce every zombie in its lane (20 damage each).', 'Plant Food: permanently becomes an electric cactus and sends chain lightning through up to 7+ zombies; afterwards its needles stun.'],
            blover: ['Blows every zombie on the lawn backwards the moment it is planted, then disappears.', 'Plant Food: a stronger gust that pushes zombies back much farther.'],
            iceberglettuce: ['Planted on the lawn, it flash-freezes nearby zombies for 3 seconds and deals 50 damage, then is used up.', 'Plant Food: freezes every grounded zombie on the lawn for 10 seconds (longer at higher levels).'],
            gravebuster: ['No attack. Planted on a zombie-spawning tomb, it destroys that tomb.', 'No Plant Food effect.'],
            twinsunflower: ['No attack. Produces two ~80-sun pickups every 8.5 seconds (scales with level).', 'Plant Food: instantly gives you ~290 sun, plus a level bonus: Lv1 +100%, Lv2 +70%, Lv3 +50%, Lv4 +20%, Lv5 +5%.'],
            coconutcannon: ['Tap it to fire a fast cannonball down its lane (160 damage with splash); then it rests for 8 seconds.', 'Plant Food: fires a huge cannonball that hits everything in its lane for 520 damage and shoves them toward the right.'],
            spikerock: ['A tougher ground trap with much stronger spikes. Ordinary zombies ignore it and walk over it; only giants, vehicles and the boss attack it.', 'Plant Food: covers its lane in spikes for 120 damage to every zombie there and drags them back toward the Spikerock.'],
            peapod: ['Fires peas down its lane (20 damage each). You can stack up to 5 pods on one tile; each extra pod fires another pea.', 'Plant Food: fires 5 giant peas (180 damage each) that knock zombies back.'],
            melonpult: ['Lobs a melon at the closest zombie in its lane (95 damage) with splash damage to nearby zombies.', 'Plant Food: lobs melons onto every zombie on the lawn.'],
            tallnut: ['No attack. A huge wall that also stops tall obstacles.', 'Plant Food: fully restores its health and gives it a temporary armor layer.'],
            wintermelon: ['Lobs a frozen melon at the closest zombie in its lane (80 damage) with splash damage that slows everything it hits.', 'Plant Food: hits every zombie on the lawn with a frozen melon and slows them all.'],
            lightningreed: ['Every 1.8 seconds shoots chain lightning that jumps between the nearest zombies in its lane and the lanes next to it, stunning each briefly.', 'Plant Food: overloads and fires several stronger chain lightning pulses in a row.'],
            rotobaga: ['Fires 38-damage rutabaga shots along the diagonals when a zombie stands on one. If it dies, it lifts zombies on its tile and the four diagonal tiles into the air and slams them down.', 'Plant Food: fires a burst of shots into the neighbouring lanes and damages zombies outside its lane.'],
            citron: ['Charges an energy orb every 3.6 seconds and fires it down its lane (260 damage plus splash).', 'Plant Food: fires a giant orb that deals 1100 damage to the first zombie, knocks it back and blasts zombies around it.'],
            tileturnip: ['No attack. It creates a Power Tile under itself; other plants can stand on the same tile.', 'No separate Plant Food effect, but feeding any plant standing on a Power Tile feeds every plant on a Power Tile at once.'],
            sunshroom: ['No attack. Produces small 15-sun pickups at first and grows after wave 3 to produce 50-sun pickups.', 'Plant Food: grows instantly and gives you 225 sun.'],
            celery: ['Smacks zombies within about 2.7 tiles of it in its lane, both in front of and behind it, for 48 damage every half second.', 'Plant Food: restores its health and plants 3 more Celery Stalkers on random empty tiles.'],
            primalpeashooter: ['Fires a heavy rock pea (55 damage) that knocks zombies backward and stuns them briefly.', 'Plant Food: fires 5 giant rock peas down its lane.'],
            powerlily: ['No attack. When planted it gives you one Energy Bean (Plant Food) and disappears.', 'No Plant Food effect.'],
            jalapeno: ['Explodes the moment it is planted, burning every zombie in its row for 900 damage, then disappears.', 'No Plant Food effect.'],
            laserbean: ['Every 2.4 seconds fires an instant laser down its lane that hits every zombie in that lane at once.', 'Plant Food: fires four rapid giant lasers down its lane and sweeps a laser across every other lane too.'],
            infinut: ['No attack. A wall protected by a force field that absorbs damage; when the field breaks it recharges after a few seconds, over and over.', 'Plant Food: becomes invincible for several seconds, restores its shield and health, and shocks nearby zombies.'],
            magnetshroom: ['Every 4.2 seconds picks a metal-armored zombie (bucket, football, pyramid, barrel, imp cannon, pirate) within range, rips the metal off for heavy damage, and stuns vehicles. Each zombie can be stripped once.', 'Plant Food: pulls the metal off every metal zombie on the lawn at once and yanks non-metal zombies toward it.'],
            thymewarp: ['A one-time plant. When planted it warps time around it: nearby zombies are thrown back, damaged and frozen in time, while nearby plants heal.', 'Plant Food: not usable (the plant is used up immediately).'],
            intensivecarrot: ['No attack. When another plant is destroyed, the carrot is used up to bring that plant back to life with part of its health.', 'Plant Food: fully heals every plant and revives plants that fell in the last 12 seconds.'],
            primalsunflower: ['No attack. Every 9 seconds produces two small suns (25 each), and every third time a large Primal Sun.', 'Plant Food: bursts out 8 suns around itself, with a level bonus: Lv1 +100%, Lv2 +70%, Lv3 +50%, Lv4 +20%, Lv5 +5%.'],
            primalpotatomine: ['Arms in 3 seconds. When a zombie touches it, it explodes in a 3x3 area, damaging and stunning every zombie there.', 'Plant Food: detonates mines on up to six zombies across the lawn.'],
            bowlingbulb: ['Every 3 seconds rolls a bulb down its lane. Each hit knocks the zombie back, and the bulb bounces into a neighbouring lane, hitting up to 5 zombies.', 'Plant Food: rolls a giant bulb down every lane that hits up to 12 zombies.'],
            grimrose: ['Every 2.6 seconds throws a cursed thorn at the closest zombie in its lane: damage plus a curse that hurts it over time. When a cursed zombie dies, the curse jumps to up to two nearby zombies.', 'Plant Food: curses every zombie on the lawn with a strong damage-over-time curse.'],
            shadowshroom: ['Every 2 seconds fires a shadow bolt down its lane. Zombies hit are slowed and bite for less damage, and the shroom and plants around it heal.', 'Plant Food: a shadow nova damages, slows and weakens every zombie and heals every plant.'],
            dusklobber: ['Every 2.8 seconds lobs a dusk spore at the closest zombie in its lane: heavy splash damage plus a curse that keeps hurting.', 'Plant Food: rains dusk meteors onto up to eight zombies.'],
            chomper: ['Swallows a nearby zombie whole in one bite, then spends about 12 seconds digesting (and cannot bite). Giants and bosses are not swallowed; they take heavy bite damage instead.', 'Plant Food: swallows up to eight zombies across the lawn instantly.'],
            sweetpotato: ['Every 2.4 seconds heals the plants around it, and slaps nearby zombies with sticky caramel (damage plus a slow).', 'Plant Food: fully heals every plant and gives them a sugar rush (faster attacks).'],
            sapling: ['Every 2.6 seconds lobs sticky sap at the closest zombie in its lane: damage with splash and a heavy slow.', 'Plant Food: floods the lawn with sap, damaging every zombie and slowing them almost to a stop.'],
            electricblueberry: ['Whenever zombies get within about two tiles, discharges electricity every 3.3 seconds that shocks and stuns every zombie in the 3x3 area around it.', 'Plant Food: a lightning storm strikes every zombie on the lawn and stuns them.'],
            electricpeashooter: ['Fires an electric pea every 1.7 seconds (40 damage). A pea stuns the zombie it hits and arcs lightning to up to 2 more nearby zombies for 80% damage each.', 'Plant Food: a lightning storm strikes up to 20 zombies with heavy damage, each bolt arcing to 2 more zombies, and stuns them for almost 2 seconds.'],
            torchwood: ['No projectile. Every pea that passes through it becomes a fireball (frozen peas become normal peas). Zombies that chew on it catch fire.', 'Plant Food: sets its lane ablaze and turns every pea on the lawn into a fireball for several seconds.']
        };
        function ZG(key, z) {
            const bite = `Bites the plant in front of it once per second (${z && z.damage ? z.damage : '?'} damage at Zombie Level 1).`;
            const plantMut = {
                peamutant: 'Shoots glowing red peas along its lane from very long range every 2.3 seconds.',
                gatlingmutant: 'Shoots 4 glowing red peas along its lane every 2.9 seconds from very long range.',
                snowpeamutant: 'Shoots glowing red frozen peas from very long range every 2.3 seconds; a hit slows the plant\'s attacks.',
                firepeamutant: 'Shoots glowing red fireballs from very long range every 2.3 seconds; a hit sets the plant on fire.',
                sunmutant: 'Every 6.2 seconds steals 55 sun from you (more at higher Zombie Levels), shown as a red-glowing sun flying to it.',
                twinsunmutant: 'Every 6.2 seconds steals 90 sun from you (more at higher Zombie Levels) with two red-glowing suns.',
                bonkmutant: 'Punches the nearest plant within about 1.2 tiles every second for heavy damage.',
                firedragonmutant: 'Breathes red-glowing fire on up to 5 plants within about 2.7 tiles every 4.2 seconds, burning them.',
                snowdragonmutant: 'Breathes red-glowing frost on up to 5 plants within about 2.7 tiles every 4.8 seconds, freezing them.',
                rotobagamutant: 'Every 7.6 seconds, if a plant is within 2 tiles (one empty tile between is fine), tosses up to 3 plants into the air; they slam to the ground and take damage (they are not destroyed).',
                blowermutant: 'Every 7 seconds blows a gust that speeds up nearby zombies for 3 seconds.',
                wallnutmutant: bite + ' It has no ranged attack.', tallnutmutant: bite + ' It has no ranged attack.',
                cherrymutant: bite + ' When it dies it explodes, damaging the plants around it.',
                jalapenomutant: bite + ' When it dies it explodes into flame, burning plants across its lane.',
                icebergmutant: bite + ' When it dies it freezes the plants around it.'
            };
            const lvl7 = {
                peamutant: 'At Zombie Level 7 (every 15 seconds): fires a 10-pea volley down its lane.',
                gatlingmutant: 'At Zombie Level 7 (every 15 seconds): fires a 16-pea volley down its lane.',
                snowpeamutant: 'At Zombie Level 7 (every 15 seconds): fires an 8-shot frozen volley.',
                firepeamutant: 'At Zombie Level 7 (every 15 seconds): fires an 8-shot fire volley.',
                sunmutant: 'At Zombie Level 7 (every 15 seconds): steals a big chunk of sun.',
                twinsunmutant: 'At Zombie Level 7 (every 15 seconds): steals a very big chunk of sun.',
                bonkmutant: 'At Zombie Level 7 (every 15 seconds): slams all plants within 30% of the lawn width.',
                firedragonmutant: 'At Zombie Level 7 (every 15 seconds): a wide fire sweep that burns up to 12 plants.',
                snowdragonmutant: 'At Zombie Level 7 (every 15 seconds): a wide frost sweep that freezes up to 12 plants.',
                rotobagamutant: 'At Zombie Level 7 (every 15 seconds): tosses up to 3 plants within 2 tiles into the air and slams them down for damage.',
                blowermutant: 'At Zombie Level 7 (every 15 seconds): blows a gust that speeds up every zombie on the lawn.',
                wallnutmutant: 'At Zombie Level 7: heals itself when its health falls low.', tallnutmutant: 'At Zombie Level 7: heals itself when its health falls low.',
                cherrymutant: 'At Zombie Level 7 its death explosion is bigger.', jalapenomutant: 'At Zombie Level 7 its death flames are bigger.', icebergmutant: 'At Zombie Level 7 its death freeze is bigger.'
            };
            if (plantMut[key]) return [plantMut[key], lvl7[key] || 'None.'];
            const T = {
                inertia: [bite, 'Momentum builds while it walks without obstruction. Its first collision with a plant converts that speed into a powerful slam, then resets its momentum.'],
                fma_zombie: [bite, 'Its heavy mass resists knockback; ordinary projectile impacts barely move it and may nudge it forward. Freezing temporarily interrupts its mass advantage.'],
                newton3_zombie: [bite, 'Rocket counterforce: projectile damage builds its response; it recoils and fires a rocket/exhaust strike toward the nearest plant. The stronger the incoming hit, the stronger its retaliatory blast.'],
                relativity_zombie: [bite, 'Projects a wide time-dilation field around itself. Plants and projectiles inside the field operate more slowly; Wall-nut, Tall-nut and Infi-nut anchor formations protect nearby plants.'],
                photon_zombie: [bite, 'Every 3 seconds it flashes 2 tiles forward, bypassing Spikeweed and Spikerock. A Tall-nut blocks the blink path.'],
                tesla_zombie: [bite, 'Electric hits charge its coil. At 3 charges it releases an EMP in a wide area, disrupting nearby plants for a short time.'],
                schrodinger_zombie: [bite, 'On defeat, its quantum state resolves: it either vanishes or returns enraged. The enraged form moves at 2.5× its prior enraged speed and attacks much harder.'],
                hawking_zombie: ['No bite; it is stationary and creates gravitational hazards instead.', 'Every 9 seconds it opens a black hole that swallows nearby projectiles and strongly pulls other zombies forward.'],
                newton_elite: ['No bite; it remains at the backline and attacks through gravity events.', 'Every 8 seconds it drops a glowing cosmic apple. For 3 seconds, heavy gravity pulls airborne lobbed shots into the ground and makes all zombies immune to knockback.'],
                einstein_elite: ['No bite and no forward movement. Every 10 seconds it relocates vertically to another lane.', 'Special Relativity every 9s: two random lanes are slowed to 35% plant speed for 4s and zombies there warp 1.5 tiles forward. General Relativity every 14s or at 50% HP: a 5s center-lawn singularity bends straight shots into its core and reduces heavy lobbed damage by 50%. It also summons World 4 zombies as reinforcements. Grand Unification or explosive/melee attacks can end the singularity early.'],
                pendulum: [bite, 'Forward swing: 3× bite damage. Backward swing: slower movement and increased vulnerability. The swing alternates continuously.'],
                skater_zombie: [bite, 'Moves quickly and bites for increased damage. Ignores ice and sap slow effects; knockback sends it skidding toward the right edge.'],
                refractor_zombie: [bite, 'Its angled prism mirror bends straight projectiles into an adjacent lane. Lobbed attacks arc over and bypass the reflective shield.'],
                basic: [bite, 'None.'], cone: [bite, 'None. Its cone is extra health.'], bucket: [bite, 'None. Its bucket is extra health (a Magnet-shroom can rip it off).'],
                football: [bite, 'Blitz: every ~7 seconds it charges forward at more than double speed for 2 seconds.'], pyramid: [bite, 'Tomb Aura: every ~6.5 seconds heals all zombies near it by 12% of their health.'],
                polevault: [bite, 'Vaults over the first plant it meets, landing behind it, and then walks on slower.'],
                newspaper: [bite, 'When its newspaper is destroyed (about 28% of its health lost) it gets enraged and runs faster.'],
                disco: [bite, 'Back-up Dancers: every ~10 seconds two basic dancers join from the lanes above and below it.'], gargantuar: ['Smashes the plant in front of it, 300 damage per hit.', 'Throws an Imp forward while advancing.'],
                imp: [bite + ' It is very fast and fragile.', 'Sprint-hop: every ~4.5 seconds it hops forward and sprints for a moment.'],
                impcannon: [bite, 'Periodically fires an Imp onto the lawn ahead of itself.'],
                barrelroller: [bite, 'Its barrel absorbs damage; when the barrel breaks a fast Imp pops out.'],
                gargantuarpirate: ['Smashes the plant in front of it, 330 damage per hit.', 'Throws an Imp forward. Cannonball: every ~10 seconds fires a cannonball at the closest plant with splash damage.'],
                jollyroger: [bite, 'Anchor Toss: every ~8.5 seconds hurls an anchor at the closest plant for heavy damage and a 3-second stun.'], camel: [bite, 'Its shield cuts projectile damage until it is worn down. Sand Spit: every ~8 seconds blinds the closest plant (damage + it stops attacking).'],
                explorer: [bite, 'Torch Blaze: every ~8 seconds sets up to 3 nearby plants on fire.'], tombraiser: [bite, 'Raises stationary tombs on the lawn that spawn more zombies.'],
                tomb: ['It does not attack. It sits on the lawn and blocks the tile.', 'Periodically spawns basic or camel zombies until destroyed (a Grave Buster removes it).'],
                pharaoh: [bite + ' Its bite is powerful.', 'Curse of the Pharaoh: every ~10 seconds up to 4 nearby plants take damage and stop attacking for 3.5 seconds.'],
                mummygargantuar: ['Smashes the plant in front of it, 360 damage per hit.', 'Throws an Imp forward. Mummy Wrap: every ~11 seconds wraps up to 3 plants (damage + stun) and heals itself 6%.'],
                chickenwrangler: [bite, 'Periodically releases two fast Zombie Chickens.'],
                chicken: [bite, 'Dodge: every ~4 seconds it flaps into a neighbouring lane. It is very fast.'], zombiebull: [bite, 'Periodically charges forward at high speed.'],
                wildwestgargantuar: ['Smashes the plant in front of it, 380 damage per hit.', 'Throws an Imp forward. Stampede Slam: every ~11.5 seconds the ground shakes, damaging and stunning nearby plants.'],
                pianist: [bite, 'Plays music that enrages nearby zombies, temporarily speeding them up.'],
                biologistmutant: [bite, 'Every 8 seconds zaps a random zombie with a mutation beam: +50% health (green), double damage (red) or +50% speed (blue).'],
                mendelmutant: ['It never advances and does not attack plants. Only one can exist at a time.', 'Every 8 seconds attracts and fuses zombies that share matching plant traits into stronger zombies.'],
                darwinmutant: ['It stays on the far-right tile and does not attack plants. Only one can exist at a time.', 'Every 8 seconds evolves two random zombies, giving each an extra random plant trait (with its own stats and attack) and a white glow.']
            };
            return T[key] || [bite, 'None.'];
        }
        function renderPlantGuide() {
            const grid=document.getElementById('guide-plants-grid'); if(!grid)return;
            grid.innerHTML='';
            const resonance=document.createElement('section');
            resonance.className='guide-card col-span-full border border-indigo-400/40';
            resonance.innerHTML=`<div class="font-black text-indigo-200 text-sm mb-1">⚛️ FUNDAMENTAL FIELD RESONANCE · WORLD 4</div>
            <div class="text-[11px] text-slate-300 mb-2">Activate one universal field during battle. It affects every matching plant already on the lawn for 10 seconds; after activation, all fields share a 20-second cooldown.</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div class="rounded-lg bg-slate-950/70 p-2 text-[11px]"><b class="text-sky-300">⚡ Electromagnetic Field</b><br>Peashooter, Repeater, Gatling Pea, Snow Pea, Fire Pea, Laser Bean, Citron, Lightning Reed and Electric Peashooter. Straight shots travel 60% faster, pierce one extra zombie and deal 25% bonus damage to armored/metallic targets.</div>
              <div class="rounded-lg bg-slate-950/70 p-2 text-[11px]"><b class="text-amber-300">🌍 Gravitational Field</b><br>Cabbage-pult, Kernel-pult, Melon-pult, Winter Melon, Coconut Cannon, Bonk Choy and Squash. Lobbed hits gain 35% splash radius and a 25% stun chance; melee strikes gain heavy knockback.</div>
              <div class="rounded-lg bg-slate-950/70 p-2 text-[11px]"><b class="text-rose-300">☢️ Strong Nuclear Force</b><br>Wall-nut, Tall-nut, Endurian, Pumpkin, Cherry Bomb, Potato Mine, Jalapeño and Doom-shroom. Defenders gain 40% maximum health and armor regeneration; explosives trigger a delayed 3×3 fission shockwave.</div>
              <div class="rounded-lg bg-slate-950/70 p-2 text-[11px]"><b class="text-violet-300">✨ Weak Nuclear / Quantum Field</b><br>Sunflower, Twin Sunflower, Sun-shroom, Iceberg Lettuce, Stallia, Blover, Magnet-shroom and Sap-fling. Cooldowns and sun intervals are 20% faster; support and freeze effects have a 30% chance to echo into an adjacent lane.</div>
            </div>
            <div class="text-[10px] text-fuchsia-200 mt-2"><b>Grand Unification:</b> Spend 1 Plant Food at the Field Core to activate all four laws for every plant for 20 seconds.</div>`;
            grid.appendChild(resonance);
            Object.keys(PLANT_TYPES).forEach(key=>{
                const info=PLANT_TYPES[key],owned=isPlantUnlocked(key),card=document.createElement('article');
                card.className='guide-card';
                const status=owned?'UNLOCKED':STORE_PLANT_POOL.includes(key)?'STORE PLANT': 'CAMPAIGN REWARD';
                const unlockText=owned?'Owned by you':STORE_PLANT_POOL.includes(key)?`Buy from the daily store (${STORE_PLANT_PRICES[key]||30} fertilizers)`:(()=>{const r=CAMPAIGN_PLANT_REWARDS.find(x=>x.plant===key);return r?`Clear Stage ${r.level} · Zombie Level ${r.tier}`:'Unlock through progression';})();
                const lore=PVZ2_PLANT_LORE[key];
                card.innerHTML=`<div class="flex items-center gap-3"><div class="text-4xl">${info.emoji}</div><div class="min-w-0 flex-1"><div class="font-black text-slate-100">${info.name}</div><div class="text-[9px] font-black ${owned?'text-emerald-300':'text-amber-300'}">${status}</div></div></div><div class="guide-stat">☀️ Cost <b>${info.cost}</b> · ❤️ Health <b>${info.hp}</b></div>${GUIDE_PLANT[key]?`<div class="guide-description"><b>Normal attack:</b> ${GUIDE_PLANT[key][0]}</div><div class="text-[11px] text-sky-200"><b>Ability:</b> ${GUIDE_PLANT[key][1]}</div>`:''}<div class="text-[10px] text-sky-300">${unlockText}</div><button class="mt-1 rounded-lg px-3 py-2 text-xs font-black ${owned?'bg-emerald-700 hover:bg-emerald-600':'bg-slate-700 hover:bg-slate-600'}">${owned?'View plant profile':'View locked plant details'}</button>`;
                card.querySelector('button').onclick=()=>{closeGuideScreen();openPlantProfile(key);};
                grid.appendChild(card);
            });
        }
        function zombieGuideDescription(key,z) {
            const descriptions={
                basic:'The standard walker. It advances steadily and attacks plants by biting them.',
                cone:'A basic zombie protected by a traffic cone, giving it extra health.',
                bucket:'A heavily armored walker with a bucket helmet and high health.',
                football:'A fast, heavily protected football player zombie that reaches defenses quickly.',
                pyramid:'A slow zombie protected by a large pyramid-shaped helmet.',
                polevault:'Carries a pole and can vault over a plant when it first reaches an obstacle.',
                newspaper:'Carries a newspaper as extra protection; becomes more dangerous when its paper is gone.',
                disco:'A disco-themed zombie that advances with a tougher-than-basic body.',
                gargantuar:'A huge heavy hitter. It can throw an Imp into the lawn as it advances.',
                imp:'A tiny, fragile, very fast zombie. Often appears as a thrown or spawned minion.',
                impcannon:'A stationary-moving cannon unit that periodically launches Imp zombies ahead of itself.',
                barrelroller:'Rolls forward inside a protective barrel. When the barrel breaks, an Imp emerges.',
                gargantuarpirate:'A pirate Gargantuar with massive health and damage; it can throw an Imp.',
                jollyroger:'A pirate crew zombie with stronger durability than a basic walker.',
                camel:'A camel-riding zombie protected by a shield. The shield reduces incoming projectile damage until worn down.',
                explorer:'An explorer carrying a torch. A quicker specialist zombie with more health than a basic walker.',
                tombraiser:'An ancient tomb raiser that periodically creates a stationary tomb on the lawn.',
                tomb:'A stationary obstacle that periodically spawns basic or camel zombies until destroyed.',
                pharaoh:'A heavily armored ancient ruler zombie with high health and a powerful bite.',
                mummygargantuar:'A gigantic mummified brute with extreme health and damage that can throw an Imp.',
                chickenwrangler:'A wrangler who periodically releases two fast Zombie Chickens.',
                chicken:'A very fast, low-health chicken that rushes toward plants.',
                zombiebull:'A powerful bull zombie that periodically surges forward in a charge.',
                wildwestgargantuar:'A Wild West Gargantuar with enormous health and damage that can throw an Imp.',
                pianist:'A piano-playing zombie that periodically enrages nearby zombies, increasing their speed.',
                biologistmutant:'A lab-coat zombie that zaps a random zombie with a mutation beam every 8 seconds: +50% health, x2 damage, or +50% speed.',
                mendelmutant:'ELITE. Never advances and only one can exist at a time. Every 8 seconds it attracts and fuses groups of zombies with matching plant DNA traits.',
                darwinmutant:'ELITE (first appears at Stage 24). Remains on the far-right tile. Every 8 seconds it evolves two random zombies, giving each a second random plant characteristic with its own stats and attack. Evolved zombies have two plant heads and a bright white aura.',
                inertia:'Newton’s First Law runner. It accelerates as it travels across an open lane; when it reaches a plant, it delivers a momentum-powered slam before losing its built-up speed.',
                fma_zombie:'A massive, high-impact juggernaut. Its normal attack is a heavy bite against the plant directly ahead; its mass makes it difficult to push backward.',
                newton3_zombie:'A rocket-propelled attacker. It bites the plant in front of it, while its rear rocket thrust drives its special counterattack and can scorch plants ahead.',
                relativity_zombie:'Bites the plant in front of it and projects a time-dilation field around itself. Plants caught in the field work more slowly; defensive anchor formations can protect nearby plants.',
                photon_zombie:'A quick, fragile zombie that bites at close range, then flashes forward by two tiles every three seconds. Tall-nut can block its blink path; Spikeweed and Spikerock cannot.',
                tesla_zombie:'A coil-powered zombie that bites the plant ahead. Electric attacks charge its body; once charged, it releases an EMP that disables nearby plants.',
                schrodinger_zombie:'Bites the plant ahead while its quantum state remains uncertain. When defeated, it has a chance to disappear—or emerge again in an enraged, much faster and more dangerous state.',
                hawking_zombie:'ELITE gravitational support unit. It never walks or bites; instead, it creates a black hole that consumes nearby projectiles and drags other zombies forward toward its event horizon.',
                newton_elite:'ELITE backline controller. It stays in place and periodically drops a cosmic apple, creating a gravity slam that grounds lobbed shots and temporarily prevents zombies from being knocked back.',
                einstein_elite:'SUPREME FINAL BOSS (Stages 33–34). Einstein never advances toward the plants; every 10 seconds he shifts vertically to another lane. He has no bite attack. His three major powers control time, space, gravity and reinforcements.',
                pendulum:'A swinging attacker that bites the plant ahead. Its pendulum body alternates between a fast, powerful forward swing and a slower, more vulnerable backward swing.',
                skater_zombie:'A fast skater that bites plants at close range and keeps moving despite ice or sap slow effects. Knockback makes it skid dramatically back across the lane.',
                refractor_zombie:'Bites the plant ahead while its prism-like mirror redirects straight projectiles into a neighboring lane. Lobbed attacks can pass over its reflective shield.'
            };
            return descriptions[key]||'A hostile unit that advances toward the plants and attacks when it reaches them.';
        }
        function zombieGuideAbility(key,z) {
            const abilities={
                biologistmutant:'Mutation beam: random zombie gets +50% HP (green), x2 damage (red) or +50% speed (blue) every 8s.',mendelmutant:'Gene Fusion: attracts zombies with matching plant DNA traits and combines them into a stronger fused zombie.',darwinmutant:'Evolution: every 8 seconds, two random zombies gain a second random plant trait, its stats and attack, and a second plant head. The evolution beam is extremely powerful.',
                einstein_elite:'Three boss systems: (1) every 9 seconds, a blue Cherenkov wave hits two random lanes for 4 seconds, slowing plants there to 35% speed and compressing the lane so zombies warp 1.5 tiles forward; (2) every 14 seconds, or at 50% health, a 5-second singularity bends straight shots into its core and weakens lobbed shots by 50%; (3) periodically summons World 4 reinforcements. Grand Unification or explosive/melee attacks can break the singularity early.',
                polevault:'Vaults over its first plant obstacle.',gargantuar:'Throws an Imp minion while advancing.',impcannon:'Periodically fires an Imp onto the lawn.',barrelroller:'The barrel absorbs damage; breaking it reveals a fast Imp.',gargantuarpirate:'Can throw an Imp minion.',camel:'Its shield reduces projectile damage until depleted.',tombraiser:'Creates stationary tombs that spawn additional zombies.',tomb:'Spawns basic or camel zombies periodically.',chickenwrangler:'Releases two Zombie Chickens periodically.',zombiebull:'Performs a periodic high-speed charge.',wildwestgargantuar:'Can throw an Imp minion.',pianist:'Enrages nearby zombies, temporarily increasing their speed.',zomboss:'Cycles through a lane stomp, a targeted rocket strike, and a minion-summoning attack.'
            };
            if(abilities[key])return abilities[key];
            if(key==='newspaper')return 'No active special ability; its newspaper functions as extra protection.';
            if(key==='disco')return 'No separate active ability is implemented; its strength is its increased base durability.';
            if(key==='explorer')return 'No separate active ability is implemented in this version.';
            if(key==='pharaoh')return 'No separate active ability is implemented; its strength is its high health and bite damage.';
            if(key==='football'||key==='bucket'||key==='cone'||key==='pyramid')return 'Armor increases its durability; no separate active ability.';
            return 'None — uses its basic movement and attack.';
        }
        function renderZombieGuide() {
            const grid=document.getElementById('guide-zombies-grid'); if(!grid)return;
            grid.innerHTML='';
            const keys=Object.keys(ZOMBIE_TYPES);
            keys.forEach(key=>{
                const z=ZOMBIE_TYPES[key],name=ZOMBIE_DISPLAY_NAMES[key]||(key==='basic'?'Basic Zombie':key.charAt(0).toUpperCase()+key.slice(1)+' Zombie');
                const card=document.createElement('article');card.className='guide-card';
                card.innerHTML=`<div class="flex items-center gap-3"><div class="text-4xl">${z.emoji}</div><div class="min-w-0"><div class="font-black text-slate-100">${name}</div><div class="text-[9px] font-black text-rose-300">ZOMBIE</div></div></div><div class="grid grid-cols-3 gap-2"><div class="rounded-lg bg-slate-950/80 p-2"><div class="text-[9px] text-slate-500">HEALTH</div><div class="text-sm font-black text-rose-300">${z.hp}</div></div><div class="rounded-lg bg-slate-950/80 p-2"><div class="text-[9px] text-slate-500">ATTACK</div><div class="text-sm font-black text-orange-300">${z.damage}</div></div><div class="rounded-lg bg-slate-950/80 p-2"><div class="text-[9px] text-slate-500">SPEED</div><div class="text-sm font-black text-sky-300">${z.speed}</div></div></div><div class="guide-description">${zombieGuideDescription(key,z)}</div><div class="text-[11px] text-violet-200"><b>Normal attack:</b> ${ZG(key,z)[0]}<br><b>Ability:</b> ${ZG(key,z)[1]}</div>`;
                grid.appendChild(card);
            });
            const boss=document.createElement('article');boss.className='guide-card border border-rose-500/40';
            boss.innerHTML=`<div class="flex items-center gap-3"><div class="text-4xl">🤖</div><div><div class="font-black text-slate-100">Zomboss</div><div class="text-[9px] font-black text-rose-300">WORLD 1 BOSS · STAGE 11</div></div></div><div class="grid grid-cols-3 gap-2"><div class="rounded-lg bg-slate-950/80 p-2"><div class="text-[9px] text-slate-500">HEALTH</div><div class="text-sm font-black text-rose-300">18,000</div></div><div class="rounded-lg bg-slate-950/80 p-2"><div class="text-[9px] text-slate-500">ATTACK</div><div class="text-sm font-black text-orange-300">115 / 260</div></div><div class="rounded-lg bg-slate-950/80 p-2"><div class="text-[9px] text-slate-500">SPEED</div><div class="text-sm font-black text-sky-300">0</div></div></div><div class="guide-description">A giant mechanical boss that patrols vertically so it can threaten every lane.</div><div class="text-[11px] text-violet-200"><b>Normal attack:</b> None; it never bites and attacks only through its abilities.<br><b>Ability:</b> ${zombieGuideAbility('zomboss',{})} Stomp damage is 115 and rocket damage is 260 at Zombie Level 1; damage scales with Zombie Level.</div>`;
            grid.appendChild(boss);
        }

        function openPlantStore() {
            renderPlantStore();
            document.getElementById('plant-store-screen').classList.remove('hidden');
        }
        function closePlantStore() { document.getElementById('plant-store-screen').classList.add('hidden'); renderSelectionScreen(); }
        function buyStorePlant(key) {
            if (!STORE_PLANT_POOL.includes(key) || isPlantUnlocked(key)) return;
            const price=STORE_PLANT_PRICES[key]||30;
            if ((plantProgress.fertilizer||0)<price) { alert(`You need ${price} fertilizers to unlock ${PLANT_TYPES[key].name}.`); return; }
            plantProgress.fertilizer-=price;
            unlockPlant(key);
            renderPlantStore();
            renderSelectionScreen();
        }
        function renderPlantStore() {
            const grid=document.getElementById('plant-store-grid'); if(!grid)return;
            const balance=document.getElementById('store-fertilizer-count'); if(balance)balance.textContent=plantProgress.fertilizer||0;
            const stock=dailyStorePlants();
            const count=document.getElementById('store-stock-count');if(count)count.textContent=stock.length;
            const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
            const refresh=document.getElementById('store-refresh-label');if(refresh)refresh.textContent=`${tomorrow.toLocaleDateString(undefined,{month:'short',day:'numeric'})} (local time)`;
            grid.innerHTML='';
            if(!stock.length){grid.innerHTML='<div class="col-span-full rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 text-center text-emerald-200 font-bold">All of today’s featured plants are already unlocked. Come back tomorrow for new offers! 🎉</div>';}
            stock.forEach(key=>{
                const info=PLANT_TYPES[key],price=STORE_PLANT_PRICES[key]||30,canBuy=(plantProgress.fertilizer||0)>=price;
                const card=document.createElement('div');card.className='rounded-xl border border-amber-500/30 bg-slate-900 p-3 flex flex-col items-center text-center gap-2';
                card.innerHTML=`<div class="text-4xl">${info.emoji}</div><div class="font-black text-sm text-slate-100">${info.name}</div><div class="text-xs text-slate-400">${plantAbilityDescription(key,1).replace(/<[^>]*>/g,'').slice(0,105)}</div><div class="text-sm font-black text-amber-300">${price} 🧪</div><button class="w-full rounded-lg px-3 py-2 text-sm font-black ${canBuy?'bg-amber-600 hover:bg-amber-500 text-white':'bg-slate-700 text-slate-400 cursor-not-allowed'}" ${canBuy?'':'disabled'}>${canBuy?'Buy & Unlock':'Not enough fertilizer'}</button>`;
                card.querySelector('button').onclick=()=>buyStorePlant(key);
                grid.appendChild(card);
            });
            const rewards=document.getElementById('campaign-plant-unlocks');
            if(rewards){rewards.innerHTML='';CAMPAIGN_PLANT_REWARDS.forEach(r=>{const info=PLANT_TYPES[r.plant],done=isPlantUnlocked(r.plant),cleared=isTierCleared(r.level,r.tier);const item=document.createElement('div');item.className='flex items-center gap-3 rounded-lg border p-2 '+(done?'border-emerald-500/40 bg-emerald-950/20':'border-slate-700 bg-slate-900');item.innerHTML=`<div class="text-2xl w-9 text-center">${done?info.emoji:'🔒'}</div><div class="flex-1 min-w-0"><div class="text-xs font-black ${done?'text-emerald-300':'text-slate-200'}">${info.name}</div><div class="text-[10px] text-slate-400">Level ${r.level} · Zombie Level ${r.tier}</div></div><div class="text-[10px] font-black ${done?'text-emerald-300':'text-amber-300'}">${done?'UNLOCKED':cleared?'REWARD READY':'LOCKED'}</div>`;rewards.appendChild(item);});}
        }
        function awardCampaignPlant(level,tier) {
            const reward=CAMPAIGN_PLANT_REWARDS.find(r=>r.level===level&&r.tier===tier);
            if(!reward || isPlantUnlocked(reward.plant))return null;
            unlockPlant(reward.plant);
            return PLANT_TYPES[reward.plant].name;
        }

        const ADVENTURE_ART = [
            ['🌻','Sunny Lawn'],['🚧','Cone Attack'],['🏈','Vault & Sports'],['🪩','Disco Night'],
            ['🏺','Pyramid Assault'],['🪣','Heavy Armor'],['🏟️','Football Frenzy'],['🌌','Night Raiders'],
            ['👹','Gargantuar Rush'],['⚔️','Final Assault'],['🤖','Zomboss']
        ];
        const ADVENTURE_POSITIONS = [[12,82],[31,74],[52,82],[73,70],[88,57],[77,43],[57,49],[37,40],[17,29],[43,20],[78,12]];
        const WORLD_NOTICE_KEY = 'emojiPvZWorldUnlockNotices_v1';
        function worldUnlockNotices() {
            try { const a=JSON.parse(localStorage.getItem(WORLD_NOTICE_KEY)||'[1]'); return Array.isArray(a)?a.map(Number):[1]; }
            catch (_) { return [1]; }
        }
        function showWorldUnlockPopup(world) {
            const names={2:'Pirate Seas & Ancient Tombs',3:'DNA Mutation Labs',4:'Quantum & Classical Physics Lab'};
            const icons={2:'🏴‍☠️',3:'🧬',4:'⚛️'};
            let ov=document.getElementById('world-unlock-overlay');
            if(!ov){ov=document.createElement('div');ov.id='world-unlock-overlay';document.body.appendChild(ov);}
            ov.innerHTML=`<div class="wu-rays"></div><div class="wu-card"><div class="wu-icon">${icons[world]||'🌍'}</div><div class="wu-title">WORLD ${world} UNLOCKED!</div><div class="text-lg font-black text-white mt-1">${names[world]||'New Adventure'}</div><div class="wu-copy">Your progress has opened a whole new world. Its first game level and all seven Zombie Levels are now available!</div><button type="button" onclick="closeWorldUnlockPopup(${world})">Explore World ${world}</button></div>`;
            ov.style.display='flex';
        }
        function closeWorldUnlockPopup(world) {
            const ov=document.getElementById('world-unlock-overlay');if(ov)ov.style.display='none';
            currentMapWorld=world;
            try{closeModal();}catch(_){}
            openAdventureMap();
        }
        function checkWorldUnlockNotices(previousCount) {
            const now=unlockedWorldCount();
            const notices=worldUnlockNotices();
            for(let w=Math.max(2,previousCount+1);w<=now;w++){
                if(!notices.includes(w)){notices.push(w);showWorldUnlockPopup(w);break;}
            }
            try{localStorage.setItem(WORLD_NOTICE_KEY,JSON.stringify(notices));}catch(_){}
        }
        function openAdventureMap() {
            if(!isWorldUnlocked(currentMapWorld))currentMapWorld=1;
            renderAdventureMap();
            document.getElementById('adventure-map-screen').classList.remove('hidden');
        }
        function closeAdventureMap() {
            document.getElementById('adventure-map-screen').classList.add('hidden');
            closeTierPicker();
            if (mapThenPlantSelect) {
                mapThenPlantSelect = false;
                document.getElementById('selection-screen').classList.remove('hidden');
            }
        }

        // Clicking a stage opens the zombie-level (1-7) picker for that stage.
        function chooseAdventureLevel(level) {
            if (!isAdventureLevelUnlocked(level)) return;
            pendingStage = level;
            renderTierPicker();
            document.getElementById('tier-picker-screen').classList.remove('hidden');
        }
        function closeTierPicker() { document.getElementById('tier-picker-screen').classList.add('hidden'); }
        function levelStarTotal(level) { let n = 0; for (let t = 1; t <= TIER_COUNT; t++) n += starRecords[starKey(level, t)] || 0; return n; }
        function renderTierPicker() {
            const level = pendingStage;
            const title = document.getElementById('tier-picker-title');
            if (title) { const icon = level >= 27 ? FOURTH_WORLD_ART[level - 27][0] : (level >= 19 ? THIRD_WORLD_ART[level - 19][0] : (level >= 12 ? SECOND_WORLD_ART[level - 12][0] : ADVENTURE_ART[level - 1][0])); title.textContent = `${icon} Level ${level}: ${LEVELS[level].name}`; }
            const list = document.getElementById('tier-picker-list');
            if (!list) return;
            list.innerHTML = '';
            for (let t = 1; t <= TIER_COUNT; t++) {
                const cleared = isTierCleared(level, t);
                const selected = level === currentLevel && t === currentTier;
                const stageTierLocked = false; // Every zombie level opens with its game level.

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.disabled = stageTierLocked;
                btn.className = 'text-left rounded-xl border-2 p-3 transition-all ' +
                    (stageTierLocked ? 'opacity-45 cursor-not-allowed border-slate-700 bg-slate-950 ' : 'hover:scale-[1.02] ') +
                    (selected ? 'border-sky-400 bg-sky-900/30 ' : cleared ? 'border-emerald-500/70 bg-emerald-950/30 ' : 'border-amber-500/40 bg-slate-900 hover:border-amber-400 ');
                const tStars = starRecords[starKey(level, t)] || 0;
                const starRow = `<span class="tp-stars" title="${tStars}/3 stars">${[1, 2, 3].map(n => `<i class="${n <= tStars ? 'on' : 'off'}">★</i>`).join('')}</span>`;
                btn.innerHTML = `
                    <div class="flex items-center justify-between gap-2">
                        <span class="font-black ${cleared ? 'text-emerald-300' : stageTierLocked ? 'text-slate-500' : 'text-amber-300'}">${cleared ? '🏆' : stageTierLocked ? '🔒' : '⭐'} Zombie Level ${t}</span>
                        <span class="text-[11px] font-bold ${cleared ? 'text-slate-400' : 'text-amber-200'}">${cleared ? 'Reward claimed' : `First clear: +${TIER_REWARDS[t - 1]} 🧪`}</span>
                    </div>
                    <div class="flex items-center justify-between mt-1">${starRow}<span class="text-[10px] text-slate-400">${tStars === 3 ? 'All stars!' : 'Best run'}</span></div>
                    <div class="text-xs text-slate-300 mt-1">❤️ Zombie health ${formatMult(zombieHealthMult(t))} • ⚔️ Zombie attack ${formatMult(zombieAttackMult(t))}</div>
                    <div class="text-[10px] text-emerald-300 mt-1">Available</div>
                    ${selected ? '<div class="text-[11px] font-black text-sky-300 mt-1">📍 Currently selected</div>' : ''}
                `;
                btn.onclick = () => { if(!stageTierLocked) chooseTier(t); };
                list.appendChild(btn);
            }
        }
        function chooseTier(tier) {
            const goToPlantSelect = mapThenPlantSelect;
            mapThenPlantSelect = false;
            currentLevel = pendingStage;
            currentTier = clampTier(tier);
            const label = document.getElementById('selected-level-name');
            if (label) label.textContent = selectedLevelLabel();
            closeTierPicker();
            closeAdventureMap();
            renderSelectionScreen();
            if (goToPlantSelect) {
                document.getElementById('selection-screen').classList.add('hidden');
                document.getElementById('plant-select-screen').classList.remove('hidden');
                renderSelectionScreen();
                window.scrollTo(0, 0);
            }
        }
        function switchAdventureWorld(world) {
            const target = world === 4 ? 4 : (world === 3 ? 3 : (world === 2 ? 2 : 1));
            if (!isWorldUnlocked(target)) {
                missionToast(`🔒 ${['','', 'World 2','World 3','World 4'][target]} is locked. Clear ${worldUnlockRequirement(target)} different levels in World ${target - 1} first.`);
                return;
            }
            currentMapWorld = target;
            renderAdventureMap();
        }
        const SECOND_WORLD_ART = [
            ['🏴‍☠️','Pirate Seas'],['🛢️','Barrel Bay'],['⚱️','Ancient Tombs'],['👑','Mummy Kingdom'],
            ['🐔','Chicken Stampede'],['🤠','Wild West'],['🎹','Frontier Finale']
        ];
        const SECOND_WORLD_POSITIONS = [[12,78],[35,62],[63,76],[84,54],[68,32],[37,24],[14,10]];
        const THIRD_WORLD_ART = [['🧬','Mutation Meadow'],['🛡️','Armored Genome'],['🔥','Thermal Lab'],['❄️','Frostbite Lab'],['🌿','Overgrown Genome'],['⚡','Three-Lane Lab'],['☣️','Unstable DNA'],['🧪','Mutation Mastermind']];
        const THIRD_WORLD_POSITIONS = [[12,78],[35,62],[62,78],[85,58],[73,34],[43,24],[16,34],[17,10]];
        const FOURTH_WORLD_ART = [['🍎','Newton’s Laws'],['🪨','Force & Motion'],['🚀','Action–Reaction'],['🕰️','Relativity'],['🔦','Light & Optics'],['📦','Quantum Lab'],['🕳️','Singularity'],['⚛️','Unified Physics']];
        const FOURTH_WORLD_POSITIONS = [[12,78],[35,62],[63,78],[85,58],[73,32],[43,22],[16,36],[17,10]];
        function renderAdventureMap() {
            const holder=document.getElementById('adventure-map-nodes');
            if(!holder)return;
            const world2=currentMapWorld===2, world3=currentMapWorld===3, world4=currentMapWorld===4;
            const start=world4?27:(world3?19:(world2?12:1)), end=world4?34:(world3?26:(world2?18:11));
            holder.innerHTML='';
            const canvas=document.getElementById('adventure-map-canvas');
            if(canvas){canvas.classList.toggle('world-two-map',world2);canvas.classList.toggle('world-three-map',world3);canvas.classList.toggle('world-four-map',world4);}
            const subtitle=document.getElementById('adventure-world-subtitle');
            if(subtitle)subtitle.textContent=world4?'⚛️ WORLD 4 · QUANTUM & CLASSICAL PHYSICS LAB — force fields, relativity and quantum anomalies':(world3?'🧬 WORLD 3 · DNA MUTATIONS — zombies fused with mutated plant traits':(world2?'🏴‍☠️ WORLD 2 · PIRATE SHORES, ANCIENT TOMBS & WILD WEST — a separate adventure campaign':'🌻 WORLD 1 · SUNNY SUBURBS, TWILIGHT WOODS & ZOMBOSS FORTRESS'));
            const t1=document.getElementById('world1-tab'),t2=document.getElementById('world2-tab'),t3=document.getElementById('world3-tab'),t4=document.getElementById('world4-tab');
            if(t1){t1.className='px-3 py-2 rounded-lg font-bold text-xs '+(!world2&&!world3&&!world4?'bg-emerald-700':'bg-slate-700');t1.disabled=false;}
            if(t2){t2.className='px-3 py-2 rounded-lg font-bold text-xs '+(world2?'bg-amber-700':'bg-slate-700')+(!isWorldUnlocked(2)?' opacity-40 cursor-not-allowed':'');t2.disabled=!isWorldUnlocked(2);t2.textContent=(isWorldUnlocked(2)?'🏴‍☠️':'🔒')+' World 2';}
            if(t3){t3.className='px-3 py-2 rounded-lg font-bold text-xs '+(world3?'bg-violet-700':'bg-slate-700')+(!isWorldUnlocked(3)?' opacity-40 cursor-not-allowed':'');t3.disabled=!isWorldUnlocked(3);t3.textContent=(isWorldUnlocked(3)?'🧬':'🔒')+' World 3';}
            if(t4){t4.className='px-3 py-2 rounded-lg font-bold text-xs '+(world4?'bg-indigo-700':'bg-slate-700')+(!isWorldUnlocked(4)?' opacity-40 cursor-not-allowed':'');t4.disabled=!isWorldUnlocked(4);t4.textContent=(isWorldUnlocked(4)?'⚛️':'🔒')+' World 4';}
            for(let level=start;level<=end;level++){
                const unlocked=isAdventureLevelUnlocked(level), count=tiersClearedCount(level);
                const idx=world4?level-27:(world3?level-19:(world2?level-12:level-1));
                const [emoji,shortName]=world4?FOURTH_WORLD_ART[idx]:(world3?THIRD_WORLD_ART[idx]:(world2?SECOND_WORLD_ART[idx]:ADVENTURE_ART[idx]));
                const [x,y]=world4?FOURTH_WORLD_POSITIONS[idx]:(world3?THIRD_WORLD_POSITIONS[idx]:(world2?SECOND_WORLD_POSITIONS[idx]:ADVENTURE_POSITIONS[idx]));
                const node=document.createElement('button');
                node.type='button';node.className='adventure-node '+(count>0?'cleared':unlocked?'available':'locked');
                node.style.left=x+'%';node.style.top=y+'%';node.disabled=!unlocked;
                const reward=CAMPAIGN_PLANT_REWARDS.find(r=>r.level===level);
                const rewardInfo=reward?PLANT_TYPES[reward.plant]:null;
                node.innerHTML=`<span class="node-emoji">${emoji}</span><span class="node-title">${level}. ${shortName}</span><span class="node-status">${count>0?`🏆 ${count}/${TIER_COUNT}`:level===currentLevel?'📍 SELECTED':'⭐ PLAY'}</span><span class="node-stars ${levelStarTotal(level)>=TIER_COUNT*3?'node-stars-max':''}">★ ${levelStarTotal(level)}/${TIER_COUNT*3}</span>${reward?`<span class="node-reward">🎁 ${rewardInfo.name} · Z${reward.tier}</span>`:''}`;
                const world = worldForLevel(level);
                const gateHint = !isWorldUnlocked(world)
                    ? ` — Clear ${worldUnlockRequirement(world)} different levels in World ${world - 1} to unlock this world`
                    : (!unlocked && level > WORLD_RANGES[world][0] ? ` — Clear Level ${level - 1} at any Zombie Level to unlock` : '');
                node.title=`Level ${level}: ${LEVELS[level].name} — ${levelStarTotal(level)}/${TIER_COUNT*3} stars — ${count}/${TIER_COUNT} zombie levels cleared${gateHint}${reward?` — Reward: ${rewardInfo.name} at Zombie Level ${reward.tier}`:''}`;
                node.onclick=()=>chooseAdventureLevel(level);holder.appendChild(node);
            }
            const rewardPanel=document.getElementById('map-plant-rewards');
            if(rewardPanel){
                rewardPanel.innerHTML='';
                const mapRewards=CAMPAIGN_PLANT_REWARDS.filter(r=>r.level>=start&&r.level<=end);
                if(!mapRewards.length)rewardPanel.innerHTML='<div class="text-xs text-slate-400">No plant milestones are assigned to this map yet.</div>';
                mapRewards.forEach(r=>{
                    const info=PLANT_TYPES[r.plant],done=isPlantUnlocked(r.plant),cleared=isTierCleared(r.level,r.tier),item=document.createElement('div');
                    item.className='flex items-center gap-2 rounded-xl border p-2 '+(done?'border-emerald-500/40 bg-emerald-950/25':'border-slate-700 bg-slate-950/70');
                    item.innerHTML=`<div class="text-2xl w-9 text-center">${info.emoji}</div><div class="flex-1 min-w-0"><div class="text-xs font-black text-slate-100">${info.name}</div><div class="text-[10px] text-slate-400">Stage ${r.level} · Zombie Level ${r.tier}</div></div><div class="text-[9px] font-black ${done?'text-emerald-300':cleared?'text-amber-300':'text-slate-500'}">${done?'UNLOCKED':cleared?'READY':'LOCKED'}</div>`;
                    rewardPanel.appendChild(item);
                });
                if(world3){
                    const fusionTitle=document.createElement('div');fusionTitle.className='col-span-full text-xs font-black text-violet-200 pt-2';fusionTitle.textContent='⚡ GATLING PEA DNA COMBINATIONS';rewardPanel.appendChild(fusionTitle);
                    GATLING_FUSION_UNLOCKS.forEach(r=>{
                        const f=GATLING_FUSIONS[r.key],done=isGatlingFusionUnlocked(r.key),info=PLANT_TYPES[r.key];
                        const item=document.createElement('div');item.className='flex items-center gap-2 rounded-xl border p-2 '+(done?'border-violet-400/50 bg-violet-950/30':'border-slate-700 bg-slate-950/70');
                        item.innerHTML=`<div class="text-xl w-9 text-center">${done?'⚡':'🔒'}</div><div class="flex-1 min-w-0"><div class="text-xs font-black text-slate-100">${f.name}</div><div class="text-[10px] text-slate-400">${info.name} + Gatling Pea · Level ${r.level} / Zombie Lv ${r.tier}</div></div><div class="text-[9px] font-black ${done?'text-violet-200':'text-slate-500'}">${done?'UNLOCKED':'LOCKED'}</div>`;
                        rewardPanel.appendChild(item);
                    });
                }
            }
            const progress=document.getElementById('adventure-progress-label');
            if(progress){let n=0;for(let l=start;l<=end;l++)n+=tiersClearedCount(l);progress.textContent=`${n} / ${(end-start+1)*TIER_COUNT} zombie levels cleared`;}
            const label=document.getElementById('selected-level-name');if(label)label.textContent=selectedLevelLabel();
        }

        function renderInGameSeedsBar() {
            const seedsBar = document.getElementById('game-seeds-bar');
            if (!seedsBar) return;
            seedsBar.innerHTML = '';

            const shovelCard = document.createElement('div');
            shovelCard.id = 'seed-shovel';
            shovelCard.className = 'seed-card flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800 border-2 border-slate-700 hover:border-slate-500 cursor-pointer min-w-[60px] sm:min-w-[70px] select-none transition-all active:scale-95';
            shovelCard.onclick = () => selectSeed('shovel');
            shovelCard.innerHTML = `
                <span class="text-2xl">🧹</span>
                <span class="text-[10px] font-bold text-slate-300">Remove</span>
            `;
            seedsBar.appendChild(shovelCard);

            selectedDeck.forEach(plantKey => {
                const info = PLANT_TYPES[plantKey];
                if (!info) return;

                const card = document.createElement('div');
                card.id = `seed-${plantKey}`;
                card.className = 'seed-card flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800 border-2 border-slate-700 hover:border-amber-400 cursor-pointer min-w-[65px] sm:min-w-[75px] select-none transition-all active:scale-95 relative';
                card.onclick = () => selectSeed(plantKey);

                card.innerHTML = `
                    <span class="text-2xl">${info.emoji}</span>
                    <span class="text-[10px] font-bold text-slate-200">${info.name}</span>
                    <span class="text-xs font-black text-amber-400">☀️ ${info.cost}</span>
                    <span class="text-[9px] text-emerald-300">Lv.${selectedPlantLevel(plantKey)}</span>
                    <div id="cd-${plantKey}" class="absolute inset-0 bg-slate-950/80 rounded-xl flex items-center justify-center text-xs font-bold text-amber-400 hidden z-10"></div>
                `;
                card.className += mastCardCls(plantKey); card.insertAdjacentHTML('beforeend', mastPip(plantKey));
                seedsBar.appendChild(card);
            });
        }

        function openPlantSelect() {
            initAudio();
            // The home-screen Start Battle flow always asks the player to choose
            // a stage and Zombie Level before showing the plant deck.
            mapThenPlantSelect = true;
            document.getElementById('plant-select-screen').classList.add('hidden');
            document.getElementById('selection-screen').classList.add('hidden');
            switchAdventureWorld(currentLevel >= 27 ? 4 : (currentLevel >= 19 ? 3 : (currentLevel >= 12 ? 2 : 1)));
            openAdventureMap();
            window.scrollTo(0, 0);
        }
        function closePlantSelect() {
            document.getElementById('plant-select-screen').classList.add('hidden');
            document.getElementById('selection-screen').classList.remove('hidden');
            renderDailyMissions();
            renderSelectionScreen();
            window.scrollTo(0, 0);
        }

        function startBattleWithDeck() {
            initAudio();
            if (selectedDeck.length === 0) {
                playSound('hit');
                alert('Please select at least 1 plant for your battle deck!');
                return;
            }

            document.getElementById('selection-screen').classList.add('hidden');
            document.getElementById('plant-select-screen').classList.add('hidden');
            document.getElementById('playing-screen').classList.remove('hidden');
            document.body.dataset.world = String((LEVELS[currentLevel] || {}).map || 1);

            const levelConfig = LEVELS[currentLevel];
            document.getElementById('playing-level-name').textContent = `${currentLevel}: ${levelConfig.name} · Zombie Lv ${currentTier}`;

            renderInGameSeedsBar();
            resetGame();
            toggleGame();
        }

        function returnToHome() {
            if (isRunning) toggleGame();
            commitPendingRunXP();
            closeModal();
            selectedSeed = null;
            energyBeanActive = false;
            document.getElementById('playing-screen').classList.add('hidden');
            gameClockActive = false;
            delete document.body.dataset.world;
            document.getElementById('plant-select-screen').classList.add('hidden');
            document.getElementById('selection-screen').classList.remove('hidden');
            renderDailyMissions();
            const levelLabel=document.getElementById('selected-level-name');
            if(levelLabel)levelLabel.textContent=selectedLevelLabel();
            renderSelectionScreen();
        }

        function initLawnmowers() {
            mowers = [];
            for (let r = 0; r < ROWS; r++) {
                mowers.push({
                    id: r,
                    r: r,
                    x: -2,
                    active: false,
                    used: false
                });
            }
        }

        function initGrid() {
            if (!boardEl) return;
            boardEl.innerHTML = '';
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'lawn-cell border border-green-700/30 flex items-center justify-center relative cursor-pointer hover:brightness-110 transition-all';
                    cell.dataset.r = r;
                    cell.dataset.c = c;
                    cell.addEventListener('click', () => handleCellClick(r, c));
                    boardEl.appendChild(cell);
                }
            }
        }

        function selectSeed(seedType) {
            if (seedType !== 'shovel' && seedCooldowns[seedType] > Date.now()) {
                return;
            }

            energyBeanActive = false;
            updateEnergyBeanDisplay();

            selectedSeed = seedType;
            document.querySelectorAll('.seed-card').forEach(card => {
                card.classList.remove('border-amber-400', 'bg-slate-700');
            });

            const activeBtn = document.getElementById(`seed-${seedType}`);
            if (activeBtn) {
                activeBtn.classList.add('border-amber-400', 'bg-slate-700');
            }
        }

        function startSeedCooldown(seedType, cdMs) {
            if (!seedType || seedType === 'shovel') return;
            cdMs = cdMs * accCooldownMul();
            const expireTime = Date.now() + cdMs;
            seedCooldowns[seedType] = expireTime;

            const cdOverlay = document.getElementById(`cd-${seedType}`);
            if (!cdOverlay) return;

            cdOverlay.classList.remove('hidden');

            const interval = setInterval(() => {
                const remaining = Math.max(0, Math.ceil((expireTime - Date.now()) / 1000));
                if (remaining > 0) {
                    cdOverlay.textContent = `${remaining}s`;
                } else {
                    cdOverlay.textContent = '';
                    cdOverlay.classList.add('hidden');
                    clearInterval(interval);
                }
            }, 200);
        }

        function toggleEnergyBeanMode() {
            initAudio();
            if (energyBeans <= 0) {
                playSound('hit');
                return;
            }

            energyBeanActive = !energyBeanActive;
            selectedSeed = null;
            document.querySelectorAll('.seed-card').forEach(card => card.classList.remove('border-amber-400', 'bg-slate-700'));

            updateEnergyBeanDisplay();
        }

        function updateEnergyBeanDisplay() {
            if (beanCountEl) beanCountEl.textContent = `${energyBeans}/${MAX_ENERGY_BEANS}`;
            const btn = document.getElementById('energy-bean-btn');
            if (btn) {
                if (energyBeanActive) {
                    btn.className = 'flex items-center gap-1.5 bg-emerald-600 active:scale-95 px-3 py-1.5 rounded-lg border-2 border-emerald-300 ring-4 ring-emerald-400/50 transition-all cursor-pointer animate-bounce';
                } else {
                    btn.className = 'flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 px-3 py-1.5 rounded-lg border-2 border-emerald-500/50 transition-all cursor-pointer';
                }
            }
        }

        function handleCellClick(r, c) { MST.src = (selectedSeed && PLANT_TYPES[selectedSeed] && !energyBeanActive) ? selectedSeed : null; try { return _hcc(r, c); } finally { MST.src = null; } }
        function _hcc(r, c) {
            initAudio();
            if (!isRunning) return;

            const tilePlants = plants.filter(p => p.r === r && p.c === c);
            const existingPlantIndex = plants.findIndex(p => p.r === r && p.c === c && p.type !== 'tileturnip');

            // Using Energy Bean on a plant. A Power Tile shares one bean activation with
            // every plant standing on any Tile Turnip tile on the lawn.
            if (energyBeanActive) {
                if (tilePlants.length > 0 && energyBeans > 0) {
                    const plant = tilePlants.find(p => p.type !== 'tileturnip');
                    if (!plant) { playSound('hit'); return; }
                    if (plant.type === 'cactus' && plant.cactusAbilityUsed) {
                        playSound('hit');
                        return;
                    }
                    // PvZ2 has no Plant Food effect for these utility / instant-use plants.
                    // Keep the Energy Bean rather than inventing an unrelated special ability.
                    if (['gravebuster', 'tileturnip', 'powerlily', 'jalapeno', 'thymewarp'].includes(plant.type)) {
                        playSound('hit');
                        return;
                    }
                    const powerTileKeys = new Set(plants.filter(p => p.type === 'tileturnip').map(p => `${p.r},${p.c}`));
                    const targetIsPowered = powerTileKeys.has(`${plant.r},${plant.c}`);
                    if (targetIsPowered) {
                        const linkedPlants = plants.filter(p => p.type !== 'tileturnip' && powerTileKeys.has(`${p.r},${p.c}`));
                        linkedPlants.forEach(linked => {
                            if (!(linked.type === 'cactus' && linked.cactusAbilityUsed) &&
                                !['gravebuster','powerlily','jalapeno','thymewarp'].includes(linked.type)) {
                                triggerPlantSuperAbility(linked);
                            }
                        });
                    } else {
                        triggerPlantSuperAbility(plant);
                    }
                    energyBeans--;
                    missionBeanUsed(); MST.bean(plant.type);
                    energyBeanActive = false;
                    updateEnergyBeanDisplay();
                    renderGame();
                } else {
                    playSound('hit');
                }
                return;
            }

            if (selectedSeed === 'shovel') {
                if (existingPlantIndex !== -1) {
                    const removedPlant = plants[existingPlantIndex]; removedPlant._shoveled = true;
                    emitParticles(((removedPlant.c + 0.5) / COLS) * 100, ((removedPlant.r + 0.5) / ROWS) * 100, ['🍃', '💨', '✨'], 7);
                    plants.splice(existingPlantIndex, 1);
                    const refund = accShovelRefund();
                    if (refund > 0 && PLANT_TYPES[removedPlant.type]) {
                        const back = Math.floor(PLANT_TYPES[removedPlant.type].cost * refund);
                        if (back > 0) { sun += back; updateSunDisplay(); emitParticles(((removedPlant.c + 0.5) / COLS) * 100, ((removedPlant.r + 0.5) / ROWS) * 100, ['☀️', '💰'], 3); }
                    }
                    playSound('dig');
                    renderGame();
                }
                return;
            }

            // A Cannon normally fires when tapped, but a selected Tile Turnip must
            // be allowed to occupy the floor beneath it.
            const tappedCannon = tilePlants.find(p => p.type === 'coconutcannon');
            if (tappedCannon && selectedSeed !== 'shovel' && selectedSeed !== 'tileturnip') {
                fireCoconutCannon(tappedCannon);
                return;
            }

            if (!selectedSeed || !PLANT_TYPES[selectedSeed]) return;
            if (seedCooldowns[selectedSeed] > Date.now()) return;

            const plantInfo = PLANT_TYPES[selectedSeed];
            if (sun < plantInfo.cost) return;

            const sameTilePlants = plants.filter(p => p.r === r && p.c === c);
            const fuseTarget=sameTilePlants.find(p=>p.type==='gatlingpea'||GATLING_FUSION_KEYS.includes(p.type));
            if(fuseTarget){
                let base=null, mode=null;
                if(fuseTarget.type==='gatlingpea'){
                    if(fuseTarget.combinedWith){
                        // A combined Gatling only accepts MORE pea pods (max 5 => 5 firing directions).
                        if(fuseTarget.combinedWith==='peapod'&&selectedSeed==='peapod'){
                            if((fuseTarget.podCount||1)>=5){playSound('hit');return;}
                            sun-=plantInfo.cost;updateSunDisplay();
                            fuseTarget.podCount=Math.min(5,(fuseTarget.podCount||1)+1);
                            fuseTarget.level=Math.max(1,Math.min(fuseTarget.level||1,selectedPlantLevel('peapod')));
                            fuseTarget.shootingAnim=true;setTimeout(()=>fuseTarget.shootingAnim=false,500);
                            startSeedCooldown(selectedSeed,plantInfo.cd);playSound('plant');fusionFx(fuseTarget,'peapod',true);renderGame();return;
                        }
                        return;
                    }
                    if(GATLING_FUSIONS[selectedSeed]){base=selectedSeed;mode='seedIsPartner';}
                } else if(selectedSeed==='gatlingpea'&&GATLING_FUSIONS[fuseTarget.type]){
                    base=fuseTarget.type;mode='seedIsGatling';
                }
                if(base){
                    if(!isGatlingFusionUnlocked(base)){missionToast(`${GATLING_FUSIONS[base].name} is locked. ${gatlingFusionUnlockText(base)}.`);return;}
                    sun-=plantInfo.cost;updateSunDisplay();
                    const otherLevel=mode==='seedIsPartner'?selectedPlantLevel(selectedSeed):selectedPlantLevel('gatlingpea');
                    const level=Math.max(1,Math.min(fuseTarget.level||plantLevel(fuseTarget.type),otherLevel));
                    const hpRatio=(fuseTarget.maxHp>0?fuseTarget.hp/fuseTarget.maxHp:1);
                    fuseTarget.type='gatlingpea';fuseTarget.combinedWith=base;fuseTarget.comboName=GATLING_FUSIONS[base].name;fuseTarget.level=level;
                    if(base==='peapod')fuseTarget.podCount=Math.max(1,Math.min(5,fuseTarget.podCount||1));
                    fuseTarget.maxHp=PLANT_TYPES.gatlingpea.hp*3;fuseTarget.hp=Math.max(1,Math.round(fuseTarget.maxHp*hpRatio));
                    fuseTarget.lastActionTime=Date.now();
                    fuseTarget.shootingAnim=true;setTimeout(()=>fuseTarget.shootingAnim=false,500);
                    startSeedCooldown(selectedSeed,plantInfo.cd);playSound('plant');fusionFx(fuseTarget,base,false);renderGame();return;
                }
            }
            const existingPeaPod = sameTilePlants.find(p => p.type === 'peapod');
            const hasPowerTile = sameTilePlants.some(p => p.type === 'tileturnip');
            const onlyPowerTile = sameTilePlants.length > 0 && sameTilePlants.every(p => p.type === 'tileturnip');
            if (selectedSeed === 'peapod' && existingPeaPod) {
                if ((existingPeaPod.podCount || 1) >= 5) return;
                sun -= plantInfo.cost; updateSunDisplay();
                existingPeaPod.podCount = Math.min(5, (existingPeaPod.podCount || 1) + 1);
                existingPeaPod.lastActionTime = Date.now(); existingPeaPod.shootingAnim = true;
                setTimeout(()=>{existingPeaPod.shootingAnim=false;},450);
                startSeedCooldown(selectedSeed, plantInfo.cd); playSound('plant'); renderGame(); return;
            }
            if (sameTilePlants.length > 0) {
                const placingTileTurnip = selectedSeed === 'tileturnip' && !hasPowerTile;
                const plantingOnPowerTile = hasPowerTile && selectedSeed !== 'tileturnip';
                if (!placingTileTurnip && !plantingOnPowerTile && !onlyPowerTile) return;
                if (selectedSeed === 'tileturnip' && hasPowerTile) return;
            }

            sun -= plantInfo.cost;
            updateSunDisplay();
            playSound('plant');

            startSeedCooldown(selectedSeed, plantInfo.cd);

            const chosenPlantLevel = selectedPlantLevel(selectedSeed);
            const chosenPlantHp = levelHealth(selectedSeed, chosenPlantLevel);
            const newPlant = {
                id: Date.now() + Math.random(),
                r: r,
                c: c,
                type: selectedSeed,
                level: chosenPlantLevel,
                hp: chosenPlantHp,
                maxHp: chosenPlantHp,
                lastActionTime: Date.now(),
                armed: (selectedSeed === 'potatomine' || selectedSeed === 'primalpotatomine') ? false : true,
                armTime: Date.now() + 5000,
                shootingAnim: false,
                isNew: true,
                podCount: selectedSeed === 'peapod' ? 1 : undefined
            };

            plants.push(newPlant);
            missionPlantPlaced(selectedSeed); MST.onPlant(selectedSeed);
            setTimeout(() => { newPlant.isNew = false; }, 400);

            if (selectedSeed === 'cherrybomb') {
                triggerCherryBomb(newPlant);
            } else if (selectedSeed === 'blover') {
                triggerBlover(newPlant);
            } else if (selectedSeed === 'iceberglettuce') {
                zombies.filter(z=>Math.abs(z.r-r)<=1&&Math.abs(z.x-((c+0.5)/COLS)*100)<38).forEach(z=>{applyFreeze(z,Date.now(),3000);z.hp-=50;});plants=plants.filter(p=>p.id!==newPlant.id);
            } else if (selectedSeed === 'jalapeno') {
                playAbilityActionAnimation(newPlant); const jalapenoDamage=900*levelAttackMultiplier('jalapeno',chosenPlantLevel); zombies.filter(z=>z.r===r).forEach(z=>{z.hp-=jalapenoDamage;z.hitFlash=true;emitSpecialParticles(z.x,((z.r+0.5)/ROWS)*100,['🔥','🌶️','💥'],4);});plants=plants.filter(p=>p.id!==newPlant.id);
            } else if (selectedSeed === 'powerlily') {
                energyBeans=Math.min(MAX_ENERGY_BEANS,energyBeans+1);updateEnergyBeanDisplay();plants=plants.filter(p=>p.id!==newPlant.id);
            } else if (selectedSeed === 'gravebuster') {
                const tomb=zombies.find(z=>z.type==='tomb'&&z.r===r&&Math.abs(z.x-((c+0.5)/COLS)*100)<22);if(tomb){tomb.hp=0;newPlant.lastActionTime=Date.now();}
            } else if (NEWP[selectedSeed] && NEWP[selectedSeed].onPlant) {
                NEWP[selectedSeed].onPlant(newPlant);
            }

            selectedSeed = null;
            document.querySelectorAll('.seed-card').forEach(card => card.classList.remove('border-amber-400', 'bg-slate-700'));

            renderGame();
        }

        function triggerCherryBomb(plant) {
            const blastX = ((plant.c + 0.5) / COLS) * 100;
            const blastY = ((plant.r + 0.5) / ROWS) * 100;
            emitSpecialParticles(blastX, blastY, ['🍒', '💥', '🔥', '⭐'], 7);
            addVisualEffect({ x: blastX, y: blastY, emoji: '💥', duration: 950, size: 'text-5xl sm:text-6xl', className: 'special-attack-effect' });
            playSound('boom');
            
            const boomEl = document.createElement('div');
            boomEl.className = 'absolute text-6xl boom-effect pointer-events-none z-40 flex items-center justify-center';
            boomEl.style.left = `${(plant.c / COLS) * 100 - 5}%`;
            boomEl.style.top = `${(plant.r / ROWS) * 100 - 5}%`;
            boomEl.textContent = '💥 CHERRY BOOM!';
            if (gameLayerEl) gameLayerEl.appendChild(boomEl);
            setTimeout(() => boomEl.remove(), 600);

            // Deal 500 damage to all zombies in a 3x3 area around the Cherry Bomb
            zombies.forEach(z => {
                const zCol = Math.floor((z.x / 100) * COLS);
                if (Math.abs(z.r - plant.r) <= 1 && Math.abs(zCol - plant.c) <= 1) {
                    z.hp -= 500 * levelAbilityMultiplier(plant.level || 1, plant.type);
                    z.hitFlash = true;
                    emitSpecialParticles(z.x + 2, ((z.r + 0.5) / ROWS) * 100, ['💥', '🍒', '✨'], 5);
                }
            });

            // Remove Cherry Bomb plant after explosion
            setTimeout(() => {
                plants = plants.filter(p => p.id !== plant.id);
                renderGame();
            }, 300);
        }

        function triggerBlover(plant) {
            const abilityScale = levelAbilityMultiplier(plant.level || 1, plant.type);
            emitParticles(50, 50, ['💨', '🍃', '✨'], 24);
            playSound('whoosh');

            const windEl = document.createElement('div');
            windEl.className = 'absolute inset-0 bg-cyan-400/20 pointer-events-none z-40 flex items-center justify-center text-4xl font-extrabold text-cyan-200 animate-pulse';
            windEl.textContent = '💨💨💨 BLOW AWAY!';
            if (gameLayerEl) gameLayerEl.appendChild(windEl);
            setTimeout(() => windEl.remove(), 700);

            // Push all zombies back towards the right side of the lawn
            zombies.forEach(z => {
                z.x = Math.min(100, z.x + 35 * abilityScale);
                z.hitFlash = true;
                emitParticles(z.x, ((z.r + 0.5) / ROWS) * 100, ['💨', '🍃', '✨'], 6);
            });

            // Remove Blover plant after blowing wind
            setTimeout(() => {
                plants = plants.filter(p => p.id !== plant.id);
                renderGame();
            }, 300);
        }

        function applyBurn(zombie, now = Date.now(), level = 1) {
            zombie.burnDamage = Math.max(zombie.burnDamage || 0, levelBurnDamage(level));
            zombie.burnUntil = Math.max(zombie.burnUntil || 0, now + levelBurnDuration(level));
            zombie.nextBurnTick = Math.min(zombie.nextBurnTick || now, now);
            zombie.statusEmoji = '🔥';
            zombie.statusExpiresAt = zombie.burnUntil;
        }

        function applyFreeze(zombie, now = Date.now(), duration = 3000) {
            zombie.frozenUntil = Math.max(zombie.frozenUntil || 0, now + duration);
            zombie.statusEmoji = '🧊';
            zombie.statusExpiresAt = zombie.frozenUntil;
        }

        function applySlow(zombie, now = Date.now(), duration = 2500, factor = 0.5) {
            const baseSpeed = zombie.baseSpeed ?? ZOMBIE_TYPES[zombie.type]?.speed ?? zombie.speed;
            zombie.baseSpeed = baseSpeed;
            if(zombie.skater){zombie.slowedUntil=0;zombie.slowFactor=1;zombie.speed=zombie.baseSpeed||zombie.speed;return;}
            zombie.slowedUntil = Math.max(zombie.slowedUntil || 0, now + duration);
            zombie.slowFactor = Math.min(zombie.slowFactor || 1, factor);
            zombie.speed = Math.max(0.025, baseSpeed * zombie.slowFactor);
        }


        // Each Plant Food action gets a short, character-specific emoji animation.
        // These are visual action beats (wind-up -> attack -> impact / reward), not stacked character sprites.


        // ---------------------------------------------------------------------------------
        // Pooled, compositor-only ability FX. Nodes are recycled (never created per frame), animated
        // with transform/opacity only (Web Animations), capped in number, and paused with the game.
        // ---------------------------------------------------------------------------------
        const FX_MAX = 48;
        let fxActive = 0;
        const fxFree = [];
        function fxTake() {
            if (fxActive >= FX_MAX || !gameLayerEl) return null;
            fxActive++;
            return fxFree.pop() || Object.assign(document.createElement('div'), { className: 'fxs' });
        }
        function fxGive(el) {
            try { if (el.getAnimations) el.getAnimations().forEach(an => { an.onfinish = an.oncancel = null; an.cancel(); }); } catch (_) {}
            el.remove(); el.style.cssText = ''; el.className = 'fxs'; fxActive--;
            if (fxFree.length < 40) fxFree.push(el);
        }
        // x/y are percentages of the lawn. opts: duration, delay, size(px), arc(% of height), spin(deg)
        function fxSprite(emoji, x1, y1, x2, y2, o = {}) {
            const el = fxTake(); if (!el) return;
            const W = layerW, H = layerH, size = o.size || 42, h = size / 2;
            const pos = (x, y) => `translate(${(x * W / 100 - h).toFixed(1)}px,${(y * H / 100 - h).toFixed(1)}px)`;
            el.textContent = emoji; el.style.fontSize = size + 'px'; el.style.opacity = '0'; if (o.cls) el.classList.add(o.cls);
            const f = [{ transform: `${pos(x1, y1)} scale(.45) rotate(-18deg)`, opacity: 0, offset: 0 }];
            const N = o.arc ? 8 : 1;
            for (let i = 0; i <= N; i++) {
                const s = i / N, e = o.arc ? s : 1 - Math.pow(1 - s, 2);
                const x = x1 + (x2 - x1) * e, y = y1 + (y2 - y1) * e - (o.arc ? o.arc * 4 * s * (1 - s) : 0);
                f.push({ transform: `${pos(x, y)} scale(${i === 0 ? 1.15 : 1}) rotate(${o.spin ? (s * o.spin).toFixed(0) : 0}deg)`, opacity: 1, offset: .15 + .67 * s });
            }
            f.push({ transform: `${pos(x2, y2)} scale(1.45) rotate(${o.spin ? o.spin : 18}deg)`, opacity: 0, offset: 1 });
            gameLayerEl.appendChild(el);
            const a = el.animate(f, { duration: o.duration || 720, delay: o.delay || 0, easing: 'linear', fill: 'both' });
            a.onfinish = a.oncancel = () => fxGive(el);
        }
        // ---- extra ability / fusion visuals (pooled, transform+opacity only) ----
        const PLANT_FX_COLORS = { sunflower:'#facc15', twinsunflower:'#facc15', sunshroom:'#facc15', peashooter:'#4ade80', gatlingpea:'#4ade80', peapod:'#4ade80', primalpeashooter:'#a3e635', snowpea:'#38bdf8', snowdragon:'#38bdf8', iceberglettuce:'#7dd3fc', wintermelon:'#7dd3fc', firepea:'#fb923c', firedragon:'#f97316', jalapeno:'#f97316', cherrybomb:'#ef4444', bonkchoy:'#ef4444', rotobaga:'#a855f7', blover:'#c084fc', lightningreed:'#fde047', citron:'#fde047', cactus:'#22c55e', coconutcannon:'#f59e0b', wallnut:'#d97706', tallnut:'#d97706', melonpult:'#4ade80', garlic:'#c084fc', celery:'#86efac' };
        function fxColor(type) { return PLANT_FX_COLORS[type] || '#fde68a'; }
        function fxRing(x, y, color, size = 110, o = {}) {
            const el = fxTake(); if (!el) return;
            const W = layerW, H = layerH, h = size / 2;
            el.className = 'fxs fx-ring'; el.style.setProperty('--rc', color);
            el.style.width = size + 'px'; el.style.height = size + 'px';
            const pos = `translate(${(x * W / 100 - h).toFixed(1)}px,${(y * H / 100 - h).toFixed(1)}px)`;
            gameLayerEl.appendChild(el);
            const a = el.animate([{ transform: pos + ' scale(.15)', opacity: .95 }, { transform: pos + ' scale(' + (o.grow || 2.4) + ')', opacity: 0 }], { duration: o.duration || 620, delay: o.delay || 0, easing: 'ease-out', fill: 'both' });
            a.onfinish = a.oncancel = () => fxGive(el);
        }
        function fxPillar(x, y, color, o = {}) {
            const el = fxTake(); if (!el) return;
            const W = layerW, H = layerH, w = o.w || 46, hh = o.h || H / ROWS * 2.2;
            el.className = 'fxs fx-pillar'; el.style.setProperty('--rc', color); el.style.width = w + 'px'; el.style.height = hh + 'px';
            const pos = (sy) => `translate(${(x * W / 100 - w / 2).toFixed(1)}px,${(y * H / 100 - hh + H / ROWS * .35).toFixed(1)}px) scaleY(${sy})`;
            gameLayerEl.appendChild(el); el.style.transformOrigin = '50% 100%';
            const a = el.animate([{ transform: pos(.05), opacity: 0 }, { transform: pos(1), opacity: .85, offset: .3 }, { transform: pos(1.1), opacity: 0 }], { duration: o.duration || 700, easing: 'ease-out', fill: 'both' });
            a.onfinish = a.oncancel = () => fxGive(el);
        }
        function fxLawnFlash(color, peak = .28, duration = 520, x = 50, y = 50) {
            const el = fxTake(); if (!el) return;
            el.className = 'fxs fx-flash'; el.style.setProperty('--rc', color); el.style.setProperty('--fx', x + '%'); el.style.setProperty('--fy', y + '%');
            el.style.width = layerW + 'px'; el.style.height = layerH + 'px'; el.style.transform = 'translate(0,0)';
            gameLayerEl.appendChild(el);
            const a = el.animate([{ opacity: 0 }, { opacity: peak, offset: .25 }, { opacity: 0 }], { duration, easing: 'ease-out', fill: 'both' });
            a.onfinish = a.oncancel = () => fxGive(el);
        }
        function fxLabel(text, x, y, color = '#fff', size = 22) {
            const el = fxTake(); if (!el) return;
            el.className = 'fxs fx-label'; el.textContent = text; el.style.fontSize = size + 'px'; el.style.color = color;
            const W = layerW, H = layerH;
            const pos = (dy) => `translate(${(x * W / 100).toFixed(1)}px,${(y * H / 100 + dy).toFixed(1)}px) translateX(-50%)`;
            gameLayerEl.appendChild(el);
            const a = el.animate([{ transform: pos(6) + ' scale(.6)', opacity: 0 }, { transform: pos(-8) + ' scale(1.15)', opacity: 1, offset: .25 }, { transform: pos(-34) + ' scale(1)', opacity: 0 }], { duration: 1100, easing: 'ease-out', fill: 'both' });
            a.onfinish = a.oncancel = () => fxGive(el);
        }
        // Every plant ability: shockwave rings, a light pillar and a tinted flash across the lawn.
        function abilityBurstFx(plant) {
            const x = ((plant.c + .5) / COLS) * 100, y = ((plant.r + .5) / ROWS) * 100, col = fxColor(plant.type === 'gatlingpea' && plant.combinedWith ? plant.combinedWith : plant.type);
            fxRing(x, y, col, 120); fxRing(x, y, '#ffffff', 90, { delay: 120, grow: 2.8 });
            fxPillar(x, y, col); fxLawnFlash(col, .22, 560, x, y);
            fxLabel('⚡ ABILITY', x, y - 12, col, 18);
        }
        // Gatling Pea DNA fusion: partner + gatling fly together, DNA helix spins, ring burst + name label.
        function fusionFx(plant, base, addedPod) {
            const x = ((plant.c + .5) / COLS) * 100, y = ((plant.r + .5) / ROWS) * 100;
            const partner = (PLANT_TYPES[base] && PLANT_TYPES[base].emoji) || '🌱', col = fxColor(base);
            fxSprite(PLANT_TYPES.gatlingpea.emoji, x - 14, y - 6, x, y, { size: 46, duration: 520 });
            fxSprite(addedPod ? '🫛' : partner, x + 14, y - 6, x, y, { size: 46, duration: 520 });
            fxSprite('🧬', x, y - 4, x, y - 16, { size: 54, duration: 900, spin: 360, delay: 380 });
            fxRing(x, y, col, 110, { delay: 480 }); fxRing(x, y, '#ffffff', 80, { delay: 600, grow: 3 });
            fxPillar(x, y, col, { duration: 800 }); fxLawnFlash(col, .2, 600, x, y);
            fxLabel(addedPod ? '🫛 +1 POD · ' + podDirCount(plant) + ' DIRECTIONS' : '🧬 ' + (plant.comboName || 'FUSION') + '!', x, y - 14, col, 20);
            emitSpecialParticles(x, y, ['✨', '🧬', '💫', '⭐'], 7);
            playSound('super');
        }
        function setFxPaused(paused) {
            if (!gameLayerEl || !gameLayerEl.getAnimations) return;
            gameLayerEl.getAnimations({ subtree: true }).forEach(a => {
                if (paused && a.playState === 'running') a.pause();
                else if (!paused && a.playState === 'paused') a.play();
            });
        }

        // Pooled chain-lightning bolt: one SVG (no filters) with a glow stroke and a bright core stroke.
        const boltFree = []; let boltActive = 0;
        function makeBolt() {
            const ns = 'http://www.w3.org/2000/svg';
            const el = document.createElementNS(ns, 'svg'); el.setAttribute('class', 'fxb'); el.setAttribute('preserveAspectRatio', 'none');
            const mk = (stroke, w, op) => { const p = document.createElementNS(ns, 'path'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', stroke); p.setAttribute('stroke-width', w); p.setAttribute('stroke-opacity', op); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); return p; };
            const glow = mk('#38bdf8', 7, .5), core = mk('#fef9c3', 2.4, 1);
            el.append(glow, core);
            return { el, glow, core };
        }
        function showLightningChain(fromX, fromY, toX, toY, duration = 360) {
            if (!gameLayerEl || boltActive >= 14) return;
            boltActive++;
            const b = boltFree.pop() || makeBolt();
            const W = layerW, H = layerH;
            const x1 = fromX * W / 100, y1 = fromY * H / 100, x2 = toX * W / 100, y2 = toY * H / 100;
            const dx = x2 - x1, dy = y2 - y1, len = Math.max(1, Math.hypot(dx, dy));
            const nx = -dy / len, ny = dx / len, segs = Math.max(3, Math.min(14, Math.ceil(len / 34)));
            let d = `M${x1.toFixed(1)} ${y1.toFixed(1)}`;
            for (let i = 1; i <= segs; i++) {
                const t = i / segs, j = i === segs ? 0 : (i % 2 ? 7 : -7);
                d += `L${(x1 + dx * t + nx * j).toFixed(1)} ${(y1 + dy * t + ny * j).toFixed(1)}`;
            }
            b.el.setAttribute('viewBox', `0 0 ${W} ${H}`);
            b.glow.setAttribute('d', d); b.core.setAttribute('d', d);
            gameLayerEl.appendChild(b.el);
            const a = b.el.animate([{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .6 }, { opacity: 0 }], { duration, easing: 'ease-out' });
            a.onfinish = a.oncancel = () => { b.el.remove(); boltActive--; if (boltFree.length < 20) boltFree.push(b); };
        }

        // Lightning Reed's only attack: a chain that covers its own lane and both neighbouring lanes,
        // across the whole width of the lawn. Damage is instant; only the first few hops draw a bolt.
        function zapLightningReedTargets(plant, damageMultiplier = 1, stunMs = 260) {
            const originX = ((plant.c + 0.5) / COLS) * 100;
            const originY = ((plant.r + 0.5) / ROWS) * 100;
            const pool = zombies.filter(z => z.hp > 0 && Math.abs(z.r - plant.r) <= 1 && z.x > -8 && z.x < 106);
            if (!pool.length) return 0;
            const damage = 48 * levelAttackMultiplier('lightningreed', plant.level || 1) * damageMultiplier;
            // Chain: always jump to the nearest zombie not yet struck.
            const chain = [];
            let cx = originX, cy = originY;
            while (pool.length) {
                let bi = 0, bd = Infinity;
                for (let i = 0; i < pool.length; i++) {
                    const z = pool[i], d = Math.hypot(z.x - cx, ((z.r - plant.r) * 20) * 1.6);
                    if (d < bd) { bd = d; bi = i; }
                }
                const z = pool.splice(bi, 1)[0];
                chain.push(z); cx = z.x; cy = ((z.r + 0.5) / ROWS) * 100;
            }
            let px = originX, py = originY;
            const now = Date.now();
            chain.forEach((z, index) => {
                const zx = z.x + 2, zy = ((z.r + 0.5) / ROWS) * 100;
                z.hp -= damage * (index === 0 ? 1 : 0.82);
                z.stunnedUntil = now + stunMs;
                z.hitFlash = true;
                if (index < 8) {
                    const fx = px, fy = py;
                    setTimeout(() => {
                        showLightningChain(fx, fy, zx, zy, 340);
                        if (index < 4) addVisualEffect({ x: zx, y: zy, emoji: '⚡', duration: 400, size: 'text-3xl sm:text-4xl', className: 'special-attack-effect' });
                    }, index * 70);
                }
                px = zx; py = zy;
            });
            plant.shootingAnim = true;
            setTimeout(() => { plant.shootingAnim = false; }, 450);
            playSound('zap');
            return chain.length;
        }

        // Arced toss for Cabbage / Corn / Melon / Winter Melon: the shell flies in a parabola and lands
        // where the target is expected to be. Plant has a toss animation; the shot leaves at its release frame.
        function launchLob(p, type, speed) {
            const now = Date.now();
            const startX = ((p.c + 0.5) / COLS) * 100;
            const target = zombies.filter(z => z.r === p.r && z.hp > 0 && z.x > (p.c / COLS) * 100).sort((a, b) => a.x - b.x)[0];
            let landX = target ? target.x + 2 : Math.min(96, startX + 28);
            let ticks = Math.max(14, Math.round(Math.max(6, landX - startX) / speed));
            if (target && !target.eating && target.speed) {
                landX = Math.max(startX + 5, landX - target.speed * (ticks + 4));
                ticks = Math.max(14, Math.round((landX - startX) / speed));
            }
            const distCells = (landX - startX) / 100 * COLS;
            projectiles.push({
                id: now + Math.random(), r: p.r, ownerType: p.type, ownerLevel: p.level || 1, type,
                x: startX, px: startX, startX, targetX: landX, lob: true, t: 0, pt: 0, dt: 1 / ticks,
                h: Math.min(230, 45 + distCells * 38), delay: 4,
                ownerBoost: (p.tileBoostUntil || 0) > now ? (p.tileBoost || 1) : 1, hitZombies: []
            });
            p.lastActionTime = now; p.shootingAnim = true;
            setTimeout(() => { p.shootingAnim = false; }, 520);
            playSound(type === 'coconut' ? 'cannonshot' : 'lob');
        }

        function fireCoconutCannon(p) { const _o = MST.src; MST.src = 'coconutcannon'; try { return _fcc(p); } finally { MST.src = _o; } }
        function _fcc(p) {
            const now = Date.now();
            if ((p.restUntil || 0) > now) { playSound('hit'); return false; }
            p.restUntil = now + COCONUT_REST_MS;
            p.lastActionTime = now;
            const cx = ((p.c + 0.5) / COLS) * 100, cy = ((p.r + 0.5) / ROWS) * 100;
            projectiles.push({
                id: now + Math.random(), r: p.r, ownerType: 'coconutcannon', ownerLevel: p.level || 1,
                x: ((p.c / COLS) * 100) - 2, px: ((p.c / COLS) * 100) - 2, speed: 1.7 * Math.pow(2, Math.max(0, Math.min(4, (p.level || 1) - 1))), type: 'coconut',
                ownerBoost: (p.tileBoostUntil || 0) > now ? (p.tileBoost || 1) : 1, hitZombies: []
            });
            p.shootingAnim = true;
            setTimeout(() => { p.shootingAnim = false; }, 450);
            addVisualEffect({ x: cx + 6, y: cy, emoji: '💥', duration: 320, size: 'text-3xl', className: 'special-attack-effect' });
            playSound('cannonshot');
            return true;
        }

        // Large, moving action actors: these are visible animated objects, not particle bursts.
        function playAbilityActionAnimation(plant) {
            if (!plant || !gameLayerEl) return;
            const cellX = c => ((c + 0.5) / COLS) * 100;
            const cellY = r => ((r + 0.5) / ROWS) * 100;
            const originX = cellX(plant.c), originY = cellY(plant.r);
            const living = zombies.filter(z => z.hp > 0);
            const actor = (emoji, x1, y1, x2, y2, opts = {}) => fxSprite(emoji, x1, y1, x2, y2, opts);
            const impact = (emoji, x, y, delay = 0, size = 46) => setTimeout(() => {
                actor(emoji, x, y, x, y, { duration: 420, size });
            }, delay);
            const targets = living.slice().sort((a,b) => a.x - b.x);
            const laneTargets = living.filter(z => z.r === plant.r);
            const allRows = Array.from({length: ROWS}, (_,i)=>i);

            switch (plant.type) {
                case 'melonpult':
                case 'wintermelon': {
                    const fruit = plant.type === 'wintermelon' ? '🍈' : '🍉';
                    const hit = plant.type === 'wintermelon' ? '🧊' : '💥';
                    (targets.length ? targets.slice(0,8) : [{x:92,r:plant.r}]).forEach((z,i) => {
                        actor(fruit, originX, originY-5, z.x, cellY(z.r)-3, {duration:850+i*35,size:54,arc:30,spin:360});
                        impact(hit, z.x, cellY(z.r), 720+i*35, 48);
                        if (plant.type === 'wintermelon') impact('❄️', z.x, cellY(z.r)-5, 800+i*35, 36);
                    });
                    break;
                }
                case 'jalapeno': {
                    // A large flame front visibly sweeps the entire row before the blast.
                    actor('🌶️', originX, originY, Math.min(97,originX+8), originY, {duration:520,size:58});
                    setTimeout(() => actor('🔥', 3, originY, 96, originY, {duration:850,size:62}), 220);
                    setTimeout(() => {
                        actor('🌋', 50, originY, 50, originY, {duration:650,size:78});
                        impact('💥', 94, originY, 0, 60);
                    }, 900);
                    break;
                }
                case 'powerlily': {
                    // The flower opens, then visibly creates and launches the Plant Food bean.
                    actor('🪷', originX, originY+7, originX, originY-2, {duration:650,size:64});
                    setTimeout(() => actor('🫘', originX, originY-3, 93, 8, {duration:1050,size:52}), 520);
                    setTimeout(() => impact('✨', 93, 8, 0, 54), 1540);
                    break;
                }
                case 'coconutcannon':
                    actor('🥥', originX, originY, laneTargets[0]?.x ?? 92, cellY(laneTargets[0]?.r ?? plant.r), {duration:780,size:56});
                    impact('💥', laneTargets[0]?.x ?? 92, cellY(laneTargets[0]?.r ?? plant.r), 720, 58);
                    break;
                case 'citron':
                    actor('🔵', originX, originY, laneTargets[0]?.x ?? 92, cellY(laneTargets[0]?.r ?? plant.r), {duration:900,size:62});
                    impact('💥', laneTargets[0]?.x ?? 92, cellY(laneTargets[0]?.r ?? plant.r), 820, 64);
                    break;
                case 'lightningreed':
                    actor('🌩️', 8, 8, 90, 8, {duration:950,size:56});
                    targets.slice(0,8).forEach((z,i)=>setTimeout(()=>actor('⚡',z.x,8,z.x,cellY(z.r),{duration:420,size:48}),180+i*95));
                    break;
                case 'iceberglettuce':
                    actor('❄️', 50, 4, 50, 92, {duration:760,size:90});
                    targets.slice(0,10).forEach((z,i)=>impact('🧊',z.x,cellY(z.r),250+i*45,42));
                    break;
                case 'firedragon':
                    actor('🐉', originX, originY, 92, originY, {duration:900,size:68});
                    allRows.filter(r=>Math.abs(r-plant.r)<=1).forEach((r,i)=>setTimeout(()=>actor('🔥',5,cellY(r),96,cellY(r),{duration:780,size:50}),i*140));
                    break;
                case 'snowdragon':
                    actor('🐉', originX, originY, 92, originY, {duration:900,size:68});
                    allRows.filter(r=>Math.abs(r-plant.r)<=1).forEach((r,i)=>setTimeout(()=>actor('❄️',5,cellY(r),96,cellY(r),{duration:780,size:50}),i*140));
                    break;
                case 'sunflower':
                case 'twinsunflower':
                    for(let i=0;i<(plant.type==='twinsunflower'?4:3);i++) {
                        setTimeout(()=>actor('☀️',originX,originY,originX+(i-1)*8,Math.max(7,originY-30-i*3),{duration:900,size:46}),i*170);
                    }
                    break;
                case 'sunshroom':
                    actor('🍄',originX,originY+8,originX,originY-5,{duration:780,size:66});
                    setTimeout(()=>actor('☀️',originX,originY-5,originX+12,Math.max(5,originY-28),{duration:850,size:48}),500);
                    break;
                case 'potatomine':
                    for(let i=0;i<3;i++)setTimeout(()=>actor('🥔',originX,originY,12+i*35,cellY((plant.r+i+1)%ROWS),{duration:650,size:44}),i*220);
                    break;
                case 'peapod':
                case 'primalpeashooter':
                    for(let i=0;i<5;i++)setTimeout(()=>actor(plant.type==='peapod'?'🟢':'🪨',originX,originY,94,originY,{duration:620+i*30,size:40}),i*110);
                    break;
                case 'cactus':
                    actor('🪴',originX,originY,originX,originY-3,{duration:450,size:60});
                    targets.slice(0,8).forEach((z,i)=>setTimeout(()=>actor('⚡',originX,originY,z.x,cellY(z.r),{duration:480,size:46}),i*100));
                    break;
                case 'spikerock':
                case 'spikeweed':
                    actor('🌵',originX,originY,96,originY,{duration:850,size:58});
                    laneTargets.slice(0,8).forEach((z,i)=>impact('💢',z.x,cellY(z.r),250+i*75,46));
                    break;
                case 'tallnut':
                case 'wallnut':
                    actor('🛡️',originX,originY,originX,originY-4,{duration:750,size:76});
                    break;
                case 'blover':
                    actor('🌪️',originX,originY,94,originY,{duration:950,size:74});
                    break;
                case 'rotobaga':
                    for(let i=0;i<8;i++)setTimeout(()=>actor('🍠',originX,originY,90,cellY((plant.r+(i%2?1:-1)+ROWS)%ROWS),{duration:700,size:42}),i*75);
                    break;
                case 'celery':
                    actor('🥬',originX,originY,originX,originY-8,{duration:650,size:58});
                    break;
                default:
                    actor((PLANT_TYPES[plant.type]||{}).emoji || '✨',originX,originY,originX,originY-12,{duration:650,size:58});
            }
        }

        function playPlantFoodEmojiAnimation(plant) {
            const frames = {
                sunflower:['🌻','☀️','✨'], peashooter:['🌱','🟢','💥'], snowpea:['❄️','🧊','💠'],
                firepea:['🔥','🟠','💥'], wallnut:['🌰','🛡️','✨'], cherrybomb:['🍒','💥','🔥'],
                potatomine:['🥔','💣','💥'], bonkchoy:['🥊','💨','💥'], gatlingpea:['🔫','🟢','💥'],
                spikeweed:['🌵','🪨','💢'], cabbagetosser:['🥬','🥬','💥'], corntosser:['🌽','🧈','💥'],
                garlic:['🧄','💜','✨'], firedragon:['🐉','🔥','💥'], snowdragon:['🐉','❄️','🧊'],
                cactus:['🪴','⚡','✨'], blover:['🍀','💨','🌪️'],
                iceberglettuce:['🧿','❄️','🧊'], gravebuster:['🪦','🌱','✨'],
                twinsunflower:['🌼','☀️','💛'], coconutcannon:['🥥','💨','💥'],
                spikerock:['🪨','🌵','💢'], peapod:['🫛','🌱','🟢','💥'],
                melonpult:['🍉','💨','💥'], tallnut:['🥜','🛡️','✨'],
                wintermelon:['🍈','❄️','💥'], lightningreed:['🌾','⚡','🌩️'],
                rotobaga:['🍠','🌀','💥'], citron:['🍊','🔵','💥'],
                tileturnip:['🟪','✨','🌱'], sunshroom:['🍄','🌱','☀️'],
                celery:['🥒','💨','🥊','🌱'], primalpeashooter:['🦖','🪨','💥'],
                powerlily:['🪷','🫘','✨'], jalapeno:['🌶️','🔥','💥']
            };
            const sequence = frames[plant.type] || ['✨','💥'];
            const x = ((plant.c + 0.5) / COLS) * 100;
            const y = ((plant.r + 0.5) / ROWS) * 100;
            sequence.forEach((emoji, i) => {
                setTimeout(() => {
                    addVisualEffect({
                        x: Math.min(98, Math.max(2, x + i * 2.2)),
                        y: Math.min(96, Math.max(4, y - (i % 2) * 3)),
                        emoji, duration: 720, size: 'text-3xl sm:text-4xl',
                        className: 'special-attack-effect'
                    });
                }, i * 135);
            });
        }

        function triggerPlantSuperAbility(plant) { const _o = MST.src; MST.src = plant.type; try { return _tpsa(plant); } finally { MST.src = _o; } }
        function _tpsa(plant) {
            abilityBurstFx(plant);
            playAbilityActionAnimation(plant);
            playPlantFoodEmojiAnimation(plant);
            const abilityScale = levelAbilityMultiplier(plant.level || 1, plant.type);
            if (NEWP[plant.type]) { npFood(plant, abilityScale); playSound('super'); plant.superGlow = true; setTimeout(() => { plant.superGlow = false; }, 700); return; }
            const abilityParticles = {
                sunflower: ['☀️', '✨', '🌻', '💛'], peashooter: ['🟢', '💥', '✨'],
                snowpea: ['❄️', '🧊', '💠', '✨'], firepea: ['🔥', '🟠', '💥', '✨'],
                cactus: ['🌵', '💢', '✨'], gatlingpea: ['🟢', '💥', '⭐'],
                wallnut: ['🛡️', '🌰', '✨'], garlic: ['🧄', '💜', '✨'],
                cherrybomb: ['🍒', '💥', '🔥', '⭐'], potatomine: ['🥔', '💥', '✨'],
                bonkchoy: ['🥊', '💥', '⭐'], firedragon: ['🔥', '🟠', '💥', '✨'],
                snowdragon: ['❄️', '🧊', '💠', '✨'], cabbagetosser: ['🥬', '💥', '✨'],
                corntosser: ['🌽', '🧈', '💥'], spikeweed: ['🌵', '💢', '⭐'],
                blover: ['💨', '🍃', '🌪️', '✨'], iceberglettuce:['❄️','🧊','💠'], gravebuster:['🪦','✨','🌱'], twinsunflower:['☀️','🌻','💛'], coconutcannon:['🥥','💥','🌴'], spikerock:['🪨','🌵','💢'], peapod:['🫛','🟢','💥'], melonpult:['🍉','💥','✨'], tallnut:['🛡️','🥜','✨'], wintermelon:['🍈','❄️','💥'], lightningreed:['⚡','🌩️','✨'], rotobaga:['🥔','🪽','💥'], citron:['🍊','💥','☀️'], tileturnip:['🟪','✨','🌱'], sunshroom:['🍄','☀️','✨'], celery:['🥬','💥','🌿'], primalpeashooter:['🦖','🟢','💥'], powerlily:['🪷','🫘','✨'], jalapeno:['🌶️','🔥','💥']
            };
            const abilitySymbols = abilityParticles[plant.type] || ['⚡', '✨', '🌟', '💫'];
            const abilityX = ((plant.c + 0.5) / COLS) * 100;
            const abilityY = ((plant.r + 0.5) / ROWS) * 100;
            emitSpecialParticles(abilityX, abilityY, abilitySymbols, 7);
            playSound('super'); setTimeout(() => playSound(superSoundFor(plant.type)), 120);
            plant.superGlow = true;
            setTimeout(() => { plant.superGlow = false; }, 700);

            const projTypeMap = {
                peashooter: 'normal',
                snowpea: 'ice',
                firepea: 'fire',
                gatlingpea: 'normal'
            };

            if(plant.type==='gatlingpea'&&plant.combinedWith&&GATLING_FUSIONS[plant.combinedWith]){
                fireFusionVolley(plant,true);
            } else if (projTypeMap[plant.type]) {
                const count = Math.round((plant.type === 'gatlingpea' ? 16 : 10) * abilityScale);
                const pType = projTypeMap[plant.type];
                const t0 = Date.now();
                for (let i = 0; i < count; i++) {
                    projectiles.push({
                        id: t0 + Math.random(),
                        ownerType: plant.type, ownerLevel: plant.level || 1,
                        r: plant.r, x: ((plant.c + 0.5) / COLS) * 100, speed: 1.1, type: pType,
                        startAt: t0 + i * 70,
                        snd: i % 2 === 0 ? (plant.type === 'snowpea' ? 'iceshot' : (plant.type === 'firepea' ? 'fireshot' : 'shoot')) : null
                    });
                }
            } else if (plant.type === 'sunflower') {
                emitSpecialParticles(abilityX, abilityY, ['☀️', '💛', '✨'], 9);
                sun += Math.round(300 * 0.9 * abilityScale);
                updateSunDisplay();
                emitSpecialParticles(abilityX, abilityY, ['☀️', '💛', '✨', '🌟'], 14);
            } else if (plant.type === 'wallnut' || plant.type === 'garlic') {
                plant.hp = plant.maxHp; // Fully heal
                emitSpecialParticles(abilityX, abilityY, plant.type === 'wallnut' ? ['🛡️', '🌰', '✨'] : ['🧄', '💜', '✨'], 9);
            } else if (plant.type === 'cherrybomb') {
                triggerCherryBomb(plant);
            } else if (plant.type === 'potatomine') {
                // Plant three fully armed Potato Mines on randomly selected empty tiles.
                const emptyTiles = [];
                for (let r = 0; r < ROWS; r++) {
                    for (let c = 0; c < COLS; c++) {
                        if (!plants.some(existing => existing.r === r && existing.c === c)) emptyTiles.push({ r, c });
                    }
                }
                for (let i = 0; i < Math.min(3 + Math.floor((plant.level || 1) - 1), emptyTiles.length); i++) {
                    const pick = Math.floor(Math.random() * emptyTiles.length);
                    const tile = emptyTiles.splice(pick, 1)[0];
                    plants.push({
                        id: Date.now() + Math.random(), r: tile.r, c: tile.c,
                        type: 'potatomine', level: plant.level || 1, hp: levelHealth('potatomine', plant.level || 1),
                        maxHp: levelHealth('potatomine', plant.level || 1), lastActionTime: Date.now(),
                        armed: true, armTime: Date.now(), shootingAnim: false, isNew: false
                    });
                    emitSpecialParticles(((tile.c + 0.5) / COLS) * 100, ((tile.r + 0.5) / ROWS) * 100, ['🥔', '💥', '✨'], 5);
                }
                renderGame();
            } else if (plant.type === 'firedragon') {
                // Fire Dragon's super attack sweeps all three adjacent lanes.
                zombies.forEach(z => {
                    if (Math.abs(z.r - plant.r) <= 1) {
                        z.hp -= (450 / 7) * abilityScale;
                        applyBurn(z, Date.now(), plant.level || 1);
                        z.hitFlash = true;
                        emitSpecialParticles(z.x + 2, ((z.r + 0.5) / ROWS) * 100, ['🔥', '💥', '✨'], 6);
                    }
                });
            } else if (plant.type === 'snowdragon') {
                zombies.forEach(z => {
                    if (Math.abs(z.r - plant.r) <= 1) {
                        z.hp -= (300 / 7) * abilityScale;
                        applyFreeze(z, Date.now(), levelFreezeDuration(plant.level || 1));
                        z.hitFlash = true;
                        emitSpecialParticles(z.x + 2, ((z.r + 0.5) / ROWS) * 100, ['❄️', '🧊', '💠'], 6);
                    }
                });
            } else if (plant.type === 'bonkchoy' || plant.type === 'cabbagetosser' || plant.type === 'corntosser') {
                // PvZ2-style plant-food barrage: butter/corn volleys rain across every lane.
                const targets = zombies.slice();
                targets.forEach((z, index) => {
                    for (let shot = 0; shot < Math.max(2, Math.round(2 * abilityScale)); shot++) {
                        setTimeout(() => {
                            projectiles.push({
                                id: Date.now() + Math.random(), ownerType: plant.type, ownerLevel: plant.level || 1, r: z.r,
                                x: ((plant.c + 0.5) / COLS) * 100,
                                startX: ((plant.c + 0.5) / COLS) * 100,
                                targetX: z.x, speed: 0.9,
                                type: shot === 0 ? 'butter' : 'corn', progress: 0
                            });
                        }, index * 45 + shot * 35);
                    }
                });
                emitSpecialParticles(abilityX, abilityY, ['🌽', '🧈', '💥', '⭐'], 12);
            } else if (plant.type === 'cactus') {
                // One-time ability permanently transforms this cactus into its electro form.
                plant.cactusAbilityUsed = true;
                plant.electroState = true;
                // Lightning jumps from zombie to zombie, dealing diminishing shock damage.
                const chainTargets = zombies.filter(z => z.hp > 0).sort((a, b) => a.x - b.x).slice(0, Math.min(10, 6 + (plant.level || 1)));
                chainTargets.forEach((z, index) => {
                    z.hp -= (index === 0 ? 140 : 85) * abilityScale;
                    z.hitFlash = true;
                    z.statusEmoji = '⚡';
                    z.statusExpiresAt = Date.now() + 850;
                    emitSpecialParticles(z.x + 2, ((z.r + 0.5) / ROWS) * 100, ['⚡', '💛', '✨'], 6);
                    if (index > 0) {
                        const previous = chainTargets[index - 1];
                        addVisualEffect({ x: (previous.x + z.x) / 2, y: ((previous.r + z.r + 1) / 2 / ROWS) * 100, emoji: '⚡', duration: 500, size: 'text-3xl sm:text-4xl', className: 'special-attack-effect' });
                    }
                });
            } else if (plant.type === 'spikeweed') {
                zombies.forEach(z => {
                    if (z.r === plant.r) {
                        z.hp -= 200 * abilityScale;
                        z.hitFlash = true;
                        emitSpecialParticles(z.x + 2, ((z.r + 0.5) / ROWS) * 100, ['🌵', '💢', '⭐'], 5);
                    }
                });
            } else if (plant.type === 'blover') {
                triggerBlover(plant);
            } else if (plant.type === 'iceberglettuce') {
                // Plant Food: freeze every zombie on the lawn. Its normal contact-freeze trait is unchanged.
                zombies.filter(z=>!z.flying&&!z.isFlying).forEach(z=>{applyFreeze(z,Date.now(),10000*levelDurationMultiplier(plant.level||1));z.hitFlash=true;});
                emitSpecialParticles(abilityX,abilityY,['❄️','🧊','✨'],14);
            } else if (plant.type === 'jalapeno' || plant.type === 'gravebuster' || plant.type === 'tileturnip' || plant.type === 'powerlily') {
                // These are instant-use / utility plants with no Plant Food effect in PvZ2.
                emitSpecialParticles(abilityX,abilityY,['✨'],3);
            } else if (plant.type === 'twinsunflower') {
                const bonus=Math.round(250*1.15*abilityScale*sunFoodBonus(plant.level));sun+=bonus;updateSunDisplay();emitSpecialParticles(abilityX,abilityY,['☀️','✨'],12);
            } else if (plant.type === 'sunshroom') {
                plant.growthStage=3;plant.grown=true;const bonus=Math.round(225*abilityScale);sun+=bonus;updateSunDisplay();emitSpecialParticles(abilityX,abilityY,['☀️','🍄','✨'],12);
            } else if (plant.type === 'tallnut' || plant.type === 'wallnut' || plant.type === 'garlic') {
                plant.hp=plant.maxHp;plants.filter(p=>p.r===plant.r&&p.c===plant.c).forEach(p=>p.hp=p.maxHp);
                if(plant.type==='tallnut'){plant.armorHp=Math.max(plant.armorHp||0,320*abilityScale);}
            } else if (plant.type === 'coconutcannon') {
                zombies.filter(z=>z.r===plant.r&&z.hp>0&&z.x>((plant.c/COLS)*100-10)&&z.x<=112).forEach(z=>{z.hp-=520*abilityScale;z.x=Math.max(z.x,Math.min(100,z.x+Math.max(8,18*abilityScale)));z.hitFlash=true;});
                emitSpecialParticles(abilityX+25,abilityY,['🥥','💥'],14);
            } else if (plant.type === 'citron') {
                const target=zombies.filter(z=>z.hp>0&&z.r===plant.r&&z.x>abilityX).sort((a,b)=>a.x-b.x)[0];
                if(target){
                    const impactX=target.x;
                    target.hp-=1100*abilityScale;target.hitFlash=true;
                    target.x=Math.min(98,target.x+Math.max(7,14*abilityScale));
                    zombies.filter(z=>z.id!==target.id&&Math.abs(z.x-impactX)<12&&Math.abs(z.r-target.r)<=1)
                        .forEach((z,index)=>{z.hp-=300*abilityScale;z.hitFlash=true;z.x=Math.min(98,z.x+5+index*1.5);});
                    emitSpecialParticles(impactX,((target.r+0.5)/ROWS)*100,['🔵','💥','✨'],7);
                }
                emitSpecialParticles(abilityX+25,abilityY,['🔵','💥','✨'],14);
            } else if (plant.type === 'spikerock') {
                zombies.filter(z=>z.r===plant.r).forEach(z=>{z.hp-=120*abilityScale;z.x=Math.max(plant.c/COLS*100+2,z.x-7);z.hitFlash=true;});
                emitSpecialParticles(abilityX,abilityY,['🌵','💢'],10);
            } else if (plant.type === 'peapod') {
                for(let n=0;n<5;n++)projectiles.push({id:Date.now()+Math.random(),r:plant.r,ownerType:plant.type,ownerLevel:plant.level||1,x:abilityX+n*0.25,speed:1.35,type:'giantpea'});
            } else if (plant.type === 'primalpeashooter') {
                for(let n=0;n<5;n++)projectiles.push({id:Date.now()+Math.random(),r:plant.r,ownerType:plant.type,ownerLevel:plant.level||1,x:abilityX+n*0.25,speed:1.25,type:'primal'});
            } else if (plant.type === 'melonpult' || plant.type === 'wintermelon') {
                zombies.forEach(z=>{if(plant.type==='wintermelon')applySlow(z,Date.now(),3500*levelDurationMultiplier(plant.level||1),0.45);z.hp-=(plant.type==='wintermelon'?80:95)*abilityScale;z.hitFlash=true;});
                emitSpecialParticles(abilityX+20,abilityY,['🍉','💥'],12);
            } else if (plant.type === 'lightningreed') {
                // Plant Food overload: repeated visible chain zaps through its three routes.
                const pulses = Math.max(3, Math.round(4 * abilityScale));
                for (let pulse = 0; pulse < pulses; pulse++) {
                    setTimeout(() => {
                        const hitCount = zapLightningReedTargets(plant, 1.35, 420);
                        if (!hitCount) {
                            addVisualEffect({x:abilityX,y:abilityY,emoji:'⚡',duration:420,size:'text-4xl',className:'special-attack-effect'});
                        }
                    }, pulse * 420);
                }
                emitSpecialParticles(abilityX,abilityY,['⚡','🌩️'],8);
            } else if (plant.type === 'rotobaga') {
                zombies.forEach(z=>{if(Math.abs(z.r-plant.r)>=1){z.hp-=38*abilityScale*2;z.hitFlash=true;}});
                const burstCount=Math.max(8,Math.round(8*abilityScale));
                for(let n=0;n<burstCount;n++){
                    const laneOffset=(n%4<2?-1:1);
                    projectiles.push({id:Date.now()+Math.random(),r:Math.max(0,Math.min(ROWS-1,plant.r+laneOffset)),ownerType:plant.type,ownerLevel:plant.level||1,x:abilityX,speed:1.15,type:'rotobaga'});
                }
                emitSpecialParticles(abilityX,abilityY,['🥔','✨'],10);
            } else if (plant.type === 'celery') {
                plant.hp=plant.maxHp;
                const empty=[];for(let rr=0;rr<ROWS;rr++)for(let cc=0;cc<COLS;cc++)if(!plants.some(q=>q.r===rr&&q.c===cc)&&!(rr===plant.r&&cc===plant.c))empty.push({r:rr,c:cc});
                for(let n=0;n<3&&empty.length;n++){const spot=empty.splice(Math.floor(Math.random()*empty.length),1)[0];plants.push({id:Date.now()+Math.random(),type:'celery',r:spot.r,c:spot.c,level:plant.level||1,hp:levelHealth('celery',plant.level||1),maxHp:levelHealth('celery',plant.level||1),lastActionTime:Date.now(),isNew:true});emitSpecialParticles(((spot.c+0.5)/COLS)*100,((spot.r+0.5)/ROWS)*100,['🥒','🌱','✨'],4);}
                emitSpecialParticles(abilityX,abilityY,['🥬','✨'],10);
            }
        }

        function collectSun(sunId, event) {
            initAudio();
            if (event) {
                event.stopPropagation();
                if (event.cancelable) event.preventDefault();
            }
            const index = suns.findIndex(s => s.id === sunId);
            if (index !== -1) {
                const targetSun = suns[index];
                sun += targetSun.val; missionAdd('sun', targetSun.val);
                updateSunDisplay();
                playSound('sun');
                emitParticles(targetSun.x, targetSun.y, ['☀️', '✨', '💛'], 3);

                const popup = document.createElement('div');
                popup.className = 'absolute text-amber-300 font-extrabold text-sm sm:text-base pointer-events-none z-50 transition-all duration-500';
                popup.style.left = `${targetSun.x}%`;
                popup.style.top = `${targetSun.y}%`;
                popup.textContent = `+${targetSun.val}☀️`;
                if (gameLayerEl) gameLayerEl.appendChild(popup);

                requestAnimationFrame(() => {
                    popup.style.transform = 'translateY(-25px)';
                    popup.style.opacity = '0';
                });
                setTimeout(() => popup.remove(), 500);

                suns.splice(index, 1);
                renderGame();
            }
        }

        function collectEnergyBean(beanId, event) {
            initAudio();
            if (event) {
                event.stopPropagation();
                if (event.cancelable) event.preventDefault();
            }
            const index = energyBeanDrops.findIndex(b => b.id === beanId);
            if (index !== -1) {
                const targetBean = energyBeanDrops[index];
                if (energyBeans < MAX_ENERGY_BEANS) {
                    energyBeans++;
                    updateEnergyBeanDisplay();
                    playSound('bean');

                    const popup = document.createElement('div');
                    popup.className = 'absolute text-emerald-300 font-extrabold text-sm sm:text-base pointer-events-none z-50 transition-all duration-500';
                    popup.style.left = `${targetBean.x}%`;
                    popup.style.top = `${targetBean.y}%`;
                    popup.textContent = '+1🫘';
                    if (gameLayerEl) gameLayerEl.appendChild(popup);

                    requestAnimationFrame(() => {
                        popup.style.transform = 'translateY(-25px)';
                        popup.style.opacity = '0';
                    });
                    setTimeout(() => popup.remove(), 500);
                } else {
                    playSound('hit');
                }

                energyBeanDrops.splice(index, 1);
                renderGame();
            }
        }

        function updateSunDisplay() {
            if (sunCountEl) sunCountEl.textContent = sun;
        }

        function spawnSkySun() {
            const randomCol = Math.floor(Math.random() * COLS);
            const randomRow = Math.floor(Math.random() * (ROWS - 1));
            suns.push({
                id: Date.now() + Math.random(),
                x: (randomCol / COLS) * 100 + 2,
                y: (randomRow / ROWS) * 100 + 2,
                val: 25,
                created: Date.now(),
                expiresAt: Date.now() + 10000
            });
        }

        // v69: Twin / Primal Sunflower: normal output -30%; their Plant Food gives a level-based sun bonus (L1 +100%, L2 +70%, L3 +50%, L4 +20%, L5+ +5%).
        function sunFoodBonus(level) { return ({ 1: 2, 2: 1.7, 3: 1.5, 4: 1.2 })[Math.max(1, Math.floor(level || 1))] || 1.05; }
        const HEAVY_ZOMBIES = ['gargantuar','gargantuarpirate','mummygargantuar','wildwestgargantuar','fma_zombie','hawking_zombie'];
        const RUNNER_ZOMBIES = ['football','polevault','imp','chicken','zombiebull','barrelroller','explorer'];
        const SPIKEROCK_TARGET_ZOMBIES = ['gargantuar','gargantuarpirate','mummygargantuar','wildwestgargantuar','bucket','pyramid','football','barrelroller','impcannon','zombiebull'];
        // ---- v66: telegraphed abilities for every special zombie of Worlds 1 and 2 ----
        // Every ability first paints a hazard zone over the exact area it will hit, then fires ~0.5-1s later.
        function fxWarn(x0, y0, x1, y1, ms, icon, color, shape) {
            if (!gameLayerEl) return;
            const el = fxTake(); if (!el) return;
            const W = layerW, H = layerH, cl = v => Math.max(0, Math.min(100, v));
            x0 = cl(x0); x1 = cl(x1); y0 = cl(y0); y1 = cl(y1);
            if (el.getAnimations) el.getAnimations().forEach(an => { an.onfinish = an.oncancel = null; an.cancel(); });
            el.className = 'fxs fx-warn' + (shape ? ' sh-' + shape : ''); el.style.setProperty('--wc', color || '#ef4444');
            let bw = Math.max(10, (x1 - x0) * W / 100), bh = Math.max(10, (y1 - y0) * H / 100), bx = x0 * W / 100, by = y0 * H / 100;
            if (shape === 'ring') { const d = Math.max(bw * 0.95, bh * 0.95, 56), cxp = bx + bw / 2, cyp = by + bh / 2; bw = bh = d; bx = cxp - d / 2; by = cyp - d / 2; }
            el.style.width = bw + 'px'; el.style.height = bh + 'px';
            el.style.transform = `translate(${bx.toFixed(1)}px,${by.toFixed(1)}px)`;
            el.innerHTML = shape === 'lane' ? `<i>${'◀ '.repeat(26)}</i>${icon ? `<b>${icon}</b>` : ''}` : (icon ? `<b>${icon}</b>` : '');
            gameLayerEl.appendChild(el);
            const a = el.animate ? el.animate([{ opacity: .15 }, { opacity: .95, offset: .2 }, { opacity: .45, offset: .45 }, { opacity: .95, offset: .7 }, { opacity: .6 }], { duration: ms, easing: 'ease-in-out', fill: 'forwards' }) : null;
            if (a) { a.onfinish = a.oncancel = () => fxGive(el); } else setTimeout(() => fxGive(el), ms);
        }
        function wzRect(z, xA, xB, r0, r1) { return { x0: Math.min(xA, xB), x1: Math.max(xA, xB), r0: Math.max(0, r0), r1: Math.min(ROWS - 1, r1) }; }
        function wzShow(a, ms, icon, color, shape) { fxWarn(a.x0, a.r0 * 20, a.x1, (a.r1 + 1) * 20, ms, icon, color, shape); }
        function wzTileX(p) { return ((p.c + 0.5) / COLS) * 100; }
        function wzIn(a) { return plants.filter(p => p.hp > 0 && p.r >= a.r0 && p.r <= a.r1 && wzTileX(p) >= a.x0 - 1 && wzTileX(p) <= a.x1 + 1); }
        function wzHit(p, dmg, stunMs) {
            p.hp -= dmg; p.hitFlash = true;
            if (stunMs) { p.attackSlowedUntil = Date.now() + stunMs; p.attackSlowFactor = 0.05; try { wzStunFx(p, stunMs); } catch (_) {} }
        }
        function wzCell(p) { const hw = 100 / COLS / 2; return { x0: wzTileX(p) - hw, x1: wzTileX(p) + hw, r0: p.r, r1: p.r }; }
        function wzNearest(z, cols, rowSpan) {
            const reach = cols * (100 / COLS);
            return plants.filter(p => p.hp > 0 && Math.abs(p.r - z.r) <= rowSpan && wzTileX(p) <= z.x + 3 && z.x - wzTileX(p) <= reach).sort((a, b) => b.c - a.c);
        }
        function wzBurst(a, syms, n, ringColor) {
            const cx = (a.x0 + a.x1) / 2, cy = ((a.r0 + a.r1 + 1) / 2) * 20;
            emitSpecialParticles(cx, cy, syms, n); if (ringColor) fxRing(cx, cy, ringColor, Math.min(300, Math.max(120, (a.x1 - a.x0) * layerW / 100 * 0.9)), { duration: 650, grow: 2.2 });
        }
        const WZ = {
            football: { cd: 7000, ms: 750, plan: z => wzRect(z, z.x - 34, z.x, z.r, z.r), icon: '🏈', color: '#f59e0b',
                fire(z, a) { z._burstUntil = Date.now() + 1800; z._burstMul = 2.4; z.speed = (z.baseSpeed || 0.22) * 2.4; zAct(z, 'rush', 900);
                    for (let i = 0; i < 4; i++) fxSprite('💨', z.x + 2, z.r * 20 + 12, z.x + 10, z.r * 20 + 12, { size: 34, duration: 600, delay: i * 90 }); shakeLawn(2); playSound('snort'); } },
            pyramid: { cd: 6500, ms: 750, plan: z => zombies.some(o => o !== z && o.hp > 0 && o.hp < o.maxHp * 0.95 && Math.abs(o.r - z.r) <= 1 && Math.abs(o.x - z.x) < 26) ? wzRect(z, z.x - 26, z.x + 26, z.r - 1, z.r + 1) : null, icon: '✨', color: '#34d399',
                fire(z, a) { zombies.filter(o => o.hp > 0 && !o.isTomb && !o.isBoss && Math.abs(o.r - z.r) <= 1 && Math.abs(o.x - z.x) < 26).forEach(o => { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.12); fxSprite('💚', o.x, o.r * 20 + 12, o.x, o.r * 20 - 2, { size: 30, duration: 900 }); });
                    zAct(z, 'play', 700); wzBurst(a, ['✨', '🔺'], 5, '#34d399'); playSound('powerup'); } },
            disco: { cd: 10000, ms: 800, plan: z => wzRect(z, z.x - 24, z.x + 24, z.r - 1, z.r + 1), icon: '🪩', color: '#d946ef',
                fire(z, a) { zombies.filter(o => o.hp > 0 && o !== z && !o.isTomb && !o.isBoss && Math.abs(o.r - z.r) <= 1 && Math.abs(o.x - z.x) < 24).forEach(o => { o.speed = Math.min(0.32, (o.baseSpeed || o.speed) * 1.45); o.enragedUntil = Date.now() + 3200; });
                    zAct(z, 'dance', 900); wzBurst(a, ['🪩', '🎶', '✨', '💃'], 7, '#d946ef'); playSound('funk'); } },
            imp: { cd: 4500, ms: 500, plan: z => z.eating ? null : wzRect(z, z.x - 14, z.x, z.r, z.r), icon: '👣', color: '#fb923c',
                fire(z, a) { z.x = Math.max(0, z.x - 7); z._burstUntil = Date.now() + 900; z._burstMul = 1.8; fxSprite('💨', z.x + 8, z.r * 20 + 14, z.x + 1, z.r * 20 + 14, { size: 30, duration: 400 }); emitSpecialParticles(z.x, z.r * 20 + 10, ['💨', '⭐'], 3); } },
            jollyroger: { cd: 8500, ms: 950, plan: z => { const t = wzNearest(z, 5, 0)[0]; return t ? wzCell(t) : null; }, icon: '⚓', color: '#ef4444',
                fire(z, a) { wzIn(a).forEach(t => { wzHit(t, 70 * wzAtk, 3000); fxSprite('⚓', wzTileX(t), -8, wzTileX(t), t.r * 20 + 10, { size: 54, duration: 380 }); });
                    zAct(z, 'throw', 600); wzBurst(a, ['💥', '🌊'], 5, '#38bdf8'); shakeLawn(3); playSound('slam'); } },
            explorer: { cd: 8000, ms: 900, plan: z => wzNearest(z, 2.6, 1).length ? wzRect(z, z.x - 2.6 * 12.5, z.x, z.r - 1, z.r + 1) : null, icon: '🔥', color: '#f97316',
                fire(z, a) { wzIn(a).sort((p, q) => q.c - p.c).slice(0, 3).forEach(t => { wzHit(t, 38 * wzAtk, 0); fxSprite('🔥', z.x, z.r * 20 + 8, wzTileX(t), t.r * 20 + 10, { size: 42, duration: 420 }); });
                    zAct(z, 'throw', 600); wzBurst(a, ['🔥', '🔥', '✨'], 6, '#f97316'); playSound('fire'); } },
            pharaoh: { cd: 10000, ms: 1000, plan: z => wzNearest(z, 3.5, 1).length ? wzRect(z, z.x - 3.5 * 12.5, z.x, z.r - 1, z.r + 1) : null, icon: '☠️', color: '#a855f7',
                fire(z, a) { wzIn(a).sort((p, q) => q.c - p.c).slice(0, 4).forEach(t => { wzHit(t, 45 * wzAtk, 3500); fxSprite('👁️', z.x, z.r * 20 + 6, wzTileX(t), t.r * 20 + 8, { size: 36, duration: 450 }); });
                    zAct(z, 'play', 800); wzBurst(a, ['☠️', '🔮', '✨'], 6, '#a855f7'); playSound('rumble'); } },
            chicken: { cd: 3800, ms: 450, plan: z => { const o = [z.r - 1, z.r + 1].filter(r => r >= 0 && r < ROWS); z._wzDest = o[Math.floor(Math.random() * o.length)]; return wzRect(z, z.x - 8, z.x + 8, z._wzDest, z._wzDest); }, icon: '🐔', color: '#fde047',
                fire(z, a) { const old = z.r; z._fromR = old; z.r = z._wzDest; for (let i = 0; i < 3; i++) emitSpecialParticles(z.x, ((old + z.r) / 2) * 20 + 10, ['🪶'], 1); emitSpecialParticles(z.x, z.r * 20 + 10, ['🪶', '💨'], 3); playSound('cluck'); } },
            camel: { cd: 8000, ms: 900, plan: z => { const t = wzNearest(z, 4.5, 0)[0]; return t ? wzCell(t) : null; }, icon: '💦', color: '#ca8a04',
                fire(z, a) { wzIn(a).forEach(t => { wzHit(t, 40 * wzAtk, 3500); fxSprite('💦', z.x, z.r * 20 + 6, wzTileX(t), t.r * 20 + 10, { size: 40, duration: 450, arc: true }); });
                    zAct(z, 'throw', 500); wzBurst(a, ['💦', '🟤'], 4, '#ca8a04'); playSound('splash'); } },
            gargantuarpirate: { cd: 10000, ms: 1100, plan: z => { const t = wzNearest(z, 8, 0)[0]; if (!t) return null; const c = wzCell(t); return wzRect(z, c.x0 - 12.5, c.x1 + 12.5, t.r - 1, t.r + 1); }, icon: '💣', color: '#ef4444',
                fire(z, a) { const cx = (a.x0 + a.x1) / 2, cy = ((a.r0 + a.r1 + 1) / 2) * 20; fxSprite('💣', z.x, z.r * 20 + 4, cx, cy, { size: 56, duration: 450, arc: true });
                    setTimeout(() => { if (!isRunning) return; wzIn(a).forEach(p => wzHit(p, (p.r >= a.r0 + 1 && p.r <= a.r1 - 1 && wzTileX(p) > a.x0 + 12 && wzTileX(p) < a.x1 - 12 ? 130 : 55) * wzAtk, 2000)); wzBurst(a, ['💥', '🔥', '💣'], 8, '#f97316'); shakeLawn(4); playSound('cannonfire'); }, 450);
                    zAct(z, 'throw', 700); } },
            mummygargantuar: { cd: 11000, ms: 1000, plan: z => wzNearest(z, 3, 1).length ? wzRect(z, z.x - 37.5, z.x, z.r - 1, z.r + 1) : null, icon: '🩹', color: '#e5e7eb',
                fire(z, a) { wzIn(a).sort((p, q) => q.c - p.c).slice(0, 3).forEach(t => { wzHit(t, 50 * wzAtk, 3500); fxSprite('🩹', z.x, z.r * 20 + 8, wzTileX(t), t.r * 20 + 10, { size: 38, duration: 450, spin: 360 }); });
                    z.hp = Math.min(z.maxHp, z.hp + z.maxHp * 0.06); zAct(z, 'play', 800); wzBurst(a, ['🩹', '💀', '✨'], 6, '#e5e7eb'); playSound('rumble'); } },
            wildwestgargantuar: { cd: 11500, ms: 1100, plan: z => wzNearest(z, 2.8, 1).length ? wzRect(z, z.x - 35, z.x, z.r - 1, z.r + 1) : null, icon: '🌵', color: '#f59e0b',
                fire(z, a) { wzIn(a).forEach(t => wzHit(t, 75 * wzAtk, 2500)); zAct(z, 'throw', 800); shakeLawn(6); wzBurst(a, ['🌵', '💥', '🪨'], 8, '#f59e0b'); fxRing(z.x, z.r * 20 + 10, '#fbbf24', 180, { duration: 700, grow: 3 }); playSound('slam'); } }
        };
        const WZ_PRE = {};
        // ---- v69: after-warning effects. Each ability now plays its own animation matching what it does. ----
        const WZ_SHAPE = { football: 'lane', imp: 'lane', zombiebull: 'lane', impcannon: 'lane', chickenwrangler: 'lane', chicken: 'ring', pyramid: 'ring', disco: 'ring', pianist: 'ring',
            jollyroger: 'ring', camel: 'ring', gargantuarpirate: 'ring', tombraiser: 'ring', tomb: 'ring', explorer: 'cone', pharaoh: 'cone', mummygargantuar: 'cone', wildwestgargantuar: 'cone',
            'm:firedragon': 'cone', 'm:snowdragon': 'cone', 'm:rotobaga': 'cone', 'm:blover': 'lane' };
        const _y = (r, d) => r * 20 + (d == null ? 10 : d);
        function wzStunFx(p, ms) {
            const x = wzTileX(p), y = _y(p.r, 3), n = Math.min(3, Math.ceil(ms / 1200));
            for (let i = 0; i < n; i++) fxSprite('💫', x - 3, y, x + 3, y - 3, { size: 26, duration: 1050, delay: i * 1100 });
        }
        function wzTrail(z, ms, sym) { z._trailUntil = Date.now() + ms; z._trailSym = sym || '💨'; }
        function wzFx(T, z, a) {
            const y = _y(z.r), x = z.x, cx = (a.x0 + a.x1) / 2, cy = ((a.r0 + a.r1 + 1) / 2) * 20;
            const dash = (sym, n, x0, x1, yy, o) => { for (let i = 0; i < n; i++) { const t = n > 1 ? i / (n - 1) : 0; fxSprite(sym, x0 + (x1 - x0) * t, yy, x0 + (x1 - x0) * t - 4, yy - 3, Object.assign({ size: 30, duration: 520, delay: i * 70 }, o || {})); } };
            switch (T) {
                case 'zombiebull':
                    wzTrail(z, 1700, '💨'); fxSprite('🐂', x + 2, y, Math.max(2, a.x0), y, { size: 64, duration: 560 });
                    dash('💨', 6, x, a.x0, _y(z.r, 15)); dash('🪨', 4, x - 2, a.x0, _y(z.r, 16), { size: 20, arc: 9, duration: 650 });
                    fxRing(x, _y(z.r, 14), '#ef4444', 110, { duration: 500 }); fxLabel('CHARGE!', x, y - 14, '#fecaca', 18); shakeLawn(3); break;
                case 'football':
                    wzTrail(z, 1800, '💨'); dash('✨', 5, x, a.x0, y, { size: 24 }); fxLabel('BLITZ!', x, y - 14, '#fde68a', 17); fxRing(x, _y(z.r, 14), '#f59e0b', 90, { duration: 450 }); break;
                case 'imp':
                    wzTrail(z, 900, '💨'); fxRing(x, _y(z.r, 14), '#fb923c', 70, { duration: 380 }); fxLabel('DASH!', x, y - 12, '#fed7aa', 14); break;
                case 'chicken': {
                    const f = z._fromR == null ? z.r : z._fromR, fx = x;
                    fxSprite('🐔', fx, _y(f), fx, y, { size: 46, duration: 420, arc: 12, spin: 0 });
                    for (let i = 0; i < 5; i++) fxSprite('🪶', fx, (_y(f) + y) / 2, fx + (i - 2) * 3, (_y(f) + y) / 2 + 6 + (i % 2) * 4, { size: 20, duration: 700, delay: i * 40, spin: 160 });
                    fxRing(fx, y + 4, '#fde047', 80, { duration: 420 }); fxLabel('FLAP!', fx, y - 14, '#fef08a', 15); break; }
                case 'chickenwrangler':
                    for (let i = 0; i < 2; i++) { fxSprite('🐔', x, y, x - 10 - i * 6, y + 5, { size: 36, duration: 560, arc: 14, delay: i * 120 }); }
                    for (let i = 0; i < 6; i++) fxSprite('🪶', x, y, x - 4 - i * 2.5, y - 4 + (i % 3) * 5, { size: 18, duration: 700, delay: i * 50, spin: 200 });
                    fxRing(x - 4, y + 6, '#fde047', 100, { duration: 500 }); fxLabel('CLUCK CLUCK!', x - 3, y - 14, '#fef08a', 14); break;
                case 'impcannon':
                    fxSprite('💥', x - 3, y, x - 5, y - 2, { size: 54, duration: 420 }); fxSprite('👶', x - 3, y - 6, x - 14, y + 2, { size: 34, duration: 600, arc: 20, spin: 540 });
                    dash('💨', 3, x - 2, x - 9, y - 4, { size: 26 }); shakeLawn(2); fxLabel('FIRE!', x - 3, y - 14, '#fecaca', 15); break;
                case 'tombraiser': case 'tomb': {
                    const tx = Math.max(8, x - (T === 'tomb' ? 4 : 10));
                    fxSprite('🪦', tx, y + 9, tx, y, { size: 46, duration: 700 });
                    for (let i = 0; i < 6; i++) fxSprite('🟫', tx, y + 8, tx + (i - 2.5) * 2.2, y - 2 - (i % 2) * 5, { size: 16, duration: 650, delay: 60 + i * 40, arc: 10 });
                    fxRing(tx, y + 6, '#a78bfa', 100, { duration: 560 }); shakeLawn(2); fxLabel('RISE!', tx, y - 14, '#ddd6fe', 15); break; }
                case 'jollyroger':
                    wzIn(a).forEach(t => { const px = wzTileX(t), py = _y(t.r); fxSprite('⛓️', px, -6, px, py - 8, { size: 28, duration: 330 }); fxRing(px, py + 4, '#38bdf8', 110, { duration: 620, delay: 330 }); for (let i = 0; i < 4; i++) fxSprite('💧', px, py, px + (i - 1.5) * 4, py - 8, { size: 18, duration: 600, delay: 340 + i * 30, arc: 10 }); });
                    break;
                case 'explorer':
                    for (let i = 0; i < 6; i++) { const t = i / 5; fxSprite('🔥', x - 2 - t * (x - a.x0 - 2), y + (i % 2 ? 4 : -3), x - 6 - t * (x - a.x0 - 2), y + (i % 2 ? 6 : -5), { size: 30 + i * 4, duration: 520, delay: i * 70 }); }
                    wzIn(a).slice(0, 3).forEach(t => { fxSprite('🔥', wzTileX(t), _y(t.r, 6), wzTileX(t), _y(t.r, -4), { size: 40, duration: 900, delay: 300 }); });
                    fxLabel('FLAMETHROWER!', x - 6, y - 14, '#fed7aa', 13); break;
                case 'pharaoh':
                    fxLawnFlash('#7c3aed', .2, 700, cx, cy);
                    wzIn(a).slice(0, 4).forEach(t => { const px = wzTileX(t), py = _y(t.r); fxRing(px, py, '#a855f7', 90, { duration: 600 }); fxRing(px, py, '#c084fc', 90, { duration: 600, delay: 350 }); fxSprite('☠️', px, py - 4, px, py - 14, { size: 30, duration: 1100 }); });
                    fxLabel('CURSE!', x - 6, y - 14, '#e9d5ff', 16); break;
                case 'camel':
                    wzIn(a).forEach(t => { const px = wzTileX(t), py = _y(t.r, 12); for (let i = 0; i < 4; i++) fxSprite('💦', px, py, px + (i - 1.5) * 3.5, py + 2, { size: 22, duration: 1500, delay: 460 + i * 40 }); fxRing(px, py, '#ca8a04', 90, { duration: 700, delay: 440 }); });
                    break;
                case 'gargantuarpirate':
                    setTimeout(() => { if (!isRunning) return; fxLawnFlash('#f97316', .3, 650, cx, cy); [0, 140, 280].forEach((d, i) => fxRing(cx, cy, i ? '#fbbf24' : '#ef4444', 150 + i * 60, { duration: 700, delay: d, grow: 2.8 }));
                        fxSprite('🕳️', cx, cy + 2, cx, cy + 2, { size: 52, duration: 1500 }); for (let i = 0; i < 7; i++) fxSprite('🔥', cx, cy, cx + (i - 3) * 4.5, cy - 8 - (i % 3) * 4, { size: 26, duration: 800, delay: i * 30, arc: 12 }); shakeLawn(6); }, 470);
                    break;
                case 'mummygargantuar':
                    wzIn(a).slice(0, 3).forEach((t, i) => { fxSprite('🧻', x - 2, y, wzTileX(t), _y(t.r), { size: 34, duration: 480, spin: 540, delay: i * 80 }); fxRing(wzTileX(t), _y(t.r), '#e5e7eb', 80, { duration: 600, delay: 440 + i * 80 }); });
                    fxSprite('💚', x, y - 4, x, y - 18, { size: 30, duration: 900 }); fxLabel('WRAP!', x - 6, y - 14, '#f3f4f6', 15); break;
                case 'wildwestgargantuar':
                    for (let i = 0; i < 5; i++) { const px = x - 6 - i * 8; fxRing(px, _y(z.r, 15), '#fbbf24', 80 + i * 8, { duration: 500, delay: i * 90 }); fxSprite('🌵', px, _y(z.r, 16), px, _y(z.r, 2), { size: 36, duration: 700, delay: i * 90 }); }
                    dash('🪨', 4, x - 4, a.x0, y + 6, { size: 18, arc: 10, duration: 700 }); break;
                case 'pyramid':
                    fxLawnFlash('#34d399', .12, 600, cx, cy); fxRing(cx, cy, '#34d399', 160, { duration: 700 }); fxRing(cx, cy, '#a7f3d0', 160, { duration: 700, delay: 250 });
                    zombies.filter(o => o.hp > 0 && !o.isTomb && Math.abs(o.r - z.r) <= 1 && Math.abs(o.x - x) < 26).slice(0, 5).forEach(o => fxLabel('+HP', o.x, _y(o.r, 2), '#86efac', 14)); break;
                case 'disco':
                    fxLawnFlash('#d946ef', .16, 700, cx, cy); [0, 200, 400].forEach(d => fxRing(cx, cy, '#d946ef', 140, { duration: 650, delay: d, grow: 2.2 }));
                    for (let i = 0; i < 4; i++) fxSprite('🎶', cx + (i - 1.5) * 8, cy + 6, cx + (i - 1.5) * 9, cy - 16, { size: 26, duration: 1000, delay: i * 120 });
                    zombies.filter(o => o !== z && o.hp > 0 && !o.isTomb && Math.abs(o.r - z.r) <= 1 && Math.abs(o.x - x) < 24).slice(0, 4).forEach(o => fxSprite('🪩', o.x, _y(o.r, -2), o.x, _y(o.r, -10), { size: 26, duration: 1200 })); break;
                case 'pianist':
                    for (let i = 0; i < 6; i++) fxSprite(i % 2 ? '🎵' : '🎶', x, y - 4, x + (i < 3 ? -1 : 1) * (8 + (i % 3) * 7), y - 12 + (i % 3) * 5, { size: 26, duration: 900, delay: i * 80, arc: 8 });
                    [0, 220].forEach(d => fxRing(x, y, '#a78bfa', 150, { duration: 650, delay: d, grow: 2.4 })); fxLabel('♪ SPEED UP ♪', x, y - 16, '#ddd6fe', 13); break;
                case 'm:firedragon': case 'm:snowdragon': {
                    const sym = T === 'm:firedragon' ? '🔥' : '❄️', col = T === 'm:firedragon' ? '#f97316' : '#38bdf8';
                    for (let rr = Math.max(0, z.r - 1); rr <= Math.min(ROWS - 1, z.r + 1); rr++) for (let i = 0; i < 4; i++) fxSprite(sym, x - 2, _y(z.r), x - 8 - i * 7, _y(rr), { size: 32 + i * 4, duration: 560, delay: i * 70 });
                    fxRing(x - 3, y, col, 110, { duration: 500 }); fxLabel(T === 'm:firedragon' ? 'DRAGON FIRE!' : 'FROST BREATH!', x - 6, y - 14, '#fff', 14); break; }
                case 'm:rotobaga':
                    for (let k = 0; k < 3; k++) fxSprite('🥕', x - 2, y, a.x0, _y(Math.max(0, Math.min(ROWS - 1, z.r + k - 1))), { size: 32, duration: 620, delay: k * 110, spin: 720 });
                    fxLabel('ROOT BARRAGE!', x - 6, y - 14, '#fecaca', 13); break;
                case 'm:blover':
                    for (let i = 0; i < 7; i++) fxSprite(i % 2 ? '🍃' : '🌬️', x, _y(z.r, 4 + (i % 3) * 4), 2, _y(z.r, 4 + (i % 3) * 4), { size: 30, duration: 700, delay: i * 70 });
                    fxLabel('GALE!', x - 6, y - 14, '#bfdbfe', 15); shakeLawn(2); break;
            }
        }
        let wzAtk = 1;
        function wzAbility(z, now, healthMult, attackMult) {
            const def = WZ[z.type];
            if (!def || z.hp <= 0 || z.isTomb) return;
            if (z._burstUntil) {
                if (now < z._burstUntil) z.speed = Math.max(z.speed, (z.baseSpeed || 0.1) * (z._burstMul || 2));
                else { z._burstUntil = 0; if (!(z.slowedUntil > now)) z.speed = z.baseSpeed || z.speed; }
            }
            wzAtk = attackMult;
            if (z._wzFire) {
                if (now < z._wzFire.at) return;
                const f = z._wzFire; z._wzFire = null;
                def.fire(z, f.area); try { wzFx(z.type, z, f.area); } catch (e) {}
                z._wzNext = now + (def.cd / (1 + (currentTier - 1) * 0.1)) * (0.85 + Math.random() * 0.3);
                return;
            }
            if (!z._wzNext) z._wzNext = now + 2500 + Math.random() * 2500;
            if (now < z._wzNext) return;
            const area = def.plan(z);
            if (!area) { z._wzNext = now + 1200; return; }
            wzShow(area, def.ms, def.icon, def.color, WZ_SHAPE[z.type]);
            z._wzFire = { at: now + def.ms, area };
        }
        // Warnings for abilities that already existed: shown shortly before the ability's own timer fires.
        function wzPreExisting(z, now) {
            const sim = (at, area, icon, color, kind) => { const left = at - now; if (at > 0 && left > 0 && left <= 900 && z._pwAt !== at) { z._pwAt = at; const k = kind || z.type; wzShow(area, left, icon, color, WZ_SHAPE[k]); setTimeout(() => { if (isRunning && z.hp > 0) { try { wzFx(k, z, area); } catch (e) {} } }, left + 30); } };
            if (z._trailUntil > now && now - (z._trailAt || 0) > 110 && !z.eating) { z._trailAt = now; fxSprite(z._trailSym || '💨', z.x + 3, z.r * 20 + 15, z.x + 10, z.r * 20 + 15, { size: 28, duration: 420 }); }
            const T = z.type, r = z.r, zc = z.x + 4;
            if (T === 'impcannon') sim(z.lastSpecialSpawn || 0, wzRect(z, z.x - 12, z.x + 2, r, r), '💣', '#ef4444');
            else if (T === 'tombraiser') sim(z.lastSpecialSpawn || 0, wzRect(z, Math.max(8, z.x - 16), z.x - 4, r, r), '🪦', '#a78bfa');
            else if (T === 'tomb') sim(z.lastSpecialSpawn || 0, wzRect(z, z.x - 7, z.x + 2, r, r), '💀', '#a78bfa');
            else if (T === 'chickenwrangler') sim(z.lastSpecialSpawn || 0, wzRect(z, z.x - 8, z.x + 1, r, r), '🐔', '#fde047');
            else if (T === 'zombiebull') sim(z.lastSpecialSpawn || 0, wzRect(z, z.x - 36, z.x, r, r), '🐂', '#ef4444');
            else if (T === 'pianist') sim(z.lastSpecialSpawn || 0, wzRect(z, z.x - 24, z.x + 24, r - 1, r + 1), '🎹', '#a78bfa');
            else if (T === 'disco' && z.lastDanceTime) sim(z.lastDanceTime + 6000, wzRect(z, z.x - 3, z.x + 12, r - 1, r + 1), '🕺', '#d946ef');
            if (z.mutant && (z.nextMutationAttack || 0) > 0) {
                const m = z.mutant, at = z.nextMutationAttack;
                if (m === 'firedragon' || m === 'snowdragon') { if (plants.some(p => Math.abs(p.r - r) <= 1 && wzTileX(p) < zc && zc - wzTileX(p) < 34)) sim(at, wzRect(z, zc - 34, zc, r - 1, r + 1), m === 'firedragon' ? '🔥' : '❄️', m === 'firedragon' ? '#f97316' : '#38bdf8', 'm:' + m); }
                else if (m === 'rotobaga') sim(at, wzRect(z, zc - 36, zc, r - 1, r + 1), '🥕', '#ef4444', 'm:rotobaga');
                else if (m === 'blover') sim(at, wzRect(z, 0, zc, r, r), '🌬️', '#60a5fa', 'm:blover');
                else if (m === 'sunflower' || m === 'twinsunflower') { const left = at - now; if (left > 0 && left <= 900 && z._pwAt !== at) { z._pwAt = at; const el = sunCountEl && (sunCountEl.parentElement || sunCountEl); if (el) { el.classList.add('warn-flash'); setTimeout(() => el.classList.remove('warn-flash'), 950); } } }
            }
            if (T === 'newton_elite') sim(z.nextApple || 0, { x0: 0, x1: 100, r0: 0, r1: ROWS - 1 }, '🍎', '#fbbf24');
            else if (T === 'einstein_elite') {
                const nr = z.nextRowShift || 0; if (nr - now > 0 && nr - now <= 900 && z._pwRow !== nr) { z._pwRow = nr; const ch = Array.from({ length: ROWS }, (_, i) => i).filter(q => q !== z.r); z._preRow = ch[Math.floor(Math.random() * ch.length)]; wzShow({ x0: 70, x1: 100, r0: z._preRow, r1: z._preRow }, nr - now, '🧠', '#60a5fa'); }
                const ne = z.nextEinstein || 0; if (ne - now > 0 && ne - now <= 900 && z._pwEin !== ne) { z._pwEin = ne; z._preLanes = [...new Set([Math.floor(Math.random() * ROWS), Math.floor(Math.random() * ROWS)])]; z._preLanes.forEach(q => wzShow({ x0: 0, x1: 100, r0: q, r1: q }, ne - now, '⏳', '#38bdf8')); }
                sim(z.nextMinions || 0, { x0: 84, x1: 100, r0: z.r - 1 < 0 ? 0 : z.r - 1, r1: Math.min(ROWS - 1, z.r + 1) }, '👥', '#60a5fa');
                sim(z.nextSingularity || 0, { x0: 28, x1: 72, r0: 1, r1: 3 }, '🕳️', '#a855f7');
            }
        }
        function zAct(z, name, ms) { z.act = name; z.actUntil = Date.now() + ms; }
        function shakeLawn(px = 4) {
            if (!gameLayerEl || !gameLayerEl.animate) return;
            gameLayerEl.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${px}px,${px / 2}px)` }, { transform: `translate(${-px}px,${-px / 3}px)` }, { transform: `translate(${px / 2}px,0)` }, { transform: 'translate(0,0)' }], { duration: 260 });
        }
        // Wave warning banner + red vignette + marching zombies (CSS only, one shared element).
        let waveWarnTimer = null;
        function showWaveWarning(wave, maxW) {
            const final = wave >= maxW && maxW > 1, first = wave <= 1;
            let el = document.getElementById('wave-warning');
            if (!el) {
                el = document.createElement('div'); el.id = 'wave-warning';
                el.innerHTML = '<div class="ww-vig"></div><div class="ww-box"><div class="ww-title"></div><div class="ww-sub"></div><div class="ww-march">🧟 🧟‍♂️ 🧟 🪖 🧟‍♀️ 🧟 🏈 🧟 🧟‍♂️ 🧟</div></div>';
                document.body.appendChild(el);
            }
            el.className = 'ww-on' + (final ? ' ww-final' : '') + (first ? ' ww-first' : '');
            el.querySelector('.ww-title').textContent = final ? '⚠️ FINAL WAVE! ⚠️' : (first ? 'THE ZOMBIES ARE COMING!' : '⚠️ A HUGE WAVE IS APPROACHING! ⚠️');
            el.querySelector('.ww-sub').textContent = final ? 'Hold the line – this is the last wave!' : (first ? 'Plant your defenses!' : `Wave ${wave} of ${maxW} – more zombies than ever!`);
            void el.offsetWidth;
            el.classList.add('ww-play');
            clearTimeout(waveWarnTimer);
            waveWarnTimer = setTimeout(() => { el.className = ''; }, final ? 3600 : (first ? 2200 : 3000));
            if (first) { if (audioCtx) { tn(98, 0.6, { type: 'sawtooth', lp: 700, vol: 0.18, atk: 0.06 }); tn(139, 0.6, { type: 'sawtooth', lp: 700, vol: 0.12, atk: 0.06 }); SFX.groan(0.9); } }
            else { playWaveHorn(final); shakeLawn(5); }
        }
        // v64: spread spawns evenly. Picks among the lanes that currently hold the fewest live zombies
        // (counting recent spawns), so a whole wave can never pile into one lane by bad luck.
        let _laneRecent = [0, 0, 0, 0, 0], _laneRecentAt = 0;
        function pickBalancedLane() {
            const now = Date.now();
            if (now - _laneRecentAt > 2500) { _laneRecent = _laneRecent.map(v => v * 0.5); _laneRecentAt = now; }
            const load = [];
            for (let r = 0; r < ROWS; r++) load.push(_laneRecent[r] || 0);
            zombies.forEach(z => { if (z.hp > 0 && !z.isTomb && !z.isBoss && z.r >= 0 && z.r < ROWS) load[z.r] += 1; });
            const min = Math.min(...load);
            const pool = [];
            for (let r = 0; r < ROWS; r++) if (load[r] <= min + 0.6) pool.push(r);
            const r = pool[Math.floor(Math.random() * pool.length)];
            _laneRecent[r] = (_laneRecent[r] || 0) + 1;
            return r;
        }
        function spawnZombie() {
            if (!window.__revSpawn && zombiesSpawned >= totalZombiesInWave) return;

            const healthMult = zombieHealthMult(currentTier);
            const attackMult = zombieAttackMult(currentTier);

            // Level 11 is a dedicated multi-phase mech-boss encounter.
            if (currentLevel === 11 && !zombies.some(z => z.isBoss)) {
                const now = Date.now();
                zombies.push({
                    id: Date.now() + Math.random(), isBoss: true, r: 0, x: 86,
                    type: 'zomboss', hp: 18000 * healthMult, maxHp: 18000 * healthMult,
                    speed: 0, baseSpeed: 0, emoji: '🤖', damage: 0,
                    nextBossAttack: now + 3500, bossAttackIndex: 0,
                    nextBossMove: now + 1200, bossMoveDirection: 1, bossAttackState: null,
                    eating: false, hitFlash: false
                });
                zombiesSpawned++;
                addVisualEffect({ x: 92, y: 50, emoji: '💥', duration: 1000, size: 'text-6xl', className: 'special-attack-effect' });
                return;
            }

            const randomRow = window.__revSpawn ? window.__revSpawn.r : pickBalancedLane();
            const levelConfig = LEVELS[currentLevel];
            const allowed = levelConfig.allowedZombies;
            
            let typeKey = window.__revSpawn ? window.__revSpawn.type : allowed[Math.floor(Math.random() * allowed.length)];
            if(currentLevel===29 && zombiesSpawned===0 && allowed.includes('newton_elite')) typeKey='newton_elite';
            if((currentLevel===33||currentLevel===34) && zombiesSpawned===0 && allowed.includes('einstein_elite')) typeKey='einstein_elite';
            // Elite zombies: never two of the same one on the lawn at once.
            if (ZOMBIE_TYPES[typeKey].elite && zombies.some(o => o.type === typeKey)) {
                const alts = allowed.filter(k => !ZOMBIE_TYPES[k].elite);
                typeKey = alts.length ? alts[Math.floor(Math.random() * alts.length)] : typeKey;
                if (ZOMBIE_TYPES[typeKey].elite) return;
            }
            const zType = ZOMBIE_TYPES[typeKey];

            // 7% chance to spawn an Energy Zombie
            const isEnergyZombie = !window.__revSpawn && Math.random() < 0.07;
            const energyHp = isEnergyZombie ? 1.25 : 1;
            const energyDmg = isEnergyZombie ? 1.3 : 1;

            playSound(HEAVY_ZOMBIES.includes(typeKey) ? 'roar' : (typeKey === 'chicken' ? 'cluck' : (typeKey === 'zombiebull' ? 'snort' : 'groan')), HEAVY_ZOMBIES.includes(typeKey) ? undefined : (['imp','chicken'].includes(typeKey) ? 1.6 : (typeKey === 'football' ? 0.9 : 1)));
            zombies.push({
                id: Date.now() + Math.random(),
                r: zType.darwin ? (zombies.find(o => o.isMendel && o.hp > 0)?.r ?? Math.floor(ROWS / 2)) : randomRow,
                x: window.__revSpawn ? window.__revSpawn.x : (zType.elite ? (typeKey==='einstein_elite'?86:82) : 100),
                type: typeKey,
                hp: zType.hp * healthMult * energyHp,
                maxHp: zType.maxHp * healthMult * energyHp,
                speed: zType.speed,
                baseSpeed: zType.speed,
                emoji: zType.emoji,
                damage: zType.damage * attackMult * energyDmg, baseDamage: zType.damage * attackMult * energyDmg,
                canVault: zType.canVault || false,
                hasImp: !!zType.hasImp,
                vaulted: false,
                isBarrel: !!zType.barrel, barrelBroken: false,
                isTomb: !!zType.tomb, lastSpecialSpawn: Date.now()+3500,
                camelShield: !!zType.camelShield, explorer: !!zType.explorer,
                chickenWrangler: !!zType.chickenWrangler, bull: !!zType.bull,
                pianist: !!zType.pianist, tombRaiser: !!zType.tombRaiser, impCannon: !!zType.impCannon,
                mutationHead: zType.mutationHead || null, mutant: zType.mutant || null, flying: !!zType.flying,
                nextMutationAttack: Date.now() + 1600, nextApple: Date.now()+8000, nextEinstein: Date.now()+9000, nextSingularity: Date.now()+14000,
                isBiologist: !!zType.biologist, isMendel: !!zType.mendel, isDarwin: !!zType.darwin, stationary: !!zType.stationary,
                nextMutate: Date.now(), nextFuse: Date.now() + 4000, nextEvolution: Date.now() + (zType.darwin ? 3000 : 8000),
                enraged: false,
                isEnergyZombie: isEnergyZombie,
                inertia: !!zType.inertia, mass: !!zType.mass, newton3: !!zType.newton3,
                relativity: !!zType.relativity, photon: !!zType.photon, tesla: !!zType.tesla,
                schrodinger: !!zType.schrodinger, hawking: !!zType.hawking, pendulum: !!zType.pendulum,
                skater: !!zType.skater, refractor: !!zType.refractor,
                inertiaSpeed: zType.speed, nextBlink: Date.now()+3000, nextSpecial: Date.now()+4500,
                charge: 0, pendulumPhase: Math.random()*Math.PI*2, lastPhysicsTick: Date.now(),
                lastDanceTime: Date.now(),
                eating: false
            });

            if (zType.mendel) {
                const darwin = zombies.find(o => o.isDarwin && o.hp > 0);
                if (darwin) darwin.r = randomRow;
            }
            zombiesSpawned++;
        }

        function countActiveParticles() {
            let count = 0;
            for (let i = 0; i < visualEffects.length; i++) {
                if (visualEffects[i].isParticle) count++;
            }
            return count;
        }

        // A defensive cleanup pass keeps hard limits true even if future abilities
        // add effects through a new code path. Oldest particles are discarded first.
        function enforceVisualEffectLimits() {
            if (visualEffects.length < 30) return;
            let particleCount = 0;
            const perBlock = new Map();
            const keep = [];

            for (let i = visualEffects.length - 1; i >= 0; i--) {
                const effect = visualEffects[i];
                if (!effect.isParticle) {
                    keep.push(effect);
                    continue;
                }
                const blockKey = `${effect.blockCol},${effect.blockRow}`;
                const blockCount = perBlock.get(blockKey) || 0;
                if (particleCount >= MAX_PARTICLE_EFFECTS || blockCount >= MAX_PARTICLES_PER_BLOCK) continue;
                particleCount++;
                perBlock.set(blockKey, blockCount + 1);
                keep.push(effect);
            }

            // Preserve the newest effects and never render more than the total DOM budget.
            keep.reverse();
            if (keep.length > MAX_VISUAL_EFFECTS) keep.splice(0, keep.length - MAX_VISUAL_EFFECTS);
            visualEffects = keep;
        }

        function addVisualEffect({ x, y, emoji, duration = 450, size = 'text-4xl sm:text-5xl', className = '' }) {
            const isParticle = className.includes('particle-float');
            if (isParticle && perfLevel && Math.random() < (perfLevel === 1 ? 0.5 : 0.8)) return;
            // Bound both the whole-screen particle load and the load on each tile.
            const blockCol = Math.min(COLS - 1, Math.max(0, Math.floor((x / 100) * COLS)));
            const blockRow = Math.min(ROWS - 1, Math.max(0, Math.floor((y / 100) * ROWS)));
            if (isParticle) {
                let particlesOnBlock = 0;
                let totalParticles = 0;
                for (let i = 0; i < visualEffects.length; i++) {
                    const effect = visualEffects[i];
                    if (effect.isParticle) {
                        totalParticles++;
                        if (effect.blockCol === blockCol && effect.blockRow === blockRow) particlesOnBlock++;
                    }
                }
                if (totalParticles >= MAX_PARTICLE_EFFECTS || particlesOnBlock >= MAX_PARTICLES_PER_BLOCK) return;
            }
            // Keep all temporary effect DOM nodes bounded as a second safety limit.
            // Prefer dropping the oldest non-particle decoration; never exceed the cap.
            if (visualEffects.length >= MAX_VISUAL_EFFECTS) {
                const oldestNonParticleIndex = visualEffects.findIndex(effect => !effect.isParticle);
                if (oldestNonParticleIndex >= 0) visualEffects.splice(oldestNonParticleIndex, 1);
                else if (isParticle) return;
                else visualEffects.shift();
            }
            visualEffects.push({
                id: Date.now() + Math.random(),
                x,
                y,
                emoji,
                size,
                className,
                isParticle,
                blockCol,
                blockRow,
                createdAt: Date.now(),
                duration,
                dx: (Math.random() - 0.5) * 34,
                dy: -28 - Math.random() * 24,
                rotation: (Math.random() - 0.5) * 70,
                expiresAt: Date.now() + duration
            });
        }

        function emitParticles(x, y, symbols = ['✨', '💥', '⭐'], count = 7) {
            // A small, consistent burst is clearer and much cheaper than dozens of DOM nodes.
            if (projectiles.length + diagShots.length > 150 && Math.random() < 0.65) return;
            count = Math.min(count, 3, Math.max(0, MAX_PARTICLE_EFFECTS - countActiveParticles()));
            for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 * i / count) + Math.random() * 0.45;
                const radius = 1.5 + Math.random() * 3.0;
                const symbol = symbols[Math.floor(Math.random() * symbols.length)];
                addVisualEffect({
                    x: Math.max(0, Math.min(100, x + Math.cos(angle) * radius)),
                    y: Math.max(0, Math.min(100, y + Math.sin(angle) * radius)),
                    emoji: symbol,
                    duration: 650 + Math.random() * 100,
                    size: 'text-xl sm:text-2xl',
                    className: 'particle-float'
                });
            }
        }

        function emitSpecialParticles(x, y, symbols, count = 6) {
            // Special attacks get a more noticeable burst, while retaining a strict DOM-node cap.
            count = Math.min(count, 7, Math.max(0, MAX_PARTICLE_EFFECTS - countActiveParticles()));
            for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 * i / count) + Math.random() * 0.35;
                const radius = 2.5 + Math.random() * 4.5;
                addVisualEffect({
                    x: Math.max(0, Math.min(100, x + Math.cos(angle) * radius)),
                    y: Math.max(0, Math.min(100, y + Math.sin(angle) * radius)),
                    emoji: symbols[Math.floor(Math.random() * symbols.length)],
                    duration: 850 + Math.random() * 180,
                    size: 'text-2xl sm:text-3xl',
                    className: 'particle-float'
                });
            }
        }

        function plantParticles(p, symbols, count = 5) {
            emitParticles(((p.c + 0.5) / COLS) * 100, ((p.r + 0.5) / ROWS) * 100, symbols, count);
        }

        // ---- Rotobaga death: lift zombies in its tile + the 4 diagonal neighbour tiles, then drop them.
        function rotoDropDamage(level) { const L = Math.max(1, Math.min(5, Math.floor(level || 1))); return Math.round(150 * Math.pow(3340 / 150, (L - 1) / 4)); }
        function zombieCol(z) { return Math.max(0, Math.min(COLS - 1, Math.floor((z.x + 4) / (100 / COLS)))); }
        function rotobagaDeathLift(p) {
            const cells = [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]];
            const caught = [];
            cells.forEach(([dr, dc]) => {
                const rr = p.r + dr, cc = p.c + dc;
                if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) return;
                zombies.forEach(z => { if (!z.isTomb && z.r === rr && zombieCol(z) === cc && !caught.includes(z)) caught.push(z); });
            });
            const px = ((p.c + 0.5) / COLS) * 100, py = ((p.r + 0.5) / ROWS) * 100;
            playSound('roto');
            fxRotobagaLift(px, py, caught);
            if (!caught.length) return;
            zombies = zombies.filter(z => !caught.includes(z));
            airDrops.push({ zs: caught, t: 25, dmg: rotoDropDamage(p.level || 1) });
        }
        function fxRotobagaLift(px, py, caught) {
            if (!gameLayerEl) return;
            const W = layerW, H = layerH;
            const apexY = Math.max(4, py - 44), DUR = 1500;
            const mk = (emoji, size) => { const el = fxTake(); if (!el) return null; el.textContent = emoji; el.style.fontSize = size + 'px'; gameLayerEl.appendChild(el); return el; };
            const P = (x, y, sc, rot) => `translate(${(x * W / 100).toFixed(1)}px,${(y * H / 100).toFixed(1)}px) translate(-50%,-50%) scale(${sc}) rotate(${rot}deg)`;
            const roto = mk('🍠', 58);
            if (roto) {
                const a = roto.animate([
                    { transform: P(px, py, 1, 0), opacity: 1, offset: 0 },
                    { transform: P(px, apexY, 1.35, 360), opacity: 1, offset: .38 },
                    { transform: P(px, apexY, 1.45, 540), opacity: 1, offset: .62 },
                    { transform: P(px + 22, apexY - 14, 1.1, 1100), opacity: 1, offset: .8 },
                    { transform: P(px + 70, apexY - 30, .5, 1800), opacity: 0, offset: 1 }], { duration: DUR, easing: 'ease-in-out', fill: 'both' });
                a.onfinish = a.oncancel = () => fxGive(roto);
            }
            caught.slice(0, 10).forEach((z, i) => {
                const el = mk(z.emoji, 42); if (!el) return;
                const zx = z.x + 3, zy = ((z.r + 0.5) / ROWS) * 100;
                const hangX = px + (i - (caught.length - 1) / 2) * 3.2, hangY = apexY + 22 + (i % 2) * 6;
                const a = el.animate([
                    { transform: P(zx, zy, 1, 0), opacity: 1, offset: 0 },
                    { transform: P(hangX, hangY, 1.05, -25 + i * 12), opacity: 1, offset: .38 },
                    { transform: P(hangX, hangY + 1, 1.05, 20 - i * 10), opacity: 1, offset: .62 },
                    { transform: P(zx, zy - 1, 1.15, 540 + i * 40), opacity: 1, offset: .84 },
                    { transform: P(zx, zy + 1, 1.35, 560 + i * 40), opacity: 0, offset: 1 }], { duration: DUR, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both' });
                a.onfinish = a.oncancel = () => fxGive(el);
            });
            if (caught.length) setTimeout(() => playSound('rotodrop'), 750);
        }
        function processPlantDeathsAndAirDrops() {
            const live = new Set();
            for (const p of plants) { live.add(p.id); plantRegistry.set(p.id, p); }
            for (const [id, p] of plantRegistry) {
                if (live.has(id)) continue;
                plantRegistry.delete(id);
                if (p.type === 'rotobaga' && !p._shoveled && p.hp <= 0) rotobagaDeathLift(p);
                npOnPlantDeath(p);
            }
            if (!airDrops.length) return;
            airDrops.forEach(a => {
                a.t--;
                if (a.t > 0) return;
                a.zs.forEach(z => {
                    z.hp -= a.dmg; z.hitFlash = true; z.eating = false; zombies.push(z);
                    emitParticles(z.x + 2, ((z.r + 0.5) / ROWS) * 100, ['💥', '🍠', '⭐'], 5);
                });
                playSound('slam'); shakeLawn(5);
            });
            airDrops = airDrops.filter(a => a.t > 0);
        }

        // ---------------- DNA-mutant zombies: plant abilities with real animations ----------------
        let zShots = [];
        // ---- Canvas projectile renderer: thousands of DOM style writes become one cheap 2D draw pass ----
        let projCanvas = null, projCtx = null, projDirty = false;
        const spriteCache = new Map();
        function emojiSprite(emoji, px) {
            const dpr = Math.min(2, window.devicePixelRatio || 1), key = emoji + '|' + px + '|' + dpr;
            let sp = spriteCache.get(key);
            if (!sp) {
                const sz = Math.ceil(px * 1.5 * dpr); sp = document.createElement('canvas'); sp.width = sp.height = sz;
                const c = sp.getContext('2d'); c.font = `${Math.round(px * dpr)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
                c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 3 * dpr; c.shadowOffsetY = 1.5 * dpr;
                c.fillText(emoji, sz / 2, sz / 2 + px * dpr * .05); sp.cssW = sz / dpr; spriteCache.set(key, sp);
                try { if (window.createImageBitmap) createImageBitmap(sp).then(b => { sp.bmp = b; }).catch(() => {}); } catch (_) {}
            }
            return sp;
        }
        function canvasProjectile(pea) { return !pea.lob && pea.type !== 'needle' && pea.type !== 'electric-needle' && pea.type !== 'citron' && pea.type !== 'coconut'; }
        function projEmoji(pea) {
            if (pea.emoji) return pea.emoji;
            const m = { ice: '🧊', fire: '🔥', cabbage: '🥬', corn: '🌽', butter: '🧈' }[pea.type]; if (m) return m;
            return ({ coconutcannon:'🥥', peapod:'🟢', melonpult:'🍉', wintermelon:'🍈', rotobaga:'🥔', primalpeashooter:'🪨', primal:'🪨' })[pea.ownerType] || '🟢';
        }
        function syncProjCanvas() {
            if (!projCanvas) return false;
            const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(layerW * dpr), h = Math.round(layerH * dpr);
            if (projCanvas.width !== w || projCanvas.height !== h) { projCanvas.width = w; projCanvas.height = h; }
            projCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            return true;
        }
        let fxBudget = 5;
        const zByRow = [];
        const lawnX = c => ((c + 0.5) / COLS) * 100;
        const rowY = r => ((r + 0.5) / ROWS) * 100;
        function zGlow(z, ms) { z.glowUntil = Date.now() + ms; }
        function mutHit(p, dmg, emoji) {
            if (!p) return;
            p.hp -= dmg; p.hitFlash = true;
            addVisualEffect({ x: lawnX(p.c), y: rowY(p.r), emoji, duration: 520, size: 'text-2xl', className: 'special-attack-effect' });
        }
        // Plant-trait strength grows with zombie level: x1.0 at level 1 up to x3.4 at level 7.
        function mutPower() { return 1 + (clampTier(currentTier) - 1) * 0.4; }
        const MUT_ABILITY_CD = 15000;
        function mutRotoTargets(z) {
            const now = Date.now(), col = zombieCol(z), busy = plants.filter(p => p.tossUntil > now).length;
            return plants.filter(p => p.hp > 0 && !(p.tossUntil > now) && Math.abs(p.r - z.r) <= 1 && Math.abs(p.c - col) <= 2)
                .sort((a, b) => Math.abs(a.c - col) - Math.abs(b.c - col)).slice(0, Math.max(0, 3 - busy));
        }
        // Rotobaga DNA zombie: plants are flung into the air and slammed down for damage (never deleted outright).
        function mutRotoToss(z, list, now, pw) {
            list.forEach((t, i) => {
                const tx = lawnX(t.c), ty = rowY(t.r);
                t.tossUntil = now + 950;
                fxSprite('🌀', tx, ty + 2, tx, ty - 10, { size: 66, duration: 700, spin: 720, delay: i * 60, cls: 'fx-red' });
                afterTicks(19, () => {
                    if (!plants.includes(t) || t.hp <= 0) return;
                    mutHit(t, 120 * pw, '💥'); fxRing(tx, ty, '#ef4444', 100); emitParticles(tx, ty, ['💥', '🪨', '🍃'], 3);
                    playSound('slam'); shakeLawn(2);
                });
            });
            playSound('roto');
        }
        function mutantAbility(z, now) {
            const pw = mutPower() * (z.dmgMul || 1), zy = rowY(z.r), zc = z.x + 4, k = z.mutant, col = fxColor(k === 'tallnut' ? 'wallnut' : k);
            const laneTargets = plants.filter(p => p.r === z.r && p.hp > 0 && lawnX(p.c) < zc + 2);
            const near = (rng, rows) => plants.filter(p => p.hp > 0 && Math.abs(p.r - z.r) <= rows && Math.abs(lawnX(p.c) - zc) < rng);
            const burst = () => { fxRing(zc, zy, col, 120); fxRing(zc, zy, '#fff', 90, { delay: 120, grow: 2.8 }); fxPillar(zc, zy, col); fxLawnFlash(col, .16, 520, zc, zy); fxLabel('🧬 ' + (ZOMBIE_TYPES[z.type] && ZOMBIE_DISPLAY_NAMES[z.type] ? 'MUTATION ABILITY' : 'ABILITY'), zc, zy - 14, col, 15); zAct(z, 'cast', 900); zGlow(z, 1600); };
            const volley = (n, kind, dmg, gap) => { if (zShots.length > 90) return; for (let i = 0; i < n; i++) zShots.push({ id: now + Math.random(), kind, dm: z.dmgMul || 1, r: z.r, x: z.x + 1, px: z.x + 1, y: zy - 2, wait: i * gap, vx: -1.5, emoji: kind === 'gatlingpea' ? PLANT_TYPES.peashooter.emoji : PLANT_TYPES[kind].emoji, dmg }); };
            switch (k) {
                case 'peashooter': if (!laneTargets.length) return false; burst(); volley(10, 'peashooter', 24 * pw, 2); playSound('super'); return true;
                case 'gatlingpea': if (!laneTargets.length) return false; burst(); volley(16, 'gatlingpea', 14 * pw, 1); playSound('super'); return true;
                case 'snowpea': if (!laneTargets.length) return false; burst(); volley(8, 'snowpea', 22 * pw, 2); playSound('super'); return true;
                case 'firepea': if (!laneTargets.length) return false; burst(); volley(8, 'firepea', 22 * pw, 2); playSound('super'); return true;
                case 'sunflower': case 'twinsunflower': { if (sun <= 0) return false; burst(); const amt = Math.round((k === 'twinsunflower' ? 420 : 260) * Math.min(pw, 2)); sun = Math.max(0, sun - amt); updateSunDisplay(); for (let i = 0; i < 5; i++) fxSprite('☀️', 6 + i * 2, 5, z.x + 4, zy - 4, { size: 52, duration: 900, delay: i * 120, spin: 360, cls: 'fx-red' }); addVisualEffect({ x: 8, y: 4, emoji: `-${amt}☀️`, duration: 1100, size: 'text-2xl', className: 'special-attack-effect' }); playSound('steal'); return true; }
                case 'bonkchoy': { const l = near(30, 1); if (!l.length) return false; burst(); l.forEach((p, i) => { fxSprite('🥊', z.x + 2, zy, lawnX(p.c), rowY(p.r), { size: 46, duration: 380, delay: i * 60, spin: -40, cls: 'fx-red' }); mutHit(p, 70 * pw, '💥'); }); shakeLawn(4); playSound('bonk'); return true; }
                case 'firedragon': { const l = near(100, 1); if (!l.length) return false; burst(); l.slice(0, 12).forEach((p, i) => fxSprite('🔥', z.x, zy, lawnX(p.c), rowY(p.r), { size: 52, duration: 600, delay: i * 50, cls: 'fx-red' })); l.forEach(p => { mutHit(p, 60 * pw, '🔥'); p.burnUntil = now + 4000; p.nextBurnTick = now + 500; p.burnDamage = 10 * pw; }); playSound('fire'); return true; }
                case 'snowdragon': { const l = near(100, 1); if (!l.length) return false; burst(); l.slice(0, 12).forEach((p, i) => fxSprite('❄️', z.x, zy, lawnX(p.c), rowY(p.r), { size: 52, duration: 600, delay: i * 50, cls: 'fx-red' })); l.forEach(p => { mutHit(p, 30 * pw, '❄️'); p.frozenUntil = now + 6000; }); playSound('freeze'); return true; }
                case 'rotobaga': { const l = mutRotoTargets(z); if (!l.length) return false; burst(); mutRotoToss(z, l, now, pw * 1.4); return true; }
                case 'blover': { burst(); zombies.forEach((o, i) => { if (o.isTomb || o.isBoss) return; o.speed = Math.min(.4, (o.baseSpeed || o.speed) * 1.7); o.enragedUntil = now + 4500; zGlow(o, 1500); if (i < 8) fxSprite('🍃', z.x + 3, zy, o.x + 4, rowY(o.r), { size: 38, duration: 700, spin: 360, delay: i * 60, cls: 'fx-red' }); }); fxSprite('🌪️', z.x + 4, zy, z.x + 4, zy - 8, { size: 80, duration: 900, spin: 540, cls: 'fx-red' }); playSound('whoosh'); return true; }
                case 'wallnut': case 'tallnut': { if (z.hp > z.maxHp * .85) return false; burst(); z.hp = Math.min(z.maxHp * 1.2, z.hp + z.maxHp * .6); z.maxHp = Math.max(z.maxHp, z.hp); fxSprite('🛡️', zc, zy - 4, zc, zy - 12, { size: 60, duration: 900, spin: 360 }); playSound('thunk'); return true; }
            }
            return false; // cherry bomb / jalapeño / iceberg use their ability when they die (bigger at level 7)
        }
        // =================== Biologist mutations + Mendel gene fusion ===================
        let fusions = [], gameTimers = [], beamActive = 0;
        function afterTicks(n, fn) { const s0 = MST.src; gameTimers.push({ n, fn: s0 ? () => { const o = MST.src; MST.src = s0; try { fn(); } finally { MST.src = o; } } : fn }); }
        function runGameTimers() {
            for (let i = gameTimers.length - 1; i >= 0; i--) {
                const t = gameTimers[i];
                if (--t.n <= 0) { gameTimers.splice(i, 1); try { t.fn(); } catch (err) {} }
            }
        }
        const smooth = u => u * u * (3 - 2 * u);
        // Mutation beam: glowing core + two counter-rotating helix strands + pulsing wave rings around it.
        // Optional o.shrink makes the beam contract while its far end is pulled toward its start.
        function fxBeam(x1, y1, x2, y2, color, duration = 900, o = {}) {
            if (!gameLayerEl || beamActive >= 16) return;
            const W = layerW, H = layerH, ax = x1 * W / 100, ay = y1 * H / 100, bx = x2 * W / 100, by = y2 * H / 100;
            const L = Math.max(10, Math.hypot(bx - ax, by - ay)), ang = Math.atan2(by - ay, bx - ax), amp = o.amp || 10;
            const root = document.createElement('div'); root.className = 'fxs fx-beam' + (o.intense ? ' darwin-beam' : '');
            root.style.width = L + 'px'; root.style.height = '0px'; root.style.setProperty('--rc', color);
            const T = sc => `translate(${ax.toFixed(1)}px,${ay.toFixed(1)}px) rotate(${ang.toFixed(4)}rad) scaleX(${sc.toFixed(3)})`;
            root.style.transform = T(1);
            const core = document.createElement('i'); core.className = 'bm-core'; root.appendChild(core);
            core.animate([{ opacity: .75 }, { opacity: 1 }, { opacity: .6 }, { opacity: 1 }], { duration: 220, iterations: Infinity });
            const cyc = o.intense ? 520 : 1100, iters = Math.max(1, Math.ceil(duration / cyc)) + 1;
            for (let st = 0; st < 2; st++) for (let k = 0; k < 3; k++) {
                const d = document.createElement('i'); d.className = 'bm-dot'; root.appendChild(d);
                const kf = [];
                for (let i = 0; i <= 12; i++) { const u = i / 12; kf.push({ transform: `translate(${(u * L).toFixed(1)}px,${(Math.sin(u * 4 * Math.PI + st * Math.PI) * amp).toFixed(1)}px)`, opacity: (u < .08 || u > .92) ? 0 : 1 }); }
                d.animate(kf, { duration: cyc, iterations: iters, delay: -k * cyc / 3, easing: 'linear' });
            }
            for (let k = 0; k < (o.intense ? 7 : 4); k++) {
                const r = document.createElement('i'); r.className = 'bm-ring'; r.style.left = ((k + .5) / 4 * L).toFixed(1) + 'px'; root.appendChild(r);
                r.animate([{ transform: 'scaleY(.35)', opacity: .3 }, { transform: 'scaleY(1)', opacity: 1 }, { transform: 'scaleY(.35)', opacity: .3 }], { duration: 520, iterations: Infinity, delay: -k * 130, easing: 'ease-in-out' });
            }
            gameLayerEl.appendChild(root); beamActive++;
            const kf = [], N = 10;
            for (let i = 0; i <= N; i++) { const u = i / N; kf.push({ transform: T(o.shrink ? 1 - .9 * smooth(u) : 1), opacity: u < .08 ? u / .08 : (u > .9 ? (1 - u) / .1 : 1), offset: u }); }
            const a = root.animate(kf, { duration, easing: 'linear', fill: 'both' });
            a.onfinish = a.oncancel = () => { root.remove(); beamActive--; };
        }
        const DARWIN_TRAITS = [
            'wallnut','peashooter','sunflower','snowpea','cherrybomb','gatlingpea','tallnut',
            'firepea','bonkchoy','firedragon','twinsunflower','jalapeno','rotobaga',
            'snowdragon','iceberglettuce','blover'
        ];
        const DARWIN_TRAIT_HEADS = {
            wallnut:'🌰',peashooter:'🌱',sunflower:'🌻',snowpea:'❄️',cherrybomb:'🍒',
            gatlingpea:'🔫',tallnut:'🥜',firepea:'🔥',bonkchoy:'🥊',firedragon:'🐉',
            twinsunflower:'🌼',jalapeno:'🌶️',rotobaga:'🍠',snowdragon:'🧊',
            iceberglettuce:'🧿',blover:'🍀'
        };
        function zombiePlantTraits(z) {
            const a = [];
            if (z.mutant) a.push(z.mutant);
            if (z.extraMutant && !a.includes(z.extraMutant)) a.push(z.extraMutant);
            return a;
        }
        function addDarwinTrait(target, trait, now) {
            if (!target || target.hp <= 0 || zombiePlantTraits(target).includes(trait)) return false;
            const t = ZOMBIE_TYPES[({
                wallnut:'wallnutmutant',peashooter:'peamutant',sunflower:'sunmutant',snowpea:'snowpeamutant',
                cherrybomb:'cherrymutant',gatlingpea:'gatlingmutant',tallnut:'tallnutmutant',firepea:'firepeamutant',
                bonkchoy:'bonkmutant',firedragon:'firedragonmutant',twinsunflower:'twinsunmutant',
                jalapeno:'jalapenomutant',rotobaga:'rotobagamutant',snowdragon:'snowdragonmutant',
                iceberglettuce:'icebergmutant',blover:'blowermutant'
            })[trait]];
            if (!t) return false;
            const hm = zombieHealthMult(currentTier), am = zombieAttackMult(currentTier);
            // Keep the zombie's own body stats, then add the complete trait package at its current zombie level.
            const bonusHp = t.maxHp * hm;
            target.hp += bonusHp; target.maxHp += bonusHp;
            target.damage += t.damage * am;
            if ((target.baseSpeed || target.speed) > 0) {
                target.baseSpeed = Math.min(.5, (target.baseSpeed || target.speed) + t.speed * .45);
                target.speed = Math.min(.5, (target.speed || target.baseSpeed) + t.speed * .45);
            }
            if (!target.mutant) {
                target.mutant = trait;
                target.mutationHead = DARWIN_TRAIT_HEADS[trait];
            } else {
                target.extraMutant = trait;
                target.extraMutationHead = DARWIN_TRAIT_HEADS[trait];
            }
            target.evolvedTraits = zombiePlantTraits(target);
            target.darwinEvolved = true;
            target.evolvingUntil = now + 1900;
            target.hitFlash = true;
            target.darwinWhiteUntil = now + 1000000000;
            return true;
        }
        function darwinTick(z, now) {
            if (now < (z.nextEvolution || 0)) return;
            z.nextEvolution = now + 8000;
            const pool = zombies.filter(o => o.id !== z.id && o.hp > 0 && !o.isTomb && !o.isBoss &&
                !o.isMendel && !o.isDarwin && !o.isBiologist && !o.stationary && !o.fusing &&
                zombiePlantTraits(o).length < 2 && o.x < 104);
            if (pool.length < 2) { z.nextEvolution = now + 1800; return; }
            const chosen = pool.slice().sort(() => Math.random() - .5).slice(0, 2);
            const dx = z.x + 4, dy = rowY(z.r);
            zAct(z, 'cast', 1700); zGlow(z, 2200); z.auraUntil = now + 2200;
            fxLabel('🧬 EVOLVING 2 ZOMBIES!', dx, dy - 25, '#fff', 21);
            fxRing(dx, dy, '#fff', 190, { duration: 850 });
            fxRing(dx, dy, '#a5f3fc', 200, { delay: 120, duration: 900, grow: 2.4 });
            fxPillar(dx, dy, '#e0f2fe', { duration: 1050, h: layerH / ROWS * 4, w: 86 });
            fxLawnFlash('#dbeafe', .34, 950, dx, dy);
            fxLabel('🧬 DARWINIAN EVOLUTION', dx - 4, dy - 16, '#fff', 22);
            shakeLawn(3); playSound('roar');
            chosen.forEach((target, index) => {
                let traits = zombiePlantTraits(target);
                if (!traits.length) {
                    const first = DARWIN_TRAITS[(Math.random() * DARWIN_TRAITS.length) | 0];
                    addDarwinTrait(target, first, now);
                    traits = zombiePlantTraits(target);
                }
                const choices = DARWIN_TRAITS.filter(k => !traits.includes(k));
                if (!choices.length) return;
                const second = choices[(Math.random() * choices.length) | 0];
                const tx = target.x + 4, ty = rowY(target.r);
                target.evolvingUntil = now + 1900;
                target.evolvingTrait = second;
                npLine(dx, dy, tx, ty, "#93c5fd", 14, 1500); npLine(dx, dy, tx, ty, '#ffffff', 5, 1500);
                fxRing(tx, ty, '#fff', 130, { duration: 900 });
                fxRing(tx, ty, '#bfdbfe', 190, { delay: 160, duration: 1000, grow: 3.1 });
                fxPillar(tx, ty, '#fff', { duration: 1200, h: layerH / ROWS * 2.8, w: 72 });
                fxLabel('EVOLVING…', tx, ty - 11, '#fff', 17);
                for (let k = 0; k < 3; k++) fxSprite('🧬', tx + (Math.random()-.5)*5, ty - 2, tx + (Math.random()-.5)*8, ty - 8 - Math.random()*7, { size: 30 + Math.random()*18, duration: 850, delay: k*85, spin: 540 });
                afterTicks(38, () => {
                    if (!zombies.includes(target) || target.hp <= 0) return;
                    if (addDarwinTrait(target, second, Date.now())) {
                        target.evolvingUntil = 0;
                        target.evolvedTraits = zombiePlantTraits(target);
                        fxRing(target.x + 4, rowY(target.r), '#fff', 150, { duration: 700 });
                        fxRing(target.x + 4, rowY(target.r), '#bfdbfe', 220, { delay: 100, duration: 850 });
                        fxLabel('EVOLUTION COMPLETE!', target.x + 4, rowY(target.r) - 12, '#fff', 16);
                        emitSpecialParticles(target.x + 3, rowY(target.r), ['🧬','✨','⭐'], 7);
                        playSound('bean');
                    }
                });
            });
        }

        function applyMutation(t, kind) {
            const col = ['green', 'red', 'blue'][kind];
            if (kind === 0) { t.hp *= 1.5; t.maxHp *= 1.5; }
            else if (kind === 1) { if (t.origDamage == null) t.origDamage = t.damage; t.damage = t.origDamage * 2; t.dmgMul = 2; }
            else { t.baseSpeed = Math.min(.5, (t.baseSpeed || t.speed) * 1.5); t.speed = Math.min(.5, t.speed * 1.5); }
            t.mutGlow = col; t.hitFlash = true;
        }
        function biologistTick(z, now) {
            if (now < (z.nextMutate || 0)) return;
            const pool = zombies.filter(o => o.id !== z.id && o.hp > 0 && !o.isTomb && !o.isBoss && !o.fusing && !o.stationary && o.x <= 102);
            if (!pool.length) { z.nextMutate = now + 600; return; }
            const t = pool[(Math.random() * pool.length) | 0];
            let kind = (Math.random() * 3) | 0; if (kind === 2 && !(t.baseSpeed || t.speed)) kind = 0;
            z.nextMutate = now + 8000; zAct(z, 'cast', 900);
            const hex = ['#4ade80', '#ef4444', '#38bdf8'][kind];
            const bx = z.x + 5, by = rowY(z.r) - 1, tx = t.x + 5, ty = rowY(t.r) - 1;
            fxBeam(bx, by, tx, ty, hex, 1000, { amp: 9 }); fxRing(bx, by, hex, 70, { duration: 500 });
            playSound('whoosh');
            afterTicks(12, () => {
                if (!zombies.includes(t) || t.hp <= 0) return;
                applyMutation(t, kind);
                const x = t.x + 5, y = rowY(t.r);
                fxRing(x, y, hex, 100); fxRing(x, y, '#fff', 70, { delay: 100, grow: 2.8 });
                fxLabel(['❤️ +50% HP', '💢 ×2 DAMAGE', '💨 +50% SPEED'][kind], x, y - 12, hex, 16);
                emitSpecialParticles(t.x + 3, y, ['🧬', '✨'], 4); playSound('bean');
            });
        }
        function mendelSelect() {
            const colW = 100 / COLS;
            const pool = zombies.filter(o => o.hp > 0 && !o.isTomb && !o.isBoss && !o.isMendel && !o.noFuse && !o.fusing && !o.stationary && o.x <= 100);
            const inRange = (a, b) => Math.abs(a.r - b.r) <= 1 && Math.abs(a.x - b.x) <= colW;
            const order = pool.slice().sort((a,b) => zombiePlantTraits(b).length - zombiePlantTraits(a).length || Math.random() - .5), groups = [], used = new Set();
            for (const c of order) {
                if (groups.length >= 5) break;
                if (used.has(c.id)) continue;
                const genes = zombiePlantTraits(c);
                const partners = pool.filter(o => {
                    if (o === c || used.has(o.id) || !inRange(c, o)) return false;
                    if (genes.length >= 2) return zombiePlantTraits(o).some(g => genes.includes(g));
                    return o.type === c.type;
                });
                if (!partners.length) continue;
                const members = [c, ...partners];
                // same-type groups must be far apart so they could never pull on each other
                const clash = groups.some(g => g.type === c.type && g.members.some(m => members.some(n => Math.abs(m.r - n.r) <= 2 && Math.abs(m.x - n.x) <= colW * 2.2)));
                if (clash) continue;
                members.forEach(m => used.add(m.id)); groups.push({ type: c.type, leader: c, members });
            }
            return groups;
        }
        function mendelTick(z, now) {
            if (now < (z.nextFuse || 0)) return;
            const groups = mendelSelect();
            if (!groups.length) { z.nextFuse = now + 1500; return; }
            z.nextFuse = now + 8000; z.auraUntil = now + 3200; zAct(z, 'cast', 1400); zGlow(z, 3200);
            const mx = z.x + 5, my = rowY(z.r), P = '#c084fc';
            fxRing(mx, my, P, 150); fxRing(mx, my, '#fff', 110, { delay: 140, grow: 3 }); fxRing(mx, my, P, 190, { delay: 280, grow: 2.6 });
            fxPillar(mx, my, P, { duration: 900, h: layerH / ROWS * 3 }); fxLawnFlash(P, .3, 800, mx, my);
            fxLabel('🧬 GENE FUSION', mx, my - 14, P, 24);
            for (let i = 0; i < 6; i++) fxSprite('🧬', mx, my - 2, mx + Math.cos(i * 1.05) * 9, my + Math.sin(i * 1.05) * 14, { size: 40, duration: 800, delay: i * 90, spin: 360 });
            shakeLawn(3); playSound('roar');
            groups.forEach(g => {
                const L = g.leader, lx = L.x + 5, ly = rowY(L.r);
                fxBeam(mx, my, lx, ly - 1, P, 3000, { amp: 12 });
                const f = { t: 0, dur: 3000, leader: L, partners: g.members.slice(1), tick: 0 };
                g.members.forEach(m => { m.fusing = true; m.fuseHp = m.hp; m.fx0 = m.x; m.r0 = m.r; m.offY = 0; });
                f.partners.forEach(p => fxBeam(lx, ly + 1, p.x + 5, rowY(p.r) + 1, '#e9d5ff', 3000, { amp: 9, shrink: true }));
                fxRing(lx, ly, P, 100); fxLabel('🧲 ATTRACT', lx, ly - 12, '#e9d5ff', 15);
                fusions.push(f);
            });
        }
        function updateFusions(now) {
            for (let i = fusions.length - 1; i >= 0; i--) {
                const f = fusions[i]; f.t += 50; f.tick++;
                const L = f.leader, u = Math.min(1, f.t / f.dur), e = smooth(u);
                f.partners.forEach(p => { p.x = p.fx0 + (L.x - p.fx0) * e; p.offY = (L.r - p.r0) * e; });
                if (f.tick % 12 === 0 && u < 1) {
                    fxRing(L.x + 5, rowY(L.r), '#c084fc', 80 + 50 * u, { duration: 560 });
                    const p = f.partners[(Math.random() * f.partners.length) | 0];
                    if (p) fxSprite('🧬', p.x + 4, rowY(p.r + (p.offY || 0)), L.x + 5, rowY(L.r), { size: 34, duration: 600, spin: 360 });
                }
                if (u < 1) continue;
                fusions.splice(i, 1);
                const members = [L, ...f.partners], n = members.length;
                members.forEach(m => { m.fusing = false; });
                const alive = members.filter(m => zombies.includes(m));
                if (alive.length < 2 || !zombies.includes(L)) { members.forEach(m => { m.r = L.r; m.offY = 0; }); continue; }
                const m0 = Math.max(L.maxHp, L.hp), sp0 = L.baseSpeed || L.speed, dm0 = L.damage, mul0 = L.dmgMul || 1;
                const big = Object.assign({}, L, {
                    id: Date.now() + Math.random(), r: L.r, x: L.x, offY: 0, hp: 1.5 * n * m0, maxHp: 1.5 * n * m0,
                    baseSpeed: Math.min(.45, .7 * n * sp0), speed: Math.min(.45, .7 * n * sp0), damage: n * dm0, dmgMul: mul0 * n, origDamage: null,
                    isCombined: true, noFuse: true, fusing: false, fusedSmall: false, mutGlow: 'purple', isEnergyZombie: false,
                    eating: false, frozenUntil: 0, burnUntil: 0, slowedUntil: 0, slowFactor: 1, enragedUntil: 0, statusEmoji: null, statusExpiresAt: 0,
                    nextMutationAttack: now + 1500, nextMutAbility: undefined, nextMutate: now + 3000, actUntil: 0, glowUntil: 0
                });
                members.forEach((m, k) => {
                    m.hp = Math.max(1, m.hp * .5); m.maxHp *= .5; m.speed *= .5; m.baseSpeed = (m.baseSpeed || m.speed * 2) * .5; m.damage *= .5; m.dmgMul = (m.dmgMul || 1) * .5;
                    m.fusedSmall = true; m.noFuse = true; m.r = L.r; m.offY = 0; m.mutGlow = null; m.x = L.x + (k - (n - 1) / 2) * 2.4;
                    m.slowedUntil = 0; m.slowFactor = 1;
                });
                zombies.push(big);
                const cx = L.x + 5, cy = rowY(L.r);
                fxRing(cx, cy, '#c084fc', 160); fxRing(cx, cy, '#fff', 110, { delay: 120, grow: 3 }); fxRing(cx, cy, '#9333ea', 200, { delay: 240, grow: 2.4 });
                fxPillar(cx, cy, '#c084fc', { duration: 800, h: layerH / ROWS * 2.6 }); fxLawnFlash('#a855f7', .32, 700, cx, cy);
                fxLabel(`🧬 FUSED ×${n}!`, cx, cy - 14, '#e9d5ff', 22);
                emitSpecialParticles(L.x + 3, cy, ['🧬', '💜', '✨', '⭐'], 9); shakeLawn(4); playSound('boom');
            }
        }
        function mutantSpecialAttack(z, now) {
            if (!z.mutant && !z.extraMutant) return;
            // A Darwin-evolved zombie keeps its first trait and independently uses the second trait's attack.
            if (z.extraMutant && !z._runningExtraTrait && now >= (z.nextExtraTraitAttack || 0)) {
                const original = z.mutant, originalCd = z.nextMutationAttack;
                z._runningExtraTrait = true;
                z.mutant = z.extraMutant;
                z.nextMutationAttack = z.nextExtraTraitAttack || 0;
                mutantSpecialAttack(z, now);
                z.nextExtraTraitAttack = z.nextMutationAttack;
                z.mutant = original;
                z.nextMutationAttack = originalCd;
                z._runningExtraTrait = false;
            }
            if (clampTier(currentTier) >= 7 && z.x < 100) {
                if (z.nextMutAbility === undefined) z.nextMutAbility = now + 3500 + Math.random() * 4000;
                else if (now >= z.nextMutAbility) { z.nextMutAbility = now + (mutantAbility(z, now) ? MUT_ABILITY_CD : 2000); }
            }
            if (now < (z.nextMutationAttack || 0)) return;
            const pw = mutPower() * (z.dmgMul || 1);
            const zc = z.x + 4, zy = rowY(z.r);
            const near = (rng, rows) => plants.filter(p => Math.abs(p.r - z.r) <= rows && Math.abs(lawnX(p.c) - zc) < rng).sort((a, b) => Math.abs(lawnX(a.c) - zc) - Math.abs(lawnX(b.c) - zc));
            const cd = ms => { z.nextMutationAttack = now + ms; };
            const red = { cls: 'fx-red' };
            switch (z.mutant) {
                case 'peashooter': case 'gatlingpea': case 'snowpea': case 'firepea': {
                    // Shooter mutants fire along their lane from any distance, like real shooter plants.
                    if (z.x > 98 || !plants.some(p => p.r === z.r && lawnX(p.c) < zc + 2)) return;
                    const k = z.mutant, n = k === 'gatlingpea' ? 4 : 1;
                    cd(k === 'gatlingpea' ? 2900 : 2300); zAct(z, 'recoil', 420); zGlow(z, 700);
                    if (zShots.length < 48) for (let i = 0; i < n; i++) zShots.push({ id: now + Math.random(), kind: k, dm: z.dmgMul || 1, r: z.r, x: z.x + 1, px: z.x + 1, y: zy - 2, wait: i * 3, vx: -1.45, emoji: PLANT_TYPES[k].emoji, dmg: (k === 'gatlingpea' ? 15 : (k === 'peashooter' ? 34 : 30)) * pw });
                    emitSpecialParticles(z.x, zy - 2, k === 'snowpea' ? ['❄️', '✨'] : (k === 'firepea' ? ['🔥', '✨'] : ['💨', '✨']), 3);
                    playSound(k === 'snowpea' ? 'iceshot' : (k === 'firepea' ? 'fireshot' : 'shoot'));
                    return;
                }
                case 'sunflower': case 'twinsunflower': {
                    cd(6200); zAct(z, 'cast', 900); zGlow(z, 1500);
                    const twin = z.mutant === 'twinsunflower', amt = Math.round((twin ? 90 : 55) * Math.min(pw, 2.2));
                    for (let i = 0; i < (twin ? 2 : 1); i++) fxSprite('☀️', 4 + i * 3, 4 + i * 2, z.x + 4, zy - 4, { size: 58, duration: 900, delay: i * 220, spin: 360, cls: 'fx-red' });
                    sun = Math.max(0, sun - amt); updateSunDisplay();
                    addVisualEffect({ x: 8, y: 4, emoji: `-${amt}☀️`, duration: 900, size: 'text-2xl', className: 'special-attack-effect' });
                    playSound('steal'); return;
                }
                case 'bonkchoy': {
                    const target = near(15, 1)[0]; if (!target) return;
                    cd(1050); zAct(z, 'rush', 360); zGlow(z, 500);
                    fxSprite('🥊', z.x + 2, zy, lawnX(target.c), rowY(target.r), { size: 46, duration: 360, spin: -40, ...red });
                    mutHit(target, 44 * pw, '💥'); playSound('bonk'); return;
                }
                case 'firedragon': case 'snowdragon': {
                    const list = near(34, 1); if (!list.length) return;
                    const fire = z.mutant === 'firedragon', em = fire ? '🔥' : '❄️';
                    cd(fire ? 4200 : 4800); zAct(z, 'cast', 700); zGlow(z, 900);
                    list.slice(0, 5).forEach((p, i) => fxSprite(em, z.x, zy, lawnX(p.c), rowY(p.r), { size: 46, duration: 520, delay: i * 70, ...red }));
                    fxSprite(fire ? '🐉' : '🧊', z.x, zy - 6, z.x - 6, zy - 6, { size: 50, duration: 520, ...red });
                    list.forEach(p => {
                        if (fire) { mutHit(p, 34 * pw, '🔥'); p.burnUntil = now + 2800 + (pw - 1) * 500; p.nextBurnTick = now + 500; p.burnDamage = 8 * pw; }
                        else { mutHit(p, 22 * pw, '❄️'); p.frozenUntil = now + 3000 + (pw - 1) * 400; }
                    });
                    playSound(fire ? 'fire' : 'ice'); return;
                }
                case 'rotobaga': {
                    const list = mutRotoTargets(z); if (!list.length) return;
                    cd(7600); zAct(z, 'throw', 700); zGlow(z, 1100);
                    mutRotoToss(z, list, now, pw); return;
                }
                case 'blover': {
                    cd(7000); zAct(z, 'cast', 750); zGlow(z, 1000);
                    const allies = zombies.filter(o => o.id !== z.id && Math.abs(o.r - z.r) <= 1 && Math.abs(o.x - z.x) < 16);
                    allies.forEach((o, i) => { o.speed = Math.min(.34, (o.baseSpeed || o.speed) * 1.5); o.enragedUntil = now + 3000; zGlow(o, 1200); if (i < 4) fxSprite('🍃', z.x + 3, zy, o.x + 4, rowY(o.r), { size: 38, duration: 600, spin: 360, delay: i * 80, ...red }); });
                    fxSprite('🌪️', z.x + 4, zy, z.x + 4, zy - 6, { size: 70, duration: 750, spin: 360, ...red });
                    playSound('whoosh'); return;
                }
            }
        }
        function updateZShots() {
            for (let i = zShots.length - 1; i >= 0; i--) {
                const sh = zShots[i];
                if (sh.wait > 0) { sh.wait--; continue; }
                sh.px = sh.x; sh.x += sh.vx;
                let tgt = null;
                for (const p of plants) { if (p.r === sh.r && p.hp > 0 && Math.abs(lawnX(p.c) - sh.x) < 3.6 && (!tgt || (tgt.type === 'tileturnip' && p.type !== 'tileturnip'))) tgt = p; }
                if (tgt) {
                    mutHit(tgt, sh.dmg, sh.kind === 'snowpea' ? '❄️' : (sh.kind === 'firepea' ? '🔥' : '💥'));
                    if (sh.kind === 'snowpea') { tgt.attackSlowedUntil = Date.now() + 3500 + (mutPower() * (sh.dm || 1) - 1) * 600; tgt.attackSlowFactor = Math.max(.3, .55 - (mutPower() * (sh.dm || 1) - 1) * .06); }
                    if (sh.kind === 'firepea') { tgt.burnUntil = Date.now() + 3000; tgt.nextBurnTick = Date.now() + 500; tgt.burnDamage = 9 * mutPower() * (sh.dm || 1); }
                    emitSpecialParticles(sh.x, sh.y, ['💥', '🔴', '✨'], 3);
                    playSound(sh.kind === 'firepea' ? 'fire' : (sh.kind === 'snowpea' ? 'ice' : 'pea_hit'));
                    zShots.splice(i, 1); continue;
                }
                if (sh.x < -6) zShots.splice(i, 1);
            }
        }
        function makeZShot(sh) {
            const root = makeCellRoot(16, 'ent-proj');
            const tail = document.createElement('i'); tail.className = 'zs-tail';
            const glow = document.createElement('i'); glow.className = 'zs-glow';
            const emo = document.createElement('span'); emo.className = 'zs-emo'; emo.textContent = sh.emoji;
            root.append(tail, glow, emo);
            return { root };
        }
        // =====================================================================================
        // NEW PLANTS (PvZ2-style): Laser Bean, Infi-nut, Magnet-shroom, Thyme Warp, Intensive Carrot,
        // Primal Sunflower, Primal Potato Mine, Bowling Bulb, Grim-rose, Shadow-shroom, Dusk Lobber,
        // Chomper, Sweet Potato, Sap-ling, Electric Blueberry, Electric Peashooter, Torchwood.
        // Every behaviour is event-driven from updateGame(); all visuals are pooled, transform/opacity only.
        // =====================================================================================
        Object.assign(PLANT_FX_COLORS, {
            laserbean:'#f43f5e', infinut:'#38bdf8', magnetshroom:'#ef4444', thymewarp:'#a78bfa', intensivecarrot:'#fb923c',
            primalsunflower:'#f59e0b', primalpotatomine:'#b45309', bowlingbulb:'#84cc16', grimrose:'#be123c', shadowshroom:'#7c3aed',
            dusklobber:'#6366f1', chomper:'#a855f7', sweetpotato:'#f472b6', sapling:'#ca8a04', electricblueberry:'#3b82f6',
            electricpeashooter:'#facc15', torchwood:'#f97316'
        });
        const NP_HIT = { elecpea:'zapsmall', shadow:'shadowhit', dusk:'duskhit', sap:'sapsplat', bowling:'bowlhit' };
        const NP_PROJ = { elecpea:1, shadow:1, dusk:1, sap:1 };
        Object.assign(SFX, {
            laser() { tn(2400, 0.22, { to: 700, type: 'sawtooth', lp: 4200, vol: 0.12 }); tn(1200, 0.3, { to: 300, type: 'square', lp: 3000, vol: 0.07, delay: 0.03 }); nz(0.2, { ft: 'highpass', f1: 5000, vol: 0.09 }); },
            laserbig() { SFX.laser(); [0.15, 0.3, 0.45].forEach(d => { tn(1800, 0.3, { to: 500, type: 'sawtooth', lp: 3800, vol: 0.12, delay: d }); nz(0.25, { ft: 'highpass', f1: 4000, vol: 0.1, delay: d }); }); tn(70, 0.9, { to: 35, vol: 0.4, delay: 0.1 }); },
            clang() { [1760, 2349, 3136].forEach((f, i) => tn(f, 0.4, { type: 'triangle', vol: 0.1, delay: i * 0.012 })); nz(0.06, { ft: 'bandpass', f1: 3500, vol: 0.2 }); tn(300, 0.12, { to: 160, type: 'square', lp: 1200, vol: 0.12 }); },
            magnet() { tn(120, 0.45, { to: 520, type: 'sawtooth', lp: 900, vol: 0.14 }); tn(125, 0.45, { to: 540, type: 'sawtooth', lp: 900, vol: 0.1, detune: 25 }); nz(0.3, { ft: 'bandpass', f1: 800, f2: 2600, vol: 0.08 }); },
            timewarp() { for (let i = 0; i < 10; i++) tn(900 - i * 70, 0.09, { type: 'triangle', delay: i * 0.05, vol: 0.09 }); tn(220, 0.8, { to: 55, type: 'sawtooth', lp: 700, vol: 0.14, delay: 0.1 }); nz(0.7, { ft: 'bandpass', f1: 2400, f2: 300, vol: 0.12 }); tn(1320, 0.3, { delay: 0.5, vol: 0.1 }); tn(660, 0.35, { delay: 0.55, vol: 0.1 }); },
            revive() { [392, 523, 659, 784, 1047].forEach((f, i) => tn(f, 0.35, { type: 'triangle', delay: i * 0.07, vol: 0.14 })); nz(0.4, { ft: 'bandpass', f1: 1500, f2: 4000, vol: 0.06, delay: 0.1 }); },
            primalsun() { tn(330, 0.22, { to: 600, type: 'triangle', vol: 0.16 }); tn(660, 0.3, { delay: 0.08, vol: 0.1 }); tn(990, 0.3, { delay: 0.16, vol: 0.07 }); tn(90, 0.18, { to: 60, vol: 0.25 }); },
            bowl() { nz(0.35, { ft: 'lowpass', f1: 400, vol: 0.28, atk: 0.05 }); tn(95, 0.35, { to: 140, type: 'triangle', vol: 0.18 }); },
            bowlhit() { for (let i = 0; i < 3; i++) { tn(rr(700, 1100), 0.05, { type: 'square', lp: 2500, vol: 0.1, delay: i * 0.035 }); } tn(110, 0.12, { to: 60, vol: 0.3 }); nz(0.06, { ft: 'bandpass', f1: 2000, vol: 0.15 }); },
            thorn() { tn(1300, 0.09, { to: 600, type: 'triangle', vol: 0.12 }); nz(0.08, { ft: 'highpass', f1: 4500, vol: 0.08 }); tn(180, 0.2, { to: 110, type: 'sawtooth', lp: 500, vol: 0.08, delay: 0.05 }); },
            curse() { tn(220, 0.5, { to: 110, type: 'sawtooth', lp: 600, vol: 0.12 }); tn(233, 0.5, { to: 117, type: 'sawtooth', lp: 600, vol: 0.09, detune: 40 }); nz(0.4, { ft: 'bandpass', f1: 500, f2: 150, vol: 0.12 }); },
            shadowshot() { tn(320, 0.2, { to: 80, type: 'sawtooth', lp: 700, vol: 0.13 }); nz(0.15, { ft: 'lowpass', f1: 900, f2: 200, vol: 0.12 }); },
            shadowhit() { tn(150, 0.14, { to: 55, type: 'sawtooth', lp: 500, vol: 0.2 }); nz(0.1, { ft: 'lowpass', f1: 700, vol: 0.14 }); },
            nova() { tn(60, 1, { to: 30, vol: 0.5 }); nz(0.9, { ft: 'lowpass', f1: 1200, f2: 80, vol: 0.4 }); tn(240, 0.8, { to: 60, type: 'sawtooth', lp: 600, vol: 0.14 }); },
            duskhit() { tn(260, 0.18, { to: 80, type: 'triangle', vol: 0.3 }); nz(0.16, { ft: 'lowpass', f1: 1300, f2: 250, vol: 0.28 }); tn(520, 0.12, { to: 200, vol: 0.1, delay: 0.03 }); },
            gulp() { tn(210, 0.12, { to: 90, vol: 0.28 }); tn(180, 0.14, { to: 70, vol: 0.28, delay: 0.14 }); nz(0.12, { ft: 'lowpass', f1: 700, vol: 0.14, delay: 0.05 }); },
            bigchomp() { SFX.chomp(); tn(60, 0.35, { to: 35, vol: 0.5, delay: 0.05 }); nz(0.25, { ft: 'bandpass', f1: 900, f2: 300, vol: 0.2 }); },
            sweet() { [784, 988, 1175, 1568].forEach((f, i) => tn(f, 0.25, { type: 'triangle', delay: i * 0.06, vol: 0.1 })); tn(2093, 0.2, { delay: 0.28, vol: 0.05 }); },
            sapshot() { tn(260, 0.18, { to: 120, vol: 0.2 }); tn(180, 0.2, { to: 340, vol: 0.12, delay: 0.05 }); nz(0.1, { ft: 'bandpass', f1: 600, f2: 1000, vol: 0.1 }); },
            sapsplat() { nz(0.22, { ft: 'lowpass', f1: 1100, f2: 250, vol: 0.34 }); tn(120, 0.2, { to: 60, vol: 0.25 }); tn(300, 0.14, { to: 150, vol: 0.12, delay: 0.04 }); },
            zapsmall() { for (let i = 0; i < 5; i++) tn(rr(500, 2200), 0.03, { type: 'sawtooth', delay: i * 0.022, vol: 0.07, lp: 3500 }); nz(0.1, { ft: 'highpass', f1: 4000, vol: 0.08 }); },
            elecshot() { tn(1100, 0.1, { to: 1800, type: 'square', lp: 3000, vol: 0.08 }); nz(0.05, { ft: 'highpass', f1: 5000, vol: 0.07 }); },
            blueberry() { tn(90, 0.5, { to: 600, type: 'sawtooth', lp: 1200, vol: 0.12 }); SFX.zap(); },
            torch() { nz(0.25, { ft: 'bandpass', f1: 500, f2: 2200, vol: 0.24, atk: 0.03 }); tn(200, 0.18, { to: 420, type: 'sawtooth', lp: 900, vol: 0.1 }); },
            shield() { [660, 880, 1320].forEach((f, i) => tn(f, 0.3, { type: 'triangle', delay: i * 0.05, vol: 0.12 })); nz(0.25, { ft: 'bandpass', f1: 2500, vol: 0.07 }); },
            shieldbreak() { nz(0.25, { ft: 'bandpass', f1: 3500, f2: 800, vol: 0.3 }); [1568, 1175, 880, 660].forEach((f, i) => tn(f, 0.16, { type: 'triangle', delay: i * 0.04, vol: 0.1 })); }
        });

        // ---------- helpers ----------
        const npAlive = z => z.hp > 0 && z.type !== 'tomb' && !z.isTomb;
        const npHeavy = z => z.isBoss || HEAVY_ZOMBIES.includes(z.type);
        const npBoost = p => ((p.tileBoostUntil || 0) > Date.now() ? (p.tileBoost || 1) : 1);
        const NP_DMG = 1.6, NP_SUPPORT = ['primalsunflower', 'intensivecarrot', 'sweetpotato', 'infinut'];
        const npMul = p => NP_DMG * Math.pow(1.3, (p.level || 1) - 1) * npBoost(p);
        const npX = p => lawnX(p.c), npY = p => rowY(p.r);
        let npTorchAllUntil = 0, npLastBurst = 0;
        function npPop(z, syms, n = 3) {
            const t = Date.now();
            if (fxBudget > 0 && t - (z.lastFx || 0) > 170) { z.lastFx = t; fxBudget--; emitParticles(z.x + 2, rowY(z.r), syms, n); }
        }
        function npProj(p, o) {
            const x = npX(p) + 2;
            projectiles.push(Object.assign({ id: Date.now() + Math.random(), r: p.r, ownerType: p.type, ownerLevel: p.level || 1, ownerBoost: npBoost(p), ownerId: p.id, x, px: x, speed: 0.9, hitZombies: [] }, o));
        }
        function npAct(p, ms = 300) { p.lastActionTime = Date.now(); p.shootingAnim = true; setTimeout(() => { p.shootingAnim = false; }, ms); }
        function npPlantsAround(p, rad) { return plants.filter(q => q.hp > 0 && Math.abs(q.r - p.r) <= rad && Math.abs(q.c - p.c) <= rad); }
        function npHeal(q, amt) { if (q.hp <= 0) return; q.hp = Math.min(q.maxHp, q.hp + amt); }
        // Straight energy line (laser / lightning arc). Pooled element, transform + opacity only.
        function npLine(x1, y1, x2, y2, color, thick, ms) {
            const el = fxTake(); if (!el) return;
            const W = layerW, H = layerH, ax = x1 * W / 100, ay = y1 * H / 100, bx = x2 * W / 100, by = y2 * H / 100;
            const L = Math.max(6, Math.hypot(bx - ax, by - ay)), ang = Math.atan2(by - ay, bx - ax);
            el.className = 'fxs np-laser'; el.style.setProperty('--rc', color); el.style.width = L + 'px'; el.style.height = thick + 'px'; el.style.transformOrigin = '0 50%';
            const T = sy => `translate(${ax.toFixed(1)}px,${(ay - thick / 2).toFixed(1)}px) rotate(${ang.toFixed(4)}rad) scaleY(${sy})`;
            gameLayerEl.appendChild(el);
            const a = el.animate([{ transform: T(.1), opacity: 0 }, { transform: T(1), opacity: 1, offset: .16 }, { transform: T(.75), opacity: .9, offset: .6 }, { transform: T(.05), opacity: 0 }], { duration: ms, easing: 'ease-out', fill: 'both' });
            a.onfinish = a.oncancel = () => fxGive(el);
        }
        function npBolt(x1, y1, x2, y2, color, ms = 320) { npLine(x1, y1, (x1 + x2) / 2 + rr(-1.5, 1.5), (y1 + y2) / 2 + rr(-3, 3), color, 5, ms); npLine((x1 + x2) / 2, (y1 + y2) / 2, x2, y2, color, 5, ms); }
        // Curse (Grim-rose / Dusk Lobber): damage over time; a cursed zombie that dies passes the curse on.
        function npCurse(z, now, ms, dps, spreadable = true) {
            z.curseUntil = Math.max(z.curseUntil || 0, now + ms); z.curseDmg = Math.max(z.curseDmg || 0, dps);
            z.nextCurse = Math.min(z.nextCurse || now + 500, now + 500); z.curseSpread = z.curseSpread || spreadable;
            z.statusEmoji = '🥀'; z.statusExpiresAt = z.curseUntil;
        }
        function npShadow(z) { if (z.npShadowed) return; z.npShadowed = true; z.damage = (z.damage || 0) * 0.6; }
        function npKillBlast(z, from) { /* kill hook placeholder (zombie loop removes hp<=0 zombies) */ }

        // Global per-tick upkeep (curse DOT / spread).
        function npUpdate(now) {
            for (let i = 0; i < zombies.length; i++) {
                const z = zombies[i];
                if (!(z.curseUntil > now) || z.hp <= 0 && !z.curseSpread) continue;
                if (now >= (z.nextCurse || 0)) {
                    z.nextCurse = now + 500; z.hp -= (z.curseDmg || 4) * 0.5; z.hitFlash = true;
                    if (fxBudget > 0 && now - (z.lastFx || 0) > 400) { z.lastFx = now; fxBudget--; emitParticles(z.x + 2, rowY(z.r), ['🥀', '🟣'], 1); }
                    if (z.hp <= 0 && z.curseSpread && !z.curseSpent) {
                        z.curseSpent = true;
                        const near = zombies.filter(o => o !== z && npAlive(o) && !(o.curseUntil > now) && Math.abs(o.r - z.r) <= 1 && Math.abs(o.x - z.x) < 20).sort((a, b) => Math.abs(a.x - z.x) - Math.abs(b.x - z.x)).slice(0, 2);
                        near.forEach(o => { npCurse(o, now, 5000, z.curseDmg || 4, true); fxSprite('🥀', z.x + 3, rowY(z.r), o.x + 3, rowY(o.r), { size: 36, duration: 520 }); });
                        if (near.length) { fxRing(z.x + 3, rowY(z.r), '#be123c', 90); playSound('curse'); }
                    }
                }
            }
        }
        // Plant death hook (called from processPlantDeathsAndAirDrops): Intensive Carrot brings the fallen back.
        let npDeadLog = [];
        function npOnPlantDeath(p) {
            if (p._shoveled || p.hp > 0 || p.type === 'intensivecarrot' || p.type === 'thymewarp') return;
            const now = Date.now();
            npDeadLog.push({ p, t: now }); if (npDeadLog.length > 12) npDeadLog.shift();
            const carrot = plants.find(q => q.type === 'intensivecarrot' && q.hp > 0);
            if (!carrot) return;
            npRevive(p, carrot);
        }
        function npRevive(p, carrot) {
            const now = Date.now();
            if (plants.some(q => q.r === p.r && q.c === p.c && q.type !== 'tileturnip')) return false;
            const ratio = Math.min(1, 0.5 + 0.125 * ((carrot && carrot.level) || 1));
            const np = Object.assign({}, p, { id: Date.now() + Math.random(), hp: Math.max(1, p.maxHp * ratio), isNew: true, frozenUntil: 0, burnUntil: 0, lastActionTime: now, shootingAnim: false, armorHp: 0 });
            plants.push(np); setTimeout(() => { np.isNew = false; }, 500);
            if (carrot) {
                fxSprite('🥕', npX(carrot), npY(carrot), npX(p), npY(p), { size: 50, duration: 650, spin: 360 });
                plants = plants.filter(q => q.id !== carrot.id);
            }
            fxPillar(npX(p), npY(p), '#fb923c'); fxRing(npX(p), npY(p), '#86efac', 110); fxLabel('REVIVED!', npX(p), npY(p) - 10, '#86efac', 18);
            emitSpecialParticles(npX(p), npY(p), ['🥕', '💚', '✨', '🌱'], 6); playSound('revive');
            return true;
        }

        // ---------- the plants ----------
        const NEWP = {
            // ---- Laser Bean: instant piercing beam down the whole lane ----
            laserbean: { act: 'anim-np-act', tick(p, now, ready, inLane) {
                if (!inLane || !ready(2400)) return;
                npLaserFire(p, 1);
            }, food(p, sc) {
                for (let k = 0; k < 4; k++) afterTicks(k * 6, () => { if (plants.includes(p)) npLaserFire(p, 3.2 * sc / 3, true); });
                for (let r = 0; r < ROWS; r++) if (r !== p.r) afterTicks(8 + r, () => { npBeamLaneOnly(npX(p) + 2, rowY(r), '#fb7185', 22, 700, 4 * sc * npMul(p) * 8); });
            } },
            // ---- Infi-nut: a force-field wall that recharges forever ----
            infinut: { act: 'anim-np-act', emojiFn: p => (p.armorHp > 0 ? '🛡️' : '♾️'), tick(p, now) {
                const max = 900 * Math.pow(1.6, (p.level || 1) - 1);
                if (p.npInit !== 1) { p.npInit = 1; p.armorHp = max; p.shieldMax = max; }
                p.shieldMax = max;
                if (p.invulnUntil > now) { p.armorHp = max; p.hp = Math.max(p.hp, p.maxHp); return; }
                if (p.armorHp > 0) { p.shieldDown = 0; return; }
                if (!p.shieldDown) { p.shieldDown = now; fxRing(npX(p), npY(p), '#38bdf8', 100); playSound('shieldbreak'); emitParticles(npX(p), npY(p), ['💠', '✨'], 3); return; }
                if (now - p.shieldDown > Math.max(4500, 9000 - 800 * (p.level || 1))) {
                    p.armorHp = max; p.shieldDown = 0; p.shootingAnim = true; setTimeout(() => { p.shootingAnim = false; }, 350);
                    fxRing(npX(p), npY(p), '#7dd3fc', 120, { grow: 2.2 }); emitParticles(npX(p), npY(p), ['🛡️', '💠', '✨'], 3); playSound('shield');
                }
            }, food(p, sc) {
                p.invulnUntil = Date.now() + 8000 * Math.min(2, sc / 1.7 + .4); p.armorHp = p.shieldMax || 900; p.hp = p.maxHp;
                fxRing(npX(p), npY(p), '#38bdf8', 140); fxRing(npX(p), npY(p), '#fff', 100, { delay: 120 }); fxLabel('INVINCIBLE', npX(p), npY(p) - 12, '#7dd3fc', 17);
                // Shockwave: knock back and hurt zombies touching the wall.
                zombies.filter(z => npAlive(z) && Math.abs(z.r - p.r) <= 1 && Math.abs(z.x - npX(p)) < 20).forEach(z => { z.hp -= 90 * sc; z.x = Math.min(100, z.x + 9); z.hitFlash = true; });
            } },
            // ---- Magnet-shroom: rips metal armor / vehicles off zombies ----
            magnetshroom: { act: 'anim-np-act', tick(p, now, ready) {
                if (!ready(4200)) return;
                const metal = z => !z.npMag && npAlive(z) && NP_METAL.includes(z.type) && Math.abs(z.r - p.r) <= 1 && Math.abs(z.x - npX(p)) < 32 && z.x > npX(p) - 8;
                const t = zombies.filter(metal).sort((a, b) => Math.abs(a.x - npX(p)) - Math.abs(b.x - npX(p)))[0];
                if (!t) return;
                npMagnetPull(p, t, 1);
                npAct(p, 420);
            }, food(p, sc) {
                const ts = zombies.filter(z => !z.npMag && npAlive(z) && NP_METAL.includes(z.type));
                ts.slice(0, 10).forEach((z, i) => afterTicks(i * 2, () => npMagnetPull(p, z, 2.4 * sc / 1.7 + 0.6)));
                fxRing(npX(p), npY(p), '#ef4444', 150); fxLawnFlash('#ef4444', .16, 700, npX(p), npY(p)); playSound('magnet');
                // Even non-metal zombies get yanked toward the magnet.
                zombies.filter(z => npAlive(z) && !NP_METAL.includes(z.type) && !npHeavy(z)).forEach(z => { z.x = Math.max(npX(p) + 3, z.x - 10); z.stunnedUntil = Date.now() + 1500; z.statusEmoji = '🧲'; z.statusExpiresAt = z.stunnedUntil; });
            } },
            // ---- Thyme Warp: one-shot time rewind ----
            thymewarp: { act: 'anim-np-act', onPlant(p) { npTimeWarp(p, 1); afterTicks(26, () => { plants = plants.filter(q => q.id !== p.id); }); },
                food(p, sc) { npTimeWarp(p, 1.6); } },
            // ---- Intensive Carrot: revives fallen plants (consumed on use) ----
            intensivecarrot: { act: 'anim-np-act', tick(p, now) {
                if (!p.npInit) { p.npInit = 1; p.lastActionTime = now; }
                if (now - (p.npPulse || 0) > 2600) { p.npPulse = now; if (Math.random() < .35) emitParticles(npX(p), npY(p) - 4, ['💚', '✨'], 1); }
            }, food(p, sc) {
                const now = Date.now();
                plants.forEach(q => { if (q.hp > 0) { npHeal(q, q.maxHp); fxSprite('💚', npX(p), npY(p), npX(q), npY(q), { size: 30, duration: 520 }); } });
                npDeadLog.filter(d => now - d.t < 12000 && !plants.some(q => q.r === d.p.r && q.c === d.p.c)).forEach(d => npRevive(d.p, null));
                npDeadLog = [];
                fxRing(npX(p), npY(p), '#86efac', 150); fxLawnFlash('#86efac', .2, 700);
            } },
            // ---- Primal Sunflower: lots of small suns + a big primal sun every third pulse ----
            primalsunflower: { act: 'anim-np-act', tick(p, now) {
                if (now - p.lastActionTime <= 9000 / (p.attackSlowedUntil > now ? (p.attackSlowFactor || 1) : 1)) return;
                p.lastActionTime = now; p.npCyc = (p.npCyc || 0) + 1;
                const sc = Math.pow(1.18, (p.level || 1) - 1), big = p.npCyc % 3 === 0;
                const mk = (val, dx, dy) => suns.push({ id: Date.now() + Math.random(), x: npX(p) - 2 + dx, y: (p.r / ROWS) * 100 + 2 + dy, val: Math.round(val * sc * 0.7), created: now, expiresAt: now + 11000 });
                mk(35, -2, 0); mk(35, 3, 0);
                if (big) { mk(125, 0.5, -2); fxRing(npX(p), npY(p), '#fbbf24', 120); fxLabel('PRIMAL SUN!', npX(p), npY(p) - 10, '#fde68a', 15); emitSpecialParticles(npX(p), npY(p), ['☀️', '✨', '🔶'], 4); playSound('primalsun'); }
                else playSound('sunpop');
                npAct(p, 420);
            }, food(p, sc) {
                const now = Date.now();
                for (let i = 0; i < 8; i++) afterTicks(i * 2, () => {
                    const a = i / 8 * Math.PI * 2, rx = npX(p) + Math.cos(a) * 6, ry = Math.max(4, Math.min(88, (p.r / ROWS) * 100 + 4 + Math.sin(a) * 9));
                    suns.push({ id: Date.now() + Math.random(), x: rx, y: ry, val: Math.round(40 * sc * sunFoodBonus(p.level)), created: Date.now(), expiresAt: Date.now() + 12000 });
                    fxSprite('☀️', npX(p), npY(p), rx, ry + 2, { size: 34, duration: 460 });
                });
                fxRing(npX(p), npY(p), '#f59e0b', 150); fxLawnFlash('#f59e0b', .18, 700, npX(p), npY(p)); playSound('primalsun');
            } },
            // ---- Primal Potato Mine: fast-arming, big area blast ----
            primalpotatomine: { act: 'anim-np-act', emojiFn: p => (p.armed ? '🥔' : '🌱'), onPlant(p) { p.armTime = Date.now() + 3000; },
                tick(p, now) {
                    if (!p.armed && now >= p.armTime) { p.armed = true; plantParticles(p, ['✨', '🪨', '💫'], 4); fxRing(npX(p), npY(p), '#d97706', 90); playSound('sun'); }
                },
                food(p, sc) {
                    p.armed = true;
                    const ts = zombies.filter(z => npAlive(z)).sort((a, b) => a.x - b.x).slice(0, 6);
                    ts.forEach((z, i) => afterTicks(i * 3, () => { if (z.hp > 0) npPrimalBlast(z.x, z.r, 700 * sc, 330 * sc, z, p); }));
                    fxRing(npX(p), npY(p), '#d97706', 140);
                } },
            // ---- Bowling Bulb: bounces through zombies and across lanes ----
            bowlingbulb: { act: 'anim-np-act', tick(p, now, ready, inLane) {
                if (!inLane || !ready(3000)) return;
                npProj(p, { type: 'bowling', emoji: '🎳', speed: 0.85, maxHits: 5, hits: 0, yOff: 0 });
                npAct(p, 380); plantParticles(p, ['💨', '🟢'], 2); playSound('bowl');
            }, food(p, sc) {
                for (let r = 0; r < ROWS; r++) afterTicks(r * 3, () => {
                    projectiles.push({ id: Date.now() + Math.random(), r, ownerType: 'bowlingbulb', ownerLevel: p.level || 1, ownerBoost: 2, x: npX(p) + 2, px: npX(p) + 2, speed: 1.0, type: 'bowling', emoji: '🎳', maxHits: 12, hits: 0, hitZombies: [], giant: true });
                    playSound('bowl');
                });
                fxRing(npX(p), npY(p), '#84cc16', 130); fxLabel('STRIKE!', npX(p), npY(p) - 10, '#bef264', 18);
            } },
            // ---- Grim-rose: cursing thorns that spread when a cursed zombie dies ----
            grimrose: { act: 'anim-np-act', tick(p, now, ready, inLane) {
                if (!inLane || !ready(2600)) return;
                const t = zombies.filter(z => npAlive(z) && z.r === p.r && z.x > npX(p) - 4).sort((a, b) => a.x - b.x)[0];
                if (!t) return;
                npAct(p, 360); playSound('thorn');
                fxSprite('🥀', npX(p) + 2, npY(p), t.x + 3, rowY(t.r), { size: 38, duration: 420, spin: 540 });
                const dmg = 30 * npMul(p), lvl = p.level || 1;
                afterTicks(8, () => {
                    if (t.hp <= 0) return; t.hp -= dmg; t.hitFlash = true; npCurse(t, Date.now(), 6000 + 500 * lvl, 7 * npMul(p), true);
                    npPop(t, ['🥀', '🟣', '💢'], 3); fxRing(t.x + 3, rowY(t.r), '#be123c', 70); playSound('curse');
                });
            }, food(p, sc) {
                const now = Date.now();
                zombies.filter(z => npAlive(z)).slice(0, 14).forEach((z, i) => afterTicks(i, () => {
                    if (z.hp <= 0) return; z.hp -= 150 * sc; z.hitFlash = true; npCurse(z, Date.now(), 10000, 16 * sc, true);
                    fxSprite('🥀', npX(p), npY(p), z.x + 3, rowY(z.r), { size: 34, duration: 520, spin: 360 });
                }));
                fxRing(npX(p), npY(p), '#be123c', 150); fxLawnFlash('#be123c', .2, 800, npX(p), npY(p)); playSound('curse');
            } },
            // ---- Shadow-shroom: shadow bolts that weaken zombies and heal the plants around ----
            shadowshroom: { act: 'anim-np-act', tick(p, now, ready, inLane) {
                if (!inLane || !ready(2000)) return;
                npProj(p, { type: 'shadow', emoji: '🌑', speed: 0.95 });
                npAct(p, 300); plantParticles(p, ['🌑', '💜'], 2); playSound('shadowshot');
            }, food(p, sc) {
                fxLawnFlash('#312e81', .42, 1000); fxRing(npX(p), npY(p), '#7c3aed', 170, { grow: 3.4, duration: 900 }); fxRing(npX(p), npY(p), '#c4b5fd', 120, { delay: 150, grow: 3 });
                zombies.filter(z => npAlive(z)).forEach(z => { z.hp -= 150 * sc; z.hitFlash = true; npShadow(z); applySlow(z, Date.now(), 6000, 0.55); });
                plants.forEach(q => { if (q.hp > 0) { npHeal(q, q.maxHp * 0.3); } });
                emitSpecialParticles(npX(p), npY(p), ['🌑', '💜', '✨'], 7); playSound('nova'); shakeLawn(3);
            } },
            // ---- Dusk Lobber: lobbed dusk spore that splashes and curses ----
            dusklobber: { act: 'anim-toss', tick(p, now, ready, inLane) {
                if (!inLane || !ready(2800)) return;
                launchLob(p, 'dusk', 0.9);
                const pr = projectiles[projectiles.length - 1]; if (pr && pr.type === 'dusk') pr.emoji = '🌘';
                plantParticles(p, ['🌘', '✨'], 2);
            }, food(p, sc) {
                const ts = zombies.filter(z => npAlive(z)).slice(0, 8);
                ts.forEach((z, i) => afterTicks(i * 3, () => {
                    if (z.hp <= 0) return;
                    fxSprite('🌘', z.x + 3, -6, z.x + 3, rowY(z.r), { size: 54, duration: 520 });
                    afterTicks(10, () => {
                        zombies.filter(o => npAlive(o) && Math.abs(o.r - z.r) <= 1 && Math.abs(o.x - z.x) < 14).forEach(o => { o.hp -= (o === z ? 160 : 80) * sc; o.hitFlash = true; npCurse(o, Date.now(), 5000, 5, true); });
                        fxRing(z.x + 3, rowY(z.r), '#6366f1', 100); emitParticles(z.x + 3, rowY(z.r), ['🌘', '💥', '✨'], 3); playSound('duskhit');
                    });
                }));
                fxLawnFlash('#312e81', .25, 900);
            } },
            // ---- Chomper: swallows a zombie whole, then digests ----
            chomper: { act: 'anim-np-chomp', emojiFn: p => ((p.digestUntil || 0) > Date.now() ? '🤤' : '🦷'), tick(p, now, ready) {
                if ((p.digestUntil || 0) > now) {
                    if (now - (p.npChew || 0) > 900) { p.npChew = now; p.shootingAnim = true; setTimeout(() => { p.shootingAnim = false; }, 260); emitParticles(npX(p), npY(p) - 3, ['💤'], 1); }
                    return;
                }
                if (!ready(1100)) return;
                const t = zombies.filter(z => npAlive(z) && z.r === p.r && z.x > npX(p) - 8 && z.x < npX(p) + 16).sort((a, b) => a.x - b.x)[0];
                if (!t) return;
                npChomp(p, t, 1);
            }, food(p, sc) {
                const ts = zombies.filter(z => npAlive(z)).sort((a, b) => Math.abs(a.x - npX(p)) - Math.abs(b.x - npX(p))).slice(0, 8);
                ts.forEach((z, i) => afterTicks(i * 3, () => { if (z.hp > 0) npChomp(p, z, 2.4 * sc / 1.7, true); }));
                p.digestUntil = Date.now() + 1500; fxRing(npX(p), npY(p), '#a855f7', 150); fxLabel('CHOMP CHOMP!', npX(p), npY(p) - 12, '#e9d5ff', 17);
            } },
            // ---- Sweet Potato: heals the plants around it and slaps with sticky caramel ----
            sweetpotato: { act: 'anim-np-act', tick(p, now, ready) {
                if (now - (p.npHeal || 0) > 2400) {
                    p.npHeal = now;
                    const near = npPlantsAround(p, 1).filter(q => q.hp < q.maxHp);
                    if (near.length) {
                        near.forEach(q => { npHeal(q, q.maxHp * (0.05 + 0.015 * (p.level || 1))); fxSprite('💖', npX(p), npY(p), npX(q), npY(q) - 3, { size: 26, duration: 520 }); });
                        fxRing(npX(p), npY(p), '#f472b6', 110); playSound('sweet'); npAct(p, 350);
                    }
                }
                if (!ready(1400)) return;
                const t = zombies.filter(z => npAlive(z) && z.r === p.r && z.x > npX(p) - 8 && z.x < npX(p) + 14).sort((a, b) => a.x - b.x)[0];
                if (!t) return;
                t.hp -= 32 * npMul(p); t.hitFlash = true; applySlow(t, now, 2200, 0.6); npAct(p, 250);
                npPop(t, ['🍯', '💥', '✨'], 3); fxSprite('🍯', npX(p) + 3, npY(p), t.x + 2, rowY(t.r), { size: 30, duration: 260 }); playSound('smack');
            }, food(p, sc) {
                const now = Date.now(), dur = 8000 * (0.6 + sc / 4);
                plants.forEach(q => { if (q.hp > 0) { q.hp = q.maxHp; q.attackSlowedUntil = now + dur; q.attackSlowFactor = 1.6; fxSprite('🍬', npX(p), npY(p), npX(q), npY(q) - 4, { size: 28, duration: 520 }); } });
                fxRing(npX(p), npY(p), '#f472b6', 150); fxLawnFlash('#f472b6', .2, 800); fxLabel('SUGAR RUSH!', npX(p), npY(p) - 12, '#fbcfe8', 17); playSound('sweet');
            } },
            // ---- Sap-ling: sticky sap that slows everything it splashes ----
            sapling: { act: 'anim-toss', tick(p, now, ready, inLane) {
                if (!inLane || !ready(2600)) return;
                launchLob(p, 'sap', 1.0);
                const pr = projectiles[projectiles.length - 1]; if (pr && pr.type === 'sap') pr.emoji = '🍯';
                plantParticles(p, ['🍯', '🟤'], 2); playSound('sapshot');
            }, food(p, sc) {
                const now = Date.now();
                zombies.filter(z => npAlive(z)).forEach((z, i) => {
                    z.hp -= 70 * sc; z.hitFlash = true; applySlow(z, now, 7000, 0.18); z.statusEmoji = '🍯'; z.statusExpiresAt = now + 7000;
                    if (i < 10) fxSprite('🍯', z.x + 3, -6, z.x + 3, rowY(z.r), { size: 40, duration: 560, delay: i * 40 });
                });
                fxLawnFlash('#ca8a04', .26, 900); fxRing(npX(p), npY(p), '#ca8a04', 140); playSound('sapsplat');
            } },
            // ---- Electric Blueberry: periodic area discharge ----
            electricblueberry: { act: 'anim-np-act', tick(p, now, ready) {
                if (!ready(3300)) return;
                const ts = zombies.filter(z => npAlive(z) && Math.abs(z.r - p.r) <= 1 && Math.abs(z.x - npX(p)) < 26 && z.x > npX(p) - 10);
                if (!ts.length) return;
                const d = 70 * npMul(p);
                ts.forEach((z, i) => { z.hp -= d; z.hitFlash = true; z.stunnedUntil = Math.max(z.stunnedUntil || 0, now + 900); z.statusEmoji = '⚡'; z.statusExpiresAt = now + 900; if (i < 4) npBolt(npX(p), npY(p), z.x + 3, rowY(z.r), '#93c5fd'); npPop(z, ['⚡', '✨'], 2); });
                fxRing(npX(p), npY(p), '#3b82f6', 130); npAct(p, 420); playSound('blueberry');
            }, food(p, sc) {
                const now = Date.now();
                fxLawnFlash('#60a5fa', .4, 700); fxRing(npX(p), npY(p), '#3b82f6', 180, { grow: 3.4 });
                zombies.filter(z => npAlive(z)).forEach((z, i) => { z.hp -= 170 * sc; z.hitFlash = true; z.stunnedUntil = Math.max(z.stunnedUntil || 0, now + 1800); z.statusEmoji = '⚡'; z.statusExpiresAt = now + 1800; if (i < 8) npBolt(z.x + 3, -4, z.x + 3, rowY(z.r), '#bfdbfe', 380); });
                playSound('bigzap'); shakeLawn(3);
            } },
            // ---- Electric Peashooter: stunning peas that arc to a second zombie ----
            electricpeashooter: { act: 'anim-np-act', tick(p, now, ready, inLane) {
                if (!inLane || !ready(1700)) return;
                npProj(p, { type: 'elecpea', emoji: '🟡', speed: 0.9 });
                npAct(p, 260); plantParticles(p, ['⚡', '✨'], 2); playSound('elecshot');
            }, food(p, sc) {
                const now = Date.now();
                zombies.filter(z => npAlive(z)).slice(0, 20).forEach((z, i) => afterTicks(Math.min(i * 2, 24), () => {
                    if (z.hp <= 0) return; z.hp -= 150 * sc; z.hitFlash = true; z.stunnedUntil = Date.now() + 1800; z.statusEmoji = '⚡'; z.statusExpiresAt = z.stunnedUntil;
                    npBolt(npX(p), npY(p), z.x + 3, rowY(z.r), '#fde047', 360); npPop(z, ['⚡', '💥'], 2); playSound('zapsmall');
                    zombies.filter(o => o !== z && npAlive(o) && Math.abs(o.x - z.x) < 20 && Math.abs(o.r - z.r) <= 1).slice(0, 2).forEach(o => { o.hp -= 80 * sc; o.hitFlash = true; o.stunnedUntil = Date.now() + 900; npBolt(z.x + 3, rowY(z.r), o.x + 3, rowY(o.r), '#fde047', 300); });
                }));
                fxRing(npX(p), npY(p), '#facc15', 130); fxLawnFlash('#fde047', .2, 600);
            } },
            // ---- Torchwood: lights every pea that passes through it ----
            torchwood: { act: 'anim-np-act', tick(p, now) {
                if (now - (p.npBurn || 0) > 600) {
                    p.npBurn = now;
                    zombies.forEach(z => { if (z.hp > 0 && z.r === p.r && Math.abs(z.x - npX(p)) < 8 && !z.isTomb) { z.burnUntil = Math.max(z.burnUntil || 0, now + 2500); z.nextBurnTick = Math.min(z.nextBurnTick || now + 500, now + 500); z.burnDamage = Math.max(z.burnDamage || 0, 5 * npMul(p)); z.statusEmoji = '🔥'; z.statusExpiresAt = z.burnUntil; } });
                    if (Math.random() < .3) emitParticles(npX(p), npY(p) - 5, ['🔥'], 1);
                }
            }, food(p, sc) {
                const now = Date.now();
                npTorchAllUntil = now + 9000 * Math.min(1.8, sc / 2 + .5);
                zombies.filter(z => npAlive(z) && z.r === p.r).forEach(z => { z.hp -= 160 * sc; z.hitFlash = true; z.burnUntil = now + 8000; z.nextBurnTick = now + 500; z.burnDamage = Math.max(z.burnDamage || 0, 12 * sc); z.statusEmoji = '🔥'; z.statusExpiresAt = z.burnUntil; });
                fxSprite('🔥', npX(p), npY(p), 98, npY(p), { size: 90, duration: 800 }); fxSprite('🔥', npX(p), npY(p), 98, npY(p) - 4, { size: 60, duration: 900, delay: 100 });
                fxRing(npX(p), npY(p), '#f97316', 150); fxLawnFlash('#f97316', .22, 700); fxLabel('INFERNO PEAS!', npX(p), npY(p) - 12, '#fdba74', 17); playSound('fire');
            } }
        };
        const NP_METAL = ['bucket', 'football', 'barrelroller', 'impcannon', 'jollyroger', 'pyramid'];
        const NP_ALL = Object.keys(NEWP);

        function npBeamLaneOnly(x1, y, color, thick, ms, dmg) {
            npLine(x1, y, 104, y, color, thick, ms);
            if (dmg) zombies.forEach(z => { if (npAlive(z) && Math.abs(rowY(z.r) - y) < 4 && z.x > x1 - 6) { z.hp -= dmg; z.hitFlash = true; npPop(z, ['💥', '✨'], 2); } });
        }
        function npLaserFire(p, mult, big) {
            const x = npX(p) + 2, y = npY(p), dmg = 34 * npMul(p) * mult;
            const ts = zombies.filter(z => npAlive(z) && z.r === p.r && z.x > npX(p) - 5);
            ts.forEach(z => { z.hp -= dmg; z.hitFlash = true; npPop(z, big ? ['🔴', '💥', '✨'] : ['🔴', '✨'], 2); });
            npLine(x, y, 104, y, big ? '#fb7185' : '#f43f5e', big ? 20 : 12, big ? 520 : 380);
            npLine(x, y, 104, y, '#ffffff', big ? 7 : 4, big ? 420 : 300);
            fxRing(x, y, '#f43f5e', 70, { grow: 1.6, duration: 380 });
            npAct(p, 320); playSound(big ? 'laserbig' : 'laser');
            if (ts.length && !big) playSound('pea_hit');
        }
        function npMagnetPull(p, z, mult) {
            z.npMag = true;
            const x = npX(p), y = npY(p), item = z.emoji || '🪣';
            let d = 150;
            if (z.type === 'bucket') d = 165; else if (z.type === 'football') d = 230; else if (z.type === 'pyramid') d = 120;
            else if (z.type === 'barrelroller' || z.type === 'impcannon') { d = 240; z.stunnedUntil = Date.now() + 2200; z.statusEmoji = '🧲'; z.statusExpiresAt = z.stunnedUntil; }
            d *= mult * NP_DMG;
            z.hp -= d; z.hitFlash = true;
            fxSprite('🧲', x, y - 2, z.x + 3, rowY(z.r), { size: 40, duration: 340 });
            fxSprite(item, z.x + 3, rowY(z.r), x, y - 2, { size: 44, duration: 520, delay: 280, spin: 540 });
            if (['bucket', 'football'].includes(z.type) && z.hp > 0) z.emoji = '🧟';
            npPop(z, ['🔩', '✨', '💢'], 3); fxRing(z.x + 3, rowY(z.r), '#ef4444', 80);
            playSound('magnet'); setTimeout(() => playSound('clang'), 260);
            emitParticles(x, y, ['🔩', '⚙️'], 2);
        }
        function npTimeWarp(p, scale) {
            const now = Date.now(), lvl = p.level || 1, x = npX(p), y = npY(p);
            const dur = 3200 + 700 * lvl;
            const hit = zombies.filter(z => npAlive(z) && Math.abs(z.r - p.r) <= (scale > 1 ? ROWS : 1) && (scale > 1 || (z.x > x - 8 && z.x < x + 40)));
            hit.forEach(z => {
                z.hp -= 55 * NP_DMG * Math.pow(1.3, lvl - 1) * scale; z.hitFlash = true;
                if (!npHeavy(z)) z.x = Math.min(100, z.x + 14 * scale);
                z.stunnedUntil = Math.max(z.stunnedUntil || 0, now + dur * (npHeavy(z) ? .5 : 1)); z.statusEmoji = '⏳'; z.statusExpiresAt = z.stunnedUntil;
                fxSprite('⏳', z.x + 3, rowY(z.r) - 2, z.x + 3, rowY(z.r) - 12, { size: 34, duration: 900 });
            });
            // Rewind your own plants as well.
            plants.forEach(q => { if (q.hp > 0 && Math.abs(q.r - p.r) <= (scale > 1 ? ROWS : 1) && Math.abs(q.c - p.c) <= (scale > 1 ? COLS : 1)) { npHeal(q, q.maxHp * 0.35); q.attackSlowedUntil = 0; } });
            fxRing(x, y, '#a78bfa', 120); fxRing(x, y, '#ddd6fe', 90, { delay: 140, grow: 3.4 }); fxRing(x, y, '#7c3aed', 70, { delay: 280, grow: 4.2 });
            fxSprite('🕰️', x, y - 2, x, y - 10, { size: 80, duration: 1000, spin: -360 }); fxLawnFlash('#a78bfa', .3, 900, x, y);
            fxLabel('TIME WARP', x, y - 14, '#ddd6fe', 18); emitSpecialParticles(x, y, ['⏳', '✨', '🕰️'], 6); playSound('timewarp'); shakeLawn(2);
        }
        function npPrimalBlast(zx, zr, dmgMain, dmgSplash, main, plant) {
            dmgMain *= NP_DMG; dmgSplash *= NP_DMG;
            const now = Date.now(), y = rowY(zr);
            zombies.forEach(z => {
                if (!npAlive(z) || Math.abs(z.r - zr) > 1 || Math.abs(z.x - zx) > 19) return;
                const d = z === main ? dmgMain : dmgSplash;
                z.hp -= npHeavy(z) ? d * 0.8 : d; z.hitFlash = true; z.stunnedUntil = Math.max(z.stunnedUntil || 0, now + 1400); z.statusEmoji = '💫'; z.statusExpiresAt = now + 1400;
            });
            addVisualEffect({ x: zx + 2, y, emoji: '💥', duration: 900, size: 'text-5xl sm:text-6xl', className: 'special-attack-effect' });
            emitSpecialParticles(zx + 2, y, ['💥', '🪨', '🥔', '⭐'], 7); fxRing(zx + 3, y, '#f59e0b', 150); fxPillar(zx + 3, y, '#b45309'); fxLawnFlash('#f59e0b', .14, 500, zx, y);
            playSound('boom'); shakeLawn(4);
        }
        function npChomp(p, z, mult, food) {
            const x = npX(p), y = npY(p);
            npAct(p, 420);
            if (npHeavy(z) || z.isBoss) {
                z.hp -= 650 * npMul(p) * mult; z.hitFlash = true;
                npPop(z, ['🦷', '💥'], 3); fxRing(z.x + 3, rowY(z.r), '#a855f7', 90); playSound('bigchomp'); shakeLawn(2);
                p.lastActionTime = Date.now() + 800;
            } else {
                fxSprite(z.emoji || '🧟', z.x + 3, rowY(z.r), x, y, { size: 46, duration: 420, spin: 300 });
                z.hp = 0; z.hitFlash = true; z.swallowed = true;
                emitParticles(z.x + 3, rowY(z.r), ['🦷', '💥', '✨'], 3); fxRing(x, y, '#a855f7', 100);
                if (!food) { p.digestUntil = Date.now() + 12000 / (1 + 0.18 * ((p.level || 1) - 1)); }
                playSound('bigchomp'); setTimeout(() => playSound('gulp'), 380);
            }
        }
        // Projectile hooks -----------------------------------------------------------------
        function npProjHit(pea, z, dmg, now) {
            const y = rowY(z.r);
            if (pea.type === 'elecpea') {
                z.stunnedUntil = Math.max(z.stunnedUntil || 0, now + 400); z.statusEmoji = '⚡'; z.statusExpiresAt = now + 400;
                let prev = z;
                zombies.filter(q => q !== z && npAlive(q) && Math.abs(q.r - z.r) <= 1 && Math.abs(q.x - z.x) < 20).sort((a, b) => Math.abs(a.x - z.x) - Math.abs(b.x - z.x)).slice(0, 2).forEach(o => {
                    o.hp -= dmg * 0.8; o.hitFlash = true; o.stunnedUntil = Math.max(o.stunnedUntil || 0, now + 500); o.statusEmoji = '⚡'; o.statusExpiresAt = now + 500;
                    npBolt(prev.x + 3, rowY(prev.r), o.x + 3, rowY(o.r), '#fde047', 280); npPop(o, ['⚡'], 1); prev = o;
                });
                npPop(z, ['⚡', '✨'], 2);
            } else if (pea.type === 'shadow') {
                npShadow(z); applySlow(z, now, 2000, 0.75); npPop(z, ['🌑', '💜'], 2);
                const sh = plants.find(q => q.id === pea.ownerId);
                if (sh) { npHeal(sh, 6 + 2 * (sh.level || 1)); npPlantsAround(sh, 1).forEach(q => { if (q !== sh) npHeal(q, 3 + (sh.level || 1)); }); if (fxBudget > 0) emitParticles(npX(sh), npY(sh) - 4, ['💜'], 1); }
            } else if (pea.type === 'dusk') {
                npCurse(z, now, 4000, 5, true); npPop(z, ['🌘', '💜', '💥'], 3); fxRing(z.x + 3, y, '#6366f1', 90);
            } else if (pea.type === 'sap') {
                applySlow(z, now, 4500, 0.33); z.statusEmoji = '🍯'; z.statusExpiresAt = now + 4500;
                zombies.forEach(q => { if (q !== z && npAlive(q) && Math.abs(q.r - z.r) <= 1 && Math.abs(q.x - z.x) < 15) applySlow(q, now, 3500, 0.5); });
                npPop(z, ['🍯', '🟤', '💦'], 3); fxRing(z.x + 3, y, '#ca8a04', 90);
            }
        }
        // Bowling Bulb: pierces, knocks back and bounces into a neighbouring lane. Returns true when finished.
        function npBowling(pea, now) {
            pea.yOff = Math.sin(now / 70) * 0.035;
            for (let zi = 0; zi < zombies.length; zi++) {
                const z = zombies[zi];
                if (z.r !== pea.r || !npAlive(z) || pea.hitZombies.includes(z.id)) continue;
                if (Math.abs((z.x + 3) - pea.x) > (z.isBoss ? 9 : 5)) continue;
                const d = 100 * levelAttackMultiplier('bowlingbulb', pea.ownerLevel || 1) * (pea.ownerBoost || 1);
                z.hp -= d; z.hitFlash = true; if (!npHeavy(z)) z.x = Math.min(100, z.x + 2.5);
                pea.hitZombies.push(z.id); pea.hits++;
                npPop(z, ['🎳', '💥', '⭐'], 3); playSound('bowlhit');
                if (pea.hits >= pea.maxHits) return true;
                const opts = [pea.r - 1, pea.r + 1].filter(r => r >= 0 && r < ROWS);
                const withZ = opts.filter(r => zombies.some(q => npAlive(q) && q.r === r && q.x > pea.x));
                const nr = (withZ.length ? withZ : opts)[Math.floor(Math.random() * (withZ.length || opts.length))];
                if (nr != null) { fxSprite('🎳', pea.x, rowY(pea.r), pea.x + 6, rowY(nr), { size: 34, duration: 260, arc: 8, spin: 360 }); pea.r = nr; }
                break;
            }
            return pea.x > 105;
        }
        // Torchwood: ignite ordinary / ice peas as they cross it.
        var _torchNow = -1, _torchRows = {};
        function npTorch(pea, now) {
            if (pea.lob || pea.torched || (pea.type !== 'normal' && pea.type !== 'ice')) return;
            const all = npTorchAllUntil > now;
            if (_torchNow !== now) { _torchNow = now; _torchRows = {}; }
            const torches = all ? [null] : (_torchRows[pea.r] || (_torchRows[pea.r] = plants.filter(q => q.type === 'torchwood' && q.hp > 0 && q.r === pea.r)));
            for (let i = 0; i < torches.length; i++) {
                const q = torches[i], tx = q ? npX(q) : pea.x, a = pea.px == null ? pea.x : pea.px;
                if (q && !(a <= tx && pea.x >= tx)) continue;
                pea.torched = true; pea.type = 'fire'; pea.emoji = '🔥'; if (q) pea.dmgMul = (pea.dmgMul || 1) * (1 + 0.12 * ((q.level || 1) - 1));
                if (fxBudget > 0) { fxBudget--; emitParticles(pea.x, rowY(pea.r), ['🔥', '✨'], 2); }
                if (q) { fxRing(tx, rowY(q.r), '#f97316', 70, { grow: 1.5, duration: 360 }); q.shootingAnim = true; setTimeout(() => { q.shootingAnim = false; }, 220); }
                playSound('torch'); return;
            }
        }
        function npFood(plant, sc) {
            const d = NEWP[plant.type];
            fxRing(npX(plant), npY(plant), fxColor(plant.type), 120);
            if (d && d.food) d.food(plant, NP_SUPPORT.includes(plant.type) ? sc : sc * NP_DMG);
            plant.shootingAnim = true; setTimeout(() => { plant.shootingAnim = false; }, 700);
        }


        const REFLECT_BASE={normal:20,fire:45,ice:20,giantpea:180,butter:40,lightning:28,rotobaga:38,primal:55,elecpea:40,shadow:35,needle:20,'electric-needle':24};
        const REFLECT_EMOJI={ice:'🧊',fire:'🔥',butter:'🧈',lightning:'⚡',elecpea:'⚡',primal:'🪨',shadow:'🌑',giantpea:'🟢',rotobaga:'🥔',needle:'🌵','electric-needle':'⚡'};
        function reflectShot(pea, mirror){
            if(diagShots.length>80)return;
            const ang=(180+(Math.random()*140-70)+(Math.random()<.18?180:0))*Math.PI/180;
            const sp=1.15, ratio=(layerW||1000)/(layerH||600);
            const sx=mirror.x+3, sy=((mirror.r+.5)/ROWS)*100;
            diagShots.push({id:Date.now()+Math.random(),x:sx,y:sy,px:sx,py:sy,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp*ratio,ang:ang*180/Math.PI,refl:true,ptype:pea.type,
              emoji:pea.emoji||REFLECT_EMOJI[pea.type]||projEmoji(pea),ownerType:pea.ownerType||null,ownerLevel:pea.ownerLevel||1,boost:pea.ownerBoost||1,dmgMul:pea.dmgMul||1,mirrorId:mirror.id});
            mirror.mirrorFlashUntil=Date.now()+250;
            if(fxBudget>0){fxBudget--;fxRing(mirror.x+3,sy,'#67e8f9',34,{duration:300,grow:1.6});}
            playSound('hit');
        }
        const REFRACT_SKIP=['coconut','melon','wintermelon','citron','dusk','sap','cabbage','corn','bowling'];

        // Fit the lawn (8:5) into the centre column / whatever vertical space is left, so nothing scrolls.
        function fitLawn(){
            const ps=document.getElementById('playing-screen'), wrap=document.getElementById('lawn-wrap');
            if(!ps||!wrap||ps.classList.contains('hidden'))return;
            const cs=getComputedStyle(ps);
            const padH=parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom), padW=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight);
            let availW, availH;
            if(cs.display==='grid'){
                const cols=cs.gridTemplateColumns.split(' ').map(parseFloat);
                availW=(cols[1]||0)-6; availH=ps.clientHeight-padH-6;
            } else {
                let used=0;
                for(const ch of ps.children){ if(ch===wrap)continue; const c=getComputedStyle(ch); if(c.display==='none'||c.position==='fixed')continue; used+=ch.offsetHeight+parseFloat(c.marginTop)+parseFloat(c.marginBottom); }
                availH=ps.clientHeight-padH-used-4; availW=ps.clientWidth-padW;
            }
            const h=Math.max(150,Math.min(availH,availW/1.6)), w=h*1.6;
            if(wrap._fw!==Math.round(w)){wrap._fw=Math.round(w);wrap.style.width=w+'px';wrap.style.height=h+'px';}
        }
        window.addEventListener('resize',()=>{const w=document.getElementById('lawn-wrap');if(w)w._fw=0;fitLawn();});
        setInterval(fitLawn,400);
        let fundamentalField = null, fieldActiveUntil = 0, fieldCooldownUntil = 0, fieldGrandUntil = 0, fieldLastTick = 0;
        const FIELD_PLANTS = {em:['peashooter','repeater','gatlingpea','snowpea','firepea','laserbean','citron','lightningreed','electricpeashooter'],gravity:['cabbagetosser','corntosser','melonpult','wintermelon','coconutcannon','bonkchoy','squash'],strong:['wallnut','tallnut','endurian','pumpkin','cherrybomb','potatomine','jalapeno','doomshroom'],weak:['sunflower','twinsunflower','sunshroom','iceberglettuce','stallia','blover','magnetshroom','sapling']};
        function activateFundamentalField(mode){
          if(currentLevel<27||Date.now()<fieldCooldownUntil||!isRunning)return;
          if(mode==='grand'){
            if(energyBeans<1){playSound('hit');const st0=document.getElementById('field-status');if(st0)st0.textContent='Grand Unification needs 1 energy bean 🫘';return;}
            energyBeans--;updateEnergyBeanDisplay();
          }
          const now=Date.now(); fundamentalField=mode; fieldActiveUntil=now+accFieldMs(); fieldCooldownUntil=now+30000;
          if(mode==='grand')fieldGrandUntil=now+20000;
          const colors={em:'#38bdf8',gravity:'#f59e0b',strong:'#fb7185',weak:'#c084fc',grand:'#fef08a'};
          const lawn=document.querySelector('#lawn-board')?.parentElement; if(lawn){const wave=document.createElement('div');wave.className='field-wave';wave.style.setProperty('--field-color',colors[mode]||'#fff');lawn.appendChild(wave);setTimeout(()=>wave.remove(),1300);}
          const labels={em:'Railgun acceleration active',gravity:'High-G impact active',strong:'Atomic binding active',weak:'Quantum tunneling active',grand:'GRAND UNIFICATION active'};
          const st=document.getElementById('field-status');if(st)st.textContent=labels[mode]+' · 10 seconds'; updateFieldUI();
        }
        function updateFieldUI(){const panel=document.getElementById('field-resonance');if(panel)panel.style.display=currentLevel>=27?'block':'none';const now=Date.now(),st=document.getElementById('field-status'),bar=document.getElementById('field-bar');document.querySelectorAll('.field-btn').forEach(b=>b.disabled=currentLevel<27||now<fieldCooldownUntil||(b.id==='field-grand-btn'&&energyBeans<1));if(bar){const pct=now<fieldActiveUntil?100*(fieldActiveUntil-now)/accFieldMs():now<fieldCooldownUntil?100*(fieldCooldownUntil-now)/20000:0;bar.style.width=Math.max(0,pct)+'%';bar.style.background=now<fieldActiveUntil?'#22d3ee':'#64748b';}if(st&&now>=fieldActiveUntil&&now<fieldCooldownUntil)st.textContent='Field cooling down · '+Math.ceil((fieldCooldownUntil-now)/1000)+'s';if(st&&now>=fieldCooldownUntil&&currentLevel>=27)st.textContent='Ready · Select a fundamental field';}
        function runWorld4EliteAbilities(now){
          zombies.forEach(z=>{
            if(z.type==='newton_elite'&&z.hp>0){if(!z.nextApple)z.nextApple=now+8000;if(now>=z.nextApple){z.nextApple=now+8000;z.gravityLockUntil=now+3000;zombies.forEach(q=>{if(q!==z)q.knockbackImmuneUntil=now+3000;});projectiles=projectiles.filter(p=>!['melon','cabbage','corn','wintermelon'].includes(p.type));const lawn=document.querySelector('#lawn-board')?.parentElement;if(lawn){const a=document.createElement('div');a.className='field-wave';a.style.setProperty('--field-color','#fbbf24');lawn.appendChild(a);setTimeout(()=>a.remove(),900);}fxRing(50,50,'#fbbf24',220);}}
            if(z.type==='einstein_elite'&&z.hp>0){
              // Boss is a stationary backline threat, but relocates vertically every ten seconds.
              if(!z.nextRowShift)z.nextRowShift=now+10000;
              if(now>=z.nextRowShift){z.nextRowShift=now+10000;const choices=Array.from({length:ROWS},(_,i)=>i).filter(r=>r!==z.r);z.r=(z._preRow!=null&&z._preRow!==z.r)?z._preRow:choices[Math.floor(Math.random()*choices.length)];z._preRow=null;z.rowShiftUntil=now+900;const board=document.querySelector('#lawn-board');if(board){const flash=document.createElement('div');flash.className='einstein-row-flash';flash.style.top=(z.r/ROWS*100)+'%';board.appendChild(flash);setTimeout(()=>flash.remove(),950);}}
              if(!z.nextEinstein)z.nextEinstein=now+9000;if(now>=z.nextEinstein){z.nextEinstein=now+9000;z.timeWaveUntil=now+4000;const lanes=z._preLanes||[...new Set([Math.floor(Math.random()*ROWS),Math.floor(Math.random()*ROWS)])];z._preLanes=null;z.timeLanes=lanes;lanes.forEach(r=>{const lane=document.createElement('div');lane.className='field-lane einstein-cher-wave';lane.style.top=(r/ROWS*100)+'%';lane.style.setProperty('--field-color','#38bdf8');document.querySelector('#lawn-board')?.parentElement?.appendChild(lane);setTimeout(()=>lane.remove(),4000);});}
              if(!z.nextMinions)z.nextMinions=now+12000;if(now>=z.nextMinions){z.nextMinions=now+12000;const pool=['inertia','fma_zombie','newton3_zombie','relativity_zombie','photon_zombie','tesla_zombie','schrodinger_zombie','pendulum','skater_zombie','refractor_zombie'];for(let n=0;n<2;n++){const type=pool[Math.floor(Math.random()*pool.length)],d=ZOMBIE_TYPES[type],row=Math.max(0,Math.min(ROWS-1,z.r+(n?1:-1)));zombies.push({id:Date.now()+Math.random(),r:row,x:100,type,hp:d.hp*.8,maxHp:d.maxHp*.8,speed:d.speed,baseSpeed:d.speed,emoji:d.emoji,damage:d.damage,baseDamage:d.damage,einsteinMinion:true,spawnAt:now+450, eating:false});}fxRing(94,((z.r+.5)/ROWS)*100,'#60a5fa',150);}
              if(!z.nextSingularity)z.nextSingularity=now+14000;if(now>=z.nextSingularity||(!z.halfTriggered&&z.hp<=z.maxHp*.5)){z.halfTriggered=true;z.nextSingularity=now+14000;z.singularityUntil=now+5000;z.singularityX=50;z.singularityY=50;const lawn=document.querySelector('#lawn-board')?.parentElement;if(lawn){const hole=document.createElement('div');hole.className='boss-singularity';hole.style.left='48%';hole.style.top='40%';lawn.appendChild(hole);setTimeout(()=>hole.remove(),5000);}projectiles.forEach(p=>{if(p.lob||['melon','cabbage','corn','wintermelon'].includes(p.type)){p.dmgMul=(p.dmgMul||1)*.5;p.redshiftUntil=now+5000;}else if(['normal','ice','fire','electric','laser','citron','lightning','elecpea'].includes(p.type))p.lensingUntil=now+5000;});}
            }
          });
        }

        function updateGame() {
            const now = Date.now();
            tickPerf = performance.now();
            MST.hook();
            const healthMult = zombieHealthMult(currentTier);
            const attackMult = zombieAttackMult(currentTier);
            if (physicsAnomaly && physicsAnomaly.until <= now) physicsAnomaly = null;
            // Expire temporary effects and uncollected suns without relying on DOM redraws.
            runGameTimers(); updateFusions(now); runWorld4EliteAbilities(now); updateFieldUI();
            visualEffects = visualEffects.filter(effect => effect.expiresAt > now);
            suns = suns.filter(s => (s.expiresAt || ((s.created || now) + 10000)) > now);
            enforceVisualEffectLimits();
            processPlantDeathsAndAirDrops(); npUpdate(now);

            if (now - lastSunDropTime > 8000 && !window.__LESSON) {
                spawnSkySun();
                lastSunDropTime = now;
            }

            if (!tutHold && zombiesSpawned < totalZombiesInWave && now - lastZombieSpawnTime > (4000 / (1 + currentWave * 0.2) / waveRateMul)) {
                spawnZombie();
                lastZombieSpawnTime = now;
            }

            // Update Plants
            plants.forEach(p => {
                MST.begin(p);
                const timeBoss=zombies.find(q=>q.type==='einstein_elite'&&q.hp>0&&now<(q.timeWaveUntil||0)&&q.timeLanes?.includes(p.r));
                if(timeBoss && !p._einsteinTimeTick)p._einsteinTimeTick=now;
                if(!timeBoss)p._einsteinTimeTick=now;
                if((fundamentalField==='strong'&&now<fieldActiveUntil&&FIELD_PLANTS.strong.includes(p.type))||(fundamentalField==='grand'&&now<fieldGrandUntil)){if(['wallnut','tallnut','endurian','pumpkin','infi-nut','infinut'].includes(p.type)){p.maxHp=p.fieldBaseMaxHp||(p.fieldBaseMaxHp=p.maxHp);p.hp=Math.min(p.maxHp*1.4,p.hp+0.45);}}
                if(fundamentalField && now<fieldActiveUntil && (fundamentalField==='grand'||(FIELD_PLANTS[fundamentalField]||[]).includes(p.type))){p.fieldBuffUntil=fieldActiveUntil;p.fieldBuffType=fundamentalField;} else {p.fieldBuffUntil=0;p.fieldBuffType=null;}
                if(p.attackSlowedUntil&&p.attackSlowedUntil<=now){p.attackSlowedUntil=0;p.attackSlowFactor=1;}
                if(p.burnUntil>now&&now>=(p.nextBurnTick||0)){p.hp-=p.burnDamage||5;p.nextBurnTick=now+500;}
                if(p.frozenUntil>now||p.tossUntil>now) return;
                if (p.type === 'potatomine' && !p.armed && now >= p.armTime) {
                    p.armed = true;
                    plantParticles(p, ['✨', '🌟', '💫'], 8);
                    playSound('sun');
                }

                let actionRate=p.attackSlowedUntil>now?(p.attackSlowFactor||.65):1;
                if((currentLevel>=27||window.__REV_ON) && zombies.some(z=>z.relativity && z.hp>0 && z.r===p.r && Math.abs(z.x-(p.c+.5)/COLS*100)<57)) {
                    const anchored=plants.some(a=>['wallnut','tallnut','infinut'].includes(a.type)&&a.r===p.r&&Math.abs(a.c-p.c)<=1);
                    if(!anchored) actionRate*=0.5;
                }
                const actionReady=ms=>now-p.lastActionTime>ms/actionRate;
                const zombieInLane = zombies.some(z => (z.r === p.r) && z.x > (p.c / COLS) * 100 - 2);
                const nearbyLaneTarget = (p.type === 'rotobaga' || p.type === 'lightningreed') ? zombies.some(z => Math.abs(z.r-p.r)<=1 && z.x > (p.c/COLS)*100-2) : false;

                if (NEWP[p.type]) { if (NEWP[p.type].tick) NEWP[p.type].tick(p, now, actionReady, zombieInLane); return; }
                if ((p.type === 'peashooter' || p.type === 'cactus') && zombieInLane && actionReady(1800)) {
                    projectiles.push({
                        id: Date.now() + Math.random(),
                        r: p.r,
                        ownerType: p.type, ownerLevel: p.level || 1,
                        x: ((p.c + 0.5) / COLS) * 100,
                        speed: 0.8,
                        type: p.type === 'cactus' ? (p.electroState ? 'electric-needle' : 'needle') : 'normal',
                        hitZombies: [] // Track pierced targets for needle
                    });
                    playSound(p.type === 'cactus' ? 'needle' : 'shoot');
                    p.lastActionTime = now;
                    p.shootingAnim = true;
                    plantParticles(p, ['✨', '🌟', '💨'], 5);
                    setTimeout(() => { p.shootingAnim = false; }, 250);
                } else if ((p.type === 'cabbagetosser' || p.type === 'corntosser') && zombieInLane && actionReady(p.type === 'cabbagetosser' ? 1800 : 2000)) {
                    launchLob(p, p.type === 'cabbagetosser' ? 'cabbage' : (Math.random() < 0.25 ? 'butter' : 'corn'), 0.9);
                } else if (p.type === 'gatlingpea' && p.combinedWith && fusionHasTarget(p) && actionReady(2000)) {
                    fireFusionVolley(p,false);
                } else if (p.type === 'gatlingpea' && !p.combinedWith && zombieInLane && actionReady(2000)) {
                    for (let shot = 0; shot < 4; shot++) {
                        projectiles.push({
                            id: now + Math.random(), r: p.r, ownerType: p.type, ownerLevel: p.level || 1,
                            x: ((p.c + 0.5) / COLS) * 100, speed: 1.0, type: 'normal',
                            startAt: now + shot * GATLING_SHOT_GAP, snd: shot % 2 === 0 ? 'shoot' : null
                        });
                    }
                    p.lastActionTime = now;
                    p.shootingAnim = true;
                    plantParticles(p, ['✨', '💥', '💨'], 9);
                    setTimeout(() => { p.shootingAnim = false; }, 600);
                } else if (p.type === 'snowpea' && zombieInLane && actionReady(2000)) {
                    projectiles.push({
                        id: Date.now() + Math.random(),
                        r: p.r,
                        ownerType: p.type, ownerLevel: p.level || 1,
                        x: ((p.c + 0.5) / COLS) * 100,
                        speed: 0.8,
                        type: 'ice'
                    });
                    playSound('iceshot');
                    p.lastActionTime = now;
                    p.shootingAnim = true;
                    plantParticles(p, ['✨', '🌟', '💨'], 5);
                    setTimeout(() => { p.shootingAnim = false; }, 250);
                } else if (p.type === 'firepea' && zombieInLane && actionReady(1900)) {
                    projectiles.push({
                        id: Date.now() + Math.random(),
                        r: p.r,
                        ownerType: p.type, ownerLevel: p.level || 1,
                        x: ((p.c + 0.5) / COLS) * 100,
                        speed: 0.9,
                        type: 'fire'
                    });
                    playSound('fireshot');
                    p.lastActionTime = now;
                    p.shootingAnim = true;
                    plantParticles(p, ['✨', '🌟', '💨'], 5);
                    setTimeout(() => { p.shootingAnim = false; }, 250);
                } else if (p.type === 'bonkchoy') {
                    const pl = (p.c / COLS) * 100;
                    const hits = zombies.filter(z => Math.abs(z.r - p.r) <= 1 && Math.abs(z.x - pl) < 21 && !z.isTomb);
                    if (hits.length && actionReady(350)) {
                        const bd = 25 * levelAttackMultiplier(p.type, p.level || 1);
                        hits.forEach(z => { z.hp -= bd; z.hitFlash = true; });
                        playSound('bonk');
                        p.lastActionTime = now;
                        p.shootingAnim = true;
                        plantParticles(p, ['🥊', '💥', '⭐'], 7);
                        setTimeout(() => { p.shootingAnim = false; }, 200);
                    }
                } else if (p.type === 'firedragon') {
                    // Check if enemies are present in the 3 lanes in front of Fire Dragon
                    const inRangeZombies = zombies.filter(z => (Math.abs(z.r - p.r) <= 1) && (z.x - (p.c / COLS) * 100) > -5 && (z.x - (p.c / COLS) * 100) < 40);
                    if (inRangeZombies.length > 0 && actionReady(1600)) {
                        p.lastActionTime = now;
                        p.shootingAnim = true;
                        setTimeout(() => { p.shootingAnim = false; }, 600);
                        playSound('fire');
                        inRangeZombies.forEach(z => {
                            z.hp -= 34.5 * levelAttackMultiplier(p.type, p.level || 1); // Normal attack damage; burning is reserved for the special ability.
                            z.hitFlash = true;
                            emitSpecialParticles(z.x + 2, ((z.r + 0.5) / ROWS) * 100, ['🔥', '✨', '💥'], 4);
                        });

                        const fx = ((p.c + 1) / COLS) * 100;
                        const fy = ((p.r + 0.5) / ROWS) * 100;
                        emitSpecialParticles(fx, fy, ['🔥', '✨', '🟠', '💥'], 11);
                    }
                } else if (p.type === 'snowdragon') {
                    if (zombies.some(z => (Math.abs(z.r - p.r) <= 1) && (z.x - (p.c / COLS) * 100) > -5 && (z.x - (p.c / COLS) * 100) < 40) && actionReady(1600)) playSound('ice');
                    // Check if enemies are present in the 3 lanes in front of Snow Dragon
                    const inRangeZombies = zombies.filter(z => (Math.abs(z.r - p.r) <= 1) && (z.x - (p.c / COLS) * 100) > -5 && (z.x - (p.c / COLS) * 100) < 40);
                    if (inRangeZombies.length > 0 && actionReady(1600)) {
                        p.lastActionTime = now;
                        p.shootingAnim = true;
                        setTimeout(() => { p.shootingAnim = false; }, 600);

                        inRangeZombies.forEach(z => {
                            z.hp -= 16 * levelAttackMultiplier(p.type, p.level || 1); // Normal attack damage; freezing is reserved for the special ability.
                            applySlow(z, now, 2500, 0.5); // Normal attacks slow, but do not freeze.
                            z.hitFlash = true;
                            emitSpecialParticles(z.x + 2, ((z.r + 0.5) / ROWS) * 100, ['❄️', '🧊', '✨'], 4);
                        });

                        const fx = ((p.c + 1) / COLS) * 100;
                        const fy = ((p.r + 0.5) / ROWS) * 100;
                        emitSpecialParticles(fx, fy, ['❄️', '🧊', '✨', '💠'], 11);
                    }
                } else if (p.type === 'spikeweed') {
                    zombies.forEach(z => {
                        if ((z.r === p.r) && Math.abs(z.x - (p.c / COLS) * 100) < 8) {
                            z.hp -= 0.8 * levelAttackMultiplier(p.type, p.level || 1);
                            z.hitFlash = true;
                            if (!p.lastParticleTime || now - p.lastParticleTime > 450) {
                                emitParticles(z.x + 2, ((z.r + 0.5) / ROWS) * 100, ['🌵', '💢', '✨'], 4);
                                p.lastParticleTime = now; playSound('prick');
                            }
                        }
                    });
                } else if (p.type === 'sunflower' || p.type === 'twinsunflower' || p.type === 'sunshroom') {
                    const interval=(p.type==='twinsunflower'?8500:(p.type==='sunshroom'?9500:10000))*((p.fieldBuffType==='weak'||fundamentalField==='grand'&&now<fieldGrandUntil)?0.8:1);
                    if (now - p.lastActionTime > interval) {
                        const base=p.type==='twinsunflower'?115*0.7:(p.type==='sunshroom'?(currentWave<3?15:50):(p.type==='sunflower'?65:50));
                        const amount=Math.round(base*Math.pow(1.18,(p.level||1)-1));
                        for(let n=0;n<(p.type==='twinsunflower'?2:1);n++)suns.push({id:Date.now()+Math.random(),x:(p.c/COLS)*100+2+n*1.5,y:(p.r/ROWS)*100+2,val:amount,created:now,expiresAt:now+10000});
                        p.lastActionTime=now; playSound('sunpop');
                    }
                } else if (p.type === 'peapod' && zombieInLane && actionReady(1800)) {
                    // Each pod fires from its own branch height, staggered so the peas travel with gaps between them.
                    const podCount = Math.min(5, p.podCount || 1), POD_Y = [0.05, 0, -0.04, -0.08, -0.12];
                    const sx = ((p.c + 0.5) / COLS) * 100 + 1.5;
                    for (let shot = 0; shot < podCount; shot++) projectiles.push({id:Date.now()+Math.random(),r:p.r,ownerType:p.type,ownerLevel:p.level||1,x:sx,px:sx,speed:0.85,type:'normal',ownerBoost:(p.tileBoostUntil||0)>now?(p.tileBoost||1):1,hitZombies:[],delay:shot*4,yOff:POD_Y[shot]});
                    p.lastActionTime = now; p.shootingAnim = true;
                    setTimeout(() => { p.shootingAnim = false; }, 500);
                    playSound('shoot');
                } else if ((p.type === 'melonpult' || p.type === 'wintermelon') && zombieInLane && actionReady(2100)) {
                    launchLob(p, p.type === 'melonpult' ? 'melon' : 'wintermelon', 0.95);
                } else if (p.type === 'rotobaga') {
                    if (actionReady(1900)) {
                        const dirs = new Set();
                        zombies.forEach(z => {
                            if (z.isTomb || z.hp <= 0 || z.x > 102) return;
                            const dr = z.r - p.r, dc = zombieCol(z) - p.c;
                            if (dr !== 0 && Math.abs(dr) === Math.abs(dc)) dirs.add(Math.sign(dc) + ',' + Math.sign(dr));
                        });
                        if (dirs.size) {
                            const sx = ((p.c + 0.5) / COLS) * 100, sy = ((p.r + 0.5) / ROWS) * 100;
                            dirs.forEach(d => {
                                const [dx, dy] = d.split(',').map(Number);
                                diagShots.push({ id: Date.now() + Math.random(), x: sx, y: sy, px: sx, py: sy, vx: dx * 1.0, vy: dy * 1.6, ang: Math.atan2(dy * 1.6 * layerH, dx * 1.0 * layerW) * 180 / Math.PI, ownerLevel: p.level || 1, boost: (p.tileBoostUntil || 0) > now ? (p.tileBoost || 1) : 1 });
                            });
                            p.lastActionTime = now; p.shootingAnim = true; playSound('rotoshot');
                            plantParticles(p, ['🌀', '✨'], 3);
                            setTimeout(() => { p.shootingAnim = false; }, 450);
                        }
                    }
                } else if (['citron','primalpeashooter'].includes(p.type) && zombieInLane && actionReady(p.type==='citron'?3600:2100)) {
                    const target=zombies.filter(z=>(p.type==='rotobaga'?Math.abs(z.r-p.r)<=1:z.r===p.r)&&z.x>(p.c/COLS)*100).sort((a,b)=>a.x-b.x)[0];
                    const sx=((p.c+0.5)/COLS)*100;
                    projectiles.push({id:Date.now()+Math.random(),r:p.type==='rotobaga'&&target?target.r:p.r,ownerType:p.type,ownerLevel:p.level||1,x:sx,px:sx,speed:p.type==='citron'?1.2:0.85,type:({citron:'citron',rotobaga:'rotobaga',primalpeashooter:'primal'})[p.type],ownerBoost:(p.tileBoostUntil||0)>now?(p.tileBoost||1):1,hitZombies:[]});
                    p.lastActionTime=now;p.shootingAnim=true;plantParticles(p,['✨','💥'],3);
                    setTimeout(() => { p.shootingAnim = false; }, 450);
                } else if (p.type === 'lightningreed' && actionReady(1800)) {
                    // Lightning Reed only uses its chain lightning (no bullet).
                    if (zapLightningReedTargets(p, 1, 280)) p.lastActionTime = now;
                } else if (p.type === 'spikerock' || p.type === 'spikeweed') {
                    zombies.forEach(z=>{if(z.r===p.r&&Math.abs(z.x-(p.c/COLS)*100)<9){z.hp-=(p.type==='spikerock'?2.2:0.8)*levelAttackMultiplier(p.type,p.level||1);z.hitFlash=true;}});
                } else if (p.type === 'celery') {
                    const celeryX=((p.c+0.5)/COLS)*100, celeryRange=2.7*(100/COLS);
                    const target=zombies.filter(z=>z.r===p.r&&Math.abs(z.x-celeryX)<=celeryRange).sort((a,b)=>Math.abs(a.x-celeryX)-Math.abs(b.x-celeryX))[0];
                    if(target&&actionReady(500)){target.hp-=48*levelAttackMultiplier(p.type,p.level||1);target.hitFlash=true;p.lastActionTime=now;playSound('smack');emitParticles(target.x,((target.r+0.5)/ROWS)*100,['🥬','💥'],3);}
                }
            });

            // Per-tick budgets/buckets keep huge volleys cheap.
            { const _load = projectiles.length + diagShots.length; fxBudget = _load > 250 ? 1 : _load > 140 ? 2 : _load > 60 ? 3 : 5; }
            for (let r = 0; r < ROWS; r++) { if (!zByRow[r]) zByRow[r] = []; zByRow[r].length = 0; }
            for (let zi = 0; zi < zombies.length; zi++) { const zr = zombies[zi].r; if (zByRow[zr]) zByRow[zr].push(zombies[zi]); }
            if (projectiles.length > 320) projectiles.splice(0, projectiles.length - 320);
            if (diagShots.length > 400) diagShots.splice(0, diagShots.length - 400);
            // Scans that used to run once per projectile now run once per tick.
            let _ein = null, _timeB = [], _relZ = [];
            for (let zi = 0; zi < zombies.length; zi++) {
                const q = zombies[zi];
                if (q.type === 'einstein_elite' && q.hp > 0) { if (now < (q.singularityUntil || 0) && !_ein) _ein = q; if (now < (q.timeWaveUntil || 0) && q.timeLanes) _timeB.push(q); }
                if ((currentLevel >= 27 || window.__REV_ON) && q.relativity && q.hp > 0) _relZ.push(q);
            }
            // Update Projectiles
            MST.end();
            for (let i = projectiles.length - 1; i >= 0; i--) {
                let pea = projectiles[i];
                MST.src = pea.ownerType || null;
                if (pea.delay > 0) { pea.delay--; continue; }
                if (pea.startAt) {
                    if (pea.startAt > now) continue;
                    if (!pea.started) { pea.started = true; pea.px = pea.x; if (pea.snd) playSound(pea.snd); }
                }
                if (pea.lob) {
                    pea.px = pea.x; pea.pt = pea.t;
                    pea.t = Math.min(1, pea.t + pea.dt * (physicsAnomaly?.type === 'lowGravity' && currentLevel>=27 ? 0.62 : 1));
                    pea.x = pea.startX + (pea.targetX - pea.startX) * pea.t;
                } else {
                    pea.px = pea.x;
                    let speedFactor = physicsAnomaly?.type === 'lowGravity' && currentLevel>=27 ? 0.62 : 1;
                    const einstein=_ein;
                    if(einstein&&pea.lensingUntil>now){const dx=(einstein.singularityX||50)-pea.x,dy=((einstein.singularityY||50)-((pea.r+.5)/ROWS*100));pea.lensDrift=(pea.lensDrift||0)+Math.sign(dy||1)*.055;pea.r=Math.max(0,Math.min(ROWS-1,pea.r+Math.sign(dy||1)*.018));speedFactor*=Math.max(.15,1-Math.abs(dx)*.012);if(Math.abs(dx)<5){projectiles.splice(i,1);fxRing(einstein.singularityX||50,einstein.singularityY||50,'#c4b5fd',35);continue;}}
                    if(einstein&&pea.redshiftUntil>now)speedFactor*=.72;
                    const timeBoss=_timeB.length?_timeB.find(q=>q.timeLanes.includes(pea.r)):null;if(timeBoss)speedFactor*=.35;
                    if(_relZ.length && _relZ.some(z=>z.r===pea.r&&Math.abs(z.x-pea.x)<57)) speedFactor*=0.55;
                    if((fundamentalField==='em'&&now<fieldActiveUntil&&FIELD_PLANTS.em.includes(pea.ownerType))||(fundamentalField==='grand'&&now<fieldGrandUntil))speedFactor*=1.6;
                    pea.x += pea.speed * speedFactor;
                }
                if (pea.type === 'bowling') { if (npBowling(pea, now)) projectiles.splice(i, 1); continue; }
                npTorch(pea, now);

                if (pea.type === 'needle' || pea.type === 'electric-needle') {
                    // Cactus needles pass through every zombie in their row; electric needles also stun.
                    zombies.forEach(z => {
                        if ((z.r === pea.r) && Math.abs(z.x - pea.x) <= (z.isBoss ? 7 : 4) && !pea.hitZombies.includes(z.id)) {
                            if (z.refractor && (!window.__REV_ON || Math.random() < .5)) { pea.hitZombies.push(z.id); reflectShot(pea, z); return; }
                            z.hp -= (pea.type === 'electric-needle' ? 24 : 20) * levelAttackMultiplier(pea.ownerType || 'cactus', pea.ownerLevel || 1) * ((fundamentalField==='em'&&now<fieldActiveUntil&&FIELD_PLANTS.em.includes(pea.ownerType))|| (fundamentalField==='grand'&&now<fieldGrandUntil)?1.0:1);
                            z.hitFlash = true;
                            if (pea.type === 'electric-needle') {
                                z.stunnedUntil = Math.max(z.stunnedUntil || 0, now + 300);
                                z.statusEmoji = '⚡';
                                z.statusExpiresAt = now + 300;
                                emitSpecialParticles(z.x + 2, ((z.r + 0.5) / ROWS) * 100, ['⚡', '✨'], 3);
                            }
                            pea.hitZombies.push(z.id);
                            playSound(hitSoundFor(pea.type));
                        }
                    });
                    if (pea.x > 105 || pea.x < -5) {
                        projectiles.splice(i, 1);
                    }
                    continue;
                }

                let hitZombie;
                if (pea.lob) {
                    if (pea.t < 1) continue;
                    // Landed: strike whichever zombie in the lane is closest to the impact point.
                    let bd = Infinity;
                    zombies.forEach(z => {
                        if (z.r !== pea.r || z.hp <= 0) return;
                        const d = Math.abs((z.x + (z.isBoss ? 4 : 2)) - pea.x);
                        if (d <= (z.isBoss ? 12 : 9) && d < bd) { bd = d; hitZombie = z; }
                    });
                    if (!hitZombie) {
                        addVisualEffect({ x: pea.x, y: ((pea.r + 0.55) / ROWS) * 100, emoji: '💨', duration: 320, size: 'text-xl', className: 'spark-effect' });
                        projectiles.splice(i, 1);
                        continue;
                    }
                } else {
                    // Swept test (previous -> current position) so fast shells can never skip over a zombie,
                    // and the shell starts at the cannon's left edge so zombies chewing on it are always hit.
                    const segL = Math.min(pea.px == null ? pea.x : pea.px, pea.x), segR = Math.max(pea.px == null ? pea.x : pea.px, pea.x);
                    const isShell = pea.type === 'coconut';
                    let bestX = Infinity;
                    const rowZ = zByRow[pea.r] || zombies;
                    for (let zi = 0; zi < rowZ.length; zi++) {
                        const z = rowZ[zi];
                        if (z.r !== pea.r || z.x >= bestX) continue;
                        if (isShell && (z.hp <= 0 || z.x > 112)) continue;
                        if (segR >= z.x - (z.isBoss ? 8 : 4) && segL <= z.x + (z.isBoss ? 10 : 8)) { hitZombie = z; bestX = z.x; }
                    }
                }

                if (hitZombie && hitZombie.refractor && (!window.__REV_ON || Math.random() < .5) && !pea.lob && !pea.reflected && !REFRACT_SKIP.includes(pea.type) && !pea.comboSplash) {
                    reflectShot(pea, hitZombie);
                    projectiles.splice(i, 1);
                    continue;
                }
                if (hitZombie) {
                    let dmg = (pea.type === 'normal' && pea.ownerType === 'peashooter') ? 26 : 20;
                    if (pea.lob && physicsAnomaly?.type === 'lowGravity' && currentLevel>=27) dmg *= 1.25;
                    if (pea.type === 'fire') {
                        dmg = 45;
                    } else if (pea.type === 'ice') {
                        dmg = 20;
                        hitZombie.speed = Math.max(0.04, ZOMBIE_TYPES[hitZombie.type].speed * 0.5);
                    } else if (pea.type === 'giantpea') { dmg = 180; } else if (pea.type === 'butter') {
                        dmg = 40;
                        hitZombie.speed = 0; // Stuns zombie
                        setTimeout(() => {
                            if (hitZombie && ZOMBIE_TYPES[hitZombie.type]) {
                                hitZombie.speed = hitZombie.slowedUntil > Date.now() ? (hitZombie.baseSpeed ?? ZOMBIE_TYPES[hitZombie.type].speed) * (hitZombie.slowFactor || 0.5) : (hitZombie.baseSpeed ?? ZOMBIE_TYPES[hitZombie.type].speed);
                            }
                        }, 2000);
                    } else if (pea.type === 'cabbage') {
                        dmg = 40;
                    } else if (pea.type === 'corn') {
                        dmg = 20;
                    } else if (pea.type === 'coconut') { dmg=160; }
                    else if (pea.type === 'melon') { dmg=95; }
                    else if (pea.type === 'wintermelon') { dmg=80; }
                    else if (pea.type === 'citron') { dmg=260; }
                    else if (pea.type === 'lightning') { dmg=28; }
                    else if (pea.type === 'rotobaga') { dmg=38; }
                    else if (pea.type === 'primal') { dmg=55; } else if (pea.type==='elecpea') { dmg=40; } else if (pea.type==='shadow') { dmg=35; } else if (pea.type==='dusk') { dmg=112; } else if (pea.type==='sap') { dmg=45; }

                    if (pea.ownerType && pea.ownerLevel) dmg *= levelAttackMultiplier(pea.ownerType, pea.ownerLevel) * (pea.ownerBoost || 1) * (pea.dmgMul || 1);
                    if(((fundamentalField==='em'&&now<fieldActiveUntil&&FIELD_PLANTS.em.includes(pea.ownerType))||(fundamentalField==='grand'&&now<fieldGrandUntil)) && ['bucket','football','pyramid','fma_zombie','newton_elite','einstein_elite'].includes(hitZombie.type))dmg*=1.25;
                    if(((fundamentalField==='gravity'&&now<fieldActiveUntil&&FIELD_PLANTS.gravity.includes(pea.ownerType))||(fundamentalField==='grand'&&now<fieldGrandUntil))&&pea.lob)dmg*=1.15;
                    if(hitZombie.camelShield && !hitZombie.shieldBroken){dmg*=0.55;if(hitZombie.hp<hitZombie.maxHp*0.5){hitZombie.shieldBroken=true;hitZombie.emoji='🧟';}}
                    dmg *= (hitZombie.damageTakenMultiplier||1); hitZombie.hp -= dmg;
                    if(hitZombie.newton3) hitZombie.damageAbsorbedTotal=(hitZombie.damageAbsorbedTotal||0)+dmg;
                    if(hitZombie.mass && !hitZombie.frozenUntil) hitZombie.x=Math.max(0,hitZombie.x-0.18);
                    if(hitZombie.newton3 && !pea.lob && !['melon','wintermelon','coconut','citron'].includes(pea.type)) {
                        hitZombie.x=Math.min(100,hitZombie.x+0.65);
                        const rocketReach=7;
                        const lanePlant=plants.filter(p=>p.r===hitZombie.r&&p.c<Math.floor(hitZombie.x/100*COLS)&&Math.abs(hitZombie.x-(p.c+.5)/COLS*100)<rocketReach*100/COLS).sort((a,b)=>b.c-a.c)[0];
                        if(lanePlant){const rocketDamage=(18+(hitZombie.damageAbsorbedTotal||0)*.12)*attackMult;lanePlant.hp-=rocketDamage;lanePlant.hitFlash=true;fxRing((lanePlant.c+.5)/COLS*100,((lanePlant.r+.5)/ROWS)*100,'#fb923c',65,{duration:360,grow:2.1});emitSpecialParticles(hitZombie.x-2,((hitZombie.r+.5)/ROWS)*100,['🔥','🚀'],4);}
                    }
                    if(hitZombie.tesla && ['lightning','elecpea','electric-needle'].includes(pea.type)) hitZombie.charge=(hitZombie.charge||0)+1.5;
                    if (NP_PROJ[pea.type]) npProjHit(pea, hitZombie, dmg, now);
                    if (pea.type === 'primal' && !pea.comboSplash && !hitZombie.mass) { if(hitZombie.skater)hitZombie.x=100;else {hitZombie.x=Math.min(100,hitZombie.x+5);applySlow(hitZombie,now,1800,0.55);} }
                    if(pea.bigPrimal&&fxBudget>0){fxBudget--;fxRing(hitZombie.x+3,((hitZombie.r+.5)/ROWS)*100,'#a3e635',150,{duration:420,grow:2});playSound('slam');}
                    if(pea.comboSplash){
                        // The hit zombie AND every zombie within one block (all directions) get the status effect.
                        const kind=pea.comboSplash, hz=hitZombie;
                        for(let zi=0;zi<zombies.length;zi++){
                            const z=zombies[zi];
                            const near=pea.bigPrimal?(z===hz||(Math.abs(z.r-hz.r)<=1&&Math.abs(zombieCol(z)-zombieCol(hz))<=1)):(z===hz||(Math.abs(z.r-hz.r)<=1&&Math.abs(z.x-hz.x)<13));
                            if(!near||z.hp<=0)continue;
                            if(z!==hz){z.hp-=dmg*.45;z.hitFlash=true;}
                            if(kind==='slow')applySlow(z,now,2800,.58);
                            else if(kind==='burn'){z.burnUntil=Math.max(z.burnUntil||0,now+3000);z.nextBurnTick=Math.min(z.nextBurnTick||now+500,now+500);z.burnDamage=Math.max(z.burnDamage||0,5);z.statusEmoji='🔥';z.statusExpiresAt=z.burnUntil;}
                            else if(kind==='primal'){if(pea.bigPrimal||Math.random()<.2){if(z.skater)z.x=100;else if(!z.mass)z.x=Math.min(100,z.x+(pea.bigPrimal?6:(z===hz?3:2)));z.stunnedUntil=now+350;z.statusEmoji='💫';z.statusExpiresAt=now+350;}else applySlow(z,now,2200,.55);}
                        }
                    }
                    if (pea.type === 'giantpea' && !hitZombie.mass) { if(hitZombie.skater)hitZombie.x=100;else {hitZombie.x=Math.min(100,hitZombie.x+8);applySlow(hitZombie,now,1200,0.7);} }
                    if (pea.type === 'wintermelon') applySlow(hitZombie,now,3500,0.45);
                    if (pea.type === 'lightning') { hitZombie.stunnedUntil=now+350; }
                    if (['coconut','melon','wintermelon','citron','dusk','sap'].includes(pea.type)) {
                        zombies.filter(z=>z.id!==hitZombie.id&&Math.abs(z.r-hitZombie.r)<=1&&Math.abs(z.x-hitZombie.x)<15).forEach(z=>{z.hp-=dmg*0.45;z.hitFlash=true;if(pea.type==='wintermelon')applySlow(z,now,2500,0.55);});
                    }
                    if(pea.type==='rotobaga'){zombies.filter(z=>Math.abs(z.r-hitZombie.r)===1&&Math.abs(z.x-hitZombie.x)<7).forEach(z=>{z.hp-=dmg*0.6;});}
                    hitZombie.hitFlash = true;
                    playSound(hitSoundFor(pea.type));
                    const fxOk = fxBudget > 0 && (now - (hitZombie.lastFx || 0)) > 170; if (fxOk) { hitZombie.lastFx = now; fxBudget--; }
                    if (fxOk) (pea.type === 'fire' || pea.type === 'ice') ? emitSpecialParticles(hitZombie.x + 2, ((hitZombie.r + 0.5) / ROWS) * 100, pea.type === 'fire' ? ['🔥', '✨', '💥'] : ['❄️', '🧊', '✨'], 5) : emitParticles(hitZombie.x + 2, ((hitZombie.r + 0.5) / ROWS) * 100, ['💥', '⭐', '💢'], 2);

                    if (hitZombie.type === 'newspaper' && !hitZombie.enraged && hitZombie.hp <= hitZombie.maxHp * (120 / 167)) {
                        hitZombie.enraged = true;
                        hitZombie.baseSpeed = 0.28;
                        hitZombie.speed = hitZombie.slowedUntil > Date.now() ? 0.28 * (hitZombie.slowFactor || 0.5) : 0.28;
                        hitZombie.emoji = '😡'; zAct(hitZombie, 'rage', 800);
                        playSound('rip');
                    }

                    if (fxOk) addVisualEffect({
                        x: hitZombie.x,
                        y: (hitZombie.r / ROWS) * 100,
                        emoji: pea.type === 'fire' ? '🔥' : (pea.type === 'ice' ? '❄️' : '💥'),
                        duration: 300,
                        size: 'text-xl',
                        className: 'spark-effect'
                    });
                    if (fxOk && (pea.type === 'fire' || pea.type === 'ice')) {
                        addVisualEffect({
                            x: hitZombie.x + 2,
                            y: ((hitZombie.r + 0.5) / ROWS) * 100,
                            emoji: pea.type === 'fire' ? '🔥' : '🧊',
                            duration: 720,
                            size: 'text-3xl sm:text-4xl',
                            className: 'special-attack-effect'
                        });
                    }

                    projectiles.splice(i, 1);
                    continue;
                }

                if (pea.x > (pea.type === 'coconut' ? 125 : 105)) {
                    projectiles.splice(i, 1);
                }
            }

            MST.src = null;
            updateZShots();
            // Rotobaga diagonal shots travel in a true diagonal line and strike the first zombie on the route.
            for (let i = diagShots.length - 1; i >= 0; i--) {
                const sh = diagShots[i];
                MST.src = sh.ownerType || (sh.combo ? 'gatlingpea' : 'rotobaga');
                if (sh.startAt) { if (sh.startAt > now) continue; if (!sh.started) { sh.started = true; sh.px = sh.x; sh.py = sh.y; if (sh.snd) playSound(sh.snd); } }
                sh.px = sh.x; sh.py = sh.y; sh.x += sh.vx; sh.y += sh.vy;
                const row = Math.floor(sh.y / (100 / ROWS));
                const hz = (zByRow[row] || []).find(z => !z.isTomb && z.hp > 0 && z.r === row && !(sh.refl && z.refractor) && Math.abs((z.x + (z.isBoss ? 9 : 4)) - sh.x) < (z.isBoss ? 10 : 6));
                if (hz && sh.refl) {
                    const t=sh.ptype;
                    let d=(REFLECT_BASE[t]||20);
                    if(t==='normal'&&sh.ownerType==='peashooter')d=26;
                    if(sh.ownerType)d*=levelAttackMultiplier(sh.ownerType,sh.ownerLevel)*(sh.boost||1)*(sh.dmgMul||1);
                    d*=(hz.damageTakenMultiplier||1);
                    hz.hp-=d;hz.hitFlash=true;
                    if(t==='ice')applySlow(hz,now,2800,.5);
                    else if(t==='fire'){hz.burnUntil=Math.max(hz.burnUntil||0,now+2500);hz.nextBurnTick=Math.min(hz.nextBurnTick||now+500,now+500);hz.burnDamage=Math.max(hz.burnDamage||0,5);hz.statusEmoji='🔥';hz.statusExpiresAt=hz.burnUntil;}
                    else if(t==='butter'){hz.stunnedUntil=Math.max(hz.stunnedUntil||0,now+1500);hz.statusEmoji='🧈';hz.statusExpiresAt=now+1500;}
                    else if(t==='lightning'||t==='elecpea'||t==='electric-needle'){hz.stunnedUntil=Math.max(hz.stunnedUntil||0,now+350);hz.statusEmoji='⚡';hz.statusExpiresAt=now+350;if(hz.tesla)hz.charge=(hz.charge||0)+1.5;}
                    else if(t==='primal'&&!hz.mass&&!hz.skater){hz.x=Math.min(100,hz.x+4);hz.stunnedUntil=Math.max(hz.stunnedUntil||0,now+350);}
                    else if(t==='giantpea'&&!hz.mass&&!hz.skater){hz.x=Math.min(100,hz.x+6);applySlow(hz,now,1200,.7);}
                    if (fxBudget > 0 && now - (hz.lastFx || 0) > 170) { hz.lastFx = now; fxBudget--; emitParticles(hz.x + 3, ((hz.r + 0.5) / ROWS) * 100, t==='fire'?['🔥','💥']:t==='ice'?['❄️','✨']:['💥','✨'], 2); }
                    playSound(hitSoundFor(t));
                    diagShots.splice(i, 1); continue;
                }
                if (hz) {
                    const d=sh.combo?(sh.dmg||20)*levelAttackMultiplier('gatlingpea',sh.ownerLevel):38*levelAttackMultiplier('rotobaga',sh.ownerLevel);
                    hz.hp-=d*(sh.boost||1);hz.hitFlash=true;
                    if (fxBudget > 0 && now - (hz.lastFx || 0) > 170) { hz.lastFx = now; fxBudget--; emitParticles(hz.x + 3, ((hz.r + 0.5) / ROWS) * 100, sh.combo?['💥']:['🥔', '💥', '✨'], sh.combo?1:4); }
                    playSound(sh.combo?'pea_hit':'thunk');
                    diagShots.splice(i, 1); continue;
                }
                if (sh.x < -6 || sh.x > 106 || sh.y < -6 || sh.y > 106) diagShots.splice(i, 1);
            }

            MST.src = null;
            // Update Zombies
            for (let i = zombies.length - 1; i >= 0; i--) {
                let z = zombies[i];
                // Zombies mid-fusion are frozen in place, do nothing and cannot be hurt.
                if (z.fusing) { z.hp = z.fuseHp; z.eating = false; continue; }
                // v65: stationary elites (Mendel, Darwin, Hawking, Newton, Einstein) stay exactly where they spawned,
                // whatever pushes, pulls, speed boosts or knockbacks hit them.
                if (z.stationary && !z.isTomb && !window.__REV_ON) { if (z._homeX == null) z._homeX = z.x; z.x = z._homeX; z.speed = 0; z.eating = false; }

                // World 4: classical mechanics, relativity, quantum effects and optics.
                if(z.inertia && !z.eating) {
                    z.speed=Math.min(0.34,(z.inertiaSpeed||z.baseSpeed||.055)+Math.max(0,z.momentum||0));
                    z.momentum=Math.min(.5,(z.momentum||0)+.0018);
                }
                if(z.pendulum) {
                    z.pendulumPhase=(z.pendulumPhase||0)+.075;
                    const forward=Math.sin(z.pendulumPhase)>0;
                    z.speed=(z.baseSpeed||.15)*(forward?2.5:.45);
                    z.damage=forward?(z.baseDamage||64)*3:(z.baseDamage||64);
                    if(!forward) z.damageTakenMultiplier=1.35; else z.damageTakenMultiplier=1;
                }
                if(z.skater) {
                    if(z.slowedUntil>now){z.slowedUntil=0;z.slowFactor=1;z.speed=z.baseSpeed||.19;}
                }
                if(z.photon && now >= (z.nextBlink||0) && !z.eating) {
                    const tallBlock=plants.some(p=>p.r===z.r&&p.type==='tallnut'&&p.c>z.x/100*COLS);
                    if(!tallBlock){z.x=Math.max(0,z.x-(window.__REV_ON?24:45));z.nextBlink=now+(window.__REV_ON?6000:3000);emitSpecialParticles(z.x,z.r*20+10,['✨','🔦'],5);z.statusEmoji='✨';z.statusExpiresAt=now+500;}
                    else z.nextBlink=now+1400;
                }
                if(z.tesla && (z.charge||0)>=3 && now >= (z.nextSpecial||0)) {
                    plants.filter(p=>Math.abs(p.r-z.r)<=2&&Math.abs(p.c-z.x/100*COLS)<=4).forEach(p=>{p.attackSlowedUntil=now+(window.__REV_ON?1600:2500);p.attackSlowFactor=(window.__REV_ON?.3:.01);p.hitFlash=true;});
                    z.charge=0;z.nextSpecial=now+7000;fxRing(z.x,z.r*20+10,'#38bdf8',300,{duration:700,grow:2.5});emitSpecialParticles(z.x,z.r*20+10,['⚡','🧲','💥'],8);
                }
                if(z.hawking && now >= (z.nextSpecial||0)) {
                    const cx=48, cy=((ROWS/2)+.5)/ROWS*100;
                    projectiles=projectiles.filter(p=>{if(Math.abs(p.x-cx)<18&&Math.abs(p.r-ROWS/2)<=1){emitParticles(p.x,((p.r+.5)/ROWS)*100,['🕳️'],1);return false;}return true;});
                    zombies.filter(o=>o.id!==z.id&&o.hp>0&&Math.abs(o.x-48)<48).forEach(o=>{o.x=Math.max(0,o.x-5.5);});
                    z.nextSpecial=now+9000;fxRing(cx,cy,'#a78bfa',210);emitSpecialParticles(cx,cy,['🕳️','✨'],9);
                }
                if(z.relativity && now >= (z.nextSpecial||0)){z.nextSpecial=now+1000;emitParticles(z.x,((z.r+.5)/ROWS)*100,['🪐','✦'],2);}
                if(z.mass && now >= (z.lastPhysicsTick||0)+2200){z.lastPhysicsTick=now;fxRing(z.x+3,((z.r+.5)/ROWS)*100,'#94a3b8',34,{duration:420,grow:1.8});}
                if(z.tesla && now >= (z.lastPhysicsTick||0)+1700){z.lastPhysicsTick=now;emitSpecialParticles(z.x+2,((z.r+.5)/ROWS)*100,['⚡','✧'],2);}
                if(z.refractor && now >= (z.lastPhysicsTick||0)+1900){z.lastPhysicsTick=now;fxRing(z.x+3,((z.r+.5)/ROWS)*100,'#67e8f9',30,{duration:460,grow:2.2});}
                // World 2 enemy mechanics: cannons launch imps, tombs raise enemies, wranglers release chickens.
                if (z.type === 'impcannon' && now >= (z.lastSpecialSpawn||0) && zombies.length < 30) {
                    const t=ZOMBIE_TYPES.imp;zombies.push({id:Date.now()+Math.random(),r:z.r,x:z.x-3,type:'imp',hp:t.hp*healthMult,maxHp:t.maxHp*healthMult,speed:t.speed,baseSpeed:t.speed,emoji:t.emoji,damage:t.damage*attackMult,eating:false});z.lastSpecialSpawn=now+6500;zAct(z,'recoil',450);playSound('cannonfire');emitSpecialParticles(z.x,z.r*20+10,['💣','👶','✨'],3);
                }
                if (z.type === 'barrelroller' && !z.barrelBroken) { z.speed=Math.max(z.speed,0.20); }
                if (RUNNER_ZOMBIES.includes(z.type) && !z.eating && now - (z.lastDust || 0) > 460) { z.lastDust = now; emitParticles(z.x + 6, ((z.r + 0.88) / ROWS) * 100, ['💨'], 1); }
                if (HEAVY_ZOMBIES.includes(z.type) && !z.eating && now - (z.lastStep || 0) > 1100) { z.lastStep = now; playSound('step'); }
                if (z.type === 'tomb' && now >= (z.lastSpecialSpawn||0) && zombies.length < 30) {
                    const spawnType=Math.random()<0.65?'basic':'camel',t=ZOMBIE_TYPES[spawnType];zombies.push({id:Date.now()+Math.random(),r:z.r,x:z.x-2,type:spawnType,hp:t.hp*healthMult,maxHp:t.maxHp*healthMult,speed:t.speed,baseSpeed:t.speed,emoji:t.emoji,damage:t.damage*attackMult,eating:false});z.lastSpecialSpawn=now+7000;playSound('rumble');emitSpecialParticles(z.x,z.r*20+10,['🪦','💀','✨'],3);
                }
                if (z.type === 'tombraiser' && now >= (z.lastSpecialSpawn||0) && zombies.length < 30) {
                    const tomb=ZOMBIE_TYPES.tomb;zombies.push({id:Date.now()+Math.random(),r:z.r,x:Math.max(12,z.x-10),type:'tomb',hp:tomb.hp*healthMult,maxHp:tomb.maxHp*healthMult,speed:0,baseSpeed:0,emoji:tomb.emoji,damage:0,lastSpecialSpawn:now+5000,eating:false});z.lastSpecialSpawn=now+9500;zAct(z,'cast',700);playSound('rumble');
                }
                if (z.type === 'chickenwrangler' && now >= (z.lastSpecialSpawn||0) && zombies.length < 30) {
                    const t=ZOMBIE_TYPES.chicken;for(let n=0;n<2;n++)zombies.push({id:Date.now()+Math.random(),r:z.r,x:z.x-2-n,type:'chicken',hp:t.hp*healthMult,maxHp:t.maxHp*healthMult,speed:t.speed,baseSpeed:t.speed,emoji:t.emoji,damage:t.damage*attackMult,eating:false});z.lastSpecialSpawn=now+8000;zAct(z,'throw',600);playSound('cluck');
                }
                if (z.type === 'zombiebull' && now >= (z.lastSpecialSpawn||0)) { z.speed=Math.max(z.speed,0.34);z.lastSpecialSpawn=now+4200;zAct(z,'rush',900);playSound('snort'); }
                if (z.type === 'pianist' && now >= (z.lastSpecialSpawn||0)) { zombies.filter(other=>other.id!==z.id&&Math.abs(other.r-z.r)<=1&&Math.abs(other.x-z.x)<24).forEach(other=>{other.speed=Math.min(0.32,(other.baseSpeed||other.speed)*1.5);other.enragedUntil=now+2500;});z.lastSpecialSpawn=now+7000;zAct(z,'play',1000);playSound('piano');emitSpecialParticles(z.x,z.r*20+10,['🎵','🎹','✨'],4); }
                if (z.isTomb) { z.speed=0;z.damage=0; }
                if (z.isBarrel && z.hp < z.maxHp*0.48 && !z.barrelBroken) { z.barrelBroken=true;zAct(z,'burst',500);playSound('slam');z.emoji='👶';z.type='imp';z.speed=ZOMBIE_TYPES.imp.speed;z.baseSpeed=z.speed;z.damage=ZOMBIE_TYPES.imp.damage*attackMult;emitSpecialParticles(z.x,z.r*20+10,['🛢️','💥','👶'],7); }
                if (z.enragedUntil>now) z.speed=Math.max(z.speed,(z.baseSpeed||z.speed)*1.5);
                // Restore normal movement when Snow Dragon's temporary slow expires.
                if (z.slowedUntil && z.slowedUntil <= now) {
                    z.speed = z.baseSpeed ?? ZOMBIE_TYPES[z.type]?.speed ?? z.speed;
                    z.slowedUntil = 0;
                    z.slowFactor = 1;
                }

                // Burning deals damage over time; freezing pauses all zombie actions for 3 seconds.
                if (z.burnUntil > now && now >= (z.nextBurnTick || 0)) {
                    z.hp -= (z.burnDamage || 8);
                    z.nextBurnTick = now + 500;
                    emitSpecialParticles(z.x + 2, ((z.r + 0.5) / ROWS) * 100, ['🔥'], 1);
                }
                if (z.frozenUntil > now && z.hp > 0) {
                    z.eating = false;
                    continue;
                }
                mutantSpecialAttack(z,now);
                if (!window.__REV_ON) { wzAbility(z, now, healthMult, attackMult); wzPreExisting(z, now); }
                if (z.isBiologist) biologistTick(z, now);
                if (z.isMendel) mendelTick(z, now);
                if (z.isDarwin) darwinTick(z, now);

                if (z.hp <= z.maxHp / 2 && ['gargantuar','gargantuarpirate','mummygargantuar','wildwestgargantuar'].includes(z.type) && z.hasImp) {
                    z.hasImp = false;
                    emitParticles(z.x, ((z.r + 0.5) / ROWS) * 100, ['💥', '👶', '✨'], 12);
                    zAct(z, 'throw', 700); playSound('roar'); shakeLawn(4);
                    // Throw an Imp zombie 3 columns ahead (same zombie level as the rest of the stage)
                    zombies.push({
                        id: Date.now() + Math.random(),
                        r: z.r,
                        x: Math.max(10, z.x - 30),
                        type: 'imp',
                        hp: ZOMBIE_TYPES.imp.hp * healthMult,
                        maxHp: ZOMBIE_TYPES.imp.maxHp * healthMult,
                        speed: ZOMBIE_TYPES.imp.speed,
                        baseSpeed: ZOMBIE_TYPES.imp.speed,
                        emoji: ZOMBIE_TYPES.imp.emoji,
                        damage: ZOMBIE_TYPES.imp.damage * attackMult,
                        eating: false
                    });
                }

                if (z.hp <= 0 && z.schrodinger && !z.quantumResolved) {
                    z.quantumResolved=true;
                    if(Math.random()<0.5){z.hp=-999;emitSpecialParticles(z.x,z.r*20+10,['📦','✨'],10);}
                    else {z.hp=z.maxHp*.55;z.speed=(z.baseSpeed||.13)*2.5;z.baseSpeed=z.speed;z.damage=(z.baseDamage||64)*4;z.emoji='😼';z.schrodinger=false;z.quantumEnraged=true;emitSpecialParticles(z.x,z.r*20+10,['📦','💥','😼'],9);}
                }
                if (z.hp <= 0) {
                    if(z.mutant==='cherrybomb'||z.mutant==='jalapeno'||z.mutant==='iceberglettuce'){
                        const pw=mutPower()*(z.dmgMul||1), L7=clampTier(currentTier)>=7, zyy=((z.r+.5)/ROWS)*100, dn=Date.now();
                        const dcol=fxColor(z.mutant);
                        fxRing(z.x+3,zyy,dcol,L7?190:120);fxRing(z.x+3,zyy,'#fff',100,{delay:120,grow:2.8});fxLawnFlash(dcol,L7?.3:.16,560,z.x+3,zyy);
                        if(L7)fxLabel('🧬 LEVEL 7 ABILITY',z.x+3,zyy-12,dcol,16);
                        if(z.mutant==='cherrybomb'){
                            const rows=L7?2:1,cols=L7?2.4:1.35;
                            plants.filter(p=>Math.abs(p.r-z.r)<=rows&&Math.abs(p.c-(z.x/100*COLS))<=cols).forEach(p=>{p.hp-=165*pw*(L7?1.3:1);p.hitFlash=true;});
                            emitSpecialParticles(z.x,zyy,['🍒','💥','🔥'],12);shakeLawn(L7?8:5);playSound('boom');
                            addVisualEffect({x:z.x+3,y:zyy,emoji:'💥',duration:800,size:'text-6xl',className:'special-attack-effect'});
                            for(let q=0;q<(L7?10:6);q++)fxSprite('🍒',z.x+3,zyy,z.x+3+Math.cos(q*(L7?.63:1.05))*(L7?26:16),zyy+Math.sin(q*(L7?.63:1.05))*(L7?30:20),{size:36,duration:600,cls:'fx-red'});
                        } else if(z.mutant==='jalapeno'){
                            const rowsOk=p=>L7?Math.abs(p.r-z.r)<=1:p.r===z.r;
                            plants.filter(rowsOk).forEach(p=>{p.hp-=90*pw;p.hitFlash=true;p.burnUntil=dn+3200+(pw-1)*500;p.nextBurnTick=dn+500;p.burnDamage=10*pw;});
                            playSound('fire');for(let rr2=(L7?-1:0);rr2<=(L7?1:0);rr2++){const ry=z.r+rr2;if(ry<0||ry>=ROWS)continue;for(let q=0;q<7;q++)fxSprite('🔥',z.x+3,((ry+.5)/ROWS)*100,Math.max(0,z.x-q*14),((ry+.5)/ROWS)*100,{size:46,duration:700,delay:q*60,cls:'fx-red'});}
                        } else {
                            const rowsOk=p=>L7?Math.abs(p.r-z.r)<=1:p.r===z.r;
                            plants.filter(rowsOk).forEach(p=>{p.hp-=20*pw;p.frozenUntil=dn+4500+(pw-1)*800;p.hitFlash=true;});
                            playSound('freeze');for(let rr2=(L7?-1:0);rr2<=(L7?1:0);rr2++){const ry=z.r+rr2;if(ry<0||ry>=ROWS)continue;for(let q=0;q<7;q++)fxSprite('🧊',z.x+3,((ry+.5)/ROWS)*100,Math.max(0,z.x-q*14),((ry+.5)/ROWS)*100,{size:44,duration:700,delay:q*60,cls:'fx-red'});}
                        }
                    }
                    // Drop Energy Bean if Energy Zombie
                    if (z.isEnergyZombie) {
                        energyBeanDrops.push({
                            id: Date.now() + Math.random(),
                            x: z.x,
                            y: (z.r / ROWS) * 100 + 2
                        });
                        playSound('bean');
                    }

                    emitParticles(z.x + 2, ((z.r + 0.5) / ROWS) * 100, ['💀', '✨', '💥', '⭐'], 10);
                    const deadEl = document.createElement('div');
                    deadEl.className = 'absolute text-3xl sm:text-4xl pointer-events-none anim-zombie-die z-30';
                    deadEl.style.left = `${z.x}%`;
                    deadEl.style.top = `${(z.r / ROWS) * 100}%`;
                    deadEl.textContent = '💀';
                    if (gameLayerEl) gameLayerEl.appendChild(deadEl);
                    setTimeout(() => deadEl.remove(), 600);

                    zombies.splice(i, 1);
                    playSound(HEAVY_ZOMBIES.includes(z.type) ? 'roar' : 'zdie');
                    zombiesKilled++; missionAdd('kills', 1); runXP.kills += killXP(z);
                    if (zombiesKilledEl) zombiesKilledEl.textContent = zombiesKilled;
                    continue;
                }

                // Zomboss patrols vertically through every lane, so plants in each row
                // can target the boss while it occupies that lane.
                if (z.isBoss) {
                    if (now >= (z.nextBossMove || 0)) {
                        z.r += z.bossMoveDirection || 1;
                        if (z.r >= ROWS - 1) { z.r = ROWS - 1; z.bossMoveDirection = -1; }
                        else if (z.r <= 0) { z.r = 0; z.bossMoveDirection = 1; }
                        z.nextBossMove = now + 1250;
                        emitSpecialParticles(z.x - 3, ((z.r + 0.5) / ROWS) * 100, ['⚙️', '💨'], 2);
                    }
                    // Resolve an attack only after its visible telegraph / travel animation.
                    if (z.bossAttackState && now >= z.bossAttackState.resolveAt) {
                        const state = z.bossAttackState;
                        if (state.type === 'stomp') {
                            plants.filter(p => p.r === state.lane).forEach(p => { p.hp -= 115 * attackMult; p.hitFlash = true; });
                            emitSpecialParticles(50, ((state.lane + 0.5) / ROWS) * 100, ['💥', '⚙️', '🟠'], 12);
                            addVisualEffect({ x: 50, y: ((state.lane + 0.5) / ROWS) * 100, emoji: '💥', duration: 800, size: 'text-6xl', className: 'special-attack-effect' });
                            plants = plants.filter(p => p.hp > 0);
                            playSound('boom');
                            z.bossAttackState = null;
                        } else if (state.type === 'rocket') {
                            if (state.targetId != null) {
                                const target = plants.find(p => p.id === state.targetId);
                                if (target) { target.hp -= 260 * attackMult; target.hitFlash = true; }
                            }
                            emitSpecialParticles(state.targetX, state.targetY, ['🔥', '💥', '✨'], 12);
                            addVisualEffect({ x: state.targetX, y: state.targetY, emoji: '💥', duration: 850, size: 'text-5xl sm:text-6xl', className: 'special-attack-effect' });
                            plants = plants.filter(p => p.hp > 0);
                            playSound('boom');
                            z.bossAttackState = null;
                        }
                    }

                    if (!z.bossAttackState && now >= z.nextBossAttack) {
                        const lane = Math.floor(Math.random() * ROWS);
                        const lanePlants = plants.filter(p => p.r === lane);
                        const attack = z.bossAttackIndex % 3;
                        z.bossAttackIndex++;
                        z.nextBossAttack = now + 5600;

                        if (attack === 0) {
                            // Telegraph the lane, then have Zomboss charge across it before impact.
                            z.bossAttackState = { type: 'stomp', lane, startedAt: now, resolveAt: now + 1450, duration: 1450 };
                            emitSpecialParticles(86, ((lane + 0.5) / ROWS) * 100, ['⚠️', '⚙️'], 5);
                        } else if (attack === 1) {
                            // Mark the selected plant first; the rocket visibly launches and travels to it.
                            const target = lanePlants.filter(p => p.c >= 2).sort((a, b) => b.c - a.c)[0];
                            if (target) {
                                const targetX = ((target.c + 0.5) / COLS) * 100;
                                const targetY = ((lane + 0.5) / ROWS) * 100;
                                z.bossAttackState = { type: 'rocket', lane, targetId: target.id, targetX, targetY, startedAt: now, launchAt: now + 1050, resolveAt: now + 1750, duration: 1750, bossX: z.x - 3, bossY: ((z.r + 0.5) / ROWS) * 100 };
                            } else {
                                z.bossAttackState = { type: 'rocket', lane, targetId: null, targetX: 10, targetY: ((lane + 0.5) / ROWS) * 100, startedAt: now, launchAt: now + 800, resolveAt: now + 1450, duration: 1450, bossX: z.x - 3, bossY: ((z.r + 0.5) / ROWS) * 100 };
                            }
                        } else {
                            // Summon minions (scaled to this zombie level); some arrive as Energy Zombies and drop an Energy Bean on death.
                            [0, 1, 2].forEach((_, idx) => {
                                const minionRow = (lane + idx * 2) % ROWS;
                                const minionType = Math.random() < 0.5 ? 'basic' : 'cone';
                                const minion = ZOMBIE_TYPES[minionType];
                                const isEnergyZombie = Math.random() < 0.2;
                                const eHp = isEnergyZombie ? 1.25 : 1, eDmg = isEnergyZombie ? 1.3 : 1;
                                zombies.push({ id: Date.now() + Math.random(), r: minionRow, x: 94 + idx * 2,
                                    type: minionType, hp: minion.hp * healthMult * eHp,
                                    maxHp: minion.maxHp * healthMult * eHp,
                                    speed: minion.speed, baseSpeed: minion.speed, emoji: minion.emoji,
                                    damage: minion.damage * attackMult * eDmg,
                                    eating: false, isBossMinion: true, isEnergyZombie });
                            });
                            emitSpecialParticles(82, 50, ['⚙️', '💨', '🧟'], 7);
                            playSound('boom');
                        }
                    }
                    continue;
                }

                if (z.type === 'disco' && now - z.lastDanceTime > 6000) {
                    z.lastDanceTime = now; zAct(z, 'dance', 1000);
                    playSound('funk');
                    [-1, 1].forEach(offset => {
                        const targetR = z.r + offset;
                        if (targetR >= 0 && targetR < ROWS) {
                            zombies.push({
                                id: Date.now() + Math.random(),
                                r: targetR,
                                x: z.x + 2,
                                type: 'basic',
                                hp: 80 * healthMult,
                                maxHp: 80 * healthMult,
                                speed: 0.1,
                                baseSpeed: 0.1,
                                emoji: '🕺',
                                damage: 24.0 * attackMult,
                                eating: false
                            });
                        }
                    });
                }

                // Electric cactus shots briefly interrupt all zombie actions.
                if (now < (z.stunnedUntil || 0)) {
                    z.eating = false;
                } else {
                const targetPlant = (z.isTomb || z.stationary) ? null : plants.find(p =>
                    p.r === z.r &&
                    Math.abs((p.c / COLS) * 100 - z.x) < 4.5 &&
                    (p.type !== 'spikerock' || z.isBoss || SPIKEROCK_TARGET_ZOMBIES.includes(z.type))
                );

                if (targetPlant) {
                    if (z.canVault && !z.vaulted) {
                        z.vaulted = true;
                        z.x -= 12;
                        z.baseSpeed = 0.1;
                        z.speed = z.slowedUntil > now ? 0.1 * (z.slowFactor || 0.5) : 0.1;
                        zAct(z, 'vault', 560); playSound('vault');
                    } else if (targetPlant.type === 'spikeweed') {
                        z.eating = false;
                        z.x -= z.speed;
                    } else if (targetPlant.type === 'garlic') {
                        // zombies now really bite the garlic; after two bites it shoves them to a random adjacent lane (never wrapping)
                        z.eating = true;
                        if (!z.lastBiteTime || now - z.lastBiteTime >= 1000) {
                            let gb = z.damage;
                            if (targetPlant.armorHp > 0) { const ab = Math.min(targetPlant.armorHp, gb); targetPlant.armorHp -= ab; gb -= ab; }
                            targetPlant.hp -= gb; targetPlant.hitFlash = true;
                            emitParticles(((targetPlant.c + 0.5) / COLS) * 100, ((targetPlant.r + 0.5) / ROWS) * 100, ['🧄', '💜', '✨'], 4);
                            playSound('chomp'); z.lastBiteTime = now; z._garlicBites = (z._garlicBites || 0) + 1;
                        }
                        if (targetPlant.hp <= 0) {
                            plants = plants.filter(p => p.id !== targetPlant.id); z.eating = false; z._garlicBites = 0;
                        } else if ((z._garlicBites || 0) >= 2 && !(z._lockUntil > now)) {
                            const gOpts = []; if (z.r > 0) gOpts.push(z.r - 1); if (z.r < ROWS - 1) gOpts.push(z.r + 1);
                            z.r = gOpts[Math.floor(Math.random() * gOpts.length)]; z._garlicBites = 0; z.eating = false; z.lastBiteTime = now;
                            emitParticles(z.x + 2, ((z.r + 0.5) / ROWS) * 100, ['🧄', '💨', '🤢'], 5); playSound('garlic');
                        }
                    } else if (targetPlant.type === 'primalpotatomine' && targetPlant.armed) {
                        MST.src = 'primalpotatomine'; npPrimalBlast(z.x, z.r, 900 * Math.pow(1.3, (targetPlant.level || 1) - 1), 450 * Math.pow(1.3, (targetPlant.level || 1) - 1), z, targetPlant); MST.src = null;
                        plants = plants.filter(p => p.id !== targetPlant.id);
                    } else if (targetPlant.type === 'potatomine' && targetPlant.armed) {
                        MST.src = 'potatomine'; z.hp -= 500 * levelAttackMultiplier('potatomine', targetPlant.level || 1); MST.src = null;
                        z.hitFlash = true;
                        emitSpecialParticles(z.x + 2, ((z.r + 0.5) / ROWS) * 100, ['💥', '🥔', '⭐', '✨'], 7);
                        addVisualEffect({ x: z.x + 2, y: ((z.r + 0.5) / ROWS) * 100, emoji: '💥', duration: 900, size: 'text-5xl sm:text-6xl', className: 'special-attack-effect' });
                        playSound('boom'); shakeLawn(3);
                        plants = plants.filter(p => p.id !== targetPlant.id);
                        
                        const boomEl = document.createElement('div');
                        boomEl.className = 'absolute text-5xl boom-effect pointer-events-none z-40 flex items-center justify-center';
                        boomEl.style.left = `${(targetPlant.c / COLS) * 100}%`;
                        boomEl.style.top = `${(targetPlant.r / ROWS) * 100}%`;
                        boomEl.textContent = '💥 SPUD!';
                        if (gameLayerEl) gameLayerEl.appendChild(boomEl);
                        setTimeout(() => boomEl.remove(), 500);
                    } else {
                        if(z.inertia && !z.momentumSlamUsed) {
                            targetPlant.hp -= z.damage*(2.2+Math.min(4,(z.momentum||0)*14)); z.momentumSlamUsed=true; z.momentum=0; z.speed=z.inertiaSpeed||.055;
                            emitSpecialParticles(z.x,((z.r+.5)/ROWS)*100,['🍎','💥','💨'],7);shakeLawn(3);
                        }
                        z.eating = true;
                        if (!z.lastBiteTime || now - z.lastBiteTime >= 1000) {
                            let biteDamage=z.damage;
                            if(targetPlant.armorHp>0){const absorbed=Math.min(targetPlant.armorHp,biteDamage);targetPlant.armorHp-=absorbed;biteDamage-=absorbed;}
                            targetPlant.hp -= biteDamage;
                            targetPlant.hitFlash = true;
                            emitParticles(((targetPlant.c + 0.5) / COLS) * 100, ((targetPlant.r + 0.5) / ROWS) * 100, ['🦷', '💢', '✨'], 5);
                            if (HEAVY_ZOMBIES.includes(z.type)) { playSound('slam'); shakeLawn(3); emitParticles(((targetPlant.c + 0.5) / COLS) * 100 + 3, ((targetPlant.r + 0.9) / ROWS) * 100, ['💥', '🪨'], 3); }
                            else playSound(z.type === 'chicken' || z.type === 'imp' ? 'pea_hit' : 'chomp');
                            z.lastBiteTime = now;
                        }

                        if (targetPlant.hp <= 0) {
                            plants = plants.filter(p => p.id !== targetPlant.id);
                            z.eating = false;
                        }
                    }
                } else {
                    z.eating = false;
                    z.x -= z.speed * (physicsAnomaly?.type==='frictionless' && currentLevel>=27 ? 1.3 : 1);
                    if(z.inertia && (z.momentum||0)>.04) z.momentumSlamUsed=false;
                }
                }

                const rowMower = mowers.find(m => m.r === z.r && !m.used);
                if (rowMower && z.x <= 2) {
                    rowMower.active = true;
                    rowMower.used = true;
                    starRun.mowers++;
                    emitParticles(rowMower.x, ((rowMower.r + 0.5) / ROWS) * 100, ['💨', '⚙️', '✨'], 8);
                    playSound('mower');
                }

                if (z.x <= -5) {
                    if (window.__REV_ON) { window.revBrain(z); zombies.splice(i, 1); continue; }
                    triggerGameOver();
                    return;
                }
            }

            plants = plants.filter(p => p.hp > 0);

            // Update Lawnmowers
            mowers.forEach(m => {
                if (m.active) {
                    m.x += 1.8;
                    zombies.forEach(z => {
                        if (z.r === m.r && z.x <= m.x + 8) {
                            z.hp = 0;
                            emitParticles(z.x + 2, ((z.r + 0.5) / ROWS) * 100, ['💥', '⭐', '✨'], 8);
                        }
                    });
                    if (m.x > 105) {
                        m.active = false;
                    }
                }
            });

            starRun.ticks++; trackPlantLosses(); if (starRun.ticks % 10 === 0) updateStarGoals();
            if (!window.__REV_ON && !window.__LESSON && zombiesSpawned >= totalZombiesInWave && zombies.length === 0 && airDrops.length === 0) {
                if (currentWave < maxWaves) {
                    currentWave++;
                    if (waveNumEl) waveNumEl.textContent = currentWave;
                    startNextWave();
                } else {
                    triggerVictory();
                    return;
                }
            }

            // Drawing happens in renderLoop() (requestAnimationFrame); this tick only simulates.
        }

        // ===== Rendering =====
        // Every plant / zombie / projectile / effect owns ONE persistent DOM node, keyed by id.
        // Each frame we only touch what changed (mostly `transform`), instead of rebuilding the lawn
        // with innerHTML. That keeps CSS animations running, avoids layout work, and avoids
        // re-triggering Tailwind's DOM observer for hundreds of new nodes per second.
        const domCache = new Map();
        let seenKeys = new Set();
        let renderRafId = null;

        function resetRenderCache() {
            domCache.clear();
            seenKeys.clear();
            if (gameLayerEl) { gameLayerEl.innerHTML = ''; if (projCanvas) gameLayerEl.appendChild(projCanvas); }
        }
        function acquire(key, factory) {
            seenKeys.add(key);
            let entry = domCache.get(key);
            if (!entry) {
                entry = factory();
                domCache.set(key, entry);
                gameLayerEl.appendChild(entry.root);
            }
            return entry;
        }
        function sweepRenderCache() {
            for (const [key, entry] of domCache) {
                if (!seenKeys.has(key)) { entry.root.remove(); domCache.delete(key); }
            }
            seenKeys.clear();
        }
        function setTransform(entry, value) {
            if (entry.t !== value) { entry.t = value; entry.root.style.transform = value; }
        }
        function setInnerClass(entry, cls) {
            if (entry.cls !== cls) { entry.cls = cls; entry.inner.className = cls; }
        }
        function setInnerText(entry, text) {
            if (entry.txt !== text) { entry.txt = text; entry.inner.textContent = text; }
        }
        // Restart the short "got hit" flash by alternating two identical animations (no forced reflow),
        // and never more often than every 160ms so constant damage (spikes, burn) isn't a strobe.
        let _flashFrame = -1, _flashN = 0;
        function triggerFlash(entry) {
            const t = performance.now();
            if (t - (entry.lastFlash || 0) < 160) return;
            entry.lastFlash = t;
            entry.flip = !entry.flip;
            const _fb = (t / 100) | 0; if (_flashFrame !== _fb) { _flashFrame = _fb; _flashN = 0; }
            if (++_flashN <= 14) {
            entry.root.classList.remove('hf1', 'hf2');
            entry.root.classList.add(entry.flip ? 'hf1' : 'hf2');
            }
        }
        function makeCellRoot(zIndex, extraClass) {
            const root = document.createElement('div');
            root.className = 'ent' + (extraClass ? ' ' + extraClass : '');
            root.style.width = `${100 / COLS}%`;
            root.style.height = `${100 / ROWS}%`;
            root.style.zIndex = zIndex;
            return root;
        }
        function makeHpBar(color) {
            const bar = document.createElement('div');
            bar.className = 'hpbar';
            const fill = document.createElement('div');
            fill.className = 'hpfill';
            fill.style.background = color;
            bar.appendChild(fill);
            return { bar, fill };
        }
        function updateHpBar(entry, hp, maxHp, alwaysShow) {
            const frac = Math.max(0, Math.min(1, hp / maxHp));
            const show = alwaysShow || frac < 1;
            if (entry.barShown !== show) { entry.barShown = show; entry.bar.style.display = show ? '' : 'none'; }
            if (show) {
                const t = `scaleX(${frac.toFixed(2)})`;
                if (entry.hpT !== t) { entry.hpT = t; entry.fill.style.transform = t; }
            }
        }

        function makePodTree() {
            const t = document.createElement('div');
            t.className = 'pp-tree n1';
            t.innerHTML = '<i class="pp-stem"></i><i class="pp-br k2"></i><i class="pp-br k3"></i><i class="pp-br k4"></i><i class="pp-br k5"></i>' +
                '<span class="pp-pod k1">🫛</span><span class="pp-pod k2">🫛</span><span class="pp-pod k3">🫛</span><span class="pp-pod k4">🫛</span><span class="pp-pod k5">🫛</span>';
            return t;
        }
        function makePlantEntry(p) {
            // Tile Turnip is a floor tile: lowest z-index so every plant is drawn above it.
            const under = p && p.type === 'tileturnip';
            const root = makeCellRoot(under ? 3 : 5, under ? 'ent-under' : '');
            const { bar, fill } = makeHpBar('#22c55e');
            bar.style.display = 'none';
            const isPod = p && p.type === 'peapod';
            const inner = isPod ? makePodTree() : document.createElement('span');
            root.append(bar, inner);
            const entry = { root, bar, fill, inner, tree: isPod };
            if (p && p.type === 'coconutcannon') {
                const ring = document.createElement('i'); ring.className = 'cc-ring';
                const zz = document.createElement('span'); zz.className = 'cc-zz';
                const rb = makeHpBar('#f59e0b'); rb.bar.className = 'rbar';
                root.append(ring, zz, rb.bar);
                Object.assign(entry, { ring, zz, rbar: rb.bar, rfill: rb.fill });
            }
            return entry;
        }
        function makeZombieEntry(z) {
            const root = makeCellRoot(10, 'ent-smooth' + (z.isEnergyZombie ? ' energy-glow' : ''));
            const status = document.createElement('span');
            status.className = 'zstatus';
            const { bar, fill } = makeHpBar(z.isEnergyZombie ? '#22d3ee' : '#ef4444');
            const inner = document.createElement('span');
            const ability = document.createElement('span');
            ability.className = 'z-ability-label';
            root.append(status, bar, inner, ability);
            return { root, status, bar, fill, inner, ability };
        }
        function makeBossEntry() {
            const root = document.createElement('div');
            root.className = 'ent';
            root.style.zIndex = 30;
            root.style.width = '18%';
            root.style.height = `${100 / ROWS}%`;
            root.innerHTML = `<div class="bo-label">ZOMBOSS</div><span class="bo-emoji">🤖</span><span class="bo-sub">MECH OVERLORD</span>`;
            return { root };
        }
        function makeFx(cls, text, zIndex) {
            const root = document.createElement('div');
            root.className = cls;
            root.style.zIndex = zIndex;
            if (text) root.textContent = text;
            return { root };
        }
        function makeBossHud() {
            const root = document.createElement('div');
            root.className = 'bo-hud';
            root.innerHTML = `
                <div class="bo-hud-box">
                    <div class="bo-hud-row"><span class="bo-hud-name">🤖 ZOMBOSS</span><span class="hud-hp bo-hud-hp"></span></div>
                    <div class="bo-hud-track"><div class="hud-fill bo-hud-fill" style="width:100%"></div></div>
                </div>`;
            return { root, hpText: root.querySelector('.hud-hp'), fill: root.querySelector('.hud-fill') };
        }
        function makeDiagShot(sh) {
            const root = makeCellRoot(15, 'ent-proj');
            const trail = document.createElement('i'); trail.className = 'rtrail'; trail.style.setProperty('--ang', sh.ang.toFixed(0) + 'deg');
            const spin = document.createElement('span'); spin.className = 'emo emo-md rshot'; spin.textContent = sh.emoji || (sh.combo ? '🟢' : '🍠');
            root.append(trail, spin);
            return { root, spin };
        }
        function makeProjectile(pea) {
            const root = makeCellRoot(15, 'ent-proj');
            const inner = document.createElement('span');
            if (pea.type === 'needle' || pea.type === 'electric-needle') {
                inner.className = 'cactus-spike-shot' + (pea.type === 'electric-needle' ? ' electric' : '');
                inner.innerHTML = '<span class="cactus-spike-shape"></span>';
            } else if (pea.type === 'citron') {
                inner.className = 'cit';
                inner.innerHTML = '<i class="cit-core"></i><i class="cit-a"></i>';
            } else {
                const big = pea.type === 'melon' || pea.type === 'wintermelon';
                inner.className = (big ? 'emo emo-md' : 'emo emo-sm') + (pea.type === 'coconut' ? ' shell' : '');
                const pvz2ShotEmoji={coconutcannon:'🥥',peapod:'🟢',melonpult:'🍉',wintermelon:'🍈',rotobaga:'🥔',primalpeashooter:'🪨',primal:'🪨'};
                inner.textContent = pea.emoji || ({ ice: '🧊', fire: '🔥', cabbage: '🥬', corn: '🌽', butter: '🧈' })[pea.type] || pvz2ShotEmoji[pea.ownerType] || '🟢';
            }
            root.appendChild(inner);
            return { root };
        }
        function makeSunEntry(s) {
            const root = document.createElement('div');
            root.className = 'absolute text-3xl sm:text-4xl pointer-events-auto cursor-pointer z-30 p-2 flex items-center justify-center select-none';
            root.style.cssText = `left:${s.x}%;top:${s.y}%;transform:translate(-50%,-50%);text-shadow:0 2px 4px rgba(0,0,0,.5)`;
            root.textContent = '☀️';
            root.onpointerdown = (e) => collectSun(s.id, e);
            return { root };
        }
        function makeBeanEntry(b) {
            const root = document.createElement('div');
            root.className = 'absolute text-3xl sm:text-4xl pointer-events-auto cursor-pointer z-30 p-2 flex items-center justify-center select-none';
            root.style.cssText = `left:${b.x}%;top:${b.y}%;transform:translate(-50%,-50%)`;
            const inner = document.createElement('span');
            inner.className = 'anim-energy-bean';
            inner.textContent = '🫘';
            root.appendChild(inner);
            root.onpointerdown = (e) => collectEnergyBean(b.id, e);
            return { root };
        }
        function makeEffectEntry(effect) {
            const root = makeCellRoot(40);
            root.style.transform = `translate(${(effect.x * COLS).toFixed(2)}%, ${(effect.y * ROWS).toFixed(2)}%)`;
            const inner = document.createElement('span');
            inner.className = `${effect.size} ${effect.className}`;
            inner.textContent = effect.emoji;
            root.appendChild(inner);
            return { root, inner };
        }

        function renderBoss(z, now) {
            const e = acquire('z' + z.id, makeBossEntry);
            let bossX = z.x - 9;
            let bossY = (z.r / ROWS) * 100;
            const st = z.bossAttackState;
            if (st && st.type === 'stomp') {
                const t = Math.min(1, Math.max(0, (now - st.startedAt) / st.duration));
                // Rush from the right edge through the full lane, then recoil to the patrol position.
                const travel = t < 0.72 ? t / 0.72 : 1 - ((t - 0.72) / 0.28);
                bossX = (z.x - 9) - travel * 76;
                bossY = (st.lane / ROWS) * 100;
            }
            const pos = `${bossX.toFixed(1)}|${bossY.toFixed(1)}`;
            if (e.pos !== pos) { e.pos = pos; e.root.style.left = `${bossX}%`; e.root.style.top = `${bossY}%`; }
            if (z.hitFlash) { z.hitFlash = false; triggerFlash(e); }

            if (st && st.type === 'stomp') {
                const laneY = ((st.lane + 0.5) / ROWS) * 100;
                const lane = acquire('bfx-lane', () => makeFx('g-abs boss-stomp-lane', '', 20));
                lane.root.style.cssText = `z-index:20;left:0%;top:${(st.lane / ROWS) * 100 + 1}%;width:100%;height:${100 / ROWS - 2}%`;
                const mark = acquire('bfx-mark', () => makeFx('g-abs boss-warning bo-icon', '', 40));
                if (mark.txt !== '⚠️') { mark.txt = '⚠️'; mark.root.textContent = '⚠️'; }
                mark.root.style.left = '3%'; mark.root.style.top = `${laneY - 3}%`;
            } else if (st && st.type === 'rocket') {
                const mark = acquire('bfx-mark', () => makeFx('g-abs boss-warning bo-icon', '', 40));
                if (mark.txt !== '🎯') { mark.txt = '🎯'; mark.root.textContent = '🎯'; }
                mark.root.style.left = `${st.targetX - 2}%`; mark.root.style.top = `${st.targetY - 5}%`;
                const label = acquire('bfx-label', () => makeFx('g-abs bo-target', 'TARGET LOCK', 40));
                label.root.style.left = `${Math.max(0, st.targetX - 5)}%`; label.root.style.top = `${st.targetY - 11}%`;
                if (now - st.startedAt >= st.launchAt - st.startedAt) {
                    const flight = Math.min(1, Math.max(0, (now - st.launchAt) / (st.resolveAt - st.launchAt)));
                    const rocket = acquire('bfx-rocket', () => makeFx('g-abs boss-rocket bo-icon', '🚀', 40));
                    rocket.root.style.left = `${st.bossX + (st.targetX - st.bossX) * flight}%`;
                    rocket.root.style.top = `${st.bossY + (st.targetY - st.bossY) * flight}%`;
                }
            }
        }

        function renderGame() {
            if (!gameLayerEl) return;
            const now = Date.now();

            mowers.forEach(m => {
                if (m.used && !m.active) return;
                const e = acquire('m' + m.id, () => {
                    const root = makeCellRoot(20, 'ent-smooth');
                    const span = document.createElement('span');
                    span.className = 'text-3xl';
                    span.textContent = '🚜';
                    root.appendChild(span);
                    return { root };
                });
                setTransform(e, `translate(${(m.x * COLS).toFixed(1)}%, ${m.r * 100}%)`);
            });

            plants.forEach(p => {
                let e = acquire('p' + p.id, () => makePlantEntry(p));
                if (!!e.tree !== (p.type === 'peapod')) { e.root.remove(); domCache.delete('p' + p.id); e = acquire('p' + p.id, () => makePlantEntry(p)); }
                setTransform(e, `translate(${p.c * 100}%, ${p.r * 100}%)`);
                const mt = p.type === 'tileturnip' ? 0 : mastTier(p.type);
                if (p.hitFlash) e.mhit = now + 450;
                const mCls = mt ? ' mo mo-t' + mt + (e.mhit > now ? ' mo-hit' : (p.shootingAnim ? ' mo-act' : '')) : '';

                let anim = PLANT_TYPES[p.type] ? PLANT_TYPES[p.type].animClass : '';
                if (p.frozenUntil > now) anim += ' plant-frozen';
                if (p.isNew) anim += ' anim-plant-spawn';
                if (p.superGlow) anim += ' anim-super-power';
                if (p.shootingAnim) {
                    if (NEWP[p.type]) anim += ' ' + (NEWP[p.type].act || 'anim-np-act'); else if (p.type === 'coconutcannon') anim += ' anim-cannon';
                    else if (p.type === 'cabbagetosser' || p.type === 'corntosser' || p.type === 'melonpult' || p.type === 'wintermelon') anim = 'anim-toss';
                    else if (p.type === 'lightningreed' || p.type === 'citron') anim += ' anim-electric-plant';
                    else if (p.type === 'rotobaga') anim += ' anim-rotobaga';
                    else if (p.type === 'celery') anim += ' anim-ambush';
                    else if (p.type === 'bonkchoy') anim = 'anim-bonk';
                    else if (p.type === 'firedragon') anim = 'anim-dragon-fire';
                    else if (p.type === 'snowdragon') anim = 'anim-dragon-ice';
                    else if (p.type === 'peapod') anim = '';
                    else anim = 'anim-shoot';
                }
                const resting = p.type === 'coconutcannon' && (p.restUntil || 0) > now;
                if (resting) anim = (p.shootingAnim ? 'anim-recoil ' : '') + 'cc-rest' + (p.isNew ? ' anim-plant-spawn' : '');
                if (p.tossUntil > now) anim = 'plant-tossed';
                const electric = p.type === 'cactus' && p.electroState ? ' electric-cactus-plant' : '';

                if (e.tree) {
                    const cls = 'pp-tree n' + Math.min(5, p.podCount || 1) + (p.shootingAnim ? ' shoot' : '') + (mt ? ' mo-t' + mt : '');
                    if (e.cls !== cls) { e.cls = cls; e.inner.className = cls; }
                } else {
                    setInnerClass(e, `emo emo-md ${anim}${electric}${p.combinedWith ? ' fused-plant' : ''}${mCls}`);
                    let emoji = PLANT_TYPES[p.type] ? PLANT_TYPES[p.type].emoji : '🌿';
                    if (p.type === 'gatlingpea' && p.combinedWith && PLANT_TYPES[p.combinedWith]) emoji = p.combinedWith === 'peapod' ? PLANT_TYPES.gatlingpea.emoji + '🫛' + ((p.podCount || 1) > 1 ? '×' + p.podCount : '') : PLANT_TYPES.gatlingpea.emoji + PLANT_TYPES[p.combinedWith].emoji;
                    if (p.type === 'potatomine' && !p.armed) emoji = '🌱';
                    if (NEWP[p.type] && NEWP[p.type].emojiFn) emoji = NEWP[p.type].emojiFn(p) || emoji;
                    setInnerText(e, emoji);
                }

                if (e.ring) {
                    const ready = !resting;
                    if (e.rdy !== ready) { e.rdy = ready; e.ring.style.display = ready ? 'block' : 'none'; e.zz.style.display = ready ? 'none' : 'block'; e.rbar.style.display = ready ? 'none' : 'block'; }
                    if (!ready) {
                        const left = p.restUntil - now;
                        const f = `scaleX(${(1 - Math.min(1, left / COCONUT_REST_MS)).toFixed(2)})`;
                        if (e.rt !== f) { e.rt = f; e.rfill.style.transform = f; }
                        const secs = '💤' + Math.ceil(left / 1000);
                        if (e.zt !== secs) { e.zt = secs; e.zz.textContent = secs; }
                    }
                }

                updateHpBar(e, p.hp, p.maxHp, false);
                if (mt && !e.tree) { const em = e.inner.textContent; if (e.de !== em) { e.de = em; e.inner.setAttribute('data-e', em); } }
                if (e.mt !== mt) { e.mt = mt; if (e.mfx) { e.mfx.remove(); e.mfx = null; } e.mcls = '';
                  if (mt >= 1) { const f = document.createElement('i'); const sp = ['', ''];
                    f.innerHTML = (mt >= 3 ? sp.map(x => '<b>' + x + '</b>').join('') : '') + '<s>' + MAST_ICON[mt] + ' ' + PLANT_TYPES[p.type].name + '</s>'; f.className = 'mfx t' + mt; e.mfx = f; e.root.appendChild(f); } }
                if (p.hitFlash) { p.hitFlash = false; triggerFlash(e); }
            });

            zombies.forEach(z => {
                if (z.isBoss) { renderBoss(z, now); return; }
                const e = acquire('z' + z.id, () => makeZombieEntry(z));
                { const tt = ZOMBIE_DISPLAY_NAMES[z.type] || (z.type.charAt(0).toUpperCase()+z.type.slice(1)) + ' Zombie'; if (e.ttl !== tt) { e.ttl = tt; e.root.title = tt; } }
                e.root.classList.toggle('z-elite', !!ZOMBIE_TYPES[z.type]?.elite);
                e.root.classList.toggle('z-einstein', z.type==='einstein_elite');
                setTransform(e, `translate(${(Math.max(-6,z.x) * COLS).toFixed(2)}%, ${(z.r + (z.offY || 0)) * 100}%)${z.flying ? ' translateY(-12px)' : ''}`);
                const specialZombieAnim=({barrelroller:'anim-zombie-barrel',impcannon:'anim-zombie-cannon',gargantuarpirate:'anim-zombie-heavy',jollyroger:'anim-zombie-flag',camel:'anim-zombie-camel',explorer:'anim-zombie-explorer',tombraiser:'anim-zombie-tomb',pharaoh:'anim-zombie-royal',mummygargantuar:'anim-zombie-heavy',chickenwrangler:'anim-zombie-wrangler',chicken:'anim-zombie-chicken',zombiebull:'anim-zombie-charge',wildwestgargantuar:'anim-zombie-heavy',pianist:'anim-zombie-piano'})[z.type]||'';
                const physicsAnim=({inertia:'zphys-inertia',fma_zombie:'zphys-mass',newton3_zombie:'zphys-newton',relativity_zombie:'zphys-relativity',photon_zombie:'zphys-photon',tesla_zombie:'zphys-tesla',schrodinger_zombie:'zphys-quantum',hawking_zombie:'zphys-singularity',pendulum:'zphys-pendulum',skater_zombie:'zphys-skater',refractor_zombie:'zphys-prism'})[z.type]||'';
                const abilityLabel=({inertia:'MOMENTUM',fma_zombie:'HEAVY MASS',newton3_zombie:'ROCKET RECOIL',relativity_zombie:'TIME FIELD',photon_zombie:'BLINK DASH',tesla_zombie:'CHARGING EMP',schrodinger_zombie:'QUANTUM STATE',hawking_zombie:'EVENT HORIZON',pendulum:'SWING PHASE',skater_zombie:'FRICTIONLESS',refractor_zombie:'PRISM SHIELD'})[z.type]||'';
                if(e.ability && e.ability.textContent!==abilityLabel)e.ability.textContent=abilityLabel;
                const heavyZ = HEAVY_ZOMBIES.includes(z.type) || ['pharaoh','pyramid'].includes(z.type);
                const motion = z.eating ? (HEAVY_ZOMBIES.includes(z.type) ? 'zsmash' : 'anim-zombie-eat') : (z.type === 'imp' ? 'zhop' : (RUNNER_ZOMBIES.includes(z.type) ? 'zrun' : (heavyZ ? 'zstomp' : 'anim-zombie-walk')));
                const frozenZ = z.frozenUntil > now, burnZ = z.burnUntil > now;
                const darwinGlow = z.darwinEvolved ? ' darwin-evolved' : '';
                const darwinPulse = z.evolvingUntil > now ? ' darwin-evolving' : '';
                const actCls = (z.actUntil > now ? ' act-' + z.act : '') + (z.glowUntil > now ? ' z-redglow' : '') + (z.mutant ? ' mut-' + z.mutant : '') + ((z.fusing || z.auraUntil > now) ? ' z-mg-purple' : (z.mutGlow ? ' z-mg-' + z.mutGlow : '')) + (z.isCombined ? ' z-big' : '') + (z.fusedSmall ? ' z-small' : '') + darwinGlow + darwinPulse;
                setInnerClass(e, `emo ${(['gargantuar','gargantuarpirate','mummygargantuar','wildwestgargantuar','tallnutmutant'].includes(z.type)) ? 'emo-xl' : 'emo-md'} ${motion}${actCls}${frozenZ ? ' z-frozen' : ''}${burnZ && !frozenZ ? ' z-burn' : ''} ${z.flying?'anim-rotobaga':''} ${z.actUntil > now ? '' : specialZombieAnim} ${physicsAnim}`);
                if (z.mutationHead || z.extraMutationHead) {
                    const mutantSize = z.type === 'tallnutmutant' ? 'emo-xl' : 'emo-md';
                    const heads = [z.mutationHead || DARWIN_TRAIT_HEADS[z.mutant], z.extraMutationHead || (z.extraMutant && DARWIN_TRAIT_HEADS[z.extraMutant])].filter(Boolean);
                    const signature = heads.join('|');
                    { const mcls=`emo ${mutantSize} mutant-zombie ${motion}${actCls}${frozenZ ? ' z-frozen' : ''}${burnZ && !frozenZ ? ' z-burn' : ''}`; if (e.inner.className !== mcls) e.inner.className = mcls; }
                    if (e.mutHead !== signature || !e.mhEls || e.mhEls.some(h => h.parentNode !== e.inner)) {
                        e.inner.textContent='';
                        const body=document.createElement('span');body.className='mutant-body';body.textContent='🧟';
                        e.inner.appendChild(body);
                        e.mhEls=[];
                        heads.forEach((headText, index) => { const head=document.createElement('span');head.className='mutant-head'+(index===1?' second':'');head.textContent=headText;e.inner.appendChild(head);e.mhEls.push(head); });
                        e.mutHead=signature;e.txt=null;
                    }
                } else { e.mutHead=null; e.mhEls=null; setInnerText(e,z.emoji); }
                updateHpBar(e, z.hp, z.maxHp, true);

                const enraged = !!z.enraged;
                if (e.enr !== enraged) { e.enr = enraged; e.root.classList.toggle('enraged-glow', enraged); }
                const status = z.statusEmoji && z.statusExpiresAt > now ? z.statusEmoji : '';
                if (e.st !== status) { e.st = status; e.status.textContent = status; e.status.style.display = status ? 'block' : 'none'; }
                if (z.hitFlash) { z.hitFlash = false; triggerFlash(e); }
            });

            visualEffects.forEach(effect => {
                const e = acquire('f' + effect.id, () => makeEffectEntry(effect));
                if (effect.isParticle) {
                    const progress = Math.min(1, Math.max(0, (now - effect.createdAt) / effect.duration));
                    // Stay clearly visible for most of the lifetime, then fade smoothly.
                    const fade = progress < 0.72 ? 1 : Math.max(0, 1 - (progress - 0.72) / 0.28);
                    e.inner.style.opacity = (0.95 * fade).toFixed(2);
                    e.inner.style.transform = `translate(${(effect.dx * progress).toFixed(1)}px, ${(effect.dy * progress).toFixed(1)}px) scale(${(0.9 + progress * 0.55).toFixed(2)}) rotate(${(effect.rotation * progress).toFixed(0)}deg)`;
                }
            });

            const tickNow = performance.now();
            const tickFrac = Math.min(1, (tickNow - tickPerf) / 50);
            const canvasOk = syncProjCanvas();
            if (canvasOk && (projDirty || projectiles.length || diagShots.length)) { projCtx.clearRect(0, 0, layerW, layerH); projDirty = false; }
            const cellW = layerW / COLS, cellH = layerH / ROWS;
            projectiles.forEach(pea => {
                if (pea.delay > 0 || (pea.startAt && pea.startAt > now)) return;
                if (canvasOk && canvasProjectile(pea)) {
                    const px0 = pea.px == null ? pea.x : pea.px, xx = px0 + (pea.x - px0) * tickFrac;
                    const big = pea.type === 'melon' || pea.type === 'wintermelon';
                    const emo = projEmoji(pea);
                    if (pea._spE !== emo || pea._spW !== cellW) { pea._spE = emo; pea._spW = cellW; pea._sp = emojiSprite(emo, pea.bigPrimal ? Math.round(Math.max(26, Math.min(56, cellW * .55))) : Math.round(Math.max(14, Math.min(34, cellW * (big ? .5 : .3))))); }
                    const sp = pea._sp;
                    projCtx.drawImage(sp.bmp || sp, xx / 100 * layerW - sp.cssW / 2, (pea.r + .35 + (pea.yOff || 0)) * cellH - sp.cssW / 2, sp.cssW, sp.cssW);
                    projDirty = true; return;
                }
                const e = acquire(pea._k || (pea._k = 'j' + pea.id), () => makeProjectile(pea));
                const px = pea.px == null ? pea.x : pea.px;
                const x = px + (pea.x - px) * tickFrac;
                let y = pea.r * 100 - 15 + (pea.yOff ? pea.yOff * 100 : 0);
                if (pea.lob) { const tt = pea.pt + (pea.t - pea.pt) * tickFrac; y -= 4 * pea.h * tt * (1 - tt); }
                // Spin is folded into the one transform write: lobbed shots tumble; the Citron orb spins, snaps and pulses.
                let rot = '';
                if (pea.lob) rot = ` rotate(${((tickNow * 0.55) % 360).toFixed(0)}deg)`;
                else if (pea.type === 'citron') {
                    const snap = (((tickNow / 90) | 0) & 1) * 60;
                    rot = ` rotate(${(((tickNow * 0.22) + snap) % 360).toFixed(0)}deg)`;
                }
                e.root.style.transform = `translate(${(x * COLS - 50).toFixed(1)}%, ${y.toFixed(1)}%)${rot}`;
            });

            if (canvasOk && diagShots.length) {
                // One path per colour (instead of one stroke per shot), then cached sprites.
                projCtx.lineWidth = 4; projCtx.lineCap = 'round';
                const spD = Math.round(Math.max(14, Math.min(30, cellW * .3)));
                for (let pass = 0; pass < 2; pass++) {
                    const combo = pass === 1; let any = false;
                    projCtx.strokeStyle = combo ? 'rgba(134,239,172,.55)' : 'rgba(251,146,60,.8)'; projCtx.beginPath();
                    for (let i = 0; i < diagShots.length; i++) {
                        const sh = diagShots[i]; if (!!sh.combo !== combo || (sh.startAt && sh.startAt > now)) continue;
                        const x = sh.px + (sh.x - sh.px) * tickFrac, y = sh.py + (sh.y - sh.py) * tickFrac;
                        const cx = x / 100 * layerW, cy = y / 100 * layerH, a = (sh.ang || 0) * Math.PI / 180;
                        projCtx.moveTo(cx, cy); projCtx.lineTo(cx - Math.cos(a) * 30, cy - Math.sin(a) * 30); any = true;
                    }
                    if (any) projCtx.stroke();
                }
                for (let i = 0; i < diagShots.length; i++) {
                    const sh = diagShots[i]; if (sh.startAt && sh.startAt > now) continue;
                    const x = sh.px + (sh.x - sh.px) * tickFrac, y = sh.py + (sh.y - sh.py) * tickFrac;
                    const emo = sh.emoji || (sh.combo ? '🟢' : '🍠');
                    if (sh._spE !== emo || sh._spW !== cellW) { sh._spE = emo; sh._spW = cellW; sh._sp = emojiSprite(emo, spD); }
                    const sp = sh._sp, cx = x / 100 * layerW, cy = y / 100 * layerH;
                    projCtx.drawImage(sp.bmp || sp, cx - sp.cssW / 2, cy - sp.cssW / 2, sp.cssW, sp.cssW);
                }
                projDirty = true;
            }
            diagShots.forEach(sh => {
                if (canvasOk) return;
                if (sh.startAt && sh.startAt > now) return;
                const x = sh.px + (sh.x - sh.px) * tickFrac, y = sh.py + (sh.y - sh.py) * tickFrac;
                const e = acquire(sh._k || (sh._k = 'd' + sh.id), () => makeDiagShot(sh));
                e.root.style.transform = `translate(${(x * COLS - 50).toFixed(1)}%, ${(y * ROWS - 50).toFixed(1)}%)`;
                e.spin.style.transform = `rotate(${((tickNow * 0.9) % 360).toFixed(0)}deg)`;
            });
            zShots.forEach(sh => {
                if (sh.wait > 0) return;
                const e = acquire('q' + sh.id, () => makeZShot(sh));
                const x = sh.px + (sh.x - sh.px) * tickFrac;
                e.root.style.transform = `translate(${(x * COLS - 50).toFixed(1)}%, ${(sh.y * ROWS - 50).toFixed(1)}%)`;
            });
            suns.forEach(s => acquire('s' + s.id, () => makeSunEntry(s)));
            energyBeanDrops.forEach(b => acquire('b' + b.id, () => makeBeanEntry(b)));

            // Dedicated Zomboss health HUD: stays visible at the top of the lawn.
            const boss = zombies.find(z => z.isBoss);
            if (boss) {
                const hud = acquire('bosshud', makeBossHud);
                const hpText = `${Math.max(0, Math.ceil(boss.hp)).toLocaleString()} / ${Math.ceil(boss.maxHp).toLocaleString()} HP`;
                if (hud.hpTxt !== hpText) { hud.hpTxt = hpText; hud.hpText.textContent = hpText; }
                const w = `${Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100)).toFixed(1)}%`;
                if (hud.w !== w) { hud.w = w; hud.fill.style.width = w; }
            }

            sweepRenderCache();
        }

        // Draw at the display's refresh rate while the game runs; the simulation itself still ticks every 50ms.
        // v65: adaptive performance mode. When the lawn gets crowded (zombies, plants, shots, effects) we drop the
        // expensive decorations (glows, idle animations, most particles, extra sounds) and cap the draw rate.
        let perfLevel = 0, lastDrawAt = 0, perfLastT = 0, perfEma = 16, perfLagSince = 0, perfHoldUntil = 0, perfRelapseUntil = 0, perfHold = 5000;
        // v67: every effect stays ON. Only when the game is genuinely struggling (frames averaging > ~55ms for
        // 1.5s) are the decorations switched off for a few seconds, then they come back automatically.
        function updatePerfLevel(t) {
            const dt = perfLastT ? t - perfLastT : 16; perfLastT = t;
            if (dt > 1000) { perfLagSince = 0; return; }                    // tab switch / pause, ignore
            perfEma = perfEma * 0.92 + dt * 0.08;
            if (perfLevel === 0) {
                if (perfEma > 55) {
                    if (!perfLagSince) perfLagSince = t;
                    else if (t - perfLagSince > 1500) {
                        // lagging again right after restoring effects -> stay lite longer (max 30s)
                        perfHold = t < perfRelapseUntil ? Math.min(30000, perfHold * 2) : 5000;
                        perfLevel = 2; perfHoldUntil = t + perfHold; perfLagSince = 0; perfEma = 30;
                        if (gameLayerEl) gameLayerEl.setAttribute('data-perf', '2');
                    }
                } else perfLagSince = 0;
            } else if (t >= perfHoldUntil) {
                perfLevel = 0; perfRelapseUntil = t + 6000; perfEma = 16;
                if (gameLayerEl) gameLayerEl.removeAttribute('data-perf');
            }
        }
        function renderLoop() {
            const t = performance.now();
            updatePerfLevel(t);
            if (perfLevel === 0 || t - lastDrawAt >= 30) { lastDrawAt = t; renderGame(); }
            renderRafId = isRunning ? requestAnimationFrame(renderLoop) : null;
        }
        function startRenderLoop() {
            if (renderRafId == null) renderRafId = requestAnimationFrame(renderLoop);
        }
        function stopRenderLoop() {
            if (renderRafId != null) cancelAnimationFrame(renderRafId);
            renderRafId = null;
        }

        function updateGameFlowControls() {
            const speedBtn = document.getElementById('game-speed-btn');
            const waveBtn = document.getElementById('next-wave-btn');
            const speed = GAME_SPEEDS[gameSpeedIndex] || 1;
            if (speedBtn) {
                speedBtn.textContent = speed === 1 ? '⏩ Speed: 1×' : `⏩ Speed: ${speed}×`;
                speedBtn.setAttribute('aria-label', `Game speed ${speed} times`);
                speedBtn.className = `px-3 py-2 ${speed === 1 ? 'bg-violet-700 hover:bg-violet-600' : speed === 2 ? 'bg-indigo-700 hover:bg-indigo-600' : speed === 3 ? 'bg-fuchsia-700 hover:bg-fuchsia-600' : 'bg-amber-600 hover:bg-amber-500'} active:scale-95 text-white font-extrabold rounded-lg shadow transition-all text-sm`;
            }
            if (waveBtn) {
                const canAdvance = currentWave < maxWaves;
                waveBtn.disabled = !canAdvance;
                waveBtn.textContent = canAdvance ? `⏭️ Next Wave (${currentWave + 1}/${maxWaves})` : `🏁 Final Wave (${currentWave}/${maxWaves})`;
                waveBtn.className = `px-3 py-2 ${canAdvance ? 'bg-rose-700 hover:bg-rose-600 cursor-pointer' : 'bg-slate-700 text-slate-400 cursor-not-allowed'} disabled:opacity-70 active:scale-95 text-white font-extrabold rounded-lg shadow transition-all text-sm`;
            }
        }

        function restartGameSimulationTimer() {
            if (gameLoopId != null) clearInterval(gameLoopId);
            gameLoopId = null;
            if (isRunning) {
                const tickMs = 50 / (GAME_SPEEDS[gameSpeedIndex] || 1);
                gameLoopId = setInterval(() => {
                    gameClock += 50;
                    updateGame();
                }, tickMs);
            }
        }

        function cycleGameSpeed() {
            gameSpeedIndex = (gameSpeedIndex + 1) % GAME_SPEEDS.length;
            updateGameFlowControls();
            if (isRunning) restartGameSimulationTimer();
        }

        function advanceToNextWave() {
            if (currentWave >= maxWaves || !document.getElementById('playing-screen') || document.getElementById('playing-screen').classList.contains('hidden')) return;
            currentWave++;
            if (waveNumEl) waveNumEl.textContent = currentWave;
            startNextWave(true);
            updateGameFlowControls();
            missionToast(`⏭️ Wave ${currentWave} merged in! Its zombies will join the current wave.`);
        }

        function toggleGame() {
            initAudio();
            if (isRunning) {
                isRunning = false;
                clearInterval(gameLoopId);
                gameLoopId = null;
                stopRenderLoop();
                setFxPaused(true);
                if (startBtn) {
                    startBtn.textContent = '▶️ Start';
                    startBtn.className = 'px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-lg shadow transition-all text-sm';
                }
            } else {
                if (!gameClockActive) {
                    gameClock = realDateNow();
                    gameClockActive = true;
                }
                isRunning = true;
                if (!lastSunDropTime) lastSunDropTime = Date.now();
                if (!lastZombieSpawnTime) lastZombieSpawnTime = Date.now();
                if (totalZombiesInWave === 0) startNextWave();

                lastRenderTime = 0;
                restartGameSimulationTimer();
                startRenderLoop();
                setFxPaused(false);
                if (startBtn) {
                    startBtn.textContent = '⏸️ Pause';
                    startBtn.className = 'px-4 py-1.5 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold rounded-lg shadow transition-all text-sm';
                }
            }
        }

        // v64: later game levels of every world throw far more zombies at you in the later waves.
        let waveRateMul = 1;
        function waveScaledCount(b) {
            // Waves 1-4 are normal. From wave 5: x2, wave 6: x3, wave 7: x3.5, wave 8 and later: x4.
            const w = currentWave;
            const m = w <= 4 ? 1 : w === 5 ? 2 : w === 6 ? 3 : w === 7 ? 3.5 : 4;
            return Math.min(Math.round(b * m), 140);
        }
        function startNextWave(mergeIntoCurrent = false) {
            if (!mergeIntoCurrent) zombiesSpawned = 0;
            if (currentLevel >= 27 && currentLevel <= 34 && currentWave > 1 && currentWave % 3 === 0) {
                const type = currentWave % 2 === 0 ? 'lowGravity' : 'frictionless';
                physicsAnomaly = { type, until: Date.now() + 18000 };
                const label = type === 'lowGravity' ? 'LOW GRAVITY' : 'FRICTIONLESS FIELD';
                addVisualEffect({x:50,y:48,emoji:type==='lowGravity'?'🪐':'🧊',duration:1700,size:'text-5xl',className:'special-attack-effect'});
                missionToast('⚛️ PHYSICS ANOMALY: ' + label + ' — ' + (type==='lowGravity'?'lobbed shots float and hit harder':'zombies slide faster; knockback travels farther'));
            }
            const _baseCount = 3 + currentWave * 3;
            const waveZombieCount = currentLevel === 11 ? 1 : waveScaledCount(_baseCount);
            waveRateMul = currentLevel === 11 ? 1 : Math.max(1, Math.min(3.2, waveZombieCount / _baseCount));
            totalZombiesInWave = mergeIntoCurrent ? totalZombiesInWave + waveZombieCount : waveZombieCount;
            lastZombieSpawnTime = currentLevel === 11 ? Date.now() - 5000 : Date.now();
            if (currentLevel !== 11) showWaveWarning(currentWave, maxWaves);
            updateGameFlowControls();
        }

        (function mountStarGoals(){
            const ps = document.getElementById('playing-screen'); if (!ps || document.getElementById('star-goals')) return;
            const d = document.createElement('div'); d.id = 'star-goals';
            const header = ps.firstElementChild; (header || ps).appendChild(d);
        })();

        function resetGame() {
            resetMissionRunState();
            physicsAnomaly = null;
            if (isRunning) {
                toggleGame();
            }

            const levelConfig = LEVELS[currentLevel];
            maxWaves = levelConfig.maxWaves;
            if (maxWavesEl) maxWavesEl.textContent = maxWaves;

            commitPendingRunXP();
            applyAccountPerks();
            sun = 150 + accStartSun();
            updateSunDisplay();

            physicsAnomaly = null;
            energyBeans = 1;
            energyBeanActive = false;
            updateEnergyBeanDisplay();

            selectedSeed = null;
            currentWave = 1;
            if (waveNumEl) waveNumEl.textContent = currentWave;
            updateGameFlowControls();
            zombiesKilled = 0;
            if (zombiesKilledEl) zombiesKilledEl.textContent = zombiesKilled;
            zombiesSpawned = 0;
            totalZombiesInWave = 0;

            plants = [];
            zombies = []; fusions = []; gameTimers = [];
            airDrops = []; diagShots = []; zShots = []; plantRegistry.clear();
            projectiles = [];
            suns = [];
            energyBeanDrops = [];
            visualEffects = [];

            initLawnmowers();
            resetStarRun();
            updateStarGoals(true);

            seedCooldowns = {};
            Object.keys(PLANT_TYPES).forEach(k => {
                const cdOverlay = document.getElementById(`cd-${k}`);
                if (cdOverlay) cdOverlay.classList.add('hidden');
            });

            document.querySelectorAll('.seed-card').forEach(card => {
                card.classList.remove('border-amber-400', 'bg-slate-700');
            });

            resetRenderCache();
            initGrid();
            renderGame();
        }



        // ===================== Gardener Rank (account level 1-50) =====================
        const ACCOUNT_KEY = 'pvzAccount_v1', MAX_RANK = 50, TOTAL_RANK_XP = 200000;
        // XP needed to go from rank r to r+1 (index r-1). Starts at 100 and grows quadratically; all 49 steps sum to exactly 200,000.
        const RANK_XP_NEED = (() => {
            const n = MAX_RANK - 1; let sq = 0; for (let j = 0; j < n; j++) sq += j * j;
            const b = (TOTAL_RANK_XP - 100 * n) / sq;
            const a = Array.from({ length: n }, (_, j) => j === 0 ? 100 : Math.round((100 + b * j * j) / 5) * 5);
            a[n - 1] += TOTAL_RANK_XP - a.reduce((x, y) => x + y, 0);
            return a;
        })();
        const RANK_XP_CUM = (() => { const c = [0, 0]; for (let r = 1; r < MAX_RANK; r++) c.push(c[r] + RANK_XP_NEED[r - 1]); return c; })(); // c[r] = total XP to reach rank r
        function normalizeAccount(raw) { const o = raw && typeof raw === 'object' ? raw : {}; const xp = Math.max(0, Math.min(TOTAL_RANK_XP, Math.floor(Number(o.xp)) || 0)); return { xp, rewarded: Math.max(1, Math.min(MAX_RANK, Math.floor(Number(o.rewarded)) || 1)) }; }
        let account = (() => { try { return normalizeAccount(JSON.parse(localStorage.getItem(ACCOUNT_KEY) || '{}')); } catch (_) { return normalizeAccount({}); } })();
        function saveAccount() { try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account)); } catch (_) {} }
        function rankFromXP(xp) { let r = 1; while (r < MAX_RANK && xp >= RANK_XP_CUM[r + 1]) r++; return r; }
        function accountRank() { return rankFromXP(account.xp); }
        const RANK_PERKS = [
            { rank: 4, icon: '☀️', text: 'Starting Sun +25' },
            { rank: 6, icon: '🫘', text: 'Max Energy Beans 4 → 5' },
            { rank: 8, icon: '⛏️', text: 'Shovel refunds 25% of a plant’s sun cost' },
            { rank: 10, icon: '🌿', text: 'Title badge “Green Thumb” + 10 🧪', fert: 10 },
            { rank: 12, icon: '☀️', text: 'Starting Sun +50 more' },
            { rank: 15, icon: '⛏️', text: 'Shovel refund 25% → 50%' },
            { rank: 18, icon: '🌳', text: 'Title badge “Master Gardener” + 20 🧪', fert: 20 },
            { rank: 21, icon: '⏱️', text: 'Seed Recharge Boost: all plant cooldowns −10%' },
            { rank: 24, icon: '⚛️', text: 'Field Core Overclock: Fundamental Field lasts 12s instead of 10s' },
            { rank: 27, icon: '☀️', text: 'Starting Sun +100 more, Max Energy Beans 5 → 6' },
            { rank: 30, icon: '🔬', text: 'Title badge “Botanical Sage” + 15 🧪', fert: 15 },
            { rank: 35, icon: '🛡️', text: 'Title badge “Grove Warden” + 15 🧪', fert: 15 },
            { rank: 40, icon: '🏆', text: 'Title badge “Verdant Champion” + 15 🧪', fert: 15 },
            { rank: 45, icon: '🌟', text: 'Title badge “Garden Legend” + 15 🧪', fert: 15 },
            { rank: 50, icon: '👑', text: 'Title badge “Grand Gardener” + 15 🧪', fert: 15 }
        ];
        const TITLE_BADGES = [
            { rank: 10, name: 'Green Thumb', icon: '🌿' }, { rank: 18, name: 'Master Gardener', icon: '🌳' }, { rank: 30, name: 'Botanical Sage', icon: '🔬' },
            { rank: 35, name: 'Grove Warden', icon: '🛡️' }, { rank: 40, name: 'Verdant Champion', icon: '🏆' }, { rank: 45, name: 'Garden Legend', icon: '🌟' }, { rank: 50, name: 'Grand Gardener', icon: '👑' }
        ];
        function rankTitle(r) { let t = r < 5 ? 'Seedling Gardener' : 'Sprout Keeper'; TITLE_BADGES.forEach(b => { if (r >= b.rank) t = b.name; }); return t; }
        function rankBracket(r) { return r >= 50 ? 5 : r >= 40 ? 4 : r >= 30 ? 3 : r >= 18 ? 2 : r >= 10 ? 1 : 0; }
        function accStartSun() { const r = accountRank(); return (r >= 4 ? 25 : 0) + (r >= 12 ? 50 : 0) + (r >= 27 ? 100 : 0); }
        function accMaxBeans() { const r = accountRank(); return r >= 27 ? 6 : r >= 6 ? 5 : 4; }
        function accShovelRefund() { const r = accountRank(); return r >= 15 ? 0.5 : r >= 8 ? 0.25 : 0; }
        function accCooldownMul() { return accountRank() >= 21 ? 0.9 : 1; }
        function accFieldMs() { return accountRank() >= 24 ? 12000 : 10000; }
        function applyAccountPerks() { MAX_ENERGY_BEANS = accMaxBeans(); if (typeof updateEnergyBeanDisplay === 'function') try { updateEnergyBeanDisplay(); } catch (_) {} }

        // XP earned during a battle is only collected here and paid out when the battle ends.
        let runXP = { kills: 0, win: 0, first: 0, missions: 0 };
        function xpGroup(t) { t = clampTier(t); return t >= 7 ? { kill: 4, win: 150, first: 1000 } : t >= 4 ? { kill: 3, win: 100, first: 500 } : { kill: 2, win: 50, first: 200 }; }
        function killXP(z) { return xpGroup(currentTier).kill + ((ZOMBIE_TYPES[z.type] || {}).elite ? 2 : 0); }
        function runXPTotal() { return runXP.kills + runXP.win + runXP.first + runXP.missions; }
        let rankUpQueue = [], rankUpShowing = false;
        function awardXP(n, delayMs) {
            n = Math.max(0, Math.floor(n)); const oldXP = account.xp, oldRank = rankFromXP(oldXP);
            account.xp = Math.min(TOTAL_RANK_XP, account.xp + n);
            const newRank = rankFromXP(account.xp);
            for (let r = Math.max(account.rewarded, 1) + 1; r <= newRank; r++) {
                const p = RANK_PERKS.find(x => x.rank === r); if (p && p.fert) plantProgress.fertilizer = (plantProgress.fertilizer || 0) + p.fert;
            }
            if (newRank > account.rewarded) { account.rewarded = newRank; savePlantProgress(); }
            for (let r = oldRank + 1; r <= newRank; r++) rankUpQueue.push(r);
            saveAccount(); applyAccountPerks(); renderHomeRank(); try { updateFertilizerHome(); } catch (_) {}
            if (rankUpQueue.length && !rankUpShowing) setTimeout(showNextRankUp, delayMs || 400);
            return { gained: n, oldXP, oldRank, newRank };
        }
        function commitPendingRunXP() { commitRunMastery(); const t = runXPTotal(); if (t > 0) awardXP(t, 300); runXP = { kills: 0, win: 0, first: 0, missions: 0 }; }
        function rankProgress(xp) { const r = rankFromXP(xp); if (r >= MAX_RANK) return { r, pct: 100, cur: 0, need: 0 }; const cur = xp - RANK_XP_CUM[r], need = RANK_XP_NEED[r - 1]; return { r, pct: 100 * cur / need, cur, need }; }
        function renderModalXP() {
            const box = document.getElementById('modal-xp'); if (!box) return;
            const parts = [['⚔️ Zombies defeated', runXP.kills], ['🏁 Victory', runXP.win], ['🥇 First clear', runXP.first], ['📋 Daily missions', runXP.missions]].filter(x => x[1] > 0);
            const total = runXPTotal();
            const res = awardXP(total, 1500);
            runXP = { kills: 0, win: 0, first: 0, missions: 0 };
            const before = rankProgress(res.oldXP), after = rankProgress(account.xp);
            box.innerHTML = `<div class="mx-head">🎖️ +${total} XP</div>${parts.map(p => `<div class="mx-row"><span>${p[0]}</span><b>+${p[1]}</b></div>`).join('')}
              <div class="mx-bar rk-b${rankBracket(after.r)}"><div class="mx-fill" style="width:${res.oldRank === after.r ? before.pct : 0}%"></div></div>
              <div class="mx-foot">Gardener Rank ${res.oldRank}${after.r > res.oldRank ? ` → <b>${after.r}</b> 🎉` : ''}${after.r < MAX_RANK ? ` · ${Math.floor(after.cur)}/${after.need} XP` : ' · MAX'}</div>`;
            box.classList.remove('hidden');
            const fill = box.querySelector('.mx-fill');
            requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = after.pct + '%'; }));
        }
        function applyFarmerLevelTheme() {
            const level = rankBracket(accountRank());
            document.body.dataset.farmerLevel = String(level);
        }
        applyFarmerLevelTheme();
        function renderHomeRank() {
            applyFarmerLevelTheme();
            const el = document.getElementById('home-rank'); if (!el) return;
            const r = accountRank(), br = rankBracket(r), pr = rankProgress(account.xp);
            const next = RANK_PERKS.find(p => p.rank > r);
            const sparks = br >= 3 ? Array.from({ length: br === 5 ? 14 : 8 }, (_, i) => `<i class="rk-sp" style="left:${(i * 37) % 100}%;--d:${(i % 5) * 0.55}s">✦</i>`).join('') : '';
            const chips = TITLE_BADGES.map(b => `<span class="rk-chip ${r >= b.rank ? 'on rk-chip-b' + rankBracket(b.rank) : 'off'}" title="${r >= b.rank ? b.name : 'Reach rank ' + b.rank}">${r >= b.rank ? b.icon : '🔒'}<em>${r >= b.rank ? b.name : 'Rank ' + b.rank}</em></span>`).join('');
            const perks = RANK_PERKS.map(p => `<div class="rk-perk ${r >= p.rank ? 'got' : ''}"><span>${r >= p.rank ? '✓' : '🔒'} Rank ${p.rank}</span><span>${p.icon} ${p.text}</span></div>`).join('');
            const key = [r, Math.floor(account.xp), accStartSun()].join('|');
            if (el._k === key) return; el._k = key;
            el.innerHTML = `<div class="rk rk-b${br}"><div class="rk-medal"><div class="rk-rays"></div><div class="rk-ring"></div><div class="rk-num">${r}</div>${br === 5 ? '<div class="rk-crown">👑</div>' : ''}</div>
              <div class="rk-info"><div class="rk-name"><span class="rk-title">${rankTitle(r)}</span><span class="rk-rank">Gardener Rank ${r}${r >= MAX_RANK ? ' · MAX' : ''}</span></div>
              <div class="rk-bar"><div class="rk-fill" style="width:${pr.pct}%"><i class="rk-gloss"></i></div><div class="rk-sparks">${sparks}</div></div>
              <div class="rk-xp"><span>${r >= MAX_RANK ? 'MAX RANK — total ' + account.xp.toLocaleString() + ' XP' : Math.floor(pr.cur).toLocaleString() + ' / ' + pr.need.toLocaleString() + ' XP'}</span><span>${next ? `Next perk · Rank ${next.rank}: ${next.icon} ${next.text}` : 'All perks unlocked!'}</span></div>
              <div class="rk-chips">${chips}</div>
              <details class="rk-perks"><summary>All Gardener Rank perks</summary>${perks}</details></div></div>`;
        }
        function showNextRankUp() {
            if (rankUpShowing || !rankUpQueue.length) return;
            if (mastShowing) { setTimeout(showNextRankUp, 900); return; }
            const r = rankUpQueue.shift(); rankUpShowing = true;
            const br = rankBracket(r), perks = RANK_PERKS.filter(p => p.rank === r);
            const badge = TITLE_BADGES.find(b => b.rank === r);
            let ov = document.getElementById('rankup-overlay');
            if (!ov) { ov = document.createElement('div'); ov.id = 'rankup-overlay'; document.body.appendChild(ov); }
            const conf = Array.from({ length: 16 + br * 8 }, (_, i) => `<i class="ru-conf" style="left:${(i * 53) % 100}%;--d:${(i % 9) * 0.22}s;--t:${2.4 + (i % 5) * 0.4}s;--c:${['#fde047', '#4ade80', '#38bdf8', '#f472b6', '#fb923c'][i % 5]}"></i>`).join('');
            ov.className = 'rk-b' + br; ov.style.pointerEvents='auto'; ov.style.display = 'flex';
            ov.innerHTML = `<div class="ru-rays"></div>${conf}<div class="ru-card"><div class="ru-ring r1"></div><div class="ru-ring r2"></div>
              <div class="ru-kicker">RANK UP!</div><div class="ru-num">${r}</div><div class="ru-title">${rankTitle(r)}</div>
              ${badge ? `<div class="ru-badge">${badge.icon}<span>New title badge: <b>${badge.name}</b></span></div>` : ''}
              <div class="ru-perks">${perks.length ? perks.map(p => `<div class="ru-perk">${p.icon} ${p.text}</div>`).join('') : '<div class="ru-perk dim">Keep growing — the next perk is closer!</div>'}</div>
              <div class="ru-btns"><button onclick="closeRankUp()">${rankUpQueue.length ? 'Next ▶' : 'Continue'}</button>${rankUpQueue.length ? '<button class="alt" onclick="rankUpQueue=[];closeRankUp()">Skip all</button>' : ''}</div></div>`;
            try { playSound('levelup'); } catch (_) {}
        }
        function closeRankUp() {
            if(!rankUpShowing)return;
            const ov=document.getElementById('rankup-overlay');
            if(ov){ov.style.display='none';ov.style.pointerEvents='none';}
            rankUpShowing=false;
            if(rankUpQueue.length)setTimeout(showNextRankUp,250);else renderHomeRank();
        }

        // ===================== Plant Mastery (per-plant lifetime goals) =====================
        const MAST_KEY = 'pvzMastery_v1';
        const MAST_NAMES = ['Unranked', 'Novice', 'Apprentice', 'Adept', 'Expert', 'Master'];
        const MAST_ICON = ['🌱', '🥉', '🥈', '🥇', '💎', '🌈'];
        const MAST_BADGE = ['', 'Bronze Novice', 'Silver Apprentice', 'Gold Adept', 'Diamond Expert', 'Rainbow-Legendary Master'];
        const MAST_FERT = [0, 4, 6, 10, 20, 40];
        const MAST_NOBEAN = ['gravebuster', 'tileturnip', 'powerlily', 'jalapeno', 'thymewarp', 'cherrybomb', 'blover', 'iceberglettuce'];
        const MAST_DEF = ['wallnut', 'tallnut', 'garlic', 'celery', 'infinut', 'torchwood'];
        const MAST_SUP = ['sunflower', 'twinsunflower', 'sunshroom', 'primalsunflower', 'powerlily', 'blover', 'iceberglettuce', 'gravebuster', 'tileturnip', 'thymewarp', 'intensivecarrot', 'sweetpotato'];
        const MAST_SUN = ['sunflower', 'twinsunflower', 'sunshroom', 'primalsunflower'];
        // Estimated "best single use" (Lv.5 ability) damage per attacking plant. Goals are multiples of this.
        const MAST_ATK_REF = { peashooter: 700, snowpea: 650, firepea: 850, cherrybomb: 2400, potatomine: 900, bonkchoy: 1500, gatlingpea: 2500, spikeweed: 800, cabbagetosser: 900, corntosser: 1000, firedragon: 2500, snowdragon: 2200, cactus: 1200, coconutcannon: 3000, spikerock: 1200, peapod: 1500, melonpult: 2200, wintermelon: 3000, lightningreed: 2000, rotobaga: 1800, citron: 2500, jalapeno: 1800, primalpeashooter: 2500, laserbean: 2800, magnetshroom: 600, bowlingbulb: 1500, grimrose: 1500, shadowshroom: 1500, dusklobber: 1800, chomper: 2000, sapling: 1000, electricblueberry: 1800, electricpeashooter: 1500, primalpotatomine: 1500 };
        const MAST_SUP_REF = { sunflower: 115, twinsunflower: 440, sunshroom: 95, primalsunflower: 190, sweetpotato: 100, intensivecarrot: 150, powerlily: 3, gravebuster: 3, tileturnip: 3, blover: 6, iceberglettuce: 6, thymewarp: 6 };
        function mastCat(k) { return MAST_DEF.includes(k) ? 'def' : MAST_SUP.includes(k) ? 'sup' : 'atk'; }
        function mastRef(k) { const c = mastCat(k); if (c === 'def') return Math.max(150, Math.round(PLANT_TYPES[k].hp * 2)); if (c === 'sup') return MAST_SUP_REF[k] || 100; return MAST_ATK_REF[k] || 1500; }
        function mastMetricLabel(k) {
            const c = mastCat(k);
            if (c === 'def') return ['🛡️', 'damage absorbed'];
            if (c === 'atk') return ['⚔️', 'damage dealt'];
            if (MAST_SUN.includes(k)) return ['☀️', 'sun produced'];
            if (k === 'sweetpotato' || k === 'intensivecarrot') return ['💚', 'HP healed'];
            if (['blover', 'iceberglettuce', 'thymewarp'].includes(k)) return ['🌀', 'zombies affected'];
            return ['✨', 'support uses'];
        }
        var mastery = (() => { try { return normalizeMastery(JSON.parse(localStorage.getItem(MAST_KEY) || '{}')); } catch (_) { return {}; } })();
        function normalizeMastery(raw) {
            const out = {};
            if (raw && typeof raw === 'object') Object.keys(raw).forEach(k => {
                if (!PLANT_TYPES[k]) return; const m = raw[k] || {};
                out[k] = { planted: Math.max(0, Math.floor(+m.planted || 0)), dmg: Math.max(0, Math.round(+m.dmg || 0)), taken: Math.max(0, Math.round(+m.taken || 0)), sup: Math.max(0, Math.round(+m.sup || 0)), beans: Math.max(0, Math.floor(+m.beans || 0)), tier: Math.max(0, Math.min(5, Math.floor(+m.tier || 0))) };
            });
            return out;
        }
        function saveMastery() { try { localStorage.setItem(MAST_KEY, JSON.stringify(mastery)); } catch (_) {} }
        function masteryOf(k) { return mastery[k] || (mastery[k] = { planted: 0, dmg: 0, taken: 0, sup: 0, beans: 0, tier: 0 }); }
        function mastTier(k) { const m = mastery[k]; return m ? m.tier : 0; }
        function mastMetricValue(k, m) { const c = mastCat(k); return c === 'def' ? m.taken : c === 'sup' ? m.sup : m.dmg; }
        // Requirements for reaching mastery tier t (1..5) for plant k: [{ic,label,cur,need}]
        function mastReqs(k, t) {
            const m = mastery[k] || { planted: 0, dmg: 0, taken: 0, sup: 0, beans: 0, tier: 0 };
            const c = mastCat(k), R = mastRef(k), [mic, mlab] = mastMetricLabel(k), beanable = !MAST_NOBEAN.includes(k);
            const mult = { 2: { atk: 20, def: 10, sup: 10 }, 4: { atk: 60, def: 80, sup: 70 }, 5: { atk: 150, def: 170, sup: 160 } };
            const plantsNeed = [0, 20, 0, 100, 200, 400][t], beansNeed = [0, 0, 0, 50, 100, 300][t];
            const out = [];
            if (plantsNeed) out.push({ ic: '🌱', label: 'Plant it', cur: m.planted, need: plantsNeed, unit: 'times' });
            if (mult[t]) out.push({ ic: mic, label: mlab[0].toUpperCase() + mlab.slice(1), cur: mastMetricValue(k, m), need: Math.round(R * mult[t][c]), unit: '' });
            if (beansNeed && beanable) out.push({ ic: '🫘', label: 'Energy Bean uses', cur: m.beans, need: beansNeed, unit: 'times' });
            return out;
        }
        function mastMet(k, t) { return mastReqs(k, t).every(r => r.cur >= r.need); }
        function mastPassive(k, tier) {
            tier = tier == null ? mastTier(k) : tier; if (tier < 3) return null;
            const awk = tier >= 5, c = mastCat(k), name = PLANT_TYPES[k].name;
            if (c === 'atk') { const ch = k === 'peashooter' ? (awk ? 0.5 : 0.15) : (awk ? 0.4 : 0.15); return { kind: 'double', ch, title: k === 'peashooter' ? 'Twin Pea' : 'Overgrowth Strike', text: k === 'peashooter' ? `${Math.round(ch * 100)}% chance to fire a double pea` : `${Math.round(ch * 100)}% chance for each hit to deal double damage` }; }
            if (c === 'def') { const n = awk ? 50 : 10; return { kind: 'regen', regen: n, title: 'Bark Regeneration', text: `Regenerates ${n} HP/sec when not hit for 3 seconds` }; }
            if (MAST_SUN.includes(k)) { const ch = awk ? 0.3 : 0.05; return { kind: 'bean', ch, title: 'Bean Blossom', text: `${Math.round(ch * 100)}% chance to drop an extra Energy Bean when producing sun (at most one every 10s)` }; }
            if (k === 'powerlily') { const ch = awk ? 0.5 : 0.15; return { kind: 'lily', ch, title: 'Lily Surge', text: `${Math.round(ch * 100)}% chance to give 1 extra Energy Bean` }; }
            if (k === 'sweetpotato') { const m = awk ? 1.5 : 0.5; return { kind: 'heal', mult: m, title: 'Honey Mend', text: `Heals ${Math.round(m * 100)}% more HP` }; }
            const rf = awk ? 0.4 : 0.15; return { kind: 'refund', refund: rf, title: 'Frugal Roots', text: `Refunds ${Math.round(rf * 100)}% of its sun cost when planted` };
        }
        // ---- run tracking: numbers collected during a battle are only added to the profile after it ends ----
        var runMast = {}, mastQueue = [], mastShowing = false;
        function mrun(k) { return runMast[k] || (runMast[k] = { planted: 0, dmg: 0, taken: 0, sup: 0, beans: 0 }); }
        var MST = {
            src: null, cur: null, n0: 0, busy: false, pas: {}, catc: {}, lastBean: 0,
            cat(k) { return this.catc[k] || (this.catc[k] = mastCat(k)); },
            inst(o, isZ) {
                let v = o.hp;
                Object.defineProperty(o, '_mh', { value: 1, enumerable: false, configurable: true });
                Object.defineProperty(o, 'hp', {
                    enumerable: true, configurable: true, get() { return v; },
                    set(n) {
                        const old = v; v = n;
                        if (isZ) {
                            if (n < old && old > 0 && MST.src && !MST.busy && MST.cat(MST.src) === 'atk') {
                                const t = MST.src, d = old - Math.max(0, n), r = mrun(t); r.dmg += d;
                                const pa = MST.pas[t];
                                if (pa && pa.kind === 'double' && v > 0 && Math.random() < pa.ch) {
                                    MST.busy = true; const e = Math.min(d, v); v -= e; MST.busy = false; r.dmg += e;
                                    if (typeof fxBudget !== 'undefined' && fxBudget > 0 && Date.now() - (o.lastMfx || 0) > 260) { o.lastMfx = Date.now(); fxBudget--; try { emitParticles(o.x + 3, ((o.r + 0.5) / ROWS) * 100, ['✨', '💥'], 1); } catch (_) {} }
                                }
                            }
                        } else {
                            if (n < old && old > 0) { o._lastHurt = Date.now(); if (MST.cat(o.type) === 'def') mrun(o.type).taken += Math.min(old, old - Math.max(0, n)); }
                            else if (n > old && MST.src && !MST.busy && MST.cat(MST.src) === 'sup') {
                                const cap = o.maxHp || n, h = Math.min(n, cap) - old;
                                if (h > 0) { mrun(MST.src).sup += h; const pa = MST.pas[MST.src]; if (pa && pa.kind === 'heal') { MST.busy = true; v = Math.min(cap, v + h * pa.mult); MST.busy = false; } }
                            }
                        }
                    }
                });
            },
            hook() { for (let i = 0; i < zombies.length; i++) { const z = zombies[i]; if (z && !z._mh) this.inst(z, true); } for (let i = 0; i < plants.length; i++) { const p = plants[i]; if (p && !p._mh) this.inst(p, false); } },
            begin(p) {
                this.flush(); this.src = p.type; this.cur = p; this.n0 = suns.length;
                const pa = this.pas[p.type];
                if (pa && pa.kind === 'regen') {
                    const now = Date.now(), dt = Math.min(120, now - (p._mrT || now)); p._mrT = now;
                    if (now - (p._lastHurt || 0) > 3000 && p.hp > 0 && p.hp < p.maxHp) {
                        p.hp = Math.min(p.maxHp, p.hp + pa.regen * dt / 1000);
                        if (now - (p._mrFx || 0) > 1700) { p._mrFx = now; try { emitParticles(((p.c + 0.5) / COLS) * 100, ((p.r + 0.4) / ROWS) * 100, ['💚'], 1); } catch (_) {} }
                    }
                }
            },
            flush() {
                const p = this.cur; if (!p) return; this.cur = null;
                for (let i = this.n0; i < suns.length; i++) {
                    const s = suns[i]; if (!s || s._m) continue; s._m = 1;
                    mrun(p.type).sup += (+s.val || 0);
                    const pa = this.pas[p.type], now = Date.now();
                    if (pa && pa.kind === 'bean' && Math.random() < pa.ch && now - this.lastBean > 10000) {
                        this.lastBean = now;
                        energyBeanDrops.push({ id: now + Math.random(), x: (p.c / COLS) * 100 + 3, y: (p.r / ROWS) * 100 + 2 });
                        try { playSound('bean'); fxLabel('BEAN BLOSSOM!', (p.c + 0.5) / COLS * 100, (p.r / ROWS) * 100, '#a5f3fc', 14); } catch (_) {}
                    }
                }
            },
            end() { this.flush(); this.src = null; },
            onPlant(k) {
                mrun(k).planted++;
                const pa = this.pas[k], c = mastCat(k);
                if (c === 'sup' && !MAST_SUN.includes(k) && k !== 'sweetpotato' && k !== 'intensivecarrot') mrun(k).sup += ['blover', 'iceberglettuce', 'thymewarp'].includes(k) ? Math.min(12, zombies.filter(z => z.hp > 0).length) : 1;
                if (!pa) return;
                if (pa.kind === 'refund') { const back = Math.floor(PLANT_TYPES[k].cost * pa.refund); if (back > 0) { sun += back; updateSunDisplay(); try { fxLabel('+' + back + '☀️', 50, 50, '#fde68a', 16); } catch (_) {} } }
                if (pa.kind === 'lily' && Math.random() < pa.ch) { energyBeans = Math.min(MAX_ENERGY_BEANS, energyBeans + 1); updateEnergyBeanDisplay(); }
            },
            bean(k) { mrun(k).beans++; }
        };
        function applyMasteryEffects() {
            Object.keys(PLANT_TYPES).forEach(k => {
                const info = PLANT_TYPES[k]; if (info.baseCost == null) { info.baseCost = info.cost; info.baseCd = info.cd; }
                const t = mastTier(k);
                info.cost = Math.round(info.baseCost * (t >= 1 ? 0.95 : 1));
                info.cd = Math.round(info.baseCd * (t >= 2 ? 0.9 : 1));
                MST.pas[k] = mastPassive(k);
            });
        }
        applyMasteryEffects();
        function commitRunMastery() {
            const keys = Object.keys(runMast); if (!keys.length) return;
            keys.forEach(k => { const r = runMast[k], m = masteryOf(k); m.planted += r.planted; m.dmg += Math.round(r.dmg); m.taken += Math.round(r.taken); m.sup += Math.round(r.sup); m.beans += r.beans; });
            runMast = {};
            let ups = 0;
            keys.forEach(k => {
                const m = masteryOf(k);
                while (m.tier < 5 && mastMet(k, m.tier + 1)) {
                    m.tier++; const t = m.tier, fert = MAST_FERT[t];
                    plantProgress.fertilizer = (plantProgress.fertilizer || 0) + fert;
                    mastQueue.push({ key: k, tier: t, fert }); ups++;
                }
            });
            saveMastery();
            if (ups) { savePlantProgress(); try { updateFertilizerHome(); } catch (_) {} applyMasteryEffects(); setTimeout(showNextMastery, 2200); }
        }
        function mastPerkLines(k, t) {
            const L = [`🧪 <b>+${MAST_FERT[t]}</b> fertilizer`];
            if (t === 1) L.push('🏷️ Sun cost <b>-5%</b>');
            if (t === 2) L.push('⏱️ Seed cooldown <b>-10%</b>');
            if (t === 3) L.push('🟡 Golden seed-card border', '🌿 Signature Passive');
            if (t === 4) L.push('💎 Diamond seed-card border & plant aura');
            if (t === 5) L.push('🌈 Rainbow-legendary border & aura', '⚡ Awakened Signature Passive');
            const pa = mastPassive(k, t); if (pa && t >= 3) L.push(`<span class="ms-pas">${pa.title}: ${pa.text}</span>`);
            L.push(`${MAST_ICON[t]} New badge: <b>${MAST_BADGE[t]}</b>`);
            return L;
        }
        function showNextMastery() {
            if (mastShowing || !mastQueue.length) return;
            if (rankUpShowing || (typeof isRunning !== 'undefined' && isRunning)) { setTimeout(showNextMastery, 900); return; }
            const q = mastQueue.shift(); mastShowing = true;
            const info = PLANT_TYPES[q.key], t = q.tier;
            let ov = document.getElementById('mastup-overlay');
            if (!ov) { ov = document.createElement('div'); ov.id = 'mastup-overlay'; document.body.appendChild(ov); }
            const cols = ['#fde047', '#4ade80', '#38bdf8', '#f472b6', '#fb923c'];
            const conf = Array.from({ length: 18 + t * 8 }, (_, i) => `<i class="ms-conf" style="left:${(i * 47) % 100}%;--d:${(i % 9) * 0.2}s;--t:${2.2 + (i % 5) * 0.4}s;--c:${cols[i % 5]}"></i>`).join('');
            ov.className = 'ms-t' + t; ov.style.pointerEvents='auto'; ov.style.display = 'flex';
            ov.innerHTML = `<div class="ms-rays"></div>${conf}<div class="ms-card">
              <div class="ms-emblem"><i class="ms-ring a"></i><i class="ms-ring b"></i><span class="ms-plant">${info.emoji}</span><span class="ms-tier">${MAST_ICON[t]}</span></div>
              <div class="ms-kicker">MASTERY UP!</div><div class="ms-name">${info.name}</div><div class="ms-rank">${MAST_NAMES[t]} Mastery</div>
              <div class="ms-rewards">${mastPerkLines(q.key, t).map(x => `<div class="ms-rw">${x}</div>`).join('')}</div>
              <div class="ms-btns"><button onclick="closeMastery()">${mastQueue.length ? 'Next ▶' : 'Continue'}</button>${mastQueue.length ? '<button class="alt" onclick="mastQueue=[];closeMastery()">Skip all</button>' : ''}</div></div>`;
            try { playSound('levelup'); } catch (_) {}
        }
        function closeMastery() {
            if(!mastShowing)return;
            const ov=document.getElementById('mastup-overlay');
            if(ov){ov.style.display='none';ov.style.pointerEvents='none';}
            mastShowing=false;
            if(mastQueue.length)setTimeout(showNextMastery,250);
            try{if(profilePlantKey)renderProfileMastery(profilePlantKey);}catch(_){}
        }
        function fmtN(n) { return Math.round(n).toLocaleString('en-US'); }
        function renderProfileMastery(key) {
            const box = document.getElementById('profile-mastery'); if (!box) return;
            if (!isPlantUnlocked(key)) { box.innerHTML = ''; return; }
            const cur = mastTier(key), info = PLANT_TYPES[key];
            let rows = '';
            for (let t = 1; t <= 5; t++) {
                const done = t <= cur, next = t === cur + 1;
                const reqs = mastReqs(key, t).map(r => { const pc = Math.min(100, 100 * r.cur / r.need); return `<div class="pm-req${r.cur >= r.need ? ' ok' : ''}"><span>${r.ic} ${r.label}</span><div class="pm-bar"><i style="width:${pc}%"></i></div><b>${fmtN(Math.min(r.cur, r.need))}/${fmtN(r.need)}</b></div>`; }).join('');
                const rw = [`+${MAST_FERT[t]} 🧪`, ['', '-5% sun cost', '-10% seed cooldown', 'gold border + passive', 'diamond border', 'rainbow border + awakened passive'][t], MAST_BADGE[t] + ' badge'].filter(Boolean).join(' · ');
                rows += `<div class="pm-row ${done ? 'done' : next ? 'next' : 'lock'}"><div class="pm-badge b${t}"><span>${MAST_ICON[t]}</span></div><div class="pm-body"><div class="pm-rt">${MAST_NAMES[t]} Mastery ${done ? '✓' : ''}</div><div class="pm-rw">${rw}</div>${done ? '' : reqs}</div></div>`;
            }
            const pa = mastPassive(key), nextPa = mastPassive(key, cur >= 3 ? 5 : 3);
            const passive = cur >= 3 ? `<div class="pm-pas t${cur}"><b>🌿 ${pa.title}${cur >= 5 ? ' (Awakened)' : ''}:</b> ${pa.text}${cur < 5 ? `<div class="pm-dim">Master awakens it: ${nextPa.text}</div>` : ''}</div>` : `<div class="pm-pas lock">🔒 Signature Passive at Adept Mastery: <b>${mastPassive(key, 3).title}</b> — ${mastPassive(key, 3).text}</div>`;
            const m = mastery[key] || { planted: 0 };
            box.innerHTML = `<div class="pm-box t${cur}"><div class="pm-head"><div class="pm-medal b${cur}"><span>${MAST_ICON[cur]}</span></div><div><div class="pm-title">🏅 Plant Mastery — ${MAST_NAMES[cur]}</div><div class="pm-sub">${info.name} · planted ${fmtN(m.planted)} times in total</div></div></div>${passive}${rows}</div>`;
        }
        function mastCardCls(key) { const t = mastTier(key); return t >= 3 ? ' mc mc-t' + t : ''; }
        function mastPip(key) { const t = mastTier(key); return t ? `<i class="mc-pip p${t}">${MAST_ICON[t]}</i>` : ''; }

        // ===================== Star objectives =====================
        const STAR_RECORDS_KEY = 'pvzStarRecords_v1';
        let starRecords = (() => { try { const o = JSON.parse(localStorage.getItem(STAR_RECORDS_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (_) { return {}; } })();
        function normalizeStarRecords(raw) { const out = {}; if (raw && typeof raw === 'object') Object.keys(raw).forEach(k => { const n = Math.max(0, Math.min(3, Number(raw[k]) || 0)); if (/^\d+_\d+$/.test(k) && n) out[k] = n; }); return out; }
        function saveStarRecords() { try { localStorage.setItem(STAR_RECORDS_KEY, JSON.stringify(starRecords)); } catch (_) {} }
        function starKey(l, t) { return l + '_' + t; }
        const STAR_SELF_CONSUMED = new Set(['cherrybomb','jalapeno','potatomine','primalpotatomine','thymewarp','intensivecarrot','bowlingbulb','iceberglettuce','doomshroom','squash','blover','tileturnip']);
        let starRun = { mowers: 0, lost: 0, ticks: 0, alive: new Map(), done: false };
        function resetStarRun() { starRun = { mowers: 0, lost: 0, ticks: 0, alive: new Map(), done: false }; }
        // "Par" time for the speed star: calibrated against a fast, strong defence (≈ 1.35x that clear time),
        // and a little longer for each higher Zombie Level because those zombies are tougher.
        function parTimeSec(level) {
            const waves = (LEVELS[level] || {}).maxWaves || 3;
            let base;
            if (level === 11) base = 150 / 0.68;
            else { let ms = 0; for (let w = 1; w <= waves; w++) ms += (3 + w * 3) * (4000 / (1 + w * 0.2)); base = ms / 1000 * 1.2 + 25 * waves; }
            return Math.max(60, Math.round(base * 0.68 * (1 + 0.06 * (clampTier(currentTier) - 1)) / 10) * 10);
        }
        function fmtTime(sec) { return Math.floor(sec / 60) + ':' + String(Math.round(sec % 60)).padStart(2, '0'); }
        function starObjective(level) {
            const k = (level - 1) % 3;
            if (k === 0) return { kind: 'sun', target: 400, text: 'Win with at least 400 ☀️ Sun left' };
            if (k === 1) return { kind: 'plants', target: 2, text: "Don't lose more than 2 plants" };
            const t = parTimeSec(level);
            return { kind: 'time', target: t, text: `Win within ${fmtTime(t)}` };
        }
        function starProgress() {
            const o = starObjective(currentLevel), sec = starRun.ticks * 0.05;
            let ok, prog;
            if (o.kind === 'sun') { ok = sun >= o.target; prog = `☀️ ${Math.floor(sun)} / ${o.target}`; }
            else if (o.kind === 'plants') { ok = starRun.lost <= o.target; prog = `Lost ${starRun.lost} / ${o.target}`; }
            else { ok = sec <= o.target; prog = `${fmtTime(sec)} / ${fmtTime(o.target)}`; }
            return { o, ok, prog };
        }
        function updateStarGoals(force) {
            const el = document.getElementById('star-goals'); if (!el) return;
            const p = starProgress();
            // The Sun goal is only judged at the end of the match, so it never shows as failed mid-battle.
            const key = [currentLevel, starRun.mowers, p.prog, p.ok].join('|');
            if (!force && el._k === key) return; el._k = key;
            const f3 = p.o.kind === 'sun' ? false : !p.ok;
            el.innerHTML = `<div class="sg-title">⭐ BONUS STARS</div>
              <div class="sg-row"><span class="sg-star">⭐</span><span class="sg-txt">Clear all waves</span></div>
              <div class="sg-row ${starRun.mowers ? 'sg-fail' : ''}"><span class="sg-star">⭐</span><span class="sg-txt">Don't use any lawnmower</span></div>
              <div class="sg-row ${f3 ? 'sg-fail' : ''}"><span class="sg-star">⭐</span><span class="sg-txt">${p.o.text}<span class="sg-prog">${p.prog}</span></span></div>`;
        }
        function trackPlantLosses() {
            const now = new Map();
            plants.forEach(p => now.set(p.id, p));
            starRun.alive.forEach((p, id) => {
                if (!now.has(id) && p.hp <= 0 && !p._shoveled && !STAR_SELF_CONSUMED.has(p.type)) starRun.lost++;
            });
            starRun.alive = now;
        }
        function computeStars() {
            const p = starProgress();
            return [true, starRun.mowers === 0, p.ok];
        }
        function renderModalStars(won) {
            const box = document.getElementById('modal-stars'); if (!box) return 0;
            const got = won ? computeStars() : [false, false, false];
            const caps = ['Clear all waves', "No lawnmowers used", starObjective(currentLevel).text];
            box.innerHTML = got.map((g, i) => `<div class="ms-slot ${g ? 'on' : 'off'}"><div class="ms-star" style="${g ? 'animation-delay:' + (i * 0.35) + 's,' + (0.8 + i * 0.35) + 's' : 'animation-delay:' + (i * 0.1) + 's'}">⭐</div><div class="ms-cap">${caps[i]}</div></div>`).join('') + `<div class="ms-total" style="color:${got.filter(Boolean).length === 3 ? '#fcd34d' : '#94a3b8'}">${got.filter(Boolean).length} / 3 stars</div>`;
            box.style.flexWrap = 'wrap';
            box.classList.remove('hidden');
            // sparkles around each earned star
            box.querySelectorAll('.ms-slot.on').forEach((slot, n) => {
                const star = slot.querySelector('.ms-star');
                setTimeout(() => {
                    for (let k = 0; k < 8; k++) {
                        const sp = document.createElement('span'); sp.className = 'ms-spark'; sp.textContent = ['✨', '⭐', '✦'][k % 3];
                        const a = (k / 8) * Math.PI * 2, d = 46 + Math.random() * 22;
                        sp.style.setProperty('--dx', Math.cos(a) * d + 'px'); sp.style.setProperty('--dy', Math.sin(a) * d + 'px');
                        sp.style.animationDelay = (k * 0.03) + 's'; star.appendChild(sp);
                    }
                }, 350 + n * 350);
            });
            return got.filter(Boolean).length;
        }

        function triggerGameOver() {
            if (window.__LESSON && window.lessonFail) return window.lessonFail();
            commitRunMastery();
            const nextBtn = document.getElementById('modal-next-level-btn');
            if (nextBtn) nextBtn.classList.add('hidden');
            toggleGame();
            finishDailyMissions(false);
            showModal('THE ZOMBIES ATE YOUR BRAINS!', 'A zombie passed through your lawn defense.', '🧟');
            renderModalStars(false);
            renderModalXP();
        }

        function triggerVictory() {
            const worldsUnlockedBefore = unlockedWorldCount();
            toggleGame();
            commitRunMastery();
            finishDailyMissions(true);
            trackPlantLosses();
            const starsEarned = computeStars().filter(Boolean).length;
            const prevStars = starRecords[starKey(currentLevel, currentTier)] || 0;
            let starBonus = 0;
            if (starsEarned > prevStars) { starRecords[starKey(currentLevel, currentTier)] = starsEarned; saveStarRecords(); }
            if (starsEarned === 3 && prevStars < 3) {
                starBonus = 2;
                plantProgress.fertilizer = (plantProgress.fertilizer || 0) + starBonus; savePlantProgress();
            }

            // Fertilizer is only awarded the first time each stage + zombie level is cleared.
            let reward = 0, plantReward = null, levelBonus = 0; const chestsBefore = pendingChestCount();
            if (!isTierCleared(currentLevel, currentTier)) {
                reward = TIER_REWARDS[currentTier - 1];
                if (tiersClearedCount(currentLevel) === 0) { levelBonus = levelClearBonus(currentLevel); reward += levelBonus; }
                completedTiers[currentLevel] = [...(completedTiers[currentLevel] || []), currentTier].sort((a, b) => a - b);
                plantProgress.fertilizer = (plantProgress.fertilizer || 0) + reward;
                plantReward = awardCampaignPlant(currentLevel,currentTier);
                saveCompletedTiers();
                savePlantProgress();
            }
            checkWorldUnlockNotices(worldsUnlockedBefore);
            { const g = xpGroup(currentTier); runXP.win += g.win; if (reward > 0) runXP.first += g.first; }
            // Repeatable rewards: replaying an already-cleared stage still pays a bounty, plus a bigger first-win-of-the-day bonus.
            let bountyText = '';
            if (reward === 0) {
                const bounty = currentTier >= 7 ? 3 : currentTier >= 4 ? 2 : 1;
                const d0 = new Date(), today = `${d0.getFullYear()}-${d0.getMonth() + 1}-${d0.getDate()}`;
                let dailyBonus = 0;
                if (plantProgress.lastWinDay !== today) { dailyBonus = 3; plantProgress.lastWinDay = today; }
                plantProgress.fertilizer = (plantProgress.fertilizer || 0) + bounty + dailyBonus; savePlantProgress();
                bountyText = `Replay bounty: +${bounty} 🧪` + (dailyBonus ? ` and First Win of the Day: +${dailyBonus} 🧪` : '') + '!';
            }
            renderAdventureMap();
            updateNextLevelBtn();
            const rewardText = reward > 0 ? `First clear of Zombie Level ${currentTier}: +${reward - levelBonus} 🧪` + (levelBonus ? ` +${levelBonus} 🧪 first-time stage bonus` : '') + ' Fertilizer!' : bountyText;
            const chestNew = pendingChestCount() > chestsBefore;
            const plantText = (starBonus ? ` ⭐ All 3 stars: +${starBonus} 🧪 Bonus Fertilizer!` : '') + (plantReward ? ` You also unlocked ${plantReward}! 🌱` : '') + (chestNew ? ' 🎁 A Growth Chest is ready!' : '');
            const nextStep = currentLevel < 34 ? 'Explore the next stage or try a higher zombie level on the Adventure Map.' : 'You reached the end of the Quantum & Classical Physics Lab. Replay harder zombie levels to earn more rewards.';
            if (currentLevel === 11) showModal('ZOMBOSS DEFEATED!', `${rewardText}${plantText} ${nextStep}`, '🏆');
            else showModal(`LEVEL ${currentLevel} CLEARED!`, `${rewardText}${plantText} ${nextStep}`, plantReward?'🌱':'🌻');
            renderModalStars(true);
            renderModalXP();
            renderSelectionScreen();
            if (chestNew) setTimeout(openChests, 700);
        }

        function nextStageInfo() {
            const nl = currentLevel + 1;
            if (nl > 34 || !isAdventureLevelUnlocked(nl)) return null;
            const tier = clampTier(currentTier);
            return { level: nl, tier };
        }
        function updateNextLevelBtn() {
            const nextBtn = document.getElementById('modal-next-level-btn');
            if (nextBtn) nextBtn.classList.toggle('hidden', !nextStageInfo());
        }
        function playNextLevel() {
            // Go to the NEXT GAME LEVEL (stage), keeping the same Zombie Level when it is available.
            const n = nextStageInfo(); if (!n) return;
            currentLevel = n.level; currentTier = n.tier;
            const label = document.getElementById('selected-level-name');
            if (label) label.textContent = selectedLevelLabel();
            closeModal();
            startBattleWithDeck();
        }

        function showModal(title, desc, icon) {
            if (!modal) return;
            document.getElementById('modal-title').textContent = title;
            document.getElementById('modal-desc').textContent = desc;
            document.getElementById('modal-icon').textContent = icon;
            modal.classList.remove('hidden');
        }

        function closeModal() {
            if (modal) modal.classList.add('hidden');
            const ms = document.getElementById('modal-stars'); if (ms) ms.classList.add('hidden');
            const mx = document.getElementById('modal-xp'); if (mx) mx.classList.add('hidden');
        }

        window.addEventListener('keydown', (event)=>{
            if(event.key==='Escape'){
                closeGuideScreen();closeSaveScreen();
            }
        });


        // =====================================================================================
        // BEGINNER'S GUIDE: an interactive, in-game tutorial. A spotlight highlights the REAL buttons and
        // blocks everything else; each step advances only when the player really does the action
        // (steps poll the live game state). It walks through a real Level 1 battle.
        // =====================================================================================
        const TUT_DONE_KEY = 'pvzBeginnerGuideDone', TUT_GIFT_KEY = 'pvzBeginnerGuideGift';
        let tut = null, tutHold = false;
        const tutStore = {
            get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
            set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
        };
        const $id = id => document.getElementById(id);
        const isShown = id => { const e = $id(id); return !!e && !e.classList.contains('hidden'); };
        const lawnCell = (r, c) => document.querySelector(`#lawn-board .lawn-cell[data-r="${r}"][data-c="${c}"]`);
        const infoBtnFor = key => document.querySelector(`#available-plants-grid [data-plant="${key}"] .ps-info`);
        function tutLawnSpot(x, y, size) {
            const b = $id('lawn-board'); if (!b) return null;
            const r = b.getBoundingClientRect();
            return { left: r.left + r.width * x / 100 - size / 2, top: r.top + r.height * y / 100 - size / 2, width: size, height: size };
        }
        function tutGiveGift() {
            if (tutStore.get(TUT_GIFT_KEY)) return;
            tutStore.set(TUT_GIFT_KEY, '1');
            if ((plantProgress.fertilizer || 0) < 3) {
                plantProgress.fertilizer = 3;
                savePlantProgress(); updateFertilizerHome();
            }
        }
        const tutCanUpgrade = () => { const lv = plantLevel('sunflower'); return lv < 5 && (plantProgress.fertilizer || 0) >= PLANT_LEVEL_COSTS[lv]; };
        function tutSpawnZombie() {
            const t = ZOMBIE_TYPES.basic;
            const z = { id: Date.now() + Math.random(), r: 2, x: 78, type: 'basic', hp: t.hp * zombieHealthMult(currentTier), maxHp: t.maxHp * zombieHealthMult(currentTier), speed: t.speed, baseSpeed: t.speed, emoji: t.emoji, damage: t.damage * zombieAttackMult(currentTier), eating: false };
            zombies.push(z);
            tut.zombie = z;
        }

        function tutBuildSteps() {
            const S = [];
            const add = o => S.push(o);
            // ------------------------------------------------------------------ HOME SCREEN
            add({ id: 'welcome', title: 'Welcome, gardener! 🌻', next: true, nextLabel: "Let's go!",
                text: `This guide teaches you by <b>actually playing</b>. A glowing frame shows the real button to click &mdash; the rest of the screen is locked until you do. You can skip any time.` });
            add({ id: 'level', title: 'Your selected level', target: () => $id('home-level-box'), next: true,
                text: `This shows the <b>stage</b> (1&ndash;34) and the <b>Zombie Level</b> (1&ndash;7) you will fight. Higher zombie levels have tougher zombies but bigger first-clear rewards.` });
            add({ id: 'rank', title: 'Gardener Rank 🎖️', target: () => $id('home-rank'), next: true,
                text: `Every battle &mdash; even a loss &mdash; earns <b>XP</b> for your <b>Gardener Rank</b> (1&ndash;50): zombies defeated, wins, first clears, plant upgrades and daily missions all count. XP is added after the battle ends. Each rank-up plays a celebration and ranks unlock permanent perks: extra starting sun, more Energy Beans, shovel refunds, faster seed recharge and more, plus title badges and fertilizer.` });
            add({ id: 'chests', title: 'Growth Chests 🎁', target: () => $id('home-chest-btn'), next: true,
                text: `Every <b>first-time clear</b> of a stage at any Zombie Level counts toward <b>Growth Chests</b>: at 5, 10, 15, 20, 35, 60, 100, 150 and 230 clears you can open a chest and pick plants (or fertilizer). The big ones also award shining honor badges (bronze, silver, gold and prestige) for your home screen.` });
            add({ id: 'replay', title: "Replay this guide any time", target: () => $id('home-tutorial-btn'), next: true,
                text: `Want a refresher later? Press <b>🎓 Beginner's Guide</b> to run this lesson again.` });
            add({ id: 'missions', title: 'Fertilizer & daily missions', target: () => $id('home-missions-box'), next: true,
                text: `<b>🧪 Fertilizer</b> upgrades plants and buys store plants. Complete these <b>daily missions</b> (some fill up across several battles) to earn more &mdash; they refresh every day. Every first clear of a stage also pays a bonus of 3&ndash;10 🧪, and your <b>first win of each day on a replayed stage</b> pays a small bounty too.` });
            add({ id: 'start-intro', title: 'The Start Battle button', target: () => $id('home-start-btn'), next: true,
                text: `This big <b>⚔️ Start Battle!</b> button is how you begin a game: you pick a stage and Zombie Level, then build your plant team. We will press it in a moment &mdash; first, the other home-screen panels.` });
            add({ id: 'map-info', title: 'Adventure Map', target: () => $id('home-map-btn'), next: true,
                text: `<b>🗺️ Adventure Map</b> lets you browse all 4 worlds (34 stages) and choose a stage and Zombie Level without starting a battle. Each stage shows the <b>stars</b> you have earned in total (up to 21), and picking a stage shows the stars for each Zombie Level. A &#128274; stage unlocks when you clear the one before it.` });
            add({ id: 'encyclopedia', title: 'Plant & Zombie Guide', target: () => $id('home-guide-btn'), next: true,
                text: `The <b>📖 Plant &amp; Zombie Guide</b> is an encyclopedia of every plant and zombie, with stats and abilities &mdash; including the elite DNA-mutant zombies of World 3 and physics zombies of World 4.` });
            add({ id: 'store-open', title: 'Unlocking plants (1/2): the Store', target: () => $id('home-store-btn'), done: () => isShown('plant-store-screen'),
                text: `New plants come from two places. First, the store &mdash; click <b>🛒 Plant Store</b>.` });
            add({ id: 'store-info', title: 'Buying plants', target: () => $id('plant-store-grid'), next: true,
                text: `A few plants are on sale each day for <b>10&ndash;20 🧪 fertilizer</b> (from daily missions, first-clear rewards and chests). Buy one and it is yours for good. Stock refreshes every day.` });
            add({ id: 'store-rewards', title: 'Unlocking plants (2/2): rewards', target: () => $id('campaign-plant-unlocks'), next: true,
                text: `Second, some plants are <b>Adventure Map rewards</b>: beat the listed stage at the listed Zombie Level and the plant unlocks automatically (Growth Chests can hand out plants too).` });
            add({ id: 'store-close', title: 'Back to the home screen', target: () => $id('store-back-btn'), done: () => !isShown('plant-store-screen'),
                text: `Click <b>← Back</b>.` });
            add({ id: 'save', title: 'Save Progress', target: () => $id('home-save-btn'), next: true,
                text: `Your progress saves in this browser automatically. <b>💾 Save Progress</b> makes a <b>save code</b> so you can carry your game to another device.` });
            add({ id: 'start', title: 'Start Battle', target: () => $id('home-start-btn'), done: () => isShown('adventure-map-screen'),
                text: `Now click <b>⚔️ Start Battle!</b>. First you choose your stage and Zombie Level.` });
            add({ id: 'map-node', title: 'Choose a stage', target: () => document.querySelector('#adventure-map-nodes .adventure-node'), done: () => isShown('tier-picker-screen'),
                text: `Every node is a stage. Click <b>Stage 1</b> &mdash; the sunny lawn.` });
            add({ id: 'tier', title: 'Choose a Zombie Level', target: () => document.querySelector('#tier-picker-list button'),
                done: () => isShown('plant-select-screen') && currentLevel === 1 && currentTier === 1,
                text: `Click <b>Zombie Level 1</b>, the gentlest. Each of the 7 levels pays a one-time 🧪 fertilizer reward the first time you clear it, and each can earn up to <b>3 stars</b>.` });

            // ------------------------------------------------------------------ PLANT SELECTION PAGE
            add({ id: 'ps-intro', title: 'The plant selection page', target: () => $id('ps-back-btn'), next: true,
                text: `This is where you build your team. <b>← Home</b> takes you back to the home screen whenever you like, and <b>Start Battle</b> at the bottom begins the level you just chose.` });
            add({ id: 'ps-info', title: 'Plant details', target: () => infoBtnFor('sunflower'), done: () => isShown('plant-profile-screen'),
                enter: () => tutGiveGift(),
                text: `Every plant has details and upgrades. Click the <b>ⓘ</b> on the <b>Sunflower</b>. <i>(🎁 Here is a free gift of 🧪 3 fertilizer for the lesson.)</i>` });
            add({ id: 'ps-levels', title: 'Five plant levels', target: () => $id('profile-level-list'), next: true,
                text: `Each plant has <b>5 levels</b>. Every level adds health and power &mdash; the damage and health of each level are listed here.` });
            add({ id: 'ps-mastery', title: 'Plant Mastery 🏅', target: () => $id('profile-mastery'), next: true,
                text: `Every plant also has <b>5 Mastery tiers</b> (Novice &rarr; Master) earned just by using it: plant it, deal damage, absorb damage, support your team and feed it Energy Beans. Rewards include fertilizer, cheaper sun cost, faster recharge, badges, shining seed-card and lawn borders, and a <b>Signature Passive</b>. Progress is added after each battle.` });
            add({ id: 'ps-upgrade', title: 'Upgrading a plant', target: () => $id('upgrade-plant-btn'), skipIf: () => !tutCanUpgrade(),
                enter: () => { tut.lv0 = plantLevel('sunflower'); tut.sawUpgrade = true; }, done: () => plantLevel('sunflower') > tut.lv0,
                text: `Upgrading costs <b>🧪 fertilizer</b> (3 for level 1 &rarr; 2, then 8, 15 and 30 for the higher levels). You have enough &mdash; click <b>⬆️ Upgrade Plant</b>!` });
            add({ id: 'ps-upgrade-info', title: 'Upgrading a plant', target: () => $id('profile-upgrade-box'), next: true, skipIf: () => tutCanUpgrade() || tut.sawUpgrade,
                text: `Upgrading costs <b>🧪 fertilizer</b> (3 for level 1 &rarr; 2, then 8, 15 and 30 for the higher levels). You will earn it from daily missions and first-time level clears.` });
            add({ id: 'ps-uselevel', title: 'Pick which level to bring', target: () => $id('profile-use-levels'), next: true,
                text: `If you own several levels of a plant, choose which version goes into battle here.` });
            add({ id: 'ps-close', title: 'Close the details', target: () => $id('profile-close-btn'), done: () => !isShown('plant-profile-screen'),
                text: `Click <b>✕ Close</b>.` });
            add({ id: 'ps-deck', title: 'Choose 8 plants', target: () => [$id('selected-deck-bar'), $id('available-plants-grid')],
                enter: () => { selectedDeck = []; renderSelectionScreen(); },
                done: () => selectedDeck.length === 8 && selectedDeck.includes('sunflower') && selectedDeck.includes('peashooter'),
                text: `We emptied your deck. Click plants in the collection to fill all <b>8 slots</b> &mdash; be sure to include <b>Sunflower</b> and <b>Peashooter</b>, we will use them. (Click a plant in your deck to take it out again.)` });
            add({ id: 'ps-locked', title: 'Locked plants 🔒', next: true,
                target: () => document.querySelector('#available-plants-grid [data-locked="1"]') || $id('available-plants-grid'),
                text: `Plants with a <b>🔒</b> are not unlocked yet. Click one to see how to get it: buy it in the 🛒 Store with fertilizer, or earn it as an Adventure Map reward.` });
            add({ id: 'ps-start', title: 'Start the battle', target: () => $id('start-battle-btn'), done: () => isShown('playing-screen'),
                text: `Click <b>🌱 Start Battle!</b> to begin your first real level.` });

            // ------------------------------------------------------------------ THE BATTLE
            add({ id: 'g-lawn', title: 'Your lawn', target: () => $id('lawn-board'), next: true,
                enter: () => { if (isRunning) toggleGame(); },
                text: `This is your lawn: <b>5 lanes</b>. Zombies walk in from the <b>right</b> and head for your house on the left (the red edge). Stop them before they get there! The game is paused while you read.` });
            add({ id: 'g-stars', title: 'Bonus stars ⭐', target: () => $id('star-goals'), next: true,
                text: `Each battle has <b>3 star goals</b>: clear all waves, don't use any lawnmower, and one bonus goal that changes by stage (finish with enough sun, lose few plants, or win fast). Earn all three on a stage and Zombie Level for bonus fertilizer.` });
            add({ id: 'g-sun-info', title: 'Sun ☀️', target: () => $id('sun-count') && $id('sun-count').parentElement, next: true,
                text: `This is your <b>sun</b> counter. Sun pays for plants &mdash; you start with 150. Falling suns keep appearing on the lawn, and Sunflowers make more.` });
            add({ id: 'g-start', title: 'Start the game', target: () => $id('start-btn'), done: () => isRunning,
                text: `Click <b>▶️ Start</b>. (You can pause the same way later.)` });
            add({ id: 'g-sun', title: 'Collect sun', target: () => tutLawnSpot(34, 30, 76),
                enter: () => { tut.sun0 = sun; const now = Date.now(); suns.push({ id: now + Math.random(), x: 34, y: 30, val: 50, created: now, expiresAt: now + 180000 }); },
                done: () => sun > tut.sun0,
                text: `A ☀️ appeared on the lawn! Click it to collect <b>+50 sun</b>.` });
            add({ id: 'g-seed-sf', title: 'Pick a seed', target: () => $id('seed-sunflower'), done: () => selectedSeed === 'sunflower',
                text: `Your plants live in the seed bar. Each shows its <b>☀️ cost</b>. Click the <b>Sunflower</b> (50 sun).` });
            add({ id: 'g-plant-sf', title: 'Plant it', target: () => lawnCell(2, 0), done: () => plants.some(p => p.type === 'sunflower'),
                text: `Now click the highlighted lawn tile to plant it. Sunflowers keep making extra sun.` });
            add({ id: 'g-seed-pea', title: 'Now an attacker', target: () => $id('seed-peashooter'), done: () => selectedSeed === 'peashooter',
                text: `Next, a defender. Click the <b>Peashooter</b> (100 sun).` });
            add({ id: 'g-plant-pea', title: 'Plant it in front', target: () => lawnCell(2, 1), done: () => plants.some(p => p.type === 'peashooter'),
                text: `Plant it on the tile right next to your Sunflower. It automatically shoots zombies in its lane.` });
            add({ id: 'g-cost-info', title: 'Watching your sun', target: () => [$id('sun-count') && $id('sun-count').parentElement, $id('game-seeds-bar')], next: true,
                text: `See how your sun dropped? You can only plant when you can afford it. After planting, a seed also goes on <b>cooldown</b> before you can use it again. Collect falling suns to keep planting.` });
            add({ id: 'g-bean-info', title: 'Energy Beans 🫘', target: () => $id('energy-bean-btn'), next: true,
                text: `This is your <b>Energy Bean</b> stock (you have 1, up to 4 &mdash; Gardener Rank raises the cap). A bean is <b>Plant Food</b>: it gives one plant a powerful special ability. You get more from glowing Energy Zombies.` });
            add({ id: 'g-zombie', title: 'A zombie appears! 🧟', target: () => $id('lawn-board'), next: true, nextLabel: 'Got it',
                enter: () => { tutSpawnZombie(); if (energyBeans < 1) { energyBeans = 1; updateEnergyBeanDisplay(); } },
                text: `A zombie is coming down the middle lane. Your Peashooter fires on its own. Let's power it up with Plant Food!` });
            add({ id: 'g-bean-click', title: 'Use an Energy Bean', target: () => $id('energy-bean-btn'),
                enter: () => { tut.beans0 = energyBeans; }, done: () => energyBeanActive || energyBeans < tut.beans0,
                text: `Click the <b>🫘 Energy Bean</b> button to arm it.` });
            add({ id: 'g-bean-plant', title: 'Feed your Peashooter', target: () => lawnCell(2, 1), done: () => energyBeans < tut.beans0,
                text: `Now click your <b>Peashooter</b> to give it Plant Food!` });
            add({ id: 'g-defeat', title: 'Defend your lawn', target: () => $id('lawn-board'), done: () => !zombies.includes(tut.zombie),
                text: `Watch your super-powered Peashooter defeat the zombie!` });
            add({ id: 'g-wrap', title: "You're ready! 🎉", target: () => $id('game-seeds-bar'), next: true, nextLabel: 'Finish guide',
                text: `Nice work! A few last tips: the <b>🧹 Remove</b> tool digs up a plant, <b>🔄 Reset</b> restarts and <b>🏠 Home</b> leaves. Each new wave is announced with a warning horn &mdash; survive every wave to win and earn first-clear 🧪. After a win, <b>➡️ Next Level</b> takes you straight to the next stage. After every battle you will see the <b>XP</b> you earned, and any plant that reached a new <b>Mastery</b> tier gets its own celebration. Real zombie waves start now &mdash; good luck!` });
            return S;
        }

        function tutTargetRect(st) {
            let t = typeof st.target === 'function' ? st.target() : st.target;
            if (!t) return null;
            const list = Array.isArray(t) ? t : [t];
            let l = Infinity, tp = Infinity, r = -Infinity, b = -Infinity;
            list.forEach(x => {
                if (!x) return;
                const q = x.getBoundingClientRect ? x.getBoundingClientRect() : { left: x.left, top: x.top, right: x.left + x.width, bottom: x.top + x.height, width: x.width, height: x.height };
                if (!(q.width > 0 && q.height > 0)) return;
                l = Math.min(l, q.left); tp = Math.min(tp, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
            });
            return l === Infinity ? null : { left: l, top: tp, width: r - l, height: b - tp };
        }
        function tutFirstEl(st) {
            const t = typeof st.target === 'function' ? st.target() : st.target;
            const x = Array.isArray(t) ? t[0] : t;
            return x && x.scrollIntoView ? x : null;
        }
        function tutBox(id, l, t, w, h) {
            const e = $id(id), k = `${l | 0},${t | 0},${w | 0},${h | 0}`;
            if (e._k === k) return;
            e._k = k;
            e.style.left = l + 'px'; e.style.top = t + 'px'; e.style.width = Math.max(0, w) + 'px'; e.style.height = Math.max(0, h) + 'px';
        }
        function tutLayout() {
            if (!tut) return;
            const st = tut.steps[tut.i]; if (!st) return;
            const vw = innerWidth, vh = innerHeight;
            const rect = tutTargetRect(st);
            const ring = $id('tut-ring'), cover = $id('tut-cover'), card = $id('tut-card');
            let hole = null;
            if (rect) {
                const pad = st.pad == null ? 6 : st.pad;
                const l = Math.max(0, rect.left - pad), t = Math.max(0, rect.top - pad);
                const r = Math.min(vw, rect.left + rect.width + pad), b = Math.min(vh, rect.top + rect.height + pad);
                if (r > l && b > t) hole = { l, t, r, b, w: r - l, h: b - t };
            }
            if (hole) {
                tutBox('tut-b1', 0, 0, vw, hole.t); tutBox('tut-b2', 0, hole.b, vw, vh - hole.b);
                tutBox('tut-b3', 0, hole.t, hole.l, hole.h); tutBox('tut-b4', hole.r, hole.t, vw - hole.r, hole.h);
                tutBox('tut-ring', hole.l, hole.t, hole.w, hole.h); ring.style.display = 'block';
                tutBox('tut-cover', hole.l, hole.t, hole.w, hole.h); cover.style.display = st.next ? 'block' : 'none';
            } else {
                tutBox('tut-b1', 0, 0, vw, vh); tutBox('tut-b2', 0, 0, 0, 0); tutBox('tut-b3', 0, 0, 0, 0); tutBox('tut-b4', 0, 0, 0, 0);
                ring.style.display = 'none'; cover.style.display = 'none';
            }
            const cw = card.offsetWidth, ch = card.offsetHeight;
            let left, top;
            if (!hole) { left = (vw - cw) / 2; top = (vh - ch) / 2; }
            else {
                left = hole.l + hole.w / 2 - cw / 2;
                if (hole.b + ch + 16 <= vh) top = hole.b + 12;
                else if (hole.t - ch - 16 >= 0) top = hole.t - ch - 12;
                else top = vh - ch - 12;
            }
            left = Math.min(Math.max(8, left), Math.max(8, vw - cw - 8));
            top = Math.min(Math.max(8, top), Math.max(8, vh - ch - 8));
            const k = `${left | 0},${top | 0}`;
            if (card._k !== k) { card._k = k; card.style.left = left + 'px'; card.style.top = top + 'px'; }
        }
        function tutEnsureVisible(st) {
            const rect = tutTargetRect(st), el = tutFirstEl(st);
            if (!rect || !el) return;
            if (rect.top < 0 || rect.top + Math.min(rect.height, 80) > innerHeight) el.scrollIntoView({ block: 'center', inline: 'nearest' });
        }
        function tutRenderCard(st) {
            $id('tut-count').textContent = `${tut.label || "Beginner's guide"} · step ${tut.i + 1} of ${tut.steps.length}`;
            $id('tut-title').innerHTML = st.title || '';
            $id('tut-text').innerHTML = st.text || '';
            const next = $id('tut-next');
            next.style.display = st.next ? '' : 'none';
            next.textContent = st.nextLabel || 'Next';
            $id('tut-wait').textContent = st.done ? '👆 Do it to continue' : '';
            $id('tut-skipstep').style.display = 'none';
            $id('tut-card')._k = null;
        }
        function tutGo(i) {
            if (!tut) return;
            while (i < tut.steps.length && tut.steps[i].skipIf && tut.steps[i].skipIf()) i++;
            if (i >= tut.steps.length) { tut.completed = true; return tutEnd(); }
            tut.i = i; tut.pending = false;
            const st = tut.steps[i];
            try { if (st.enter) st.enter(); } catch (e) { console.warn('guide enter', e); }
            tut.stuckAt = Date.now() + 22000;
            tutRenderCard(st);
            tutEnsureVisible(st);
            tutLayout();
        }
        function tutTick() {
            if (!tut) return;
            const st = tut.steps[tut.i]; if (!st) return;
            if (st.done && !tut.pending) {
                let ok = false;
                try { ok = !!st.done(); } catch (e) {}
                if (ok) {
                    tut.pending = true;
                    setTimeout(() => { if (tut && tut.steps[tut.i] === st) tutGo(tut.i + 1); }, st.delay == null ? 350 : st.delay);
                }
            }
            if (st.done && Date.now() > tut.stuckAt) $id('tut-skipstep').style.display = '';
            tutLayout();
        }
        function tutEnd() {
            if (!tut) return;
            clearInterval(tut.timer);
            removeEventListener('resize', tutLayout); removeEventListener('scroll', tutLayout, true);
            const les = tut.lesson, okLes = !!tut.completed; clearInterval(tut.cd);
            tut = null; tutHold = false;
            $id('tut-root').style.display = 'none';
            if (les) { if (window.lessonFinish) window.lessonFinish(les, okLes); return; }
            tutStore.set(TUT_DONE_KEY, '1');
        }
        function startBeginnerGuide() {
            if (tut) return;
            initAudio();
            if (isRunning) toggleGame();
            ['playing-screen', 'plant-select-screen', 'adventure-map-screen', 'tier-picker-screen', 'plant-store-screen',
             'plant-profile-screen', 'guide-screen', 'save-progress-screen', 'modal'].forEach(id => { const e = $id(id); if (e) e.classList.add('hidden'); });
            $id('selection-screen').classList.remove('hidden');
            selectedSeed = null; energyBeanActive = false;
            tutHold = true;
            tut = { i: -1, steps: tutBuildSteps(), pending: false, timer: null };
            $id('tut-root').style.display = 'block';
            tut.timer = setInterval(tutTick, 120);
            addEventListener('resize', tutLayout); addEventListener('scroll', tutLayout, true);
            window.scrollTo(0, 0);
            tutGo(0);
        }
        $id('tut-next').onclick = () => { if (tut) { const st = tut.steps[tut.i]; if (tut.i >= tut.steps.length - 1) { tut.completed = true; tutEnd(); } else tutGo(tut.i + 1); } };
        $id('tut-skipstep').onclick = () => { if (tut) tutGo(tut.i + 1); };
        $id('tut-skip').onclick = () => { tutEnd(); };

        window.addEventListener('DOMContentLoaded', () => {
            initDOMReferences();
            initLawnmowers();
            plantProgress = normalizePlantProgress(plantProgress);
            // Existing saves receive any campaign plants whose milestone tiers they had already cleared.
            CAMPAIGN_PLANT_REWARDS.forEach(r=>{ if(isTierCleared(r.level,r.tier) && !isPlantUnlocked(r.plant)) unlockPlant(r.plant); });
            selectedDeck = selectedDeck.filter(k=>isPlantUnlocked(k)).slice(0,8);
            if (!selectedDeck.length) selectedDeck = ['sunflower','peashooter','wallnut','cherrybomb','potatomine','bonkchoy','spikeweed','cabbagetosser'];
            savePlantProgress();
            renderSelectionScreen();
            renderDailyMissions();
            loadLatestSaveCodeField();
            renderPlantStore();
            // First visit: start the interactive beginner's guide automatically.
            if (!tutStore.get(TUT_DONE_KEY)) setTimeout(startBeginnerGuide, 450);
        });
    
