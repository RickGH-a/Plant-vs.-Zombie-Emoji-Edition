(function () {
    'use strict';
    // =====================================================================================
    //  WORLD 5 — REVERSED INVASION (stages 35–42).  Zombies vs Crazy Dave.
    // =====================================================================================
    const REV = window.REV = { on: false, deck: [], sel: null, cd: {}, ended: false, saved: null, brains: 0, dread: 0, stats: null, startedAt: 0, stage: 1, tier: 1, lanes: [false, false, false, false, false], armed: null, syn: 0, dave: null, fx: {} };
    const KEY_STARS = 'pvzRev2Stars_v1', KEY_DECK = 'pvzRev2Deck_v1', KEY_MODS = 'pvzRev2Mods_v1', KEY_SEEN = 'pvzRevPortalSeen_v1', KEY_TIER = 'pvzRev2Tier_v1', KEY_GSEEN = 'pvzRevGuideSeen_v1';
    const store = {
        get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
    };
    const $ = id => document.getElementById(id);
    const TILE = 100 / 8;                       // one lawn tile, in % of lawn width
    const S2G = t => t / 1.6;                   // tiles / second  ->  game speed units
    const REGEN_BRAINS = 15, REGEN_MS = 3500, DREAD_MAX = 100, DREAD_START = 30, MAX_BATTLE_MS = 12 * 60 * 1000;

    // custom zombie bodies the base game doesn't have (re-using the same animation/visual pipeline)
    if (!ZOMBIE_TYPES.flag_zombie) ZOMBIE_TYPES.flag_zombie = Object.assign({}, ZOMBIE_TYPES.basic, { emoji: '🚩' });
    if (!ZOMBIE_TYPES.balloon_zombie) ZOMBIE_TYPES.balloon_zombie = Object.assign({}, ZOMBIE_TYPES.basic, { emoji: '🎈', flying: true });
    try { ZOMBIE_DISPLAY_NAMES.flag_zombie = 'Flag Zombie'; ZOMBIE_DISPLAY_NAMES.balloon_zombie = 'Balloon Zombie'; } catch (_) {}

    // ---------------------------------------------------------------------------------
    //  THE 14-ZOMBIE ROSTER  (fixed stats – no stat grinding).  hp / arm in HP, sp in tiles/s, dps = eat DPS
    // ---------------------------------------------------------------------------------
    const ROSTER = {
        basic:      { g: 'basic', n: 'Basic Browncoat', cost: 25, hp: 200, arm: 0, sp: 0.45, dps: 60, role: 'Vanguard', pas: ['Swarm Mentality', '+15% speed for each other zombie within 1 tile in its row (max +45%).'], act: { n: 'Lunge & Feint', cost: 10, cd: 8, mode: 'instant', d: 'Lunges 1.2 tiles past one plant (dodging shots) and bites at double DPS for 2.5s.' } },
        flag:       { g: 'flag_zombie', n: 'Flag Zombie', cost: 50, hp: 240, arm: 0, sp: 0.65, dps: 60, role: 'Aura Conductor', pas: ['Vanguard Banner', 'Zombies in a 3×3 area around it gain +20% speed.'], act: { n: 'Rally Cry', cost: 20, cd: 12, mode: 'instant', d: 'Shockwave clears chill/freeze/butter, grants a 120 HP shield (4s) and +35% speed (3s) to allies in 3×3.' } },
        cone:       { g: 'cone', n: 'Conehead', cost: 50, hp: 200, arm: 370, sp: 0.45, dps: 60, role: 'Shield Breaker', pas: ['Angled Deflection', 'While its cone lasts it takes 20% less damage from lobbed shots (≈10% overall).'], act: { n: 'Cone Toss', cost: 15, cd: 0, once: true, mode: 'instant', d: 'Hurls its cone 2.5 tiles: 150 damage, stuns the plant 2.5s and disarms mines. Needs 50+ cone left. Once per life.' } },
        bucket:     { g: 'bucket', n: 'Buckethead', cost: 75, hp: 200, arm: 1100, sp: 0.42, dps: 65, role: 'Vanguard', pas: ['Heavy Plating', 'Huge metal armor (Magnet-shrooms strip it!).'], act: { n: 'Ironclad Brace', cost: 20, cd: 10, mode: 'instant', d: 'Roots in place for 3s: −75% damage and bucket-proof, then slams adjacent plants for 100.' } },
        polevault:  { g: 'polevault', n: 'Pole Vaulter', cost: 75, hp: 340, arm: 0, sp: 0.85, sp2: 0.48, dps: 65, role: 'Backline Assassin', pas: ['First Hurdle', 'Vaults the first plant it meets (not Tall-nuts), then slows to 0.48.'], act: { n: 'Acrobatic Lane-Hop', cost: 15, cd: 9, mode: 'lane', d: 'Click it, then a lane above/below (or press W/S): leaps 1.5 tiles and 1 lane over anything — even Tall-nuts and traps.' } },
        screendoor: { g: 'refractor_zombie', n: 'Screen Door', cost: 100, hp: 220, arm: 900, sp: 0.44, dps: 60, role: 'Shield Breaker', pas: ['Frontal Barrier', 'Its shield blocks 100% of straight shots until the 900 shield HP is gone.'], act: { n: 'Prism Overcharge', cost: 20, cd: 11, mode: 'instant', d: 'For 3.5s the shield reflects every straight shot back at 1.5× speed and damage (fire ignites, ice chills).' } },
        football:   { g: 'football', n: 'All-Star', cost: 125, hp: 450, arm: 950, sp: 0.5, spc: 0.95, dps: 85, role: 'Vanguard', pas: ['Tackle Charge', 'Sprints at 0.95 until it hits a plant: 350 instant burst damage.'], act: { n: 'Blitz Audible', cost: 25, cd: 12, mode: 'instant', d: 'Resets the charge. Next hit within 2s shoves the plant back a tile or crushes Wall-nuts for 500.' } },
        barrel:     { g: 'barrelroller', n: 'Barrel Roller', cost: 100, hp: 300, arm: 0, barrel: 600, sp: 0.45, dps: 60, role: 'Sieger', pas: ['Rolling Cover', 'Barrel (600 HP) absorbs straight shots and crushes Spikeweeds. When it breaks, 2 Imps jump out into adjacent lanes.'], act: { n: 'Bowling Kick', cost: 20, cd: 0, once: true, mode: 'instant', d: 'Kicks the barrel down the lane at 3.2 tiles/s: 450 damage, 1×3 stun for 2.5s and 2 Imps on the impact tile. Once per barrel.' } },
        explorer:   { g: 'explorer', n: 'Explorer', cost: 100, hp: 320, arm: 0, sp: 0.55, dps: 70, role: 'Saboteur', pas: ['Incinerate & Thaw', 'Burns standard plants on contact; chill-immune and thaws allies — but ice/water puts the torch out.'], act: { n: 'Wildfire Toss', cost: 25, cd: 10, mode: 'instant', d: 'Throws a torch 2.5 tiles ahead: 2×1 fire zone for 4s (90 DPS), burns mines/spikes and re-lights the torch.' } },
        pianist:    { g: 'pianist', n: 'Pianist', cost: 125, hp: 380, arm: 0, sp: 0.48, dps: 60, role: 'Aura Conductor', pas: ['Syncopated Rhythm', 'Zombies in 3×3 dance (+25% speed) and may swap lanes every 4s unless commanded.'], act: { n: 'Tempo Shift', cost: 25, cd: 8, mode: 'lane', d: 'Click it, then a lane above/below (or W/S): the whole squad within 1.5 tiles sidesteps in unison with 0.4s of evasion.' } },
        impcannon:  { g: 'impcannon', n: 'Imp Cannon', cost: 100, hp: 420, arm: 0, sp: 0.30, dps: 0, role: 'Aerial Dropper', pas: ['Mortar Bombardment', 'Parks near the edge and lobs an Imp onto the front line every 7s.'], act: { n: 'Precision Eject', cost: 20, cd: 9, mode: 'tile', d: 'Click a target tile anywhere on the lawn: a parachute Imp lands there (80 stomp) and starts chewing.' } },
        tesla:      { g: 'tesla_zombie', n: 'Tesla Saboteur', cost: 125, hp: 400, arm: 0, sp: 0.46, dps: 60, role: 'Saboteur', pas: ['Static Interference', 'Absorbs half of electric damage and turns it into Dread.'], act: { n: 'EMP Short-Circuit', cost: 30, cd: 13, mode: 'instant', d: '3×3 pulse 1.5 tiles ahead: silences plants 3.5s, disables Magnet-shrooms and pops shields.' } },
        balloon:    { g: 'balloon_zombie', n: 'Balloon Zombie', cost: 75, hp: 220, arm: 0, sp: 0.65, dps: 60, role: 'Aerial Dropper', pas: ['Low-Altitude Flight', 'Floats over ground plants; straight peas cannot hit it. Cactus, Blover and lobbers can.'], act: { n: 'Tactical Drop', cost: 15, cd: 0, once: true, mode: 'tile', d: 'Click any tile (col 1–6): pops the balloon and drops there, blowing back shots and stunning the plant 1.5s.' } },
        gargantuar: { g: 'gargantuar', n: 'Gargantuar', cost: 275, hp: 2400, arm: 0, sp: 0.35, dps: 1500, role: 'Sieger', pas: ['Colossal Smash', 'Flattens a plant per swing (1.2s windup) and throws its Imp when below 50% HP.'], act: { n: 'Seismic Slam', cost: 35, cd: 15, mode: 'instant', d: 'Fissure 3 tiles ahead: 600 / 250 / 250 damage, uproots Spikeweeds & Spikerocks, launches plants for 1.5s.' } }
    };
    const ROSTER_ORDER = ['basic', 'flag', 'cone', 'bucket', 'polevault', 'screendoor', 'football', 'barrel', 'explorer', 'pianist', 'impcannon', 'tesla', 'balloon', 'gargantuar'];
    const G2R = {}; ROSTER_ORDER.forEach(k => { G2R[ROSTER[k].g] = k; });
    const ARMORED = new Set(['cone', 'bucket', 'screendoor', 'football']);
    const HEAVY = new Set(['football', 'gargantuar']);
    // Technique Modules (side-grades). id 0 = standard. Unlocked by total stars earned.
    const MODS = {
        basic:      { n: 'Pack Rush', d: 'Lunge also pulls every Basic within 1.5 tiles forward with it.', stars: 3 },
        flag:       { n: 'Fortify', d: 'Rally Cry grants a 220 HP shield instead of the speed boost.', stars: 6 },
        cone:       { n: 'Crushing Cone', d: 'Cone Toss deals 280 and stuns 4.5s, but needs 150 cone left.', stars: 9 },
        bucket:     { n: 'Anchor Slam', d: 'Brace lasts 4.5s and the slam deals 200 + 1.5s stun (cooldown 14s).', stars: 12 },
        polevault:  { n: 'Vault + Stun Slam', d: 'Lane-Hop becomes a 2-tile vault that stuns plants around the landing for 1.5s.', stars: 15 },
        screendoor: { n: 'Twin Prism', d: 'Overcharge reflects into the adjacent lanes as well (3.5s).', stars: 18 },
        football:   { n: 'Bulldoze', d: 'Blitz Audible also stuns plants beside the impact for 1.5s.', stars: 21 },
        barrel:     { n: '3-Lane Scatter', d: 'Bowling Kick launches three mini-barrels (one per lane) at 60% damage.', stars: 24 },
        explorer:   { n: 'Inferno', d: 'Wildfire Toss covers 3 tiles for 6s.', stars: 27 },
        pianist:    { n: 'Encore', d: 'Tempo Shift sidesteps two lanes.', stars: 30 },
        impcannon:  { n: 'Cluster Drop', d: 'Precision Eject drops two Imps without parachutes.', stars: 33 },
        tesla:      { n: 'Overload', d: 'EMP becomes 5×3 but lasts only 2.5s.', stars: 36 },
        balloon:    { n: 'Hot Air', d: 'Tactical Drop gust covers 3×3 tiles.', stars: 39 },
        gargantuar: { n: 'Aftershock', d: 'Seismic Slam fissure travels 4 tiles at 70% damage.', stars: 42 }
    };
    const TIER_NAMES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

    // ---------------------------------------------------------------------------------
    //  STAGES 35–42  (rows 0..4, cols 0..5 are plants; letters -> plant types)
    // ---------------------------------------------------------------------------------
    const PL = { s: 'sunflower', y: 'twinsunflower', J: 'primalsunflower', S: 'sunshroom', p: 'peashooter', n: 'snowpea', f: 'firepea', g: 'gatlingpea', e: 'peapod', E: 'primalpeashooter', F: 'electricpeashooter', a: 'cabbagetosser', o: 'corntosser', h: 'melonpult', j: 'wintermelon', v: 'citron', c: 'coconutcannon', d: 'dusklobber', q: 'laserbean', G: 'grimrose', z: 'shadowshroom', R: 'firedragon', N: 'snowdragon', u: 'sweetpotato', U: 'sapling', r: 'rotobaga', b: 'bonkchoy', H: 'bowlingbulb', C: 'celery', K: 'intensivecarrot', L: 'electricblueberry', k: 'spikeweed', I: 'spikerock', A: 'chomper', B: 'torchwood', O: 'magnetshroom', i: 'lightningreed', x: 'cactus', m: 'potatomine', l: 'garlic', T: 'tileturnip', w: 'wallnut', t: 'tallnut', D: 'infinut', Q: 'cherrybomb', Z: 'jalapeno', W: 'blover', Y: 'iceberglettuce', M: 'thymewarp', P: 'powerlily', V: 'gravebuster', X: 'primalpotatomine' };
    const TOOL_TIER = { blover: 1, iceberglettuce: 2, powerlily: 2, cherrybomb: 3, gravebuster: 3, jalapeno: 4, thymewarp: 5, primalpotatomine: 6 };
    const ALLT = ['cherrybomb', 'jalapeno', 'iceberglettuce', 'blover', 'thymewarp', 'powerlily', 'gravebuster', 'primalpotatomine'];
    const UNL = { 35: ['basic', 'cone', 'polevault'], 36: ['bucket'], 37: ['screendoor', 'flag'], 38: ['explorer'], 39: ['barrel'], 40: ['impcannon'], 41: ['football'], 42: ['tesla'], 43: ['pianist'], 44: ['balloon'], 45: ['gargantuar'] };
    const STAGES = [
        { id: 35, name: 'Suburban Outpost', icon: '🏡', arche: 'Classic Peashooters, Sunflowers, Wall-nuts and Potato Mines.', lesson: 'Use Cone Toss to disarm mines and Lane-Hop to assassinate Sunflowers.',
          rows: ['s.p.w.', 's.p.m.', 'ssp.w.', 's.p.m.', 's.p.w.'], fill: { 5: 'w', 4: 'm', 3: 'p', 2: 'p', 1: 's', 0: 's' }, tools: [] },
        { id: 36, name: 'The Torchwood Killzone', icon: '🔥', arche: 'Peas set ablaze by Torchwood behind Wall-nuts.', lesson: 'Prism Overcharge turns Torchwood fire against Dave.',
          rows: ['s.p..w', 's.pB..', 'ysppB.', 's.pB..', 's.p..w'], fill: { 5: 'w', 4: 'B', 3: 'p', 2: 'p', 1: 'f', 0: 's' }, tools: ['iceberglettuce'] },
        { id: 37, name: 'Frostbite Trench', icon: '❄️', arche: 'Snow Peas, Winter Melons, Snow Dragons and Spikerocks.', lesson: 'Rally Cry cleanses chill. Screen Door shields block frosty peas.',
          rows: ['s.n...', 's.nN..', 'ysnN..', 's.nN..', 's.n...'], fill: { 5: 'w', 4: 'n', 3: 'n', 2: 'n', 1: 's', 0: 's' }, tools: ['iceberglettuce', 'blover'] },
        { id: 38, name: 'Ember Fields', icon: '🌋', arche: 'Fire Peas and Fire Dragons burning behind Torchwoods.', lesson: 'The Explorer keeps its torch lit — kill Snow Peas first, and light the way for the horde.',
          rows: ['s.p.k.', 'sfB...', 'ysfBR.', 'sfB...', 's.p.k.'], fill: { 5: 'w', 4: 'R', 3: 'B', 2: 'f', 1: 's', 0: 's' }, tools: ['jalapeno', 'blover'] },
        { id: 39, name: 'Artillery Ridge', icon: '🍉', arche: 'Lobbers (cabbage, corn, melon, dusk) behind Tall-nuts and Chompers.', lesson: 'Barrel Kick lands Imps behind the walls; Explorer + barrel makes a Thermal Shockwave.',
          rows: ['s.a.t.', 'sao.tA', 'yo..tA', 'sda.tA', 's.a.t.'], fill: { 5: 'A', 4: 't', 3: 'h', 2: 'a', 1: 's', 0: 's' }, tools: ['cherrybomb', 'blover'] },
        { id: 40, name: 'Magnetic Grid', icon: '🧲', arche: 'Magnet-shrooms, Lightning Reeds, Citrons and Electric Blueberries.', lesson: 'Magnets rip metal off — Imp Cannons and Buckets beware. Eject Imps behind the grid.',
          rows: ['s.i.O.', 'si.OLw', 'ysiv.O', 'si.OLw', 's.i.O.'], fill: { 5: 'w', 4: 'O', 3: 'v', 2: 'i', 1: 's', 0: 's' }, tools: ['cherrybomb', 'thymewarp'] },
        { id: 41, name: 'Spore Swamp', icon: '🍄', arche: 'Slowing and cursing plants: Shadow-shrooms, Saplings, Grim Roses and Sweet Potatoes.', lesson: 'Slows ruin rushers: pair All-Stars with Flag Rally, and hit the healers first.',
          rows: ['S.zU.t', 'suGUw.', 'ysGzU.', 'suGUw.', 'S.zU.t'], fill: { 5: 't', 4: 'U', 3: 'z', 2: 'G', 1: 'u', 0: 's' }, tools: ['iceberglettuce', 'blover', 'cherrybomb'] },
        { id: 42, name: 'The Shifting Maze', icon: '🌀', arche: 'Garlic diverters (random up or down!), Bonk Choy, Chompers and Spikeweeds.', lesson: 'Garlic now lets you bite a couple of times before it shoves you sideways. EMP stuns plants for a rush.',
          rows: ['s.lk.A', 'splkbA', 'ysnlkA', 'splkbA', 's.lk.A'], fill: { 5: 'A', 4: 'l', 3: 'k', 2: 'n', 1: 's', 0: 's' }, tools: ['jalapeno', 'gravebuster'] },
        { id: 43, name: 'Bowling Alley', icon: '🎳', arche: 'Bowling Bulbs, Rotobagas, Celery and Intensive Carrots that revive fallen plants.', lesson: 'Intensive Carrots resurrect plants — kill the carrot’s partner twice. Tempo Shift dodges bulbs and bombs.',
          rows: ['s.Hr.C', 'sKHrwC', 'ysHKrC', 'sKHrwC', 's.Hr.C'], fill: { 5: 'C', 4: 'w', 3: 'r', 2: 'H', 1: 'K', 0: 's' }, tools: ['cherrybomb', 'jalapeno', 'powerlily'] },
        { id: 44, name: 'Sky Garden', icon: '☁️', arche: 'Cacti, Laser Beans and Pea Pods that shoot the sky.', lesson: 'Balloons need ground support — drop beside allies for a Toxic cloud, and watch for Dave’s Blover.',
          rows: ['s.xe.w', 'sqxe.t', 'yseqxw', 'sqxe.t', 's.xe.w'], fill: { 5: 'w', 4: 'x', 3: 'e', 2: 'q', 1: 's', 0: 's' }, tools: ['blover', 'iceberglettuce', 'thymewarp'] },
        { id: 45, name: 'Dave’s Ironclad Garden', icon: '🛡️', arche: 'Winter Melons and Citrons behind Torchwoods and Tall-nuts.', lesson: 'Full roster unlocked: dodge Cherry Bombs with Tempo Shift, smash walls with Seismic Slam.',
          rows: ['s.nv.t', 'syhB.t', 'ysnvBD', 'syhB.t', 's.nv.t'], fill: { 5: 't', 4: 'v', 3: 'j', 2: 'j', 1: 's', 0: 'y' }, tools: ['cherrybomb', 'jalapeno', 'iceberglettuce', 'powerlily'] },
        { id: 46, name: 'Primal Jungle', icon: '🦖', arche: 'Primal Peashooters, Primal Sunflowers, Spikerocks and Infi-nuts.', lesson: 'Heavy hitters: use Bucket Brace and Prism to soak, then break the lane with a Blitzkrieg.',
          rows: ['sJE.IA', 's.EEID', 'yJEUIA', 's.EEID', 'sJE.IA'], fill: { 5: 'A', 4: 'I', 3: 'E', 2: 'E', 1: 'J', 0: 's' }, tools: ['cherrybomb', 'blover', 'thymewarp', 'primalpotatomine'] },
        { id: 47, name: 'Storm Front', icon: '⚡', arche: 'Electric Peashooters, Lightning Reeds, Magnets and Blueberries.', lesson: 'Electricity stuns: Tesla absorbs half of it. Keep your squads spread out.',
          rows: ['sqFiOL', 'sFiqOL', 'ysFiLO', 'sFiqOL', 'sqFiOL'], fill: { 5: 'O', 4: 'L', 3: 'i', 2: 'F', 1: 's', 0: 's' }, tools: ['cherrybomb', 'iceberglettuce', 'blover', 'powerlily'] },
        { id: 48, name: 'Dragon’s Lair', icon: '🐉', arche: 'Fire and Snow Dragons breathing across three lanes, with Torchwood and Infi-nuts.', lesson: 'Dragons hit 3 lanes — attack the lane edges. Plant Food makes them sweep.',
          rows: ['s.RN.D', 'sfRNBt', 'yJRNBD', 'sfRNBt', 's.RN.D'], fill: { 5: 'D', 4: 'B', 3: 'N', 2: 'R', 1: 'f', 0: 's' }, tools: ['cherrybomb', 'jalapeno', 'iceberglettuce', 'thymewarp'] },
        { id: 49, name: 'Chomper Nursery', icon: '🦷', arche: 'Chompers, Bonk Choys, Celery and Spikeweeds: a melee killing field.', lesson: 'Chompers swallow one zombie then rest 12s — feed them a Basic first. Bungee out of danger.',
          rows: ['sb.kAC', 'slAbAC', 'ysAbAC', 'slAbAC', 'sb.kAC'], fill: { 5: 'C', 4: 'A', 3: 'k', 2: 'b', 1: 'l', 0: 's' }, tools: ['cherrybomb', 'jalapeno', 'gravebuster', 'blover'] },
        { id: 50, name: 'Power Tile Grid', icon: '🟪', arche: 'Tile Turnips link Gatlings and Melon-pults: one Plant Food powers them all.', lesson: 'Dave’s Plant Food fires every powered plant at once — strike the power tiles, or burst the lane first.',
          rows: ['s.pKut', 'sKghwt', 'ysgjuw', 'sKghwt', 's.pKut'], stack: [[1, 2, 'T'], [1, 3, 'T'], [2, 2, 'T'], [2, 3, 'T'], [3, 2, 'T'], [3, 3, 'T']], fill: { 5: 't', 4: 'u', 3: 'h', 2: 'g', 1: 'K', 0: 's' }, tools: ['cherrybomb', 'jalapeno', 'thymewarp', 'powerlily'] },
        { id: 51, name: 'Curse Orchard', icon: '🥀', arche: 'Grim Roses, Dusk Lobbers and Shadow-shrooms spreading curses.', lesson: 'Curses jump to nearby zombies. Spread out and use Brace/Prism to shrug them off.',
          rows: ['sddGzt', 'sdGzUD', 'ysdGzD', 'sdGzUD', 'sddGzt'], fill: { 5: 'D', 4: 'U', 3: 'z', 2: 'G', 1: 'd', 0: 's' }, tools: ['cherrybomb', 'jalapeno', 'blover', 'iceberglettuce'] },
        { id: 52, name: 'Winter Fortress', icon: '🏔️', arche: 'Snow Peas, Snow Dragons, Winter Melons and Laser Beans behind Infi-nuts.', lesson: 'Total chill: Rally Cry plus Blitzkrieg is your answer. Keep the Flag alive.',
          rows: ['s.nN.D', 'snNjqt', 'ysnNjD', 'snNjqt', 's.nN.D'], fill: { 5: 'D', 4: 'j', 3: 'N', 2: 'n', 1: 's', 0: 's' }, tools: ['iceberglettuce', 'cherrybomb', 'thymewarp', 'blover', 'powerlily'] },
        { id: 53, name: 'The Last Garden', icon: '🌺', arche: 'A bit of everything: Dave’s best plants in one garden.', lesson: 'Everything you’ve learned. Pick your best 8, study the lanes and combine synergies.',
          rows: ['sJhBvD', 'syEFvt', 'JsqRNI', 'syEFvt', 'sJhBvD'], fill: { 5: 'D', 4: 'v', 3: 'E', 2: 'q', 1: 'y', 0: 's' }, tools: ['cherrybomb', 'jalapeno', 'iceberglettuce', 'blover', 'thymewarp', 'powerlily', 'primalpotatomine', 'gravebuster'] },
        { id: 54, name: 'Zomboss vs. Dave’s Mega-Bot', icon: '🤖', arche: 'Boss: Dave pilots a 5-lane Mega-Bot that moves plants and fires lane lasers.', lesson: 'Bait the laser into one lane, sidestep with Tempo Shift and breach the core!', boss: true,
          rows: ['sJEhvD', 'syEhcB', 'yJEvBD', 'syEhcB', 'sJEhvD'], fill: { 5: 'D', 4: 'v', 3: 'E', 2: 'h', 1: 's', 0: 'y' }, tools: ['cherrybomb', 'jalapeno', 'iceberglettuce', 'blover', 'thymewarp', 'powerlily', 'primalpotatomine', 'gravebuster'] }
    ];
    STAGES.forEach((S, i) => {
        S.unlock = UNL[S.id] || [];
        S.sun = 125 + 15 * i + (S.boss ? 25 : 0); S.brains = 150 + 6 * i; S.par = 650 + 90 * i + (S.boss ? 100 : 0);
        const set = new Set();
        S.rows.forEach(r => r.split('').forEach(ch => { if (PL[ch] && !ALLT.includes(PL[ch])) set.add(PL[ch]); }));
        Object.values(S.fill).forEach(ch => { if (PL[ch]) set.add(PL[ch]); });
        (S.stack || []).forEach(s => set.add(PL[s[2]]));
        S.deck = [...set];       // Dave's plant deck for this stage (static plants)
    });
    window.REV_STAGES = STAGES;
    const NSTAGE = STAGES.length, LAST_ID = STAGES[NSTAGE - 1].id;
    const stageById = id => STAGES[id - 35];
    const SD = () => STAGES[(REV.stage || 35) - 35];
    function unlockedZombies(stageId) { const s = new Set(); STAGES.forEach(st => { if (st.id <= stageId) st.unlock.forEach(k => s.add(k)); }); if (stageId >= 45 || (plantProgress && plantProgress.cheatAll)) ROSTER_ORDER.forEach(k => s.add(k)); return ROSTER_ORDER.filter(k => s.has(k)); }
    function formation(stage, tier) {
        // returns [{type,r,c}]
        const out = [];
        const grid = stage.rows.map(r => r.split(''));
        grid.forEach((row, r) => row.forEach((ch, c) => { if (PL[ch]) out.push({ type: PL[ch], r, c }); }));
        (stage.stack || []).forEach(s => out.push({ type: PL[s[2]], r: s[0], c: s[1], under: true }));
        const N = [0, 3, 6, 10, 14, 18, 24][tier - 1];
        const order = [2, 1, 3, 0, 4], cols = [5, 4, 3, 2, 1, 0];
        let added = 0;
        for (const c of cols) for (const r of order) {
            if (added >= N) break;
            if (grid[r][c] !== '.') continue;
            const ch = stage.fill[c]; if (!PL[ch]) continue;
            grid[r][c] = ch; out.push({ type: PL[ch], r, c }); added++;
        }
        return out;
    }
    window.REV_formation = formation;
    // ---- stars / modules persistence ----
    const starsOf = (sid, tier) => (store.get(KEY_STARS, {})[sid + ':' + tier]) || 0;
    const stageBest = sid => Math.max(0, ...[1, 2, 3, 4, 5, 6, 7].map(t => starsOf(sid, t)));
    const totalStars = () => { const o = store.get(KEY_STARS, {}); let n = 0; for (const k in o) n += o[k] || 0; return n; };
    const stageOpen = sid => sid <= 35 || starsOf(sid - 1, 1) >= 1 || stageBest(sid - 1) >= 1 || !!(plantProgress && plantProgress.cheatAll);
    const tierOpen = (sid, t) => t <= 1 || starsOf(sid, t - 1) >= 1 || !!(plantProgress && plantProgress.cheatAll);
    const modOn = k => { const m = store.get(KEY_MODS, {})[k]; return m === 1 && totalStars() >= MODS[k].stars; };
    const zCost = k => ROSTER[k].cost;
    const zCd = k => 1500 + ROSTER[k].cost * 10;
    window.zCostPub = zCost;

    // ---------------------------------------------------------------------------------
    //  deck + unlock helpers
    // ---------------------------------------------------------------------------------
    function loadDeck() {
        const ok = new Set(unlockedZombies(REV.stage));
        let d = store.get(KEY_DECK, null);
        if (!Array.isArray(d)) d = ['basic', 'cone', 'polevault'];
        d = d.filter((k, i) => ROSTER[k] && ok.has(k) && d.indexOf(k) === i).slice(0, 8);
        if (!d.length) d = unlockedZombies(REV.stage).slice(0, 3);
        REV.deck = d;
    }
    window.revPortalUnlocked = function () {
        if (plantProgress && plantProgress.cheatAll) return true;
        return worldClearCount(2) >= worldUnlockRequirement(3);
    };

    // ---------------------------------------------------------------------------------
    //  screens
    // ---------------------------------------------------------------------------------
    function build() {
        if ($('rev-map-screen')) return;
        const mk = (id, cls, html) => { const d = document.createElement('div'); d.id = id; d.className = cls; d.innerHTML = html; document.body.appendChild(d); return d; };
        mk('rev-map-screen', 'rv-screen', `<div class="rv-wrap">
          <div class="rv-head"><div><div class="rv-title">🌀 REVERSED INVASION</div><div class="rv-sub">World 5 · 20 stages (35–54). The lawn is already planted and the roles are flipped: <b>you</b> command the horde. Fixed zombie stats, tactical click-to-trigger abilities, Plant Defense Tiers I–VII, and a Crazy Dave who fights back.</div></div>
            <div style="display:flex;gap:8px;align-items:center"><span class="rv-starchip" id="rv-totalstars">⭐ 0</span><button class="rv-btn go rv-guide-btn" onclick="revGuide()">📖 Guide</button><button class="rv-btn" onclick="revCloseToHome()">🏠 Home</button></div></div>
          <div class="rv-scrollbar"><button class="rv-btn" id="rv-sl" title="Scroll left">◀</button><span>↔ Drag, use the arrows or the mouse wheel to travel along the route</span><button class="rv-btn" id="rv-sr" title="Scroll right">▶</button><button class="rv-btn go" id="rv-sc" title="Jump to your current stage">📍 Current stage</button></div>
          <div class="rv-scroll" id="rv-scroll"><div class="rv-canvas" id="rv-canvas">
            <svg class="rv-route" id="rv-route" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true"><path id="rv-path" d=""/></svg>
            <div id="rv-nodes"></div>
            <button class="rv-portal back" style="left:90px;top:14%" onclick="revReturnPortal()" title="Return to the normal worlds"><i class="glow"></i><i class="hole"></i><i class="core"></i><i class="ring"></i><span class="em">🌻</span><span class="lbl">NORMAL WORLDS</span></button>
          </div></div>
          <div class="rv-foot">⭐ Star 1: breach 3+ lanes · ⭐⭐ Star 2: win within the Brain Budget · ⭐⭐⭐ Star 3: breach all 5 lanes and trigger 3+ Synergies.</div></div>`);
        mk('rev-select-screen', 'rv-screen', `<div class="rv-wrap">
          <div class="rv-head"><div><div class="rv-title" id="rv-sel-title">🧟 CHOOSE YOUR HORDE</div><div class="rv-sub" id="rv-sel-sub"></div><div class="rv-sub" id="rv-sel-blurb" style="color:#fde68a;font-weight:700"></div></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="rv-btn go rv-guide-btn" onclick="revGuide('how')">📖 How to play</button><button class="rv-btn" onclick="revSelectBack()">← Back</button><button class="rv-btn go" id="rv-start-btn" onclick="revStartBattle()">☠️ Start Battle</button></div></div>
          <div class="rv-tierbar" id="rv-tierbar"></div>
          <div class="rv-deckbar" id="rv-deckbar"></div>
          <div class="rv-sel-grid" id="rv-sel-grid"></div></div>`);
        mk('rev-result', '', '');
        const wrap = $('lawn-wrap');
        if (wrap) {
            const h = document.createElement('div'); h.id = 'rev-house'; h.innerHTML = '<i>🧠</i><i>🧠</i><i>🧠</i><i>🧠</i><i>🧠</i>'; wrap.appendChild(h);
            const a = document.createElement('div'); a.id = 'rev-ambient';
            a.innerHTML = Array.from({ length: 12 }, (_, i) => `<span style="left:${(i * 8.3 + 3) % 98}%;--t:${10 + (i % 5) * 2.5}s;--d:${(i * 1.1) % 9}s;--x:${(i % 2 ? 1 : -1) * (20 + (i % 4) * 14)}px">${['👻', '💀', '🦇', '🕸️', '✨', '🧠'][i % 6]}</span>`).join('');
            wrap.appendChild(a);
            const f = document.createElement('div'); f.id = 'rev-fx'; wrap.appendChild(f);
            const hud = document.createElement('div'); hud.id = 'rev-hud';
            hud.innerHTML = '<span id="rv-brains" title="Brains: your money. Spend them to raise zombies. Eating plants and breaching lanes gives more.">🧠 0</span><span id="rv-dreadw" title="Dread: powers manual abilities"><b id="rv-dread">💀 30</b><i class="rv-dbar"><u id="rv-dbar"></u></i></span><span id="rv-lanes" title="Lanes breached out of 5. Breach 3 to win.">🏠 0/5</span><span id="rv-syn" title="Synergies triggered">⚡ 0</span><span id="rv-sun" title="Dave’s sun: what he spends on new plants.">☀️ 0</span>';
            revBars().top.appendChild(hud);
            const cmd = document.createElement('div'); cmd.id = 'rev-cmd';
            cmd.innerHTML = '<button class="rv-cmd" id="cmd-fog" title="Necrotic Fog (F) — 6s cover: less damage, raise zombies further forward" onclick="revCmd(\'fog\')"><b>🌫️ Necrotic Fog</b><small>30💀</small><i></i></button><button class="rv-cmd" id="cmd-grave" title="Graveyard Ambush (G) — place 2 Tombstones" onclick="revCmd(\'grave\')"><b>🪦 Graveyard Ambush</b><small>35💀</small><i></i></button><button class="rv-cmd" id="cmd-bungee" title="Bungee Reposition (B) — move a zombie up to 3 tiles" onclick="revCmd(\'bungee\')"><b>🪝 Bungee Reposition</b><small>40💀</small><i></i></button><button class="rv-cmd fin" id="cmd-finish" title="Win now with the stars you have" onclick="revFinishNow()" style="display:none"><b>🏁 Finish Now</b><small>secure the win</small></button>';
            revBars().bot.appendChild(cmd);
            const ban = document.createElement('div'); ban.id = 'rev-banner'; wrap.appendChild(ban);
        }
    }
    function revBars() {
        const w = $('lawn-wrap'); let top = $('rev-topbar'), bot = $('rev-botbar');
        if (!top) { top = document.createElement('div'); top.id = 'rev-topbar'; w.parentNode.insertBefore(top, w); }
        if (!bot) { bot = document.createElement('div'); bot.id = 'rev-botbar'; w.parentNode.insertBefore(bot, w.nextSibling); }
        return { top, bot };
    }
    function show(id) { const e = $(id); if (e) { e.classList.add('on'); e.scrollTop = 0; } }
    function hide(id) { const e = $(id); if (e) e.classList.remove('on'); }

    // ---- portal on the World 2 map ----
    const _renderMap = renderAdventureMap;
    renderAdventureMap = function () {
        _renderMap.apply(this, arguments);
        const holder = $('adventure-map-nodes'); if (!holder) return;
        const old = holder.querySelector('.rv-portal'); if (old) old.remove();
        if (currentMapWorld === 2 && revPortalUnlocked()) {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'rv-portal'; b.style.left = '88%'; b.style.top = '14%';
            b.title = 'A strange portal... the Reversed World';
            b.innerHTML = '<i class="glow"></i><i class="hole"></i><i class="core"></i><i class="ring"></i><span class="em">🧟</span><span class="lbl">REVERSED WORLD</span>';
            b.onclick = ev => revEnterPortal(ev.currentTarget);
            holder.appendChild(b);
        }
    };
    function warp(el, cb) {
        const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
        const w = document.createElement('div'); w.className = 'rv-warp';
        w.style.left = (r.left + r.width / 2) + 'px'; w.style.top = (r.top + r.height / 2) + 'px';
        document.body.appendChild(w);
        try { playSound('levelup'); } catch (_) {}
        setTimeout(cb, 520); setTimeout(() => w.remove(), 1100);
    }
    window.revEnterPortal = function (el) {
        build();
        warp(el, () => { $('adventure-map-screen').classList.add('hidden'); closeTierPicker(); renderRevMap(); show('rev-map-screen'); });
    };
    window.revReturnPortal = function () {
        warp(document.querySelector('#rev-map-screen .rv-portal'), () => {
            hide('rev-map-screen'); currentMapWorld = 2; renderAdventureMap(); $('adventure-map-screen').classList.remove('hidden');
        });
    };
    window.revCloseToHome = function () {
        hide('rev-map-screen'); hide('rev-select-screen'); mapThenPlantSelect = false;
        document.getElementById('selection-screen').classList.remove('hidden'); window.scrollTo(0, 0);
    };
    function renderRevMap(noScroll) {
        const holder = $('rv-nodes'); if (!holder) return;
        holder.innerHTML = '';
        const cv = $('rv-canvas'), sc = $('rv-scroll'), N = STAGES.length, W = 260 + 190 * N, H = 520;
        cv.style.width = W + 'px'; cv.style.height = H + 'px';
        const pos = STAGES.map((_, i) => [210 + i * 190, 50 + (i % 2 ? -21 : 21) + 7 * Math.sin(i * 1.3)]);
        const rt = $('rv-route'); if (rt) rt.setAttribute('viewBox', `0 0 ${W} ${H}`);
        const pth = $('rv-path'); if (pth) pth.setAttribute('d', pos.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + (p[1] * H / 100)).join(' '));
        cv.querySelectorAll('.rv-decor').forEach(e => e.remove());
        const dec = ['🪦', '🦇', '🕸️', '👻', '🎃', '🦴', '🌫️'];
        for (let i = 0; i < Math.floor(W / 260); i++) { const d = document.createElement('div'); d.className = 'rv-decor'; d.textContent = dec[i % dec.length]; d.style.left = (130 + i * 260 + (i * 37) % 90) + 'px'; d.style.top = (10 + (i * 53) % 78) + '%'; d.style.animationDelay = (i % 5) * .5 + 's'; cv.appendChild(d); }
        const ts = $('rv-totalstars'); if (ts) ts.textContent = '⭐ ' + totalStars() + ' / ' + (N * 3 * 7 > 999 ? N * 3 : N * 3);
        let cur = 0;
        pos.forEach((p, i) => {
            const S = STAGES[i], open = stageOpen(S.id); if (open) cur = i;
            const b = document.createElement('button'); b.type = 'button';
            b.className = 'rv-node' + (open ? '' : ' locked') + (S.boss ? ' boss' : ''); b.style.left = p[0] + 'px'; b.style.top = p[1] + '%'; b.dataset.i = i;
            b.title = S.arche;
            const best = stageBest(S.id);
            b.innerHTML = open ? `<span class="e">${S.icon}</span><span class="t">${S.id}. ${S.name}</span><span class="s">${best ? '⭐'.repeat(best) + '☆'.repeat(3 - best) : '☠️ PLAY'}</span>`
                : `<span class="e">🔒</span><span class="t">${S.id}. ${S.name}</span><span class="s">Clear stage ${S.id - 1}</span>`;
            if (open) b.onclick = () => { if (!REV._dragMoved) revOpenSelect(S.id); }; else b.disabled = true;
            holder.appendChild(b);
        });
        REV._curX = pos[cur][0];
        if (sc && !noScroll) setTimeout(() => { sc.scrollTo({ left: Math.max(0, REV._curX - sc.clientWidth / 2), behavior: 'auto' }); }, 30);
        if (sc && !sc._wired) {
            sc._wired = true;
            $('rv-sl').onclick = () => sc.scrollBy({ left: -sc.clientWidth * 0.7, behavior: 'smooth' });
            $('rv-sr').onclick = () => sc.scrollBy({ left: sc.clientWidth * 0.7, behavior: 'smooth' });
            $('rv-sc').onclick = () => sc.scrollTo({ left: Math.max(0, REV._curX - sc.clientWidth / 2), behavior: 'smooth' });
            sc.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { sc.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
            let down = false, sx = 0, sl = 0;
            sc.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') return; down = true; sx = e.clientX; sl = sc.scrollLeft; REV._dragMoved = false; });
            window.addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 5) REV._dragMoved = true; sc.scrollLeft = sl - dx; });
            window.addEventListener('pointerup', () => { down = false; setTimeout(() => { REV._dragMoved = false; }, 30); });
        }
    }

    // ---------------------------------------------------------------------------------
    //  stage / horde selection
    // ---------------------------------------------------------------------------------
    window.revOpenSelect = function (stageId) {
        REV.stage = stageId || 35;
        const t = store.get(KEY_TIER, {})[REV.stage] || 1; REV.tier = tierOpen(REV.stage, t) ? t : 1;
        loadDeck(); hide('rev-map-screen'); renderSelect(); show('rev-select-screen');
    };
    window.revSelectBack = function () { hide('rev-select-screen'); renderRevMap(); show('rev-map-screen'); };
    window.revSetTier = function (t) {
        if (!tierOpen(REV.stage, t)) { try { missionToast('Clear Tier ' + TIER_NAMES[t - 2] + ' on this stage first.'); } catch (_) {} return; }
        REV.tier = t; const o = store.get(KEY_TIER, {}); o[REV.stage] = t; store.set(KEY_TIER, o); renderSelect();
    };
    const parOf = () => Math.round(SD().par * (1 + (REV.tier - 1) * 0.12) / 5) * 5;
    function statLine(k) {
        const r = ROSTER[k];
        return `❤️ ${r.hp}${r.arm ? '+' + r.arm : ''}${r.barrel ? '+🛢️' + r.barrel : ''} · 👣 ${(r.spc || r.sp).toFixed(2)} · 🍴 ${r.dps || '—'}`;
    }
    function renderSelect() {
        const S = SD(), have = unlockedZombies(S.id), full = REV.deck.length >= 8;
        $('rv-sel-title').textContent = `🧟 STAGE ${S.id}: ${S.name.toUpperCase()}`;
        $('rv-sel-sub').textContent = `Pick up to 8 zombies (${REV.deck.length}/8). New? Tap 📖 How to play. Tap ⓘ on a card to learn about it.`;
        $('rv-sel-blurb').textContent = `${S.arche} ${S.lesson}`;
        $('rv-tierbar').innerHTML = '<b>Plant Defense Tier</b>' + TIER_NAMES.map((n, i) => { const t = i + 1, op = tierOpen(S.id, t), st = starsOf(S.id, t); return `<button class="rv-tier${t === REV.tier ? ' on' : ''}${op ? '' : ' lock'}" onclick="revSetTier(${t})">${op ? '' : '🔒 '}${n}<small>${st ? '⭐'.repeat(st) : '&nbsp;'}</small></button>`; }).join('') + `<span class="rv-tinfo">Dave starts with ☀️ ${S.sun + 25 * (REV.tier - 1)} · thinks every ${(3.5 - (REV.tier - 1) * 0.35).toFixed(1)}s</span>`;
        $('rv-sel-grid').innerHTML = ROSTER_ORDER.map(k => {
            const r = ROSTER[k], z = ZOMBIE_TYPES[r.g], on = REV.deck.includes(k), lockd = !have.includes(k);
            const md = MODS[k], mUnlocked = totalStars() >= md.stars, mOn = modOn(k);
            return `<div class="rv-zc${on ? ' on' : ''}${full && !on ? ' full' : ''}${lockd ? ' lockd' : ''}" onclick="${lockd ? '' : `revToggleZ('${k}')`}"><span class="em">${z.emoji}</span><span class="nm">${r.n}</span><span class="st role">${r.role}</span><span class="st">${statLine(k)}</span>
              <span class="st act1">⚡ ${r.act.n}</span>
              <button class="rv-info" onclick="event.stopPropagation();revGuide('z:${k}')" title="Open this zombie’s guide page">ⓘ Learn</button><span class="co">🧠 ${r.cost}</span>${lockd ? `<span class="lk">🔒 Unlocks at stage ${STAGES.find(s => s.unlock.includes(k)).id}</span>` : `<button class="rv-mod${mOn ? ' on' : ''}${mUnlocked ? '' : ' lock'}" onclick="event.stopPropagation();revToggleMod('${k}')" title="${md.d}">${mUnlocked ? (mOn ? '✅ ' : '▫️ ') + 'Module: ' + md.n : '🔒 Module (' + md.stars + '⭐)'}</button>`}</div>`;
        }).join('');
        $('rv-deckbar').innerHTML = '<b style="margin-right:6px">Your horde:</b>' + Array.from({ length: 8 }, (_, i) => { const k = REV.deck[i]; return `<span class="sl${k ? ' f' : ''}" title="${k ? ROSTER[k].n : 'Empty'}">${k ? ZOMBIE_TYPES[ROSTER[k].g].emoji : ''}</span>`; }).join('');
        $('rv-start-btn').disabled = REV.deck.length === 0;
    }
    window.revToggleZ = function (k) {
        const i = REV.deck.indexOf(k);
        if (i >= 0) REV.deck.splice(i, 1);
        else if (REV.deck.length < 8) REV.deck.push(k);
        else { try { missionToast('Your horde is full (8). Tap a selected zombie to remove it.'); } catch (_) {} return; }
        store.set(KEY_DECK, REV.deck); renderSelect();
    };
    window.revToggleMod = function (k) {
        if (totalStars() < MODS[k].stars) { try { missionToast(`Module unlocks at ${MODS[k].stars} ⭐ total.`); } catch (_) {} return; }
        const o = store.get(KEY_MODS, {}); o[k] = o[k] === 1 ? 0 : 1; store.set(KEY_MODS, o); renderSelect();
    };

    // ---------------------------------------------------------------------------------
    //  small helpers
    // ---------------------------------------------------------------------------------
    const PX = p => ((p.c + 0.5) / COLS) * 100;                 // plant centre x (%)
    const RY = r => ((r + 0.5) / ROWS) * 100;                   // row centre y (%)
    const colOf = x => Math.floor(x / TILE);
    const alive = () => zombies.filter(q => q.hp > 0 && !q.isTomb);
    const mine = () => zombies.filter(q => q.hp > 0 && q.rk);
    const plantsOf = r => plants.filter(p => p.hp > 0 && p.r === r);
    function plantsAhead(z, tiles) { return plants.filter(p => p.hp > 0 && p.r === z.r && PX(p) <= z.x + 3 && (z.x - PX(p)) / TILE <= tiles).sort((a, b) => PX(b) - PX(a)); }
    function mkPlant(type, r, c) {
        const lv = 1, hp = levelHealth(type, lv);
        const p = { id: Date.now() + Math.random(), r, c, type, level: lv, hp, maxHp: hp, lastActionTime: Date.now() + Math.random() * 600, armed: type === 'potatomine' ? false : true, armTime: Date.now() + 3000, shootingAnim: false, isNew: true };
        plants.push(p); return p;
    }
    window.REV_mkPlant = mkPlant;
    function hitPlant(p, n, o) {
        o = o || {}; const now = Date.now();
        p.hp -= n; if (n > 0) p.hitFlash = true;
        if (o.stun) p.frozenUntil = Math.max(p.frozenUntil || 0, now + o.stun);
        if (o.slow) { p.attackSlowedUntil = Math.max(p.attackSlowedUntil || 0, now + o.slow); p.attackSlowFactor = Math.min(p.attackSlowFactor || 1, o.slowF || 0.4); }
        if (o.burn) { p.burnUntil = Math.max(p.burnUntil || 0, now + o.burn); p.nextBurnTick = p.nextBurnTick || now + 500; p.burnDamage = Math.max(p.burnDamage || 0, o.burnD || 7); }
    }
    const SOFT = p => !['wallnut', 'tallnut', 'infinut', 'spikeweed', 'spikerock'].includes(p.type);
    function floatTxt(x, y, text, cls) {
        const f = $('rev-fx'); if (!f) return;
        const d = document.createElement('div'); d.className = 'rv-soul ' + (cls || ''); d.style.left = Math.max(3, Math.min(97, x)) + '%'; d.style.top = y + '%'; d.textContent = text;
        f.appendChild(d); setTimeout(() => d.remove(), 1350);
    }
    function ringFx(x, y, cls) {
        const f = $('rev-fx'); if (!f) return;
        const d = document.createElement('i'); d.className = 'rv-ring ' + (cls || ''); d.style.left = x + '%'; d.style.top = y + '%';
        f.appendChild(d); setTimeout(() => d.remove(), 760);
    }
    function boxFx(x, y, w, h, cls, ms) {
        const f = $('rev-fx'); if (!f) return null;
        const d = document.createElement('i'); d.className = 'rv-box ' + (cls || ''); d.style.left = x + '%'; d.style.top = y + '%'; d.style.width = w + '%'; d.style.height = h + '%';
        f.appendChild(d); setTimeout(() => d.remove(), ms || 900); return d;
    }
    let bannerT = 0;
    function banner(text, cls) {
        const b = $('rev-banner'); if (!b) return;
        b.className = 'on ' + (cls || ''); b.textContent = text; clearTimeout(bannerT); bannerT = setTimeout(() => { b.className = ''; }, 2000);
    }
    function sfx(n) { try { playSound(n); } catch (_) {} }
    function addDread(n) { REV.dread = Math.max(0, Math.min(DREAD_MAX, REV.dread + n)); }
    function addBrains(n) { REV.brains += n; sun = REV.brains; }
    function fxSpr(emoji, x1, y1, x2, y2, o) { try { fxSprite(emoji, x1, y1, x2, y2, Object.assign({ size: 34, duration: 360 }, o || {})); } catch (_) {} }
    function parts(x, y, a, n) { try { emitParticles(x, y, a, n); } catch (_) {} }
    function shake(n) { try { shakeLawn(n); } catch (_) {} }
    function setStatus(z, emoji, ms) { z.statusEmoji = emoji; z.statusExpiresAt = Date.now() + ms; }

    // ---------------------------------------------------------------------------------
    //  battle shell
    // ---------------------------------------------------------------------------------
    function setLabel(on) {
        const sp = $('sun-count') && $('sun-count').previousElementSibling;
        if (sp) { if (on) { if (!sp.dataset.o) sp.dataset.o = sp.textContent; sp.textContent = '🧠'; sp.classList.remove('animate-bounce'); } else if (sp.dataset.o) { sp.textContent = sp.dataset.o; sp.classList.add('animate-bounce'); } }
        const foot = $('play-footer');
        if (foot) { if (on) { if (!foot.dataset.o) foot.dataset.o = foot.innerHTML; foot.innerHTML = '🧠 Pick a card (or Q E R T Y U I O) and tap a tile in the <b>right-most columns</b>. <b>Click a zombie</b> (or press 1–5, then Space) to trigger its ability · W/S pick a lane · Esc cancels.'; } else if (foot.dataset.o) foot.innerHTML = foot.dataset.o; }
        const mb = $('rev-map-btn');
        if (on && !mb) {
            const b = document.createElement('button'); b.id = 'rev-map-btn'; b.className = 'px-3 py-1.5 bg-purple-700 hover:bg-purple-600 active:scale-95 text-white font-bold rounded-lg shadow transition-all text-sm'; b.textContent = '🌀 Map'; b.onclick = () => revLeaveBattle(true);
            const bar = $('game-action-buttons'); if (bar) bar.appendChild(b);
        } else if (!on && mb) mb.remove();
    }
    function enter() {
        if (!REV.on) REV.saved = { level: currentLevel, tier: currentTier };
        REV.on = true; window.__REV_ON = true; currentLevel = 1; currentTier = 1;
        document.body.classList.add('rev-mode');
    }
    window.revStartBattle = function () {
        if (!REV.deck.length) return;
        initAudio(); enter();
        hide('rev-select-screen'); hide('rev-map-screen');
        $('selection-screen').classList.add('hidden'); $('plant-select-screen').classList.add('hidden');
        $('playing-screen').classList.remove('hidden');
        document.body.dataset.world = '5';
        $('playing-level-name').textContent = `5-${REV.stage - 34}: ${SD().name} · Tier ${TIER_NAMES[REV.tier - 1]}`;
        const w = $('wave-num'); if (w && w.parentElement) w.parentElement.style.display = 'none';
        setLabel(true); resetGame(); toggleGame();
    };
    function exitMode() {
        REV.on = false; window.__REV_ON = false; REV.ended = true;
        document.body.classList.remove('rev-mode');
        if (REV.saved) { currentLevel = REV.saved.level; currentTier = REV.saved.tier; REV.saved = null; }
        const w = $('wave-num'); if (w && w.parentElement) w.parentElement.style.display = '';
        setLabel(false);
    }
    window.revLeaveBattle = function (toMap) {
        hide('rev-result'); if (isRunning) toggleGame();
        $('playing-screen').classList.add('hidden'); delete document.body.dataset.world;
        selectedSeed = null; energyBeanActive = false; clearAllFx(); exitMode();
        if (toMap) { build(); renderRevMap(); show('rev-map-screen'); }
        else { $('selection-screen').classList.remove('hidden'); try { renderSelectionScreen(); } catch (_) {} }
        window.scrollTo(0, 0);
    };
    function clearAllFx() { const f = $('rev-fx'); if (f) f.innerHTML = ''; const b = $('rev-banner'); if (b) b.className = ''; REV.armed = null; }
    const CARD_KEYS = ['q', 'e', 'r', 't', 'y', 'u', 'i', 'o'];
    function renderBar() {
        const bar = $('game-seeds-bar'); if (!bar) return;
        bar.innerHTML = '';
        REV.deck.forEach((k, i) => {
            const R = ROSTER[k], z = ZOMBIE_TYPES[R.g];
            const c = document.createElement('div');
            c.id = 'rseed-' + k;
            c.className = 'seed-card rev-card flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800 border-2 border-slate-700 cursor-pointer min-w-[65px] sm:min-w-[75px] select-none transition-all active:scale-95';
            c.onclick = () => revSelect(k);
            c.title = `${R.n} — ${R.pas[0]}: ${R.pas[1]}\n⚡ ${R.act.n} (${R.act.cost}💀): ${R.act.d}`;
            c.innerHTML = `<span class="text-2xl">${z.emoji}</span><span class="text-[10px] font-bold text-slate-200 text-center" style="max-width:74px;line-height:1.1">${R.n}</span><span class="rv-cost">🧠 ${R.cost}</span><span class="text-[9px] text-emerald-300">Key ${CARD_KEYS[i].toUpperCase()}</span><div class="rv-cdov" id="rcd-${k}"></div>`;
            bar.appendChild(c);
        });
    }
    window.revSelect = function (k) {
        REV.sel = k;
        document.querySelectorAll('.rev-card').forEach(e => e.classList.toggle('rv-sel', e.id === 'rseed-' + k));
        sfx('plant');
    };

    // ---------------------------------------------------------------------------------
    //  game reset  → formation + Dave + counters
    // ---------------------------------------------------------------------------------
    const _reset = resetGame;
    resetGame = function () {
        _reset.apply(this, arguments);
        if (!REV.on) return;
        const S = SD(), now = Date.now();
        REV.ended = false; REV.cd = {}; REV.sel = null; REV.armed = null; REV.fx = {}; REV.syn = 0; REV.synSeen = {};
        REV.brains = S.brains; REV.dread = DREAD_START; REV.lanes = [false, false, false, false, false]; REV.laneN = 0; REV.nextRegen = now + REGEN_MS;
        REV.stats = { placed: 0, eaten: 0, spent: 0, lanes: 0, abil: 0, syn: 0 }; REV.startedAt = now; REV.finishOffered = false; REV.events = []; REV.dreadAcc = 0;
        REV.cmdCd = { fog: 0, grave: 0, bungee: 0 }; REV.fogUntil = 0; REV.pending = null;
        document.querySelectorAll('#rev-house i').forEach(i => { i.classList.remove('eaten'); i.textContent = '🧠'; });
        mowers = []; sun = REV.brains; updateSunDisplay();
        formation(S, REV.tier).forEach(f => { const p = mkPlant(f.type, f.r, f.c); p.isNew = false; });
        daveInit(); bossInit();
        hide('rev-result'); clearAllFx();
        renderBar(); renderGame(); hudUpdate(true);
        const fb = $('cmd-finish'); if (fb) fb.style.display = 'none';
    };

    // ---------------------------------------------------------------------------------
    //  raising zombies
    // ---------------------------------------------------------------------------------
    function spawnZone(r) {
        // columns zombies may be raised in for this row
        if (REV.fogUntil > Date.now()) return 4;
        const front = plants.some(p => p.hp > 0 && p.r === r && p.c >= 4);
        return front ? 6 : 4;
    }
    function initZombie(z, k) {
        const R = ROSTER[k];
        z.rk = k; z.uid = z.uid || (Date.now() + Math.random());
        z._base = R.hp; z.hp = z.maxHp = R.hp + R.arm;
        z.baseSpeed = z.speed = S2G(R.sp); z._spd0 = z.baseSpeed; z.baseDamage = z.damage = R.dps;
        z._sh = k === 'screendoor' ? R.arm : 0; if (k === 'screendoor') { z.hp = z.maxHp = R.hp; }
        z._barrel = R.barrel || 0;
        z.refractor = false; z.tesla = false; z.isBarrel = false; z.impCannon = false; z.explorer = false; z.pianist = false; z.stationary = false;
        z._chg = R.act.once ? 1 : -1; z._cdAt = 0; z._php = z.hp; z._t = {}; z._fx = {}; z._born = Date.now(); z._air = k === 'balloon'; z._torch = true;
        z._mod = modOn(k);
        if (k === 'balloon') z.flying = true;
        if (k === 'football') { z._charge = true; }
        if (k === 'impcannon') z._park = false;
        return z;
    }
    function spawnRoster(k, r, x, o) {
        o = o || {};
        window.__revSpawn = { type: ROSTER[k].g, r, x };
        try { spawnZombie(); } finally { window.__revSpawn = null; }
        const g = ROSTER[k].g;
        const z = zombies.filter(q => q.type === g && !q.rk && !q.isTomb).pop();
        if (!z) return null;
        initZombie(z, k);
        if (o.hp) { z.hp = z.maxHp = o.hp; z._base = Math.min(z._base, o.hp); }
        return z;
    }
    function spawnPlain(g, r, x, hp, dmg, spd) {
        window.__revSpawn = { type: g, r, x };
        try { spawnZombie(); } finally { window.__revSpawn = null; }
        const z = zombies.filter(q => q.type === g && !q.rk && !q.isTomb && !q._plain).pop(); if (!z) return null;
        z._plain = true; z.hp = z.maxHp = hp; z._base = hp; z.damage = z.baseDamage = dmg; z.baseSpeed = z.speed = S2G(spd); z._spd0 = z.baseSpeed; z._php = hp; z.uid = Date.now() + Math.random(); z._t = {}; z._fx = {};
        return z;
    }
    const _cell = handleCellClick;
    handleCellClick = function (r, c) {
        if (!REV.on) return _cell.apply(this, arguments);
        initAudio();
        if (!isRunning || REV.ended) return;
        if (REV.armed) return;   // targeting is handled by the lawn click-capture
        const k = REV.sel;
        if (!k) { missionToast('🧠 Pick a zombie card first.'); return; }
        const minC = spawnZone(r);
        if (c < minC) { missionToast(minC === 4 ? '☠️ Raise zombies in columns 5–8 (the lane is not breached yet).' : '☠️ Zombies can only be raised in the two right-most columns until you chew through the lane’s front plants.'); sfx('hit'); return; }
        const now = Date.now(), cost = zCost(k);
        if ((REV.cd[k] || 0) > now) return;
        if (REV.brains < cost) { missionToast(`Not enough Brains (need 🧠 ${cost}).`); sfx('hit'); return; }
        const cx = ((c + 0.5) / COLS) * 100;
        if (zombies.some(z => z.hp > 0 && z.r === r && Math.abs(z.x - cx) < 5)) return;
        REV.brains -= cost; REV.stats.spent += cost; REV.stats.placed++; sun = REV.brains; updateSunDisplay();
        REV.cd[k] = now + zCd(k);
        const z = spawnRoster(k, r, cx);
        parts(cx, RY(r), ['💀', '👻', '✨', '🩸'], 8); ringFx(cx, RY(r));
        if (z) { try { daveNotice('raise', z); } catch (_) {} }
        return z;
    };

    // ---------------------------------------------------------------------------------
    //  lane breach (a zombie reaches the house)
    // ---------------------------------------------------------------------------------
    window.revBrain = function (z) {
        z._brain = true; const r = z.r;
        if (!REV.lanes[r]) {
            REV.lanes[r] = true; REV.laneN++; REV.stats.lanes++;
            addBrains(150); addDread(20);
            const el = document.querySelectorAll('#rev-house i')[r]; if (el) { el.classList.add('eaten'); el.textContent = '🦴'; }
            const y = RY(r);
            floatTxt(24, y, '🧠 LANE BREACHED! +150 🧠 · +20 💀', 'red'); ringFx(4, y); ringFx(8, y);
            parts(4, y, ['🧠', '🩸', '💀', '✨'], 10); sfx('boom'); shake(4);
            if (REV.laneN >= 3 && !REV.finishOffered) {
                REV.finishOffered = true; banner('🏆 VICTORY SECURED! Push for all 5 lanes (⭐⭐⭐) or press Finish Now.', 'gold');
                const fb = $('cmd-finish'); if (fb) fb.style.display = '';
            }
            hudUpdate(true);
            if (REV.laneN >= 5) setTimeout(() => finish(true), 450);
        }
        return true;
    };

    // ---------------------------------------------------------------------------------
    //  HUD + cards
    // ---------------------------------------------------------------------------------
    function hudUpdate() {
        const b = $('rv-brains'); if (b) b.textContent = `🧠 ${Math.floor(REV.brains)}`;
        const d = $('rv-dread'); if (d) d.textContent = `💀 ${Math.floor(REV.dread)}`;
        const bar = $('rv-dbar'); if (bar) bar.style.width = (REV.dread / DREAD_MAX * 100) + '%';
        const l = $('rv-lanes'); if (l) l.textContent = `🏠 ${REV.laneN}/5`;
        const s = $('rv-syn'); if (s) s.textContent = `⚡ ${REV.syn}`;
        const sn = $('rv-sun'); if (sn && REV.dave) sn.textContent = `☀️ Dave ${Math.floor(REV.dave.sun)} · 🫘 ${REV.dave.food}`;
    }
    function cardState(now) {
        REV.deck.forEach(k => {
            const el = $('rseed-' + k); if (!el) return;
            el.classList.toggle('rv-poor', REV.brains < zCost(k));
            const ov = $('rcd-' + k), left = (REV.cd[k] || 0) - now;
            if (ov) { if (left > 0) { ov.style.display = 'flex'; ov.textContent = Math.ceil(left / 1000) + 's'; } else ov.style.display = 'none'; }
        });
        [['fog', 30, 15], ['grave', 35, 18], ['bungee', 40, 20]].forEach(([k, cost, cd]) => {
            const el = $('cmd-' + k); if (!el) return; const left = (REV.cmdCd[k] || 0) - now;
            el.classList.toggle('poor', REV.dread < cost); el.classList.toggle('cool', left > 0); el.classList.toggle('arm', !!(REV.armed && REV.armed.cmd === k));
            const i = el.querySelector('i'); if (i) i.style.width = left > 0 ? (left / (cd * 1000) * 100) + '%' : '0%';
        });
    }
    // readiness rings under every zombie
    function rings(now) {
        const f = $('rev-fx'); if (!f) return;
        const seen = new Set();
        mine().forEach(z => {
            const R = ROSTER[z.rk]; if (!R) return; const id = 'rr' + Math.floor(z.uid * 1000);
            seen.add(id);
            let e = document.getElementById(id);
            if (!e) { e = document.createElement('i'); e.id = id; e.className = 'rv-rdy'; f.appendChild(e); }
            const left = (z._cdAt || 0) - now, ready = z._chg !== 0 && left <= 0 && REV.dread >= R.act.cost;
            const cdMs = (R.act.cd || 1) * 1000;
            e.className = 'rv-rdy' + (ready ? ' ready' : '') + (z._chg === 0 ? ' spent' : '') + (REV.armed && REV.armed.z === z ? ' sel' : '') + (z._chg !== 0 && left <= 0 && !ready ? ' poor' : '');
            e.style.left = (z.x + 2.2) + '%'; e.style.top = (RY(z.r) + 7) + '%';
            e.style.setProperty('--p', left > 0 ? Math.max(0, Math.min(100, 100 - left / cdMs * 100)) + '%' : '100%');
        });
        f.querySelectorAll('.rv-rdy').forEach(e => { if (!seen.has(e.id)) e.remove(); });
    }

    // ---------------------------------------------------------------------------------
    //  MANUAL ABILITIES  (click a zombie / Space)  +  synergies
    // ---------------------------------------------------------------------------------
    REV.barrels = []; REV.fires = []; REV.arcs = []; REV.clouds = []; REV.hops = [];
    const alliesIn = (z, rows, dxT, self) => alive().filter(q => (self || q !== z) && !q._plain0 && Math.abs(q.r - z.r) <= rows && Math.abs(q.x - z.x) <= dxT * TILE);
    function tag(z, text, cls) { floatTxt(z.x + 3, RY(z.r) - 9, text, cls || 'small'); }
    function toast(t) { try { missionToast(t); } catch (_) {} }
    function lunge(q, d) {
        let tx = q.x - d;
        const walls = plants.filter(p => p.hp > 0 && p.r === q.r && PX(p) < q.x && PX(p) >= tx - 4 && (!SOFT(p) || p.type === 'tallnut')).sort((a, b) => PX(b) - PX(a));
        if (walls.length) tx = Math.max(tx, PX(walls[0]) + 3.5);
        REV.hops.push({ z: q, fromX: q.x, toX: tx, fromR: q.r, toR: q.r, t0: Date.now(), dur: 350 });
        q.eating = false;
    }
    function hop(q, dx, dr, dur) {
        const nr = Math.max(0, Math.min(ROWS - 1, q.r + dr));
        REV.hops.push({ z: q, fromX: q.x, toX: Math.max(2, q.x - dx), fromR: q.r, toR: nr, t0: Date.now(), dur: dur || 300 });
        q.eating = false;
    }
    function armorLeft(z) { return Math.max(0, z.hp - z._base); }
    function nearestPlantAhead(z, tiles) { return plantsAhead(z, tiles)[0]; }
    function boom(x, y, emojis, n) { parts(x, y, emojis, n || 8); ringFx(x, y, 'gold'); }
    function projDmg(p) { return ({ fire: 32, ice: 22, lightning: 30, laser: 40, citron: 60, normal: 22 })[p.type] || 24; }

    const ABIL = {
        basic(z, _, mod) {
            const now = Date.now(), grp = [z];
            if (mod) alive().forEach(q => { if (q !== z && q.rk === 'basic' && q.r === z.r && Math.abs(q.x - z.x) <= 1.5 * TILE) grp.push(q); });
            grp.forEach(q => { lunge(q, 1.2 * TILE); q._fx.evade = now + 400; q._fx.bite = now + 2500; });
            fxSpr('💨', z.x + 4, RY(z.r), z.x - 12, RY(z.r), { size: 30 });
        },
        flag(z, _, mod) {
            const now = Date.now();
            const grp = alive().filter(q => Math.abs(q.r - z.r) <= 1 && Math.abs(q.x - z.x) <= 1.5 * TILE);
            let heavy = false;
            grp.forEach(q => {
                q.slowedUntil = 0; q.slowFactor = 1; q.frozenUntil = 0; q.stunnedUntil = 0; q.burnUntil = 0; q.statusEmoji = null;
                const sh = mod ? 220 : 120; q.hp += sh; q.maxHp += sh; q._fx.shield = { v: sh, until: now + 4000 };
                if (!mod) q._fx.rally = now + 3000;
                if (HEAVY.has(q.rk) && q.r === z.r && Math.abs(q.x - z.x) <= 1.5 * TILE) { heavy = q; }
            });
            boxFx(Math.max(0, z.x - 1.5 * TILE + 3), Math.max(0, (z.r - 1) * 20), 3 * TILE, 60, 'rally', 700); sfx('levelup');
            if (heavy) { synFire('BLITZKRIEG VANGUARD', heavy.r, heavy.x); heavy._fx.unstop = now + 3500; heavy._fx.pwr = now + 3500; }
        },
        cone(z, _, mod) {
            const need = mod ? 150 : 50, a = armorLeft(z);
            if (a < need) { toast(`Cone too damaged (need ${need}+ armor).`); return false; }
            const t = nearestPlantAhead(z, 2.6); if (!t) { toast('No plant within 2.5 tiles to hit.'); return false; }
            fxSpr('🚧', z.x, RY(z.r), PX(t), RY(t.r), { size: 38, spin: 540, duration: 420 });
            z.hp = z._base; z.maxHp = z._base;
            setTimeout(() => { if (t.hp <= 0) return; hitPlant(t, mod ? 280 : 150, { stun: mod ? 4500 : 2500 }); if (['potatomine', 'primalpotatomine', 'cherrybomb'].includes(t.type)) t.hp = 0; boom(PX(t), RY(t.r), ['💥', '🚧'], 5); }, 380);
        },
        bucket(z, _, mod) { z._fx.brace = Date.now() + (mod ? 4500 : 3000); z._fx.braceMod = !!mod; z.statusEmoji = '🛡️'; z.statusExpiresAt = z._fx.brace; ringFx(z.x, RY(z.r), 'steel'); },
        polevault(z, tgt, mod) {
            const now = Date.now();
            let dr = 0; if (tgt && tgt.r != null) dr = Math.max(-1, Math.min(1, tgt.r - z.r));
            if (mod) dr = 0;
            if (z.r + dr < 0 || z.r + dr > ROWS - 1) { toast('No lane there.'); return false; }
            const d = (dr ? 1.5 : 2.0) * TILE; z._fx.evade = now + 300;
            hop(z, d, dr, 340); z.vaulted = true; z.canVault = false;
            if (mod) setTimeout(() => { plants.forEach(p => { if (p.hp > 0 && Math.abs(p.r - z.r) <= 1 && Math.abs(PX(p) - z.x) <= 1.2 * TILE) hitPlant(p, 0, { stun: 1500 }); }); boom(z.x, RY(z.r), ['💫', '💥'], 6); shake(3); }, 380);
        },
        screendoor(z, _, mod) { z._fx.reflect = Date.now() + 3500; z._fx.reflectMod = !!mod; z.statusEmoji = '🔮'; z.statusExpiresAt = z._fx.reflect; ringFx(z.x, RY(z.r), 'prism'); },
        football(z, _, mod) { const now = Date.now(); z._charge = true; z._fx.audible = now + 2000; z._fx.audMod = !!mod; z.statusEmoji = '🏈'; z.statusExpiresAt = now + 2000; fxSpr('📣', z.x, RY(z.r) - 6, z.x - 6, RY(z.r) - 10, { size: 30 }); },
        barrel(z, _, mod) {
            if (z._barrel <= 0) { toast('The barrel is already gone.'); return false; }
            const rows = mod ? [z.r - 1, z.r, z.r + 1].filter(r => r >= 0 && r < ROWS) : [z.r];
            rows.forEach(r => REV.barrels.push({ r, x: z.x - 1, mul: mod ? 0.6 : 1, owner: z, el: null }));
            z._barrel = 0; z.barrelBroken = true; z.emoji = '🧟'; sfx('slam');
        },
        explorer(z, _, mod) {
            const now = Date.now(), tiles = mod ? 3 : 2, tx = z.x - 2.5 * TILE;
            const x0 = Math.max(0, tx - tiles * TILE / 2), x1 = tx + tiles * TILE / 2;
            REV.fires.push({ r: z.r, x0, x1, until: now + (mod ? 6000 : 4000), nextT: now, ow: z });
            const el = boxFx(x0, z.r * 20 + 2, x1 - x0, 16, 'fire', mod ? 6000 : 4000);
            fxSpr('🔥', z.x, RY(z.r), tx, RY(z.r), { size: 34, spin: 540, duration: 420 });
            z._torch = true; z._fx.torchOut = 0; z.statusEmoji = '🔥'; z.statusExpiresAt = now + 1500;
            REV.events.push({ t: now, type: 'ignite', r: z.r, x: tx });
            synCheckIgnite(z.r, tx);
        },
        pianist(z, tgt, mod) {
            const now = Date.now(); let dr = tgt && tgt.r != null ? Math.max(-1, Math.min(1, tgt.r - z.r)) : 0;
            if (!dr) { toast('Pick a lane above or below (click it, or press W/S).'); return false; }
            const nr = z.r + dr * (mod ? 2 : 1); if (nr < 0 || nr > ROWS - 1) { toast('No lane there.'); return false; }
            const squad = [z].concat(alliesIn(z, 0, 1.5));
            const armored = squad.filter(q => ARMORED.has(q.rk) && q.x < z.x);
            squad.forEach(q => { const t = Math.max(0, Math.min(ROWS - 1, q.r + dr * (mod ? 2 : 1))); hop(q, 0, t - q.r, 250); q._fx.evade = now + 400; q._lockUntil = now + 6000; });
            fxSpr('🎵', z.x, RY(z.r), z.x, RY(nr), { size: 30 });
            if (armored.length >= 2) { synFire('PHALANX SHUFFLE', nr, z.x); squad.forEach(q => { q._fx.phalanx = now + 4500; }); }
        },
        impcannon(z, tgt, mod) {
            if (!tgt || tgt.c == null) return false;
            const x = (tgt.c + 0.5) * TILE, now = Date.now();
            const drop = (r, xx, hp) => {
                fxSpr('🪂', xx, -10, xx, RY(r), { size: 34, duration: 480 });
                setTimeout(() => {
                    const pl = plants.find(p => p.hp > 0 && p.r === r && Math.abs(PX(p) - xx) < TILE * 0.6);
                    if (pl) hitPlant(pl, 80);
                    const im = spawnPlain('imp', r, xx, hp, 90, 0.5); if (im) { im._ej = true; im.statusEmoji = hp > 100 ? '🪂' : null; im.statusExpiresAt = Date.now() + 1500; }
                    boom(xx, RY(r), ['💥', '👶'], 5);
                }, 500);
            };
            if (mod) { drop(tgt.r, x, 90); drop(Math.min(ROWS - 1, tgt.r + 1), x, 90); } else drop(tgt.r, x, 210);
        },
        tesla(z, _, mod) {
            const now = Date.now(), cx = z.x - 1.5 * TILE, half = (mod ? 2.5 : 1.5) * TILE, dur = mod ? 2500 : 3500;
            let hit = 0;
            plants.forEach(p => { if (p.hp > 0 && Math.abs(p.r - z.r) <= 1 && Math.abs(PX(p) - cx) <= half) { hitPlant(p, 0, { stun: dur }); if (p.type === 'magnetshroom') p._emp = now + dur; if (['infinut', 'pumpkin'].includes(p.type)) p._shieldOff = now + dur; hit++; } });
            alive().forEach(q => { if (q !== z && q.rk && ['bucket', 'football', 'barrel', 'impcannon', 'screendoor'].includes(q.rk) && Math.abs(q.x - cx) <= half + 2 * TILE && Math.abs(q.r - z.r) <= 1) { q.hp = Math.min(q.maxHp, q.hp + 165); } });
            boxFx(Math.max(0, cx - half), Math.max(0, (z.r - 1) * 20), half * 2, 60, 'emp', 800); parts(cx, RY(z.r), ['⚡', '✨'], 8); sfx('zap');
            // Faraday conduit
            const partner = alive().find(q => q !== z && q.r === z.r && (q.rk === 'polevault' || q._ej) && q.x < z.x - 2 * TILE && q.x > z.x - 5.2 * TILE && plants.some(p => p.hp > 0 && p.r === z.r && PX(p) < z.x && PX(p) > q.x));
            if (partner) { synFire('FARADAY CONDUIT', z.r, z.x); REV.arcs.push({ r: z.r, a: z, b: partner, until: now + 4000, t: now }); }
        },
        balloon(z, tgt, mod) {
            if (!tgt || tgt.c == null) return false;
            if (tgt.c < 1 || tgt.c > 6) { toast('Drop on columns 2–7.'); return false; }
            const now = Date.now(), nx = (tgt.c + 0.5) * TILE - 2;
            z.r = tgt.r; z.x = nx; z._air = false; z.flying = false; z.eating = false; z.statusEmoji = '💨'; z.statusExpiresAt = now + 900;
            const pl = plants.find(p => p.hp > 0 && p.r === tgt.r && p.c === tgt.c); if (pl) hitPlant(pl, 0, { stun: 1500 });
            const rows = mod ? [tgt.r - 1, tgt.r, tgt.r + 1] : [tgt.r], band = mod ? 1.5 * TILE : 1.5 * TILE;
            projectiles = projectiles.filter(p => !(rows.includes(p.r) && !p.lob && Math.abs(p.x - nx) <= band));
            if (mod) plants.forEach(p => { if (p.hp > 0 && Math.abs(p.r - tgt.r) <= 1 && Math.abs(p.c - tgt.c) <= 1) hitPlant(p, 0, { stun: 1500 }); });
            boxFx(Math.max(0, nx - band), Math.max(0, rows[0] * 20), band * 2, rows.length * 20, 'gust', 700); sfx('slam');
            const ally = alive().find(q => q !== z && Math.abs(q.r - z.r) <= 1 && Math.abs(q.x - nx) <= TILE);
            if (ally) { synFire('AIRBORNE TOXIC DROP', tgt.r, nx); REV.clouds.push({ r: tgt.r, x0: nx - TILE, x1: nx + TILE, r0: Math.max(0, tgt.r - 0), r1: Math.min(ROWS - 1, tgt.r + 1), until: now + 5000 }); boxFx(Math.max(0, nx - TILE), tgt.r * 20, 2 * TILE, 40, 'spore', 5000); }
        },
        gargantuar(z, _, mod) {
            const now = Date.now(), m = mod ? 0.7 : 1, len = mod ? 4 : 3, bonus = (z._fx.pwr > now) ? 1.5 : 1;
            for (let i = 0; i < len; i++) {
                const xa = z.x - (i + 1) * TILE, xb = z.x - i * TILE, d = (i === 0 ? 600 : 250) * m * bonus;
                plants.forEach(p => {
                    if (p.hp <= 0) return; const px = PX(p);
                    const inBand = px >= xa && px <= xb + 2;
                    if (!inBand) return;
                    if (p.r === z.r) { if (['spikeweed', 'spikerock'].includes(p.type)) p.hp = 0; else hitPlant(p, d, { stun: 1500 }); }
                    else if (i === 0 && Math.abs(p.r - z.r) === 1) hitPlant(p, 250 * m * bonus, { stun: 1500 });
                });
                boxFx(Math.max(0, xa), z.r * 20 + 3, TILE, 14, 'quake', 700);
            }
            shake(8); sfx('boom'); parts(z.x - TILE, RY(z.r), ['💥', '🪨'], 8);
        }
    };
    const ACD = z => { const R = ROSTER[z.rk]; let cd = R.act.cd; if (z.rk === 'bucket' && z._mod) cd = 14; return cd * 1000; };
    function abilStatus(z) {
        const R = ROSTER[z.rk], now = Date.now();
        if (z._chg === 0) return 'Already used.';
        if (now < z._cdAt) return `${R.act.n} cooling down (${Math.ceil((z._cdAt - now) / 1000)}s).`;
        if (REV.dread < R.act.cost) return `Need ${R.act.cost} 💀 Dread (have ${Math.floor(REV.dread)}).`;
        return null;
    }
    function cast(z, target) {
        const R = ROSTER[z.rk]; if (!R || z.hp <= 0) return false;
        const why = abilStatus(z); if (why) { toast(why); sfx('hit'); return false; }
        const now = Date.now();
        if (ABIL[z.rk](z, target, z._mod) === false) return false;
        addDread(-R.act.cost); z._cdAt = now + ACD(z); if (R.act.once) z._chg = 0;
        REV.stats.abil++; tag(z, '⚡ ' + R.act.n, 'gold'); ringFx(z.x, RY(z.r), 'gold');
        try { daveNotice('cast:' + z.rk, z); } catch (_) {}
        // Phantom Ambush: any manual ability next to a tombstone
        const tomb = zombies.find(q => q.isTomb && q.hp > 0 && Math.abs(q.r - z.r) <= 1 && Math.abs(q.x - z.x) <= TILE * 1.0);
        if (tomb) { z._fx.evade = now + 2500; z._stealth = now + 2500; z.statusEmoji = '👻'; z.statusExpiresAt = now + 2500; synFire('PHANTOM AMBUSH', z.r, z.x); }
        hudUpdate(true); return true;
    }
    function tryAbility(z) {
        const R = ROSTER[z.rk]; const why = abilStatus(z);
        if (why) { toast(why); sfx('hit'); return; }
        if (R.act.mode === 'instant') { cast(z, null); return; }
        REV.armed = { z, mode: R.act.mode };
        banner(R.act.mode === 'tile' ? `🎯 ${R.act.n}: click a target tile (Esc to cancel)` : `↕️ ${R.act.n}: click a lane above/below${z.rk === 'polevault' ? ' (or this lane to vault straight)' : ''} — or press W / S`, 'cyan');
    }
    // ---- synergies ----
    function synFire(name, r, x) {
        const now = Date.now(); REV.synSeen = REV.synSeen || {};
        if ((REV.synSeen[name] || 0) > now - 2500) return;
        REV.synSeen[name] = now; REV.syn++; REV.stats.syn++; addDread(15);
        banner('⚡ SYNERGY: ' + name + '!', 'syn'); floatTxt(Math.max(10, x), RY(r) - 12, '⚡ ' + name, 'syn'); ringFx(x, RY(r), 'gold'); sfx('levelup'); hudUpdate(true);
    }
    function thermalBoom(r, x) {
        const now = Date.now();
        plants.forEach(p => { if (p.hp > 0 && Math.abs(p.r - r) <= 1 && Math.abs(PX(p) - x) <= 1.5 * TILE) { const wall = !SOFT(p); hitPlant(p, 400 + (wall ? p.hp * 0.5 : 0), { stun: 3000 }); } });
        boxFx(Math.max(0, x - 1.5 * TILE), Math.max(0, (r - 1) * 20), 3 * TILE, 60, 'steam', 900); parts(x, RY(r), ['♨️', '💥', '🔥'], 10); shake(7); sfx('boom');
    }
    function synCheckIgnite(r, x) {
        const now = Date.now();
        const hit = REV.events.find(e => e.type === 'impact' && e.r === r && now - e.t <= 3000 && Math.abs(e.x - x) <= 2.5 * TILE);
        if (hit) { synFire('THERMAL SHOCKWAVE', r, hit.x); thermalBoom(r, hit.x); REV.events = REV.events.filter(e => e !== hit); }
    }
    function impact(r, x, who) {
        const now = Date.now();
        const ig = REV.events.find(e => e.type === 'ignite' && e.r === r && now - e.t <= 3000 && Math.abs(e.x - x) <= 2.5 * TILE);
        const expl = alive().some(q => q.rk === 'explorer' && q.r === r && Math.abs(q.x - (who ? who.x : x)) <= 1.5 * TILE) && !ig;
        if (ig || expl) { synFire('THERMAL SHOCKWAVE', r, x); thermalBoom(r, x); if (ig) REV.events = REV.events.filter(e => e !== ig); return true; }
        REV.events.push({ t: now, type: 'impact', r, x }); return false;
    }

    // ---------------------------------------------------------------------------------
    //  per-tick engine
    // ---------------------------------------------------------------------------------
    function due(z, key, ms, first) {
        const now = Date.now(); z._t = z._t || {};
        if (z._t[key] == null) { z._t[key] = now + (first != null ? first : ms); return false; }
        if (now >= z._t[key]) { z._t[key] = now + ms; return true; }
        return false;
    }
    const torchInRow = r => plants.some(p => p.hp > 0 && p.r === r && p.type === 'torchwood');
    const ELEC = new Set(['lightningreed', 'electricpeashooter', 'electricblueberry']);
    function breakBarrel(z) {
        z._barrel = 0; z.barrelBroken = true; z.emoji = '🧟';
        [z.r - 1, z.r + 1].filter(r => r >= 0 && r < ROWS).forEach(r => { const im = spawnPlain('imp', r, z.x, 90, 55, 0.6); if (im) { im.statusEmoji = '🛢️'; im.statusExpiresAt = Date.now() + 900; } });
        floatTxt(z.x + 3, RY(z.r) - 9, '🛢️ Barrel broke!', 'small'); sfx('slam');
    }
    function reflectShot(z, p) {
        const m = z._fx.reflectMod, base = projDmg(p) * 1.5;
        const rows = m ? [z.r - 1, z.r, z.r + 1].filter(r => r >= 0 && r < ROWS) : [z.r];
        rows.forEach((r, i) => {
            const t = plants.filter(q => q.hp > 0 && q.r === r && PX(q) <= z.x).sort((a, b) => PX(b) - PX(a))[0]; if (!t) return;
            const d = base * (r === z.r ? 1 : 0.7);
            fxSpr(p.type === 'fire' ? '🔥' : p.type === 'ice' ? '❄️' : '🟢', z.x, RY(z.r), PX(t), RY(r), { size: 26, duration: 260 });
            setTimeout(() => { if (t.hp <= 0) return; hitPlant(t, d, { burn: p.type === 'fire' ? 3000 : 0, burnD: 8, slow: p.type === 'ice' ? 3500 : 0, slowF: 0.45 }); }, 250);
        });
        addDread(4);
    }
    function preTick(now) {
        REV.bufZ = [];
        mine().forEach(z => { if (z._fx.evade > now || z._stealth > now) { z.hp += 1e6; z._buf = true; REV.bufZ.push(z); } });
        mine().forEach(z => {
            const refl = z._fx.reflect > now, sh = z._sh > 0, ba = z._barrel > 0, air = z._air;
            if (!(refl || sh || ba || air)) return;
            projectiles = projectiles.filter(p => {
                if (p.lob || p.r !== z.r || p.x < z.x - 7 || p.x > z.x + 4) return true;
                if (air && !refl && !sh && !ba && p.ownerType === 'cactus') return true;
                if (refl) { reflectShot(z, p); return false; }
                const d = projDmg(p);
                if (sh) { z._sh -= d; addDread(4); if (z._sh <= 0) { z._sh = 0; z.emoji = '🧟'; floatTxt(z.x + 3, RY(z.r) - 9, '🚪 Shield broke!', 'small'); sfx('hit'); } parts(z.x, RY(z.r), ['✨'], 1); return false; }
                if (ba) { z._barrel -= d; addDread(4); if (z._barrel <= 0) breakBarrel(z); return false; }
                if (air) return false;
                return true;
            });
        });
    }
    function plantReward(p) {
        if (['twinsunflower', 'sunshroom', 'primalsunflower'].includes(p.type)) return 125;
        if (p.type === 'sunflower') return 75;
        return 20;
    }
    function auraPass(now) {
        const ms = mine();
        ms.forEach(z => {
            if (z.rk === 'flag') alive().forEach(q => { if (q._sm && Math.abs(q.r - z.r) <= 1 && Math.abs(q.x - z.x) <= 1.5 * TILE) q._sm.banner = 1.2; });
            if (z.rk === 'pianist') alive().forEach(q => {
                if (!q._sm || Math.abs(q.r - z.r) > 1 || Math.abs(q.x - z.x) > 1.5 * TILE) return;
                q._sm.dance = 1.25;
                if (q !== z && !q.isTomb && !(q._lockUntil > now) && due(q, 'swap', 4000) && Math.random() < 0.35) { const dir = Math.random() < 0.5 ? -1 : 1; if (q.r + dir >= 0 && q.r + dir < ROWS) { hop(q, 0, dir, 250); tag(q, '🎶 swap'); } }
            });
            if (z.rk === 'explorer') alive().forEach(q => { if (q !== z && Math.abs(q.r - z.r) <= 1 && Math.abs(q.x - z.x) <= 1.5 * TILE && q.slowedUntil > now) { q.slowedUntil = 0; q.slowFactor = 1; q.frozenUntil = 0; } });
        });
    }
    function applySpeed(z, now) {
        let m = 1; for (const k in z._sm) m *= z._sm[k];
        z.baseSpeed = z._spd0 * m;
        z.speed = z.slowedUntil > now ? Math.max(0.02, z.baseSpeed * (z.slowFactor || 0.5)) : z.baseSpeed;
        if (m === 0) z.speed = 0;
    }
    function zTick(z, now, dt) {
        const R = ROSTER[z.rk], f = z._fx; z._sm = z._sm || {}; let dm = 1, dr = 0;
        // ---- timers that end
        if (f.shield && now > f.shield.until) { const s = Math.min(f.shield.v, Math.max(0, z.hp - 1)); z.hp -= s; z.maxHp = Math.max(z._base, z.maxHp - f.shield.v); f.shield = null; }
        if (f.rally > now) z._sm.rally = 1.35;
        if (f.bite > now) dm *= 2;
        if (f.pwr > now) dm *= 1.5;
        if (f.unstop > now) { z.slowedUntil = 0; z.slowFactor = 1; z.frozenUntil = 0; z.stunnedUntil = 0; }
        if (f.phalanx > now) dr += 0.6;
        if (f.brace > now) { z._sm.brace = 0; dr += 0.75; }
        else if (f.brace && now >= f.brace) {
            const mod = f.braceMod; f.brace = 0; z.statusEmoji = null;
            plants.forEach(p => { if (p.hp > 0 && (p.r === z.r || Math.abs(p.r - z.r) === 1) && PX(p) <= z.x + 2 && z.x - PX(p) <= 1.6 * TILE) hitPlant(p, mod ? 200 : 100, { stun: mod ? 1500 : 0 }); });
            boxFx(Math.max(0, z.x - 1.6 * TILE), Math.max(0, (z.r - 1) * 20), 1.8 * TILE, 60, 'quake', 700); shake(4); sfx('slam');
        }
        if (REV.fogUntil > now && z.x > 50 && !torchInRow(z.r)) dr += 0.6;
        if (REV.clouds.some(c => c.until > now && z.r >= c.r0 && z.r <= c.r1 && z.x >= c.x0 && z.x <= c.x1)) dr += 0.8;
        // ---- type passives
        switch (z.rk) {
            case 'basic': { const n = alive().filter(q => q !== z && q.r === z.r && Math.abs(q.x - z.x) <= TILE).length; z._sm.pack = 1 + Math.min(0.45, 0.15 * n); break; }
            case 'cone': if (armorLeft(z) > 0) dr += 0.1; break;
            case 'polevault': z._spd0 = S2G(z.vaulted || z.canVault === false ? R.sp2 : R.sp); break;
            case 'football': {
                z._spd0 = S2G(z._charge ? R.spc : R.sp);
                if (z._charge && z.eating) {
                    const t = nearestPlantAhead(z, 1.5);
                    if (t) {
                        hitPlant(t, 350, { stun: 400 }); z._charge = false; boom(PX(t), RY(t.r), ['💥', '🏈'], 6); shake(5); sfx('slam');
                        if (f.audible > now) {
                            if (!SOFT(t)) hitPlant(t, 500);
                            else if (t.c > 0 && !plants.some(q => q.hp > 0 && q.r === t.r && q.c === t.c - 1)) { t.c -= 1; tag(z, '↩️ Shoved!'); }
                            if (f.audMod) plants.forEach(q => { if (q.hp > 0 && q !== t && Math.abs(q.r - t.r) <= 1 && Math.abs(q.c - t.c) <= 1) hitPlant(q, 0, { stun: 1500 }); });
                        }
                        impact(t.r, PX(t), z);
                    }
                }
                break;
            }
            case 'barrel': {
                if (z._barrel > 0) plants.forEach(p => { if (p.hp > 0 && p.r === z.r && ['spikeweed', 'spikerock'].includes(p.type) && Math.abs(PX(p) - z.x) < TILE * 0.8 && PX(p) <= z.x + 2) { p.hp = 0; tag(z, '🛢️ Crush'); } });
                break;
            }
            case 'explorer': {
                if (z.slowedUntil > now) { z.slowedUntil = 0; z.slowFactor = 1; if (z._torch) { z._torch = false; tag(z, '💧 Torch out!'); z.statusEmoji = '💧'; z.statusExpiresAt = now + 1500; } }
                if (z.eating && z._torch) {
                    const t = nearestPlantAhead(z, 1.3);
                    if (t) { if (SOFT(t)) { t.hp = 0; parts(PX(t), RY(t.r), ['🔥', '💨'], 5); REV.events.push({ t: now, type: 'ignite', r: t.r, x: PX(t) }); synCheckIgnite(t.r, PX(t)); } else hitPlant(t, 120 * dt); }
                }
                break;
            }
            case 'impcannon': {
                if (z.x <= 86) { z._parked = true; }
                if (z._parked) z._sm.park = 0;
                if (z._parked && due(z, 'lob', 7000, 2500)) {
                    const cand = plants.filter(p => p.hp > 0 && p.r === z.r && p.c >= 4); const t = cand[0] || plants.filter(p => p.hp > 0 && p.r === z.r).sort((a, b) => PX(b) - PX(a))[0];
                    if (t) { const xx = PX(t) + 1; fxSpr('👶', z.x, RY(z.r), xx, RY(z.r), { size: 28, duration: 520, arc: 30 }); setTimeout(() => { const im = spawnPlain('imp', z.r, xx, 90, 60, 0.6); if (im) { im._ej = true; } }, 540); tag(z, '💣 Imp away!'); }
                }
                break;
            }
            case 'tesla': {
                if (z._php - z.hp > 0 && plants.some(p => p.hp > 0 && p.r === z.r && ELEC.has(p.type))) { z.hp += (z._php - z.hp) * 0.5; REV.dreadAcc += 1; }
                break;
            }
        }
        // ---- damage reduction (refund a share of this tick's loss)
        if (z._buf) { z.hp = Math.min(z.maxHp, z._php); }
        else {
            const loss = z._php - z.hp;
            if (loss > 0 && z.hp > 0 && dr > 0) z.hp = Math.min(z.maxHp, z.hp + loss * Math.min(0.95, dr));
        }
        const real = z._php - z.hp; if (real > 0) REV.dreadAcc += real / 100;
        z.damage = R.dps * dm;
        applySpeed(z, now);
        z._php = z.hp;
    }
    function hopsTick(now) {
        REV.hops = REV.hops.filter(h => {
            const z = h.z; if (!z || z.hp <= 0) return false;
            const p = Math.min(1, (now - h.t0) / h.dur), e = p * p * (3 - 2 * p);
            z.x = h.fromX + (h.toX - h.fromX) * e;
            if (h.toR !== h.fromR && !h.set) { z.r = h.toR; h.set = true; }
            z.offY = (h.fromR - h.toR) * (1 - e) - Math.sin(p * Math.PI) * 0.32;
            z.eating = false;
            if (p >= 1) { z.offY = 0; return false; }
            return true;
        });
    }
    function barrelsTick(now, dt) {
        REV.barrels = REV.barrels.filter(b => {
            if (!b.el) { const f = $('rev-fx'); if (f) { b.el = document.createElement('i'); b.el.className = 'rv-barrel'; b.el.textContent = '🛢️'; f.appendChild(b.el); } }
            b.x -= 40 * dt;
            if (b.el) { b.el.style.left = (b.x + 2) + '%'; b.el.style.top = RY(b.r) + '%'; }
            const t = plants.filter(p => p.hp > 0 && p.r === b.r && PX(p) <= b.x + 3).sort((a, c) => PX(c) - PX(a))[0];
            if (t && b.x - PX(t) <= TILE * 0.7) {
                hitPlant(t, 450 * b.mul, { stun: 2500 });
                plants.forEach(p => { if (p.hp > 0 && p !== t && p.c === t.c && Math.abs(p.r - t.r) === 1) hitPlant(p, 0, { stun: 2500 }); });
                for (let i = 0; i < 2; i++) { const im = spawnPlain('imp', t.r, PX(t) + (i ? 2 : -2), 90, 70, 0.6); if (im) { im._ej = true; im.statusEmoji = '🛢️'; im.statusExpiresAt = now + 900; } }
                boom(PX(t), RY(t.r), ['💥', '🛢️', '👶'], 8); shake(6); sfx('boom');
                impact(t.r, PX(t), b.owner);
                if (b.el) b.el.remove(); return false;
            }
            if (b.x < 2) { if (b.el) b.el.remove(); return false; }
            return true;
        });
    }
    function firesTick(now, dt) {
        REV.fires = REV.fires.filter(fz => {
            if (now > fz.until) return false;
            plants.forEach(p => { if (p.hp > 0 && p.r === fz.r && PX(p) >= fz.x0 && PX(p) <= fz.x1) { if (['spikeweed', 'spikerock', 'potatomine', 'primalpotatomine'].includes(p.type)) p.hp = 0; else hitPlant(p, 90 * dt); } });
            if (fz.ow && fz.ow.hp > 0 && fz.ow.rk === 'explorer' && Math.abs(fz.ow.r - fz.r) === 0 && fz.ow.x >= fz.x0 - 2 * TILE && fz.ow.x <= fz.x1 + 2 * TILE) fz.ow._torch = true;
            return true;
        });
        REV.arcs = REV.arcs.filter(a => {
            if (now > a.until || a.a.hp <= 0 || a.b.hp <= 0) return false;
            const lo = Math.min(a.a.x, a.b.x), hi = Math.max(a.a.x, a.b.x);
            plants.forEach(p => { if (p.hp > 0 && p.r === a.r && PX(p) >= lo && PX(p) <= hi) hitPlant(p, 110 * dt, { stun: 350 }); });
            if (!a.fx || now - a.fx > 600) { a.fx = now; boxFx(lo, a.r * 20 + 7, hi - lo, 6, 'arc', 640); parts((lo + hi) / 2, RY(a.r), ['⚡'], 2); }
            return true;
        });
        REV.clouds = REV.clouds.filter(c => {
            if (now > c.until) return false;
            plants.forEach(p => { if (p.hp > 0 && p.r >= c.r0 && p.r <= c.r1 && PX(p) >= c.x0 && PX(p) <= c.x1) { p.attackSlowedUntil = now + 600; p.attackSlowFactor = Math.min(p.attackSlowFactor || 1, 0.3); } });
            return true;
        });
    }
    let lastTick = 0;
    const _update = updateGame;
    updateGame = function () {
        if (!REV.on) return _update.apply(this, arguments);
        if (REV.ended) return;
        const now = Date.now(), dt = Math.min(0.2, Math.max(0.001, (now - (lastTick || now)) / 1000)); lastTick = now;
        sun = REV.brains;
        preTick(now);
        const before = plants.slice();
        _update.apply(this, arguments);
        if (!REV.on || REV.ended) return;
        // evasion buffers
        (REV.bufZ || []).forEach(z => { z.hp = Math.min(z.maxHp, z._php != null ? z._php : z.hp); z._buf = false; });
        // plants eaten -> brains
        const aliveIds = new Set(plants.filter(p => p.hp > 0).map(p => p.id));
        before.forEach(p => {
            if (aliveIds.has(p.id)) return;
            if (p._rewarded) return; p._rewarded = true;
            const n = plantReward(p); addBrains(n); REV.stats.eaten++;
            const x = PX(p), y = RY(p.r); floatTxt(x, y, `+${n} 🧠`); ringFx(x, y); parts(x, y, ['👻', '💀', '✨', '🧠'], 6); sfx('sun');
        });
        // regen
        let g = 0; while (now >= REV.nextRegen && g++ < 5) { addBrains(REGEN_BRAINS); REV.nextRegen += REGEN_MS; }
        if (g) updateSunDisplay();
        // zombies
        mine().forEach(z => { z._sm = {}; });
        auraPass(now);
        mine().forEach(z => zTick(z, now, dt));
        hopsTick(now); barrelsTick(now, dt); firesTick(now, dt);
        if (REV.dreadAcc >= 1) { const n = Math.floor(REV.dreadAcc); REV.dreadAcc -= n; addDread(n); }
        daveTick(now, dt); bossTick(now);
        suns = []; energyBeanDrops = []; sun = REV.brains; updateSunDisplay();
        hudUpdate(); cardState(now); rings(now);
        // end conditions
        const minCost = Math.min.apply(null, REV.deck.map(zCost));
        if (REV.laneN >= 3 && !alive().length && REV.brains < minCost) { if (!REV.endAt) REV.endAt = now + 1500; else if (now >= REV.endAt) finish(true, 'spent'); } else REV.endAt = 0;
        if (now - REV.startedAt > MAX_BATTLE_MS) finish(REV.laneN >= 3, 'time');
    };
    const _over = triggerGameOver;
    triggerGameOver = function () { if (!REV.on) return _over.apply(this, arguments); };
    const _sky = spawnSkySun;
    spawnSkySun = function () { if (REV.on) return; return _sky.apply(this, arguments); };
    const _wave = startNextWave;
    startNextWave = function () { if (REV.on) { totalZombiesInWave = 0; return; } return _wave.apply(this, arguments); };
    const _mow = initLawnmowers;
    initLawnmowers = function () { if (REV.on) { mowers = []; return; } return _mow.apply(this, arguments); };
    const _mt = mastTier;
    mastTier = function (k) { return REV.on ? 0 : _mt(k); };
    const _home = returnToHome;
    returnToHome = function () { if (REV.on) { revLeaveBattle(false); return; } return _home.apply(this, arguments); };
    const _vic = triggerVictory;
    triggerVictory = function () {
        const was = revPortalUnlocked();
        const r = _vic.apply(this, arguments);
        if (!was && revPortalUnlocked() && !store.get(KEY_SEEN, false)) { store.set(KEY_SEEN, true); setTimeout(() => { try { missionToast('🌀 A mysterious portal opened on the World 2 map…'); } catch (_) {} }, 1200); }
        return r;
    };

    // ---------------------------------------------------------------------------------
    //  CRAZY DAVE AI  (v2: reads zombies, abilities and commands; Plant Food; per-stage decks)
    // ---------------------------------------------------------------------------------
    const SUNNERS = ['sunflower', 'twinsunflower', 'primalsunflower', 'sunshroom'];
    const WALLP = ['wallnut', 'tallnut', 'infinut', 'celery', 'garlic'];
    const SUPPORTP = ['intensivecarrot', 'sweetpotato', 'tileturnip', 'powerlily'];
    const TRAPP = ['spikeweed', 'spikerock', 'potatomine', 'primalpotatomine'];
    const NOFOOD = ['gravebuster', 'tileturnip', 'powerlily', 'jalapeno', 'thymewarp', 'cherrybomb', 'blover', 'iceberglettuce'];
    const DCD = { sunflower: 6000, twinsunflower: 7000, peashooter: 6000, wallnut: 14000, tallnut: 18000, infinut: 24000, potatomine: 14000, spikeweed: 9000, spikerock: 16000, chomper: 14000, garlic: 12000, magnetshroom: 18000, cactus: 10000, 'cherrybomb*': 32000, 'jalapeno*': 28000, 'blover*': 14000, 'iceberglettuce*': 16000, 'thymewarp*': 38000, 'gravebuster*': 9000, 'primalpotatomine*': 45000, 'powerlily*': 30000 };
    // counter table: zombie kind -> ordered [plant, role] ; 'x*' = instant tool
    const CTR = {
        basic: [['peashooter', 'mid'], ['snowpea', 'mid'], ['gatlingpea', 'mid']],
        cone: [['firepea', 'mid'], ['cabbagetosser', 'mid'], ['bowlingbulb', 'mid'], ['gatlingpea', 'mid'], ['grimrose', 'mid']],
        bucket: [['magnetshroom', 'mid'], ['chomper', 'front'], ['laserbean', 'mid'], ['lightningreed', 'mid'], ['cherrybomb*']],
        polevault: [['tallnut', 'near'], ['infinut', 'near'], ['potatomine', 'near'], ['spikeweed', 'near'], ['chomper', 'near'], ['garlic', 'near'], ['wallnut', 'near']],
        screendoor: [['melonpult', 'mid'], ['dusklobber', 'mid'], ['wintermelon', 'mid'], ['cabbagetosser', 'mid'], ['rotobaga', 'mid'], ['laserbean', 'mid'], ['lightningreed', 'mid'], ['grimrose', 'mid'], ['cherrybomb*']],
        football: [['tallnut', 'near'], ['infinut', 'near'], ['spikerock', 'near'], ['snowpea', 'mid'], ['snowdragon', 'mid'], ['shadowshroom', 'mid'], ['sapling', 'mid'], ['iceberglettuce*'], ['chomper', 'near']],
        flag: [['snowpea', 'mid'], ['snowdragon', 'mid'], ['wintermelon', 'mid'], ['bowlingbulb', 'mid'], ['cherrybomb*']],
        explorer: [['snowpea', 'mid'], ['snowdragon', 'mid'], ['wintermelon', 'mid'], ['sapling', 'mid'], ['shadowshroom', 'mid'], ['iceberglettuce*']],
        barrel: [['spikerock', 'near'], ['potatomine', 'near'], ['chomper', 'near'], ['tallnut', 'near'], ['cherrybomb*']],
        impcannon: [['melonpult', 'mid'], ['dusklobber', 'mid'], ['magnetshroom', 'mid'], ['laserbean', 'mid'], ['citron', 'mid'], ['cherrybomb*']],
        pianist: [['bowlingbulb', 'mid'], ['bonkchoy', 'near'], ['celery', 'near'], ['grimrose', 'mid'], ['cherrybomb*'], ['jalapeno*']],
        tesla: [['melonpult', 'mid'], ['cabbagetosser', 'mid'], ['dusklobber', 'mid'], ['laserbean', 'mid'], ['intensivecarrot', 'back'], ['cherrybomb*']],
        balloon: [['cactus', 'mid'], ['blover*'], ['laserbean', 'mid']],
        gargantuar: [['spikerock', 'near'], ['snowdragon', 'mid'], ['snowpea', 'mid'], ['iceberglettuce*'], ['cherrybomb*'], ['jalapeno*'], ['chomper', 'near'], ['infinut', 'near'], ['tallnut', 'near'], ['laserbean', 'mid'], ['firedragon', 'mid'], ['wintermelon', 'mid'], ['bonkchoy', 'near']]
    };
    const AMBUSH = [['bonkchoy', 'adj'], ['chomper', 'adj'], ['celery', 'adj'], ['bowlingbulb', 'adj'], ['spikeweed', 'adj'], ['potatomine', 'adj'], ['cherrybomb*'], ['wallnut', 'adj']];
    const dH = () => REV.dave;
    const dHas = k => REV.dave.deck.includes(k);
    const tHas = k => SD().tools.includes(k) && REV.tier >= (TOOL_TIER[k] || 1);
    const dReady = (k, now) => (REV.dave.cds[k] || 0) <= now;
    const dCd = (k, now) => { REV.dave.cds[k] = now + (DCD[k] || (6000 + ((PLANT_TYPES[k] && PLANT_TYPES[k].cost) || 100) * 40)) * REV.dave.cdScale; };
    const pCost = k => (PLANT_TYPES[k] && PLANT_TYPES[k].cost) || 9999;
    const tileFree = (r, c) => c >= 0 && c <= 5 && !plants.some(p => p.hp > 0 && p.r === r && p.c === c && p.type !== 'tileturnip');
    const wZ = z => 1 + Math.min(3, z.hp / 300) + (z.rk === 'gargantuar' ? 3 : 0) + (z.rk === 'football' || z.rk === 'bucket' ? 0.8 : 0) + (z.rk === 'impcannon' || z.rk === 'tesla' ? 1 : 0);
    const ghost = (z, now) => z._fx && (z._fx.evade > now || z._stealth > now);
    const reactMs = () => Math.max(260, 900 - REV.tier * 90);
    const aware = () => 55 + 6 * REV.tier;                       // how far out Dave notices zombies
    function daveInit() {
        const S = SD(), t = REV.tier, now = Date.now();
        REV.dave = {
            sun: S.sun + 25 * (t - 1), thinkMs: 3500 - (t - 1) * 350, cdScale: 1 - t * 0.05, deck: S.deck.slice(), cds: {}, thinkAt: now + 2500, skyAt: now + 10000, tel: [], alerts: [],
            food: [1, 1, 1, 2, 2, 2, 3][t - 1], foodCap: 3 + (t >= 6 ? 1 : 0), foodAt: now + (30000 - t * 2800), foodCd: 0, lastX: new Map(), seen: {}, heat: [0, 0, 0, 0, 0], raised: [], nSunTarget: Math.min(4, 2 + Math.ceil(t / 2))
        };
    }
    // ---- events from the player ------------------------------------------------------
    function daveNotice(kind, z) {
        const d = REV.dave; if (!d) return; const now = Date.now();
        d.alerts.push({ kind, z, t: now });
        if (kind === 'raise' && z) { d.seen[z.rk] = (d.seen[z.rk] || 0) + 1; d.heat[z.r] = Math.min(8, d.heat[z.r] + 1); d.raised.push({ rk: z.rk, r: z.r, t: now }); }
        if (d.alerts.length > 14) d.alerts.shift();
        d.thinkAt = Math.min(d.thinkAt, now + reactMs());
    }
    // ---- threat model -----------------------------------------------------------------
    function laneThreat(r, zs) {
        let t = 0; zs.forEach(z => { if (z.r === r && z.x < 95) t += wZ(z) * (1 + Math.max(0, 70 - z.x) / 45); });
        const front = plants.filter(p => p.hp > 0 && p.r === r).length; return t * (front === 0 ? 1.8 : 1);
    }
    function foodScore(p, zs) {
        if (p.hp <= 0 || NOFOOD.includes(p.type) || (p.type === 'cactus' && p.cactusAbilityUsed)) return 0;
        const px = PX(p), ahead = zs.filter(z => z.x >= px - 4), lane = ahead.filter(z => z.r === p.r), near = ahead.filter(z => Math.abs(z.r - p.r) <= 1 && z.x < px + 45);
        const S = a => a.reduce((s, z) => s + wZ(z), 0), t = p.type;
        if (['firedragon', 'snowdragon', 'bonkchoy', 'electricblueberry'].includes(t)) return S(near) * 0.95;
        if (['laserbean', 'bowlingbulb', 'coconutcannon', 'gatlingpea', 'primalpeashooter', 'electricpeashooter', 'lightningreed', 'citron', 'melonpult', 'wintermelon', 'peapod'].includes(t)) return S(lane) * 0.85;
        if (['chomper', 'grimrose', 'shadowshroom', 'dusklobber', 'sapling', 'rotobaga'].includes(t)) return zs.length >= 3 ? S(zs) * 0.6 : S(near) * 0.5;
        if (['sweetpotato', 'intensivecarrot'].includes(t)) { let miss = 0, n = 0; plants.forEach(q => { if (q.hp > 0) { miss += (q.maxHp - q.hp) / Math.max(1, q.maxHp); if (q.frozenUntil > Date.now()) n++; } }); return miss * 2.2 + n * 0.8; }
        if (WALLP.includes(t)) { const hurt = 1 - p.hp / p.maxHp; return hurt * 6 * Math.min(1, lane.filter(z => z.x < px + 20).length); }
        if (SUNNERS.includes(t)) return 0;
        return S(lane) * 0.7;
    }
    function powerTiles() { return new Set(plants.filter(q => q.type === 'tileturnip' && q.hp > 0).map(q => q.r + ',' + q.c)); }
    function foodGroup(p) { const pt = powerTiles(); if (pt.has(p.r + ',' + p.c)) return plants.filter(q => q.hp > 0 && q.type !== 'tileturnip' && pt.has(q.r + ',' + q.c)); return [p]; }
    function foodOn(p, now) {
        const d = REV.dave, grp = foodGroup(p);
        grp.forEach(q => { try { triggerPlantSuperAbility(q); } catch (_) {} q.frozenUntil = 0; q.attackSlowedUntil = 0; q.hp = Math.min(q.maxHp, q.hp + q.maxHp * 0.25); });
        d.food--; d.foodCd = now + 3500; banner(`🫘 Dave fed ${PLANT_TYPES[p.type].emoji} ${PLANT_TYPES[p.type].name || p.type} with Plant Food${grp.length > 1 ? ' (power tiles: ' + grp.length + ' plants!)' : ''}`, 'red');
    }
    function bestFood(zs) {
        let best = null, bs = 0;
        plants.forEach(p => { if (p.hp <= 0 || p.type === 'tileturnip') return; let s = foodScore(p, zs); const g = foodGroup(p); if (g.length > 1) s = g.reduce((a, q) => a + foodScore(q, zs), 0) * 0.7; if (s > bs) { bs = s; best = p; } });
        return { p: best, s: bs };
    }
    // ---- placing ----------------------------------------------------------------------
    function dPlace(type, r, c, now) {
        const d = REV.dave, cost = pCost(type);
        if (!PLANT_TYPES[type] || d.sun < cost || !dReady(type, now) || !tileFree(r, c)) return false;
        d.sun -= cost; dCd(type, now); const p = mkPlant(type, r, c); p.isNew = true;
        const x = PX(p), y = RY(r); parts(x, y, ['🌱', '✨'], 4); ringFx(x, y, 'green'); sfx('plant'); return true;
    }
    function colsFor(role, zx) {
        const zc = colOf(Math.max(0, zx)), lim = c => PX({ c }) < zx - 5;
        let cols;
        if (role === 'front') cols = [5, 4, 3, 2, 1]; else if (role === 'mid') cols = [3, 2, 4, 1, 5]; else if (role === 'back') cols = [1, 0, 2];
        else if (role === 'adj') cols = [zc - 1, zc - 2, zc, zc + 1].filter(c => c >= 0 && c <= 5);
        else cols = [zc - 2, zc - 3, zc - 1, zc - 4, 4, 3].filter(c => c >= 0 && c <= 5);   // near: in the zombie's path
        return cols.filter(c => role === 'adj' || lim(c));
    }
    function placeRole(type, r, role, zx, now) {
        for (const c of colsFor(role, zx)) if (tileFree(r, c) && dPlace(type, r, c, now)) return true; return false;
    }
    const cnt = (type, r) => plants.filter(p => p.hp > 0 && p.r === r && p.type === type).length;
    // ---- tools (instants) -------------------------------------------------------------
    function toolOk(k, now, sunNeed) { return tHas(k) && dReady(k + '*', now) && REV.dave.sun >= (sunNeed || pCost(k)); }
    function telegraph(kind, r, x) {
        const d = REV.dave, now = Date.now();
        if (kind === 'jala' || kind === 'cob') boxFx(0, r * 20, 100, 20, 'warn', 1250); else boxFx(Math.max(0, x - 1.5 * TILE), Math.max(0, (r - 1) * 20), 3 * TILE, 60, 'warn', 1250);
        d.tel.push({ kind, r, x, at: now + 1200 });
        floatTxt(Math.max(8, x), RY(r) - 10, kind === 'jala' ? '🌶️⚠️' : kind === 'cob' ? '🥥⚠️' : '🍒⚠️', 'red');
        banner(kind === 'jala' ? '🌶️ Dave lit a Jalapeño — dodge the lane!' : kind === 'cob' ? '🥥 Cob Cannon firing down the lane — dodge!' : '🍒 Dave is dropping a Cherry Bomb — sidestep!', 'red'); sfx('hit');
    }
    function detonate(t) {
        const now = Date.now(), lane = t.kind === 'jala' || t.kind === 'cob', dmg = t.kind === 'jala' ? 450 : t.kind === 'cob' ? 420 : 700;
        if (t.kind === 'grave') { const tb = zombies.find(z => z.isTomb && z.hp > 0 && z.r === t.r && Math.abs(z.x - t.x) < 6); if (tb) { tb.hp = 0; parts(t.x, RY(t.r), ['🪦', '💥', '🌱'], 8); sfx('boom'); floatTxt(t.x, RY(t.r) - 8, '⚰️ Gravebuster!', 'red'); } return; }
        alive().forEach(z => {
            const inn = lane ? z.r === t.r : (Math.abs(z.r - t.r) <= 1 && Math.abs(z.x - t.x) <= 1.5 * TILE);
            if (!inn) return;
            if (ghost(z, now)) { tag(z, '💨 dodged!', 'gold'); return; }
            const m = (z._fx && z._fx.brace > now) ? 0.25 : 1;
            z.hp -= dmg * m; z.hitFlash = true; if (t.kind === 'cob') z.x = Math.min(98, z.x + 8);
        });
        if (t.kind === 'jala') boxFx(0, t.r * 20, 100, 20, 'jala', 700); else if (t.kind === 'cob') boxFx(0, t.r * 20, 100, 20, 'fire', 700); else boxFx(Math.max(0, t.x - 1.5 * TILE), Math.max(0, (t.r - 1) * 20), 3 * TILE, 60, 'boomb', 700);
        parts(lane ? 50 : t.x, RY(t.r), ['💥', lane ? '🔥' : '🍒'], 10); shake(7); sfx('boom');
    }
    function predX(z, ms) { const d = REV.dave, o = d.lastX.get(z); if (!o) return z.x; const v = Math.max(0, (o.x - z.x) / Math.max(60, (Date.now() - o.t))); return Math.max(0, z.x - v * ms); }
    function strikeSpot(zs, now) {
        const xs = zs.filter(z => !ghost(z, now)).map(z => ({ z, x: predX(z, 1200) }));
        let best = null, bv = 0;
        xs.forEach(a => { for (let dr = -1; dr <= 1; dr++) { const r = Math.min(4, Math.max(0, a.z.r + dr)); let v = 0; xs.forEach(b => { if (Math.abs(b.z.r - r) <= 1 && Math.abs(b.x - a.x) <= 1.5 * TILE) v += wZ(b.z); }); if (v > bv) { bv = v; best = { r, x: a.x, v, pianist: xs.some(b => b.z.rk === 'pianist' && Math.abs(b.z.r - r) <= 1 && Math.abs(b.x - a.x) <= 2.5 * TILE && b.z._cdAt <= now && REV.dread >= 25) }; } } });
        return best;
    }
    function toolFreeze(z, now, rad) { alive().forEach(q => { if (Math.abs(q.r - z.r) <= 1 && Math.abs(q.x - z.x) <= (rad || 1.6) * TILE && !ghost(q, now) && !(q._fx && q._fx.unstop > now)) { q.frozenUntil = Math.max(q.frozenUntil || 0, now + 3000); q.hp -= 50; q.hitFlash = true; } }); boxFx(Math.max(0, z.x - 1.6 * TILE), Math.max(0, (z.r - 1) * 20), 3.2 * TILE, 60, 'emp', 800); parts(z.x, RY(z.r), ['🧊', '❄️'], 6); sfx('ice'); }
    function toolBlover(now) {
        REV.clouds.length = 0; document.querySelectorAll('.rv-box.spore').forEach(e => e.remove());
        alive().forEach(q => { if (q._air) { q._air = false; q.flying = false; q.stunnedUntil = now + 1200; q.hp *= 0.65; q.hitFlash = true; floatTxt(q.x + 3, RY(q.r) - 8, '🍀 Blovered!', 'red'); }
            if (q.rk !== 'gargantuar' && !(q._fx && q._fx.unstop > now)) q.x = Math.min(97, q.x + 10); });
        boxFx(0, 0, 100, 100, 'gust', 700); sfx('slam');
    }
    function toolThyme(z, now) {
        alive().forEach(q => { if (Math.abs(q.r - z.r) <= 1 && Math.abs(q.x - z.x) <= 2.6 * TILE && !ghost(q, now)) { q.hp -= 200; q.x = Math.min(97, q.x + 14); q.frozenUntil = Math.max(q.frozenUntil || 0, now + 3000); q.hitFlash = true; } });
        plants.forEach(p => { if (p.hp > 0 && Math.abs(p.r - z.r) <= 1 && Math.abs(PX(p) - z.x) <= 5 * TILE) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4); });
        boxFx(Math.max(0, z.x - 2.6 * TILE), Math.max(0, (z.r - 1) * 20), 5.2 * TILE, 60, 'steam', 900); parts(z.x, RY(z.r), ['⏳', '✨'], 8); sfx('levelup');
    }
    // ---- plans ------------------------------------------------------------------------
    function useCounter(entry, z, now, zs) {
        const [k, role] = entry;
        if (k.endsWith('*')) {
            const t = k.slice(0, -1);
            if (t === 'cherrybomb' && toolOk(t, now)) { const sp = strikeSpot(zs, now); if (sp && sp.v >= 2.2 && !(sp.pianist && REV.tier >= 4)) { REV.dave.sun -= pCost(t); dCd(k, now); telegraph('cherry', sp.r, sp.x); return true; } }
            else if (t === 'jalapeno' && toolOk(t, now)) { const n = zs.filter(q => q.r === z.r && q.x < 90 && !ghost(q, now)).reduce((s, q) => s + wZ(q), 0); if (n >= 3) { REV.dave.sun -= pCost(t); dCd(k, now); telegraph('jala', z.r, 50); return true; } }
            else if (t === 'iceberglettuce' && toolOk(t, now)) { REV.dave.sun -= pCost(t); dCd(k, now); toolFreeze(z, now); return true; }
            else if (t === 'blover' && toolOk(t, now)) { REV.dave.sun -= pCost(t); dCd(k, now); toolBlover(now); banner('🍀 Dave used Blover!', 'red'); return true; }
            return false;
        }
        if (!dHas(k) || cnt(k, z.r) >= (role === 'near' || role === 'adj' ? 1 : 2) + (WALLP.includes(k) ? 0 : 0)) return false;
        return placeRole(k, z.r, role, z.x, now);
    }
    function planEmergency(S, now) {
        const d = REV.dave, bad = S.zs.filter(z => z.x < 24 && !ghost(z, now)).sort((a, b) => a.x - b.x)[0]; if (!bad) return false;
        const zs = S.zs;
        if (d.food > 0 && d.foodCd <= now) { const lanePl = plants.filter(p => p.hp > 0 && Math.abs(p.r - bad.r) <= 1); let b = null, bs = 0; lanePl.forEach(p => { const s = foodScore(p, zs) + 3; if (s > bs) { bs = s; b = p; } }); if (b) { foodOn(b, now); return true; } }
        if (toolOk('thymewarp', now) && REV.tier >= 5) { d.sun -= pCost('thymewarp'); dCd('thymewarp*', now); toolThyme(bad, now); banner('⏳ Dave warped time to save the lane!', 'red'); return true; }
        if (toolOk('iceberglettuce', now)) { d.sun -= pCost('iceberglettuce'); dCd('iceberglettuce*', now); toolFreeze(bad, now); return true; }
        if (toolOk('blover', now) && zs.filter(z => z.r === bad.r && z.x < 50).length >= 2) { d.sun -= pCost('blover'); dCd('blover*', now); toolBlover(now); banner('🍀 Dave blew the horde back!', 'red'); return true; }
        for (const k of ['tallnut', 'wallnut', 'infinut', 'celery', 'garlic', 'bonkchoy', 'chomper']) if (dHas(k) && dPlace(k, bad.r, Math.max(0, Math.min(5, colOf(bad.x) - 1)), now)) return true;
        for (const k of ['tallnut', 'wallnut', 'infinut', 'celery']) if (dHas(k) && placeRole(k, bad.r, 'back', bad.x, now)) return true;
        return false;
    }
    function planFood(S, now) {
        const d = REV.dave; if (d.food <= 0 || d.foodCd > now || S.zs.length < 1) return false;
        const { p, s } = bestFood(S.zs), thr = Math.max(2.6, 8 - REV.tier * 0.8);
        if (p && s >= thr) { foodOn(p, now); return true; } return false;
    }
    function planStrike(S, now) {
        const d = REV.dave, zs = S.zs; if (!zs.length) return false;
        const need = Math.max(2.4, 4.6 - REV.tier * 0.3);
        if (toolOk('cherrybomb', now)) { const sp = strikeSpot(zs, now); if (sp && sp.v >= need && !(sp.pianist && REV.tier >= 4 && sp.v < need * 2)) { d.sun -= pCost('cherrybomb'); dCd('cherrybomb*', now); telegraph('cherry', sp.r, sp.x); return true; } }
        if (toolOk('jalapeno', now)) { for (let r = 0; r < ROWS; r++) { const v = zs.filter(z => z.r === r && z.x < 90 && !ghost(z, now)).reduce((s, z) => s + wZ(z), 0); if (v >= need + 0.8) { d.sun -= pCost('jalapeno'); dCd('jalapeno*', now); telegraph('jala', r, 50); return true; } } }
        // cob cannon: fire it down a busy lane
        if (REV.tier >= 4) { const cob = plants.find(p => p.hp > 0 && p.type === 'coconutcannon' && (d.cds['cob' + p.id] || 0) <= now && zs.filter(z => z.r === p.r && z.x > PX(p)).reduce((s, z) => s + wZ(z), 0) >= need); if (cob) { d.cds['cob' + cob.id] = now + 9000 * d.cdScale; try { fireCoconutCannon(cob); } catch (_) {} return true; } }
        return false;
    }
    function planAlerts(S, now) {
        const d = REV.dave, zs = S.zs; let did = false;
        const al = d.alerts.splice(0).filter(a => now - a.t < 6000);
        for (const a of al) {
            const z = a.z, k = a.kind;
            if (k === 'fog') { for (let r = 0; r < ROWS; r++) { if (zs.some(q => q.r === r && q.x > 50) && !plants.some(p => p.hp > 0 && p.r === r && p.type === 'torchwood') && dHas('torchwood') && placeRole('torchwood', r, 'mid', 60, now)) { did = true; break; } } if (!did && d.food > 0 && d.foodCd <= now) { const bf = bestFood(zs); if (bf.p && bf.s >= 3) { foodOn(bf.p, now); did = true; } } }
            else if (k === 'grave') { if (toolOk('gravebuster', now)) { const tb = zombies.find(q => q.isTomb && q.hp > 0); if (tb) { d.sun -= pCost('gravebuster'); dCd('gravebuster*', now); d.tel.push({ kind: 'grave', r: tb.r, x: tb.x, at: now + 1000 }); parts(tb.x, RY(tb.r), ['🪦', '🌱'], 4); floatTxt(tb.x, RY(tb.r) - 8, '⚰️ Gravebuster!', 'red'); did = true; } } }
            else if (!z || z.hp <= 0) continue;
            else if (k === 'cast:impcannon' || k === 'cast:polevault' || k === 'cast:balloon' || k === 'bungee' || k === 'cast:pianist') {
                if (k === 'cast:balloon' && z.r != null) { if (toolOk('blover', now) && zs.filter(q => q._air).length) { d.sun -= pCost('blover'); dCd('blover*', now); toolBlover(now); did = true; } }
                if (!did) { const behind = !plants.some(p => p.hp > 0 && p.r === z.r && PX(p) > z.x); if (behind || k === 'cast:impcannon' || k === 'bungee') for (const e of AMBUSH) if (useCounter(e, z, now, zs)) { did = true; break; } }
            } else if (k === 'cast:tesla') {
                // EMP: cure the stunned lane with Plant Food, else bring a wall
                if (d.food > 0 && d.foodCd <= now) { const stunned = plants.filter(p => p.hp > 0 && p.frozenUntil > now); if (stunned.length >= 2) { const b = stunned.sort((a, c) => foodScore(c, zs) - foodScore(a, zs))[0]; foodOn(b, now); did = true; } }
            } else if (k === 'cast:screendoor') {
                for (const e of [['melonpult', 'mid'], ['dusklobber', 'mid'], ['wintermelon', 'mid'], ['cabbagetosser', 'mid'], ['cherrybomb*']]) if (useCounter(e, z, now, zs)) { did = true; break; }
            } else if (k === 'cast:bucket') {
                for (const e of [['chomper', 'front'], ['magnetshroom', 'mid'], ['cherrybomb*']]) if (useCounter(e, z, now, zs)) { did = true; break; }
            } else if (k === 'cast:flag' || k === 'cast:football' || k === 'cast:gargantuar') {
                for (const e of (CTR[z.rk] || [])) if (useCounter(e, z, now, zs)) { did = true; break; }
            } else if (k === 'raise' && z.x < aware() + 25) {
                for (const e of (CTR[z.rk] || [])) if (useCounter(e, z, now, zs)) { did = true; break; }
            }
            if (did) break;
        }
        return did;
    }
    function planEconomy(S, now) {
        const d = REV.dave, calm = Math.max.apply(null, S.th) < 7;
        const n = plants.filter(p => p.hp > 0 && SUNNERS.includes(p.type)).length;
        if (n < d.nSunTarget && d.sun >= 50 && (calm || n < 2)) { const order = S.safest; for (const k of ['sunflower', 'twinsunflower', 'primalsunflower', 'sunshroom']) if (dHas(k)) for (const r of order) for (const c of [0, 1]) if (dPlace(k, r, c, now)) return true; }
        if (tHas('powerlily') && d.food < d.foodCap && d.sun >= 260 && dReady('powerlily*', now) && Math.max.apply(null, S.th) < 6) { d.sun -= pCost('powerlily'); dCd('powerlily*', now); d.food++; parts(25, 50, ['🪷', '🫘'], 5); floatTxt(20, 50, '🫘 +1 Plant Food', 'red'); return true; }
        return false;
    }
    function planCounters(S, now) {
        const zs = S.zs, A = aware();
        const order = zs.filter(z => z.x < A && !ghost(z, now)).sort((a, b) => (laneThreat(b.r, zs) + wZ(b)) - (laneThreat(a.r, zs) + wZ(a)));
        for (const z of order) { const tbl = CTR[z.rk]; if (!tbl) continue; for (const e of tbl) if (useCounter(e, z, now, zs)) return true; }
        // proactive: counter the types the player keeps raising
        if (REV.tier >= 3) {
            const recent = d_rec(now);
            for (const a of recent) { const v = { rk: a.rk, r: a.r, x: 78, hp: 300 }; for (const e of (CTR[a.rk] || [])) { if (e[0].endsWith('*')) continue; if (useCounter(e, v, now, zs)) return true; } }
        }
        return false;
    }
    const d_rec = now => { const d = REV.dave; d.raised = d.raised.filter(a => now - a.t < 25000); const m = new Map(); d.raised.forEach(a => { const k = a.rk + a.r; m.set(k, (m.get(k) || { rk: a.rk, r: a.r, n: 0 })); m.get(k).n++; }); return [...m.values()].filter(a => a.n >= (REV.tier >= 5 ? 1 : 2)).sort((a, b) => b.n - a.n).slice(0, 3); };
    function planReinforce(S, now, force) {
        const d = REV.dave, lanes = S.hot;
        const shooters = d.deck.filter(k => !SUNNERS.includes(k) && !WALLP.includes(k) && !SUPPORTP.includes(k) && !TRAPP.includes(k) && !['magnetshroom', 'cactus', 'chomper', 'coconutcannon', 'gravebuster'].includes(k)).sort((a, b) => pCost(b) - pCost(a));
        for (const r of lanes) {
            if (!force && S.th[r] < (REV.tier >= 4 ? 1 : 3)) continue;
            const hasWall = plants.some(p => p.hp > 0 && p.r === r && WALLP.includes(p.type) && p.c >= 3);
            if (!hasWall) for (const k of ['tallnut', 'wallnut', 'infinut', 'celery', 'garlic']) if (dHas(k) && placeRole(k, r, 'front', 100, now)) return true;
            const ns = plants.filter(p => p.hp > 0 && p.r === r && shooters.includes(p.type)).length;
            if (ns < (force ? 3 : 2) + (REV.tier >= 5 ? 1 : 0)) for (const k of shooters) if (placeRole(k, r, 'mid', 100, now)) return true;
            for (const k of TRAPP.filter(t => t !== 'primalpotatomine')) if (dHas(k) && cnt(k, r) < 1 && placeRole(k, r, 'front', 100, now)) return true;
            for (const k of SUPPORTP) if (dHas(k) && k !== 'powerlily' && k !== 'tileturnip' && !plants.some(p => p.hp > 0 && p.type === k && Math.abs(p.r - r) <= 1) && placeRole(k, r, 'back', 100, now)) return true;
        }
        return false;
    }
    function planSpecial(S, now) {
        const d = REV.dave;
        if (tHas('primalpotatomine') && REV.tier >= 6 && dReady('primalpotatomine*', now)) { const z = S.zs.find(q => (q.rk === 'polevault' || q.rk === 'football' || q.rk === 'barrel' || q.rk === 'gargantuar') && q.x < 80 && q.x > 35); if (z && d.sun >= 50 && placeRole('primalpotatomine', z.r, 'near', z.x, now)) { dCd('primalpotatomine*', now); return true; } }
        return false;
    }
    function daveThink(now) {
        const d = REV.dave, zs = alive();
        zs.forEach(z => d.lastX.set(z, { x: z.x, t: now })); for (const k of d.lastX.keys()) if (!k || k.hp <= 0) d.lastX.delete(k);
        const th = [0, 1, 2, 3, 4].map(r => laneThreat(r, zs));
        d.heat = d.heat.map(h => h * 0.97);
        const S = { zs, th, safest: [0, 1, 2, 3, 4].sort((a, b) => th[a] - th[b]), hot: [0, 1, 2, 3, 4].sort((a, b) => (th[b] + d.heat[b] * 0.4) - (th[a] + d.heat[a] * 0.4)) };
        let budget = 1 + (REV.tier >= 3 ? 1 : 0) + (REV.tier >= 6 ? 1 : 0);
        const plans = [planEmergency, planAlerts, planFood, planStrike, planEconomy, planSpecial, planCounters, planReinforce, (S2, n2) => d.sun >= 320 && planReinforce(S2, n2, true)];
        for (const f of plans) { if (budget <= 0) break; try { if (f(S, now)) budget--; } catch (e) { console.warn('dave plan', f.name, e); } }
    }
    function daveTick(now) {
        const d = REV.dave; if (!d || REV.lesson) return;
        plants.forEach(p => {
            if (p.hp <= 0) return;
            if (SUNNERS.includes(p.type)) { if (!p._dsT) p._dsT = now + 8000; if (now >= p._dsT) { p._dsT = now + 8000; d.sun += p.type === 'twinsunflower' ? 50 : p.type === 'primalsunflower' ? 40 : p.type === 'sunshroom' ? 15 : 25; floatTxt(PX(p), RY(p.r) - 6, '☀️', 'small'); } }
        });
        if (now >= d.skyAt) { d.skyAt = now + 10000; d.sun += 25; }
        if (now >= d.foodAt) { d.foodAt = now + (30000 - REV.tier * 2800); if (d.food < d.foodCap) { d.food++; floatTxt(8, 8, '🫘', 'small'); } }
        d.tel = d.tel.filter(t => { if (now >= t.at) { detonate(t); return false; } return true; });
        if (now >= d.thinkAt) { d.thinkAt = now + d.thinkMs; daveThink(now); }
    }

    // ---------------------------------------------------------------------------------
    //  BOSS: Dave's Mega-Bot (final stage)
    // ---------------------------------------------------------------------------------
    function bossInit() {
        REV.boss = null; document.querySelectorAll('.rv-bot').forEach(e => e.remove());
        if (!SD().boss) return;
        const now = Date.now(), f = $('rev-fx');
        REV.boss = { laserAt: now + 11000, moveAt: now + 15000, tel: null, ms: Math.max(6500, 13500 - REV.tier * 950) };
        if (f) { const b = document.createElement('div'); b.className = 'rv-bot'; b.textContent = '🤖'; f.appendChild(b); }
        setTimeout(() => banner('🤖 The Mega-Bot boots up! Watch the lanes for laser warnings.', 'red'), 500);
    }
    function bossTick(now) {
        const b = REV.boss; if (!b) return;
        if (b.tel && now >= b.tel.at) {
            const r = b.tel.r; b.tel = null; boxFx(0, r * 20 + 2, 100, 16, 'laser', 650); sfx('zap'); shake(6);
            alive().forEach(z => { if (z.r !== r) return; if (z._fx && (z._fx.evade > now || z._stealth > now)) { tag(z, '💨 dodged!', 'gold'); return; } z.hp -= 450; z.hitFlash = true; });
        }
        if (!b.tel && now >= b.laserAt) {
            const cnt = [0, 1, 2, 3, 4].map(r => alive().filter(z => z.r === r).reduce((a, z) => a + Math.min(3, z.hp / 400 + 1), 0));
            let r = cnt.indexOf(Math.max.apply(null, cnt)); if (Math.max.apply(null, cnt) <= 0) r = Math.floor(Math.random() * 5);
            b.laserAt = now + b.ms; b.tel = { r, at: now + 1500 };
            boxFx(0, r * 20 + 2, 100, 16, 'laserwarn', 1500); banner(`🤖 LASER charging in lane ${r + 1}! Sidestep it!`, 'red'); sfx('hit');
        }
        if (now >= b.moveAt) {
            b.moveAt = now + 12000;
            const th = [0, 1, 2, 3, 4].map(rowThreat), hot = th.indexOf(Math.max.apply(null, th)), cold = th.indexOf(Math.min.apply(null, th));
            if (hot !== cold && th[hot] > 2) {
                const mover = plants.filter(p => p.hp > 0 && p.r === cold && p.c >= 3 && !SUNNERS.includes(p.type)).sort((a, c) => c.c - a.c)[0];
                if (mover && tileFree(hot, mover.c)) { mover.r = hot; floatTxt(PX(mover), RY(hot) - 8, '🤖 relocated!', 'red'); boxFx(Math.max(0, PX(mover) - 6), hot * 20 + 2, 12, 16, 'warn', 700); }
            }
        }
    }

    // ---------------------------------------------------------------------------------
    //  COMMANDER TACTICS
    // ---------------------------------------------------------------------------------
    const CMD = { fog: { cost: 30, cd: 15 }, grave: { cost: 35, cd: 18 }, bungee: { cost: 40, cd: 20 } };
    window.revCmd = function (k) {
        if (!REV.on || REV.ended || !isRunning) return;
        const now = Date.now(), c = CMD[k];
        if ((REV.cmdCd[k] || 0) > now) { toast('Still recharging.'); return; }
        if (REV.dread < c.cost) { toast(`Need ${c.cost} 💀 Dread.`); sfx('hit'); return; }
        if (REV.armed && REV.armed.cmd === k) { REV.armed = null; banner('Cancelled.', ''); return; }
        if (k === 'fog') {
            addDread(-c.cost); REV.cmdCd.fog = now + c.cd * 1000; REV.fogUntil = now + 6000; daveNotice('fog');
            boxFx(50, 0, 50, 100, 'fog', 6000); banner('🌫️ NECROTIC FOG — raise zombies up to column 5; shots can’t find you!', 'cyan'); sfx('levelup');
        } else if (k === 'grave') { REV.armed = { cmd: 'grave', n: 0 }; banner('🪦 Place 2 Tombstones on empty tiles in columns 4–8 (Esc cancels)', 'cyan'); }
        else if (k === 'bungee') { REV.armed = { cmd: 'bungee', stage: 1 }; banner('🪝 Click the zombie to extract…', 'cyan'); }
        hudUpdate(true);
    };
    function cmdDone(k) { const c = CMD[k], now = Date.now(); addDread(-c.cost); REV.cmdCd[k] = now + c.cd * 1000; REV.armed = null; hudUpdate(true); }

    // ---------------------------------------------------------------------------------
    //  input: click a zombie to trigger its ability, W/S, Space, hotkeys
    // ---------------------------------------------------------------------------------
    function relPos(e) { const w = $('lawn-wrap'); if (!w) return null; const r = w.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 }; }
    function zombieAt(pos, any) {
        let best = null, bd = 1e9;
        (any ? alive() : mine()).forEach(z => { const dx = Math.abs(pos.x - (z.x + ZCX)), dy = Math.abs(pos.y - RY(z.r)); if (dx <= 7 && dy <= 11) { const d = dx + dy; if (d < bd) { bd = d; best = z; } } });
        return best;
    }
    let ZCX = 2;   // visual centre offset of a zombie sprite relative to z.x (calibrated in tests)
    window.REV_setZCX = v => { ZCX = v; };
    function armedClick(t, pos) {
        const A = REV.armed;
        if (A.cmd === 'grave') {
            if (t.c < 3 || t.c > 7) { toast('Tombstones go in columns 4–8.'); return; }
            if (plants.some(p => p.hp > 0 && p.r === t.r && p.c === t.c) || zombies.some(z => z.hp > 0 && z.r === t.r && Math.abs(z.x - (t.c + 0.5) * TILE) < 5)) { toast('That tile is occupied.'); return; }
            const tb = spawnPlain('tomb', t.r, (t.c + 0.5) * TILE, 350, 0, 0); if (tb) { tb.isTomb = true; tb.stationary = true; tb.speed = tb.baseSpeed = 0; parts((t.c + 0.5) * TILE, RY(t.r), ['🪦', '💀'], 6); sfx('slam'); }
            A.n++; if (A.n >= 2) { cmdDone('grave'); daveNotice('grave'); banner('🪦 Tombstones raised! Trigger an ability next to one for a Phantom Ambush.', 'cyan'); } return;
        }
        if (A.cmd === 'bungee') {
            if (A.stage === 1) { const z = zombieAt(pos, true); if (!z) { toast('Click a zombie.'); return; } A.z = z; A.stage = 2; banner('🪝 Now click a tile within 3 tiles…', 'cyan'); return; }
            const z = A.z; if (!z || z.hp <= 0) { REV.armed = null; return; }
            const zc = colOf(z.x + ZCX), zr = z.r;
            if (Math.abs(t.c - zc) > 3 || Math.abs(t.r - zr) > 3) { toast('Too far — within 3 tiles.'); return; }
            if (plants.some(p => p.hp > 0 && p.r === t.r && p.c === t.c)) { toast('A plant is there.'); return; }
            z.r = t.r; z.x = (t.c + 0.5) * TILE - ZCX; z.eating = false; z.offY = 0; daveNotice('bungee', z); fxSpr('🪝', z.x, -8, z.x, RY(z.r), { size: 36, duration: 420 }); parts(z.x, RY(z.r), ['💨', '✨'], 6); cmdDone('bungee'); return;
        }
        const z = A.z; if (!z || z.hp <= 0) { REV.armed = null; return; }
        let ok;
        if (A.mode === 'tile') ok = cast(z, { r: t.r, c: t.c }); else ok = cast(z, { r: t.r });
        if (ok !== false) REV.armed = null;
    }
    function onLawnClick(e) {
        if (!REV.on || REV.ended || !isRunning) return;
        if (e.target && e.target.closest && e.target.closest('#rev-cmd, #rev-help')) return;
        const pos = relPos(e); if (!pos || pos.x < 0 || pos.x > 100 || pos.y < 0 || pos.y > 100) return;
        const t = { c: Math.min(7, Math.floor(pos.x / TILE)), r: Math.min(ROWS - 1, Math.floor(pos.y / (100 / ROWS))) };
        if (REV.armed) { e.stopPropagation(); e.preventDefault(); armedClick(t, pos); return; }
        const z = zombieAt(pos);
        if (z) { e.stopPropagation(); e.preventDefault(); REV.kSel = z; tryAbility(z); }
    }
    window.addEventListener('keydown', e => {
        if (!REV.on || REV.ended || REV.guideOpen) return;
        const k = e.key.toLowerCase();
        if (k === 'escape') { if (REV.armed) { REV.armed = null; banner('Cancelled.', ''); } return; }
        if (/^[1-5]$/.test(k)) { const r = +k - 1; const z = mine().filter(q => q.r === r).sort((a, b) => a.x - b.x)[0]; if (z) { REV.kSel = z; ringFx(z.x + ZCX, RY(z.r), 'cyan'); } else toast('No zombie in lane ' + k); return; }
        if (k === ' ') { e.preventDefault(); if (REV.kSel && REV.kSel.hp > 0) tryAbility(REV.kSel); else toast('Press 1–5 to pick a lane’s front zombie first.'); return; }
        if ((k === 'w' || k === 's') && REV.armed && REV.armed.mode === 'lane') { const z = REV.armed.z; const nr = z.r + (k === 'w' ? -1 : 1); if (nr >= 0 && nr < ROWS) { if (cast(z, { r: nr }) !== false) REV.armed = null; } return; }
        if (k === 'f') return revCmd('fog'); if (k === 'g') return revCmd('grave'); if (k === 'b') return revCmd('bungee');
        const i = CARD_KEYS.indexOf(k); if (i >= 0 && REV.deck[i]) revSelect(REV.deck[i]);
    });
    window.revFinishNow = function () { if (REV.on && !REV.ended && REV.laneN >= 3) finish(true, 'finish'); };

    // ---------------------------------------------------------------------------------
    //  result + stars
    // ---------------------------------------------------------------------------------
    function finish(win, why) {
        if (REV.ended || REV.lesson) return;
        REV.ended = true; if (isRunning) toggleGame();
        const secs = Math.max(1, Math.round((Date.now() - REV.startedAt) / 1000)), par = parOf();
        const s1 = win && REV.laneN >= 3, s2 = s1 && REV.stats.spent <= par, s3 = s1 && REV.laneN >= 5 && REV.stats.syn >= 3;
        const stars = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s3 ? 1 : 0);
        if (stars) { const o = store.get(KEY_STARS, {}), key = REV.stage + ':' + REV.tier; o[key] = Math.max(o[key] || 0, stars); store.set(KEY_STARS, o); }
        const el = $('rev-result'); el.className = (win ? '' : 'lose ') + 'on';
        const em = win ? ['🧟', '🧠', '💀', '👻', '🦴'] : ['🌻', '🌱', '🥜', '☀️'];
        const conf = Array.from({ length: 22 }, (_, i) => `<i class="fall" style="left:${(i * 47) % 100}%;--t:${3 + (i % 5) * .6}s;--d:${(i % 9) * .35}s">${em[i % em.length]}</i>`).join('');
        const nextOk = win && STAGES[REV.stage - 34] && stageOpen(REV.stage + 1);
        el.innerHTML = `${conf}<div class="card"><div class="big">${win ? '🧠' : '🌻'}</div><h2>${win ? 'LANES BREACHED!' : (why === 'time' ? 'DAVE HELD OUT' : 'THE PLANTS HELD THE LINE')}</h2>
          <div class="rv-stars"><span class="${s1 ? 'on' : ''}">⭐<small>3 lanes</small></span><span class="${s2 ? 'on' : ''}">⭐<small>≤ ${par} 🧠</small></span><span class="${s3 ? 'on' : ''}">⭐<small>5 lanes + 3 synergies</small></span></div>
          <p>${win ? 'The homeowner’s brains are yours. Tier ' + TIER_NAMES[REV.tier - 1] + ' cleared!' : (why === 'time' ? 'The battle dragged on too long — Dave’s defenses stabilized. Be bolder!' : 'Fewer than 3 lanes breached.')}</p>
          <div class="stats"><div><b>${REV.stats.placed}</b>Raised</div><div><b>${REV.stats.eaten}</b>Plants</div><div><b>${REV.laneN}/5</b>Lanes</div><div><b>${REV.syn}</b>Synergy</div></div>
          <div class="stats"><div><b>${REV.stats.spent}</b>🧠 spent</div><div><b>${REV.stats.abil}</b>Abilities</div><div><b>${secs}s</b>Time</div><div><b>${totalStars()}</b>⭐ total</div></div>
          <div class="btns"><button class="rv-btn go" onclick="revRetry()">🔄 ${win ? 'Play Again' : 'Try Again'}</button>${nextOk ? '<button class="rv-btn go" onclick="revNext()">▶ Next Stage</button>' : ''}${win && REV.tier < 7 && tierOpen(REV.stage, REV.tier + 1) ? '<button class="rv-btn go" onclick="revNextTier()">⬆️ Tier ' + TIER_NAMES[REV.tier] + '</button>' : ''}<button class="rv-btn" onclick="revLeaveBattle(true)">🌀 Reversed Map</button></div></div>`;
        sfx(win ? 'levelup' : 'hit');
    }
    // ---- Training lessons (World 5): a throw-away practice stage with no Dave AI --------------------
    window.revStartLesson = function (les) {
        const st = { id: 35 + STAGES.length, name: les.name, icon: les.icon, arche: '', lesson: '', rows: les.rows, fill: {}, tools: [], unlock: [], deck: [], sun: 0, brains: les.brains || 400, par: 9999, lessonStage: true };
        STAGES.push(st);
        REV.stage = st.id; REV.tier = 1; REV.deck = les.deck.slice(); REV.lesson = les;
        revStartBattle();
        $('playing-level-name').textContent = '🎓 Training: ' + les.name;
        REV.dread = les.dread == null ? 30 : les.dread; hudUpdate(true);
    };
    window.revLessonExit = function () {
        REV.lesson = null;
        while (STAGES.length && STAGES[STAGES.length - 1].lessonStage) STAGES.pop();
        REV.stage = 35;
        revLeaveBattle(true);
    };
    const _rrm = renderRevMap;
    renderRevMap = function () { const r = _rrm.apply(this, arguments); try { if (window.lessonChips) window.lessonChips($('rev-map-screen'), 5); } catch (e) {} return r; };
    window.revRetry = function () { hide('rev-result'); resetGame(); toggleGame(); };
    function leaveToSelect(stage, tier) {
        hide('rev-result'); if (isRunning) toggleGame();
        $('playing-screen').classList.add('hidden'); delete document.body.dataset.world;
        selectedSeed = null; energyBeanActive = false; clearAllFx(); exitMode();
        REV.stage = stage; revOpenSelect(stage); if (tier) { revSetTier(tier); }
    }
    window.revNext = function () { leaveToSelect(REV.stage + 1); };
    window.revNextTier = function () { leaveToSelect(REV.stage, REV.tier + 1); };
    window.addEventListener('DOMContentLoaded', () => {
        build();
        const w = $('lawn-wrap');
        if (w) { w.addEventListener('click', onLawnClick, true); w.addEventListener('contextmenu', e => { if (REV.on && REV.armed) { e.preventDefault(); REV.armed = null; banner('Cancelled.', ''); } }); }
    });
    window.REV_UNL = unlockedZombies; window.REV_mine = mine; window.REV_COST = zCost; window.ROSTER_PUB = ROSTER; window.PX_ = PX; window.REV_PAR = () => parOf();
    window.REV_dbg = { tryAbility, cast, ABIL, zTick, spawnRoster, daveThink, finish, synFire, parOf, set ZCX(v) { ZCX = v; } };

    // =====================================================================================
    //  GUIDE — content
    // =====================================================================================
    const PE = k => (PLANT_TYPES[k] && PLANT_TYPES[k].emoji) || '🌱';
    const ZE = k => (ROSTER[k] && ZOMBIE_TYPES[ROSTER[k].g] && ZOMBIE_TYPES[ROSTER[k].g].emoji) || '🧟';
    const SYN = {
        blitz:   { n: 'Blitzkrieg Vanguard', e: '🏈', zs: ['flag', 'football', 'gargantuar'], tac: 'blitz',
            what: 'A heavy zombie (All-Star or Gargantuar) becomes UNSTOPPABLE for 3.5s — chill, freeze and stuns can’t hold it — and deals +50% damage.',
            how: ['Move a Flag Zombie right beside an All-Star or Gargantuar in the same lane (within 1.5 tiles).', 'Click the Flag Zombie and use Rally Cry.'], tip: 'Plan it for the moment you meet Snow Peas or Winter Melons.' },
        phalanx: { n: 'Phalanx Shuffle', e: '🛡️', zs: ['pianist', 'cone', 'bucket', 'screendoor', 'football'], tac: 'phalanx',
            what: 'Your armored squad glides into a new lane together and takes 60% less damage for 4.5s.',
            how: ['Keep a Pianist with at least 2 armored zombies (Conehead, Buckethead, Screen Door, All-Star) nearby.', 'Click the Pianist, then pick the lane above/below (or press W / S) for Tempo Shift.'], tip: 'Great for sidestepping a Dave strike while staying tough.' },
        faraday: { n: 'Faraday Conduit', e: '⚡', zs: ['tesla', 'polevault', 'impcannon'], tac: 'faraday',
            what: 'A lightning arc links the Tesla Saboteur to a partner zombie behind it and shocks every plant in between for 4s.',
            how: ['In one lane: a Pole Vaulter (or a dropped Imp) 2–5 tiles behind the Tesla, with at least one plant between them.', 'Click the Tesla Saboteur and use EMP Short-Circuit.'], tip: 'The more plants between the two, the more damage.' },
        toxic:   { n: 'Airborne Toxic Drop', e: '☣️', zs: ['balloon'], tac: 'toxic',
            what: 'A green spore cloud hangs over the landing zone for 5s: plants inside attack at only 30% speed, and your zombies there take 80% less damage.',
            how: ['Another zombie of yours must be standing within 1 tile of the landing spot.', 'Click the Balloon Zombie, then click the tile beside your ally (columns 2–7).'], tip: 'A shield zombie + cloud makes a safe pocket to chew in.' },
        phantom: { n: 'Phantom Ambush', e: '👻', zs: ['basic', 'flag', 'cone', 'bucket', 'polevault', 'screendoor', 'football', 'barrel', 'explorer', 'pianist', 'impcannon', 'tesla', 'balloon', 'gargantuar'], tac: 'phantom',
            what: 'The zombie turns into a ghost for 2.5s: shots pass through it and it dodges Dave’s strikes.',
            how: ['Place Tombstones with the Graveyard Ambush command (G).', 'Use ANY manual ability while the zombie stands next to a Tombstone (within 1 tile, same or adjacent lane).'], tip: 'Every zombie can do this — it’s a free bonus on top of its own ability.' },
        thermal: { n: 'Thermal Shockwave', e: '♨️', zs: ['explorer', 'impcannon', 'barrel'], tac: 'thermal',
            what: 'Fire meets impact: a steam explosion hits a 3×3 area for 400 damage (Wall-nuts take even more) and stuns the plants for 3s.',
            how: ['Light something with the Explorer (Wildfire Toss, or burn a plant).', 'Within 3 seconds land an impact nearby: an Imp Cannon drop or a Barrel Roller kick — or have the Explorer stand next to the impact.'], tip: 'The order doesn’t matter — fire first or impact first.' }
    };
    const SYN_ORDER = ['blitz', 'phalanx', 'faraday', 'toxic', 'phantom', 'thermal'];

    const MAN = {
        zab:    { n: 'Zombie Abilities', e: '⚡', cost: 'Varies (💀)', cd: 'Varies', key: 'Click the zombie  ·  1–5 + Space',
            what: 'Every zombie has a special move you trigger yourself. Click the zombie (or press 1–5 for the front zombie of a lane, then Space).',
            how: ['Watch the small ring under each zombie: green = ready, yellow = recharging, red = not enough 💀 Dread.', 'Some abilities fire instantly. Others ask for a lane (click above/below or press W / S) or a tile (click the lawn).', 'Esc or right-click cancels.'],
            tip: 'Dread (💀) fills as your zombies take damage and breach lanes. Spend it, don’t hoard it.' },
        fog:    { n: 'Necrotic Fog', e: '🌫️', cost: '30 💀', cd: '15 s', key: 'F',
            what: 'A cold fog for 6 seconds. Zombies in the right half of the lawn take 60% less damage (Torchwood lanes still burn them), and you may raise zombies as far forward as column 5 in every lane.',
            how: ['Press F or the Necrotic Fog button.', 'Raise zombies up front while the fog lasts, then push through.'], tip: 'Use it right when a big wave hits the plant line.' },
        grave:  { n: 'Graveyard Ambush', e: '🪦', cost: '35 💀', cd: '18 s', key: 'G',
            what: 'Raise two Tombstones (350 HP each) on empty tiles in columns 4–8. They block shots and enable the Phantom Ambush synergy.',
            how: ['Press G, then click two empty tiles.', 'Stand a zombie next to one and use its manual ability.'], tip: 'Put one tombstone in the lane you want to break.' },
        bungee: { n: 'Bungee Reposition', e: '🪝', cost: '40 💀', cd: '20 s', key: 'B',
            what: 'Snatch one zombie and drop it on a free tile up to 3 tiles away — over walls, into a weaker lane, or out of a Cherry Bomb’s blast.',
            how: ['Press B and click the zombie.', 'Then click an empty tile within 3 tiles.'], tip: 'Rescue a valuable zombie from a telegraphed strike.' },
        finish: { n: 'Finish Now', e: '🏆', cost: 'Free', cd: '—', key: 'Button appears after 3 lanes',
            what: 'After breaching 3 lanes the Finish Now button appears. Pressing it ends the battle immediately with a win and your stars so far.',
            how: ['Breach 3 of the 5 lanes.', 'Keep pushing for all 5 lanes (3rd star) or press Finish Now to bank the win.'], tip: 'The 3rd star needs all 5 lanes AND 3 synergies.' }
    };
    const MAN_ORDER = ['zab', 'fog', 'grave', 'bungee', 'finish'];

    const DAVE = [
        { n: 'I', who: 'Rookie Dave', add: 'Blover', adds: ['blover'], say: 'Plants Sunflowers, answers each zombie it can see with a matching plant (Peashooters vs Cones, Tall-nuts vs Pole Vaulters…) and rebuilds lost walls. Slow to react.', acts: 1 },
        { n: 'II', who: 'Gardener Dave', add: 'Iceberg Lettuce · Power Lily', adds: ['iceberglettuce', 'powerlily'], say: 'Freezes a lane about to break, makes extra Plant Food with Power Lily, and sees zombies from further away.', acts: 1 },
        { n: 'III', who: 'Tactician Dave', add: 'Cherry Bomb · Gravebuster', adds: ['cherrybomb', 'gravebuster'], say: 'Takes 2 actions per think. Drops telegraphed Cherry Bombs on clusters, destroys your Tombstones with Gravebusters, and pre-plants counters to whatever you keep raising.', acts: 2 },
        { n: 'IV', who: 'Pyro Dave', add: 'Jalapeño', adds: ['jalapeno'], say: 'Burns whole lanes (450 damage, 1.2s warning), leads his strikes to where your zombies WILL be, and waits when a ready Pianist could dodge.', acts: 2 },
        { n: 'V', who: 'Bomber Dave', add: 'Thymewarp · Cob Cannon firing', adds: ['thymewarp', 'coconutcannon'], say: 'Rewinds a collapsing lane with Thymewarp (throws zombies back, heals plants) and fires Cob Cannons down busy lanes.', acts: 2 },
        { n: 'VI', who: 'Master Dave', add: 'Primal Potato Mine', adds: ['primalpotatomine'], say: '3 actions per think and nearly twice the thinking speed of Level I. Mines ambush your rushers (Vaulters, All-Stars, Barrels, Gargantuars).', acts: 3 },
        { n: 'VII', who: 'Crazy Dave', add: 'Everything · 4 Plant Food', adds: [], say: 'Holds up to 4 Plant Foods and gets a new one every ~10 seconds. Reacts almost instantly to your abilities. The ultimate test — and the Mega-Bot waits in the final stage.', acts: 3 }
    ];
    DAVE.forEach((d, i) => { const t = i + 1; d.think = +(3.5 - (t - 1) * 0.35).toFixed(2); d.cd = Math.round((1 - t * 0.05) * 100); d.sun = 25 * (t - 1); d.filler = [0, 3, 6, 10, 14, 18, 24][i]; d.food0 = [1, 1, 1, 2, 2, 2, 3][i]; d.foodEvery = +(30 - t * 2.8).toFixed(1); d.cap = 3 + (t >= 6 ? 1 : 0); });
    const DNAME = { snowpea: ['❄️', 'Snow Pea'], cactus: ['🌵', 'Cactus'], blover: ['🍀', 'Blover'], powerlily: ['🪷', 'Power Lily'], gravebuster: ['⚰️', 'Gravebuster'], primalpotatomine: ['🥔', 'Primal Potato Mine'], thymewarp: ['⏳', 'Thymewarp'], magnetshroom: ['🧲', 'Magnet-shroom'], jalapeno: ['🌶️', 'Jalapeño'], iceberglettuce: ['🧊', 'Iceberg Lettuce'], wintermelon: ['🧊', 'Winter Melon'], cherrybomb: ['🍒', 'Cherry Bomb'], coconutcannon: ['🥥', 'Cob Cannon'], food: ['🌿', 'Plant Food'] };

    // tactics: id -> { t, z (related zombies), goal, steps, tip }
    const TAC = {
        lunge:   { t: 'Lunge past the wall', z: ['basic'], goal: 'Skip a defender and reach the soft plant behind it.', steps: ['Walk the Basic up to a Wall-nut.', 'Click it → Lunge & Feint (10💀).', 'It jumps one plant ahead and bites at double speed.'], tip: 'The lunge also dodges peas in flight.' },
        swarm:   { t: 'Move as a pack', z: ['basic'], goal: 'Arrive faster by staying close together.', steps: ['Raise Basics side by side.', 'Each neighbor within 1 tile gives +15% speed (max +45%).'], tip: 'A lone Basic is a snack; three are a stampede.' },
        'mine-bait': { t: 'Bait the Potato Mine', z: ['basic'], goal: 'Trade a cheap zombie for a mine so the expensive ones survive.', steps: ['Send a 25🧠 Basic first.', 'The mine explodes on it.', 'Your bigger zombie walks through safely.'], tip: 'Cone Toss can also disarm mines for free.' },
        'rally-chill': { t: 'Rally Cry cleanse', z: ['flag'], goal: 'Cancel Snow Pea slows and shield the squad.', steps: ['Snow Peas chill your zombies.', 'Click the Flag Zombie → Rally Cry (20💀).', 'Chill is cleared, +120 shield and a speed burst.'], tip: 'Perfect against Frostbite Trench (stage 37).' },
        blitz:   { t: 'Blitzkrieg combo', z: ['flag', 'football', 'gargantuar'], goal: 'Make a heavy zombie unstoppable.', steps: ['Put a Flag beside an All-Star or Gargantuar.', 'Slow arrives from Dave’s plants.', 'Rally Cry → Blitzkrieg: ignores slow, +50% damage.'], tip: 'Watch for the ⚡ SYNERGY banner.' },
        banner:  { t: 'Banner in the middle', z: ['flag'], goal: 'Speed up the whole group with the passive banner.', steps: ['Keep the Flag in the centre of your squad.', 'Zombies in its 3×3 area get +20% speed.'], tip: 'Flag Zombies are fast — don’t let them out-run the group.' },
        disarm:  { t: 'Cone Toss disarm', z: ['cone'], goal: 'Disable a Potato Mine without losing a zombie.', steps: ['Walk the Conehead near a Potato Mine.', 'Click it → Cone Toss (15💀, once per life).', 'The mine is disarmed and the plant stunned.'], tip: 'Needs 50+ cone left.' },
        'stun-window': { t: 'Stun window', z: ['cone'], goal: 'Silence a shooter for 2.5 seconds.', steps: ['Toss the cone at the lane’s Peashooter.', 'It is stunned and stops firing.', 'Rush the pack in during the window.'], tip: 'Strongest on the plant doing the most damage.' },
        phalanx: { t: 'Phalanx Shuffle', z: ['pianist', 'cone', 'bucket', 'screendoor', 'football'], goal: 'Move an armored squad between lanes safely.', steps: ['Keep a Pianist plus 2 armored zombies together.', 'Click the Pianist → Tempo Shift, choose a lane.', 'They glide together and take 60% less damage.'], tip: 'Use it to dodge strikes or switch to a weaker lane.' },
        brace:   { t: 'Ironclad Brace', z: ['bucket'], goal: 'Soak a volley, then punish.', steps: ['Walk the Buckethead into the shooters.', 'Click it → Brace (20💀): −75% damage for 3s.', 'It ends with a slam on nearby plants.'], tip: 'Others walk behind while it tanks.' },
        'emp-magnet': { t: 'EMP before the Magnet', z: ['bucket', 'tesla'], goal: 'Keep metal armor from being stripped.', steps: ['Dave’s Magnet-shroom pulls off Bucket/metal.', 'Tesla’s EMP switches the Magnet-shroom off.', 'Your armored zombie walks past untouched.'], tip: 'EMP also stuns the plants for 3.5s.' },
        assassin: { t: 'Sunflower assassin', z: ['polevault'], goal: 'Cut Dave’s economy by killing Sunflowers.', steps: ['Walk the Vaulter toward a Tall-nut.', 'Click it → Lane-Hop (15💀) and pick another lane.', 'It leaps past everything and lands beside the Sunflower.'], tip: 'Tall-nuts normally stop vaulters. Not anymore.' },
        'double-jump': { t: 'Two jumps', z: ['polevault'], goal: 'Hurdle two obstacles in one run.', steps: ['Let the Vaulter do its natural vault over the first plant.', 'Save Lane-Hop for the next wall.', 'Two obstacles cleared.'], tip: 'The natural vault wastes nothing — free.' },
        faraday: { t: 'Faraday Conduit', z: ['tesla', 'polevault', 'impcannon'], goal: 'Electrocute everything between two zombies.', steps: ['Line up a Pole Vaulter (or dropped Imp) behind the Tesla.', 'Click Tesla → EMP Short-Circuit.', 'An arc crackles between them for 4s.'], tip: 'Plants stay stunned while arcs run.' },
        phantom: { t: 'Tombstone ghost', z: ['basic', 'polevault'], goal: 'Dodge enemy fire during your ability.', steps: ['Place a Tombstone (G).', 'Stand next to it and use any ability.', 'The zombie turns ghost for 2.5s — peas pass right through.'], tip: 'Every zombie qualifies.' },
        'reflect-torch': { t: 'Reflect the fire', z: ['screendoor'], goal: 'Turn Dave’s Torchwood shots on his own plants.', steps: ['Torchwood ignites the peas.', 'Click Screen Door → Prism Overcharge (20💀).', 'The flaming peas bounce back at 1.5× damage.'], tip: 'Best in stage 36 (Torchwood Killzone).' },
        'shield-lead': { t: 'Shield the line', z: ['screendoor'], goal: 'Let one tank block every straight pea.', steps: ['Lead with a Screen Door.', 'Put fragile zombies right behind it.', 'The 900-HP shield blocks straight shots.'], tip: 'Lobbed shots (melons) still fly over it.' },
        audible: { t: 'Audible crush', z: ['football'], goal: 'Crush a Wall-nut in a single run.', steps: ['The All-Star charges for 350 burst damage.', 'Click it → Blitz Audible (25💀) to reset.', 'The next hit crushes the Wall-nut for 500.'], tip: 'Time it within 2s of impact.' },
        'kick-imps': { t: 'Bowling kick', z: ['barrel'], goal: 'Smash a wall and drop Imps behind it.', steps: ['Walk the Barrel Roller close.', 'Click it → Bowling Kick (20💀).', 'The barrel rolls and hits for 450, stunning a 1×3 area; 2 Imps pop out.'], tip: 'The barrel breaks free from the zombie.' },
        'cover-roll': { t: 'Barrel as cover', z: ['barrel'], goal: 'Absorb shots, then split into Imps.', steps: ['Walk forward with the 600-HP barrel.', 'Straight shots hit the barrel, not the zombie.', 'When it breaks, 2 Imps jump into adjacent lanes.'], tip: 'Spikeweeds are crushed by it.' },
        thermal: { t: 'Thermal Shockwave', z: ['explorer', 'impcannon', 'barrel'], goal: 'Combine fire and impact for a big blast.', steps: ['Explorer lights a fire.', 'Within 3s a barrel or Imp lands nearby.', '♨️ A 3×3 steam explosion stuns plants.'], tip: 'Great vs Melon-pults and Chompers.' },
        'burn-lane': { t: 'Burn the lane', z: ['explorer'], goal: 'Clear mines and spikes ahead of your squad.', steps: ['Click Explorer → Wildfire Toss (25💀).', 'The fire zone burns Potato Mines and Spikeweeds.', 'Zombies behind it walk on safely.'], tip: 'Also re-lights the torch.' },
        extinguish: { t: 'Dodge the ice', z: ['explorer'], goal: 'Keep the torch lit.', steps: ['Snow Peas and Iceberg Lettuce put the torch out.', 'Kill or avoid Snow Peas first.', 'Relight with Wildfire Toss.'], tip: 'No torch = no burning.' },
        'dodge-cherry': { t: 'Sidestep the Cherry Bomb', z: ['pianist'], goal: 'Save the squad from Dave’s strike.', steps: ['A red warning appears for 1.2s.', 'Click Pianist → Tempo Shift (25💀).', 'The whole squad slides to a safe lane.'], tip: 'Don’t clump when there’s a red warning!' },
        garlic:  { t: 'Beat the Garlic', z: ['pianist'], goal: 'Keep your lane when Garlic tries to divert you.', steps: ['A Garlic pushes zombies into other lanes.', 'Tempo Shift locks their lane for 6s.', 'The squad keeps going straight.'], tip: 'Stage 40’s signature trick.' },
        'eject-back': { t: 'Precision Eject', z: ['impcannon'], goal: 'Strike plants behind the walls.', steps: ['Click Imp Cannon → Precision Eject (20💀).', 'Click any tile — even behind a Tall-nut.', 'A parachute Imp lands and starts chewing.'], tip: 'Ideal for Melon-pults and Sunflowers.' },
        absorb:  { t: 'Absorb the lightning', z: ['tesla'], goal: 'Convert electric damage into Dread.', steps: ['Dave’s Lightning Reeds fire.', 'The Tesla absorbs half and turns it into 💀.', 'You get stronger when attacked.'], tip: 'Use the extra Dread for more abilities.' },
        'fly-over': { t: 'Fly over the traps', z: ['balloon'], goal: 'Ignore ground defenses.', steps: ['The balloon floats over Potato Mines.', 'Straight peas can’t hit it.', 'Click it → Tactical Drop and choose a tile.'], tip: 'Dave answers with Cactus and Blover.' },
        toxic:   { t: 'Toxic cloud', z: ['balloon'], goal: 'Slow Dave’s plants around your squad.', steps: ['Keep an ally within 1 tile of the landing tile.', 'Click Balloon → Tactical Drop beside them.', 'A cloud slows plants to 30% for 5s.'], tip: 'Then push the ally in.' },
        blowback: { t: 'Gust of air', z: ['balloon'], goal: 'Wipe incoming peas.', steps: ['The drop creates a gust.', 'Straight shots in that area vanish.', 'The plant under you is stunned for 1.5s.'], tip: 'The Hot Air module widens it.' },
        'slam-spike': { t: 'Fissure slam', z: ['gargantuar'], goal: 'Uproot spikes and crush the line.', steps: ['Walk the Gargantuar up to Spikerock.', 'Click it → Seismic Slam (35💀).', 'A fissure 3 tiles ahead hits 600 / 250 / 250 and uproots traps.'], tip: 'Plants are launched for 1.5s.' },
        'imp-throw': { t: 'Imp artillery', z: ['gargantuar'], goal: 'Get the second body behind the wall.', steps: ['Below 50% HP the Gargantuar throws its Imp.', 'The Imp lands behind the walls.', 'Two threats for one price.'], tip: 'Don’t waste Slams — let it throw first.' }
    };
    const ZTAC = {
        basic: ['lunge', 'swarm', 'mine-bait', 'phantom'], flag: ['rally-chill', 'blitz', 'banner'], cone: ['disarm', 'stun-window', 'phalanx'],
        bucket: ['brace', 'emp-magnet', 'phalanx'], polevault: ['assassin', 'double-jump', 'faraday', 'phantom'], screendoor: ['reflect-torch', 'shield-lead', 'phalanx'],
        football: ['audible', 'blitz', 'phalanx'], barrel: ['kick-imps', 'cover-roll', 'thermal'], explorer: ['burn-lane', 'thermal', 'extinguish'],
        pianist: ['dodge-cherry', 'garlic', 'phalanx'], impcannon: ['eject-back', 'thermal', 'faraday'], tesla: ['emp-magnet', 'faraday', 'absorb'],
        balloon: ['fly-over', 'toxic', 'blowback'], gargantuar: ['slam-spike', 'imp-throw', 'blitz']
    };
    TAC.phantom.t = 'Tombstone ghost';

    // ---- demo scenes: rows, steps [[ms, caption, op...]] ; ops: add mv rm die em badge hp flash float shot fx shake
    const sc = (rows, steps) => ({ rows, steps });
    const SCENES = {
        lunge: () => sc(3, [
            [0, 'A Basic walks toward a Wall-nut guarding a Peashooter.', ['add', 'ps', PE('peashooter'), 1, 1], ['add', 'wn', PE('wallnut'), 1, 3], ['add', 'z', ZE('basic'), 1, 7], ['mv', 'z', 4, 1, 1600]],
            [1700, 'Click it → Lunge & Feint (10💀).', ['float', 1, 4, '⚡ Lunge', 'gold'], ['badge', 'z', '💨'], ['mv', 'z', 2, 1, 350, 1]],
            [2200, 'It lands past the Wall-nut and bites the Peashooter at double speed!', ['hp', 'ps', 100], ['flash', 'ps'], ['hp', 'ps', 45]],
            [3200, '', ['flash', 'ps'], ['die', 'ps'], ['float', 1, 1, '+🧠', 'small']]
        ]),
        swarm: () => sc(3, [
            [0, 'Top lane: one lonely Basic. Bottom lane: a pack of three.', ['add', 'w0', PE('wallnut'), 0, 1], ['add', 'w2', PE('wallnut'), 2, 1], ['add', 'a', ZE('basic'), 0, 7], ['add', 'b1', ZE('basic'), 2, 7], ['add', 'b2', ZE('basic'), 2, 6], ['add', 'b3', ZE('basic'), 2, 5], ['badge', 'b2', '+45%']],
            [300, 'Neighbors boost each other’s speed.', ['mv', 'a', 2, 0, 4200], ['mv', 'b1', 2, 2, 3000], ['mv', 'b2', 2, 2, 2700], ['mv', 'b3', 2, 2, 2400]],
            [3200, 'The pack reaches the Wall-nut first.', ['float', 2, 2, '🏁 pack wins', 'gold'], ['hp', 'w2', 100], ['hp', 'w2', 30]]
        ]),
        'mine-bait': () => sc(3, [
            [0, 'A Potato Mine waits in front of a Peashooter.', ['add', 'ps', PE('peashooter'), 1, 1], ['add', 'pm', PE('potatomine'), 1, 3], ['add', 'a', ZE('basic'), 1, 7], ['add', 'b', ZE('bucket'), 1, 7.9], ['mv', 'a', 3.4, 1, 1900], ['mv', 'b', 5, 1, 1900]],
            [2000, 'Cheap Basic goes first and sets it off.', ['fx', 'boomb', 0, 2, 2, 4, 700], ['die', 'a'], ['die', 'pm'], ['shake']],
            [2800, 'The Buckethead walks through untouched.', ['mv', 'b', 1.9, 1, 1400]]
        ]),
        'rally-chill': () => sc(3, [
            [0, 'A Snow Pea chills the squad.', ['add', 'sp', PE('snowpea'), 1, 1], ['add', 'f', ZE('flag'), 1, 6], ['add', 'z', ZE('basic'), 1, 5], ['mv', 'z', 4.6, 1, 2500], ['shot', 1, 1.6, 4.6, '❄️', 700]],
            [800, '', ['badge', 'z', '🥶'], ['badge', 'f', '🥶']],
            [1800, 'Click the Flag → Rally Cry (20💀).', ['float', 1, 6, '⚡ Rally Cry', 'gold'], ['fx', 'rally', 0, 4, 2, 7, 800]],
            [2000, 'Chill gone, shield on, speed up!', ['badge', 'z', '🛡️'], ['badge', 'f', '🛡️'], ['mv', 'z', 2.4, 1, 1400], ['mv', 'f', 3.4, 1, 1400]]
        ]),
        blitz: () => sc(3, [
            [0, 'An All-Star and a Flag Zombie walk side by side into Snow Pea fire.', ['add', 'sp', PE('snowpea'), 1, 0], ['add', 'wn', PE('wallnut'), 1, 2], ['add', 'fb', ZE('football'), 1, 6], ['add', 'f', ZE('flag'), 1, 7], ['mv', 'fb', 4.6, 1, 2000], ['mv', 'f', 5.6, 1, 2000], ['shot', 1, 0.7, 4.6, '❄️', 700], ['badge', 'fb', '🥶']],
            [2100, 'Click the Flag → Rally Cry!', ['float', 1, 5, '⚡ BLITZKRIEG VANGUARD', 'syn'], ['fx', 'rally', 0, 4, 2, 7, 800], ['badge', 'fb', '💪']],
            [2400, 'Unstoppable + 50% damage — it crushes the Wall-nut.', ['mv', 'fb', 2.5, 1, 800], ['mv', 'f', 3.5, 1, 800]],
            [3300, '', ['hp', 'wn', 100], ['hp', 'wn', 0], ['die', 'wn'], ['shake']]
        ]),
        banner: () => sc(3, [
            [0, 'The Flag Zombie stands in the middle of three zombies.', ['add', 'a', ZE('basic'), 0, 6], ['add', 'f', ZE('flag'), 1, 6], ['add', 'b', ZE('basic'), 2, 6], ['fx', 'rally', 0, 5, 2, 7, 1400], ['badge', 'a', '+20%'], ['badge', 'b', '+20%']],
            [400, 'Everyone in its 3×3 area moves 20% faster.', ['mv', 'a', 2, 0, 2400], ['mv', 'f', 2, 1, 2400], ['mv', 'b', 2, 2, 2400]]
        ]),
        disarm: () => sc(3, [
            [0, 'A Potato Mine lies ahead of the Conehead.', ['add', 'pm', PE('potatomine'), 1, 3], ['add', 'ps', PE('peashooter'), 1, 1], ['add', 'z', ZE('cone'), 1, 7], ['mv', 'z', 5.5, 1, 1400]],
            [1500, 'Click it → Cone Toss (15💀).', ['float', 1, 5, '⚡ Cone Toss', 'gold'], ['shot', 1, 5.5, 3, '🔶', 500]],
            [2100, 'The mine is disarmed (and the plant stunned).', ['badge', 'pm', '💤'], ['fx', 'emp', 1, 2.6, 1, 3.4, 600]],
            [2800, 'Now the squad walks over it for free.', ['add', 'b', ZE('basic'), 1, 7], ['mv', 'b', 2.6, 1, 1600]]
        ]),
        'stun-window': () => sc(3, [
            [0, 'A Peashooter holds the lane.', ['add', 'ps', PE('peashooter'), 1, 1], ['add', 'z', ZE('cone'), 1, 7], ['add', 'b1', ZE('basic'), 1, 7.9], ['add', 'b2', ZE('basic'), 0, 7], ['mv', 'z', 5, 1, 1000], ['shot', 1, 1.6, 4.6, '🟢', 600]],
            [1100, 'Cone Toss stuns it for 2.5 seconds.', ['float', 1, 5, '⚡ Cone Toss', 'gold'], ['shot', 1, 5, 1.6, '🔶', 500], ['badge', 'ps', '💫']],
            [1700, 'No peas — the pack rushes in during the window!', ['mv', 'b1', 2, 1, 1500], ['mv', 'b2', 2, 0, 1500], ['mv', 'z', 3.3, 1, 1500]]
        ]),
        phalanx: () => sc(3, [
            [0, 'A Pianist, Conehead and Buckethead advance together in lane 1.', ['add', 'ps', PE('peashooter'), 1, 1], ['add', 'p', ZE('pianist'), 1, 7], ['add', 'c', ZE('cone'), 1, 6], ['add', 'b', ZE('bucket'), 1, 5], ['mv', 'p', 5.6, 1, 1500], ['mv', 'c', 4.6, 1, 1500], ['mv', 'b', 3.6, 1, 1500]],
            [1600, 'Click the Pianist → Tempo Shift, lane below.', ['float', 1, 5, '⚡ PHALANX SHUFFLE', 'syn'], ['mv', 'p', 5.6, 2, 300], ['mv', 'c', 4.6, 2, 300], ['mv', 'b', 3.6, 2, 300], ['badge', 'b', '🛡️-60%'], ['badge', 'c', '🛡️-60%']],
            [2200, 'They slide together and shrug off 60% of the damage.', ['shot', 2, 1.6, 3.6, '🟢', 500], ['float', 2, 3.6, '-60%', 'small']]
        ]),
        brace: () => sc(3, [
            [0, 'Two Peashooters shoot at an approaching Buckethead.', ['add', 'p1', PE('peashooter'), 1, 1], ['add', 'p2', PE('peashooter'), 1, 2], ['add', 'z', ZE('bucket'), 1, 7], ['mv', 'z', 4.6, 1, 1800], ['shot', 1, 2.6, 4.6, '🟢', 600]],
            [1900, 'Click it → Ironclad Brace (20💀). It plants its feet.', ['float', 1, 4.6, '⚡ Brace', 'gold'], ['badge', 'z', '🛡️-75%'], ['shot', 1, 2.6, 4.6, '🟢', 500]],
            [2800, 'Shots barely scratch it… then it slams the plants nearby.', ['fx', 'quake', 0, 2.4, 2, 4.6, 700], ['shake'], ['hp', 'p2', 100], ['hp', 'p2', 20]]
        ]),
        'emp-magnet': () => sc(3, [
            [0, 'Dave’s Magnet-shroom waits to rip off metal armor.', ['add', 'm', PE('magnetshroom'), 0, 3], ['add', 'b', ZE('bucket'), 1, 7], ['add', 't', ZE('tesla'), 1, 7.9], ['mv', 'b', 5.2, 1, 1500], ['mv', 't', 6.2, 1, 1500]],
            [1600, 'Tesla Saboteur → EMP Short-Circuit (30💀).', ['float', 1, 6.2, '⚡ EMP', 'gold'], ['fx', 'emp', 0, 2.2, 1, 4.8, 700]],
            [2200, 'The Magnet-shroom is switched off.', ['badge', 'm', '💤']],
            [2700, 'The Buckethead keeps its armor and walks on.', ['mv', 'b', 2.4, 1, 1700], ['badge', 'b', '🪣✔']]
        ]),
        assassin: () => sc(3, [
            [0, 'A Tall-nut blocks the lane to a Sunflower.', ['add', 'sf', PE('sunflower'), 0, 0], ['add', 'tn', PE('tallnut'), 1, 2], ['add', 'z', ZE('polevault'), 1, 7], ['mv', 'z', 3.4, 1, 1700]],
            [1800, 'Click it → Lane-Hop (15💀), lane above.', ['float', 1, 3.4, '⚡ Lane-Hop', 'gold'], ['mv', 'z', 1.2, 0, 420, 1]],
            [2300, 'It clears the Tall-nut and lands beside the Sunflower.', ['flash', 'sf'], ['hp', 'sf', 100], ['hp', 'sf', 30]],
            [3200, 'Dave’s sun income drops.', ['die', 'sf'], ['float', 0, 0.6, '☀️−', 'red']]
        ]),
        'double-jump': () => sc(3, [
            [0, 'Two walls ahead: a Wall-nut and a Tall-nut.', ['add', 'tn', PE('tallnut'), 1, 2], ['add', 'wn', PE('wallnut'), 1, 4], ['add', 'sf', PE('sunflower'), 1, 0], ['add', 'z', ZE('polevault'), 1, 7], ['mv', 'z', 4.7, 1, 1500]],
            [1600, 'It vaults the Wall-nut by itself (free).', ['mv', 'z', 3.3, 1, 350, 1], ['float', 1, 4, 'free vault', 'small']],
            [2300, 'Then Lane-Hop over the Tall-nut.', ['mv', 'z', 3, 1, 500], ['float', 1, 3, '⚡ Lane-Hop', 'gold'], ['mv', 'z', 1.3, 1, 420, 1]],
            [3000, 'Both walls skipped.', ['flash', 'sf']]
        ]),
        faraday: () => sc(3, [
            [0, 'A Pole Vaulter walks behind a Tesla Saboteur, with Dave’s plants in between.', ['add', 'wn', PE('wallnut'), 1, 2], ['add', 'ps', PE('peashooter'), 1, 3], ['add', 't', ZE('tesla'), 1, 7], ['add', 'v', ZE('polevault'), 1, 4.9]],
            [900, 'Tesla → EMP Short-Circuit (30💀).', ['float', 1, 6, '⚡ FARADAY CONDUIT', 'syn'], ['fx', 'emp', 0, 3.5, 2, 5.6, 700]],
            [1600, 'An arc links the two zombies and zaps everything in between.', ['fx', 'arc', 1, 4.9, 1, 7, 2200], ['flash', 'wn'], ['flash', 'ps'], ['badge', 'ps', '💫'], ['hp', 'ps', 100], ['hp', 'ps', 35]]
        ]),
        phantom: () => sc(3, [
            [0, 'You raised a Tombstone beside a Pole Vaulter.', ['add', 'tb', '🪦', 1, 5.4], ['add', 'z', ZE('polevault'), 1, 6.2], ['add', 'ps', PE('peashooter'), 1, 1], ['shot', 1, 1.6, 6, '🟢', 900]],
            [800, 'It uses an ability next to the grave…', ['float', 1, 6, '⚡ PHANTOM AMBUSH', 'syn'], ['badge', 'z', '👻'], ['em', 'z', '👻']],
            [1400, '…and turns ghost: peas pass straight through!', ['shot', 1, 1.6, 6.4, '🟢', 700], ['float', 1, 6, 'miss', 'small'], ['mv', 'z', 2.4, 1, 1400]]
        ]),
        'reflect-torch': () => sc(3, [
            [0, 'Dave’s Torchwood sets his own peas ablaze.', ['add', 'ps', PE('peashooter'), 1, 0], ['add', 'tw', PE('torchwood'), 1, 1], ['add', 'z', ZE('screendoor'), 1, 6], ['shot', 1, 0.8, 5.6, '🔥', 800]],
            [900, 'Click it → Prism Overcharge (20💀).', ['float', 1, 6, '⚡ Prism', 'gold'], ['badge', 'z', '🔮']],
            [1300, 'The flaming peas bounce back at 1.5× damage…', ['shot', 1, 5.6, 0.8, '🔥', 450]],
            [1900, '…and burn Dave’s own plants.', ['flash', 'tw'], ['flash', 'ps'], ['hp', 'ps', 100], ['hp', 'ps', 15], ['die', 'ps']]
        ]),
        'shield-lead': () => sc(3, [
            [0, 'A Screen Door leads; fragile zombies follow right behind.', ['add', 'p', PE('peashooter'), 1, 0], ['add', 'q', PE('peashooter'), 1, 1], ['add', 'z', ZE('screendoor'), 1, 5], ['add', 'a', ZE('basic'), 1, 6], ['add', 'b', ZE('pianist'), 1, 7]],
            [500, 'Straight peas hit the 900-HP shield, not them.', ['shot', 1, 1.6, 4.6, '🟢', 600], ['float', 1, 4.7, 'blocked', 'small'], ['hp', 'z', 100], ['hp', 'z', 80]],
            [1300, '', ['shot', 1, 1.6, 4.6, '🟢', 600], ['shot', 1, 0.6, 4.6, '🟢', 600], ['hp', 'z', 60]]
        ]),
        audible: () => sc(3, [
            [0, 'The All-Star sprints at the Wall-nut.', ['add', 'wn', PE('wallnut'), 1, 2], ['add', 'z', ZE('football'), 1, 7], ['mv', 'z', 2.9, 1, 1500], ['badge', 'z', '💨']],
            [1600, 'Tackle! 350 burst damage…', ['hp', 'wn', 100], ['hp', 'wn', 55], ['shake']],
            [2000, 'Click it → Blitz Audible (25💀): charge resets.', ['float', 1, 3, '⚡ Audible', 'gold'], ['badge', 'z', '🏈']],
            [2500, 'The next hit crushes it for 500!', ['hp', 'wn', 0], ['die', 'wn'], ['shake']]
        ]),
        'kick-imps': () => sc(3, [
            [0, 'A Barrel Roller faces a Wall-nut line.', ['add', 'wn', PE('wallnut'), 1, 2], ['add', 'ps', PE('peashooter'), 1, 1], ['add', 'z', ZE('barrel'), 1, 6.4]],
            [700, 'Click it → Bowling Kick (20💀).', ['float', 1, 6, '⚡ Bowling Kick', 'gold'], ['add', 'br', '🛢️', 1, 6], ['mv', 'br', 2.6, 1, 900]],
            [1700, 'The barrel hits for 450 and stuns a 1×3 area.', ['fx', 'quake', 0, 1.6, 2, 3.2, 700], ['rm', 'br'], ['flash', 'wn'], ['hp', 'wn', 100], ['hp', 'wn', 60], ['badge', 'ps', '💫'], ['shake']],
            [2400, 'Two Imps pop out on the impact tile!', ['add', 'i1', ZE('basic').replace('🧟', '👶'), 0, 2.8], ['add', 'i2', '👶', 2, 2.8]]
        ]),
        'cover-roll': () => sc(3, [
            [0, 'The 600-HP barrel soaks up straight shots.', ['add', 'ps', PE('peashooter'), 1, 1], ['add', 'z', '🛢️', 1, 6], ['mv', 'z', 4.5, 1, 1600], ['shot', 1, 1.6, 4.5, '🟢', 600], ['hp', 'z', 100], ['hp', 'z', 40]],
            [1700, 'It breaks — and two Imps jump into the neighboring lanes.', ['em', 'z', ZE('basic')], ['add', 'i1', '👶', 0, 4.3], ['add', 'i2', '👶', 2, 4.3], ['mv', 'i1', 2, 0, 900], ['mv', 'i2', 2, 2, 900], ['float', 1, 4.5, '💥', 'small']]
        ]),
        thermal: () => sc(3, [
            [0, 'The Explorer lights a fire ahead of the squad.', ['add', 'wn', PE('wallnut'), 1, 3], ['add', 'mp', PE('melonpult'), 0, 3], ['add', 'x', ZE('explorer'), 1, 6.8], ['shot', 1, 6.5, 4.2, '🔥', 500], ['fx', 'fire', 1, 3.6, 1, 4.8, 900]],
            [900, 'Within 3 seconds an Imp Cannon drops an Imp nearby.', ['add', 'c', ZE('impcannon'), 2, 7.2], ['add', 'imp', '👶', 1, 3.6]],
            [1700, '♨️ THERMAL SHOCKWAVE: 3×3 steam blast.', ['float', 1, 3.6, '⚡ THERMAL SHOCKWAVE', 'syn'], ['fx', 'steam', 0, 2.4, 2, 4.8, 900], ['flash', 'wn'], ['flash', 'mp'], ['badge', 'wn', '💫'], ['badge', 'mp', '💫'], ['hp', 'wn', 100], ['hp', 'wn', 45], ['shake']]
        ]),
        'burn-lane': () => sc(3, [
            [0, 'A Potato Mine and Spikeweed block the lane.', ['add', 'sk', PE('spikeweed'), 1, 2], ['add', 'pm', PE('potatomine'), 1, 3], ['add', 'z', ZE('explorer'), 1, 7], ['add', 'b', ZE('bucket'), 1, 7.9], ['mv', 'z', 5.6, 1, 1200]],
            [1300, 'Click it → Wildfire Toss (25💀).', ['float', 1, 5.6, '⚡ Wildfire', 'gold'], ['shot', 1, 5.6, 3, '🔥', 500], ['fx', 'fire', 1, 2, 1, 3.9, 1400]],
            [2000, 'Both traps burn away.', ['die', 'sk'], ['die', 'pm']],
            [2500, 'The squad strolls through.', ['mv', 'b', 2, 1, 1500]]
        ]),
        extinguish: () => sc(3, [
            [0, 'A Snow Pea ahead of the burning Explorer.', ['add', 'sp', PE('snowpea'), 1, 1], ['add', 'z', ZE('explorer'), 1, 6], ['badge', 'z', '🔥'], ['mv', 'z', 4.6, 1, 1200]],
            [1300, 'Its frost puts the torch out — no more burning.', ['shot', 1, 1.6, 4.6, '❄️', 600], ['badge', 'z', '🧊']],
            [2200, 'Kill Snow Peas first, or relight with Wildfire Toss.', ['float', 1, 4.6, '⚡ relight', 'gold'], ['badge', 'z', '🔥']]
        ]),
        'dodge-cherry': () => sc(3, [
            [0, 'Dave arms a Cherry Bomb on a clumped squad.', ['add', 'p', ZE('pianist'), 1, 6], ['add', 'a', ZE('basic'), 1, 5.2], ['add', 'b', ZE('basic'), 1, 6.8], ['fx', 'warn', 0, 4.5, 2, 7.5, 1300], ['float', 1, 5.5, '🍒 ⚠️', 'red']],
            [500, 'Click the Pianist → Tempo Shift (25💀).', ['float', 1, 6.8, '⚡ Tempo Shift', 'gold'], ['mv', 'p', 6, 2, 300], ['mv', 'a', 5.2, 2, 300], ['mv', 'b', 6.8, 2, 300]],
            [1400, 'BOOM — on an empty lane!', ['fx', 'boomb', 0, 4.5, 1, 7.5, 700], ['shake'], ['float', 1, 6, 'miss', 'small']]
        ]),
        garlic: () => sc(3, [
            [0, 'A Garlic would push zombies into another lane.', ['add', 'g', PE('garlic'), 1, 2], ['add', 'p', ZE('pianist'), 1, 6.6], ['add', 'z', ZE('basic'), 1, 5.6], ['mv', 'p', 4.6, 1, 800], ['mv', 'z', 3.6, 1, 800]],
            [900, 'Tempo Shift locks their lane for 6s.', ['float', 1, 4.6, '⚡ lane locked', 'gold'], ['badge', 'z', '🔒']],
            [1700, 'They walk past the Garlic without diverting.', ['mv', 'z', 1.6, 1, 1200], ['float', 1, 2, '🧄 ✖', 'small']]
        ]),
        'eject-back': () => sc(3, [
            [0, 'Melon-pults hide behind a Tall-nut.', ['add', 'mp', PE('melonpult'), 1, 1], ['add', 'tn', PE('tallnut'), 1, 3], ['add', 'c', ZE('impcannon'), 1, 7]],
            [700, 'Click the Imp Cannon → Precision Eject (20💀), then click the Melon-pult’s tile.', ['float', 1, 7, '⚡ Eject', 'gold'], ['fx', 'warn', 1, 1, 1, 1, 700]],
            [1500, 'A parachute Imp lands right on it.', ['add', 'i', '👶', 1, 1.5], ['float', 1, 1, '🪂', 'small'], ['flash', 'mp']],
            [2300, 'The wall is irrelevant.', ['hp', 'mp', 100], ['hp', 'mp', 25]]
        ]),
        absorb: () => sc(3, [
            [0, 'Lightning Reeds zap the Tesla Saboteur.', ['add', 'lr', PE('lightningreed'), 1, 1], ['add', 't', ZE('tesla'), 1, 5], ['shot', 1, 1.6, 4.6, '⚡', 500]],
            [600, 'It absorbs half the electricity…', ['hp', 't', 100], ['hp', 't', 85]],
            [1100, '…and turns it into 💀 Dread.', ['float', 1, 5, '+💀 +💀', 'syn']]
        ]),
        'fly-over': () => sc(3, [
            [0, 'Mines and walls can’t touch a flying Balloon.', ['add', 'pm', PE('potatomine'), 1, 3], ['add', 'wn', PE('wallnut'), 1, 2], ['add', 'sf', PE('sunflower'), 1, 0], ['add', 'z', ZE('balloon'), 1, 7], ['mv', 'z', 4.2, 1, 1400], ['shot', 1, 1, 6, '🟢', 700]],
            [1500, 'Straight peas miss it.', ['float', 1, 4.2, 'miss', 'small']],
            [2000, 'Click it → Tactical Drop, click a tile by the Sunflower.', ['float', 1, 4, '⚡ Drop', 'gold'], ['mv', 'z', 0.9, 1, 450, 1], ['em', 'z', ZE('basic')]],
            [2600, 'It lands and stuns the plant 1.5s.', ['badge', 'sf', '💫'], ['hp', 'sf', 100], ['hp', 'sf', 50]]
        ]),
        toxic: () => sc(3, [
            [0, 'An ally waits at the edge of Dave’s range.', ['add', 'ps', PE('peashooter'), 1, 2], ['add', 'wn', PE('wallnut'), 1, 3], ['add', 'a', ZE('bucket'), 1, 4.6], ['add', 'z', ZE('balloon'), 1, 7], ['mv', 'z', 5, 1, 900]],
            [1000, 'Balloon → Tactical Drop beside the ally.', ['float', 1, 5, '⚡ AIRBORNE TOXIC DROP', 'syn'], ['mv', 'z', 4, 1, 400, 1]],
            [1500, 'A spore cloud slows Dave’s plants to 30%.', ['fx', 'spore', 0, 2.2, 2, 5, 2200], ['badge', 'ps', '🐌'], ['badge', 'wn', '🐌']],
            [2200, 'Your pocket is safe.', ['mv', 'a', 3.4, 1, 800]]
        ]),
        blowback: () => sc(3, [
            [0, 'A stream of peas flies down the lane.', ['add', 'ps', PE('peashooter'), 1, 0], ['add', 'z', ZE('balloon'), 1, 7], ['mv', 'z', 4.4, 1, 1000], ['shot', 1, 0.6, 5, '🟢', 900], ['shot', 1, 0.6, 4, '🟢', 700]],
            [1100, 'Tactical Drop — a gust blows them away.', ['float', 1, 4.4, '⚡ Drop', 'gold'], ['fx', 'gust', 0, 3.2, 2, 5.6, 700], ['mv', 'z', 4, 1, 400, 1]],
            [1700, 'No peas left; the plant is stunned.', ['badge', 'ps', '💫']]
        ]),
        'slam-spike': () => sc(3, [
            [0, 'A Spikerock and Wall-nuts stand ahead of the Gargantuar.', ['add', 'sr', PE('spikerock'), 1, 2], ['add', 'w1', PE('wallnut'), 1, 3], ['add', 'w2', PE('wallnut'), 0, 3], ['add', 'z', ZE('gargantuar'), 1, 7], ['mv', 'z', 5.8, 1, 1400]],
            [1500, 'Click it → Seismic Slam (35💀).', ['float', 1, 5.8, '⚡ SLAM', 'gold'], ['fx', 'quake', 0, 2, 2, 4.8, 800], ['shake']],
            [2100, '600 / 250 / 250 damage — the Spikerock is uprooted.', ['die', 'sr'], ['flash', 'w1'], ['flash', 'w2'], ['hp', 'w1', 100], ['hp', 'w1', 20]]
        ]),
        'imp-throw': () => sc(3, [
            [0, 'The Gargantuar is below half health.', ['add', 'sf', PE('sunflower'), 1, 0], ['add', 'tn', PE('tallnut'), 1, 2], ['add', 'z', ZE('gargantuar'), 1, 5], ['hp', 'z', 100], ['hp', 'z', 45]],
            [700, 'It hurls its Imp over the Tall-nut…', ['add', 'i', '👶', 1, 5], ['mv', 'i', 0.8, 1, 700, 1]],
            [1500, '…right behind the wall. Two threats for one price.', ['flash', 'sf'], ['hp', 'sf', 100], ['hp', 'sf', 40]]
        ])
    };

    // =====================================================================================
    //  GUIDE — demo engine
    // =====================================================================================
    let demoTimers = [], demoHost = null;
    function stopDemo() { demoTimers.forEach(clearTimeout); demoTimers = []; if (demoHost) { const l = demoHost.querySelector('.gd-lawn'); if (l) l.querySelectorAll('.gd-a,.gd-shot,.rv-box,.rv-soul').forEach(e => e.remove()); } }
    function mountDemo(host, sceneFn) {
        stopDemo(); demoHost = host; const sc0 = sceneFn(), R = sc0.rows;
        let cells = ''; for (let r = 0; r < R; r++) for (let c = 0; c < 8; c++) cells += `<i class="gd-c ${(r + c) % 2 ? 'b' : 'a'}${c >= 6 ? ' z' : ''}"></i>`;
        host.innerHTML = `<div class="gd-lawn" style="aspect-ratio:8/${(R * 0.86).toFixed(2)};--R:${R}"><div class="gd-grid" style="grid-template-rows:repeat(${R},1fr)">${cells}</div><span class="gd-zl">🧟 Your zone</span><span class="gd-pl">🌻 Dave’s plants</span></div>
          <div class="gd-cap" id="gd-cap">▶ Watch…</div>
          <div class="gd-demo-btns"><button class="rv-btn" id="gd-replay">🔁 Replay</button></div>
          <ol class="gd-steps">${sc0.steps.filter(s => s[1]).map((s, i) => `<li id="gd-s${i}">${s[1]}</li>`).join('')}</ol>`;
        const lawn = host.querySelector('.gd-lawn'), cap = host.querySelector('#gd-cap');
        const pos = (r, c) => ({ left: ((c + 0.5) / 8 * 100) + '%', top: ((r + 0.5) / R * 100) + '%' });
        const run = () => {
            stopDemo(); demoHost = host; host.querySelectorAll('.gd-steps li').forEach(li => li.classList.remove('on')); cap.textContent = '▶ Watch…';
            const sc = sceneFn(), A = {}; let ci = 0;
            const T = (ms, f) => demoTimers.push(setTimeout(f, ms));
            const act = id => A[id];
            const OPS = {
                add(id, e, r, c) { const d = document.createElement('div'); d.className = 'gd-a'; d.innerHTML = `<span class="gd-e">${e}</span><i class="gd-hp"><u></u></i><b class="gd-bd"></b>`; const p = pos(r, c); d.style.left = p.left; d.style.top = p.top; lawn.appendChild(d); A[id] = d; },
                mv(id, c, r, ms, hop) { const d = act(id); if (!d) return; const cur = parseFloat(d.dataset.r || 0); const rr = (r == null) ? parseFloat(d.dataset.r) : r; const p = pos(rr, c); d.dataset.r = rr; d.style.transition = `left ${ms}ms linear, top ${ms}ms ease`; d.style.left = p.left; d.style.top = p.top; if (hop) { d.classList.remove('hop'); void d.offsetWidth; d.classList.add('hop'); } },
                rm(id) { const d = act(id); if (d) d.remove(); },
                die(id) { const d = act(id); if (d) { d.classList.add('dead'); setTimeout(() => d.remove(), 500); } },
                em(id, e) { const d = act(id); if (d) d.querySelector('.gd-e').textContent = e; },
                badge(id, t) { const d = act(id); if (d) { const b = d.querySelector('.gd-bd'); b.textContent = t; b.classList.add('on'); } },
                hp(id, pct) { const d = act(id); if (d) { const h = d.querySelector('.gd-hp'); h.classList.add('on'); h.firstChild.style.width = pct + '%'; } },
                flash(id) { const d = act(id); if (d) { d.classList.remove('fl'); void d.offsetWidth; d.classList.add('fl'); } },
                float(r, c, t, cls) { const f = document.createElement('div'); f.className = 'rv-soul ' + (cls || ''); const p = pos(r, c); f.style.left = p.left; f.style.top = p.top; f.textContent = t; lawn.appendChild(f); setTimeout(() => f.remove(), 1400); },
                shot(r, c0, c1, e, ms) { const s = document.createElement('div'); s.className = 'gd-shot'; s.textContent = e; const a = pos(r, c0), b = pos(r, c1); s.style.left = a.left; s.style.top = a.top; lawn.appendChild(s); requestAnimationFrame(() => requestAnimationFrame(() => { s.style.transition = `left ${ms}ms linear`; s.style.left = b.left; })); setTimeout(() => s.remove(), ms + 60); },
                fx(cls, r0, c0, r1, c1, ms) { const b = document.createElement('i'); b.className = 'rv-box ' + cls; b.style.left = (c0 / 8 * 100) + '%'; b.style.top = (r0 / R * 100) + '%'; b.style.width = ((c1 - c0 + 1) / 8 * 100) + '%'; b.style.height = ((r1 - r0 + 1) / R * 100) + '%'; lawn.appendChild(b); setTimeout(() => b.remove(), ms || 800); },
                shake() { lawn.classList.remove('shk'); void lawn.offsetWidth; lawn.classList.add('shk'); }
            };
            let last = 0;
            sc.steps.forEach(st => {
                const idx = st[1] ? ci++ : -1;
                T(st[0], () => {
                    if (st[1]) { cap.textContent = st[1]; host.querySelectorAll('.gd-steps li').forEach((li, i) => li.classList.toggle('on', i === idx)); }
                    st.slice(2).forEach(op => { const f = OPS[op[0]]; if (f) f.apply(null, op.slice(1)); });
                });
                last = Math.max(last, st[0]);
            });
            T(last + 4200, run);
        };
        host.querySelector('#gd-replay').onclick = run; run();
    }

    // =====================================================================================
    //  GUIDE — pages
    // =====================================================================================
    const GD = { stack: [], pausedByGuide: false };
    const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const modeText = m => m === 'instant' ? 'Click the zombie — it fires instantly.' : m === 'lane' ? 'Click the zombie, then click a lane above/below (or press W / S).' : 'Click the zombie, then click a target tile on the lawn.';
    const zUnlock = k => { const s = STAGES.find(x => x.unlock.includes(k)); return s ? s.id : 35; };
    const chipZ = k => `<button class="gd-chip" onclick="gdGo('z:${k}')"><span>${ZE(k)}</span>${ROSTER[k].n}</button>`;
    const crumbs = { home: '📖 Guide', how: 'How to play', zs: 'Zombies', ms: 'Manual abilities', dave: 'Dave' };
    function pageTitle(p) {
        const [a, b] = p.split(':');
        if (a === 'z') return ROSTER[b].n; if (a === 'syn') return b === 'list' ? 'Synergies' : SYN[b].n; if (a === 'm') return MAN[b].n; if (a === 'd') return 'Level ' + DAVE[+b].n; if (a === 't') return TAC[b.split('@')[0]].t;
        return crumbs[p] || 'Guide';
    }
    const tile = (e, t, d, go, extra) => `<button class="gd-tile${extra ? ' ' + extra : ''}" onclick="gdGo('${go}')"><span class="gd-te">${e}</span><b>${t}</b><small>${d}</small></button>`;
    function pHome() {
        return `<h2 class="gd-h">What do you want to learn?</h2>
        <div class="gd-tiles">${tile('🎮', 'How to play', '60-second basics — start here', 'how', 'big')}${tile('🧟', 'Zombies', 'All 14 zombies: stats, moves, tactics', 'zs')}${tile('🕹️', 'Manual abilities', 'Fog, Tombstones, Bungee and more', 'ms')}${tile('🧑‍🌾', 'Crazy Dave AI', 'The 7 levels of the plant defender', 'dave')}${tile('⚡', 'Synergies', '6 combos that trigger bonus effects', 'syn:list')}</div>`;
    }
    function pHow() {
        const st = (n, e, t, d) => `<div class="gd-step"><b>${n}</b><span class="gd-se">${e}</span><div><strong>${t}</strong><p>${d}</p></div></div>`;
        return `<h2 class="gd-h">The idea in 5 steps</h2>
        <p class="gd-p">The roles are flipped: Dave’s plants are already on the lawn and <b>you</b> command the zombies.</p>
        <div class="gd-steps5">
          ${st(1, '🧟', 'Pick your horde', 'Choose up to 8 zombies on the previous screen. Tap ⓘ on a card to read about it.')}
          ${st(2, '🧠', 'Raise zombies', 'Tap a zombie card in the left panel, then tap a tile in the two purple columns on the right. It costs 🧠 Brains (they refill slowly).')}
          ${st(3, '🍽️', 'Eat plants for Brains', 'Zombies walk left and eat plants. Eating a plant gives you more 🧠.')}
          ${st(4, '⚡', 'Click a zombie to use its ability', 'Abilities cost 💀 Dread. A green ring under a zombie means it is ready.')}
          ${st(5, '🏠', 'Break into 3 of the 5 houses', 'A zombie that walks off the left edge breaches that lane. 3 lanes = win. 5 lanes + 3 combos = ⭐⭐⭐.')}
        </div>
        <h3 class="gd-h3">What the top bar means</h3>
        <div class="gd-hudleg"><span>🧠 <b>Brains</b> — your money</span><span>💀 <b>Dread</b> — fuel for abilities</span><span>🏠 <b>Lanes</b> — how many broken</span><span>⚡ <b>Synergies</b> — combos triggered</span><span>☀️ <b>Dave</b> — Dave’s sun (his money)</span></div>
        <h3 class="gd-h3">Quick keys</h3><p class="gd-p"><kbd>Q E R T Y U I O</kbd> raise a card · <kbd>1–5</kbd> pick a lane’s front zombie · <kbd>Space</kbd> use its ability · <kbd>W</kbd>/<kbd>S</kbd> choose lane · <kbd>F</kbd> <kbd>G</kbd> <kbd>B</kbd> commands · <kbd>Esc</kbd> cancel</p>
        <div class="gd-row"><button class="rv-btn go" onclick="gdGo('zs')">🧟 Meet the zombies →</button><button class="rv-btn" onclick="gdGo('syn:list')">⚡ Combos →</button></div>`;
    }
    function pZS() {
        return `<h2 class="gd-h">All zombies</h2><p class="gd-p">Tap one for its full page.</p><div class="gd-tiles z">${ROSTER_ORDER.map(k => { const r = ROSTER[k]; return `<button class="gd-tile" onclick="gdGo('z:${k}')"><span class="gd-te">${ZE(k)}</span><b>${r.n}</b><small>${r.role} · 🧠 ${r.cost}</small></button>`; }).join('')}</div>`;
    }
    function pZ(k) {
        const r = ROSTER[k], syns = SYN_ORDER.filter(s => SYN[s].zs.includes(k)), md = MODS[k];
        return `<div class="gd-zhead"><span class="gd-zbig">${ZE(k)}</span><div><h2 class="gd-h">${r.n}</h2><span class="gd-pill">${r.role}</span> <span class="gd-pill g">🧠 ${r.cost}</span></div></div>
        <div class="gd-grid2">
          <section class="gd-card"><h3>📋 Basic info</h3><div class="gd-stats"><div><b>❤️ ${r.hp}</b>Health</div><div><b>${r.arm ? '🛡️ ' + r.arm : r.barrel ? '🛢️ ' + r.barrel : '—'}</b>${r.barrel ? 'Barrel' : 'Armor'}</div><div><b>👣 ${(r.spc || r.sp).toFixed(2)}</b>Speed (tiles/s)</div><div><b>🍴 ${r.dps || '—'}</b>Bite damage/s</div></div><p class="gd-small">Unlocks at <b>Stage ${zUnlock(k)}</b>. Optional upgrade: <b>${md.n}</b> (${md.stars}⭐) — ${md.d}</p></section>
          <section class="gd-card"><h3>🔹 Zombie ability <small>(happens automatically)</small></h3><p><b>${r.pas[0]}</b></p><p class="gd-p">${r.pas[1]}</p></section>
          <section class="gd-card"><h3>⚡ Manual ability <small>(you trigger it)</small></h3><p><b>${r.act.n}</b></p><div class="gd-stats s"><div><b>${r.act.cost} 💀</b>Dread cost</div><div><b>${r.act.once ? 'Once' : r.act.cd + 's'}</b>Cooldown</div></div><p class="gd-p">${r.act.d}</p><p class="gd-small">🖱️ ${modeText(r.act.mode)}</p></section>
          <section class="gd-card"><h3>🔗 Synergies</h3>${syns.length ? `<div class="gd-chips">${syns.map(s => `<button class="gd-chip syn" onclick="gdGo('syn:${s}')"><span>${SYN[s].e}</span>${SYN[s].n}</button>`).join('')}</div>` : '<p class="gd-small">No synergy.</p>'}<p class="gd-small">Tap one to see how to trigger it.</p></section>
        </div>
        <section class="gd-card wide"><h3>🎓 Tactics panel</h3><p class="gd-small">Short lessons with a live demo.</p><div class="gd-chips">${(ZTAC[k] || []).map(id => `<button class="gd-chip tac" onclick="gdGo('t:${id}@${k}')"><span>🎯</span>${TAC[id].t}</button>`).join('')}</div></section>`;
    }
    function pSynList() { return `<h2 class="gd-h">Synergies</h2><p class="gd-p">Use abilities in the right setup and you get a bonus effect plus 💀 Dread.</p><div class="gd-tiles">${SYN_ORDER.map(s => tile(SYN[s].e, SYN[s].n, SYN[s].zs.length > 5 ? 'Any zombie' : SYN[s].zs.map(z => ROSTER[z].n).join(' + '), 'syn:' + s)).join('')}</div>`; }
    function pSyn(id) {
        const s = SYN[id];
        return `<div class="gd-zhead"><span class="gd-zbig">${s.e}</span><div><h2 class="gd-h">${s.n}</h2><span class="gd-pill">Synergy</span></div></div>
        <section class="gd-card wide"><h3>✨ What it does</h3><p class="gd-p">${s.what}</p></section>
        <section class="gd-card wide"><h3>🧩 How to trigger it</h3><ol class="gd-ol">${s.how.map(h => `<li>${h}</li>`).join('')}</ol><p class="gd-small">💡 ${s.tip}</p></section>
        <section class="gd-card wide"><h3>🧟 Related zombies</h3><div class="gd-chips">${s.zs.map(chipZ).join('')}</div></section>
        <section class="gd-card wide"><h3>🎬 See it</h3><div id="gd-demo"></div></section>`;
    }
    function pMS() { return `<h2 class="gd-h">Manual abilities</h2><p class="gd-p">Tools you control. The three commands also cost 💀 Dread and sit on the buttons under the lawn.</p><div class="gd-tiles">${MAN_ORDER.map(m => tile(MAN[m].e, MAN[m].n, MAN[m].cost + ' · ' + (m === 'zab' ? 'click a zombie' : 'key ' + MAN[m].key.split(' ')[0]), 'm:' + m)).join('')}</div>`; }
    function pM(id) {
        const m = MAN[id];
        return `<div class="gd-zhead"><span class="gd-zbig">${m.e}</span><div><h2 class="gd-h">${m.n}</h2><span class="gd-pill g">${m.cost}</span> <span class="gd-pill">⏱ ${m.cd}</span> <span class="gd-pill">⌨️ ${m.key}</span></div></div>
        <section class="gd-card wide"><h3>What it does</h3><p class="gd-p">${m.what}</p></section>
        <section class="gd-card wide"><h3>How to use it</h3><ol class="gd-ol">${m.how.map(h => `<li>${h}</li>`).join('')}</ol><p class="gd-small">💡 ${m.tip}</p></section>
        ${id === 'grave' ? `<section class="gd-card wide"><h3>🔗 Synergy</h3><div class="gd-chips"><button class="gd-chip syn" onclick="gdGo('syn:phantom')"><span>👻</span>Phantom Ambush</button></div></section>` : ''}`;
    }
    function pDave() {
        return `<h2 class="gd-h">Crazy Dave — the plant AI</h2><p class="gd-p">Dave only plants from a small <b>deck chosen for each stage</b> (the plants you see in its formation). He reads your zombies, your abilities and your commands, and uses 🫘 Plant Food (energy beans) often. Pick the level on the zombie-select screen. Tap a level for details.</p>
        <div class="gd-dave">${DAVE.map((d, i) => `<button class="gd-dv" onclick="gdGo('d:${i}')"><b>${d.n}</b><span>${d.who}</span><small>New: ${d.add}</small><i style="--w:${(i + 1) / 7 * 100}%"></i></button>`).join('')}</div>`;
    }
    function pD(i) {
        const d = DAVE[i];
        return `<div class="gd-zhead"><span class="gd-zbig">🧑‍🌾</span><div><h2 class="gd-h">Level ${d.n} — ${d.who}</h2></div></div>
        <section class="gd-card wide"><h3>What changes</h3><p class="gd-p">${d.say}</p></section>
        <div class="gd-grid2"><section class="gd-card"><h3>📊 Numbers</h3><div class="gd-stats"><div><b>🧠 ${d.think}s</b>Thinks every</div><div><b>🎬 ${d.acts}</b>Actions / think</div><div><b>⏱ ${d.cd}%</b>Plant recharge</div><div><b>☀️ +${d.sun}</b>Extra start sun</div><div><b>🫘 ${d.food0}</b>Start beans</div><div><b>🫘 /${d.foodEvery}s</b>New bean (max ${d.cap})</div><div><b>🌱 +${d.filler}</b>Extra plants</div></div></section>
        <section class="gd-card"><h3>🆕 New tools at this level</h3>${d.adds.length ? `<div class="gd-chips">${d.adds.map(a => `<span class="gd-chip"><span>${DNAME[a][0]}</span>${DNAME[a][1]}</span>`).join('')}</div>` : '<p class="gd-small">Nothing new — everything is faster and sharper.</p>'}<p class="gd-small">Tools only appear in stages whose deck lists them, and stay unlocked at higher levels.</p></section></div>
        <section class="gd-card wide"><h3>🧠 How Dave thinks (all levels)</h3><ol class="gd-ol"><li><b>Counters:</b> each zombie type has a preferred answer — Cactus/Blover for Balloons, Magnet-shroom for metal, Tall-nuts for Vaulters and All-Stars, lobbers for Screen Doors, ice for Explorers.</li><li><b>Your abilities:</b> Fog → Torchwood or Plant Food; Tombstones → Gravebuster; Tesla EMP → Plant Food cures the stun; a Lane-Hop, Imp drop or Bungee behind his walls → instant ambush plants.</li><li><b>Plant Food:</b> each plant has its own effect (dragon sweeps, Chomper gulps, Power Tiles fire a whole group). Dave picks the plant that will hit the most zombies.</li><li><b>Strikes:</b> a red warning shows 1.2s before Cherry Bombs, Jalapeños and Cob shots land — move away!</li><li><b>Rescue:</b> when a lane is about to break he spends beans, freezes, blows zombies back or rewinds time.</li></ol></section>`;
    }
    function pT(raw) {
        const [id, from] = raw.split('@'), t = TAC[id];
        const rel = t.z.concat(from && !t.z.includes(from) ? [from] : []);
        return `<div class="gd-zhead"><span class="gd-zbig">🎯</span><div><h2 class="gd-h">${t.t}</h2><span class="gd-pill">Tactic</span></div></div>
        <section class="gd-card wide"><h3>🎬 Live demo</h3><div id="gd-demo"></div></section>
        <div class="gd-grid2"><section class="gd-card"><h3>🎯 Goal</h3><p class="gd-p">${t.goal}</p></section><section class="gd-card"><h3>🪜 Steps</h3><ol class="gd-ol">${t.steps.map(s => `<li>${s}</li>`).join('')}</ol><p class="gd-small">💡 ${t.tip}</p></section></div>
        <section class="gd-card wide"><h3>🧟 Zombies used</h3><div class="gd-chips">${rel.map(chipZ).join('')}</div></section>`;
    }
    function render() {
        const p = GD.stack[GD.stack.length - 1] || 'home', body = $('gd-body'); if (!body) return;
        stopDemo(); const [a, b] = p.split(':');
        let html;
        if (p === 'home') html = pHome(); else if (p === 'how') html = pHow(); else if (p === 'zs') html = pZS(); else if (a === 'z') html = pZ(b);
        else if (a === 'syn') html = b === 'list' ? pSynList() : pSyn(b); else if (p === 'ms') html = pMS(); else if (a === 'm') html = pM(b); else if (p === 'dave') html = pDave(); else if (a === 'd') html = pD(+b); else if (a === 't') html = pT(p.slice(2)); else html = pHome();
        body.innerHTML = html; body.scrollTop = 0;
        $('gd-title').textContent = pageTitle(p);
        $('gd-back').style.visibility = GD.stack.length > 1 ? 'visible' : 'hidden';
        $('gd-trail').innerHTML = GD.stack.map((q, i) => `<button class="gd-cr${i === GD.stack.length - 1 ? ' on' : ''}" onclick="gdJump(${i})">${esc(pageTitle(q))}</button>`).join('<i>›</i>');
        const demo = $('gd-demo');
        if (demo) { let fn = null; if (a === 't') fn = SCENES[b.split('@')[0]]; else if (a === 'syn') fn = SCENES[SYN[b].tac]; if (fn) mountDemo(demo, fn); }
    }
    window.gdGo = p => { GD.stack.push(p); render(); };
    window.gdBack = () => { if (GD.stack.length > 1) { GD.stack.pop(); render(); } };
    window.gdJump = i => { GD.stack = GD.stack.slice(0, i + 1); render(); };
    window.revGuide = function (page) {
        let o = $('rev-guide');
        if (!o) {
            o = document.createElement('div'); o.id = 'rev-guide';
            o.innerHTML = `<div class="gd-wrap"><div class="gd-top"><button class="rv-btn" id="gd-back" onclick="gdBack()">← Back</button><div class="gd-ttl"><span>📖</span><b id="gd-title">Guide</b></div><button class="rv-btn" onclick="gdJump(0)">🏠 Guide home</button><button class="rv-btn" onclick="revGuideClose()">✖ Close</button></div><div class="gd-trail" id="gd-trail"></div><div class="gd-body" id="gd-body"></div></div>`;
            document.body.appendChild(o);
        }
        store.set(KEY_GSEEN, 1); document.querySelectorAll('.rv-guide-btn').forEach(b => b.classList.remove('pulse'));
        GD.stack = page && page !== 'home' ? ['home', page] : ['home'];
        if (REV.on && !REV.ended && typeof isRunning !== 'undefined' && isRunning) { GD.pausedByGuide = true; try { toggleGame(); } catch (_) {} }
        REV.guideOpen = true; o.classList.add('on'); render();
    };
    window.revGuideClose = function () {
        stopDemo(); const o = $('rev-guide'); if (o) o.classList.remove('on'); REV.guideOpen = false;
        if (GD.pausedByGuide) { GD.pausedByGuide = false; if (REV.on && !REV.ended && !isRunning) { try { toggleGame(); } catch (_) {} } }
    };
    window.addEventListener('keydown', e => { if (REV.guideOpen && e.key === 'Escape') { e.stopPropagation(); if (GD.stack.length > 1) gdBack(); else revGuideClose(); } }, true);
    window.addEventListener('DOMContentLoaded', () => {
        const w = $('lawn-wrap');
        if (w && !$('rev-help')) { const b = document.createElement('button'); b.id = 'rev-help'; b.className = 'rv-guide-btn'; b.innerHTML = '❓ Guide'; b.title = 'Open the Reversed Invasion guide (pauses the game)'; b.onclick = e => { e.stopPropagation(); revGuide('how'); }; revBars().top.insertBefore(b, revBars().top.firstChild); }
        if (!store.get(KEY_GSEEN, 0)) document.querySelectorAll('.rv-guide-btn').forEach(b => b.classList.add('pulse'));
    });
})();
