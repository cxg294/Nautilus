import type { Character, ProjectSettings, SourceRef, StageSequence } from '../types/sequence';

const source = (blockId: string): SourceRef => ({
  blockId,
  tableIndex: 0,
  columnName: '逐字稿',
});

const settings: ProjectSettings = {
  backgroundKey: 'workshop',
  globalRate: 1,
  typingSpeed: 42,
  defaultPause: 420,
};

const characters: Character[] = [
  {
    id: 'char_yuhang',
    name: '宇航',
    displayName: '宇航',
    color: '#4F7CAC',
    poses: [{ id: 'pose_yuhang_default', name: '默认', imageUrl: '' }],
    defaultPoseId: 'pose_yuhang_default',
    courseRole: 'lead_instructor',
    ttsConfig: { engine: 'browser', rate: 1, pitch: 1 },
    scale: 1,
  },
  {
    id: 'char_xiaohetao',
    name: '小核桃',
    displayName: '小核桃',
    color: '#F59E0B',
    poses: [{ id: 'pose_xiaohetao_default', name: '默认', imageUrl: '' }],
    defaultPoseId: 'pose_xiaohetao_default',
    courseRole: 'supporting_character',
    ttsConfig: { engine: 'browser', rate: 1, pitch: 1 },
    scale: 0.9,
  },
  {
    id: 'char_wulahu',
    name: '乌拉乎',
    displayName: '乌拉乎',
    color: '#FF6B6B',
    poses: [
      { id: 'pose_wulahu_default', name: '默认', imageUrl: '' },
      { id: 'pose_wulahu_happy', name: '开心', imageUrl: '' },
      { id: 'pose_wulahu_surprised', name: '惊讶', imageUrl: '' },
      { id: 'pose_wulahu_confused', name: '疑惑', imageUrl: '' },
    ],
    defaultPoseId: 'pose_wulahu_default',
    courseRole: 'supporting_character',
    ttsConfig: { engine: 'browser', rate: 1, pitch: 1 },
    scale: 1,
  },
  {
    id: 'char_taozi',
    name: '桃子',
    displayName: '桃子',
    color: '#FFB6C1',
    poses: [
      { id: 'pose_taozi_default', name: '默认', imageUrl: '' },
      { id: 'pose_taozi_excited', name: '激动', imageUrl: '' },
      { id: 'pose_taozi_thinking', name: '思考', imageUrl: '' },
      { id: 'pose_taozi_starry', name: '星星眼', imageUrl: '' },
    ],
    defaultPoseId: 'pose_taozi_default',
    courseRole: 'supporting_character',
    voiceProfileRef: 'voice-taozi-v1',
    ttsConfig: { engine: 'browser', rate: 1, pitch: 1 },
    scale: 1,
  },
];

const sequences: StageSequence[] = [
  {
    id: 'teaching-1-1-what-is-programming',
    title: '讲解 1-1：什么是编程',
    durationHintSec: 70,
    teachingObjects: [
      { id: 'programming-language', kind: 'concept', title: '编程', description: '人与电脑沟通的语言' },
      { id: 'cpp-language', kind: 'concept', title: 'C++', description: '本节课使用的编程语言' },
      { id: 'create-with-code', kind: 'concept', title: '用编程创造', description: '游戏、应用和智能设备都能成为你的作品' },
    ],
    events: [
      { id: 't11-01', type: 'dialogue', actor: '宇航', pose: '默认', speakText: '编程是我们人类和电脑的一种交流方式。', visualCue: { target: 'programming-language', action: 'show' }, sourceRef: source('doxcn4vnIMUXc9Ql2HRdksNKQPb') },
      { id: 't11-02', type: 'dialogue', actor: '宇航', speakText: '就像我们用汉语、英语交流一样。', visualCue: { target: 'programming-language', action: 'focus' }, sourceRef: source('doxcnVNGziqKhdgnjHbtuznweyc') },
      { id: 't11-03', type: 'dialogue', actor: '宇航', speakText: '编程就是我们和电脑沟通的语言！', visualCue: { target: 'programming-language', action: 'pulse' }, sourceRef: source('doxcnljzE8LGUqfkfewkx4P3NVf') },
      { id: 't11-04', type: 'dialogue', actor: '宇航', speakText: '而 C++，就是这众多语言中的王者！', synthesisText: '而 C 加加，就是这众多语言中的王者！', visualCue: { target: 'cpp-language', action: 'show' }, sourceRef: source('doxcngJ70nX23ue7qU51E3ovxqh') },
      { id: 't11-05', type: 'dialogue', actor: '宇航', pose: '默认', speakText: '你知道吗？这些让人热血沸腾的游戏，都是用 C++ 打造的！', synthesisText: '你知道吗？这些让人热血沸腾的游戏，都是用 C 加加打造的！', sourceRef: source('doxcntyeOLGgi6UeXk6L7OvtNxg') },
      { id: 't11-06', type: 'dialogue', actor: '宇航', speakText: '手机上的常用应用，也是 C++ 的杰作！', synthesisText: '手机上的常用应用，也是 C 加加的杰作！', sourceRef: source('doxcnByHI5IC4kx0tU4WSOiXLlf') },
      { id: 't11-07', type: 'dialogue', actor: '宇航', speakText: '编程，就是高科技的象征！', sourceRef: source('doxcnEfVRauTSRTuWgLafiZ8vqg') },
      { id: 't11-08', type: 'dialogue', actor: '宇航', speakText: '它能让无人机在天空中翩翩起舞，也能为月球车指引探月的道路！', visualCue: { target: 'create-with-code', action: 'show' }, sourceRef: source('doxcnlAXZSJZs3Ok9oIYVhytQjw') },
      { id: 't11-09', type: 'dialogue', actor: '宇航', speakText: '只要你掌握了编程，这些奇迹，都将由你来创造！', visualCue: { target: 'create-with-code', action: 'focus' }, sourceRef: source('doxcnpW1y60njd5CFeXjXrsN1Ee') },
    ],
  },
  {
    id: 'teaching-1-2-programming-environment',
    title: '讲解 1-2：编程环境',
    durationHintSec: 40,
    teachingObjects: [
      { id: 'ide-task-goal', kind: 'ide-region', title: '任务目标区', description: '每关要完成什么，这里都会告诉你。' },
      { id: 'ide-code-editor', kind: 'ide-region', title: '代码区', description: '编写代码的主战场。' },
      { id: 'ide-terminal', kind: 'ide-region', title: '终端区', description: '点击运行后，在这里查看效果。' },
    ],
    events: [
      { id: 't12-01', type: 'dialogue', actor: '乌拉乎', pose: '疑惑', speakText: '还需要指令？', sourceRef: source('NPBWdxF2CoA5SQxMPLMcBGYbnoh') },
      { id: 't12-02', type: 'dialogue', actor: '桃子', pose: '思考', speakText: '看来是这样，而且给飞船输出指令要用到编程呢。', sourceRef: source('X5Hyda40aoXBAWx3kgScuz6Yncb') },
      { id: 't12-03', type: 'dialogue', actor: '乌拉乎', pose: '疑惑', speakText: '编程？我都还不会呢！', sourceRef: source('W58tdYRa5oA5mZxwOIhcm1gQnrd') },
      { id: 't12-04', type: 'dialogue', actor: '宇航', pose: '默认', speakText: '别担心，跟着我，保证你能搞定。没错！来，咱们先熟悉一下编程的环境。', sourceRef: source('MdtOdLjQlo0Fu8x09VIcCMO3nAd') },
      { id: 't12-05', type: 'dialogue', actor: '宇航', speakText: '瞧，这边是任务目标区，每关要干啥，这里都会告诉你。', visualCue: { target: 'ide-task-goal', action: 'show' }, sourceRef: source('Eq5udDfK6oQA34xElimcRka6nOg') },
      { id: 't12-06', type: 'dialogue', actor: '宇航', speakText: '中间这块地方，就是咱们的主战场，写代码就在这儿。', visualCue: { target: 'ide-code-editor', action: 'show' }, sourceRef: source('DqkedSWwToiK7Pxz6TXcppPknJe') },
      { id: 't12-07', type: 'dialogue', actor: '宇航', speakText: '写完以后，点一下运行，就能看到效果啦。', visualCue: { target: 'ide-code-editor', action: 'pulse' }, sourceRef: source('ZD7AdNvNtoadAwxNnfzcUfgonzg') },
      { id: 't12-08', type: 'dialogue', actor: '宇航', speakText: '效果展示就在这，通常我们都把它叫终端区。', visualCue: { target: 'ide-terminal', action: 'show' }, sourceRef: source('WcyCdmocWoFGRUxKWJAcSmxZnmg') },
      { id: 't12-09', type: 'dialogue', actor: '乌拉乎', pose: '开心', speakText: '那咱们还等啥，赶紧动手吧！', sourceRef: source('EjA0dM2ZWoLx33xSdYycOqP6nPP') },
      { id: 't12-10', type: 'dialogue', actor: '宇航', pose: '默认', speakText: '好嘞，那你现在知道咱们得在哪儿敲代码不？', sourceRef: source('UV5kd6V8joa9ARxdR18cIZ0Wnoc') },
    ],
  },
  {
    id: 'teaching-1-3-cout-statement',
    title: '讲解 1-3：cout 语句',
    durationHintSec: 90,
    teachingObjects: [
      {
        id: 'cpp-cout-output',
        kind: 'code',
        title: '输出指令',
        description: '把想说的内容显示在终端区。',
        language: 'cpp',
        normalizedCode: 'cout << "爱你孤身走暗巷" << endl;',
        tokens: [
          { id: 'cout', text: 'cout', meaning: '输出指令' },
          { id: 'open', text: ' << ', meaning: '开始输出' },
          { id: 'content', text: '"爱你孤身走暗巷"', meaning: '要输出的文字' },
          { id: 'close', text: ' << endl;', meaning: '换行并结束语句' },
        ],
      },
      { id: 'burger-analogy', kind: 'concept', title: '像做汉堡一样', description: '中间夹什么，就输出什么。' },
    ],
    events: [
      { id: 't13-01', type: 'dialogue', actor: '宇航', pose: '默认', speakText: '看来你已经开始上手编程了，现在我们就给飞船编写指令吧！', sourceRef: source('BBEgdBeZ9o6cC4xokUAcyjrfnag') },
      { id: 't13-02', type: 'dialogue', actor: '小核桃', speakText: '这段指令是什么啊？', sourceRef: source('HLSBd6oyfoUwmIxewt8c78v1nGg') },
      { id: 't13-03', type: 'dialogue', actor: '宇航', speakText: '指令是非常简单的一句话。', sourceRef: source('B2bpdo6zUoazqsxSVJRcboWCnFh') },
      { id: 't13-04', type: 'dialogue', actor: '乌拉乎', pose: '惊讶', speakText: '爱你不跪的模样？', sourceRef: source('EwYJdN2r1o9dKqxHNtsc7onNnef') },
      { id: 't13-05', type: 'dialogue', actor: '桃子', pose: '思考', speakText: '歌词也能当指令吗？', sourceRef: source('TmMEdajoIojuvJxLi5FcMgEQnce') },
      { id: 't13-06', type: 'dialogue', actor: '宇航', speakText: '咳，我也是一个爱音乐的人嘛。好了，我们还是快给飞船编写输出指令吧。', sourceRef: source('EOXadmYSwoAMHmxDbl9cfFeynHd') },
      { id: 't13-07', type: 'dialogue', actor: '宇航', speakText: '这里需要用到一个新招：cout 语句。用这个，就可以让飞船加速了！', synthesisText: '这里需要用到一个新招：C out 语句。用这个，就可以让飞船加速了！', visualCue: { target: 'cpp-cout-output', action: 'show' }, sourceRef: source('KMXsdMl1oo3SKhxxJKIco43jnPb') },
      { id: 't13-08', type: 'dialogue', actor: '乌拉乎', pose: '疑惑', speakText: '这些词儿我看着都头大，完全不懂啊。', sourceRef: source('Fz19dutpyoZV2kxznDqcMJz2n1c') },
      { id: 't13-09', type: 'dialogue', actor: '宇航', speakText: '别急，其实超简单的。cout 语句，就是 cout，加上两个尖括号，中间放你想说的内容。', synthesisText: '别急，其实超简单的。C out 语句，就是 C out，加上两个尖括号，中间放你想说的内容。', visualCue: { target: 'cpp-cout-output', action: 'reveal', tokens: ['cout', 'open', 'content'] }, sourceRef: source('NUEFd5aFKouuKtxKdCxcXhmTnvd') },
      { id: 't13-10', type: 'dialogue', actor: '宇航', speakText: '最后再来两个尖括号，和 endl，还有个分号。', synthesisText: '最后再来两个尖括号，和 end l，还有个分号。', visualCue: { target: 'cpp-cout-output', action: 'reveal', tokens: ['close'] }, sourceRef: source('ChyNdMN3MoYtPuxNChRcgArrnJe') },
      { id: 't13-11', type: 'dialogue', actor: '宇航', speakText: '它就会把这里的内容显示在终端区了。', visualCue: { target: 'cpp-cout-output', action: 'focus' }, sourceRef: source('VClQd3aLboMnEYxdwnDcddShnVj') },
      { id: 't13-12', type: 'dialogue', actor: '宇航', speakText: 'cout 语句就像做汉堡一样，中间夹啥，就输出啥。', synthesisText: 'C out 语句就像做汉堡一样，中间夹啥，就输出啥。', visualCue: { target: 'burger-analogy', action: 'show' }, sourceRef: source('Ixy7dhBqOoAWfWxoQCXcgkv9nqd') },
      { id: 't13-13', type: 'dialogue', actor: '宇航', speakText: '咱们得给飞船发指令，所以中间就写这句话，记得文字得用双引号包起来！', visualCue: { target: 'cpp-cout-output', action: 'focus', tokens: ['content'] }, sourceRef: source('C0VfdKbVpoo7UPx4I20cw1FLnfe') },
      { id: 't13-14', type: 'dialogue', actor: '乌拉乎', pose: '开心', speakText: '队长，这回你知道了吗？', sourceRef: source('LFvedtuWeoncKWx52ouca85lnIb') },
    ],
  },
];

export function createCurrentCourseStageSample() {
  return {
    title: 'C++ 体验课 · 舞台讲解验证',
    rawScript: '',
    // 样例仅含可 JSON 序列化的数据，避免依赖浏览器的 structuredClone 兼容性。
    characters: JSON.parse(JSON.stringify(characters)) as Character[],
    stageSequences: JSON.parse(JSON.stringify(sequences)) as StageSequence[],
    settings: { ...settings },
  };
}
