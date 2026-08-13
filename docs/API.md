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
  "longitude": 120.306592,
  "birth_region": "浙江省杭州市余杭区"
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
| `longitude` | number | 是 | 出生地东经，经度范围 `(0, 180]` |
| `birth_region` | string | 否 | 出生地展示文本 |

### 成功响应

```json
{
  "ok": true,
  "data": {
    "...": "完整命盘对象"
  }
}
```

返回对象包含四柱、真太阳时、十神、藏干、纳音、旬空、大运、流年、小运、胎元、命宫、身宫、胎息、节气、五行评分、神煞等数据。

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

## 兼容接口

```text
POST /api.php
```

这是历史前端兼容路径，仍由 TypeScript Server 处理，不需要 PHP 运行环境。
