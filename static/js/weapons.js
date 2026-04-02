const WEAPONS_REGISTRY = {
    // 1-6 Basic
    "single": { name: "Single Shot", icon: "💣", cat: "Explosive", desc: "Basic explosive crater." },
    "double": { name: "Double Shot", icon: "🧨", cat: "Explosive", desc: "Two quick shots." },
    "triple": { name: "3-Shot", icon: "💥", cat: "Explosive", desc: "Fires three shots in a tight arc." },
    "big_shot": { name: "Big Shot", icon: "💥", cat: "Explosive", desc: "Large blast radius." },
    "nuke": { name: "Nuke", icon: "☢️", cat: "Explosive", desc: "Devastating explosion." },
    "sniper": { name: "Sniper", icon: "🎯", cat: "Explosive", desc: "Fast, extremely accurate." },

    // 7-12 Multiples & Spread
    "splitter": { name: "Splitter", icon: "🎇", cat: "Spread", desc: "Splits into 3 mid-air." },
    "mirv": { name: "M.I.R.V", icon: "🚀", cat: "Spread", desc: "Splits into 5 mid-air." },
    "cluster": { name: "Cluster Bomb", icon: "🎆", cat: "Spread", desc: "Explodes and scatters bomblets." },
    "shotgun": { name: "Shotgun", icon: "🌠", cat: "Spread", desc: "Short range wide spread." },
    "rain": { name: "Fire Rain", icon: "🌧️", cat: "Spread", desc: "Rains fire from above." },
    "carpet": { name: "Carpet Bomb", icon: "🛩️", cat: "Spread", desc: "Drops explosions across the terrain." },

    // 13-18 Terrain Modifiers
    "dirt_mover": { name: "Dirt Mover", icon: "⛰️", cat: "Earth", desc: "Builds a mountain." },
    "big_dirt": { name: "Big Dirt", icon: "🏔️", cat: "Earth", desc: "Builds a large mountain." },
    "wall": { name: "Wall Creator", icon: "🧱", cat: "Earth", desc: "Creates a tall vertical wall." },
    "digger": { name: "Digger", icon: "⛏️", cat: "Earth", desc: "Digs underground before exploding." },
    "earthquake": { name: "Earthquake", icon: "🫨", cat: "Earth", desc: "Flattens the terrain significantly." },
    "canyon": { name: "Canyon", icon: "🏞️", cat: "Earth", desc: "Digs a deep hole." },

    // 19-24 Bouncers & Rollers
    "roller": { name: "Roller", icon: "🛞", cat: "Bounce", desc: "Rolls along the terrain." },
    "heavy_roller": { name: "Heavy Roller", icon: "⚙️", cat: "Bounce", desc: "Destroys terrain as it rolls." },
    "bouncy": { name: "Bouncy Bomb", icon: "🎾", cat: "Bounce", desc: "Bounces around." },
    "super_bounce": { name: "Super Bouncer", icon: "🥎", cat: "Bounce", desc: "Very bouncy." },
    "rubber": { name: "Rubber Ball", icon: "⚽", cat: "Bounce", desc: "Bounces off everything." },
    "bowl": { name: "Bowling Ball", icon: "🎳", cat: "Bounce", desc: "Heavy, rolls and crushes." },

    // 25-30 Tech/Magic
    "heatseeker": { name: "Heatseeker", icon: "🔥", cat: "Tech", desc: "Homing missile." },
    "laser": { name: "Laser", icon: "⚡", cat: "Tech", desc: "Instant straight line." },
    "teleport": { name: "Teleporter", icon: "🌀", cat: "Tech", desc: "Teleports your tank to impact." },
    "shield": { name: "Energy Shield", icon: "🛡️", cat: "Tech", desc: "Creates a temporary shield." },
    "emp": { name: "E.M.P", icon: "📡", cat: "Tech", desc: "Disables opponent temporarily." },
    "tracer": { name: "Tracer", icon: "☄️", cat: "Tech", desc: "Shows exact path, small explosion." },

    // 31-35 Elemental/Fluids
    "water": { name: "Water Balloon", icon: "💧", cat: "Fluid", desc: "Spreads water, drowns." },
    "oil": { name: "Oil Drum", icon: "🛢️", cat: "Fluid", desc: "Spreads slippery oil." },
    "napalm": { name: "Napalm", icon: "🔥", cat: "Fluid", desc: "Ignites terrain on fire." },
    "acid": { name: "Acid Rain", icon: "🧪", cat: "Fluid", desc: "Eats through terrain." },
    "lava": { name: "Lava Ball", icon: "🌋", cat: "Fluid", desc: "Creates flowing magma." }
};

// Returns an array of N random unique weapon IDs
function getRandomWeapons(cnt) {
    const keys = Object.keys(WEAPONS_REGISTRY);
    const shuffled = keys.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, cnt);
}
