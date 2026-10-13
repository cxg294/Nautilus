import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeCondition as describe } from '../../../shared/course-condition-description.js';
const click = 'var_out_Arrangement_17095_Node_167301_AnimationInteraction_134453_Npc_1157890_isOnclick';
const spine = click.replace('Npc_1157890', 'Spine_1157891');
const pad = 'var_out_Arrangement_17095_Node_167285_AnimationInteraction_134486_device_1_Pad';

test('实际年级范围和同值范围，不擅自将编码映射为年级', () => {
  assert.deepEqual(describe('( UserOrderGrade >= 6 && UserOrderGrade <= 9 )'), {
    text: '年级编码在 6～9 之间（含两端）', translated: true, notes: ['年级编码尚未映射为实际年级。']
  });
  assert.equal(describe('UserOrderGrade >= 5 && UserOrderGrade <= 5').text, '年级编码等于 5');
  assert.match(describe('UserOrderGrade > 5 && UserOrderGrade < 9').text, /大于 5.*并且.*小于 9/);
});
test('真实点击与设备条件转为动作说明，false 不误译为已点击', () => {
  assert.equal(describe(`${click} == true || ${spine} == true`).text, '（角色对象 1157890（节点 167301）被点击）或者（动画对象 1157891（节点 167301）被点击）');
  assert.equal(describe(`${pad} == true`).text, '设备为平板（Pad）');
  assert.match(describe(`${click} == false`).text, /点击标记等于 假$/);
  assert.match(describe(`${pad} != true`).text, /不等于 真/);
});
test('兜底脚本只说明恒成立，不猜测执行顺序；学习时长不编造单位', () => {
  assert.equal(describe('1 === 1').text, '条件始终成立');
  assert.equal(describe('1 > 2').text, '条件始终不成立');
  const duration = describe('(UserUnitLearningDuration >= 1 && UserUnitLearningDuration <= 3300)');
  assert.match(duration.text, /1～3300/);
  assert.match(duration.notes[0], /单位尚未确认/);
});
test('保留混合逻辑优先级、严格比较与未知变量名', () => {
  assert.equal(describe('return a === 1 || b === 2 && c !== 3;').text, '（变量「a」严格等于 1）或者（（变量「b」严格等于 2）并且（变量「c」不严格等于 3））');
  assert.equal(describe('(a === 1 || b === 2) && c !== 3').text, '（（变量「a」严格等于 1）或者（变量「b」严格等于 2））并且（变量「c」不严格等于 3）');
  assert.equal(describe('a === 1').notes.length, 1);
});
test('未知语法、函数、语句、畸形和过长输入整体回退，不执行、不部分转译', () => {
  for (const expression of ['a === 1; alert(1)', 'check()', 'a.b === 1', 'a === "text"', 'a = 1', '(a > 1', 'a >', 'a', '!', '('.repeat(60) + 'true' + ')'.repeat(60), 'a'.repeat(8001)]) {
    assert.equal(describe(expression).translated, false, expression);
  }
  assert.equal(describe('').text, '未提供条件脚本');
});
