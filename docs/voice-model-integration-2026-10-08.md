# CosyVoice / Audio 克隆与合成接入

日期：2026-10-08。已在本机开发服务生效。

## 使用方式

语音实验室的「复刻」、人物库「更多声音设置」、逐字稿工坊「角色参考音频」均可选择 CosyVoice 3.5 Flash 或 Audio 3.0 Flash。默认仍为 CosyVoice，用户可选择 Audio；克隆后合成、生成试听自动跟随音色模型。已有角色绑定、课程、云端音色及已生成音频不批量修改。

音色列表展示模型。后台同时接受此前已创建的 CosyVoice 3.5 Plus / Audio 3.0 Plus 音色进行合成，价格分别按注册表计算；本轮新克隆选项只开放两款 Flash。声音设计仍走原有 CosyVoice。

## 服务端行为

- shared/voice-models.json 为前后端共同模型及价格表。未知模型明确拒绝，不再静默退回 CosyVoice。
- migration 022 新增 voice_lab_voice_bindings，记录真实模型、原始录音与创建参数。克隆创建时保存绑定；历史音色第一次合成时通过 query_voice 确认并缓存。列表缺少 target_model 时可以根据已保存绑定或已知 ID 前缀显示，合成前仍确认真实绑定。
- 显式传入的模型与音色绑定不一致时，在付费合成前报错，提示重新选择音色。
- 新克隆默认 enable_preprocess=false，明确 enable_volume_normalization="false"。上传原件保存在 server/voice-lab-sources（已加入 gitignore），URL 模式通过供应商原件链接取回。原件只对创建者或有音色管理权限的用户开放。
- 本地留存失败会返回已创建的音色和 warning，避免用户重复创建；既有历史源录音不自动迁入。
- 费用估算、试听、合成按实际模型返回价格，使用上游 characters 记录实际用量。

## 字幕与课程兼容

真实长文本发现 CosyVoice 可以返回全文字符索引，Audio 可以返回全文 token 索引，且 Audio 的单个 token 可能带尾随标点。因此不能原样把 begin_index/end_index 当作句内字符索引。

collectWordAlignment 现在按 original_text 对齐 token，统一输出句内 beginIndex/endIndex；beginTimeMs/endTimeMs 仍相对整段音频，单位毫秒。保留数字原文，过滤自动补出的标点。现有字幕组件继续使用同一结构。

新工坊台词 useInstruction=false；单句面板可显式开启情绪指令。旧本机项目缺少字段时沿用旧语气行为与缓存键，避免旧音频全部失效。克隆预处理与该合成指令开关互相独立。

## 验证

- 45 项测试通过：服务层、真实本地路由配模拟供应商、工坊模型、工坊生成流程。
- pnpm typecheck、pnpm build:test 通过（使用本机 Node 20.19.0 / pnpm 10 工具链）。
- 用隔离本地账号数据库、真实百炼与 OSS 验证 Audio Flash 上传克隆、原始文件 SHA-256 往返、自动模型识别、长文本合成与价格。
- 同一长文本生成 Audio Flash 37.20 秒、CosyVoice Flash 37.76 秒；两者均有两个分句，校正后 167 / 188 个字幕 span 均落在各自原句内，并覆盖最终文字，时间戳未超出音频时长。真实临时克隆已删除。
- 本机后端已重启，迁移已应用，健康接口 200。操作前已备份数据库。
- 浏览器页面当前需要用户登录，尚未完成登录后的手工 UI 操作验收；不应把构建和接口验证描述为人工页面验收。

详细报告及备份在 /Users/chenxinguang/Documents/nautilus/reports/，包括 audio-flash-integration-result.json、audio-flash-live-validation.json、audio-flash-tests.log、audio-flash-typecheck.log、audio-flash-build.log。
