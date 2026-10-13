# Nautilus 阿里云接口盘点与视觉智能退市影响

核查日期：2026-09-22。范围：Nautilus 当前工作区代码（含未提交修改）、本机项目配置、系统代理配置、阿里云官方文档。

> 同日后续更新：Aidge 已用原有 AK 完成 8/8 同图测试，用户确定后续按 Aidge 迁移，当前仍用旧接口。下文“未调用/尚未实测”等是初次盘点时的历史状态；最新开通、测试、接入方式及待办以 [迁移准备记录](/Users/chenxinguang/Downloads/anticowork/Nautilus/docs/aidge-migration-preparation-2026-09-22.md) 为准。迁移应使用已验证的 `ImageMatting/2026-04-28` RPC 调用方式。

## 结论

直接受影响的是图片/GIF 抠图：两者都调用视觉智能开放平台的 `SegmentCommonImage`，当前没有备用提供方。百炼 CosyVoice、独立 OSS 存储及课程素材 OSS 链接不属于本次视觉智能退市公告的范围。

本机配置已具备视觉智能、百炼、OSS 所需参数；本地后端 `/api/health` 返回正常。这只确认配置存在和后端存活，不等于已验证云端调用成功。本次未发起计费推理、上传素材或登录云控制台，账号开通资格、余额、资源包和实际 QPS 尚未核验。

## 当前接口清单

| 能力 | 云端接口/操作 | Nautilus 入口 | 配置与用途 | 退市影响 |
| --- | --- | --- | --- | --- |
| 静态图片抠图 | `POST https://imageseg.cn-shanghai.aliyuncs.com/`；RPC Action=`SegmentCommonImage`，Version=`2019-12-30` | `POST /api/image-matting/segment` | AK 签名；本地文件经 SDK Advance 上传，返回透明图片临时 URL | 直接受影响 |
| GIF 逐帧抠图 | 同一个 `SegmentCommonImage`，每帧一次 | 同上，按文件类型进入 GIF 分支 | 最多 30 帧；单个 GIF 的帧处理并发为 2；本地重新编码 GIF | 直接受影响；成功处理 30 帧需 30 次分割请求 |
| 抠图文件上传授权（SDK 隐式依赖） | `GET https://openplatform.aliyuncs.com/`；Action=`AuthorizeFileUpload`，Version=`2019-12-19`，随后上传到授权返回的 OSS 地址 | `segmentCommonImageAdvance()` 内部 | 不是手工管理的 `nautilus-audio` 桶 | 随抠图调用链迁移；不能据此推断整个 OpenPlatform 或 OSS 都退市 |
| 语音合成、音色试听、字词时间戳 | `POST https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer` | `POST /api/voice-lab/synthesize`、`POST /api/voice-lab/voices/:voice/audition` | `DASHSCOPE_API_KEY`；默认模型 `cosyvoice-v3.5-flash`，后端允许 `cosyvoice-v3.5-plus`；时间戳分支使用 HTTP SSE | 不在本次公告范围 |
| 声音复刻、声音设计 | `POST https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization`；model=`voice-enrollment`，action=`create_voice` | `POST /api/voice-lab/voices/clone`、`/clone-upload`、`/design` | 复刻提交音频 URL；设计提交描述和预览文字；当前目标模型为 `cosyvoice-v3.5-flash` | 不在本次公告范围 |
| 音色查询、删除 | 同一 `customization` 接口；action=`list_voice` / `delete_voice` | `GET /api/voice-lab/voices`、`DELETE /api/voice-lab/voices/:voice` | 使用百炼 API Key；音色中文名和部分试听信息本地维护 | 不在本次公告范围 |
| 复刻音频 OSS 中转 | SDK `put`、`delete`、`list`；本地生成签名 GET URL | 上传复刻流程、`GET /api/voice-lab/oss/probe` | 桶 `nautilus-audio`，地域 `oss-cn-beijing`，前缀 `nautilus/voice-lab/`；签名有效期配置为 1800 秒；已开启进程内定时清理 | 不在本次公告范围 |
| 课程 PPT 等素材读取 | `https://ppt-hetao.oss-cn-beijing.aliyuncs.com/...` 的文件 GET | 课程资产页面素材链接 | 核桃素材存储地址，不是视觉 AI 处理接口 | 不在本次公告范围 |

代码证据：

- [分割调用](/Users/chenxinguang/Downloads/anticowork/Nautilus/server/services/aliyun-imageseg.js:33)
- [GIF 处理与并发](/Users/chenxinguang/Downloads/anticowork/Nautilus/server/routes/image-matting.js:104)
- [本机已安装 SDK 的上传授权链路](/Users/chenxinguang/Downloads/anticowork/Nautilus/node_modules/@alicloud/imageseg20191230/dist/client.js:971)
- [语音合成与音色管理](/Users/chenxinguang/Downloads/anticowork/Nautilus/server/services/aliyun-tts.js:305)
- [OSS 上传及清理](/Users/chenxinguang/Downloads/anticowork/Nautilus/server/services/aliyun-oss.js:78)
- [服务配置](/Users/chenxinguang/Downloads/anticowork/Nautilus/server/config/env.js:64)
- [课程素材链接](/Users/chenxinguang/Downloads/anticowork/Nautilus/src/views/course-assets/data.ts:102)

鉴权配置只记录变量名，不记录密钥：`ALIYUN_ACCESS_KEY_ID`、`ALIYUN_ACCESS_KEY_SECRET`、`DASHSCOPE_API_KEY`。视觉智能与 OSS 当前共用前两个变量；百炼使用独立 API Key。迁移抠图后不能直接删除这组 AK 配置，否则会同时影响音频上传复刻。

排除项：旧 Qwen3 TTS 代理配置的三个地址在数据库中均为空，未作为当前阿里云云接口统计；ECS/CDN/SLB 在部署待办中出现，但没有据此认定已经部署。当前代码没有发现主动调用视觉平台 OCR、人脸识别、内容审核或视频理解的链路。

## 官方公告与时间点

| 时间 | 官方安排 | 对本项目的含义 |
| --- | --- | --- |
| 2026-06-10 后 | 停止扩容 QPS | 批量 GIF 或多用户增长不能再依赖购买更高并发来解决；代码的“每个 GIF 并发 2”不是全局 QPS 限制 |
| 2026-10-11 起 | 停止新用户开通、调用和购买；符合条件的老用户继续调用和续费 | 使用新账号部署、交付需提前考虑替代服务；现有账号资格仍需控制台确认 |
| 2027-04-11 起 | 老用户停止购买和续费，历史已开通用户仍可按量调用 | 资源包和续费计划需要调整，不应把这一日期误读为直接停机日 |
| 2028-04-30 起 | 全面停止服务，同时关闭相关控制台、支持、工单及退款服务 | 抠图必须在此日期前迁出，否则新图片和 GIF 去背都会失败 |

来源：[线上服务退市公告](https://help.aliyun.com/zh/viapi/product-overview/announcement-regarding-the-discontinuation-of-online-services-on-the-visual-intelligence-open-platform)、[停止扩容 QPS 公告](https://help.aliyun.com/zh/viapi/product-overview/notice-regarding-the-termination-of-qps-capacity-expansion-for-the-visual-intelligence-open-platform)。

另有一份较早的[部分付费能力停服公告](https://help.aliyun.com/zh/viapi/product-overview/announcement-on-the-stop-of-partial-payment-ability-of-visual-intelligence-open-platforms)：2026-04-20 下架的清单包含五官分割 `ParseFace` 等，但没有本项目使用的 `SegmentCommonImage`。因此，“此前那批下线未命中”不能推导为“未来一直不受影响”；本项目现在需要依据全面退市公告安排迁移。

## 建议的处理顺序

1. **先确认账号状态。** 在现有云账号中核实通用分割的开通记录、当前计费方式、资源包剩余量与 QPS。仅凭 `.env` 中有密钥，不能证明账户享有老用户资格。
2. **停止新增对该平台的依赖，安排抠图迁移验证。** 建议近期开始对比验证，不必等待最终停服日期。把替代实现接在现有 `removeBackground` / `removeBackgroundToBuffer` 边界，尽量保留上传、GIF 解码、重组与导出流程。
3. **优先评估官方列出的智能抠图。** [Aidge 智能抠图文档](https://help.aliyun.com/zh/aidge/intelligent-image-matting)提供 `POST /rest/ai/image/matting`，支持 `BackGroundType=TRANSPARENT`。这只是候选，尚未在本项目实测，不能保证与旧接口效果一致。
4. **用实际教研素材验收。** 覆盖卡通角色、发丝/细线、半透明边缘、小尺寸素材、复杂背景和 GIF 帧间稳定性，并比较时延及逐帧总成本。后续核对发现：功能页写输入最低 100×100，但 [ImageMatting API 文档](https://help.aliyun.com/zh/aidge/api-aidge-2026-04-28-imagematting)写 256×256；先按更严格限制接入并实测确认。现有 GIF 压缩逻辑允许边长降至 64，需要处理尺寸兼容；GIF 保持画布和主体位置，避免各帧自动裁切导致抖动。详细样本和门槛见 [Aidge 评估方案](/Users/chenxinguang/Downloads/anticowork/Nautilus/docs/aidge-evaluation-plan-2026-09-22.md)。
5. **迁移时核对周边依赖。** 旧 SDK 自动上传本地文件，新接口要求 `ImageUrl`；需设计上传中转。当前结果下载代理只允许 `.aliyuncs.com`，新服务返回域名要匹配校验。迁移视觉服务时保留仍被 OSS 使用的 AK 配置。百炼语音和课程 OSS 链接无须因本次公告更换。

以上为接口盘点与影响评估，未改动业务代码或云端服务配置。
