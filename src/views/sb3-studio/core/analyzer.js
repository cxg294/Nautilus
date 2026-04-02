/**
 * Project Analyzer - Computes statistics and diagnostics for SB3 projects
 */
import { HAT_OPCODES } from './blockConverter';

/**
 * Analyze a project and return stats + diagnostics 
 */
export function analyzeProject(project) {
  const targets = project.targets || [];
  const stats = computeStats(targets);
  const diagnostics = runDiagnostics(targets);
  return { stats, diagnostics };
}

/**
 * Compute global statistics
 */
function computeStats(targets) {
  let spriteCount = 0;
  let blockCount = 0;
  let scriptCount = 0;
  let costumeCount = 0;
  let soundCount = 0;
  let variableCount = 0;
  let listCount = 0;
  const broadcastSet = new Set();

  for (const target of targets) {
    if (!target.isStage) spriteCount++;

    const blocks = target.blocks || {};
    for (const [, block] of Object.entries(blocks)) {
      if (typeof block === 'object' && block.opcode) {
        blockCount++;
        if (block.topLevel && HAT_OPCODES.has(block.opcode)) {
          scriptCount++;
        }
      }
    }

    costumeCount += (target.costumes || []).length;
    soundCount += (target.sounds || []).length;

    for (const _v of Object.values(target.variables || {})) {
      variableCount++;
    }
    for (const _l of Object.values(target.lists || {})) {
      listCount++;
    }
    for (const b of Object.values(target.broadcasts || {})) {
      broadcastSet.add(b);
    }
  }

  return {
    spriteCount,
    blockCount,
    scriptCount,
    costumeCount,
    soundCount,
    variableCount,
    listCount,
    broadcastCount: broadcastSet.size,
  };
}

/**
 * Compute variable/list read-write statistics across all targets
 */
export function computeVarStats(targets) {
  // Build variable registry: varId → { name, scope, targetName, reads, writes, referencedBy }
  const varMap = new Map();
  const listMap = new Map();

  // Register all variables and lists
  for (const target of targets) {
    const scope = target.isStage ? 'global' : target.name;

    for (const [id, v] of Object.entries(target.variables || {})) {
      varMap.set(id, {
        id, name: v[0], value: v[1], scope, targetName: target.name,
        reads: 0, writes: 0, referencedBy: {},
      });
    }
    for (const [id, l] of Object.entries(target.lists || {})) {
      listMap.set(id, {
        id, name: l[0], value: l[1], scope, targetName: target.name,
        reads: 0, writes: 0, referencedBy: {},
      });
    }
  }

  // Scan all blocks for variable/list usage
  const varWriteOps = new Set(['data_setvariableto', 'data_changevariableby']);
  // eslint-disable-next-line no-unused-vars
  const _varShowHideOps = new Set(['data_showvariable', 'data_hidevariable']);

  for (const target of targets) {
    const blocks = target.blocks || {};
    for (const [, block] of Object.entries(blocks)) {
      if (typeof block !== 'object' || !block.opcode) continue;
      const opcode = block.opcode;

      // Variable references
      if (block.fields?.VARIABLE) {
        const varId = block.fields.VARIABLE[1];
        const varInfo = varMap.get(varId);
        if (varInfo) {
          if (varWriteOps.has(opcode)) {
            varInfo.writes++;
          } else {
            varInfo.reads++;
          }
          if (!varInfo.referencedBy[target.name]) {
            varInfo.referencedBy[target.name] = { reads: 0, writes: 0 };
          }
          if (varWriteOps.has(opcode)) {
            varInfo.referencedBy[target.name].writes++;
          } else {
            varInfo.referencedBy[target.name].reads++;
          }
        }
      }

      // List references
      if (block.fields?.LIST) {
        const listId = block.fields.LIST[1];
        const listInfo = listMap.get(listId);
        if (listInfo) {
          const isWrite = opcode.includes('delete') || opcode.includes('add') ||
            opcode.includes('insert') || opcode.includes('replace') || opcode.includes('set');
          if (isWrite) {
            listInfo.writes++;
          } else {
            listInfo.reads++;
          }
          if (!listInfo.referencedBy[target.name]) {
            listInfo.referencedBy[target.name] = { reads: 0, writes: 0 };
          }
          if (isWrite) {
            listInfo.referencedBy[target.name].writes++;
          } else {
            listInfo.referencedBy[target.name].reads++;
          }
        }
      }
    }
  }

  return { variables: [...varMap.values()], lists: [...listMap.values()] };
}

/**
 * Compute broadcast send/receive relationships
 */
export function computeBroadcastStats(targets) {
  const broadcastMap = new Map(); // broadcastName → { senders, receivers, isDynamic }

  // Collect all registered broadcasts
  for (const target of targets) {
    for (const [, name] of Object.entries(target.broadcasts || {})) {
      if (!broadcastMap.has(name)) {
        broadcastMap.set(name, { name, senders: [], receivers: [], isDynamic: false });
      }
    }
  }

  // Scan blocks
  for (const target of targets) {
    const blocks = target.blocks || {};
    for (const [, block] of Object.entries(blocks)) {
      if (typeof block !== 'object' || !block.opcode) continue;

      if (block.opcode === 'event_whenbroadcastreceived') {
        const bcName = block.fields?.BROADCAST_OPTION?.[0];
        if (bcName) {
          if (!broadcastMap.has(bcName)) {
            broadcastMap.set(bcName, { name: bcName, senders: [], receivers: [], isDynamic: false });
          }
          broadcastMap.get(bcName).receivers.push(target.name);
        }
      }

      if (block.opcode === 'event_broadcast' || block.opcode === 'event_broadcastandwait') {
        const input = block.inputs?.BROADCAST_INPUT;
        if (input) {
          const inner = input[1];
          if (Array.isArray(inner) && inner[1]) {
            // Shadow block - static broadcast
            // inner = [11, "broadcastName", "broadcastId"]  
            const bcName = inner[1];
            if (typeof bcName === 'string') {
              if (!broadcastMap.has(bcName)) {
                broadcastMap.set(bcName, { name: bcName, senders: [], receivers: [], isDynamic: false });
              }
              broadcastMap.get(bcName).senders.push({
                target: target.name,
                isWait: block.opcode === 'event_broadcastandwait',
              });
            }
          } else if (typeof inner === 'string') {
            // Dynamic broadcast (variable/expression)
            // We can't know the broadcast name statically
            const dynamicKey = `[动态] ${target.name}`;
            if (!broadcastMap.has(dynamicKey)) {
              broadcastMap.set(dynamicKey, {
                name: dynamicKey, senders: [], receivers: [], isDynamic: true,
              });
            }
            broadcastMap.get(dynamicKey).senders.push({
              target: target.name,
              isWait: block.opcode === 'event_broadcastandwait',
            });
          }
        }
      }
    }
  }

  // Determine status for each broadcast
  return [...broadcastMap.values()].map(bc => {
    let status;
    if (bc.isDynamic) {
      status = 'dynamic';
    } else if (bc.senders.length > 0 && bc.receivers.length > 0) {
      status = 'normal';
    } else if (bc.senders.length > 0 && bc.receivers.length === 0) {
      status = 'send-only';
    } else if (bc.senders.length === 0 && bc.receivers.length > 0) {
      status = 'receive-only';
    } else {
      status = 'unused';
    }
    return { ...bc, status };
  });
}

/**
 * Run diagnostics on the project
 */
function runDiagnostics(targets) {
  const issues = [];
  const { variables, lists } = computeVarStats(targets);

  // Unused variables
  for (const v of variables) {
    if (v.reads === 0 && v.writes === 0) {
      issues.push({
        type: 'warning',
        category: '无效变量',
        message: `变量「${v.name}」(${v.scope === 'global' ? '全局' : v.targetName}) 从未被读写`,
        targetName: v.targetName,
      });
    }
  }

  // Unused lists
  for (const l of lists) {
    if (l.reads === 0 && l.writes === 0) {
      issues.push({
        type: 'warning',
        category: '无效列表',
        message: `列表「${l.name}」(${l.scope === 'global' ? '全局' : l.targetName}) 从未被读写`,
        targetName: l.targetName,
      });
    }
  }

  // Empty sprites (no blocks)
  for (const target of targets) {
    if (target.isStage) continue;
    const blockCount = Object.values(target.blocks || {}).filter(b => typeof b === 'object').length;
    if (blockCount === 0) {
      issues.push({
        type: 'warning',
        category: '空角色',
        message: `角色「${target.name}」没有任何积木块`,
        targetName: target.name,
      });
    }
  }

  // Orphan broadcasts
  const broadcastStats = computeBroadcastStats(targets);
  for (const bc of broadcastStats) {
    if (bc.status === 'send-only') {
      issues.push({
        type: 'warning',
        category: '孤立广播',
        message: `广播「${bc.name}」只有发送但没有接收`,
      });
    } else if (bc.status === 'receive-only') {
      issues.push({
        type: 'warning',
        category: '孤立广播',
        message: `广播「${bc.name}」只有接收但没有发送`,
      });
    }
  }

  // Large assets
  for (const target of targets) {
    for (const _costume of target.costumes || []) {
      // We can't check file size from project.json alone,
      // but we can flag based on known large formats
    }
  }

  return issues;
}
