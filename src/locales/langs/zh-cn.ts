const local: App.I18n.Schema = {
  system: {
    title: 'Nautilus 工作台',
    updateTitle: '系统版本更新通知',
    updateContent: '检测到系统有新版本发布，是否立即刷新页面？',
    updateConfirm: '立即刷新',
    updateCancel: '稍后再说'
  },
  common: {
    action: '操作',
    add: '新增',
    addSuccess: '添加成功',
    backToHome: '返回首页',
    batchDelete: '批量删除',
    cancel: '取消',
    close: '关闭',
    check: '勾选',
    selectAll: '全选',
    expandColumn: '展开列',
    columnSetting: '列设置',
    config: '配置',
    confirm: '确认',
    delete: '删除',
    deleteSuccess: '删除成功',
    confirmDelete: '确认删除吗？',
    edit: '编辑',
    warning: '警告',
    error: '错误',
    index: '序号',
    keywordSearch: '请输入关键词搜索',
    logout: '退出登录',
    logoutConfirm: '确认退出登录吗？',
    lookForward: '敬请期待',
    modify: '修改',
    modifySuccess: '修改成功',
    noData: '无数据',
    operate: '操作',
    pleaseCheckValue: '请检查输入的值是否合法',
    refresh: '刷新',
    reset: '重置',
    search: '搜索',
    switch: '切换',
    tip: '提示',
    trigger: '触发',
    update: '更新',
    updateSuccess: '更新成功',
    userCenter: '个人中心',
    yesOrNo: {
      yes: '是',
      no: '否'
    }
  },
  request: {
    logout: '请求失败后登出用户',
    logoutMsg: '用户状态失效，请重新登录',
    logoutWithModal: '请求失败后弹出模态框再登出用户',
    logoutWithModalMsg: '用户状态失效，请重新登录',
    refreshToken: '请求的token已过期，刷新token',
    tokenExpired: 'token已过期'
  },
  theme: {
    themeDrawerTitle: '主题配置',
    tabs: {
      appearance: '外观',
      layout: '布局',
      general: '通用',
      preset: '预设'
    },
    appearance: {
      themeSchema: {
        title: '主题模式',
        light: '亮色模式',
        dark: '暗黑模式',
        auto: '跟随系统'
      },
      grayscale: '灰色模式',
      colourWeakness: '色弱模式',
      themeColor: {
        title: '主题颜色',
        primary: '主色',
        info: '信息色',
        success: '成功色',
        warning: '警告色',
        error: '错误色',
        followPrimary: '跟随主色'
      },
      themeRadius: {
        title: '主题圆角'
      },
      recommendColor: '应用推荐算法的颜色',
      recommendColorDesc: '推荐颜色的算法参照',
      preset: {
        title: '主题预设',
        apply: '应用',
        applySuccess: '预设应用成功',
        default: {
          name: '默认预设',
          desc: 'Nautilus 默认主题预设'
        },
        dark: {
          name: '暗色预设',
          desc: '适用于夜间使用的暗色主题预设'
        },
        compact: {
          name: '紧凑型',
          desc: '适用于小屏幕的紧凑布局预设'
        },
        azir: {
          name: 'Azir的预设',
          desc: '是 Azir 比较喜欢的莫兰迪色系冷淡风'
        }
      }
    },
    layout: {
      layoutMode: {
        title: '布局模式',
        vertical: '左侧菜单模式',
        'vertical-mix': '左侧菜单混合模式',
        'vertical-hybrid-header-first': '左侧混合-顶部优先',
        horizontal: '顶部菜单模式',
        'top-hybrid-sidebar-first': '顶部混合-侧边优先',
        'top-hybrid-header-first': '顶部混合-顶部优先',
        vertical_detail: '左侧菜单布局，菜单在左，内容在右。',
        'vertical-mix_detail': '左侧双菜单布局，一级菜单在左侧深色区域，二级菜单在左侧浅色区域。',
        'vertical-hybrid-header-first_detail':
          '左侧混合布局，一级菜单在顶部，二级菜单在左侧深色区域，三级菜单在左侧浅色区域。',
        horizontal_detail: '顶部菜单布局，菜单在顶部，内容在下方。',
        'top-hybrid-sidebar-first_detail': '顶部混合布局，一级菜单在左侧，二级菜单在顶部。',
        'top-hybrid-header-first_detail': '顶部混合布局，一级菜单在顶部，二级菜单在左侧。'
      },
      tab: {
        title: '标签栏设置',
        visible: '显示标签栏',
        cache: '标签栏信息缓存',
        cacheTip: '离开页面后仍然保留标签栏信息',
        height: '标签栏高度',
        mode: {
          title: '标签栏风格',
          slider: '滑块风格',
          chrome: '谷歌风格',
          button: '按钮风格'
        },
        closeByMiddleClick: '鼠标中键关闭标签页',
        closeByMiddleClickTip: '启用后可以使用鼠标中键点击标签页进行关闭'
      },
      header: {
        title: '头部设置',
        height: '头部高度',
        breadcrumb: {
          visible: '显示面包屑',
          showIcon: '显示面包屑图标'
        }
      },
      sider: {
        title: '侧边栏设置',
        inverted: '深色侧边栏',
        width: '侧边栏宽度',
        collapsedWidth: '侧边栏折叠宽度',
        mixWidth: '混合布局侧边栏宽度',
        mixCollapsedWidth: '混合布局侧边栏折叠宽度',
        mixChildMenuWidth: '混合布局子菜单宽度',
        autoSelectFirstMenu: '自动选择第一个子菜单',
        autoSelectFirstMenuTip: '点击一级菜单时，自动选择并导航到第一个子菜单的最深层级'
      },
      footer: {
        title: '底部设置',
        visible: '显示底部',
        fixed: '固定底部',
        height: '底部高度',
        right: '底部居右'
      },
      content: {
        title: '内容区域设置',
        scrollMode: {
          title: '滚动模式',
          tip: '主题滚动仅 main 部分滚动，外层滚动可携带头部底部一起滚动',
          wrapper: '外层滚动',
          content: '主体滚动'
        },
        page: {
          animate: '页面切换动画',
          mode: {
            title: '页面切换动画类型',
            'fade-slide': '滑动',
            fade: '淡入淡出',
            'fade-bottom': '底部消退',
            'fade-scale': '缩放消退',
            'zoom-fade': '渐变',
            'zoom-out': '闪现',
            none: '无'
          }
        },
        fixedHeaderAndTab: '固定头部和标签栏'
      }
    },
    general: {
      title: '通用设置',
      watermark: {
        title: '水印设置',
        visible: '显示全屏水印',
        text: '自定义水印文本',
        enableUserName: '启用用户名水印',
        enableTime: '显示当前时间',
        timeFormat: '时间格式'
      },
      multilingual: {
        title: '多语言设置',
        visible: '显示多语言按钮'
      },
      globalSearch: {
        title: '全局搜索设置',
        visible: '显示全局搜索按钮'
      }
    },
    configOperation: {
      copyConfig: '复制配置',
      copySuccessMsg: '复制成功，请替换 src/theme/settings.ts 中的变量 themeSettings',
      resetConfig: '重置配置',
      resetSuccessMsg: '重置成功'
    }
  },
  route: {
    login: '登录',
    403: '无权限',
    404: '页面不存在',
    500: '服务器错误',
    'iframe-page': '外链页面',
    home: '首页'
  },
  page: {
    login: {
      common: {
        loginOrRegister: '登录 / 注册',
        userNamePlaceholder: '请输入用户名',
        phonePlaceholder: '请输入手机号',
        codePlaceholder: '请输入验证码',
        passwordPlaceholder: '请输入密码',
        confirmPasswordPlaceholder: '请再次输入密码',
        codeLogin: '验证码登录',
        confirm: '确定',
        back: '返回',
        validateSuccess: '验证成功',
        loginSuccess: '登录成功',
        welcomeBack: '欢迎回来，{userName} ！'
      },
      pwdLogin: {
        title: '密码登录',
        rememberMe: '记住我',
        forgetPassword: '忘记密码？',
        register: '注册账号',
        otherAccountLogin: '其他账号登录',
        otherLoginMode: '其他登录方式',
        superAdmin: '超级管理员',
        admin: '管理员',
        user: '普通用户'
      },
      codeLogin: {
        title: '验证码登录',
        getCode: '获取验证码',
        reGetCode: '{time}秒后重新获取',
        sendCodeSuccess: '验证码发送成功',
        imageCodePlaceholder: '请输入图片验证码'
      },
      register: {
        title: '注册账号',
        agreement: '我已经仔细阅读并接受',
        protocol: '《用户协议》',
        policy: '《隐私权政策》'
      },
      resetPwd: {
        title: '重置密码'
      },
      bindWeChat: {
        title: '绑定微信'
      }
    },
    home: {
      greeting: '你好，{userName} 👋 今天也要加油哦！',
      announcement: {
        title: '🐚 欢迎使用 Nautilus 工作台',
        content:
          'Nautilus 工作台正在持续建设中，目前已上线图片工具、SB3 图形化、杂货铺等模块。更多功能敬请期待，如有建议欢迎反馈！'
      },
      weather: {
        title: '天气预报',
        alertMsg: '今日有{weather}，请注意出行安全！',
        today: '今天',
        tomorrow: '明天',
        weekdays: {
          mon: '周一',
          tue: '周二',
          wed: '周三',
          thu: '周四',
          fri: '周五',
          sat: '周六',
          sun: '周日'
        }
      },
      shortcuts: {
        title: '快捷入口'
      },
      changelog: {
        title: '更新日志',
        tags: {
          feature: '新功能',
          fix: '修复',
          optimize: '优化',
          milestone: '里程碑'
        }
      },
      aiNews: {
        title: '今日 AI 新闻',
        hoursAgo: '{n} 小时前',
        minutesAgo: '{n} 分钟前',
        noNews: '暂无最新新闻'
      }
    },
    sb3Studio: {
      openFile: '打开文件',
      loadSample: '加载示例',
      saveSB3: '导出 .sb3',
      saveJSON: '导出 project.json',
      versionDiff: '版本对比',
      tabOverview: '项目总览',
      tabAssets: '素材管理',
      tabData: '变量与广播',
      tabLogic: '逻辑分析',
      emptyTitle: '开始分析 SB3 项目',
      emptyDesc: '上传一个 .sb3 文件或加载示例数据来开始',
      stats: {
        sprites: '角色数',
        blocks: '积木数',
        scripts: '脚本数',
        costumes: '造型数',
        sounds: '声音数',
        variables: '变量数',
        lists: '列表数',
        broadcasts: '广播数'
      }
    },
    videoFrameExtractor: {
      uploadTitle: '拖拽视频到此处，或点击选择文件',
      uploadDesc: '支持 MP4、WebM、MOV 等常见视频格式',
      changeVideo: '更换视频',
      videoPlayer: '视频播放器',
      frameGallery: '帧画廊',
      extractSettings: '抽帧设置',
      extractMode: '抽帧模式',
      modeCount: '按帧数量',
      modeInterval: '按时间间隔',
      frameCount: '抽取帧数',
      intervalSeconds: '间隔时间',
      seconds: '秒',
      estimatedFrames: '预估帧数',
      outputFormat: '输出格式',
      quality: '图片质量',
      startExtract: '开始抽帧',
      extracting: '正在抽帧…',
      captureCurrentFrame: '截取当前帧',
      invertSelect: '反选',
      exportZip: '导出 ZIP',
      noFrames: '暂无帧数据，请先上传视频并抽帧',
      preview: '帧预览',
      prevFrame: '上一帧',
      nextFrame: '下一帧'
    },
    effectsGenerator: {
      pageTitle: '特效生成器',
      presetList: '预设效果',
      preview: '实时预览',
      params: '参数调节',
      particleCount: '粒子数量',
      speed: '运动速度',
      size: '粒子大小',
      opacity: '透明度',
      color: '粒子颜色',
      direction: '运动方向',
      gravity: '重力',
      play: '播放',
      stop: '停止',
      reset: '重置',
      copyConfig: '复制配置',
      exportHtml: '导出 HTML',
      copySuccess: '配置已复制到剪贴板',
      exportSuccess: 'HTML 文件已导出',
      uploadImage: '上传图片',
      customParticle: '自定义粒子',
      fullscreen: '全屏预览',
      exitFullscreen: '退出全屏',
      background: '背景色',
      categoryBurst: '点击特效',
      categoryAmbient: '背景特效',
      clickHint: '点击任意位置触发特效',
      presets: {
        'star-burst': '⭐ 星星迸发',
        'confetti-pop': '🎊 五彩纸屑',
        'heart-burst': '💖 爱心爆发',
        'sparkle-flash': '✨ 闪光迸射',
        'firework-click': '🎆 烟花绽放',
        'lightning-spark': '⚡ 闪电火花',
        'rainbow-burst': '🌈 彩虹爆发',
        'gold-coins': '🪙 金币飘洒',
        'deep-space': '🌌 深空星云',
        aurora: '🌊 极光波浪',
        'neon-matrix': '💚 霓虹矩阵',
        'cyber-bubbles': '🫧 赛博泡泡',
        'fire-rise': '🔥 火焰升腾',
        fountain: '⛲ 能量喷泉'
      },
      styleParams: '样式参数',
      softness: '边缘柔化',
      lifeCurve: '衰减曲线',
      sizeMode: '大小模式',
      colorGradient: '颜色渐变',
      curves: {
        easeOut: '快闪慢消',
        easeIn: '慢闪快消',
        linear: '匀速消散',
        easeInOut: '缓入缓出',
        pulse: '脉冲闪烁'
      },
      sizeModes: {
        shrink: '逐渐缩小',
        grow: '逐渐放大',
        constant: '保持不变',
        pop: '膨胀消失'
      },
      recording: {
        title: 'GIF 录制',
        fps: '帧率',
        duration: '录制时长',
        quality: '画质',
        qualityHigh: '高',
        qualityMedium: '中',
        qualityLow: '低',
        selectRegion: '选取区域',
        noRegion: '未选取区域',
        start: '开始录制',
        stop: '停止录制',
        cancel: '取消',
        download: '下载 GIF',
        reRecord: '重新录制',
        fileSize: '文件大小',
        stateIdle: '就绪',
        stateSelecting: '正在选取区域...',
        stateReady: '已就绪',
        stateRecording: '录制中',
        stateEncoding: '编码中...',
        stateDone: '录制完成'
      }
    },
    timestampConverter: {
      currentTimestamp: '当前时间戳',
      currentTimestampMs: '毫秒时间戳',
      currentDate: '当前时间',
      tsToDate: '时间戳 → 日期',
      dateToTs: '日期 → 时间戳',
      enterTimestamp: '输入 Unix 时间戳',
      enterDate: '输入日期时间，如 2025-01-01 12:00:00',
      now: '当前',
      localTime: '本地时间',
      relativeTime: '相对时间',
      invalidInput: '输入格式无效',
      copied: '已复制到剪贴板',
      timestampSeconds: '时间戳（秒）',
      timestampMs: '时间戳（毫秒）',
      dateHint: '支持格式：2025-01-01 12:00:00、ISO 8601 等',
      batchConvert: '批量转换',
      batchHint: '每行一个时间戳',
      batchPlaceholder: '每行输入一个时间戳\n例如：\n1735689600\n1735776000\n1735862400',
      seconds: '秒',
      minutes: '分钟',
      hours: '小时',
      days: '天',
      months: '个月',
      ago: '前',
      later: '后'
    },
    base64Converter: {
      converter: '编解码工具',
      textMode: '📝 文本模式',
      fileMode: '📁 文件模式',
      plainText: '原始文本',
      enterText: '输入要编码的文本…',
      encode: '编码',
      decode: '解码',
      clear: '清空',
      urlSafe: 'URL 安全模式',
      autoSync: '自动同步',
      encodeFailed: '编码失败，请检查输入',
      decodeFailed: '解码失败，请检查 Base64 格式',
      copied: '已复制到剪贴板',
      dropFile: '拖拽文件到此处，或点击选择文件',
      dropHint: '支持任意文件类型',
      output: '输出',
      copyBase64: '复制 Base64',
      copyDataUrl: '复制 Data URL',
      download: '下载文件'
    },
    qrcodeGenerator: {
      content: '内容输入',
      enterText: '输入要生成二维码的文本…',
      enterUrl: '输入 URL 地址',
      wifiSSID: 'WiFi 名称 (SSID)',
      wifiPassword: 'WiFi 密码',
      wifiHidden: '隐藏网络',
      emailTo: '收件人邮箱',
      emailSubject: '邮件主题',
      emailBody: '邮件正文',
      style: '样式设置',
      size: '尺寸',
      margin: '边距',
      errorLevel: '纠错等级',
      fgColor: '前景色',
      bgColor: '背景色',
      addLogo: '添加 Logo',
      uploadLogo: '上传 Logo',
      logoHint: '建议使用纠错等级 H (30%) 以确保添加 Logo 后仍可扫描',
      preview: '预览',
      emptyHint: '输入内容后将自动生成二维码',
      copyImage: '复制图片',
      copied: '二维码已复制到剪贴板',
      copyFailed: '复制失败',
      generateFailed: '二维码生成失败',
      batchGenerate: '批量生成',
      batchPlaceholder: '每行输入一段文本或 URL\n点击生成后将批量创建二维码',
      generateAll: '批量生成'
    },
    imageCompressor: {
      uploadTitle: '拖拽图片到此处，或点击选择文件',
      uploadDesc: '支持 JPEG、PNG、WebP 等常见图片格式',
      tabImages: '📷 图片压缩',
      tabSb3: '🧩 SB3 压缩',
      settings: '压缩设置',
      maxWidth: '最大宽度',
      maxHeight: '最大高度',
      quality: '图片质量',
      outputFormat: '输出格式',
      keepOriginal: '保持原始格式',
      compressAll: '全部压缩',
      uploadImages: '上传图片',
      downloadAll: '下载全部',
      downloadZip: '打包下载 ZIP',
      clearAll: '清空列表',
      originalSize: '原始大小',
      compressedSize: '压缩后',
      compressionRate: '压缩率',
      status: {
        pending: '等待中',
        compressing: '压缩中…',
        done: '已完成',
        error: '失败'
      },
      compare: '对比',
      compareTitle: '压缩效果对比',
      original: '原图',
      compressed: '压缩后',
      sb3: {
        uploadSb3: '上传 SB3 文件',
        fileName: '文件名',
        fileSize: '文件大小',
        imageCount: '图片数量',
        compressQuality: '压缩质量',
        startCompress: '开始压缩',
        exporting: '正在导出…',
        exportSb3: '导出压缩后的 .sb3',
        selectAll: '全选',
        deselectAll: '取消全选',
        skipSvg: 'SVG 文件不参与压缩',
        totalSaved: '总共节省',
        compressProgress: '压缩进度'
      },
      noImages: '暂无图片，请上传图片文件',
      noSb3: '请上传一个 .sb3 文件开始压缩',
      dragDrop: '拖拽文件到此处'
    }
  },
  form: {
    required: '不能为空',
    userName: {
      required: '请输入用户名',
      invalid: '用户名格式不正确'
    },
    phone: {
      required: '请输入手机号',
      invalid: '手机号格式不正确'
    },
    pwd: {
      required: '请输入密码',
      invalid: '密码格式不正确，6-18位字符，包含字母、数字、下划线'
    },
    confirmPwd: {
      required: '请输入确认密码',
      invalid: '两次输入密码不一致'
    },
    code: {
      required: '请输入验证码',
      invalid: '验证码格式不正确'
    },
    email: {
      required: '请输入邮箱',
      invalid: '邮箱格式不正确'
    }
  },
  dropdown: {
    closeCurrent: '关闭',
    closeOther: '关闭其它',
    closeLeft: '关闭左侧',
    closeRight: '关闭右侧',
    closeAll: '关闭所有',
    pin: '固定标签',
    unpin: '取消固定'
  },
  icon: {
    themeConfig: '主题配置',
    themeSchema: '主题模式',
    lang: '切换语言',
    fullscreen: '全屏',
    fullscreenExit: '退出全屏',
    reload: '刷新页面',
    collapse: '折叠菜单',
    expand: '展开菜单',
    pin: '固定',
    unpin: '取消固定'
  },
  datatable: {
    itemCount: '共 {total} 条',
    fixed: {
      left: '左固定',
      right: '右固定',
      unFixed: '取消固定'
    }
  }
};

export default local;
