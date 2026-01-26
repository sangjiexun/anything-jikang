# 高德地图 Agent Skill

高德地图官方 MCP Server，支持多种定位服务。

## 功能

- **地理编码**：地址与坐标互转
- **IP定位**：根据IP地址获取位置
- **天气查询**：查询指定位置的天气信息
- **路线规划**：步行、驾车、骑行、公交路线规划
- **POI搜索**：文本搜索和周边搜索
- **距离测量**：计算两点之间的距离

## 配置

1. 在 AnythingLLM 设置中进入 Agent Skills 配置
2. 找到"高德地图"技能
3. 配置 `AMAP_MAPS_API_KEY`（必需）：高德地图 Web 服务 API Key
4. 配置 `AMAP_WEB_API_KEY`（可选）：高德地图 Web 端 Key，用于前端地图显示

## 使用方法

在聊天中使用 `@agent` 命令，然后提问相关问题，Agent 会自动调用相应的高德地图工具。

### 示例

- "北京天气怎么样？" → 自动调用 `maps_weather`
- "搜索附近的餐厅" → 自动调用 `maps_text_search`
- "从北京到上海的驾车路线" → 自动调用 `maps_direction_driving`
- "116.397128,39.966409 这个坐标的地址是什么？" → 自动调用 `maps_regeocode`

## 支持的工具

- `maps_regeocode` - 逆地理编码（坐标转地址）
- `maps_geo` - 正向地理编码（地址转坐标）
- `maps_ip_location` - IP定位
- `maps_weather` - 天气查询
- `maps_search_detail` - POI详情搜索
- `maps_bicycling` - 骑行路线规划
- `maps_direction_walking` - 步行路线规划
- `maps_direction_driving` - 驾车路线规划
- `maps_direction_transit_integrated` - 公交路线规划
- `maps_distance` - 距离测量
- `maps_text_search` - 文本搜索POI
- `maps_around_search` - 周边搜索

## 获取 API Key

访问 [高德开放平台](https://lbs.amap.com/) 注册账号并创建应用，获取 API Key。

## 许可证

MIT
