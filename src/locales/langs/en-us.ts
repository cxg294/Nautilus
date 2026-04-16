const local: App.I18n.Schema = {
  system: {
    title: 'Nautilus',
    updateTitle: 'System Version Update Notification',
    updateContent: 'A new version of the system has been detected. Do you want to refresh the page immediately?',
    updateConfirm: 'Refresh immediately',
    updateCancel: 'Later'
  },
  common: {
    action: 'Action',
    add: 'Add',
    addSuccess: 'Add Success',
    backToHome: 'Back to home',
    batchDelete: 'Batch Delete',
    cancel: 'Cancel',
    close: 'Close',
    check: 'Check',
    selectAll: 'Select All',
    expandColumn: 'Expand Column',
    columnSetting: 'Column Setting',
    config: 'Config',
    confirm: 'Confirm',
    delete: 'Delete',
    deleteSuccess: 'Delete Success',
    confirmDelete: 'Are you sure you want to delete?',
    edit: 'Edit',
    warning: 'Warning',
    error: 'Error',
    index: 'Index',
    keywordSearch: 'Please enter keyword',
    logout: 'Logout',
    logoutConfirm: 'Are you sure you want to log out?',
    lookForward: 'Coming soon',
    modify: 'Modify',
    modifySuccess: 'Modify Success',
    noData: 'No Data',
    operate: 'Operate',
    pleaseCheckValue: 'Please check whether the value is valid',
    refresh: 'Refresh',
    reset: 'Reset',
    search: 'Search',
    switch: 'Switch',
    tip: 'Tip',
    trigger: 'Trigger',
    update: 'Update',
    updateSuccess: 'Update Success',
    userCenter: 'User Center',
    yesOrNo: {
      yes: 'Yes',
      no: 'No'
    }
  },
  request: {
    logout: 'Logout user after request failed',
    logoutMsg: 'User status is invalid, please log in again',
    logoutWithModal: 'Pop up modal after request failed and then log out user',
    logoutWithModalMsg: 'User status is invalid, please log in again',
    refreshToken: 'The requested token has expired, refresh the token',
    tokenExpired: 'The requested token has expired'
  },
  theme: {
    themeDrawerTitle: 'Theme Configuration',
    tabs: {
      appearance: 'Appearance',
      layout: 'Layout',
      general: 'General',
      preset: 'Preset'
    },
    appearance: {
      themeSchema: {
        title: 'Theme Schema',
        light: 'Light',
        dark: 'Dark',
        auto: 'Follow System'
      },
      grayscale: 'Grayscale',
      colourWeakness: 'Colour Weakness',
      themeColor: {
        title: 'Theme Color',
        primary: 'Primary',
        info: 'Info',
        success: 'Success',
        warning: 'Warning',
        error: 'Error',
        followPrimary: 'Follow Primary'
      },
      themeRadius: {
        title: 'Theme Radius'
      },
      recommendColor: 'Apply Recommended Color Algorithm',
      recommendColorDesc: 'The recommended color algorithm refers to',
      preset: {
        title: 'Theme Presets',
        apply: 'Apply',
        applySuccess: 'Preset applied successfully',
        default: {
          name: 'Default Preset',
          desc: 'Default theme preset with balanced settings'
        },
        dark: {
          name: 'Dark Preset',
          desc: 'Dark theme preset for night time usage'
        },
        compact: {
          name: 'Compact Preset',
          desc: 'Compact layout preset for small screens'
        },
        azir: {
          name: "Azir's Preset",
          desc: 'It is a cold and elegant preset that Azir likes'
        }
      }
    },
    layout: {
      layoutMode: {
        title: 'Layout Mode',
        vertical: 'Vertical Mode',
        horizontal: 'Horizontal Mode',
        'vertical-mix': 'Vertical Mix Mode',
        'vertical-hybrid-header-first': 'Left Hybrid Header-First',
        'top-hybrid-sidebar-first': 'Top-Hybrid Sidebar-First',
        'top-hybrid-header-first': 'Top-Hybrid Header-First',
        vertical_detail: 'Vertical menu layout, with the menu on the left and content on the right.',
        'vertical-mix_detail':
          'Vertical mix-menu layout, with the primary menu on the dark left side and the secondary menu on the lighter left side.',
        'vertical-hybrid-header-first_detail':
          'Left hybrid layout, with the primary menu at the top, the secondary menu on the dark left side, and the tertiary menu on the lighter left side.',
        horizontal_detail: 'Horizontal menu layout, with the menu at the top and content below.',
        'top-hybrid-sidebar-first_detail':
          'Top hybrid layout, with the primary menu on the left and the secondary menu at the top.',
        'top-hybrid-header-first_detail':
          'Top hybrid layout, with the primary menu at the top and the secondary menu on the left.'
      },
      tab: {
        title: 'Tab Settings',
        visible: 'Tab Visible',
        cache: 'Tag Bar Info Cache',
        cacheTip: 'Keep the tab bar information after leaving the page',
        height: 'Tab Height',
        mode: {
          title: 'Tab Mode',
          slider: 'Slider',
          chrome: 'Chrome',
          button: 'Button'
        },
        closeByMiddleClick: 'Close Tab by Middle Click',
        closeByMiddleClickTip: 'Enable closing tabs by clicking with the middle mouse button'
      },
      header: {
        title: 'Header Settings',
        height: 'Header Height',
        breadcrumb: {
          visible: 'Breadcrumb Visible',
          showIcon: 'Breadcrumb Icon Visible'
        }
      },
      sider: {
        title: 'Sider Settings',
        inverted: 'Dark Sider',
        width: 'Sider Width',
        collapsedWidth: 'Sider Collapsed Width',
        mixWidth: 'Mix Sider Width',
        mixCollapsedWidth: 'Mix Sider Collapse Width',
        mixChildMenuWidth: 'Mix Child Menu Width',
        autoSelectFirstMenu: 'Auto Select First Submenu',
        autoSelectFirstMenuTip:
          'When a first-level menu is clicked, the first submenu is automatically selected and navigated to the deepest level'
      },
      footer: {
        title: 'Footer Settings',
        visible: 'Footer Visible',
        fixed: 'Fixed Footer',
        height: 'Footer Height',
        right: 'Right Footer'
      },
      content: {
        title: 'Content Area Settings',
        scrollMode: {
          title: 'Scroll Mode',
          tip: 'The theme scroll only scrolls the main part, the outer scroll can carry the header and footer together',
          wrapper: 'Wrapper',
          content: 'Content'
        },
        page: {
          animate: 'Page Animate',
          mode: {
            title: 'Page Animate Mode',
            fade: 'Fade',
            'fade-slide': 'Slide',
            'fade-bottom': 'Fade Zoom',
            'fade-scale': 'Fade Scale',
            'zoom-fade': 'Zoom Fade',
            'zoom-out': 'Zoom Out',
            none: 'None'
          }
        },
        fixedHeaderAndTab: 'Fixed Header And Tab'
      }
    },
    general: {
      title: 'General Settings',
      watermark: {
        title: 'Watermark Settings',
        visible: 'Watermark Full Screen Visible',
        text: 'Custom Watermark Text',
        enableUserName: 'Enable User Name Watermark',
        enableTime: 'Show Current Time',
        timeFormat: 'Time Format'
      },
      multilingual: {
        title: 'Multilingual Settings',
        visible: 'Display multilingual button'
      },
      globalSearch: {
        title: 'Global Search Settings',
        visible: 'Display GlobalSearch button'
      }
    },
    configOperation: {
      copyConfig: 'Copy Config',
      copySuccessMsg: 'Copy Success, Please replace the variable "themeSettings" in "src/theme/settings.ts"',
      resetConfig: 'Reset Config',
      resetSuccessMsg: 'Reset Success'
    }
  },
  route: {
    login: 'Login',
    403: 'No Permission',
    404: 'Page Not Found',
    500: 'Server Error',
    'iframe-page': 'Iframe',
    home: 'Home',
    'base64-converter': 'Base64 Converter',
    'character-generator': 'Character Generator (test)',
    'btc-course-flow': 'BTC Course Flow',
    'effects-generator': 'Effects Generator',
    'image-compressor': 'Image Compressor',
    'image-matting': 'Image Matting',
    locked: 'Locked',
    'material-studio': 'Material Studio',
    'qrcode-generator': 'QR Code Generator',
    'quick-links': 'Quick Links',
    'role-manager': 'Role Manager',
    'sb3-compressor': 'SB3 Compressor',
    'sb3-studio': 'SB3 Studio',
    'timestamp-converter': 'Timestamp Converter',
    'tts-studio': 'TTS Studio',
    'user-manager': 'User Manager',
    'video-frame-extractor': 'Video Frame Extractor',
    'analytics-dashboard': 'Analytics Dashboard',
    'proxy-settings': 'Proxy Settings'
  },
  page: {
    login: {
      common: {
        loginOrRegister: 'Login / Register',
        userNamePlaceholder: 'Please enter user name',
        phonePlaceholder: 'Please enter phone number',
        codePlaceholder: 'Please enter verification code',
        passwordPlaceholder: 'Please enter password',
        confirmPasswordPlaceholder: 'Please enter password again',
        codeLogin: 'Verification code login',
        confirm: 'Confirm',
        back: 'Back',
        validateSuccess: 'Verification passed',
        loginSuccess: 'Login successfully',
        welcomeBack: 'Welcome back, {userName} !'
      },
      pwdLogin: {
        title: 'Password Login',
        rememberMe: 'Remember me',
        forgetPassword: 'Forget password?',
        register: 'Register',
        otherAccountLogin: 'Other Account Login',
        otherLoginMode: 'Other Login Mode',
        superAdmin: 'Super Admin',
        admin: 'Admin',
        user: 'User'
      },
      codeLogin: {
        title: 'Verification Code Login',
        getCode: 'Get verification code',
        reGetCode: 'Reacquire after {time}s',
        sendCodeSuccess: 'Verification code sent successfully',
        imageCodePlaceholder: 'Please enter image verification code'
      },
      register: {
        title: 'Register',
        agreement: 'I have read and agree to',
        protocol: '《User Agreement》',
        policy: '《Privacy Policy》'
      },
      resetPwd: {
        title: 'Reset Password'
      },
      bindWeChat: {
        title: 'Bind WeChat'
      }
    },
    home: {
      greeting: 'Hello, {userName} 👋 Have a great day!',
      announcement: {
        title: '🐚 Welcome to Nautilus Workstation',
        content:
          'Nautilus is continuously evolving. Image Tools, SB3 Graphical, and Misc Shop modules are now available. Stay tuned for more features!'
      },
      weather: {
        title: 'Weather Forecast',
        alertMsg: 'Severe weather alert: {weather} expected today!',
        today: 'Today',
        tomorrow: 'Tomorrow',
        weekdays: {
          mon: 'Mon',
          tue: 'Tue',
          wed: 'Wed',
          thu: 'Thu',
          fri: 'Fri',
          sat: 'Sat',
          sun: 'Sun'
        }
      },
      shortcuts: {
        title: 'Quick Access'
      },
      changelog: {
        title: 'Changelog',
        tags: {
          feature: 'Feature',
          fix: 'Fix',
          optimize: 'Optimize',
          milestone: 'Milestone'
        }
      },
      aiNews: {
        title: "Today's AI News",
        hoursAgo: '{n}h ago',
        minutesAgo: '{n}m ago',
        noNews: 'No news available'
      }
    },
    videoFrameExtractor: {
      uploadTitle: 'Drag & drop video here, or click to browse',
      uploadDesc: 'Supports MP4, WebM, MOV and other common formats',
      changeVideo: 'Change Video',
      videoPlayer: 'Video Player',
      frameGallery: 'Frame Gallery',
      extractSettings: 'Extract Settings',
      extractMode: 'Extract Mode',
      modeCount: 'By Count',
      modeInterval: 'By Interval',
      frameCount: 'Frame Count',
      intervalSeconds: 'Interval',
      seconds: 'sec',
      estimatedFrames: 'Estimated frames',
      outputFormat: 'Output Format',
      quality: 'Quality',
      startExtract: 'Start Extract',
      extracting: 'Extracting...',
      captureCurrentFrame: 'Capture Current Frame',
      invertSelect: 'Invert',
      exportZip: 'Export ZIP',
      noFrames: 'No frames yet. Upload a video and extract frames.',
      preview: 'Preview',
      prevFrame: 'Previous',
      nextFrame: 'Next'
    },
    sb3Studio: {
      openFile: 'Open File',
      loadSample: 'Load Sample',
      saveSB3: 'Export .sb3',
      saveJSON: 'Export project.json',
      versionDiff: 'Version Diff',
      tabOverview: 'Overview',
      tabAssets: 'Assets',
      tabData: 'Variables & Broadcasts',
      tabLogic: 'Logic Analysis',
      emptyTitle: 'Start Analyzing SB3 Project',
      emptyDesc: 'Upload an .sb3 file or load sample data to start',
      stats: {
        sprites: 'Sprites',
        blocks: 'Blocks',
        scripts: 'Scripts',
        costumes: 'Costumes',
        sounds: 'Sounds',
        variables: 'Variables',
        lists: 'Lists',
        broadcasts: 'Broadcasts'
      }
    },
    effectsGenerator: {
      pageTitle: 'Effects Generator',
      presetList: 'Presets',
      preview: 'Live Preview',
      params: 'Parameters',
      particleCount: 'Particle Count',
      speed: 'Speed',
      size: 'Size',
      opacity: 'Opacity',
      color: 'Color',
      direction: 'Direction',
      gravity: 'Gravity',
      play: 'Play',
      stop: 'Stop',
      reset: 'Reset',
      copyConfig: 'Copy Config',
      exportHtml: 'Export HTML',
      copySuccess: 'Config copied to clipboard',
      exportSuccess: 'HTML file exported',
      uploadImage: 'Upload Image',
      customParticle: 'Custom Particle',
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit Fullscreen',
      background: 'Background',
      categoryBurst: 'Click Effects',
      categoryAmbient: 'Background Effects',
      clickHint: 'Click anywhere to trigger',
      presets: {
        'star-burst': '⭐ Star Burst',
        'confetti-pop': '🎊 Confetti Pop',
        'heart-burst': '💖 Heart Burst',
        'sparkle-flash': '✨ Sparkle Flash',
        'firework-click': '🎆 Fireworks',
        'lightning-spark': '⚡ Lightning',
        'rainbow-burst': '🌈 Rainbow Burst',
        'gold-coins': '🪙 Gold Coins',
        'deep-space': '🌌 Deep Space',
        aurora: '🌊 Aurora Waves',
        'neon-matrix': '💚 Neon Matrix',
        'cyber-bubbles': '🫧 Cyber Bubbles',
        'fire-rise': '🔥 Fire Rise',
        fountain: '⛲ Fountain'
      },
      styleParams: 'Style',
      softness: 'Edge Softness',
      lifeCurve: 'Fade Curve',
      sizeMode: 'Size Mode',
      colorGradient: 'Color Gradient',
      curves: {
        easeOut: 'Quick Flash',
        easeIn: 'Slow Flash',
        linear: 'Linear',
        easeInOut: 'Ease In-Out',
        pulse: 'Pulse'
      },
      sizeModes: {
        shrink: 'Shrink',
        grow: 'Grow',
        constant: 'Constant',
        pop: 'Pop'
      },
      recording: {
        title: 'GIF Recording',
        fps: 'FPS',
        duration: 'Duration',
        quality: 'Quality',
        qualityHigh: 'High',
        qualityMedium: 'Medium',
        qualityLow: 'Low',
        selectRegion: 'Select Region',
        noRegion: 'No region selected',
        start: 'Start Recording',
        stop: 'Stop Recording',
        cancel: 'Cancel',
        download: 'Download GIF',
        reRecord: 'Re-record',
        fileSize: 'File Size',
        stateIdle: 'Ready',
        stateSelecting: 'Selecting region...',
        stateReady: 'Ready',
        stateRecording: 'Recording',
        stateEncoding: 'Encoding...',
        stateDone: 'Done'
      }
    },
    timestampConverter: {
      currentTimestamp: 'Current Timestamp',
      currentTimestampMs: 'Millisecond Timestamp',
      currentDate: 'Current Time',
      tsToDate: 'Timestamp → Date',
      dateToTs: 'Date → Timestamp',
      enterTimestamp: 'Enter Unix timestamp',
      enterDate: 'Enter date, e.g. 2025-01-01 12:00:00',
      now: 'Now',
      localTime: 'Local Time',
      relativeTime: 'Relative Time',
      invalidInput: 'Invalid input format',
      copied: 'Copied to clipboard',
      timestampSeconds: 'Timestamp (seconds)',
      timestampMs: 'Timestamp (milliseconds)',
      dateHint: 'Formats: 2025-01-01 12:00:00, ISO 8601, etc.',
      batchConvert: 'Batch Convert',
      batchHint: 'One timestamp per line',
      batchPlaceholder: 'Enter one timestamp per line\ne.g.:\n1735689600\n1735776000\n1735862400',
      seconds: 'seconds',
      minutes: 'minutes',
      hours: 'hours',
      days: 'days',
      months: 'months',
      ago: 'ago',
      later: 'later'
    },
    base64Converter: {
      converter: 'Converter',
      textMode: '📝 Text Mode',
      fileMode: '📁 File Mode',
      plainText: 'Plain Text',
      enterText: 'Enter text to encode…',
      encode: 'Encode',
      decode: 'Decode',
      clear: 'Clear',
      urlSafe: 'URL Safe Mode',
      autoSync: 'Auto Sync',
      encodeFailed: 'Encoding failed, please check input',
      decodeFailed: 'Decoding failed, please check Base64 format',
      copied: 'Copied to clipboard',
      dropFile: 'Drag & drop file here, or click to browse',
      dropHint: 'Supports all file types',
      output: 'Output',
      copyBase64: 'Copy Base64',
      copyDataUrl: 'Copy Data URL',
      download: 'Download File'
    },
    qrcodeGenerator: {
      content: 'Content',
      enterText: 'Enter text for QR code…',
      enterUrl: 'Enter URL',
      wifiSSID: 'WiFi Name (SSID)',
      wifiPassword: 'WiFi Password',
      wifiHidden: 'Hidden Network',
      emailTo: 'Recipient Email',
      emailSubject: 'Subject',
      emailBody: 'Body',
      style: 'Style Settings',
      size: 'Size',
      margin: 'Margin',
      errorLevel: 'Error Correction',
      fgColor: 'Foreground',
      bgColor: 'Background',
      addLogo: 'Add Logo',
      uploadLogo: 'Upload Logo',
      logoHint: 'Recommend using error level H (30%) to ensure QR code with logo remains scannable',
      preview: 'Preview',
      emptyHint: 'QR code will generate automatically when content is entered',
      copyImage: 'Copy Image',
      copied: 'QR code copied to clipboard',
      copyFailed: 'Copy failed',
      generateFailed: 'QR code generation failed',
      batchGenerate: 'Batch Generate',
      batchPlaceholder: 'Enter one text or URL per line\nClick generate to create QR codes in batch',
      generateAll: 'Generate All'
    },
    imageCompressor: {
      uploadTitle: 'Drag & drop images here, or click to browse',
      uploadDesc: 'Supports JPEG, PNG, WebP and other common formats',
      tabImages: '📷 Image Compress',
      tabSb3: '🧩 SB3 Compress',
      settings: 'Settings',
      maxWidth: 'Max Width',
      maxHeight: 'Max Height',
      quality: 'Quality',
      outputFormat: 'Output Format',
      keepOriginal: 'Keep Original Format',
      compressAll: 'Compress All',
      uploadImages: 'Upload Images',
      downloadAll: 'Download All',
      downloadZip: 'Download ZIP',
      clearAll: 'Clear All',
      originalSize: 'Original Size',
      compressedSize: 'Compressed',
      compressionRate: 'Compression Rate',
      status: {
        pending: 'Pending',
        compressing: 'Compressing...',
        done: 'Done',
        error: 'Error'
      },
      compare: 'Compare',
      compareTitle: 'Compression Comparison',
      original: 'Original',
      compressed: 'Compressed',
      sb3: {
        uploadSb3: 'Upload SB3 File',
        fileName: 'File Name',
        fileSize: 'File Size',
        imageCount: 'Image Count',
        compressQuality: 'Compress Quality',
        startCompress: 'Start Compress',
        exporting: 'Exporting...',
        exportSb3: 'Export Compressed .sb3',
        selectAll: 'Select All',
        deselectAll: 'Deselect All',
        skipSvg: 'SVG files are skipped',
        totalSaved: 'Total Saved',
        compressProgress: 'Progress'
      },
      noImages: 'No images yet. Upload image files to start.',
      noSb3: 'Upload an .sb3 file to start compression',
      dragDrop: 'Drag & drop files here'
    }
  },
  form: {
    required: 'Cannot be empty',
    userName: {
      required: 'Please enter user name',
      invalid: 'User name format is incorrect'
    },
    phone: {
      required: 'Please enter phone number',
      invalid: 'Phone number format is incorrect'
    },
    pwd: {
      required: 'Please enter password',
      invalid: '6-18 characters, including letters, numbers, and underscores'
    },
    confirmPwd: {
      required: 'Please enter password again',
      invalid: 'The two passwords are inconsistent'
    },
    code: {
      required: 'Please enter verification code',
      invalid: 'Verification code format is incorrect'
    },
    email: {
      required: 'Please enter email',
      invalid: 'Email format is incorrect'
    }
  },
  dropdown: {
    closeCurrent: 'Close Current',
    closeOther: 'Close Other',
    closeLeft: 'Close Left',
    closeRight: 'Close Right',
    closeAll: 'Close All',
    pin: 'Pin Tab',
    unpin: 'Unpin Tab'
  },
  icon: {
    themeConfig: 'Theme Configuration',
    themeSchema: 'Theme Schema',
    lang: 'Switch Language',
    fullscreen: 'Fullscreen',
    fullscreenExit: 'Exit Fullscreen',
    reload: 'Reload Page',
    collapse: 'Collapse Menu',
    expand: 'Expand Menu',
    pin: 'Pin',
    unpin: 'Unpin'
  },
  datatable: {
    itemCount: 'Total {total} items',
    fixed: {
      left: 'Left Fixed',
      right: 'Right Fixed',
      unFixed: 'Unfixed'
    }
  }
};

export default local;
