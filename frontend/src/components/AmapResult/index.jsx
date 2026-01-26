import React, { useState, useEffect } from "react";
import { callAmapTool, getAmapMCPConfig } from "@/utils/mcp/amapTools";
import AmapViewer from "@/components/AmapViewer";
import { SpinnerGap, MapPin, Navigation, Cloud, MagnifyingGlass } from "@phosphor-icons/react";

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
      // 检测工具类型
      if (lowerQuery.includes("逆地理编码") || lowerQuery.includes("坐标转地址")) {
        // 提取坐标
        const coordMatch = queryText.match(/(\d+\.?\d*)[,，]\s*(\d+\.?\d*)/);
        if (coordMatch) {
          tool = "maps_regeocode";
          params = { location: `${coordMatch[1]},${coordMatch[2]}` };
        }
      } else if (lowerQuery.includes("地理编码") || lowerQuery.includes("地址转坐标")) {
        // 提取地址
        const addressMatch = queryText.match(/(?:地址|位置)[:：]?\s*([^，,。.]+)/);
        if (addressMatch) {
          tool = "maps_geo";
          params = { address: addressMatch[1] };
        }
      } else if (lowerQuery.includes("天气")) {
        // 提取城市
        const cityMatch = queryText.match(/(?:城市|地点)[:：]?\s*([^，,。.]+)/);
        tool = "maps_weather";
        params = { city: cityMatch ? cityMatch[1] : "北京" };
      } else if (lowerQuery.includes("搜索") || lowerQuery.includes("查找")) {
        // 提取关键词
        const keywordMatch = queryText.match(/(?:搜索|查找)[:：]?\s*([^，,。.]+)/);
        if (keywordMatch) {
          tool = "maps_text_search";
          params = { keywords: keywordMatch[1] };
        }
      } else if (lowerQuery.includes("周边") || lowerQuery.includes("附近")) {
        // 周边搜索
        const keywordMatch = queryText.match(/(?:搜索|查找)[:：]?\s*([^，,。.]+)/);
        const coordMatch = queryText.match(/(\d+\.?\d*)[,，]\s*(\d+\.?\d*)/);
        if (keywordMatch && coordMatch) {
          tool = "maps_around_search";
          params = {
            location: `${coordMatch[1]},${coordMatch[2]}`,
            keywords: keywordMatch[1],
          };
        }
      } else if (lowerQuery.includes("路线") || lowerQuery.includes("导航")) {
        // 路线规划
        const coords = queryText.match(/(\d+\.?\d*)[,，]\s*(\d+\.?\d*)/g);
        if (coords && coords.length >= 2) {
          const origin = coords[0].replace(/[，,]/g, ",");
          const destination = coords[1].replace(/[，,]/g, ",");
          
          if (lowerQuery.includes("步行") || lowerQuery.includes("走路")) {
            tool = "maps_direction_walking";
          } else if (lowerQuery.includes("骑行") || lowerQuery.includes("骑车")) {
            tool = "maps_bicycling";
          } else if (lowerQuery.includes("公交") || lowerQuery.includes("地铁")) {
            tool = "maps_direction_transit_integrated";
            params.city = "北京"; // 默认城市
          } else {
            tool = "maps_direction_driving";
          }
          params.origin = origin;
          params.destination = destination;
        }
      } else if (lowerQuery.includes("距离")) {
        // 距离测量
        const coords = queryText.match(/(\d+\.?\d*)[,，]\s*(\d+\.?\d*)/g);
        if (coords && coords.length >= 2) {
          tool = "maps_distance";
          params.origins = coords[0].replace(/[，,]/g, ",");
          params.destination = coords[1].replace(/[，,]/g, ",");
        }
      }

      if (tool) {
        setToolName(tool);
        const result = await callAmapTool(tool, params);
        setResult(result);
        if (onResult) onResult(result);
      } else {
        setError("无法识别的地图查询，请尝试：地址转坐标、坐标转地址、天气查询、路线规划等");
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
            {locations.length > 0 && config.webApiKey && (
              <AmapViewer
                apiKey={config.webApiKey}
                center={locations[0].coordinates}
                zoom={13}
                height="400px"
                pois={locations}
              />
            )}
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
                <Navigation className="w-5 h-5 text-orange-400" />
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
            {route && config.webApiKey && (
              <AmapViewer
                apiKey={config.webApiKey}
                center={origin || [116.455672, 39.966409]}
                zoom={13}
                height="400px"
                routeData={route}
              />
            )}
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
