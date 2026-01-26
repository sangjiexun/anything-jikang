// 高德地图 MCP 工具定义
export const AMAP_TOOLS = {
  maps_regeocode: {
    name: "地理编码（逆地理编码）",
    description: "将地理坐标转换为地址信息",
    params: {
      location: "经纬度坐标，格式：经度,纬度",
    },
  },
  maps_geo: {
    name: "地理编码（正向地理编码）",
    description: "将地址转换为地理坐标",
    params: {
      address: "地址名称",
    },
  },
  maps_ip_location: {
    name: "IP定位",
    description: "根据IP地址获取位置信息",
    params: {
      ip: "IP地址",
    },
  },
  maps_weather: {
    name: "天气查询",
    description: "查询指定位置的天气信息",
    params: {
      city: "城市名称或adcode",
    },
  },
  maps_search_detail: {
    name: "详细搜索",
    description: "根据ID搜索POI详细信息",
    params: {
      id: "POI ID",
    },
  },
  maps_bicycling: {
    name: "骑行路线",
    description: "规划骑行路线",
    params: {
      origin: "起点坐标，格式：经度,纬度",
      destination: "终点坐标，格式：经度,纬度",
    },
  },
  maps_direction_walking: {
    name: "步行路线",
    description: "规划步行路线",
    params: {
      origin: "起点坐标，格式：经度,纬度",
      destination: "终点坐标，格式：经度,纬度",
    },
  },
  maps_direction_driving: {
    name: "驾车路线",
    description: "规划驾车路线",
    params: {
      origin: "起点坐标，格式：经度,纬度",
      destination: "终点坐标，格式：经度,纬度",
    },
  },
  maps_direction_transit_integrated: {
    name: "公交路线",
    description: "规划公交路线",
    params: {
      origin: "起点坐标，格式：经度,纬度",
      destination: "终点坐标，格式：经度,纬度",
      city: "城市名称或adcode",
    },
  },
  maps_distance: {
    name: "距离测量",
    description: "计算两点之间的距离",
    params: {
      origins: "起点坐标，格式：经度,纬度",
      destination: "终点坐标，格式：经度,纬度",
    },
  },
  maps_text_search: {
    name: "文本搜索",
    description: "根据关键词搜索POI",
    params: {
      keywords: "搜索关键词",
      city: "城市名称或adcode（可选）",
    },
  },
  maps_around_search: {
    name: "周边搜索",
    description: "搜索指定位置周边的POI",
    params: {
      location: "中心点坐标，格式：经度,纬度",
      keywords: "搜索关键词",
      radius: "搜索半径（米，默认3000）",
    },
  },
};

// 获取高德地图 MCP 配置
export function getAmapMCPConfig() {
  try {
    const saved = localStorage.getItem("anythingllm_mcp_servers");
    if (saved) {
      const servers = JSON.parse(saved);
      const amapServer = servers.find(
        (s) =>
          s.name.toLowerCase().includes("高德") ||
          s.name.toLowerCase().includes("amap") ||
          s.name.toLowerCase().includes("地图")
      );
      if (amapServer && amapServer.config) {
        return {
          apiKey: amapServer.config.apiKey || amapServer.config.webApiKey,
          webApiKey: amapServer.config.webApiKey || amapServer.config.apiKey,
          enabled: amapServer.enabled,
        };
      }
    }
  } catch (e) {
    console.error("Failed to load Amap MCP config:", e);
  }
  return null;
}

// 调用高德地图 MCP 工具
export async function callAmapTool(toolName, params) {
  const config = getAmapMCPConfig();
  if (!config || !config.enabled) {
    throw new Error("高德地图 MCP 未配置或未启用");
  }

  if (!config.apiKey) {
    throw new Error("高德地图 API Key 未配置");
  }

  // 这里应该调用实际的 MCP 服务器
  // 由于 MCP 服务器通常通过后端调用，这里我们直接调用高德地图 API
  return await callAmapAPI(toolName, params, config.apiKey);
}

// 直接调用高德地图 API（作为 MCP 工具的替代实现）
async function callAmapAPI(toolName, params, apiKey) {
  const baseURL = "https://restapi.amap.com/v3";

  try {
    switch (toolName) {
      case "maps_regeocode": {
        // 逆地理编码
        const { location } = params;
        const response = await fetch(
          `${baseURL}/geocode/regeo?key=${apiKey}&location=${location}&output=JSON`
        );
        const data = await response.json();
        return {
          success: data.status === "1",
          data: data.regeocode,
          message: data.info,
        };
      }

      case "maps_geo": {
        // 正向地理编码
        const { address } = params;
        if (!address || address.trim().length === 0) {
          return {
            success: false,
            data: null,
            message: "地址参数为空",
          };
        }
        
        try {
          const response = await fetch(
            `${baseURL}/geocode/geo?key=${apiKey}&address=${encodeURIComponent(address)}&output=JSON`
          );
          
          if (!response.ok) {
            return {
              success: false,
              data: null,
              message: `HTTP错误: ${response.status}`,
            };
          }
          
          const data = await response.json();
          
          // 检查 API 返回的状态
          if (data.status !== "1") {
            return {
              success: false,
              data: null,
              message: data.info || data.infocode || "地理编码失败",
              infocode: data.infocode,
            };
          }
          
          // 检查是否有返回的地理编码结果
          if (!data.geocodes || data.geocodes.length === 0) {
            return {
              success: false,
              data: null,
              message: "未找到匹配的地理编码结果",
            };
          }
          
          return {
            success: true,
            data: data.geocodes[0],
            message: data.info || "成功",
          };
        } catch (error) {
          console.error("maps_geo API调用异常:", error);
          return {
            success: false,
            data: null,
            message: error.message || "网络请求失败",
            error: error,
          };
        }
      }

      case "maps_ip_location": {
        // IP定位
        const { ip } = params;
        const response = await fetch(
          `${baseURL}/ip?key=${apiKey}&ip=${ip}&output=JSON`
        );
        const data = await response.json();
        return {
          success: data.status === "1",
          data: data,
          message: data.info,
        };
      }

      case "maps_weather": {
        // 天气查询
        const { city } = params;
        const response = await fetch(
          `${baseURL}/weather/weatherInfo?key=${apiKey}&city=${encodeURIComponent(city)}&output=JSON`
        );
        const data = await response.json();
        return {
          success: data.status === "1",
          data: data.lives?.[0] || data.forecasts?.[0],
          message: data.info,
        };
      }

      case "maps_search_detail": {
        // POI详情
        const { id } = params;
        const response = await fetch(
          `${baseURL}/place/detail?key=${apiKey}&id=${id}&output=JSON`
        );
        const data = await response.json();
        return {
          success: data.status === "1",
          data: data.pois?.[0],
          message: data.info,
        };
      }

      case "maps_bicycling": {
        // 骑行路线
        const { origin, destination } = params;
        const response = await fetch(
          `${baseURL}/direction/bicycling?key=${apiKey}&origin=${origin}&destination=${destination}&output=JSON`
        );
        const data = await response.json();
        return {
          success: data.status === "1",
          data: data.route,
          message: data.info,
        };
      }

      case "maps_direction_walking": {
        // 步行路线
        const { origin, destination } = params;
        const response = await fetch(
          `${baseURL}/direction/walking?key=${apiKey}&origin=${origin}&destination=${destination}&output=JSON`
        );
        const data = await response.json();
        return {
          success: data.status === "1",
          data: data.route,
          message: data.info,
        };
      }

      case "maps_direction_driving": {
        // 驾车路线
        const { origin, destination } = params;
        const response = await fetch(
          `${baseURL}/direction/driving?key=${apiKey}&origin=${origin}&destination=${destination}&output=JSON`
        );
        const data = await response.json();
        return {
          success: data.status === "1",
          data: data.route,
          message: data.info,
        };
      }

      case "maps_direction_transit_integrated": {
        // 公交路线
        const { origin, destination, city } = params;
        const response = await fetch(
          `${baseURL}/direction/transit/integrated?key=${apiKey}&origin=${origin}&destination=${destination}&city=${encodeURIComponent(city)}&output=JSON`
        );
        const data = await response.json();
        return {
          success: data.status === "1",
          data: data.route,
          message: data.info,
        };
      }

      case "maps_distance": {
        // 距离测量
        const { origins, destination } = params;
        const response = await fetch(
          `${baseURL}/distance?key=${apiKey}&origins=${origins}&destination=${destination}&output=JSON`
        );
        const data = await response.json();
        return {
          success: data.status === "1",
          data: data.results,
          message: data.info,
        };
      }

      case "maps_text_search": {
        // 文本搜索
        const { keywords, city } = params;
        let url = `${baseURL}/place/text?key=${apiKey}&keywords=${encodeURIComponent(keywords)}&output=JSON`;
        if (city) {
          url += `&city=${encodeURIComponent(city)}`;
        }
        const response = await fetch(url);
        const data = await response.json();
        return {
          success: data.status === "1",
          data: data.pois,
          message: data.info,
        };
      }

      case "maps_around_search": {
        // 周边搜索
        const { location, keywords, radius = 3000 } = params;
        const response = await fetch(
          `${baseURL}/place/around?key=${apiKey}&location=${location}&keywords=${encodeURIComponent(keywords)}&radius=${radius}&output=JSON`
        );
        const data = await response.json();
        return {
          success: data.status === "1",
          data: data.pois,
          message: data.info,
        };
      }

      default:
        throw new Error(`未知的工具: ${toolName}`);
    }
  } catch (error) {
    console.error(`调用高德地图工具 ${toolName} 失败:`, error);
    return {
      success: false,
      error: error.message,
      message: "API 调用失败",
    };
  }
}
