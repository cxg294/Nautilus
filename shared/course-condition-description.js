// 前后端共用的条件转译规则；不执行课包脚本。
function parse(source) {
    if (source.length > 8000)
        throw new Error('Expression too long');
    const tokens = [];
    let rest = source.trim().replace(/^return\s+/, '').replace(/;$/, '').trim();
    while (rest) {
        const match = /^(?:===|!==|==|!=|>=|<=|&&|\|\||[()<>]|-?\d+(?:\.\d+)?|[A-Za-z_$][\w$]*)/.exec(rest);
        if (!match || tokens.length >= 512)
            throw new Error('Unsupported expression');
        tokens.push(match[0]);
        rest = rest.slice(match[0].length).trimStart();
    }
    let position = 0;
    const precedence = { '||': 1, '&&': 2, '==': 3, '!=': 3, '===': 3, '!==': 3, '>': 4, '<': 4, '>=': 4, '<=': 4 };
    function expression(minimum = 1, depth = 0) {
        if (depth > 40)
            throw new Error('Expression too deep');
        const token = tokens[position++];
        let left;
        if (token === '(') {
            left = expression(1, depth + 1);
            if (tokens[position++] !== ')')
                throw new Error('Unclosed group');
        }
        else if (token && /^(?:-?\d+(?:\.\d+)?|[A-Za-z_$][\w$]*)$/.test(token)) {
            left = { kind: 'value', value: token };
        }
        else
            throw new Error('Missing operand');
        while ((precedence[tokens[position]] || 0) >= minimum) {
            const op = tokens[position++];
            left = { kind: 'binary', op, left, right: expression(precedence[op] + 1, depth + 1) };
        }
        return left;
    }
    const result = expression();
    if (position !== tokens.length)
        throw new Error('Trailing code');
    return result;
}
export function describeCondition(source) {
    if (!source?.trim())
        return { text: '未提供条件脚本', translated: false, notes: [] };
    const notes = new Set();
    const numeric = (value) => /^-?\d+(?:\.\d+)?$/.test(value);
    function label(value) {
        if (numeric(value))
            return value;
        if (value === 'true')
            return '真';
        if (value === 'false')
            return '假';
        if (value === 'UserOrderGrade') {
            notes.add('年级编码尚未映射为实际年级。');
            return '年级编码';
        }
        if (value === 'UserUnitLearningDuration') {
            notes.add('学习时长的单位尚未确认，数值按课包原值展示。');
            return '本课学习时长';
        }
        const clicked = /^var_out_Arrangement_\d+_Node_(\d+)_AnimationInteraction_\d+_(Npc|Spine)_(\d+)_isOnclick$/.exec(value);
        if (clicked)
            return `${clicked[2] === 'Npc' ? '角色' : '动画'}对象 ${clicked[3]}（节点 ${clicked[1]}）的点击标记`;
        if (/^var_out_Arrangement_\d+_Node_\d+_AnimationInteraction_\d+_device_\d+_Pad$/.test(value))
            return '平板设备标记';
        notes.add('部分变量尚无业务释义，保留原变量名。');
        return `变量「${value}」`;
    }
    function render(expr) {
        if (expr.kind === 'value') {
            if (expr.value === 'true')
                return '条件始终成立';
            if (expr.value === 'false')
                return '条件始终不成立';
            // Bare variable truthiness is not necessarily a boolean comparison.
            throw new Error('Unsupported truthiness');
        }
        const { left, right, op } = expr;
        if (op === '&&' || op === '||') {
            // Fold only an inclusive numeric range on exactly the same variable.
            if (op === '&&' && left.kind === 'binary' && right.kind === 'binary' && left.op === '>=' && right.op === '<='
                && left.left.kind === 'value' && right.left.kind === 'value' && left.left.value === right.left.value
                && left.right.kind === 'value' && right.right.kind === 'value' && !numeric(left.left.value)
                && !['true', 'false'].includes(left.left.value) && numeric(left.right.value) && numeric(right.right.value)) {
                const from = left.right.value;
                const to = right.right.value;
                if (Number(from) <= Number(to))
                    return Number(from) === Number(to)
                        ? `${label(left.left.value)}等于 ${from}`
                        : `${label(left.left.value)}在 ${from}～${to} 之间（含两端）`;
            }
            return `（${render(left)}）${op === '&&' ? '并且' : '或者'}（${render(right)}）`;
        }
        if (left.kind !== 'value' || right.kind !== 'value')
            throw new Error('Unsupported comparison');
        if (numeric(left.value) && numeric(right.value)) {
            const a = Number(left.value);
            const b = Number(right.value);
            if (!Number.isFinite(a) || !Number.isFinite(b))
                throw new Error('Invalid number');
            const outcomes = { '==': a === b, '===': a === b, '!=': a !== b, '!==': a !== b, '>': a > b, '<': a < b, '>=': a >= b, '<=': a <= b };
            return outcomes[op] ? '条件始终成立' : '条件始终不成立';
        }
        const operators = { '==': '等于', '===': '严格等于', '!=': '不等于', '!==': '不严格等于', '>': '大于', '<': '小于', '>=': '大于或等于', '<=': '小于或等于' };
        if ((op === '==' || op === '===') && right.value === 'true') {
            const name = label(left.value);
            if (name.endsWith('的点击标记'))
                return `${name.slice(0, -5)}被点击`;
            if (name === '平板设备标记')
                return '设备为平板（Pad）';
        }
        return `${label(left.value)}${operators[op]} ${label(right.value)}`;
    }
    try {
        const text = render(parse(source));
        return { text, translated: true, notes: [...notes] };
    }
    catch {
        return { text: '自定义条件，暂不能可靠转译', translated: false, notes: [] };
    }
}
