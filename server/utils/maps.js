// server/utils/maps.js
const fs = require('fs');
const path = require('path');
const { WALL_SIZE } = require('./constants');

let registry = {};
let list = [];

function normalizeLayout(layout) {
    if (!Array.isArray(layout) || layout.length === 0) return null;
    const rows = layout.map(r => typeof r === 'string' ? r : String(r))
    const width = rows[0].length;
    if (width === 0) return null;
    for (const r of rows) {
        if (r.length !== width) return null;
    }
    return rows;
}

function addToRegistry(mapObj) {
    const id = mapObj.id || mapObj.key || mapObj.name?.toLowerCase().replace(/\s+/g, '-');
    if (!id) return;
    const layout = normalizeLayout(mapObj.layout || mapObj.MAP_LAYOUT || mapObj.tiles);
    if (!layout) return;
    const rows = layout.length;
    const cols = layout[0].length;
    const entry = {
        id,
        name: mapObj.name || id,
        layout,
        rows,
        cols,
        width: cols * WALL_SIZE,
        height: rows * WALL_SIZE,
        author: mapObj.author || undefined,
        description: mapObj.description || undefined
    };
    registry[id] = entry;
}

function loadMapsFromDisk() {
    registry = {};
    const mapsDir = path.join(__dirname, '..', 'maps');
    try {
        const files = fs.readdirSync(mapsDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            try {
                const full = path.join(mapsDir, file);
                const raw = fs.readFileSync(full, 'utf8');
                const json = JSON.parse(raw);
                if (Array.isArray(json)) {
                    json.forEach(m => addToRegistry(m));
                } else {
                    addToRegistry(json);
                }
            } catch (e) {
                console.warn('[maps] Failed loading', file, e.message);
            }
        }
    } catch (e) {
        // directory may not exist yet; fallback maps will be added below
    }

    // Fallback: ensure at least a classic map exists
    if (!registry['classic']) {
        addToRegistry({
            id: 'classic',
            name: 'Classic Arena',
            layout: [
                "S              S",
                "                ",
                "  N11      11N  ",
                "  1    P     1  ",
                "S 1          1 S",
                "                ",
                "N     1111  P  N",
                "N  P  1111     N",
                "                ",
                "S 1          1 S",
                "  1     P    1  ",
                "  N11      11N  ",
                "                ",
                "S              S",
            ]
        });
    }

    list = Object.values(registry).map(({ id, name, rows, cols, author }) => ({ id, name, rows, cols, author }));
}

function getMaps() {
    if (list.length === 0) loadMapsFromDisk();
    return list;
}

function getMapById(id) {
    if (list.length === 0) loadMapsFromDisk();
    return registry[id] || registry['classic'];
}

module.exports = { getMaps, getMapById };
