# GitHub 发布填写建议

## 推荐仓库名

```text
zhenyi-bazi-paipan
```

备选：

```text
bazi-paipan
zhenyi-bazi
four-pillars-paipan
```

## About / Description

推荐：

> 十年命理实践打磨的开源八字排盘系统｜TypeScript · 真太阳时 · 公农历 · 大运流年 · 神煞 · 全国省市区县 · PC/移动端

精简版：

> 专业开源八字排盘引擎：TypeScript、真太阳时、公农历、大运流年、神煞、全国地区与响应式 UI

## Topics

建议添加：

```text
bazi
four-pillars
four-pillars-of-destiny
chinese-astrology
chinese-calendar
lunar-calendar
true-solar-time
shensha
typescript
nodejs
fortune-telling
divination
open-source
```

## 首次 Release

Tag：

```text
v1.0.0
```

Title：

```text
真一八字排盘 v1.0.0 — 首个公开版本
```

Release 正文：

```markdown
真一八字排盘首个公开版本。

这是一个由十年命理从业实践驱动、使用 TypeScript 工程化实现的八字排盘系统。

本版本包含：

- 公历 / 农历 / 闰月
- 二十四节气与四柱
- 真太阳时实际进入排盘核心
- 十神、藏干、纳音、旬空、十二长生
- 胎元、命宫、身宫、胎息
- 起运、交运、12 步大运、120 流年、小运
- 五行评分
- 结构化神煞规则系统，覆盖主命局 / 大运 / 流年
- 全国省 / 市 / 区县三级出生地与经纬度
- 手机 + PC 响应式排盘界面
- 命盘本地保存、载入、删除
- 关键回归测试

迁移阶段完成 300 组 PHP → TypeScript 全字段对拍，测试范围内 300 / 300 一致。

欢迎提交 Issue、PR，也欢迎命理从业者提供不同理论口径与可复核案例。
```

## GitHub 设置建议

- Repository visibility：Public
- Issues：开启
- Pull Requests：开启
- Discussions：可以开启，适合讨论门派 / 历法口径差异
- Wiki：前期可关闭，文档先统一放 `docs/`
- Releases：发布 `v1.0.0`
- License：GitHub 会自动识别根目录 `LICENSE` 为 MIT

## 上传前最后检查

```bash
npm install
npm run check
git status
```

确认没有 `.env`、密钥、数据库账号、内部 Prompt 或商业私有文件后再推送。
