# API 使用说明

## `POST /api/paipan`

请求头：

```text
Content-Type: application/json
```

### 请求示例

```json
{
  "name": "命例一",
  "birthday": "1990-06-15",
  "birth_time": "12:00",
  "gender": "male",
  "is_lunar": 0,
  "is_leap": 0,
  "use_true_solar_time": true,
  "longitude": 120.306592,
  "birth_region": "浙江省杭州市余杭区",
  "timezone_id": "Asia/Shanghai"
}
```

### 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `name` | string | 否 | 命主姓名 / 命例名称 |
| `birthday` | string | 是 | `YYYY-MM-DD` |
| `birth_time` | string | 是 | `HH:mm` |
| `gender` | string | 是 | `male` / `female` |
| `is_lunar` | number / boolean | 否 | 是否按农历输入 |
| `is_leap` | number / boolean | 否 | 农历输入时是否闰月 |
| `use_true_solar_time` | boolean / number | 否 | 是否使用真太阳时，默认 `true` |
| `longitude` | number | 条件必填 | 真太阳时开启时必填；关闭时可省略 |
| `birth_region` | string | 否 | 出生地展示文本 |
| `timezone_id` / `birth_timezone_id` | string | 否 | IANA 时区，例如 `Asia/Shanghai`、`America/New_York`、`UTC` |
| `timezone_offset` / `birth_timezone_offset` | number | 否 | 固定 UTC 小时偏移，范围 -14—14；有 IANA 时区时优先使用时区 ID |

### 成功响应

```json
{
  "ok": true,
  "data": {
    "...": "完整命盘对象",
    "blind_judgment": {
      "ok": true,
      "engine_version": "1.9.0-state-replay-root-strata",
      "mainline": {},
      "presentation": {},
      "evidence": []
    }
  }
}
```

返回对象包含四柱、真太阳时、十神、藏干、纳音、旬空、盲派起运/交运、大运干支分运、流年、小运、胎元、命宫、身宫、胎息、节气、五行评分、神煞，以及 `blind_judgment` 判盘结果。

时间与运法审计字段包括：`civil_time`、`true_solar_time`、`effective_time`、`time_basis`、`use_true_solar_time`、`paipan_rules`。每步大运包含 `stem_phase` / `branch_phase`；每个流年包含 `dayun_phase`、`active_dayun_component`、`liunian_start_event` / `liunian_end_event`。`blind_judgment.timing` 还返回当前 `liunian` 与按十二节令动态计算的 `liuyue`。

`blind_judgment` 由本地确定性规则引擎生成。它不会让大模型重新计算四柱，也不会因为某一个冲、合、墓或神煞就直接生成现实事件。

### 错误响应

```json
{
  "ok": false,
  "message": "请填写完整的出生日期和时间"
}
```

### 状态码

- `200`：排盘成功
- `400`：请求 JSON 无效
- `405`：方法不支持
- `422`：输入校验或排盘失败
- `500`：服务器内部错误

---

## `POST /api/liuyue`

按一个**流年年份 + 日主天干**生成该流年的 12 个节令流月。该接口用于 v2.0 专业岁运页按年加载流月，主 `/api/paipan` 不再为每个流年常驻 12 个月对象。

### 请求

```json
{
  "year": 2026,
  "day_stem": "庚"
}
```

- `year`：1600—2200 的整数。
- `day_stem`：甲乙丙丁戊己庚辛壬癸之一。

### 返回

```json
{
  "ok": true,
  "data": {
    "year": 2026,
    "rule": "十二节令切换 · 五虎遁月干 · 流月只作月份定位",
    "months": [
      {
        "pillar": "庚寅",
        "start_term": "立春",
        "end_term": "惊蛰",
        "boundary_rule": "十二节令",
        "localization_only": true
      }
    ]
  }
}
```

流月起止使用精确节令时刻；最后一个丑月由次年小寒起，到次年立春止。该接口只生成客观流月数据，不直接判断重大事件。

---

## `POST /api/judgment`

用于对**已经存在的完整命盘 JSON**单独执行判盘，不重新计算出生日期、真太阳时或四柱。

适合旧命盘数据升级、回归测试，或前端已有命盘但缺少 `blind_judgment` 时按需补算。

### 请求示例

```json
{
  "chart": {
    "bazi": {
      "year": {},
      "month": {},
      "day": {},
      "hour": {}
    },
    "dayun": [],
    "liunian": []
  }
}
```

也兼容直接传命盘对象，或使用 `data` 包一层。

可选传入 `now` 或 `at`（ISO 8601 时间）指定岁运重演时点：

```json
{
  "chart": {"bazi": {}, "da_yun": []},
  "now": "2026-03-05T14:05:00Z"
}
```

不传时仍按当前真实时间判定。v2.0 专业岁运页选择历史 / 未来流月时，会取该月精确节令起点后约 2 分钟调用此能力，以避免节令边界刚好等于切换瞬间；若同一流月内另含大运交运节点，页面会明确提示该月前后状态不能视为完全相同。

### 成功响应

```json
{
  "ok": true,
  "data": {
    "ok": true,
    "engine_version": "1.9.0-state-replay-root-strata",
    "rule_version": "blind-core-2026-09-v5-identity-tomb",
    "facts": [],
    "relations": [],
    "relation_semantics": [],
    "roots": {},
    "origins": {},
    "guest_host": {},
    "intents": [],
    "qishi": [],
    "gong_paths": [],
    "mainline": {},
    "timing": {},
    "evidence": [],
    "presentation": {}
  }
}
```

### 设计边界

- 关系事实与关系语义分层；例如“辰戌冲”不会天然等于“开库”。
- 未进入白名单的暗合、暗冲、换象不参与核心裁决。
- `root`（根气）、`origin`（来源）与 `ownership`（成果归属）分别计算。
- 做功主线先枚举全部候选，再做成立门禁、归属和主线裁决，不采用“第一条匹配即返回”。
- 直接四柱录入若没有出生年份/起运数据，不虚构当前大运或流年。

---

## 兼容接口

```text
POST /api.php
```

这是历史前端兼容路径，仍由 TypeScript Server 处理，不需要 PHP 运行环境。


## v1.5 岁运时间字段

日期时间排盘在 `jiaoyun` 中新增：

- `first_event`：第一次正式交运事件；
- `events`：后续每五年的交运事件序列；
- `first_event.date`：交运公历日期；
- `first_event.hour_branch`：传统时辰；
- `first_event.window_start` / `window_end`：时辰窗口；
- `first_event.term_time`：用于确定节气日的精确节气时刻；
- `first_event.precision = double_hour_window`：明确没有伪造分钟级古法交运时刻。

每步 `da_yun` 新增：

- `start_event`：进入本步大运的交运事件；
- `stem_to_branch_event`：运干转运支的五年交运事件；
- `end_event`：进入下一步大运的交运事件。

交运年的流年对象新增：

- `is_transition_year`；
- `transition_event`；
- `component_before_transition` / `component_after_transition`；
- `value_before_transition` / `value_after_transition`。

判盘结果 `blind_judgment.timing` 新增：

- `dayun.active_component`：按当前真实日期判断的运干/运支；
- `luck_relations`：岁运与原局的结构化关系事实；
- `daxian`：盲派四柱大限背景。


### 海外出生示例

```json
{
  "birthday": "1990-07-01",
  "birth_time": "12:00",
  "gender": "male",
  "use_true_solar_time": true,
  "longitude": -74.006,
  "birth_region": "New York, USA",
  "timezone_id": "America/New_York"
}
```

IANA 时区会按出生日期解析当时的民用 UTC 偏移。若当地民用时间处于 DST 春季跳时的不存在区间，接口返回校时错误；若位于秋季回拨的重复时间，结果保留 `civil_time_ambiguous` 供校盘复核。

## v1.7–v1.8 岁运身份、关系语义与墓库状态字段

### 交运计数审计字段

`jiaoyun` 及其交运事件使用传统包含式计数，并返回：

- `traditional_count_days`：口诀中的虚数天数，例如“前三天”记录为 `-3`、“后九天”记录为 `9`；
- `calendar_offset_days`：用于公历日期计算的实际日偏移；含节气当日时，“前三天”为 `-2`，“后九天”为 `8`；
- `counting_mode = traditional_inclusive`；
- `includes_solar_term_day = true`。

这些字段用于区分“传统口径”与“工程日期偏移”，避免把口诀数字直接当作 `Date ± N days`。

### `blind_judgment.timing.identity_resolutions`

对当前大运、流年、流月进入命局时可取得的身份做结构化解析。每层包含 incoming 干支、`claims`、`selected`、来源等级、规则 ID、`major_eligible` 与选择原因。当前主引擎稳定支持：

- 同字到位；
- 固定禄到位；
- 固定原身到位；
- 藏干显现 / 原局明干以岁运藏干形式出现；
- 丁未、癸丑半禄作为 B 级候选。

辰、戌、丑、未**不**自动映射为戊、己的直接原身。流月身份一律 `major_eligible = false`，只用于定位。

### `blind_judgment.timing.stage_gate`

大运阶段门。用于判断当前大运是否已经承接原局主线：

- `engaged`：允许流年在回接原局后升级为主要应期候选；
- `quiet`：流年只保留 `timing_clue_only`，不能仅凭一个冲、合、到位制造重大事件。

### `blind_judgment.timing.fan_ke_wei_zhu`

反客为主身份候选。区分：

- `original_identity`：流年取得原局关键字身份；
- `dayun_identity`：流年以同字 / 固定禄 / 固定原身取得当前大运组件身份。

即使 `qualified = true`，也只表示身份与阶段门条件成立，最终现实事件仍必须回接原局人物、宫位、做功与成果归属。

### `blind_judgment.timing.tomb_states`

墓库不再使用“同五行见库 = 入墓”的宽泛判断，而返回状态事实与候选：

- `contained`：稳定白名单下确有入墓；
- `store_arrives` / `inmate_arrives`：墓库或被墓对象在岁运到位；
- `clash_tomb_candidate` / `combine_tomb_candidate`：冲墓 / 合墓候选；
- `needs_arbitration`：存在开、闭、出、动、破等语义分歧，必须结合原局与大运裁决。

当前稳定直接对应主要包括亥→辰、寅→未、巳→戌、申→丑，以及有条件的丑/未→辰。子午卯酉不因对应五行墓库就机械入墓。

### 规则等级边界

- A 级稳定身份事实可以进入确定性 Timing 链；
- 半禄、课堂笔记中的墓气 / 余气代表顺序等 B 级规则只保留候选与证据，不单独定重大事件；
- “流年冲墓是否开库”存在资料语境差异，因此当前只输出待仲裁状态，不硬编码成“冲墓必开”。


### v1.8 `blind_judgment.timing.timing_relation_semantics`

对 `luck_relations` 做第二层语义解析。原始关系事实不会直接等同现实结果。典型 `semantic` 包括：

- `appearance_arrival`
- `clash_move_candidate`
- `clash_tomb_candidate`
- `clash_active_dayun_candidate`
- `clash_activate_inactive_dayun`
- `combine_candidate`
- `combine_activate_dayun`
- `combine_activate_active_dayun`
- `break_symbolic_disruption`
- `wear_damage_candidate`
- `punish_candidate`

每条包含 `evidence_grade / status / alternatives / source_rule`。在未完成语义仲裁前，`major_conclusion_allowed` 默认 false。

### v1.8 `blind_judgment.timing.tomb_state_snapshot`

当前时间层墓库快照：

- `mode = current_state_recompute`
- `active_branches`：当前参与重算的原局 / 被引动大运 / 流年 / 流月地支
- `states`：当前有效或被冲突门阻断的入墓状态
- `store_actions`：冲墓 / 合墓等候选动作

`tomb_history` 仅供审计，不应作为当前 active state 直接下结论。

### v1.8 `blind_judgment.timing.future`

不再返回 `intensity` 或 `level`。每年只返回 `status`、`labels` 与 `note`：

- `timing_candidate`：有直接应期线索；
- `no_direct_trigger`：无直接线索，不代表该年一定平稳。


## v1.9 `blind_judgment.timing.state_replay`

```json
{
  "mode": "original_mainline_state_replay",
  "original": {"path_id":"P001","title":"...","status":"effective"},
  "dayun": {"state":"stage_engaged","engaged":true,"changes":[]},
  "liunian": {"state":"altered_candidate","changes":[]},
  "liuyue": {"state":"maintained","changes":[]}
}
```

`state_replay` 不重新生成一条岁运“新主线”，只重演原局第一主功。

## v1.9 `blind_judgment.roots`

每个明干新增：

- `capacity_status`
- `actor_capable`
- `direct_root_strata`
- `external_support_strata`
- `score=null`
- `score_deprecated=true`

`capacity_status` 当前包括：`strong_direct_root / strong_qi / medium_qi / weak_qi / external_support_only / unsupported`。

## v1.9 `blind_judgment.timing.root_state_snapshot`

保存当前岁运对原局明干承载能力的增量，不回写原局根气。每个明干包含 `stage_capacities.dayun / liunian / liuyue`，后来的流年不会反写前一层大运状态；流月增量带 `localization_only=true`，只用于月份定位。

## v1.9 `blind_judgment.timing.composite_state`

按大运、流年、流月累计识别完整三合/三会/三刑。只确认 `formed/newly_formed`，`transformation` 默认 `not_auto_assumed`。 `first_formed_stage` 记录首次形成层，只有该层允许 `newly_formed=true`，后续层只保持已成结构。

## v1.9 `blind_judgment.timing.tomb_state_replay`

按 **大运 → 流年 → 流月** 分层重算墓库当前状态：

- `dayun`：只加入截至大运层的有效地支；
- `liunian`：在大运状态上加入流年后重新计算；
- `liuyue`：再加入流月后重新计算。

后层状态不得反写前层。`tomb_state_snapshot` 仍表示当前最终层快照，`tomb_history` 只作审计。
