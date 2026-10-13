# 未识别课程分支条件记录

用户说“看下未识别条件”“处理之前记录的条件”时，按此流程处理。

## 自动记录

打开课程结构的 `/api/course-structure/unit` 接口返回路径前，会扫描整条路径的全部连接，包括缓存命中。无法解析的条件标记为 `unsupported`；能够翻译运算但尚缺变量释义、年级编码或时长单位的条件标记为 `partial`。空脚本但存在关联变量时也会记录；普通无条件连接不记录。

记录保存在项目已有 SQLite 数据库 `server/db/nautilus.db` 的 `course_condition_records` 和 `course_condition_locations` 表。按原始脚本（去掉首尾空白）和排序去重后的监听变量生成指纹；相同条件合并，保留所有不同课程/路径/前后节点位置、课包 MD5、首次及最近出现时间。首次回扫时间表示首次记录时间，不代表课包实际发布日期。

日志不展示在用户页面，不调用外部 AI，不执行条件代码。记录失败不会阻塞课程阅读，服务端有警告，下次打开继续尝试。

## 主动处理流程

在项目根目录使用 Node 20（本机路径 `/Users/chenxinguang/.local/node-v20.19.0-darwin-arm64/bin/node`）：

1. `node scripts/course-condition-records.mjs`：读取待处理记录及所有位置。
2. 按原始条件与对应课包查证含义；年级映射、时间单位等不能猜测。
3. 修改共用转译规则 `shared/course-condition-description.js`；需要变更返回结构时同步 `.d.ts`。前端入口 `src/views/course-structure/condition-description.ts` 仅转出同一规则，避免前后端判定不一致。
4. 将真实样本加入 `src/views/course-structure/condition-description.test.mjs`，运行转译测试与 `server/services/course-condition-records.test.js`；验证页面仍只显示中文说明。
5. `node scripts/course-condition-records.mjs --rescan`：先用新规则重验所有历史记录，再扫描现有全部课程结构缓存。已完整支持的标记 `resolved`，保留原始记录和所有位置；仍有不确定释义的保持待处理。即使旧课包不在缓存里，历史条件也可以重验。规则退化时重新标记待处理。
6. `node scripts/course-condition-records.mjs --all` 可查包含已解决项的完整历史。

不要为了减少待处理数量而直接删除记录或强行标记已支持；以经过确认的转译规则和测试为准。
