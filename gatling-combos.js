(function () {
    if (typeof GATLING_FUSIONS === 'undefined' || typeof fireFusionVolley === 'undefined' || typeof fusionHasTarget === 'undefined') return;

    const hasSfx = n => typeof SFX !== 'undefined' && SFX[n];
    const later = (ticks, fn) => (typeof afterTicks === 'function') ? afterTicks(ticks, fn) : setTimeout(fn, ticks * 50);

    // ---------------------------------------------------------------- data
    // Gatling Pea + Gatling Pea  => "Gatlin Gatlin"
    // Gatling Pea + Electric Peashooter => "Electro Gatlin"
    GATLING_FUSIONS.gatlingpea = { name: 'Gatlin Gatlin', custom: true, projectile: 'normal', emoji: '🔫', dmgMul: 1 };
    GATLING_FUSIONS.electricpeashooter = { name: 'Electro Gatlin', custom: true, projectile: 'elecpea', emoji: '🟡', dmgMul: 1, bounce: true };
    ['gatlingpea', 'electricpeashooter'].forEach(k => { if (!GATLING_FUSION_KEYS.includes(k)) GATLING_FUSION_KEYS.push(k); });
    // World 3 milestones that unlock the two combinations (same system as the other combinations).
    GATLING_FUSION_UNLOCKS.push({ key: 'electricpeashooter', level: 24, tier: 3 }, { key: 'gatlingpea', level: 26, tier: 3 });
    if (typeof NP_PROJ !== 'undefined') NP_PROJ.elecpea = 1;   // make sure electric peas run the on-hit hook

    // Every "combined gatlin peashooter" bullet type that Gatlin Gatlin can pick from.
    const GG_POOL = ['peashooter', 'snowpea', 'firepea', 'peapod', 'primalpeashooter', 'electricpeashooter'];

    // ---------------------------------------------------------------- helpers
    function bulletSound(f) {
        return f.projectile === 'ice' ? 'iceshot' : f.projectile === 'fire' ? 'fireshot' : f.projectile === 'elecpea' ? (hasSfx('elecshot') ? 'elecshot' : 'shoot') : 'shoot';
    }
    function makeBullet(p, f, row, startAt, speed, snd, boost, lvl) {
        const x = ((p.c + 0.5) / COLS) * 100;
        return {
            id: startAt + Math.random(), r: row, ownerType: 'gatlingpea', ownerLevel: lvl, x, px: x, speed,
            type: f.projectile, comboSplash: f.splash || null, dmgMul: f.dmgMul, emoji: f.emoji,
            ownerBoost: boost, startAt, snd, egBounce: !!f.bounce, hitZombies: []
        };
    }
    function volleyTail(p, now, ms) {
        p.lastActionTime = now; p.shootingAnim = true;
        plantParticles(p, ['✨', '💥', '⚡'], 4);
        setTimeout(() => { p.shootingAnim = false; }, ms);
        return true;
    }
    function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

    // ---------------------------------------------------------------- Gatlin Gatlin
    // Normal attack: 5 bullets in ONE lane. Each is a different type, picked at random from every combined-gatlin bullet type.
    // Ability: the Gatling Pea ability rhythm and count, but a random mix of EVERY bullet type, across THREE lanes.
    GATLING_FUSIONS.gatlingpea.fire = function (p, ability) {
        const now = Date.now(), boost = (p.tileBoostUntil || 0) > now ? (p.tileBoost || 1) : 1, lvl = p.level || 1;
        const pool = GG_POOL.map(k => GATLING_FUSIONS[k]).filter(Boolean);
        if (!ability) {
            shuffle(pool).slice(0, 5).forEach((f, k) => {
                projectiles.push(makeBullet(p, f, p.r, now + k * GATLING_SHOT_GAP, 1.0, k % 2 === 0 ? bulletSound(f) : null, boost, lvl));
            });
            return volleyTail(p, now, 600);
        }
        const rows = [p.r - 1, p.r, p.r + 1].filter(r => r >= 0 && r < ROWS);
        const perLane = Math.min(Math.round(16 * levelAbilityMultiplier(lvl)), Math.floor(FUSION_MAX_ABILITY_SHOTS / rows.length));
        rows.forEach((row, ri) => {
            for (let k = 0; k < perLane; k++) {
                const f = pool[(Math.random() * pool.length) | 0];
                projectiles.push(makeBullet(p, f, row, now + k * GATLING_ABILITY_GAP, 1.1, (ri === 0 && k % 2 === 0) ? bulletSound(f) : null, boost, lvl));
            }
        });
        return volleyTail(p, now, 800);
    };

    // ---------------------------------------------------------------- Electro Gatlin
    // Normal attack: ONE electric pea, exactly like the Electric Peashooter's. On hit it starts a bounce chain:
    //  - at most 15 bounces in total, and one zombie can receive the bounce at most 3 times
    //  - every bounce stuns BOTH the zombie it leaves and the zombie it lands on for 0.4s and damages both
    //    for the normal electric pea damage; each of those hits arcs to up to 2 nearby zombies for 50% damage.
    // Ability: a barrage of these electric bounce peas down three lanes.
    GATLING_FUSIONS.electricpeashooter.fire = function (p, ability) {
        const now = Date.now(), boost = (p.tileBoostUntil || 0) > now ? (p.tileBoost || 1) : 1, lvl = p.level || 1;
        const f = GATLING_FUSIONS.electricpeashooter;
        if (!ability) {
            projectiles.push(makeBullet(p, f, p.r, now, 0.9, bulletSound(f), boost, lvl));
            return volleyTail(p, now, 300);
        }
        const rows = [p.r - 1, p.r, p.r + 1].filter(r => r >= 0 && r < ROWS);
        const perLane = Math.min(Math.round(5 * levelAbilityMultiplier(lvl)), 12);
        rows.forEach((row, ri) => {
            for (let k = 0; k < perLane; k++) projectiles.push(makeBullet(p, f, row, now + k * 140, 1.1, (ri === 0 && k % 2 === 0) ? bulletSound(f) : null, boost, lvl));
        });
        return volleyTail(p, now, 800);
    };

    // ---- bounce chain ----
    const EG_MAX_BOUNCES = 15, EG_MAX_PER_ZOMBIE = 3, EG_RANGE_X = 28, EG_ARC_X = 20, EG_MAX_CHAINS = 10;
    let egActive = 0, egSeq = 0;
    const egAlive = z => z && z.hp > 0 && !z.isTomb && z.type !== 'tomb' && !z.fusing;
    const egPt = z => ({ x: z.x + 3, y: ((z.r + 0.5) / ROWS) * 100 });
    function egBolt(a, b, thick) {
        const A = egPt(a), B = egPt(b);
        if (typeof npBolt === 'function') npBolt(A.x, A.y, B.x, B.y, '#fde047', thick ? 340 : 260);
        else if (typeof showLightningChain === 'function') showLightningChain(A.x, A.y, B.x, B.y, 300);
    }
    function egHit(z, dmg, exclude, now) {
        z.hp -= dmg; z.hitFlash = true;
        z.stunnedUntil = Math.max(z.stunnedUntil || 0, now + 400); z.statusEmoji = '⚡'; z.statusExpiresAt = now + 400;
        if (typeof fxBudget !== 'undefined' && fxBudget > 0 && now - (z.lastFx || 0) > 120) { z.lastFx = now; fxBudget--; emitParticles(z.x + 2, ((z.r + 0.5) / ROWS) * 100, ['⚡', '✨'], 2); }
        zombies.filter(o => !exclude.includes(o) && egAlive(o) && Math.abs(o.r - z.r) <= 1 && Math.abs(o.x - z.x) < EG_ARC_X)
            .sort((a, b) => Math.abs(a.x - z.x) - Math.abs(b.x - z.x)).slice(0, 2)
            .forEach(o => { o.hp -= dmg * 0.5; o.hitFlash = true; egBolt(z, o, false); });
    }
    function egStep(ch) {
        const done = () => { egActive = Math.max(0, egActive - 1); };
        if (ch.n >= EG_MAX_BOUNCES) return done();
        const a = ch.cur;
        const cands = zombies.filter(o => o !== a && egAlive(o) && (ch.cnt.get(o.id) || 0) < EG_MAX_PER_ZOMBIE && Math.abs(o.r - a.r) <= 1 && Math.abs(o.x - a.x) < EG_RANGE_X)
            .sort((p, q) => Math.hypot(p.x - a.x, (p.r - a.r) * 16) - Math.hypot(q.x - a.x, (q.r - a.r) * 16));
        if (!cands.length) return done();
        const b = cands[0];
        later(3, () => {
            if (!egAlive(b)) return egStep(ch);                 // target died while the spark travelled: pick again
            const now = Date.now();
            egBolt(a, b, true);
            egHit(a, ch.dmg, [a, b], now);                      // the zombie it bounces off of
            egHit(b, ch.dmg, [a, b], now);                      // the zombie it bounces to
            ch.cnt.set(b.id, (ch.cnt.get(b.id) || 0) + 1);
            ch.n++; ch.cur = b;
            const P = egPt(b);
            if (typeof fxRing === 'function') fxRing(P.x, P.y, '#facc15', 54, { grow: 1.6, duration: 320 });
            if (typeof playSound === 'function') playSound(hasSfx('zapsmall') ? 'zapsmall' : 'zap');
            if (window.__GG_TEST) (window.__GG_LOG = window.__GG_LOG || []).push({ a: a.id, b: b.id, n: ch.n });
            egStep(ch);
        });
    }
    function egStart(pea, z, now) {
        if (egActive >= EG_MAX_CHAINS || !egAlive(z)) return;
        egActive++;
        const dmg = 40 * levelAttackMultiplier('gatlingpea', pea.ownerLevel || 1) * (pea.ownerBoost || 1) * (pea.dmgMul || 1);
        egStep({ id: ++egSeq, cur: z, n: 0, cnt: new Map(), dmg });
    }
    // The pea's own first hit (stun + arc) is the normal electric-pea behaviour; the bounce chain starts after it.
    if (typeof npProjHit === 'function') {
        const originalHit = npProjHit;
        npProjHit = function (pea, z, dmg, now) {
            originalHit(pea, z, dmg, now);
            if (pea && pea.egBounce) egStart(pea, z, now);
        };
    }

    // ---------------------------------------------------------------- hook into the existing combo system
    const originalHasTarget = fusionHasTarget;
    fusionHasTarget = function (p) {
        const f = GATLING_FUSIONS[p.combinedWith];
        if (f && f.custom) { const left = (p.c / COLS) * 100 - 2; return zombies.some(z => z.r === p.r && z.hp > 0 && z.x > left); }
        return originalHasTarget(p);
    };
    const originalVolley = fireFusionVolley;
    fireFusionVolley = function (p, ability) {
        const f = GATLING_FUSIONS[p.combinedWith];
        if (f && f.custom && f.fire) return f.fire(p, !!ability);
        return originalVolley(p, ability);
    };
})();
