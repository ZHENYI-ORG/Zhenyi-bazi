# 真一判盘引擎 v1.1.0 — 源码实现说明

## 本次目标

在现有 `1.0.22` 完整 TypeScript 源码上新增“判盘”，不改动原四柱排盘、真太阳时、神煞、大运流年等计算链路。

判盘的核心原则是：

```text
先事实 → 再关系 → 再语义 → 再宾主/意向/气势 → 再做功 → 再归属 → 再裁主线 → 最后接岁运
```

AI 不参与第一主线计算。

## 新增源码

```text
src/core/judgment/
├── BlindJudgmentEngine.ts
├── types.ts
├── README.md
└── rules/
    ├── governance.json
    ├── source-registry.json
    └── rule-dsl.schema.json
```

## 接入点

- `src/api.ts`
  - 普通生日排盘完成后追加 `blind_judgment`
  - 四柱直排完成后追加 `blind_judgment`
- `src/server.ts`
  - 新增 `POST /api/judgment`
- `public/result.html`
  - PC 左侧新增“盲派判盘”
  - 手机顶部结果 Tab 新增“判盘”
  - 保留手机底部 `首页 / 排盘 / 解析`

## 已实现的引擎层

1. `BaziFactGraph`
2. 标准干支关系
3. Relation Semantic
4. Root / Origin 分层
5. Contextual Guest–Host
6. Ten-God Intent
7. QiShi / Party
8. Dynamic TiYong
9. 制/合/化/生/泄/墓/复合做功候选
10. Gong Validator
11. Ownership Resolver
12. Zheng/Fan Resolver
13. Gong Level（L0-L5，仅序位）
14. Mainline Arbiter
15. Xiang fallback
16. Dayun / Liunian trigger
17. EvidenceTrace

## UI

判盘页延续现有白色与暖灰色视觉体系，重点信息使用低饱和暗金，不建立单独黑色主题。

第一屏回答：

1. 这张盘在做什么；
2. 做功结果归谁；
3. 当前岁运对主线的作用。

四柱节点可点击查看十神、宾主、根气、来源、意向和参与关系。

## 自动测试

### 原项目回归

`npm test` 中原有回归继续执行：

- Regression：10/10
- Extended：23/23
- Audit fixes：29/29
- Direct pillars：36/36

### 判盘专项

`tests/judgment-regression.js`

重点锁定：

- 普通排盘必带判盘结果；
- 女命/男命均稳定；
- 四柱直排无年份不虚构岁运；
- 乙辛不误判五合、甲己正常识别；
- 原局冲墓不自动判 `store_open`；
- 做功状态和成果归属使用固定枚举；
- 同盘重复运行结果稳定；
- 事实关系与语义关系分层；
- Root 与 Origin 分离；
- 功量只输出 L0-L5，不输出“百万/厅级”式伪精确；
- 主线 EvidenceTrace 保留规则 ID。

### 压力测试

`tests/judgment-stress.js` 批量生成 120 组日期/时辰命盘，检查判盘结构与运行稳定性。

## 当前明确不做

- 未核实暗合/暗冲自由推导；
- 复杂换象直接生产化；
- “冲墓 = 一定开库发财”；
- 功量直接映射财富金额/官阶；
- 用单一神煞覆盖结构主线；
- 医疗、寿命、犯罪等高风险绝断。

这些内容未来只能在规则来源、前置条件和反证都冻结后逐条进入白名单。
