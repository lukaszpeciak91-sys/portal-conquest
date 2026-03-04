#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_MAP = 'map01';

function parseArgs(argv) {
  const args = { map: DEFAULT_MAP };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--map') {
      args.map = argv[i + 1] ?? DEFAULT_MAP;
      i += 1;
    }
  }
  return args;
}

function hashString(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function createPrng(seed) {
  const seedFn = hashString(seed);
  let state = seedFn();
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function connect(edges, a, b) {
  if (a === b) return;
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  edges.add(key);
}

function toAdjacency(edges, ids) {
  const adjacency = new Map(ids.map((id) => [id, new Set()]));
  edges.forEach((edge) => {
    const [a, b] = edge.split('|');
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  });
  return adjacency;
}

function bfsConnected(startId, adjacency) {
  const queue = [startId];
  const seen = new Set([startId]);
  while (queue.length) {
    const node = queue.shift();
    adjacency.get(node).forEach((next) => {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    });
  }
  return seen;
}

function enforce(condition, message) {
  if (!condition) throw new Error(message);
}

function generate(mapData) {
  const cfg = mapData.generation;
  if (!cfg) {
    throw new Error('map generation config is missing (expected top-level "generation")');
  }

  const rand = createPrng(cfg.seed ?? mapData.id ?? 'map01');
  const nodeCount = Number.isInteger(cfg.nodeCount)
    ? cfg.nodeCount
    : cfg.nodeCountMin + Math.floor(rand() * (cfg.nodeCountMax - cfg.nodeCountMin + 1));

  const { width, height, marginX, marginY } = cfg.bounds;
  const { columns, rows, jitterX, jitterY, minSpacing } = cfg.layout;

  enforce(nodeCount >= 18 && nodeCount <= 22, `nodeCount ${nodeCount} must be in 18..22`);

  const rowCounts = new Array(rows).fill(0);
  rowCounts[0] = 1;
  rowCounts[rows - 1] = 1;
  for (let i = 1; i < rows - 1; i += 1) rowCounts[i] = 3;

  let remaining = nodeCount - rowCounts.reduce((sum, v) => sum + v, 0);
  const growOrder = shuffle([...Array(rows - 2).keys()].map((n) => n + 1), rand);
  let cursor = 0;
  while (remaining > 0) {
    const row = growOrder[cursor % growOrder.length];
    if (rowCounts[row] < columns) {
      rowCounts[row] += 1;
      remaining -= 1;
    }
    cursor += 1;
  }

  const nodes = [];
  let nextId = 1;
  for (let row = 0; row < rows; row += 1) {
    const cols = [...Array(columns).keys()];
    const selected = row === 0 || row === rows - 1
      ? [Math.floor(columns / 2)]
      : shuffle(cols, rand).slice(0, rowCounts[row]).sort((a, b) => a - b);

    selected.forEach((col) => {
      const baseX = marginX + ((width - (marginX * 2)) * (col / Math.max(columns - 1, 1)));
      const baseY = marginY + ((height - (marginY * 2)) * (row / Math.max(rows - 1, 1)));
      let x = baseX;
      let y = baseY;

      for (let attempt = 0; attempt < 24; attempt += 1) {
        const candidateX = Math.max(
          marginX,
          Math.min(width - marginX, baseX + ((rand() * 2 - 1) * jitterX)),
        );
        const candidateY = Math.max(
          marginY,
          Math.min(height - marginY, baseY + ((rand() * 2 - 1) * jitterY)),
        );

        const hasConflict = nodes.some((other) => {
          if (Math.abs(other.row - row) > 1) return false;
          const dx = other.x - candidateX;
          const dy = other.y - candidateY;
          return Math.hypot(dx, dy) < minSpacing;
        });

        if (!hasConflict || attempt === 23) {
          x = candidateX;
          y = candidateY;
          break;
        }
      }

      nodes.push({
        id: `n${nextId}`,
        row,
        col,
        x: Math.round(x),
        y: Math.round(y),
      });
      nextId += 1;
    });
  }

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const distance = Math.hypot(dx, dy);
      if (distance < minSpacing && Math.abs(nodes[i].row - nodes[j].row) <= 1) {
        throw new Error(`spacing check failed for ${nodes[i].id} and ${nodes[j].id}`);
      }
    }
  }

  const byRow = new Map();
  nodes.forEach((node) => {
    if (!byRow.has(node.row)) byRow.set(node.row, []);
    byRow.get(node.row).push(node);
  });
  byRow.forEach((list) => list.sort((a, b) => a.x - b.x));

  const edges = new Set();
  for (let row = 0; row < rows - 1; row += 1) {
    const current = byRow.get(row) ?? [];
    const next = byRow.get(row + 1) ?? [];

    next.forEach((nodeB) => {
      const orderedParents = [...current]
        .sort((a, b) => Math.abs(a.x - nodeB.x) - Math.abs(b.x - nodeB.x));
      connect(edges, nodeB.id, orderedParents[0].id);
    });

    current.forEach((nodeA, idx) => {
      const candidate = next[idx % next.length];
      connect(edges, nodeA.id, candidate.id);
    });

    const crossLinks = Math.max(1, Math.floor(Math.min(current.length, next.length) / 2));
    const pairPool = [];
    current.forEach((a) => {
      next.forEach((b) => {
        pairPool.push({ a: a.id, b: b.id, span: Math.abs(a.x - b.x) });
      });
    });

    shuffle(pairPool, rand)
      .sort((p1, p2) => p1.span - p2.span)
      .slice(0, crossLinks)
      .forEach((pair) => connect(edges, pair.a, pair.b));
  }

  for (let row = 0; row < rows - 2; row += 1) {
    const current = byRow.get(row) ?? [];
    const skip = byRow.get(row + 2) ?? [];
    if (!current.length || !skip.length) continue;
    if (rand() > 0.55) continue;
    const a = current[Math.floor(rand() * current.length)];
    const b = [...skip].sort((n1, n2) => Math.abs(n1.x - a.x) - Math.abs(n2.x - a.x))[0];
    connect(edges, a.id, b.id);
  }

  const ids = nodes.map((node) => node.id);
  const adjacency = toAdjacency(edges, ids);
  const visited = bfsConnected(nodes[0].id, adjacency);

  enforce(visited.size === nodes.length, 'graph is not connected');

  const degreeCounts = nodes.map((node) => adjacency.get(node.id).size);
  const highDegreeCount = degreeCounts.filter((deg) => deg >= 3).length;
  enforce(highDegreeCount >= 2, 'graph branching check failed: need at least 2 nodes with degree >= 3');
  enforce(edges.size > nodes.length - 1, 'graph too linear: insufficient extra edges');

  const typeBudget = { ...(cfg.typeBudget ?? {}) };
  enforce(typeBudget.castle === 1, 'typeBudget.castle must equal 1');
  const typeTotal = Object.values(typeBudget).reduce((sum, count) => sum + count, 0);
  enforce(typeTotal === nodes.length, `typeBudget total ${typeTotal} does not match node count ${nodes.length}`);

  const remainingTypeCounts = { ...typeBudget, castle: 0 };
  const assignment = new Map([[nodes[0].id, 'castle']]);

  const nonStartNodes = nodes.slice(1).sort((a, b) => (a.row - b.row) || (a.x - b.x));
  nonStartNodes.forEach((node) => {
    const rowTypes = nonStartNodes
      .filter((other) => other.row === node.row && assignment.has(other.id))
      .map((other) => assignment.get(other.id));

    const candidates = Object.entries(remainingTypeCounts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        const aInRow = rowTypes.filter((t) => t === a[0]).length;
        const bInRow = rowTypes.filter((t) => t === b[0]).length;
        if (aInRow !== bInRow) return aInRow - bInRow;
        return a[0].localeCompare(b[0]);
      });

    const chosen = candidates[0]?.[0];
    if (!chosen) throw new Error(`unable to assign type for node ${node.id}`);
    assignment.set(node.id, chosen);
    remainingTypeCounts[chosen] -= 1;
  });

  const generatedNodes = nodes.map((node) => ({
    id: node.id,
    type: assignment.get(node.id),
    region: node.row + 1,
    x: node.x,
    y: node.y,
    connections: [...adjacency.get(node.id)].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))),
    hidden: false,
  }));

  const computedNodeTypeCounts = generatedNodes.reduce((acc, node) => {
    acc[node.type] = (acc[node.type] ?? 0) + 1;
    return acc;
  }, {});

  return {
    nodes: generatedNodes,
    nodeTypeCounts: computedNodeTypeCounts,
    generationMeta: {
      seed: cfg.seed,
      nodeCount: generatedNodes.length,
      edgeCount: edges.size,
      highDegreeNodeCount: highDegreeCount,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const mapPath = path.resolve(`src/data/maps/${args.map}.json`);

  const original = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const generated = generate(original);

  const updated = {
    ...original,
    nodes: generated.nodes,
    nodeTypeCounts: generated.nodeTypeCounts,
    generationMeta: generated.generationMeta,
  };

  fs.writeFileSync(mapPath, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`Generated ${args.map}.json with ${generated.nodes.length} nodes and ${generated.generationMeta.edgeCount} edges.`);
}

main();
