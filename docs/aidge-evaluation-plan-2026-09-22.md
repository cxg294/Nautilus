# Aidge 抠图迁移评估方案

> 最新决定（2026-09-22）：用户已确定后续按 Aidge 迁移，当前继续旧阿里接口，只归档迁移准备；本地模型暂不考虑。统一恢复入口为 [Aidge 迁移准备记录](/Users/chenxinguang/Downloads/anticowork/Nautilus/docs/aidge-migration-preparation-2026-09-22.md)。下文保留试验方法及结果，不再代表供应商选型尚未确定。

日期：2026-09-22。状态：Aidge 已生效，8 张同图对照已完成，两家均 8/8 返回同尺寸透明 PNG。Aidge 对毛毡主体选择更好，但线稿细线丢失更多，两个卡通控制图的 alpha 指标略差，暂不建议直接替换默认服务。全流程中位耗时：旧 1.19 秒，Aidge 2.68 秒（小样本、不同上传链路）。免费额度已用 10、剩余 90 张；GIF 尚未测试。[完整先导实测记录](/Users/chenxinguang/Documents/nautilus/aidge-evaluation-2026-09-22/README.md)。下列阈值是建议的试验验收标准，不是厂商承诺。

## 选型判断

用户已明确本轮只评估 Aidge 图片/GIF 抠图，素材创作继续使用 Imagen。元素识别、智能消除、翻译和多步骤加工不纳入本轮接入计划。

评估重点是去背景后保留原角色、细线、透明边缘，以及 GIF 帧间一致性。Aidge 主要面向电商图片，需要用实际教研素材验证。

## 本轮接口及接入注意事项

只评估 `ImageMatting`：输入图片，指定 `BackGroundType=TRANSPARENT`，获得去背景的透明结果。文档刊例价为 0.002 元/张，实际以控制台为准。[API 文档](https://help.aliyun.com/zh/aidge/api-aidge-2026-04-28-imagematting)、[计费说明](https://help.aliyun.com/zh/aidge/billing-overview)。

- 抠图功能页写输入最低 100×100，而 `Aidge/2026-04-28` 的 `ImageMatting` API 文档写 256×256。先以较严格的 256×256 作为接入基线，把小图补边及结果坐标还原列入验证。前一轮盘点引用的 100×100 不能作为已经验证的接口限制。[功能页](https://help.aliyun.com/zh/aidge/intelligent-image-matting)、[API 参数](https://help.aliyun.com/zh/aidge/api-aidge-2026-04-28-imagematting)。
- 功能页保留 `/rest/ai/image/...` 的写法，API 总览同时明确 `Aidge/2026-04-28` 使用 RPC 签名。实际接入应先在对应版本 OpenAPI Explorer 验证，固定 Action、SDK 版本及返回字段，不仅替换旧服务的域名。[API 总览](https://help.aliyun.com/zh/aidge/api-aidge-2026-04-28-overview)。

## 与现用 SegmentCommonImage 的差异

两者的基本任务都是从静态图片中提取主体、输出透明图。公开文档没有给出二者的算法型号或同一组教研素材的效果对照，不能判断 Aidge 必然更精细，也不能判断两者底层模型相同。

| 对比项 | Nautilus 现用通用分割 | Aidge 智能抠图 | 对本项目的含义 |
| --- | --- | --- | --- |
| 云 API | `SegmentCommonImage`，版本 `2019-12-30` | `ImageMatting`，版本 `2026-04-28` | 需要新的服务适配，不能只替换域名 |
| 最大文件 | 3 MB | 10 MB | 大图有望减少预压缩；输入容积不代表分割质量 |
| 输入尺寸 | 宽高大于 32，最长边不超过 1999 | API 文档 256×256 至 3000×3000；功能页最低写 100×100 | 大图限制放宽，小图要求变严，最低值仍需实测 |
| 透明图 | 不传 `ReturnForm` 即返回原尺寸四通道 PNG；Nautilus 正在使用此模式 | 必须指定 `BackGroundType=TRANSPARENT` | 迁移时保持透明输出和画布尺寸 |
| 其他输出模式 | 支持 `mask`、`whiteBK`、`crop`，Nautilus 未使用这些参数 | 公开参数含白底、自定义颜色、目标宽高，未列直接返回单通道 mask 的选项 | 当前去背需求可对应；不应认定全部能力完全兼容 |
| 裁切与尺寸 | 默认保留原尺寸；`crop` 才裁边 | 功能页说明：不指定目标宽高保留原图；指定后可裁去空白再缩放 | GIF 首轮不设目标宽高，检查主体位置与画布是否一致 |
| 返回信息 | `Data.ImageURL` 临时链接 | `Data.ImageUrl`，另有宽高、`Score` 与用量信息 | 返回字段需适配；Score 尚无跨服务可比标尺 |
| 结果链接 | API 文档写有效期 30 分钟 | 功能页写通常 7 天 | 仍及时下载，不依赖临时链接长期存储 |
| GIF | 云 API 输入格式未列 GIF；Nautilus 自行拆帧调用 | 云 API 输入格式也未列 GIF | 沿用拆帧/重组，不自动获得时序一致性能力 |

来源：[现用 API](https://help.aliyun.com/zh/viapi/developer-reference/api-k8cs8t)、[Aidge API](https://help.aliyun.com/zh/aidge/api-aidge-2026-04-28-imagematting)、[Aidge 功能页](https://help.aliyun.com/zh/aidge/intelligent-image-matting)。

费用与吞吐：旧接口月调用量不超过 1 万次时按量价为 0.002 元/次，高阶梯为 0.0018、0.0016 元/次；Aidge 文档刊例价为 0.002 元/张。按基础价，1000 张两者均为 2 元，30 帧 GIF 的分割调用均约 0.06 元，不含 OSS、重试等费用。旧接口按量计费和 Aidge 功能页均标 5 QPS；QPS 不是单张响应时间，实际吞吐和延迟需要测量。未查询账号实际账单或资源包折扣。[旧计费](https://help.aliyun.com/zh/viapi/product-overview/billing-is-introduced-1)、[Aidge 计费](https://help.aliyun.com/zh/aidge/billing-overview)。

代码对应：当前 [服务函数](/Users/chenxinguang/Downloads/anticowork/Nautilus/server/services/aliyun-imageseg.js:33)用 SDK Advance 接收本地文件流并完成上传；Aidge 公开请求收 `ImageUrl`，需适配图片上传和 URL 交付。现有 [GIF 路由](/Users/chenxinguang/Downloads/anticowork/Nautilus/server/routes/image-matting.js:17)最多 30 帧、单 GIF 并发 2，并将帧限制到 1999 像素和约 2.8 MB；这些是项目实现限制，不是 Aidge 的限制。静态图当前直接传入旧服务，没有经过这套 GIF 压缩流程。上传入口接收 15 MB，迁移时需要同步新服务 10 MB 上限的校验。

顺带核对：路由内旧结果链接“有效期一般一小时”的注释与旧 API 文档的 30 分钟不一致，此次仅记录，未修改业务代码。

## 第一轮试验

### 样本与对照

| 组别 | 样本 | 对照方法 |
| --- | --- | --- |
| 静态抠图 | 40 张：卡通角色、真人/发丝、物件/细线、复杂或多主体各 10 张；交叉覆盖低分辨率、半透明、近背景色 | 同一输入分别跑当前分割和 Aidge，随机隐藏服务名称进行评分 |
| GIF | 5 段各 10 帧的短动画，共 50 帧 | 使用同一解码帧和重组方式，对比两家分割后的动画；此轮是短动画试验，之后补真实长帧数验收 |

### 检查方法与进入小范围试用的门槛

| 维度 | 如何看 | 建议门槛 |
| --- | --- | --- |
| 抠图效果 | 黑、白、棋盘背景下检查缺胳膊/缺细线、残留背景、白边、透明度 | 40 张至少 36 张无需修图即可使用，且不能有某一类素材集中失败；与旧服务逐项比较 |
| GIF 连续性 | 实际播放，检查额外闪烁、裁切跳动、主体位置漂移及固定部位消失 | 5 段都没有新出现的明显时序问题；保持画布、时长和循环方式 |
| 耗时与稳定性 | 记录上传、云处理、结果下载、重组的总耗时；区分首次成功和重试后成功 | 报告中位数、P95、失败数；建议总耗时不比旧链路高 20% 以上，超出则评估是否值得等待 |
| 成本 | 记录每步调用与重复请求，折算为每张可用成品/每段动画成本 | 不只比较接口单价，同时记录人工修补时间 |

技术对照尽量采用同一输入；小图兼容测试单列原始尺寸、补边和还原变换，不能把预处理差异误归因于模型效果。每项保存样本 ID、参数、请求 ID、耗时、状态、结果文件、评分和失败原因。签名 URL 不作为长期结果存档。

### 预算

按文档刊例价自行计算：40 张静态图 + 50 帧 GIF = 90 次抠图，`90 × 0.002 = 0.18 元`。未计旧平台、OSS、下载流量和额外调用；免费额度另行抵扣，实际以控制台为准。[计费说明](https://help.aliyun.com/zh/aidge/billing-overview)。

官方列出抠图首次开通有 100 张免费额度，有效期 90 天，账号是否已经领取或过期仍需查看。[免费额度说明](https://help.aliyun.com/zh/aidge/free-quota)。此前包含识别/消除的 3.48 元试验预算已不适用于当前范围。

## 实施顺序

1. 在 Aidge 确认目标能力已开通、试用余额与调用身份，先用少量样本通过 OpenAPI Explorer 验证请求和结果。素材优化可通过控制台上传数据、创建任务批量测试，也可直接调用 API。2026-09-22 已实测当前控制台提供即时抠图体验，官方操作指南的“不提供即时试用”描述已与页面不一致。[操作指南](https://help.aliyun.com/zh/aidge/user-guide/material-optimization-operation-guide)。
2. 建一个独立试验脚本，按上述样本跑对照并生成评审结果，暂不改变现有抠图默认行为。Nautilus 已有服务函数边界，可在后续加入 Aidge 提供方，保留现有 GIF 重组流程。
3. 通过试验后在抠图页面增加可切换的 Aidge 选项，补充更长 GIF、多用户限流与实际尺寸回归，再决定是否成为默认服务。
