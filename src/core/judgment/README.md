# 真一盲派做功判盘引擎

此模块只消费已经排好的 `chart`，不改动排盘算法。核心判断不依赖 LLM。

当前生产链：

`FactGraph → RelationFact → RelationSemantic → Contextual Guest/Host → TenGod Intent → QiShi → Gong Paths → Validation → Ownership → Zheng/Fan → Mainline → Xiang Fallback → Timing → EvidenceTrace`

## 当前版本边界

已实现高确定性骨架；争议暗合、暗冲、复杂换象、特殊墓法未通过白名单时不进入主判断。功量只用于内部序位，不输出财富金额或官阶硬映射。

## 关键原则

- 明透与藏干分层。
- Root / Origin / Ownership 不混为一谈。
- 体用属于路径角色，不是十神永久属性。
- 同一“冲/合”先记录事实，再按语境判断语义。
- 没有明确主线时允许保守降级，不强套格局。


## v1.8.0 Timing 规则

- Identity First：先解析岁运身份，再判断是否命中主线。
- 盲派专属刑/破 profile，不混用普通六破与自刑。
- 冲、合先解析语义，不直接映射吉凶或“完成/削弱”。
- 墓库按当前时间层重算 snapshot；历史 facts 仅审计。
- 未来年份不做关系数量评分。


## v1.9.0 State Replay / Root Strata

- 第一主功是岁运重演的主题锚点，岁运不允许凭空生成新的原局大事；
- `state_replay` 按大运→流年→流月累计重演同一主功；
- 普通大运生克只作背景，不单独打开重大应期门；
- 根气拆成坐下直接根/禄根、长生、墓库、余气与其它柱外援；
- `root_score` 已废弃，禁止用根气数量简单相加决定做功能力。
