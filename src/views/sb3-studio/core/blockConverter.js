/**
 * Block Converter - Translates Scratch opcodes to human-readable Chinese text
 */

// Scratch opcode → Chinese label mapping
const OPCODE_LABELS = {
  // Events
  event_whenflagclicked: '当 🟢 被点击',
  event_whenkeypressed: '当按下 [{KEY_OPTION}] 键',
  event_whenthisspriteclicked: '当角色被点击',
  event_whenstageclicked: '当舞台被点击',
  event_whenbackdropswitchesto: '当背景切换到 [{BACKDROP}]',
  event_whengreaterthan: '当 [{WHENGREATERTHANMENU}] > {VALUE}',
  event_whenbroadcastreceived: '当接收到 [{BROADCAST_OPTION}]',
  event_broadcast: '广播 {BROADCAST_INPUT}',
  event_broadcastandwait: '广播 {BROADCAST_INPUT} 并等待',
  // Motion
  motion_movesteps: '移动 {STEPS} 步',
  motion_turnright: '右转 ↻ {DEGREES} 度',
  motion_turnleft: '左转 ↺ {DEGREES} 度',
  motion_goto: '移到 {TO}',
  motion_gotoxy: '移到 x:{X} y:{Y}',
  motion_glideto: '在 {SECS} 秒内滑行到 {TO}',
  motion_glidesecstoxy: '在 {SECS} 秒内滑行到 x:{X} y:{Y}',
  motion_pointindirection: '面向 {DIRECTION} 方向',
  motion_pointtowards: '面向 {TOWARDS}',
  motion_changexby: '将 x 坐标增加 {DX}',
  motion_setx: '将 x 坐标设为 {X}',
  motion_changeyby: '将 y 坐标增加 {DY}',
  motion_sety: '将 y 坐标设为 {Y}',
  motion_ifonedgebounce: '碰到边缘就反弹',
  motion_setrotationstyle: '将旋转方式设为 [{STYLE}]',
  motion_xposition: 'x 坐标',
  motion_yposition: 'y 坐标',
  motion_direction: '方向',
  // Looks
  looks_sayforsecs: '说 {MESSAGE} {SECS} 秒',
  looks_say: '说 {MESSAGE}',
  looks_thinkforsecs: '思考 {MESSAGE} {SECS} 秒',
  looks_think: '思考 {MESSAGE}',
  looks_switchcostumeto: '换成 {COSTUME} 造型',
  looks_nextcostume: '下一个造型',
  looks_switchbackdropto: '换成 {BACKDROP} 背景',
  looks_nextbackdrop: '下一个背景',
  looks_changesizeby: '将大小增加 {CHANGE}',
  looks_setsizeto: '将大小设为 {SIZE} %',
  looks_changeeffectby: '将 [{EFFECT}] 特效增加 {CHANGE}',
  looks_seteffectto: '将 [{EFFECT}] 特效设为 {VALUE}',
  looks_cleargraphiceffects: '清除图形特效',
  looks_show: '显示',
  looks_hide: '隐藏',
  looks_gotofrontback: '移到最 [{FRONT_BACK}] 层',
  looks_goforwardbackwardlayers: '[{FORWARD_BACKWARD}] {NUM} 层',
  looks_costumenumbername: '造型 [{NUMBER_NAME}]',
  looks_backdropnumbername: '背景 [{NUMBER_NAME}]',
  looks_size: '大小',
  // Sound
  sound_playuntildone: '播放声音 {SOUND_MENU} 直到播完',
  sound_play: '播放声音 {SOUND_MENU}',
  sound_stopallsounds: '停止所有声音',
  sound_changeeffectby: '将 [{EFFECT}] 音效增加 {VALUE}',
  sound_seteffectto: '将 [{EFFECT}] 音效设为 {VALUE}',
  sound_cleareffects: '清除声音特效',
  sound_changevolumeby: '将音量增加 {VOLUME}',
  sound_setvolumeto: '将音量设为 {VOLUME} %',
  sound_volume: '音量',
  // Control
  control_wait: '等待 {DURATION} 秒',
  control_repeat: '重复 {TIMES} 次',
  control_forever: '重复执行',
  control_if: '如果 {CONDITION} 那么',
  control_if_else: '如果 {CONDITION} 那么 / 否则',
  control_wait_until: '等待直到 {CONDITION}',
  control_repeat_until: '重复执行直到 {CONDITION}',
  control_stop: '停止 [{STOP_OPTION}]',
  control_start_as_clone: '当作为克隆体启动时',
  control_create_clone_of: '克隆 {CLONE_OPTION}',
  control_delete_this_clone: '删除此克隆体',
  // Sensing
  sensing_touchingobject: '碰到 {TOUCHINGOBJECTMENU}',
  sensing_touchingcolor: '碰到颜色 {COLOR}',
  sensing_coloristouchingcolor: '颜色 {COLOR} 碰到 {COLOR2}',
  sensing_distanceto: '到 {DISTANCETOMENU} 的距离',
  sensing_askandwait: '询问 {QUESTION} 并等待',
  sensing_answer: '回答',
  sensing_keypressed: '按下 {KEY_OPTION} 键?',
  sensing_mousedown: '按下鼠标?',
  sensing_mousex: '鼠标的 x 坐标',
  sensing_mousey: '鼠标的 y 坐标',
  sensing_setdragmode: '将拖放模式设为 [{DRAG_MODE}]',
  sensing_loudness: '响度',
  sensing_timer: '计时器',
  sensing_resettimer: '计时器归零',
  sensing_of: '{OBJECT} 的 [{PROPERTY}]',
  sensing_current: '当前 [{CURRENTMENU}]',
  sensing_dayssince2000: '2000年以来的天数',
  sensing_username: '用户名',
  // Operators
  operator_add: '{NUM1} + {NUM2}',
  operator_subtract: '{NUM1} - {NUM2}',
  operator_multiply: '{NUM1} * {NUM2}',
  operator_divide: '{NUM1} / {NUM2}',
  operator_random: '在 {FROM} 到 {TO} 之间取随机数',
  operator_gt: '{OPERAND1} > {OPERAND2}',
  operator_lt: '{OPERAND1} < {OPERAND2}',
  operator_equals: '{OPERAND1} = {OPERAND2}',
  operator_and: '{OPERAND1} 且 {OPERAND2}',
  operator_or: '{OPERAND1} 或 {OPERAND2}',
  operator_not: '{OPERAND} 不成立',
  operator_join: '连接 {STRING1} 和 {STRING2}',
  operator_letter_of: '{STRING} 的第 {LETTER} 个字符',
  operator_length: '{STRING} 的长度',
  operator_contains: '{STRING1} 包含 {STRING2}',
  operator_mod: '{NUM1} 除以 {NUM2} 的余数',
  operator_round: '四舍五入 {NUM}',
  operator_mathop: '{NUM} 的 [{OPERATOR}]',
  // Data
  data_setvariableto: '将 [{VARIABLE}] 设为 {VALUE}',
  data_changevariableby: '将 [{VARIABLE}] 增加 {VALUE}',
  data_showvariable: '显示变量 [{VARIABLE}]',
  data_hidevariable: '隐藏变量 [{VARIABLE}]',
  data_addtolist: '将 {ITEM} 加入 [{LIST}]',
  data_deleteoflist: '删除 [{LIST}] 的第 {INDEX} 项',
  data_deletealloflist: '删除 [{LIST}] 的全部项目',
  data_insertatlist: '在 [{LIST}] 的第 {INDEX} 项插入 {ITEM}',
  data_replaceitemoflist: '将 [{LIST}] 的第 {INDEX} 项替换为 {ITEM}',
  data_itemoflist: '[{LIST}] 的第 {INDEX} 项',
  data_itemnumoflist: '[{LIST}] 中 {ITEM} 的项目编号',
  data_lengthoflist: '[{LIST}] 的项目数',
  data_listcontainsitem: '[{LIST}] 包含 {ITEM}',
  data_showlist: '显示列表 [{LIST}]',
  data_hidelist: '隐藏列表 [{LIST}]',
  // Custom blocks
  procedures_definition: '定义 {custom_block}',
  procedures_call: '调用 {mutation}',
  procedures_prototype: '[原型]',
  argument_reporter_string_number: '参数 [{VALUE}]',
  argument_reporter_boolean: '布尔参数 [{VALUE}]',
  // Pen extension
  pen_clear: '全部擦除',
  pen_stamp: '图章',
  pen_penDown: '落笔',
  pen_penUp: '抬笔',
  pen_setPenColorToColor: '将笔的颜色设为 {COLOR}',
  pen_changePenColorParamBy: '将笔的 [{COLOR_PARAM}] 增加 {VALUE}',
  pen_setPenColorParamTo: '将笔的 [{COLOR_PARAM}] 设为 {VALUE}',
  pen_changePenSizeBy: '将笔的粗细增加 {SIZE}',
  pen_setPenSizeTo: '将笔的粗细设为 {SIZE}',
  // Music extension
  music_playDrumForBeats: '演奏鼓 {DRUM} {BEATS} 拍',
  music_restForBeats: '休止 {BEATS} 拍',
  music_playNoteForBeats: '演奏音符 {NOTE} {BEATS} 拍',
  music_setInstrument: '将乐器设为 {INSTRUMENT}',
  music_setTempo: '将节奏设为 {TEMPO}',
  music_changeTempo: '将节奏增加 {TEMPO}',
  music_getTempo: '演奏速度',
};

// Hat block opcodes (script entry points)
export const HAT_OPCODES = new Set([
  'event_whenflagclicked', 'event_whenkeypressed', 'event_whenthisspriteclicked',
  'event_whenstageclicked', 'event_whenbackdropswitchesto', 'event_whengreaterthan',
  'event_whenbroadcastreceived', 'control_start_as_clone', 'procedures_definition',
]);

/**
 * Resolve an input/field value from a block
 */
function resolveValue(block, key, blocks) {
  // Check fields first
  if (block.fields && block.fields[key]) {
    return block.fields[key][0];
  }
  // Check inputs
  if (block.inputs && block.inputs[key]) {
    const input = block.inputs[key];
    const inner = input[1];
    if (Array.isArray(inner)) {
      // Literal value [type, value, ...]
      return inner[1];
    }
    if (typeof inner === 'string' && blocks[inner]) {
      // Reference to another block → recurse
      return blockToText(inner, blocks);
    }
  }
  return '?';
}

/**
 * Convert a single block to human-readable text
 */
export function blockToText(blockId, blocks) {
  const block = blocks[blockId];
  if (!block || typeof block !== 'object') return String(blockId);

  const opcode = block.opcode;

  // Custom block call - extract proccode from mutation
  if (opcode === 'procedures_call' && block.mutation) {
    return `调用 [${block.mutation.proccode || '自定义积木'}]`;
  }
  if (opcode === 'procedures_definition') {
    // Find the prototype to get proccode
    const protoId = block.inputs?.custom_block?.[1];
    if (protoId && blocks[protoId] && blocks[protoId].mutation) {
      return `定义 [${blocks[protoId].mutation.proccode}]`;
    }
    return '定义 [自定义积木]';
  }

  let template = OPCODE_LABELS[opcode];
  if (!template) {
    // Unknown opcode - show raw name (for extensions)
    return opcode;
  }

  // Replace placeholders: {KEY} and [{KEY}]
  template = template.replace(/\[?\{(\w+)\}\]?/g, (match, key) => {
    const val = resolveValue(block, key, blocks);
    if (match.startsWith('[')) {
      return `[${val}]`;
    }
    return String(val);
  });

  return template;
}

/**
 * Extract all scripts from a target's blocks as arrays of text lines
 */
export function extractScripts(target) {
  const blocks = target.blocks || {};
  const scripts = [];

  for (const [id, block] of Object.entries(blocks)) {
    if (typeof block !== 'object') continue;
    if (!block.topLevel) continue;

    const lines = [];
    let currentId = id;
    let depth = 0;

    while (currentId) {
      const b = blocks[currentId];
      if (!b || typeof b !== 'object') break;

      const text = blockToText(currentId, blocks);
      lines.push({ text, depth, opcode: b.opcode, blockId: currentId });

      // Handle substacks (if/else/repeat bodies)
      if (b.inputs?.SUBSTACK) {
        const subId = b.inputs.SUBSTACK[1];
        if (typeof subId === 'string') {
          let subCurrent = subId;
          while (subCurrent) {
            const sb = blocks[subCurrent];
            if (!sb) break;
            lines.push({ text: blockToText(subCurrent, blocks), depth: depth + 1, opcode: sb.opcode, blockId: subCurrent });
            subCurrent = sb.next;
          }
        }
      }
      if (b.inputs?.SUBSTACK2) {
        const subId2 = b.inputs.SUBSTACK2[1];
        if (typeof subId2 === 'string') {
          lines.push({ text: '否则', depth, opcode: '_else', blockId: currentId + '_else' });
          let subCurrent = subId2;
          while (subCurrent) {
            const sb = blocks[subCurrent];
            if (!sb) break;
            lines.push({ text: blockToText(subCurrent, blocks), depth: depth + 1, opcode: sb.opcode, blockId: subCurrent });
            subCurrent = sb.next;
          }
        }
      }

      currentId = b.next;
    }

    if (lines.length > 0) {
      scripts.push({
        hat: lines[0],
        lines,
        blockCount: lines.length,
        isHat: HAT_OPCODES.has(lines[0].opcode),
      });
    }
  }

  return scripts;
}

/**
 * Extract orphan blocks — topLevel blocks that don't start with a hat opcode
 * These are "loose" blocks not connected to any script chain
 */
export function extractOrphans(target) {
  const blocks = target.blocks || {};
  const orphans = [];

  for (const [id, block] of Object.entries(blocks)) {
    if (typeof block !== 'object' || !block.opcode) continue;
    if (!block.topLevel) continue;
    if (HAT_OPCODES.has(block.opcode)) continue;

    // Count blocks in this orphan chain
    let count = 0;
    let currentId = id;
    const lines = [];
    while (currentId) {
      const b = blocks[currentId];
      if (!b) break;
      lines.push({ text: blockToText(currentId, blocks), opcode: b.opcode, blockId: currentId });
      count++;
      currentId = b.next;
    }

    orphans.push({
      rootId: id,
      rootOpcode: block.opcode,
      lines,
      blockCount: count,
    });
  }

  return orphans;
}

/**
 * Extract referenced resources (variables, broadcasts) for a given target
 */
export function extractReferencedResources(target) {
  const blocks = target.blocks || {};
  const variables = {}; // { name: { reads: number, writes: number } }
  const broadcasts = { sends: [], receives: [] }; // unique names
  const sendSet = new Set();
  const recvSet = new Set();

  for (const [, block] of Object.entries(blocks)) {
    if (typeof block !== 'object' || !block.opcode) continue;

    const opcode = block.opcode;

    // Variable reads: data_variable
    if (opcode === 'data_variable') {
      const varName = block.fields?.VARIABLE?.[0];
      if (varName) {
        if (!variables[varName]) variables[varName] = { reads: 0, writes: 0 };
        variables[varName].reads++;
      }
    }

    // Variable writes: data_setvariableto, data_changevariableby
    if (opcode === 'data_setvariableto' || opcode === 'data_changevariableby') {
      const varName = block.fields?.VARIABLE?.[0];
      if (varName) {
        if (!variables[varName]) variables[varName] = { reads: 0, writes: 0 };
        variables[varName].writes++;
      }
    }

    // List operations
    if (opcode.startsWith('data_') && block.fields?.LIST) {
      const listName = block.fields.LIST[0];
      if (listName) {
        if (!variables[listName]) variables[listName] = { reads: 0, writes: 0 };
        if (['data_lengthoflist', 'data_itemoflist', 'data_listcontainsitem', 'data_itemnumoflist'].includes(opcode)) {
          variables[listName].reads++;
        } else {
          variables[listName].writes++;
        }
      }
    }

    // Broadcast sends
    if (opcode === 'event_broadcast' || opcode === 'event_broadcastandwait') {
      // Try to get broadcast name from input
      const input = block.inputs?.BROADCAST_INPUT;
      if (input && Array.isArray(input[1]) && input[1][1]) {
        const name = input[1][1];
        if (!sendSet.has(name)) { sendSet.add(name); broadcasts.sends.push(name); }
      }
    }

    // Broadcast receives
    if (opcode === 'event_whenbroadcastreceived') {
      const name = block.fields?.BROADCAST_OPTION?.[0];
      if (name && !recvSet.has(name)) { recvSet.add(name); broadcasts.receives.push(name); }
    }
  }

  return {
    variables: Object.entries(variables).map(([name, stats]) => ({ name, ...stats })),
    broadcasts,
  };
}

/**
 * Get the opcode label (without template substitution)
 */
export function getOpcodeLabel(opcode) {
  return OPCODE_LABELS[opcode] || opcode;
}

/**
 * Register additional opcode labels (for extensions)
 */
export function registerOpcodes(extraLabels) {
  Object.assign(OPCODE_LABELS, extraLabels);
}
