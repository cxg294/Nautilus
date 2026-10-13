# Aidge 抠图迁移准备记录

记录日期：2026-09-22。状态：**迁移目标已确定，准备资料已归档；尚未实施迁移，当前继续使用旧阿里接口。**

## 已确定的决定

- 用户明确：后续图片/GIF 抠图按 Aidge 迁移；现在只记录准备事项，不切换默认服务。
- 本地模型暂不考虑，不继续安排部署和性能评估。腾讯云、Photoroom 因价格排除；fal 在线方案因用户反馈等待十几秒而暂停。fal 的网页体验不作为本地模型或正式 API 的性能结论。
- Aidge 的目标是承接旧视觉智能平台退市后的抠图需求，不代表本轮已证明画质或速度升级。其他素材创作继续使用 Imagen，不接入元素识别、智能消除等附加能力。
- 选型讨论已收敛；除非用户重新调整方向，后续直接从本记录恢复 Aidge 迁移准备，不重新展开供应商或本地模型选型。

## 当前系统与迁移期限

现用 `SegmentCommonImage / 2019-12-30`，端点 `imageseg.cn-shanghai.aliyuncs.com`。静态图、GIF 拆帧均经 [aliyun-imageseg.js](/Users/chenxinguang/Downloads/anticowork/Nautilus/server/services/aliyun-imageseg.js) 的 `removeBackground` / `removeBackgroundToBuffer` 调用；服务尚未增加 Aidge 提供方或切换配置。

旧平台公告的关键日期：2026-10-11 停止新用户开通调用购买；2027-04-11 停老用户购买续费但保留按量调用；2028-04-30 全面停服。应在全面停服前完成迁移，当前没有指定实施日期。[官方退市公告](https://help.aliyun.com/zh/viapi/product-overview/announcement-regarding-the-discontinuation-of-online-services-on-the-visual-intelligence-open-platform)

## 已验证的 Aidge 调用方式

以本次成功试验为接入依据，不照抄功能介绍页的旧 REST 路径。

| 项目 | 已验证值或处理方式 |
| --- | --- |
| 能力 | 商品素材优化中的智能抠图，开通标识 `imoa_PayAsYouGo_cn` |
| Action / Version | `ImageMatting` / `2026-04-28` |
| Endpoint / Region | `aidge.cn-beijing.aliyuncs.com` / `cn-beijing` |
| 请求 | HTTPS POST `/`，RPC 风格，AK 签名 |
| 输入 | `ImageUrl`，本地文件先上传 OSS，再交付临时签名 GET URL |
| 透明输出 | 显式传 `BackGroundType=TRANSPARENT`；本轮没有设置目标宽高 |
| 成功判断 | 检查 `response.body.Success`；HTTP 200 也可能是业务失败 |
| 结果 | `response.body.Data.ImageUrl`，另记录 `RequestId`、`Code`、`Data.Width/Height/Score` |
| 临时文件 | 输入 OSS 对象在 `finally` 清理；结果立即下载保存，不把签名链接当长期存档 |

正式接入需要适配字段大小写：旧 SDK 使用 `response.body.data.imageURL`，新试验使用 `response.body.Data.ImageUrl`。不应只替换旧端点域名。

当前公开输入参数为 `ImageUrl`、`BackGroundType`、`TargetWidth`、`TargetHeight`、`BgColor`，没有公开的质量档位、模型选择、阈值或边缘精度开关。`Score` 是结果字段，不能调节画质，也不作为跨服务质量评分。[API 参数](https://help.aliyun.com/zh/aidge/api-aidge-2026-04-28-imagematting)

成功脚本：[aidge-matting-eval.mjs](/Users/chenxinguang/Downloads/anticowork/Nautilus/scripts/aidge-matting-eval.mjs)。该脚本从已安装 SDK 的依赖中加载 `@alicloud/openapi-core`，适合复现本次试验；正式接入时应显式声明所需依赖，不依赖旧分割 SDK 的间接依赖长期存在。

## 开通、凭据与费用快照

- 2026-09-22 12:47 仍出现 `ServiceNotOpened`；12:51 后使用同一套 Nautilus 原有 AK，8 张同图 API 调用全部成功。期间用户进行了开通操作，控制台也成功处理了图片；具体哪一步触发生效没有确认。
- PAI 基础服务开通与 Aidge 能力开通不能混为一谈。后续换账号或部署环境，应以真实 `ImageMatting` 调用成功为准。
- 当日控制台额度：100 张中已用 10 张，剩余 90 张，到期 2026-12-22 00:00。已用数量对应 2 次控制台处理和 8 次成功 API；实际迁移时重新核验，不沿用历史余额。
- 当日文档基础价：Aidge 0.002 元/张，与旧接口低调用量基础价相同；1000 张约 2 元，30 帧逐帧抠图约 0.06 元，不含 OSS、流量、重试等费用。没有核验实际账单或购买新资源包。[计费说明](https://help.aliyun.com/zh/aidge/billing-overview)
- 配置只记录变量名：`ALIYUN_ACCESS_KEY_ID`、`ALIYUN_ACCESS_KEY_SECRET`。同一套 AK 仍供音频 OSS 中转使用，迁移后不能直接删除；百炼 `DASHSCOPE_API_KEY` 不在本次迁移范围。
- 试验复用了现有 OSS 配置和独立 `nautilus/aidge-evaluation/` 前缀。正式业务应设计独立抠图前缀和清理周期，保持音频对象及其清理规则正常工作。

## 先导测试结论

固定 8 张输入：6 张项目风格图（1024×1024），2 张已知 alpha 的合成角色图（410×410）。两家均 8/8 返回同尺寸透明 PNG；未测试 GIF、完整 90 输入计划或线上多用户场景。

| 指标 | 旧接口 | Aidge |
| --- | --- | --- |
| 全流程中位耗时 | 1.19 秒 | 2.68 秒 |
| 最短 / 最长 | 0.515 / 2.540 秒 | 1.194 / 3.819 秒 |
| 桃子控制图前景 IoU | 0.9913 | 0.9812 |
| 馆长控制图前景 IoU | 0.9873 | 0.9756 |

耗时包含上传、云请求、下载及本地检查，且两家上传实现不同、测试分时执行；不能把约 2.25 倍的全流程差异全部归因于模型推理。两张合成图指标也不代表所有真实素材。

用户评价是“响应时长变差，质量功过相抵”。具体观察：Aidge 更好地去掉了毛毡图中的灯罩，但线稿变淡、细线损失更多；两张角色控制图旧接口指标略优。两家都没能从漫画海报中单独提取潜艇。迁移记录保留这些已知问题，不把确定选型写成性能验收通过。

证据入口：[完整测试报告](/Users/chenxinguang/Documents/nautilus/aidge-evaluation-2026-09-22/README.md)、[白底对照](/Users/chenxinguang/Documents/nautilus/aidge-evaluation-2026-09-22/comparison-white.png)、[深色底对照](/Users/chenxinguang/Documents/nautilus/aidge-evaluation-2026-09-22/comparison-dark.png)。原始样本、请求记录和 PNG 均在该实验目录，已脱敏。

## 后续实施时要处理的差异

1. **增加 Aidge 服务适配。** 沿用现有图片/GIF 调用边界，单独配置新端点，保留旧提供方用于过渡验证与回退。以下均为待实现设计，当前不存在切换开关。
2. **接入上传与清理。** Aidge 接收 URL，需要 OSS 中转、签名有效期、失败清理、下载超时和业务错误处理。避免超时后无上限重试造成重复收费。
3. **同步输入限制。** Aidge API 文档为 10 MB、256×256 至 3000×3000；功能页最低写 100×100，尚未实测确认，先按较严格约束设计。上传入口当前可接收 15 MB，必须明确超限处理。GIF 现有压缩允许边长降至 64，需要验证小图补边及坐标还原，不直接照搬原限制。
4. **保持 GIF 行为。** 当前项目最多 30 帧、单 GIF 帧处理并发 2；这些是本地实现限制。沿用拆帧、画布、时长、循环和重组流程，不设置会裁切或改变画布的目标宽高；补测细边闪烁和主体漂移。另做全局限流，单 GIF 并发不等于账号整体 QPS。
5. **核对结果下载。** 当前 [matting-result-url.js](/Users/chenxinguang/Downloads/anticowork/Nautilus/server/utils/matting-result-url.js) 将 HTTP 升级为 HTTPS 并限制 `.aliyuncs.com`；下载路由禁止重定向、设 30 秒超时。实际检查 Aidge 返回域名和签名兼容性，必要时精准调整，不能直接放开任意域名。
6. **记录可比耗时及费用。** 分开测上传、API、下载、GIF 重组；增加线稿、小图、复杂主体及连续帧对照。旧评估方案的“耗时不高于旧链路 20%”是当时的建议目标，本轮并未达到，也不是用户承诺或已通过的条件。
7. **验证后再切默认。** 先通过独立脚本和小范围验证，再实施默认切换，保留旧服务仍可用期间的回退方式；不能把当前“记录准备事项”理解为已要求立即切换。

## 恢复工作入口

- [历史评估方案与样本计划](/Users/chenxinguang/Downloads/anticowork/Nautilus/docs/aidge-evaluation-plan-2026-09-22.md)：40 张静态图 + 5 段各 10 帧 GIF，共 90 输入；该完整计划尚未执行，需据后续时间和额度安排。
- [接口盘点及退市影响](/Users/chenxinguang/Downloads/anticowork/Nautilus/docs/aliyun-api-inventory-2026-09-22.md)：抠图受影响，百炼语音、独立 OSS 不因本次公告迁移。
- [替代服务调研及排除理由](/Users/chenxinguang/Downloads/anticowork/Nautilus/docs/matting-alternatives-2026-09-22.md)：保留历史，不作为继续选型的待办。

复现命令（仅供后续明确执行测试时使用，本次未运行）：

```sh
cd /Users/chenxinguang/Downloads/anticowork/Nautilus
node scripts/aidge-matting-eval.mjs aidge /Users/chenxinguang/Documents/nautilus/aidge-evaluation-2026-09-22
```

脚本会跳过已有成功记录且结果文件仍存在的样本；缺失或失败项会重新调用，可能产生费用。需要重新测耗时或更改输入时，应准备新实验目录和样本清单，保留本次基线。

本次只整理文档和共享记忆，没有修改业务代码、云端配置或默认提供方，也没有新增推理调用。
