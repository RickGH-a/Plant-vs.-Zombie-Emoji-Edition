// ===================== TRAINING LESSONS (Worlds 1-4) =====================
// Short, hands-on introductory lessons. Each runs on the real lawn using the guide engine (spotlight + steps that
// advance only when the player really does the action). Lessons spawn their own zombies; no waves, no rewards
// except a one-time fertilizer gift for finishing a lesson.
(function () {
    'use strict';
    const KEY = 'pvzLessonsDone';
    const doneMap = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
    const markDone = id => { const d = doneMap(); d[id] = 1; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} };
    const $ = id => document.getElementById(id);
    const seed = k => () => $('seed-' + k);
    const cell = (r, c) => () => lawnCell(r, c);
    const LAWN = () => $('lawn-board');
    const BAR = () => $('game-seeds-bar');
    const info = (title, text, target, o) => Object.assign({ title, text, target, next: true }, o || {});
    const act = (title, text, target, done, o) => Object.assign({ title, text, target, done }, o || {});
    const alive = z => !!z && zombies.includes(z) && z.hp > 0;
    const noZ = () => zombies.every(q => q.hp <= 0 || q.isTomb);
    const has = (t, r, c) => plants.some(p => p.type === t && (r == null || p.r === r) && (c == null || p.c === c));
    const colAt = x => Math.max(0, Math.min(COLS - 1, Math.floor(x / 100 * COLS)));
    function zspawn(type, r, x, slow, hpm) {
        window.__revSpawn = { type, r, x };
        try { spawnZombie(); } finally { window.__revSpawn = null; }
        const z = zombies[zombies.length - 1];
        if (z && slow != null) { z.speed *= slow; z.baseSpeed *= slow; }
        if (z && hpm) { z.hp *= hpm; z.maxHp *= hpm; }
        if (z && tut) { tut.zs = tut.zs || []; tut.zs.push(z); tut.z = z; }
        return z;
    }
    function auto(type, r, c) { seedCooldowns = {}; sun = Math.max(sun, 400); selectedSeed = type; try { handleCellClick(r, c); } finally { selectedSeed = null; } }
    const clearZ = () => { zombies.forEach(z => { z.hp = 0; }); zombies = zombies.filter(z => false); };
    // a 2-step "pick the seed, then click the tile" pair
    function plantSteps(key, name, r, c, text, extra) {
        return [
            act('Pick the ' + name, text, seed(key), () => selectedSeed === key || has(key, r, c), { pad: 6 }),
            act('Plant it here', 'Click the glowing tile to plant the ' + name + '.' + (extra || ''), cell(r, c), () => has(key, r, c))
        ];
    }
    const wait = (ms, title, text, target) => act(title, text, target || LAWN, () => Date.now() > tut.t0 + ms, { enter: () => { tut.t0 = Date.now(); } });
    const finish = (text) => info('Lesson complete! 🎓', text || 'Nicely done. You can replay any lesson from the Adventure Map.', BAR, { nextLabel: 'Finish lesson', enter: () => clearZ() });

    const L = [];
    // -------------------------------------------------------------------------------- WORLD 1
    L.push({ id: 'w1a', world: 1, level: 1, name: 'Walls, Traps & Bombs', icon: '🌰', sun: 900,
        deck: ['sunflower', 'peashooter', 'wallnut', 'potatomine', 'spikeweed', 'cherrybomb'],
        steps: () => [
            info('Lesson 1 · Walls, Traps & Bombs', 'Shooting is not the only way to stop zombies. In this short lesson you will use a <b>wall</b>, a <b>mine</b>, a <b>trap</b> and a <b>bomb</b>. We gave you plenty of sun &mdash; just try things!'),
            ...plantSteps('wallnut', 'Wall-nut', 2, 3, 'The <b>Wall-nut</b> has no attack but a huge pile of health. Select it.'),
            ...plantSteps('peashooter', 'Peashooter', 2, 1, 'Zombies stop to chew whatever blocks them. Put a <b>Peashooter</b> behind the wall so it can shoot while the zombie is stuck.'),
            act('Watch the wall work', 'A zombie arrives. See how it <b>stops</b> at the Wall-nut and chews while your Peashooter keeps shooting.', LAWN, () => !alive(tut.z), { enter: () => zspawn('basic', 2, 80, 1) }),
            ...plantSteps('potatomine', 'Potato Mine', 1, 3, '<b>Potato Mines</b> explode for big damage but must <b>arm</b> first. Select one.'),
            act('Wait for it to arm', 'The mine needs about <b>5 seconds</b> to arm. An armed mine pops up from the ground. A mine that is not armed yet does nothing &mdash; so plant them early!', cell(1, 3), () => plants.some(p => p.type === 'potatomine' && p.armed)),
            act('Test the mine', 'Here comes a zombie in the mine\'s lane. The first zombie to touch an <b>armed</b> mine triggers a 500-damage blast (the mine is used up).', LAWN, () => !alive(tut.z), { enter: () => zspawn('basic', 1, 74, 1) }),
            ...plantSteps('spikeweed', 'Spikeweed', 3, 4, '<b>Spikeweed</b> is a ground trap: zombies hurt themselves as they walk over it, and it is not eaten by ordinary zombies. Select it.'),
            act('Watch the spikes', 'Ordinary zombies <b>walk over</b> Spikeweed and take damage with every step. Spikeweed is great in front of your other plants.', LAWN, () => !alive(tut.z), { enter: () => zspawn('basic', 3, 74, 1) }),
            act('Group of zombies', 'Three zombies are standing together. A single bomb will do! Select the <b>Cherry Bomb</b>.', seed('cherrybomb'), () => selectedSeed === 'cherrybomb' || noZ(),
                { enter: () => { zspawn('basic', 0, 60, 0.001); zspawn('basic', 1, 62, 0.001); zspawn('basic', 2, 61, 0.001); } }),
            act('Boom!', 'The Cherry Bomb blasts a <b>3&times;3 area</b> the moment it is planted. Plant it on the glowing tile, in the middle of the group.', cell(1, colAt(61)), () => noZ()),
            finish('Remember: <b>Wall-nut</b> holds zombies, <b>Potato Mine</b> needs time to arm, <b>Spikeweed</b> hurts walkers, <b>Cherry Bomb</b> clears crowds. Next lesson: special zombies!')
        ] });
    L.push({ id: 'w1b', world: 1, level: 3, name: 'Special Zombies', icon: '🏃', sun: 900,
        deck: ['sunflower', 'peashooter', 'snowpea', 'wallnut', 'tallnut', 'potatomine'],
        steps: () => [
            info('Lesson 2 · Special Zombies', 'Not every zombie is the same. You will meet the <b>Cone</b>, the <b>Pole Vaulter</b>, the <b>Newspaper</b> and the <b>Football</b> zombie, and see how each one changes your plan.'),
            ...plantSteps('peashooter', 'Peashooter', 2, 0, 'Plant a <b>Peashooter</b> to fight the first one.'),
            act('Armor = extra health', 'This <b>Cone Zombie</b> wears a traffic cone. Armor soaks up damage first, so armored zombies take <b>more hits</b> than normal ones. Keep shooting!', LAWN, () => !alive(tut.z), { enter: () => zspawn('cone', 2, 74, 1) }),
            ...plantSteps('wallnut', 'Wall-nut', 1, 3, 'Next: the <b>Pole Vault Zombie</b>. First plant a Wall-nut in its lane.'),
            act('It jumps!', 'The <b>Pole Vault Zombie</b> <b>vaults over the first plant</b> it meets &mdash; the Wall-nut did not stop it. After the jump it walks <b>slower</b>.', LAWN, () => !!(tut.z && (tut.z.vaulted || !alive(tut.z))), { enter: () => { auto('peashooter', 1, 0); zspawn('polevault', 1, 74, 1); } }),
            ...plantSteps('tallnut', 'Tall-nut', 3, 3, 'A <b>Tall-nut</b> is too tall to jump over! Plant one in another lane for the next vaulter.'),
            act('Blocked!', 'This vaulter cannot jump the <b>Tall-nut</b>, so it has to chew through it. The right wall for the right zombie!', LAWN, () => !alive(tut.z), { enter: () => { auto('peashooter', 3, 0); zspawn('polevault', 3, 74, 1); } }),
            act('Newspaper rage', 'The <b>Newspaper Zombie</b> reads calmly &mdash; until you destroy its paper (about 28% of its health). Then it gets <b>enraged and runs faster</b>. Watch it happen.', LAWN, () => !!(tut.z && (tut.z.enraged || !alive(tut.z))), { enter: () => { auto('peashooter', 4, 0); zspawn('newspaper', 4, 72, 1); } }),
            ...plantSteps('snowpea', 'Snow Pea', 2, 1, 'Slowing helps against fast zombies. Plant a <b>Snow Pea</b>: its frozen peas halve a zombie&rsquo;s speed.'),
            act('Football blitz', 'The <b>Football Zombie</b> is tough, and every few seconds <b>blitzes forward at double speed</b>. Watch it &mdash; the slowed zombie gets chewed up by your plants.', LAWN, () => Date.now() > tut.t0 + 13000 || !alive(tut.z),
                { enter: () => { tut.t0 = Date.now(); auto('peashooter', 2, 0); zspawn('football', 2, 80, 0.5); } }),
            finish('<b>Armor</b> = more hits, <b>Pole Vault</b> jumps (use Tall-nut), <b>Newspaper</b> rages, <b>Football</b> blitzes (slow it down). You will see all of them in later levels!')
        ] });
    // -------------------------------------------------------------------------------- WORLD 2
    L.push({ id: 'w2a', world: 2, level: 12, name: 'Pirates & Cannons', icon: '🏴‍☠️', sun: 1200, beans: 0,
        deck: ['sunflower', 'peashooter', 'wallnut', 'melonpult', 'coconutcannon', 'spikerock', 'gravebuster', 'powerlily'],
        steps: () => [
            info('Lesson 1 · Pirates & Cannons', 'World 2 brings heavy hitters. You will try the <b>Melon-pult</b> and the <b>Coconut Cannon</b> against the Pirate Seas zombies.'),
            ...plantSteps('melonpult', 'Melon-pult', 2, 1, 'The <b>Melon-pult</b> lobs melons over walls with <b>splash damage</b> to nearby zombies. Select it.'),
            act('Barrel Roller', 'The <b>Barrel Roller</b> hides behind a rolling barrel that absorbs damage. When the barrel breaks, a <b>fast Imp</b> pops out &mdash; be ready for it!', LAWN, () => noZ() && tut.z && !alive(tut.z), { enter: () => { auto('peashooter', 2, 0); zspawn('barrelroller', 2, 74, 1); } }),
            ...plantSteps('coconutcannon', 'Coconut Cannon', 1, 1, 'The <b>Coconut Cannon</b> does not fire by itself: <b>you tap it</b> to shoot a powerful cannonball down its lane, then it rests 8 seconds. Select it.'),
            act('Fire the cannon', 'A <b>Jolly Roger</b> approaches. <b>Tap your Coconut Cannon</b> to blast it. Watch for a <b>red warning circle</b> &mdash; that is where its Anchor Toss will land (heavy damage + 3s stun)!', cell(1, 1),
                () => !alive(tut.z), { enter: () => zspawn('jollyroger', 1, 74, 1) }),
            ...plantSteps('spikerock', 'Spikerock', 3, 3, '<b>Spikerock</b> is a much stronger Spikeweed. Ordinary zombies walk right over it. Select it.'),
            act('Strong trap', 'Zombies take heavy damage for every step on the Spikerock. Traps do not need sun to keep working &mdash; perfect for long lanes.', LAWN, () => !alive(tut.z), { enter: () => { auto('peashooter', 3, 0); zspawn('barrelroller', 3, 80, 0.7); } }),
            finish('<b>Melon-pult</b> = splash, <b>Coconut Cannon</b> = tap to fire, <b>Spikerock</b> = tough trap. Watch the red warning zones!')
        ] });
    L.push({ id: 'w2b', world: 2, level: 14, name: 'Tombs & Curses', icon: '🏺', sun: 1200, beans: 0,
        deck: ['sunflower', 'peashooter', 'melonpult', 'wallnut', 'gravebuster', 'powerlily', 'spikerock', 'coconutcannon'],
        steps: () => [
            info('Lesson 2 · Tombs & Curses', 'In the Ancient Tombs, zombies raise <b>tombs</b> that keep spawning new zombies. You will learn to destroy tombs, get <b>Plant Food</b> and survive a <b>Pharaoh\'s curse</b>.'),
            act('A tomb appears', 'A <b>tomb</b> was raised. It does not attack, but it <b>blocks the tile and spawns zombies</b>. Select a <b>Grave Buster</b>.', seed('gravebuster'),
                () => selectedSeed === 'gravebuster' || !zombies.some(q => q.isTomb && q.hp > 0),
                { enter: () => { const z = zspawn('tomb', 2, 56); tut.tc = z ? colAt(z.x) : 4; } }),
            act('Bust the tomb', 'Plant the <b>Grave Buster</b> on the tomb. It removes the tomb for good.', () => lawnCell(2, tut.tc), () => !zombies.some(q => q.isTomb && q.hp > 0)),
            act('Pick the Power Lily', 'Next: <b>Plant Food</b>. The <b>Power Lily</b> gives you one Energy Bean when planted. Select it.', seed('powerlily'), () => selectedSeed === 'powerlily' || energyBeans >= 1),
            act('Plant it here', 'Click the glowing tile. The Lily disappears, but you keep the bean!', cell(0, 0), () => energyBeans >= 1),
            ...plantSteps('melonpult', 'Melon-pult', 2, 2, 'You got a bean! First put a <b>Melon-pult</b> on the lawn to feed with it.'),
            act('Arm the bean', 'Energy Beans power up a plant. Click the <b>🫘 Energy Bean</b> button to arm it.', () => $('energy-bean-btn'), () => energyBeanActive),
            act('Feed the Melon-pult', 'Now click the <b>Melon-pult</b>: its Plant Food lobs melons onto <b>every zombie on the lawn</b>!', cell(2, 2), () => energyBeans < tut.b0,
                { enter: () => { tut.b0 = energyBeans; zspawn('jollyroger', 1, 70, 0.5, 0.4); zspawn('basic', 3, 72, 0.5); } }),
            act('Pharaoh\'s curse', 'The <b>Pharaoh</b> casts a <b>curse</b> every ~10 seconds: nearby plants take damage and <b>stop attacking for 3.5 seconds</b>. Keep a few plants spread out and kill it fast.', LAWN, () => noZ(),
                { enter: () => { auto('peashooter', 2, 0); auto('peashooter', 3, 0); zspawn('pharaoh', 2, 72, 0.5); } }),
            finish('<b>Grave Buster</b> removes tombs, <b>Power Lily</b> gives Plant Food, and a <b>Pharaoh</b> can silence your plants. Good luck in the tombs!')
        ] });
    // -------------------------------------------------------------------------------- WORLD 3
    L.push({ id: 'w3a', world: 3, level: 19, name: 'Meet the Mutants', icon: '🧬', sun: 1500,
        deck: ['sunflower', 'peashooter', 'laserbean', 'infinut', 'shadowshroom', 'dusklobber', 'electricblueberry', 'intensivecarrot'],
        steps: () => [
            info('Lesson 1 · Meet the Mutants', 'In World 3 zombies are <b>fused with plant DNA</b>. A <b>Wall-nut Mutant</b> is tough, a <b>Pea Mutant</b> shoots, and so on &mdash; each acts like the plant on its head. Learn the new plants that fight them!'),
            ...plantSteps('laserbean', 'Laser Bean', 2, 0, 'The <b>Laser Bean</b> fires an instant laser that hits <b>every zombie in its lane</b> at once. Select it.'),
            act('Lane of mutants', 'A tough <b>Wall-nut Mutant</b> walks with a <b>Pea Mutant</b> behind it. The laser pierces through all of them!', LAWN, () => noZ(), { enter: () => { auto('peashooter', 2, 1); zspawn('wallnutmutant', 2, 72, 1, 0.4); zspawn('peamutant', 2, 84, 1); } }),
            ...plantSteps('infinut', 'Infi-nut', 1, 3, 'The <b>Infi-nut</b> is a wall with a <b>force field</b> that absorbs damage, breaks, then recharges. Select it.'),
            act('Hold the line', 'Watch the shield absorb the mutant\'s bites. When it breaks it recharges after a few seconds, over and over.', LAWN, () => noZ(), { enter: () => { auto('peashooter', 1, 0); auto('peashooter', 1, 1); zspawn('snowpeamutant', 1, 72, 1); } }),
            ...plantSteps('electricblueberry', 'Electric Blueberry', 3, 3, 'The <b>Electric Blueberry</b> shocks and <b>stuns</b> every zombie in a 3&times;3 area when zombies get close. Select it.'),
            act('Shock them!', 'Zombies that come close get zapped and frozen in place for a moment &mdash; great for buying time.', LAWN, () => noZ(), { enter: () => { auto('peashooter', 3, 0); zspawn('wallnutmutant', 3, 72, 1, 0.4); zspawn('peamutant', 4, 74, 1); } }),
            finish('<b>Laser Bean</b> hits whole lanes, <b>Infi-nut</b> has a recharging shield, <b>Electric Blueberry</b> stuns groups. Next lesson: the zombie scientists!')
        ] });
    L.push({ id: 'w3b', world: 3, level: 21, name: 'Mutation Beams', icon: '🔬', sun: 1500,
        deck: ['sunflower', 'peashooter', 'shadowshroom', 'dusklobber', 'intensivecarrot', 'laserbean', 'wallnut', 'electricblueberry'],
        steps: () => [
            info('Lesson 2 · Mutation Beams', 'The <b>Biologist</b> zombie never rushes in. Instead, every 8 seconds it zaps a random zombie with a <b>mutation beam</b>: <b style="color:#4ade80">green = +50% health</b>, <b style="color:#f87171">red = double damage</b>, <b style="color:#60a5fa">blue = +50% speed</b>. Kill it early!'),
            act('A Biologist!', 'It stands behind its friends and buffs them. Watch the colored beam hit a zombie.', LAWN, () => Date.now() > tut.t0 + 10000, { enter: () => { tut.t0 = Date.now(); auto('wallnut', 2, 3); zspawn('biologistmutant', 2, 70, 0.5, 0.5); zspawn('peamutant', 2, 62, 0.3); zspawn('wallnutmutant', 3, 60, 0.3); } }),
            ...plantSteps('dusklobber', 'Dusk Lobber', 2, 1, 'Lobbers fly over blockers and hit the closest zombie. Plant a <b>Dusk Lobber</b>: heavy splash plus a curse that keeps hurting.'),
            ...plantSteps('shadowshroom', 'Shadow-shroom', 3, 1, 'The <b>Shadow-shroom</b> fires bolts that <b>slow</b> zombies and weaken their bite, while healing your plants. Plant it too.'),
            act('Take them down', 'Defeat the group. Spend your Energy Bean if it gets rough &mdash; <b>Plant Food on the Dusk Lobber</b> rains meteors on up to eight zombies!', LAWN, () => noZ(), { enter: () => { auto('peashooter', 2, 0); auto('peashooter', 3, 0); zspawn('peamutant', 3, 60, 0.6); zombies.forEach(z => { z.speed *= 2; z.baseSpeed *= 2; }); } }),
            finish('Defeat the <b>Biologist</b> first when you can, and use <b>Shadow-shroom</b> to slow buffed zombies down.')
        ] });
    // -------------------------------------------------------------------------------- WORLD 4
    L.push({ id: 'w4a', world: 4, level: 27, name: 'Fundamental Fields', icon: '⚛️', sun: 1500, beans: 2,
        deck: ['sunflower', 'peashooter', 'laserbean', 'melonpult', 'wallnut', 'infinut', 'shadowshroom', 'electricblueberry'],
        steps: () => [
            info('Lesson 1 · Fundamental Fields', 'World 4 gives you a new tool: <b>Fundamental Field Resonance</b>. For 10 seconds a field boosts a group of plants. Each field has a favourite type of plant, and there is a cooldown between uses.', () => $('field-resonance')),
            info('The four fields', '<b>⚡ Electromagnetic</b>: faster straight shooters &bull; <b>🌍 Gravitational</b>: stronger lobbers &bull; <b>☢ Strong Force</b>: tougher defenders &bull; <b>✨ Quantum</b>: sun &amp; support. Choose the one that matches your lane.', () => $('field-resonance')),
            ...plantSteps('peashooter', 'Peashooter', 2, 0, 'Let\'s boost shooters. Plant a <b>Peashooter</b> first.'),
            ...plantSteps('peashooter', 'Peashooter', 2, 1, 'And a second one.'),
            act('Zombies approach', 'Zombies are coming &mdash; activate the <b>⚡ Electromagnetic</b> field!', () => document.querySelector('#field-resonance .field-btn[onclick*="\'em\'"]'), () => fundamentalField === 'em' && Date.now() < fieldActiveUntil,
                { enter: () => { fieldCooldownUntil = 0; zspawn('basic', 2, 78, 0.6); zspawn('cone', 2, 88, 0.6); } }),
            act('Faster shots!', 'See the glowing wave? Straight shooters now fire <b>60% faster</b> with <b>+1 pierce</b>. Defeat the zombies.', LAWN, () => noZ()),
            act('Switch fields', 'Fields have a cooldown in real play, but here you can try another. A strong wall? Choose <b>☢ Strong Force</b> to harden your defenders.', () => document.querySelector('#field-resonance .field-btn[onclick*="\'strong\'"]'), () => fundamentalField === 'strong' && Date.now() < fieldActiveUntil,
                { enter: () => { fieldCooldownUntil = 0; auto('wallnut', 3, 3); zspawn('cone', 3, 72, 1); } }),
            info('Grand Unification', '<b>✦ Grand Unification</b> costs <b>1 Energy Bean</b> and turns on <b>every field at once for 20 seconds</b>. Save it for the big moment.', () => $('field-resonance')),
            finish('Pick the field that matches your plants: <b>shooters &rarr; Electromagnetic</b>, <b>lobbers &rarr; Gravitational</b>, <b>walls &rarr; Strong Force</b>, <b>sun &amp; support &rarr; Quantum</b>.')
        ] });
    L.push({ id: 'w4b', world: 4, level: 27, name: 'Physics Zombies', icon: '🧪', sun: 1500,
        deck: ['sunflower', 'peashooter', 'laserbean', 'melonpult', 'wallnut', 'infinut', 'shadowshroom', 'electricblueberry'],
        steps: () => [
            info('Lesson 2 · Physics Zombies', 'Each zombie in World 4 obeys a law of physics. Learn what they do and how to react.'),
            ...plantSteps('infinut', 'Infi-nut', 2, 3, 'Meet the <b>Momentum Zombie</b>: the longer it walks unblocked, the harder its first hit slams. Put a sturdy <b>Infi-nut</b> in its path.'),
            act('Momentum slam', 'It speeds up while nothing stops it, then <b>converts the speed into one huge slam</b> on the first plant it touches &mdash; then resets. A wall <b>absorbs</b> that first blow. Watch.', LAWN, () => !!tut.z && (!alive(tut.z) || tut.t0 && Date.now() > tut.t0 + 16000),
                { enter: () => { tut.t0 = Date.now(); auto('peashooter', 2, 0); zspawn('inertia', 2, 92, 1); } }),
            act('Heavy mass', 'The <b>F=ma zombie</b> is very heavy: ordinary shots barely push it, and it has lots of health. Use sustained damage (Laser Bean!) and slow it down.', LAWN, () => !alive(tut.z) || Date.now() > tut.t0 + 14000,
                { enter: () => { tut.t0 = Date.now(); clearZ(); auto('laserbean', 3, 0); zspawn('fma_zombie', 3, 80, 0.7); } }),
            act('Action-Reaction', 'The <b>Newton III zombie</b> reacts to every hit: the harder you hit it, the harder the <b>rocket counter-blast</b> that it fires back at your nearest plant. Prefer many small hits over one huge one.', LAWN, () => !alive(tut.z) || Date.now() > tut.t0 + 14000,
                { enter: () => { tut.t0 = Date.now(); clearZ(); auto('peashooter', 1, 0); auto('wallnut', 1, 2); zspawn('newton3_zombie', 1, 74, 1); } }),
            finish('<b>Momentum</b> &rarr; put a wall in front. <b>Mass</b> &rarr; sustained damage + slow. <b>Action-Reaction</b> &rarr; many small hits. More physics await in World 4!')
        ] });

    // -------------------------------------------------------------------------------- WORLD 5 (Reversed Invasion: you are the zombies)
    const RV = () => window.REV;
    const rvRows = ['.s.pw.', '.s.pw.', '.s.pw.', '.s.pw.', '.s.pw.'];
    const mineZ = () => zombies.filter(z => z.hp > 0 && z.rk);
    L.push({ id: 'w5a', world: 5, rev: true, level: 1, name: 'Raising Your Horde', icon: '🧠', rows: rvRows, brains: 500, dread: 30,
        deck: ['basic', 'cone', 'bucket'],
        steps: () => [
            info('Lesson 1 · Raising Your Horde', 'In the <b>Reversed World</b> <i>you</i> are the zombies and <b>Dave</b> defends with plants. You do not wait for waves &mdash; you <b>raise</b> zombies yourself wherever you like on the right side of the lawn. Your goal: reach the house!', LAWN),
            info('🧠 Brains', 'Brains are your money. Every zombie costs brains, and brains slowly <b>regenerate</b>. You also gain them when your zombies <b>eat plants</b> and when you <b>breach a lane</b>.', () => $('rv-brains')),
            act('Pick a card', 'Your zombie cards are at the bottom. Each shows its <b>🧠 cost</b>. Select the <b>Basic Browncoat</b>.', () => $('rseed-basic'), () => RV().sel === 'basic' || mineZ().length > 0),
            act('Raise a zombie', 'Click a tile in the <b>right-most columns</b> to raise it. (Until you chew through a lane&rsquo;s front plants you can only raise zombies on the two right-most columns.)', cell(2, 7), () => mineZ().length > 0),
            act('It marches on its own', 'Your zombie walks left and <b>eats the first plant</b> it meets. You do not steer it. Wait until it has eaten a plant &mdash; each one gives you bonus 🧠.', LAWN, () => RV().stats.eaten >= 1 || (mineZ().length === 0 && tut.t0 && Date.now() > tut.t0 + 8000),
                { enter: () => { tut.t0 = Date.now(); mineZ().forEach(z => { z.speed *= 2; z.baseSpeed *= 2; }); } }),
            act('Armored allies', 'Raise a <b>Conehead</b> and a <b>Basic</b> side by side in another lane. Zombies near each other get <b>Swarm Mentality</b>: +15% speed for each neighbour. Raise <b>2 more zombies</b> in the same lane.', [LAWN, BAR], () => mineZ().length >= 3,
                { enter: () => { RV().brains = Math.max(RV().brains, 300); } }),
            act('Breach a lane!', 'If a zombie reaches the house, that lane is <b>breached</b> (+bonus 🧠). <b>Breach 3 lanes to win</b>, and all 5 for an extra star. Watch your horde run!', LAWN, () => RV().laneN >= 1 || Date.now() > tut.t0 + 45000,
                { enter: () => { tut.t0 = Date.now(); mineZ().forEach(z => { z.speed *= 2.5; z.baseSpeed *= 2.5; }); } }),
            finish('You now know the basics: pick a card, raise zombies on the right, let them eat plants, and <b>breach 3 lanes</b>. Next: manual abilities!')
        ] });
    L.push({ id: 'w5b', world: 5, rev: true, level: 1, name: 'Abilities & Dread', icon: '💀', rows: rvRows, brains: 500, dread: 100,
        deck: ['basic', 'polevault', 'cone'],
        steps: () => [
            info('Lesson 2 · Abilities & Dread', 'Every zombie has a <b>manual ability</b> you trigger yourself. Abilities cost <b>💀 Dread</b>, a bar that fills as your horde does damage and sets off synergies. We filled your Dread bar for this lesson.', () => $('rev-hud')),
            act('Pick the Basic card', 'Select the <b>Basic Browncoat</b> card.', () => $('rseed-basic'), () => RV().sel === 'basic' || mineZ().length > 0),
            act('Raise a zombie', 'Click a tile in the right-most column to raise it.', cell(1, 7), () => mineZ().length > 0),
            act('Use its ability', 'Now <b>click your zombie</b> on the lawn (or press its number key, then Space). The Basic zombie&rsquo;s <b>Lunge &amp; Feint</b> jumps it 1.2 tiles past a plant. Hover a card to read every ability.', LAWN, () => RV().stats.abil >= 1,
                { enter: () => { RV().dread = 100; mineZ().forEach(z => { z.speed *= 0.5; z.baseSpeed *= 0.5; }); } }),
            act('A lane-hopping vaulter', 'Next card: the <b>Pole Vaulter</b>. Its ability <b>hops it to another lane</b>: click the zombie, then click a lane above or below (or press W / S). Great for dodging a wall! Select its card.', () => $('rseed-polevault'), () => RV().sel === 'polevault' || mineZ().some(z => z.rk === 'polevault'),
                { enter: () => { RV().dread = 100; RV().brains = Math.max(RV().brains, 300); } }),
            act('Raise the vaulter', 'Click a tile in the right-most column.', cell(2, 7), () => mineZ().some(z => z.rk === 'polevault')),
            act('Hop lanes', 'Click your <b>Pole Vaulter</b>, then click the lane you want to jump to.', LAWN, () => RV().stats.abil >= 2,
                { enter: () => { RV().dread = 100; } }),
            info('Dread &amp; cooldowns', 'Watch the 💀 <b>Dread</b> bar: each ability spends some, and every ability also has its own <b>cooldown</b>. Spend it wisely &mdash; Dread refills when your zombies eat plants and trigger synergies.', () => $('rev-hud')),
            finish('<b>Click a zombie</b> to use its ability. Lane-hoppers dodge walls; instant abilities need no target. Next lesson: commands and synergies!')
        ] });
    L.push({ id: 'w5c', world: 5, rev: true, level: 1, name: 'Commands & Synergies', icon: '🌫️', rows: rvRows, brains: 600, dread: 100,
        deck: ['basic', 'cone', 'polevault'],
        steps: () => [
            info('Lesson 3 · Commands & Synergies', 'Besides zombie abilities you have three <b>commands</b> that use Dread: <b>Necrotic Fog</b>, <b>Graveyard Ambush</b> and <b>Bungee Reposition</b>. You can find them under the lawn.', () => $('rev-cmd')),
            act('Necrotic Fog', 'Click <b>🌫️ Necrotic Fog</b>. For 6 seconds a fog covers the lawn: zombies take less damage and you can raise them <b>further forward</b> (up to column 5).', () => $('cmd-fog'), () => RV().fogUntil > Date.now() || (RV().cmdCd && RV().cmdCd.fog > Date.now()),
                { enter: () => { RV().dread = 100; } }),
            act('Raise them forward', 'While the fog lasts, raise a <b>Basic</b> in the <b>column right next to the plants</b> &mdash; the highlighted tile. Quick!', cell(1, 5), () => mineZ().some(z => z.r === 1 && z.x < 70) || mineZ().length > 0,
                { enter: () => { RV().sel = 'basic'; try { revSelect('basic'); } catch (e) {} RV().dread = 100; RV().brains = Math.max(RV().brains, 300); } }),
            act('Graveyard Ambush', 'Click <b>🪦 Graveyard Ambush</b>, then click two empty tiles to place <b>Tombstones</b>. A zombie standing next to a tombstone gets a <b>bonus</b> when it uses its ability.', () => $('cmd-grave'), () => !!(RV().armed && RV().armed.cmd === 'grave') || (RV().cmdCd && RV().cmdCd.grave > Date.now()),
                { enter: () => { RV().dread = 100; } }),
            act('Place 2 tombstones', 'Click two empty tiles on the right side of the lawn (columns 4&ndash;8).', LAWN, () => !!(RV().cmdCd && RV().cmdCd.grave > Date.now()) || (RV().armed == null)),
            info('Bungee Reposition', '<b>🪝 Bungee Reposition</b> lifts one of your zombies and drops it up to <b>3 tiles</b> away &mdash; perfect to rescue a zombie from a lane that is going badly. Try it in a real battle!', () => $('cmd-bungee')),
            info('⚡ Synergies', 'Some zombie <b>combos</b> trigger a <b>⚡ Synergy</b> (the counter above the lawn): bonus effects and extra Dread. Open <b>📖 How to play</b> on the stage-select screen to see them all. Three synergies in a battle earn the third star!', () => $('rv-syn')),
            finish('<b>Fog</b> = raise further forward, <b>Graveyard</b> = tombstone bonuses, <b>Bungee</b> = rescue zombies. Time to take Dave&rsquo;s lawn!')
        ] });

    // ------------------------------------------------------------------ runner
    window.LESSONS = L;
    const state = {};
    function startLesson(id) {
        const les = L.find(x => x.id === id); if (!les || tut) return;
        initAudio();
        if (isRunning) toggleGame();
        ['plant-select-screen', 'adventure-map-screen', 'tier-picker-screen', 'plant-store-screen', 'plant-profile-screen', 'guide-screen', 'save-progress-screen', 'modal', 'selection-screen']
            .forEach(i => { const e = $(i); if (e) e.classList.add('hidden'); });
        if (les.rev) { ['rev-map-screen', 'rev-select-screen'].forEach(i => { const e = $(i); if (e) e.classList.remove('on'); }); window.__LESSON = les; window.revStartLesson(les); }
        else {
        state.deck = selectedDeck.slice(); state.level = currentLevel; state.tier = currentTier;
        currentLevel = les.level; currentTier = 1;
        selectedDeck = les.deck.filter(k => PLANT_TYPES[k]);
        $('playing-screen').classList.remove('hidden');
        document.body.dataset.world = String((LEVELS[currentLevel] || {}).map || 1);
        const nm = $('playing-level-name'); if (nm) nm.textContent = '🎓 Training: ' + les.name;
        renderInGameSeedsBar();
        resetGame();
        window.__LESSON = les;
        sun = les.sun || 900; updateSunDisplay();
        energyBeans = les.beans == null ? 1 : les.beans; updateEnergyBeanDisplay();
        fieldCooldownUntil = 0; fieldActiveUntil = 0;
        }
        const tn = $('tut-count'); void tn;
        document.body.classList.add('lesson-on'); $('tut-skip').textContent = 'Exit lesson'; { const w = $('wave-num'); if (w && w.parentElement) w.parentElement.style.display = 'none'; }
        tutHold = true;
        tut = { i: -1, steps: les.steps(), pending: false, timer: null, lesson: les, label: 'Training · ' + les.name };
        $('tut-root').style.display = 'block';
        tut.timer = setInterval(tutTick, 120);
        tut.cd = setInterval(() => { if (window.__LESSON) { seedCooldowns = {}; } }, 400);
        addEventListener('resize', tutLayout); addEventListener('scroll', tutLayout, true);
        window.scrollTo(0, 0);
        if (!les.rev) toggleGame();
        tutGo(0);
    }
    window.startLesson = startLesson;
    window.lessonFinish = function (les, completed) {
        window.__LESSON = null; document.body.classList.remove('lesson-on'); $('tut-skip').textContent = 'Skip guide'; { const w = $('wave-num'); if (w && w.parentElement) w.parentElement.style.display = ''; }
        if (les.rev) {
            let g5 = false;
            if (completed) { const d5 = doneMap(); if (!d5[les.id]) { g5 = true; plantProgress.fertilizer = (plantProgress.fertilizer || 0) + 2; savePlantProgress(); updateFertilizerHome(); } markDone(les.id); }
            window.revLessonExit();
            if (completed) toast(g5 ? '🎓 Lesson complete! +2 🧪 fertilizer' : '🎓 Lesson complete!');
            return;
        }
        if (isRunning) toggleGame();
        zombies = []; plants = []; selectedSeed = null; energyBeanActive = false;
        selectedDeck = state.deck || selectedDeck; currentLevel = state.level || 1; currentTier = state.tier || 1;
        let gift = false;
        if (completed) {
            const d = doneMap();
            if (!d[les.id]) { gift = true; plantProgress.fertilizer = (plantProgress.fertilizer || 0) + 2; savePlantProgress(); updateFertilizerHome(); }
            markDone(les.id);
        }
        returnToHome();
        currentMapWorld = les.world;
        $('adventure-map-screen').classList.remove('hidden'); $('selection-screen').classList.add('hidden');
        try { renderAdventureMap(); } catch (e) {}
        if (completed) toast(gift ? '🎓 Lesson complete! +2 🧪 fertilizer' : '🎓 Lesson complete!');
    };
    window.lessonFail = function () {
        // A zombie reached the house: reset the lawn lanes and redo the current step.
        zombies = []; initLawnmowers(); renderGame();
        toast('A zombie got through! Let\'s try that part again.');
        if (tut) { const i = tut.i; tut.pending = false; tutGo(i); }
    };
    function toast(t) {
        let e = $('lesson-toast');
        if (!e) { e = document.createElement('div'); e.id = 'lesson-toast'; e.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:100000;background:#064e3b;color:#fff;border:2px solid #34d399;border-radius:12px;padding:8px 16px;font-weight:800;font-size:14px;box-shadow:0 6px 24px #000a'; document.body.appendChild(e); }
        e.textContent = t; e.style.display = 'block'; clearTimeout(e._t); e._t = setTimeout(() => { e.style.display = 'none'; }, 3200);
    }
    // ------------------------------------------------------------------ training bar on the Adventure Map
    function renderBar() { const scr = $('adventure-map-screen'); if (scr) lessonChips(scr, typeof currentMapWorld === 'number' ? currentMapWorld : 1); }
    function lessonChips(scr, w) {
        let bar = scr.querySelector('.lesson-bar');
        if (!bar) {
            bar = document.createElement('div'); bar.className = 'lesson-bar'; bar.id = scr.id === 'adventure-map-screen' ? 'lesson-bar' : 'lesson-bar5';
            bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 16px;background:#0f172a;border-bottom:1px solid #33415588;position:relative;z-index:5';
            const vp = scr.querySelector('.adventure-viewport') || scr.querySelector('.rv-scrollbar'); if (vp && vp.parentNode) vp.parentNode.insertBefore(bar, vp);
            else return;
        }
        const d = doneMap();
        bar.innerHTML = '<span style="font-weight:900;color:#fde68a;font-size:13px">🎓 Training · World ' + w + '</span>';
        L.filter(x => x.world === w).forEach((x, i) => {
            const b = document.createElement('button'); b.type = 'button';
            b.style.cssText = 'padding:6px 12px;border-radius:10px;font-weight:800;font-size:12px;border:1px solid ' + (d[x.id] ? '#34d399' : '#fbbf24') + ';background:' + (d[x.id] ? '#064e3b' : '#78350f') + ';color:#fff;cursor:pointer';
            b.textContent = (d[x.id] ? '✅ ' : x.icon + ' ') + (i + 1) + '. ' + x.name;
            b.title = 'Short hands-on lesson (about 2 minutes)';
            b.onclick = () => startLesson(x.id);
            bar.appendChild(b);
        });
    }
    window.lessonChips = lessonChips;
    const _ram = renderAdventureMap;
    renderAdventureMap = function () { const r = _ram.apply(this, arguments); try { renderBar(); } catch (e) { console.warn('lesson bar', e); } return r; };
})();
