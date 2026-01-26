import React, { useState, useEffect } from "react";
import { callAmapTool, getAmapMCPConfig } from "@/utils/mcp/amapTools";
import AmapViewer from "@/components/AmapViewer";
import { SpinnerGap, MapPin, Compass, Cloud, MagnifyingGlass } from "@phosphor-icons/react";

export default function AmapResult({ query, onResult }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [toolName, setToolName] = useState(null);

  useEffect(() => {
    detectAndCallTool(query);
  }, [query]);

  const detectAndCallTool = async (queryText) => {
    if (!queryText) return;

    const lowerQuery = queryText.toLowerCase();
    let tool = null;
    let params = {};

    try {
      // 提取坐标的正则表达式（支持多种格式）
      const coordPattern = /(\d+\.?\d*)[,，\s]+(\d+\.?\d*)/g;
      const coords = [];
      let match;
      while ((match = coordPattern.exec(queryText)) !== null) {
        coords.push(`${match[1]},${match[2]}`);
      }

      // 1. 逆地理编码（坐标转地址）
      if (
        lowerQuery.includes("逆地理编码") ||
        lowerQuery.includes("坐标转地址") ||
        lowerQuery.includes("坐标对应的地址") ||
        lowerQuery.includes("这个坐标") ||
        (coords.length > 0 && (lowerQuery.includes("地址") || lowerQuery.includes("位置")))
      ) {
        if (coords.length > 0) {
          tool = "maps_regeocode";
          params = { location: coords[0] };
        }
      }
      // 2. 正向地理编码（地址转坐标）
      else if (
        lowerQuery.includes("地理编码") ||
        lowerQuery.includes("地址转坐标") ||
        lowerQuery.includes("地址的坐标") ||
        lowerQuery.includes("这个地址") ||
        (lowerQuery.includes("地址") && !lowerQuery.includes("坐标转"))
      ) {
        // 提取地址 - 更灵活的匹配
        let address = null;
        
        // 尝试多种模式提取地址
        const patterns = [
          /(?:地址|位置|地点)[:：]?\s*([^，,。.\n]+)/,
          /(?:查询|查找|搜索)[:：]?\s*([^，,。.\n]+?)(?:的坐标|的经纬度|在哪里)/,
          /^([^，,。.\n]+?)(?:的坐标|的经纬度|在哪里|地址)/,
          /(?:在|到|去|位于)\s*([^，,。.\n]+)/,
        ];
        
        for (const pattern of patterns) {
          const match = queryText.match(pattern);
          if (match && match[1]) {
            address = match[1].trim();
            // 移除常见的前缀词
            address = address.replace(/^(北京|上海|广州|深圳|杭州|成都|武汉|西安|南京|天津|苏州|重庆|长沙|郑州|东莞|青岛|沈阳|宁波|昆明|大连|厦门|合肥|佛山|石家庄|福州|无锡|哈尔滨|济南|长春|南昌|太原|南宁|贵阳|海口|兰州|银川|西宁|呼和浩特|乌鲁木齐|拉萨|香港|澳门|台湾)/, "");
            if (address.length > 0 && address.length < 50) break;
          }
        }
        
        // 如果没有匹配到，尝试提取整个查询（排除坐标）
        if (!address || address.length === 0) {
          address = queryText
            .replace(coordPattern, "")
            .replace(/(?:地址|坐标|位置|查询|查找|搜索|的|在哪里|经纬度)/g, "")
            .trim();
          if (address.length > 50) address = address.substring(0, 50);
        }
        
        if (address && address.length > 0) {
          tool = "maps_geo";
          params = { address };
        }
      }
      // 3. 天气查询
      else if (
        lowerQuery.includes("天气") ||
        lowerQuery.includes("温度") ||
        lowerQuery.includes("气温")
      ) {
        tool = "maps_weather";
        // 提取城市名称
        let city = "北京"; // 默认城市
        
        const cityPatterns = [
          /(?:北京|上海|广州|深圳|杭州|成都|武汉|西安|南京|天津|苏州|重庆|长沙|郑州|东莞|青岛|沈阳|宁波|昆明|大连|厦门|合肥|佛山|石家庄|福州|无锡|哈尔滨|济南|长春|南昌|太原|南宁|贵阳|海口|兰州|银川|西宁|呼和浩特|乌鲁木齐|拉萨|香港|澳门|台湾)/,
          /(?:城市|地点|位置)[:：]?\s*([^，,。.\n]+)/,
          /([^，,。.\n]+?)(?:的天气|天气)/,
        ];
        
        for (const pattern of cityPatterns) {
          const match = queryText.match(pattern);
          if (match) {
            city = match[1] || match[0];
            city = city.replace(/(?:的天气|天气|温度|气温)/g, "").trim();
            if (city.length > 0 && city.length < 20) break;
          }
        }
        
        params = { city };
      }
      // 4. 路线规划
      else if (
        lowerQuery.includes("路线") ||
        lowerQuery.includes("导航") ||
        lowerQuery.includes("怎么走") ||
        lowerQuery.includes("怎么去") ||
        lowerQuery.includes("到") ||
        (lowerQuery.includes("从") && lowerQuery.includes("到"))
      ) {
        // 提取起点和终点
        let origin = null;
        let destination = null;
        
        // 优先使用坐标
        if (coords.length >= 2) {
          origin = coords[0];
          destination = coords[1];
        } else {
          // 尝试从文本中提取地址
          const fromMatch = queryText.match(/(?:从|起点|出发地)[:：]?\s*([^，,。.\n到]+)/);
          const toMatch = queryText.match(/(?:到|去|终点|目的地)[:：]?\s*([^，,。.\n]+)/);
          
          if (fromMatch && toMatch) {
            origin = fromMatch[1].trim();
            destination = toMatch[1].trim();
          } else if (coords.length === 1) {
            // 只有一个坐标，尝试提取另一个地址
            const addressMatch = queryText.match(/(?:到|去|终点|目的地)[:：]?\s*([^，,。.\n]+)/);
            if (addressMatch) {
              origin = coords[0];
              destination = addressMatch[1].trim();
            }
          }
        }
        
        if (origin && destination) {
          // 确定路线类型
          if (lowerQuery.includes("步行") || lowerQuery.includes("走路") || lowerQuery.includes("徒步")) {
            tool = "maps_direction_walking";
          } else if (lowerQuery.includes("骑行") || lowerQuery.includes("骑车") || lowerQuery.includes("自行车")) {
            tool = "maps_bicycling";
          } else if (lowerQuery.includes("公交") || lowerQuery.includes("地铁") || lowerQuery.includes("公共交通") || lowerQuery.includes("公共交通")) {
            tool = "maps_direction_transit_integrated";
            // 尝试提取城市
            const cityMatch = queryText.match(/(?:北京|上海|广州|深圳|杭州|成都|武汉|西安|南京|天津|苏州|重庆|长沙|郑州|东莞|青岛|沈阳|宁波|昆明|大连|厦门|合肥|佛山|石家庄|福州|无锡|哈尔滨|济南|长春|南昌|太原|南宁|贵阳|海口|兰州|银川|西宁|呼和浩特|乌鲁木齐|拉萨|香港|澳门|台湾)/);
            params.city = cityMatch ? cityMatch[0] : "北京";
          } else {
            tool = "maps_direction_driving";
          }
          
          params.origin = origin;
          params.destination = destination;
        }
      }
      // 5. 距离测量
      else if (
        lowerQuery.includes("距离") ||
        lowerQuery.includes("多远") ||
        lowerQuery.includes("多少公里")
      ) {
        if (coords.length >= 2) {
          tool = "maps_distance";
          params.origins = coords[0];
          params.destination = coords[1];
        }
      }
      // 6. 周边搜索
      else if (
        lowerQuery.includes("周边") ||
        lowerQuery.includes("附近") ||
        lowerQuery.includes("周围")
      ) {
        let location = null;
        let keywords = null;
        
        // 提取位置（坐标或地址）
        if (coords.length > 0) {
          location = coords[0];
        } else {
          const locationMatch = queryText.match(/(?:在|位于|附近|周边|周围)[:：]?\s*([^，,。.\n]+?)(?:的|附近|周边|周围)/);
          if (locationMatch) {
            location = locationMatch[1].trim();
          }
        }
        
        // 提取关键词
        const keywordPatterns = [
          /(?:搜索|查找|找|附近|周边|周围)[:：]?\s*([^，,。.\n]+)/,
          /([^，,。.\n]+?)(?:附近|周边|周围)/,
        ];
        
        for (const pattern of keywordPatterns) {
          const match = queryText.match(pattern);
          if (match && match[1]) {
            keywords = match[1].trim();
            if (keywords.length > 0 && keywords.length < 30) break;
          }
        }
        
        if (location && keywords) {
          tool = "maps_around_search";
          params = { location, keywords };
        }
      }
      // 7. 文本搜索
      else if (
        lowerQuery.includes("搜索") ||
        lowerQuery.includes("查找") ||
        lowerQuery.includes("找") ||
        lowerQuery.includes("哪里有")
      ) {
        // 提取关键词
        let keywords = null;
        
        const keywordPatterns = [
          /(?:搜索|查找|找|哪里有)[:：]?\s*([^，,。.\n]+)/,
          /([^，,。.\n]+?)(?:在哪里|在哪儿|位置)/,
        ];
        
        for (const pattern of keywordPatterns) {
          const match = queryText.match(pattern);
          if (match && match[1]) {
            keywords = match[1].trim();
            // 移除常见后缀
            keywords = keywords.replace(/(?:在哪里|在哪儿|位置|地址|坐标)/g, "").trim();
            if (keywords.length > 0 && keywords.length < 30) break;
          }
        }
        
        // 如果没有匹配到，尝试提取整个查询（排除坐标和常见词）
        if (!keywords || keywords.length === 0) {
          keywords = queryText
            .replace(coordPattern, "")
            .replace(/(?:搜索|查找|找|在哪里|在哪儿|位置|地址|坐标|的)/g, "")
            .trim();
          if (keywords.length > 30) keywords = keywords.substring(0, 30);
        }
        
        if (keywords && keywords.length > 0) {
          tool = "maps_text_search";
          params = { keywords };
          
          // 尝试提取城市
          const cityMatch = queryText.match(/(?:北京|上海|广州|深圳|杭州|成都|武汉|西安|南京|天津|苏州|重庆|长沙|郑州|东莞|青岛|沈阳|宁波|昆明|大连|厦门|合肥|佛山|石家庄|福州|无锡|哈尔滨|济南|长春|南昌|太原|南宁|贵阳|海口|兰州|银川|西宁|呼和浩特|乌鲁木齐|拉萨|香港|澳门|台湾)/);
          if (cityMatch) {
            params.city = cityMatch[0];
          }
        }
      }

      if (tool) {
        setToolName(tool);
        const result = await callAmapTool(tool, params);
        setResult(result);
        if (onResult) onResult(result);
      } else {
        setError(
          <div>
            <p className="mb-2">无法识别的地图查询，请尝试以下方式：</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>地址转坐标：如"北京市天安门广场的坐标"</li>
              <li>坐标转地址：如"116.397128,39.916527的地址"</li>
              <li>天气查询：如"北京天气"或"上海的温度"</li>
              <li>路线规划：如"从北京到上海的路线"或"116.397128,39.916527到121.473701,31.230416"</li>
              <li>搜索POI：如"搜索附近的餐厅"或"找北京的天安门"</li>
              <li>周边搜索：如"116.397128,39.916527附近的酒店"</li>
              <li>距离测量：如"116.397128,39.916527到121.473701,31.230416的距离"</li>
            </ul>
          </div>
        );
      }
    } catch (err) {
      setError(err.message || "调用地图工具失败");
    } finally {
      setLoading(false);
    }
  };

  const config = getAmapMCPConfig();

  if (!config || !config.enabled) {
    return (
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
        高德地图 MCP 未配置或未启用，请在设置中配置
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-white/60">
        <SpinnerGap className="w-5 h-5 animate-spin" />
        <span>正在查询地图信息...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (!result || !result.success) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
        {result?.message || "查询失败"}
      </div>
    );
  }

  // 根据工具类型显示不同的结果
  const renderResult = () => {
    const { data } = result;

    switch (toolName) {
      case "maps_regeocode": {
        // 逆地理编码结果
        const address = data?.formatted_address || data?.address;
        const location = data?.location?.split(",").map(Number);
        return (
          <div className="space-y-4">
            <div className="p-4 bg-theme-bg-primary rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-blue-400" />
                <span className="font-semibold text-white">地址信息</span>
              </div>
              <p className="text-white">{address}</p>
              {data?.addressComponent && (
                <div className="mt-2 text-sm text-white/60">
                  <p>省份: {data.addressComponent.province}</p>
                  <p>城市: {data.addressComponent.city}</p>
                  <p>区县: {data.addressComponent.district}</p>
                </div>
              )}
            </div>
            {location && config.webApiKey && (
              <AmapViewer
                apiKey={config.webApiKey}
                center={location}
                zoom={15}
                height="400px"
              />
            )}
          </div>
        );
      }

      case "maps_geo": {
        // 正向地理编码结果
        const location = data?.location?.split(",").map(Number);
        return (
          <div className="space-y-4">
            <div className="p-4 bg-theme-bg-primary rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-green-400" />
                <span className="font-semibold text-white">坐标信息</span>
              </div>
              <p className="text-white">坐标: {data?.location}</p>
              <p className="text-white">地址: {data?.formatted_address || data?.address}</p>
            </div>
            {location && config.webApiKey && (
              <AmapViewer
                apiKey={config.webApiKey}
                center={location}
                zoom={15}
                height="400px"
              />
            )}
          </div>
        );
      }

      case "maps_weather": {
        // 天气结果
        return (
          <div className="p-4 bg-theme-bg-primary rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="w-5 h-5 text-blue-400" />
              <span className="font-semibold text-white">天气信息</span>
            </div>
            <div className="space-y-1 text-white">
              <p>城市: {data?.city || data?.adcode}</p>
              <p>天气: {data?.weather}</p>
              <p>温度: {data?.temperature}°C</p>
              <p>风向: {data?.winddirection}</p>
              <p>风力: {data?.windpower}</p>
              <p>湿度: {data?.humidity}%</p>
            </div>
          </div>
        );
      }

      case "maps_text_search":
      case "maps_around_search": {
        // 搜索结果
        const pois = Array.isArray(data) ? data : [];
        const locations = pois
          .map((poi) => {
            const loc = poi.location?.split(",").map(Number);
            return loc ? { ...poi, coordinates: loc } : null;
          })
          .filter(Boolean);

        return (
          <div className="space-y-4">
            <div className="p-4 bg-theme-bg-primary rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MagnifyingGlass className="w-5 h-5 text-purple-400" />
                <span className="font-semibold text-white">
                  找到 {pois.length} 个结果
                </span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pois.slice(0, 10).map((poi, index) => (
                  <div
                    key={index}
                    className="p-2 bg-theme-bg-secondary rounded text-sm text-white/80"
                  >
                    <p className="font-medium">{poi.name}</p>
                    <p className="text-white/60 text-xs">{poi.address}</p>
                    {poi.tel && <p className="text-white/60 text-xs">电话: {poi.tel}</p>}
                  </div>
                ))}
              </div>
            </div>
            {locations.length > 0 && config.webApiKey ? (
              <AmapViewer
                apiKey={config.webApiKey}
                center={locations[0].coordinates}
                zoom={13}
                height="400px"
                pois={locations}
              />
            ) : locations.length > 0 ? (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
                <p className="font-semibold mb-1">地图显示需要Web端API Key</p>
                <p className="text-xs">请在MCP设置中配置Web端API Key</p>
              </div>
            ) : null}
          </div>
        );
      }

      case "maps_direction_walking":
      case "maps_direction_driving":
      case "maps_bicycling":
      case "maps_direction_transit_integrated": {
        // 路线结果
        const route = data?.paths?.[0];
        const origin = route?.steps?.[0]?.start_location?.split(",").map(Number);
        const destination =
          route?.steps?.[route.steps.length - 1]?.end_location?.split(",").map(Number);

        return (
          <div className="space-y-4">
            <div className="p-4 bg-theme-bg-primary rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Compass className="w-5 h-5 text-orange-400" />
                <span className="font-semibold text-white">路线规划</span>
              </div>
              <div className="space-y-1 text-white">
                <p>距离: {route?.distance ? `${(route.distance / 1000).toFixed(2)} 公里` : "未知"}</p>
                <p>预计时间: {route?.duration ? `${Math.round(route.duration / 60)} 分钟` : "未知"}</p>
                <p>路线类型: {
                  toolName === "maps_direction_walking" ? "步行" :
                  toolName === "maps_direction_driving" ? "驾车" :
                  toolName === "maps_bicycling" ? "骑行" : "公交"
                }</p>
              </div>
            </div>
            {route && config.webApiKey ? (
              <AmapViewer
                apiKey={config.webApiKey}
                center={origin || [116.455672, 39.966409]}
                zoom={13}
                height="400px"
                routeData={route}
              />
            ) : route ? (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
                <p className="font-semibold mb-1">地图显示需要Web端API Key</p>
                <p className="text-xs">请在MCP设置中配置Web端API Key以显示路线</p>
              </div>
            ) : null}
          </div>
        );
      }

      case "maps_distance": {
        // 距离结果
        const distance = Array.isArray(data) ? data[0] : data;
        return (
          <div className="p-4 bg-theme-bg-primary rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-5 h-5 text-yellow-400" />
              <span className="font-semibold text-white">距离信息</span>
            </div>
            <div className="space-y-1 text-white">
              <p>距离: {distance?.distance ? `${(distance.distance / 1000).toFixed(2)} 公里` : "未知"}</p>
              <p>预计时间: {distance?.duration ? `${Math.round(distance.duration / 60)} 分钟` : "未知"}</p>
            </div>
          </div>
        );
      }

      default:
        return (
          <div className="p-4 bg-theme-bg-primary rounded-lg text-white">
            <pre className="text-sm overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return <div className="mt-4">{renderResult()}</div>;
}
