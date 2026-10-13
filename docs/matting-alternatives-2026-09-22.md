# 抠图替代服务调研

核对日期：2026-09-22。用户反馈：Aidge 在本批素材中速度变慢，质量得失相抵，希望继续寻找替代服务。

> 最终决定（覆盖本文后续候选建议）：用户确定继续使用旧阿里接口，后续按 Aidge 迁移；本地模型暂不考虑，不再展开本地部署或其他供应商评估。本文保留调研历史及排除依据。后续工作统一参照 [Aidge 迁移准备记录](/Users/chenxinguang/Downloads/anticowork/Nautilus/docs/aidge-migration-preparation-2026-09-22.md)。

最新筛选条件（用户明确）：明显贵于现有阿里接口的服务不考虑，腾讯云、Photoroom 已排除。用户随后反馈 fal Sandbox 单次等待十几秒，认为太慢，因此暂停 fal 在线方案评估。该时长来自用户的网页体验，未独立计时，不等同于正式 API 或 BiRefNet 本地推理基准。当前没有替代候选同时证明成本、速度及质量合适，继续保留旧阿里接口。

## 当前基线

8 张同图测试：旧 SegmentCommonImage 全流程中位数 1.19 秒，Aidge 2.68 秒；Aidge 毛毡图主体选择改善，但细线损失更多，两张合成角色的 alpha 指标也略差。耗时包含上传、API、下载、本地检查，且上传实现不同；不是纯模型推理对照。保留现有默认服务。

结果与固定输入：[先导测试报告](/Users/chenxinguang/Documents/nautilus/aidge-evaluation-2026-09-22/README.md)。

## 阿里云内部候选

| 能力 | 区别及判断 |
| --- | --- |
| 通用高清分割 SegmentHDCommonImage | 支持更大分辨率，采用提交任务后查询结果的异步流程；仍属于旧视觉智能平台，不能解决长期退市问题，也没有证据能降低耗时。 |
| 交互式全图分割 InteractiveFullSegmentation | 官方已公告 2025-10-14 下架，不列为候选。 |
| PAI/EAS 自部署模型 | 官方有 Grounded-SAM 部署方案，但需要自己部署模型、承担计算资源费用；此前开通 PAI 基础服务不等于获得一个现成抠图 API。SAM 的区域分割效果也不能等同于透明边缘抠图效果。 |
| 智能媒体服务 IMS | 有人像、绿幕视频抠图，更适合真人视频；不是本次角色、线稿、任意物件静态抠图的首选。 |

来源：[高清分割](https://help.aliyun.com/zh/viapi/developer-reference/api-universal-hd-split)、[交互式分割](https://help.aliyun.com/zh/viapi/developer-reference/api-interactivefullsegmentation)、[平台退市公告](https://help.aliyun.com/zh/viapi/product-overview/announcement-regarding-the-discontinuation-of-online-services-on-the-visual-intelligence-open-platform)、[PAI 部署实例](https://help.aliyun.com/zh/pai/use-cases/virtual-top-up-solution-based-on-pai-products)、[IMS 能力说明](https://help.aliyun.com/zh/ims/getting-started/introduction-of-intelligent-production-function)。

## 外部候选

| 方案 | 为什么值得测 | 成本和接入限制 |
| --- | --- | --- |
| 腾讯云数据万象 AIPicMatting（已排除） | 国内托管通用抠图，返回 PNG；支持公网图片 URL。 | 通用抠图 0.02 元/次，即 20 元/千张；成本明显超出现有基准，按用户要求不再测试。 |
| Photoroom Remove Background API（已排除） | 专用去背景接口；支持文件上传直接返回图片。 | Basic 0.02 美元/次，按月套餐；成本明显超出现有基准，按用户要求不再测试。 |
| fal.ai 托管 BiRefNet v2（暂停评估） | 有模型、推理分辨率、前景细化、输出 mask 等控制，但用户反馈免费网页等待十几秒，体验不符合要求。 | 正式 API 单价及耗时未确认；不继续投入注册、充值和付费评估。不能据网页时长断定本地 BiRefNet 同样慢。 |
| 本地/自部署 rembg + BiRefNet、isnet-anime（用户决定暂不考虑） | 保留模型资料作为历史参考，不安排部署和性能测试。 | 无供应商逐张 API 费，但有机器、部署和维护成本；没有本机性能结论。 |

来源：[腾讯 API](https://cloud.tencent.com/document/api/460/106750)、[腾讯价格](https://cloud.tencent.com/document/product/436/58964)、[Photoroom 接口](https://docs.photoroom.com/remove-background-api-basic-plan/quickstart-guide)、[单价](https://docs.photoroom.com/remove-background-api-basic-plan/pricing)、[套餐](https://www.photoroom.com/api/pricing)、[fal.ai 参数](https://fal.ai/models/fal-ai/birefnet/v2/api)、[rembg 模型清单](https://github.com/danielgatis/rembg)、[BiRefNet 原项目](https://github.com/ZhengPeng7/BiRefNet)。

补充候选：火山 veImageX 官方演示包含人像/商品抠图，但本次未确认与之对应的完整通用静态抠图 API、单价和开通条件，先保留备选。[官方演示说明](https://imagexdemo.volcengine.com/about)

remove.bg 官方 API 页公告：2026-12-01 起背景移除迁往 Leonardo.Ai。本次正为避免迁移风险筛选新服务，因此降低其优先级；该公告本身不等于已经确认旧 API 当日停服。[官方公告所在页](https://www.remove.bg/api)

## 原 fal 评估计划（因用户反馈太慢而暂停）

1. 先用 fal 免费 Sandbox 复用现有 8 张输入做效果筛选。2026-09-22 实际打开模型页的 Try free in Sandbox 后，界面已选中 Remove Background + fal-ai/birefnet/v2，并显示“15 free generations today. No account needed.”及运行费用 Free。先用默认配置，剩余额度复测线稿、毛毡、角色的差异；尚未上传或运行。
2. 免费网页测试不代表正式 API 免费，也不代表生产 API 延迟。模型公开页目前显示 0 美元/compute second，尚不足以确认正式账单规则；API 单价未确认前不充值、不批量付费测试。效果与单价均通过后，再以 General Use (Light)、1024x1024、refine_foreground=true、PNG 作为 API 基线，每张重复 3 次，交错调用新旧服务，分别记录准备/上传、服务响应、下载及总耗时；需要调参时再单独比较 Matting 模型或前景细化开关，避免同时改变多个变量。
3. 白、黑和彩色底同时看线条保留、背景残留、白边、半透明边缘；两张合成角色继续计算 alpha 指标。主观主体选择单独记录。
4. 静态图候选通过且符合成本约束后，再测连续 GIF 帧的边缘闪烁、耗时和费用。支持 GIF 文件格式不代表具有时序一致性。
5. 若现成 API 均不理想，增加 BiRefNet 通用/Matting 与 isnet-anime 对照，先验证效果再决定是否部署。

本次仅调研并存档，未注册或购买新服务，未执行候选 API 调用，未修改生产抠图路由。

免费试用入口：[BiRefNet Sandbox](https://fal.ai/sandbox?models=d10eac7qn7dbfsbcffeg&op=image.remove_background)。该链接来自官方模型页，免费次数与限制以当时界面显示为准。正式 API 需要账号及 FAL_KEY，密钥只存服务端环境，不放聊天或前端。

后续筛选顺序：先看成本与用户可感知的等待时间，再投入画质对照。当前参考基线为旧接口约 0.002 元/张、先导样本全流程中位数 1.19 秒；这是比较基线，用户尚未指定严格的价格或延迟上限。本地模型尚未部署实测，不承诺其一定更快。
