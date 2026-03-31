export interface StyleOption {
  id: string;
  name: string;
  nameEn: string;
  category: string;
  icon: string;
  description: string;
  nautilusPrompt: string; // The specific prompt template for drawing a "Nautilus" in this style
}

export const STYLE_LIBRARY: StyleOption[] = [
  // ==================================
  // 1. 材质与物理特效 (Materials & Physical)
  // ==================================
  {
    id: 'apple-glass',
    name: '苹果磨砂玻璃',
    nameEn: 'Apple Frosted Glass',
    category: '材质物理',
    icon: '🌫️',
    description: '极简毛玻璃显示屏透出柔和弥散光',
    nautilusPrompt: 'A minimalist scene featuring an Apple-style frosted glass display screen. Behind the glass, the Nautilus (鹦鹉螺号) logo is glowing, emitting soft, highly diffused light that scatters beautiful pastel gradients across the matte glass surface.',
  },
  {
    id: 'claymorphism',
    name: '微缩黏土',
    nameEn: 'Claymorphism',
    category: '材质物理',
    icon: '🏺',
    description: '圆润可爱，像手工捏制的彩色黏土',
    nautilusPrompt: 'A charming, round, and cute miniature physical model of the Nautilus (鹦鹉螺号) made entirely of colorful modeling clay. The surface shows highly realistic clay fingerprints and tactile imperfections, cute 3D claymorphism style, soft studio lighting.',
  },
  {
    id: 'liquid-metal',
    name: '液态金属',
    nameEn: 'Liquid Metal',
    category: '材质物理',
    icon: '💧',
    description: '流动的银色金属质感，反射率极高',
    nautilusPrompt: 'The Nautilus (鹦鹉螺号) formed completely out of flowing, highly reflective liquid metal or chrome. It has organic, fluid curves with perfect mirror reflections of a contrasting studio environment, tension in the liquid droplets.',
  },
  {
    id: 'neon-tubes',
    name: '霓虹灯管',
    nameEn: 'Neon Tubes',
    category: '材质物理',
    icon: '🚥',
    description: '暗夜中由粉蓝色发光灯管弯折而成',
    nautilusPrompt: 'A glowing wall sign shaped exactly like the Nautilus (鹦鹉螺号), constructed from bent, bright pink and cyan neon glowing glass tubes. Mounted on a dark, gritty exposed brick wall at night, casting strong colorful light spills.',
  },
  {
    id: 'origami-art',
    name: '折纸艺术',
    nameEn: 'Origami Art',
    category: '材质物理',
    icon: '📄',
    description: '锋利几何边缘的纯白或彩色折纸',
    nautilusPrompt: 'The Nautilus (鹦鹉螺号) crafted elegantly using origami art. Made from crisp, premium matte white and vibrant colored paper with sharp geometric folded edges, creating beautiful soft self-shadows in a clean, brightly lit paper diorama.',
  },

  // ==================================
  // 2. 科技与未来 (Tech & Sci-Fi)
  // ==================================
  {
    id: 'cyberpunk-water',
    name: '赛博深水飞船',
    nameEn: 'Cyberpunk Deep Space/Water',
    category: '科技未来',
    icon: '🌆',
    description: '霓虹灯投影的蓝色科技城市夜空中飞跃',
    nautilusPrompt: 'The Nautilus (鹦鹉螺号) redesigned as a sleek, flying futuristic sci-fi vehicle, cruising through the night sky of a rain-slicked cyberpunk city filled with towering skyscrapers, holographic neon billboards, and thick blue smog.',
  },
  {
    id: 'hologram',
    name: '全息投影',
    nameEn: 'Hologram',
    category: '科技未来',
    icon: '💽',
    description: '科技指挥台上悬浮的纯蓝数据流影像',
    nautilusPrompt: 'A futuristic floating 3D hologram of the Nautilus (鹦鹉螺号) projected over a dark sci-fi command console. Made entirely of glowing cyan and blue laser lines, data streams, and voxel grids, featuring subtle CRT scanline interference.',
  },
  {
    id: 'mecha-heavy',
    name: '机甲重工',
    nameEn: 'Mecha Heavy Industry',
    category: '科技未来',
    icon: '⚙️',
    description: '布满装甲板的机械巨兽，喷射尾焰',
    nautilusPrompt: 'The Nautilus (鹦鹉螺号) transformed into a massive, heavily armored mecha beast. Covered in intricate grey metallic armor plating, exposed hydraulics, hazard stripes, yellow caution paint, and blasting intense bright orange thruster flames from the rear.',
  },
  {
    id: 'retro-futurism',
    name: '复古未来',
    nameEn: 'Retro-Futurism',
    category: '科技未来',
    icon: '🚀',
    description: '70年代太空歌剧中的闪亮流线型飞碟',
    nautilusPrompt: 'A shiny, chrome, teardrop-shaped 1950s retro-futuristic rendition of the Nautilus (鹦鹉螺号). It is depicted as a classic sci-fi pulp-magazine spaceship gliding through vibrant outer space near a gas giant with massive rings.',
  },
  {
    id: 'circuit-board',
    name: '电路微观',
    nameEn: 'Micro-CircuitBoard',
    category: '科技未来',
    icon: '🔌',
    description: 'PCB板上由金线、微型芯片精密排布',
    nautilusPrompt: 'An extreme macro shot where the distinctive spiral shape of the Nautilus (鹦鹉螺号) is meticulously woven into a dark green PCB circuit board layout. Composed of precise golden traces, microchips, glowing LEDs, and solder joints.',
  },

  // ==================================
  // 3. 艺术与绘画 (Art & Painting)
  // ==================================
  {
    id: 'van-gogh',
    name: '梵高星空',
    nameEn: 'Van Gogh Starry Night',
    category: '艺术绘画',
    icon: '🌌',
    description: '粗犷油画笔触旋涡组成的星空海洋',
    nautilusPrompt: 'An oil painting in the style of Vincent Van Gogh\'s Starry Night. The Nautilus (鹦鹉螺号) is sailing beautifully through a swirling, turbulent ocean of sky-blue and yellow impasto brushstrokes, extremely expressive and thick texture.',
  },
  {
    id: 'ink-splash',
    name: '水墨写意',
    nameEn: 'Chinese Ink Splash',
    category: '艺术绘画',
    icon: '🖌️',
    description: '黑白水墨晕染，水墨云海中破浪',
    nautilusPrompt: 'Traditional Chinese ink wash painting (Shui-mo). The Nautilus (鹦鹉螺号) gracefully breaking through abstract, misty mountains and waves formed by expressive, elegant splashes of deep black ink on textured rice paper. Empty space (Liu-bai) is utilized beautifully.',
  },
  {
    id: 'ukiyo-e',
    name: '浮世绘',
    nameEn: 'Ukiyo-e',
    category: '艺术绘画',
    icon: '🌊',
    description: '日式海浪间穿梭，色彩经典古朴',
    nautilusPrompt: 'A classic Japanese Ukiyo-e woodblock print. The Nautilus (鹦鹉螺号) navigating through dramatic, stylized flat claw-like surging ocean waves (like The Great Wave off Kanagawa), rendered in traditional indigo blues, muted reds, and cream colors with fine linework.',
  },
  {
    id: 'pop-art',
    name: '波普艺术',
    nameEn: 'Pop Art',
    category: '艺术绘画',
    icon: '🗯️',
    description: '高对比度纯色块，带密集漫画网点',
    nautilusPrompt: 'Andy Warhol inspired bright pop art. The Nautilus (鹦鹉螺号) depicted with striking, exaggerated, high-contrast flat neon colors, surrounded by thick bold black outlines and a background filled with classic retro comic book halftone dot patterns.',
  },
  {
    id: 'watercolor',
    name: '水彩手绘',
    nameEn: 'Watercolor',
    category: '艺术绘画',
    icon: '🎨',
    description: '柔和治愈颜料晕染，童话之船',
    nautilusPrompt: 'A gentle, whimsical watercolor illustration of the Nautilus (鹦鹉螺号). The scene feels like a page from a nostalgic children\'s storybook, featuring translucent overlapping pigment washes, soft blurred edges, pastel colors, and visible paper grain.',
  },

  // ==================================
  // 4. 商业与设计UI (Commercial & UI Design)
  // ==================================
  {
    id: 'iso-3d',
    name: '3D等距',
    nameEn: '3D Isometric',
    category: '商业设计',
    icon: '🧊',
    description: '纪念碑谷式的精致2.5D模型，纯色网格底座',
    nautilusPrompt: 'A highly polished, perfectly aligned 3D isometric view of the Nautilus (鹦鹉螺号) sitting on a clean pastel-colored square podium or grid. Monument Valley style, soft diffuse shadows, impeccable clean vector-like design.',
  },
  {
    id: 'minimal-line',
    name: '极简线稿',
    nameEn: 'Minimalist Line Art',
    category: '商业设计',
    icon: '🖋️',
    description: '纯白背景，单色细线描绘出高级轮廓',
    nautilusPrompt: 'The Nautilus (鹦鹉螺号) drawn using only a single, continuous, elegant thin black line on a pure white background. Extremely minimalist, sleek, high-end design, abstract but instantly recognizable silhouette.',
  },
  {
    id: 'corp-memphis',
    name: '企业孟菲斯',
    nameEn: 'Corporate Memphis',
    category: '商业设计',
    icon: '📊',
    description: '扁平化几何抽象撞色插画',
    nautilusPrompt: 'Corporate Memphis style modern flat vector illustration featuring flat, colorful geometric shapes. An abstract, exaggerated oversized colorful hand gently holding or pointing at a stylized flat Nautilus (鹦鹉螺号) logo. Bright yellows, purples and blues.',
  },
  {
    id: 'holo-gradient',
    name: '光栅渐变',
    nameEn: 'Holographic Gradient',
    category: '商业设计',
    icon: '💳',
    description: '信用卡表面呈现流动的镭射渐变光泽',
    nautilusPrompt: 'The Nautilus (鹦鹉螺号) embossed seamlessly onto a premium frosted glass or metal credit card. The entire surface shines with a dreamy, fluid holographic iridescent gradient (liquid pastel rainbows) under sleek studio lighting.',
  },
  {
    id: 'motion-blur',
    name: '动态模糊',
    nameEn: 'Motion Blur',
    category: '商业设计',
    icon: '🏎️',
    description: '极强速度感的线性模糊残影',
    nautilusPrompt: 'The Nautilus (鹦鹉螺号) speeding across the frame like a hyper-car. The image captures intense horizontal motion blur and trailing speed lines on the background, conveying overwhelming sonic speed and momentum, dynamic action shot.',
  },

  // ==================================
  // 5. 游戏与二次元 (Game & Anime)
  // ==================================
  {
    id: '8bit-pixel',
    name: '8-bit 像素',
    nameEn: '8-bit Pixel Art',
    category: '游戏二次元',
    icon: '🕹️',
    description: '大颗粒像素点组成的横版过关世界',
    nautilusPrompt: '16-bit or 8-bit retro pixel art. The Nautilus (鹦鹉螺号) acting as the player character in a 2D side-scrolling video game, swimming through an underwater level featuring pixelated kelp, bubbles, and UI score elements in the corner.',
  },
  {
    id: 'ghibli',
    name: '吉卜力动画',
    nameEn: 'Ghibli Studio',
    category: '游戏二次元',
    icon: '☁️',
    description: '挂满藤蔓的老旧飞船，广阔天空巨大积雨云',
    nautilusPrompt: 'Anime art style by Studio Ghibli. The Nautilus (鹦鹉螺号) reimagined as a majestic, slightly weathered steampunk flying airship covered in lush green creeping vines. It is soaring through a brilliant blue sky alongside massive, fluffy cumulus clouds.',
  },
  {
    id: 'cel-shaded',
    name: '卡通渲染',
    nameEn: 'Cel-shaded',
    category: '游戏二次元',
    icon: '🗡️',
    description: '阳光描边、清新干净的塞尔达式色块',
    nautilusPrompt: 'Breath of the Wild cel-shaded anime video game graphics. The Nautilus (鹦鹉螺号) resting on a bright, lush green grassy cliffside with vibrant blooming flowers. Strong sunlight, distinct cel-shaded cell shadows, and a beautiful blue sky.',
  },
  {
    id: 'dark-fantasy',
    name: '暗黑奇幻',
    nameEn: 'Dark Fantasy',
    category: '游戏二次元',
    icon: '💀',
    description: '魂系阴森气氛，深海遗迹中散发幽光',
    nautilusPrompt: 'Dark fantasy, Souls-like grim atmosphere. The Nautilus (鹦鹉螺号) plunging deeply into a dead, ruined abyssal underwater gothic city. It emits an eerie, pale bioluminescent green glow in the oppressive, foggy pitch-black depths.',
  },
  {
    id: 'comic-book',
    name: '美漫粗犷',
    nameEn: 'Comic Book',
    category: '游戏二次元',
    icon: '🦸‍♂️',
    description: '带有粗重黑色墨线勾边和强阴影对比',
    nautilusPrompt: 'A dynamic panel straight out of a classic retro Western superhero comic book. The Nautilus (鹦鹉螺号) bursting forward across the frame with heavy black ink outlines, dramatic high-contrast spot blacks (chiaroscuro), and vibrant CMYK colors.',
  },

  // ==================================
  // 6. 摄影与光影 (Photography & Lighting)
  // ==================================
  {
    id: 'macro-photo',
    name: '微距摄影',
    nameEn: 'Macro Photography',
    category: '摄影光影',
    icon: '🔍',
    description: '极浅虚化景深，停在带露水真实绿叶上的工艺品',
    nautilusPrompt: 'Award-winning ultra-macro photography. The Nautilus (鹦鹉螺号) portrayed as an impossibly tiny, highly detailed metallic artifact resting on a large, vibrant green tropical leaf covered in hyper-realistic morning dew drops. Extreme shallow depth of field (bokeh).',
  },
  {
    id: 'bw-documentary',
    name: '黑白纪实',
    nameEn: 'B&W Documentary',
    category: '摄影光影',
    icon: '🎞️',
    description: '高对比度黑白胶片颗粒，大雾弥漫的工业港口',
    nautilusPrompt: 'High-contrast black and white dramatic documentary photography, 35mm film grain. The massive Nautilus (鹦鹉螺号) half-docked in a moody, heavy fog-covered industrial harbor. Cold, industrial, stark lighting and moody atmosphere.',
  },
  {
    id: 'god-rays',
    name: '丁达尔光效',
    nameEn: 'God Rays/Tyndall',
    category: '摄影光影',
    icon: '🌤️',
    description: '上方投射下如神圣般的明显光柱照亮主体',
    nautilusPrompt: 'The Nautilus (鹦鹉螺号) deep inside an immense, atmospheric dark ocean trench or cavern. From far above, powerful god rays (volumetric Tyndall effect light beams) pierce through the murky water, perfectly illuminating the majestic Nautilus.',
  },
  {
    id: 'long-exposure',
    name: '长曝光夜景',
    nameEn: 'Long Exposure Night',
    category: '摄影光影',
    icon: '🌃',
    description: '暗夜穿梭时拖拽出流光溢彩的灯轨',
    nautilusPrompt: 'A long-exposure midnight photography shot. The blazing bright lights of the fast-moving Nautilus (鹦鹉螺号) streak through an urban environment, leaving sweeping, colorful, neon light trails in the air like a mesmerizing glowing ribbon.',
  },
  {
    id: 'studio-lighting',
    name: '影棚光影',
    nameEn: 'Studio Lighting',
    category: '摄影光影',
    icon: '🔦',
    description: '纯黑背景下的轮廓背光(Rim Light)完美勾勒',
    nautilusPrompt: 'Commercial Apple-style product photography. The Nautilus (鹦鹉螺号) elegantly displayed against pitch black empty space. It is illuminated entirely by a razor-thin, dramatic white rim light highlighting its perfect spiraling spiral curves and silhouette.',
  },

  // ==================================
  // 7. 特殊材质与手工 (Special Handcrafts)
  // ==================================
  {
    id: 'felt-toy',
    name: '毛毡玩具',
    nameEn: 'Felt Quilted',
    category: '特殊手工',
    icon: '🧶',
    description: '温暖可爱的羊毛毡工艺品，有缝线细节',
    nautilusPrompt: 'A highly detailed and heart-warming needle-felted wool toy of the Nautilus (鹦鹉螺号). Visible fuzz, individual soft woolen fibers, and cute handmade stitching details. Sitting on a cozy wooden desk under a warm lamp.',
  },
  {
    id: 'stained-glass',
    name: '彩色窗花',
    nameEn: 'Stained Glass',
    category: '特殊手工',
    icon: '🪟',
    description: '五彩斑斓的教堂拼花玻璃镶嵌在铅条中',
    nautilusPrompt: 'The image of the Nautilus (鹦鹉螺号) masterfully depicted within an intricate Gothic cathedral stained glass window. Composed of vibrant, glowing mosaic shards of jewel-toned glass held together by thick dark lead lines. Sunlight shines heavily through it.',
  },
  {
    id: 'sand-art',
    name: '沙画艺术',
    nameEn: 'Sand Art',
    category: '特殊手工',
    icon: '⏳',
    description: '不同深浅的沙粒在发光背板上撒绘',
    nautilusPrompt: 'Cinematic sand animation art on a glowing light box. The silhouette and internal spirals of the Nautilus (鹦鹉螺号) formed entirely by carefully arranged coarse and fine grains of brown sand, featuring beautiful textured gradients and scattered loose grains.',
  },
  {
    id: 'wood-carving',
    name: '木雕工艺',
    nameEn: 'Wood Carving',
    category: '特殊手工',
    icon: '🪵',
    description: '刀工细腻质朴、有清晰天然木纹的实木雕刻',
    nautilusPrompt: 'A masterful artisan wooden carving of the Nautilus (鹦鹉螺号) sculpted directly from a rich mahogany timber block. Beautiful concentric natural wood grain, visible subtle chisel tool marks, coated in a warm, glossy protective varnish.',
  },
  {
    id: 'ice-sculpture',
    name: '冰雕水晶',
    nameEn: 'Ice Sculpture',
    category: '特殊手工',
    icon: '❄️',
    description: '晶莹剔透、内部具微小气泡的冷蓝光冰块',
    nautilusPrompt: 'A breathtakingly intricate ice sculpture of the Nautilus (鹦鹉螺号). Carved from crystal clear glacial ice that wildly refracts cool blue ambient light. The ice features tiny trapped frozen bubbles, melting slightly with frost.',
  },

  // ==================================
  // 8. 奇幻与抽象 (Fantasy & Abstract)
  // ==================================
  {
    id: 'cthulhu',
    name: '克苏鲁神话',
    nameEn: 'Cthulhu Mythos',
    category: '奇幻抽象',
    icon: '🐙',
    description: '伴随触手与疯狂不可名状气氛的腐化融合',
    nautilusPrompt: 'Lovecraftian horror, Cthulhu Mythos style. The Nautilus (鹦鹉螺号) corrupted and mutated into a grotesque, organic biological nightmare. Dripping with massive alien tentacles, barnacles, and covered in pulsing eyes, surrounded by dark muddy waters.',
  },
  {
    id: 'steampunk',
    name: '蒸汽朋克',
    nameEn: 'Steampunk',
    category: '奇幻抽象',
    icon: '🕰️',
    description: '繁复黄铜齿轮、锅炉冒气筒的维多利亚浪漫',
    nautilusPrompt: 'Elaborate Victorian steampunk engineering. The Nautilus (鹦鹉螺号) constructed from tarnished brass, copper gears, cogs, analog dial meters, and thick riveted iron plates, puffing out thick volumetric white steam from miniature smokestacks.',
  },
  {
    id: 'fluid-art',
    name: '流体艺术',
    nameEn: 'Fluid Pouring Art',
    category: '奇幻抽象',
    icon: '🎭',
    description: '绚丽的丙烯流体倾倒大理石纹理交融',
    nautilusPrompt: 'Abstract acrylic fluid pour art. The distinct spiral form of the Nautilus (鹦鹉螺号) naturally emerging from mesmerizing, unpredictable swirling marbled patterns of liquid gold, intense blue, and magenta paint bleeding organically into one another.',
  },
  {
    id: 'multiple-exposure',
    name: '多重曝光',
    nameEn: 'Multiple Exposure',
    category: '奇幻抽象',
    icon: '🎇',
    description: '剪影内部嵌套一整个浩瀚星空或繁华城市',
    nautilusPrompt: 'Surreal double-exposure photography. Using the bold silhouette shape of the Nautilus (鹦鹉螺号) as a mask, the inside of the shape reveals an entirely different breathtaking scene: a massive bustling glowing metropolis skyline at night, seamlessly blended.',
  },
  {
    id: 'surrealism',
    name: '超现实主义',
    nameEn: 'Surrealism',
    category: '奇幻抽象',
    icon: '👁️',
    description: '达利风格的融化扭曲与荒诞元素组合',
    nautilusPrompt: 'Salvador Dali inspired surrealism painting. An absurd, dream-like landscape where a gigantic, soft, melting Nautilus (鹦鹉螺号) droops over the edge of an empty, vast desert. In the sky hangs giant floating eyeballs and long-legged elephants.',
  }
];
