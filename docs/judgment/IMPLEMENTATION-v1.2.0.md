# 真一判盘引擎 v1.2.0 — 第二阶段实现说明

## 本轮目标

从“程序能跑”升级到“开始用原书命例约束第一主线”。

本轮没有继续堆更多断语，而是优先减少错误做功、增加冲制/党势、区分正向与反向做功，并建立首批 Source Consistency Benchmark。

## 核心新增

- 普通地支生克不再跨柱遥推；
- 单纯邻支普通相克降级为条件候选；
- 冲制进入正式做功候选；
- 完整三合/三会含日支时，党内节点可在当前上下文提升主位关联；
- `QiShiResolver` 支持相生两元素党势；
- 气势制用必须有真实关系接点；
- 气势关系检查加入方向约束，禁止把“目标反克成员”倒算成“党势制目标”；
- 新增 `leadActorNodes`；
- 新增 `gongDirection`；
- 第一主线只从 `effective` 中选择；
- 第二作用线去除与第一主线完全相同的重复结构；
- UI 增加“做功方向”。

## 新增测试

```text
tests/judgment-source-benchmark-vectors.json
tests/judgment-source-benchmark.js
```

执行：

```bash
npm run test:judgment:source
```

当前首批：8/8。

## 全量测试

```text
基础 Regression：10/10
Extended：23/23
Audit fixes：29/29
Direct pillars：36/36
Judgment regression：12/12
Source consistency：8/8
Stress：120/120
```

注意：这些数字不是现实预测准确率。
