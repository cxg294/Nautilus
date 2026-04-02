/**
 * Execution Flow Analyzer - Traces broadcast chains and variable data flow
 * Produces Mermaid diagram definitions for visualization
 */
import { blockToText, HAT_OPCODES } from './blockConverter';

/**
 * Build a broadcast execution flow graph
 * Returns a Mermaid diagram string
 */
export function buildExecutionFlow(project) {
  const targets = project.targets || [];
  const nodes = [];   // { id, label, targetName, hatOpcode, scriptLines }
  const edges = [];   // { from, to, label, type: 'sync'|'async' }

  // Step 1: Extract all hat-block scripts and their broadcast sends
  let nodeId = 0;
  const scriptMap = new Map(); // nodeId → script info

  for (const target of targets) {
    const blocks = target.blocks || {};

    for (const [blockId, block] of Object.entries(blocks)) {
      if (typeof block !== 'object' || !block.topLevel) continue;
      if (!HAT_OPCODES.has(block.opcode)) continue;

      const id = `n${nodeId++}`;
      const lines = [];
      const broadcastsSent = [];
      let waitTime = 0;

      // Walk the script chain
      let current = blockId;
      while (current) {
        const b = blocks[current];
        if (!b) break;

        const text = blockToText(current, blocks);
        lines.push(text);

        // Track broadcasts
        if (b.opcode === 'event_broadcast' || b.opcode === 'event_broadcastandwait') {
          const input = b.inputs?.BROADCAST_INPUT;
          let bcName = null;
          let isDynamic = false;

          if (input && Array.isArray(input[1]) && input[1][0] === 11) {
            bcName = input[1][1];
          } else if (input && typeof input[1] === 'string') {
            isDynamic = true;
            bcName = '[动态广播]';
          }

          if (bcName) {
            broadcastsSent.push({
              name: bcName,
              isWait: b.opcode === 'event_broadcastandwait',
              isDynamic,
              afterTime: waitTime,
            });
          }
        }

        // Track wait time
        if (b.opcode === 'control_wait') {
          const dur = b.inputs?.DURATION;
          if (dur && Array.isArray(dur[1])) {
            const t = parseFloat(dur[1][1]);
            if (!isNaN(t)) waitTime += t;
          }
        }

        // Follow substacks for control blocks
        if (b.inputs?.SUBSTACK) {
          let sub = b.inputs.SUBSTACK[1];
          if (typeof sub === 'string') {
            let sc = sub;
            while (sc) {
              const sb = blocks[sc];
              if (!sb) break;
              const st = blockToText(sc, blocks);
              lines.push('  ' + st);

              if (sb.opcode === 'event_broadcast' || sb.opcode === 'event_broadcastandwait') {
                const inp = sb.inputs?.BROADCAST_INPUT;
                if (inp && Array.isArray(inp[1]) && inp[1][0] === 11) {
                  broadcastsSent.push({
                    name: inp[1][1],
                    isWait: sb.opcode === 'event_broadcastandwait',
                    isDynamic: false,
                    afterTime: waitTime,
                  });
                }
              }
              if (sb.opcode === 'control_wait' && sb.inputs?.DURATION && Array.isArray(sb.inputs.DURATION[1])) {
                const t = parseFloat(sb.inputs.DURATION[1][1]);
                if (!isNaN(t)) waitTime += t;
              }

              sc = sb.next;
            }
          }
        }

        current = b.next;
      }

      // Get hat info
      let hatLabel = blockToText(blockId, blocks);
      let triggerBroadcast = null;
      if (block.opcode === 'event_whenbroadcastreceived') {
        triggerBroadcast = block.fields?.BROADCAST_OPTION?.[0];
      }

      const node = {
        id,
        targetName: target.name,
        hatOpcode: block.opcode,
        hatLabel,
        triggerBroadcast,
        lines,
        broadcastsSent,
        waitTime,
        blockCount: lines.length,
      };

      nodes.push(node);
      scriptMap.set(id, node);
    }
  }

  // Step 2: Build edges based on broadcast connections
  for (const node of nodes) {
    for (const bc of node.broadcastsSent) {
      // Find all receivers
      const receivers = nodes.filter(n =>
        n.triggerBroadcast === bc.name && n.id !== node.id
      );

      for (const receiver of receivers) {
        edges.push({
          from: node.id,
          to: receiver.id,
          label: bc.name,
          type: bc.isWait ? 'sync' : 'async',
          isDynamic: bc.isDynamic,
        });
      }
    }
  }

  // Step 3: Generate Mermaid diagram
  const mermaid = generateMermaid(nodes, edges);

  return { nodes, edges, mermaid, scriptMap };
}

function generateMermaid(nodes, edges) {
  const lines = ['graph TD'];

  // Group nodes by target
  const byTarget = {};
  for (const n of nodes) {
    if (!byTarget[n.targetName]) byTarget[n.targetName] = [];
    byTarget[n.targetName].push(n);
  }

  let sgIdx = 0;
  for (const [targetName, targetNodes] of Object.entries(byTarget)) {
    const sgId = `sg${sgIdx++}`;
    lines.push(`  subgraph ${sgId} ["${sanitize(targetName)}"]`);
    for (const n of targetNodes) {
      const shape = getNodeShape(n.hatOpcode);
      const label = sanitize(`${n.hatLabel}`);
      lines.push(`    ${n.id}${shape[0]}"${label}<br/><small>${n.blockCount}积木</small>"${shape[1]}`);
    }
    lines.push('  end');
  }

  // Edges
  for (const e of edges) {
    const label = sanitize(e.label);
    if (e.type === 'sync') {
      lines.push(`  ${e.from} ==>|"⏸️ ${label}"| ${e.to}`);
    } else {
      lines.push(`  ${e.from} -.->|"📡 ${label}"| ${e.to}`);
    }
  }

  // Styling
  lines.push('  classDef greenFlag fill:#4CAF50,color:#fff,stroke:#388E3C');
  lines.push('  classDef keyPress fill:#FF9800,color:#fff,stroke:#F57C00');
  lines.push('  classDef broadcast fill:#2196F3,color:#fff,stroke:#1976D2');
  lines.push('  classDef clone fill:#9C27B0,color:#fff,stroke:#7B1FA2');
  lines.push('  classDef spriteClick fill:#E91E63,color:#fff,stroke:#C2185B');

  for (const n of nodes) {
    const cls = getNodeClass(n.hatOpcode);
    if (cls) lines.push(`  class ${n.id} ${cls}`);
  }

  return lines.join('\n');
}

function getNodeShape(opcode) {
  if (opcode === 'event_whenflagclicked') return ['([', '])'];
  if (opcode === 'event_whenbroadcastreceived') return ['[[', ']]'];
  return ['[', ']'];
}

function getNodeClass(opcode) {
  if (opcode === 'event_whenflagclicked') return 'greenFlag';
  if (opcode === 'event_whenkeypressed') return 'keyPress';
  if (opcode === 'event_whenbroadcastreceived') return 'broadcast';
  if (opcode === 'control_start_as_clone') return 'clone';
  if (opcode === 'event_whenthisspriteclicked') return 'spriteClick';
  return null;
}

function sanitize(str) {
  return str.replace(/"/g, "'").replace(/[<>]/g, '').replace(/\n/g, ' ');
}

/**
 * Build variable data flow analysis
 */
export function buildVariableFlow(project) {
  const targets = project.targets || [];
  const varFlows = new Map(); // varId → { name, writers: [], readers: [] }

  // Register all variables
  for (const target of targets) {
    for (const [id, v] of Object.entries(target.variables || {})) {
      if (!varFlows.has(id)) {
        varFlows.set(id, { id, name: v[0], writers: [], readers: [] });
      }
    }
  }

  // Scan blocks
  const writeOps = new Set(['data_setvariableto', 'data_changevariableby']);

  for (const target of targets) {
    const blocks = target.blocks || {};

    for (const [blockId, block] of Object.entries(blocks)) {
      if (typeof block !== 'object' || !block.opcode) continue;

      const varField = block.fields?.VARIABLE;
      if (!varField) continue;
      const varId = varField[1];
      const varInfo = varFlows.get(varId);
      if (!varInfo) continue;

      // Find which script this block belongs to
      let hatBlock = findHatBlock(blockId, blocks);
      const hatLabel = hatBlock ? blockToText(hatBlock, blocks) : '(unknown)';

      const entry = {
        targetName: target.name,
        hatLabel,
        blockText: blockToText(blockId, blocks),
        opcode: block.opcode,
      };

      if (writeOps.has(block.opcode)) {
        varInfo.writers.push(entry);
      } else {
        varInfo.readers.push(entry);
      }
    }
  }

  const results = [...varFlows.values()].filter(v => v.writers.length > 0 || v.readers.length > 0);

  // Race condition detection: variables written by multiple parallel scripts
  for (const v of results) {
    v.raceWarning = false;
    if (v.writers.length <= 1) continue;

    // Check if writers are from different targets (parallel execution)
    const writerTargets = new Set(v.writers.map(w => w.targetName));
    if (writerTargets.size > 1) {
      v.raceWarning = true;
      v.raceDetail = `被 ${writerTargets.size} 个角色同时写入: ${[...writerTargets].join(', ')}`;
    } else {
      // Same target but multiple scripts writing — could be parallel via broadcasts
      const hatLabels = new Set(v.writers.map(w => w.hatLabel));
      if (hatLabels.size > 1) {
        v.raceWarning = true;
        v.raceDetail = `在 ${hatLabels.size} 个不同脚本中被写入`;
      }
    }
  }

  return results;
}

function findHatBlock(blockId, blocks) {
  let current = blockId;
  let visited = new Set();
  while (current && !visited.has(current)) {
    visited.add(current);
    const b = blocks[current];
    if (!b) return null;
    if (b.topLevel || HAT_OPCODES.has(b.opcode)) return current;
    current = b.parent;
  }
  return null;
}

/**
 * Generate Mermaid for a single variable's data flow
 */
export function generateVariableFlowMermaid(varInfo) {
  const lines = ['graph LR'];
  let nid = 0;

  // Writers
  lines.push('  subgraph writers ["写入"]');
  for (const w of varInfo.writers) {
    const id = `w${nid++}`;
    lines.push(`    ${id}["📝 ${sanitize(w.targetName)}<br/><small>${sanitize(w.blockText)}</small>"]`);
  }
  lines.push('  end');

  // Variable node
  const varNode = `var_${varInfo.id.replace(/[^a-zA-Z0-9]/g, '')}`;
  lines.push(`  ${varNode}{{"📦 ${sanitize(varInfo.name)}"}}`);

  // Readers
  lines.push('  subgraph readers ["读取"]');
  for (const r of varInfo.readers) {
    const id = `r${nid++}`;
    lines.push(`    ${id}["👁️ ${sanitize(r.targetName)}<br/><small>${sanitize(r.blockText)}</small>"]`);
  }
  lines.push('  end');

  // Edges
  nid = 0;
  for (let i = 0; i < varInfo.writers.length; i++) {
    lines.push(`  w${nid++} --> ${varNode}`);
  }
  nid = 0;
  for (let i = 0; i < varInfo.readers.length; i++) {
    lines.push(`  ${varNode} --> r${nid++}`);
  }

  lines.push('  classDef writeNode fill:#FF5722,color:#fff');
  lines.push('  classDef readNode fill:#4CAF50,color:#fff');
  lines.push('  classDef varNode fill:#2196F3,color:#fff');

  return lines.join('\n');
}
