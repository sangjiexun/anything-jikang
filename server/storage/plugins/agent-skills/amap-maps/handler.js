// 高德地图 Agent Skill Handler
module.exports.runtime = {
  handler: async function ({ tool, params }) {
    const callerId = `${this.config.name}-v${this.config.version}`;
    try {
      // 获取 API Key
      const apiKey = this.runtimeArgs["AMAP_MAPS_API_KEY"];
      if (!apiKey) {
        this.introspect(`${callerId} 错误: 未配置 API Key`);
        return "高德地图 API Key 未配置，请在设置中配置 API Key";
      }

      // 解析参数
      let parsedParams = {};
      if (params) {
        try {
          parsedParams = typeof params === "string" ? JSON.parse(params) : params;
        } catch (e) {
          this.logger(`${callerId} 参数解析失败: ${e.message}`);
          return `参数格式错误: ${e.message}`;
        }
      }

      this.introspect(`${callerId} 调用工具: ${tool}，参数: ${JSON.stringify(parsedParams)}`);

      const baseURL = "https://restapi.amap.com/v3";
      let result = null;

      switch (tool) {
        case "maps_regeocode": {
          // 逆地理编码
          const { location } = parsedParams;
          if (!location) {
            return "缺少必需参数: location";
          }
          const response = await fetch(
            `${baseURL}/geocode/regeo?key=${apiKey}&location=${location}&output=JSON`
          );
          const data = await response.json();
          if (data.status === "1") {
            result = {
              address: data.regeocode?.formatted_address,
              province: data.regeocode?.addressComponent?.province,
              city: data.regeocode?.addressComponent?.city,
              district: data.regeocode?.addressComponent?.district,
              fullInfo: data.regeocode,
            };
          } else {
            throw new Error(data.info || "逆地理编码失败");
          }
          break;
        }

        case "maps_geo": {
          // 正向地理编码
          const { address } = parsedParams;
          if (!address) {
            return "缺少必需参数: address";
          }
          const response = await fetch(
            `${baseURL}/geocode/geo?key=${apiKey}&address=${encodeURIComponent(address)}&output=JSON`
          );
          const data = await response.json();
          if (data.status === "1" && data.geocodes?.[0]) {
            result = {
              location: data.geocodes[0].location,
              formatted_address: data.geocodes[0].formatted_address,
              level: data.geocodes[0].level,
            };
          } else {
            throw new Error(data.info || "地理编码失败");
          }
          break;
        }

        case "maps_ip_location": {
          // IP定位
          const { ip } = parsedParams;
          if (!ip) {
            return "缺少必需参数: ip";
          }
          const response = await fetch(
            `${baseURL}/ip?key=${apiKey}&ip=${ip}&output=JSON`
          );
          const data = await response.json();
          if (data.status === "1") {
            result = {
              province: data.province,
              city: data.city,
              adcode: data.adcode,
              rectangle: data.rectangle,
            };
          } else {
            throw new Error(data.info || "IP定位失败");
          }
          break;
        }

        case "maps_weather": {
          // 天气查询
          const { city } = parsedParams;
          if (!city) {
            return "缺少必需参数: city";
          }
          const response = await fetch(
            `${baseURL}/weather/weatherInfo?key=${apiKey}&city=${encodeURIComponent(city)}&output=JSON`
          );
          const data = await response.json();
          if (data.status === "1") {
            result = data.lives?.[0] || data.forecasts?.[0] || data;
          } else {
            throw new Error(data.info || "天气查询失败");
          }
          break;
        }

        case "maps_search_detail": {
          // POI详情
          const { id } = parsedParams;
          if (!id) {
            return "缺少必需参数: id";
          }
          const response = await fetch(
            `${baseURL}/place/detail?key=${apiKey}&id=${id}&output=JSON`
          );
          const data = await response.json();
          if (data.status === "1" && data.pois?.[0]) {
            result = data.pois[0];
          } else {
            throw new Error(data.info || "POI详情查询失败");
          }
          break;
        }

        case "maps_bicycling": {
          // 骑行路线
          const { origin, destination } = parsedParams;
          if (!origin || !destination) {
            return "缺少必需参数: origin 或 destination";
          }
          const response = await fetch(
            `${baseURL}/direction/bicycling?key=${apiKey}&origin=${origin}&destination=${destination}&output=JSON`
          );
          const data = await response.json();
          if (data.status === "1" && data.route) {
            result = {
              distance: data.route.paths?.[0]?.distance,
              duration: data.route.paths?.[0]?.duration,
              route: data.route,
            };
          } else {
            throw new Error(data.info || "骑行路线规划失败");
          }
          break;
        }

        case "maps_direction_walking": {
          // 步行路线
          const { origin, destination } = parsedParams;
          if (!origin || !destination) {
            return "缺少必需参数: origin 或 destination";
          }
          const response = await fetch(
            `${baseURL}/direction/walking?key=${apiKey}&origin=${origin}&destination=${destination}&output=JSON`
          );
          const data = await response.json();
          if (data.status === "1" && data.route) {
            result = {
              distance: data.route.paths?.[0]?.distance,
              duration: data.route.paths?.[0]?.duration,
              route: data.route,
            };
          } else {
            throw new Error(data.info || "步行路线规划失败");
          }
          break;
        }

        case "maps_direction_driving": {
          // 驾车路线
          const { origin, destination } = parsedParams;
          if (!origin || !destination) {
            return "缺少必需参数: origin 或 destination";
          }
          const response = await fetch(
            `${baseURL}/direction/driving?key=${apiKey}&origin=${origin}&destination=${destination}&output=JSON`
          );
          const data = await response.json();
          if (data.status === "1" && data.route) {
            result = {
              distance: data.route.paths?.[0]?.distance,
              duration: data.route.paths?.[0]?.duration,
              route: data.route,
            };
          } else {
            throw new Error(data.info || "驾车路线规划失败");
          }
          break;
        }

        case "maps_direction_transit_integrated": {
          // 公交路线
          const { origin, destination, city } = parsedParams;
          if (!origin || !destination || !city) {
            return "缺少必需参数: origin, destination 或 city";
          }
          const response = await fetch(
            `${baseURL}/direction/transit/integrated?key=${apiKey}&origin=${origin}&destination=${destination}&city=${encodeURIComponent(city)}&output=JSON`
          );
          const data = await response.json();
          if (data.status === "1" && data.route) {
            result = {
              distance: data.route.paths?.[0]?.distance,
              duration: data.route.paths?.[0]?.duration,
              route: data.route,
            };
          } else {
            throw new Error(data.info || "公交路线规划失败");
          }
          break;
        }

        case "maps_distance": {
          // 距离测量
          const { origins, destination } = parsedParams;
          if (!origins || !destination) {
            return "缺少必需参数: origins 或 destination";
          }
          const response = await fetch(
            `${baseURL}/distance?key=${apiKey}&origins=${origins}&destination=${destination}&output=JSON`
          );
          const data = await response.json();
          if (data.status === "1" && data.results?.[0]) {
            result = data.results[0];
          } else {
            throw new Error(data.info || "距离测量失败");
          }
          break;
        }

        case "maps_text_search": {
          // 文本搜索
          const { keywords, city } = parsedParams;
          if (!keywords) {
            return "缺少必需参数: keywords";
          }
          let url = `${baseURL}/place/text?key=${apiKey}&keywords=${encodeURIComponent(keywords)}&output=JSON`;
          if (city) {
            url += `&city=${encodeURIComponent(city)}`;
          }
          const response = await fetch(url);
          const data = await response.json();
          if (data.status === "1" && data.pois) {
            result = {
              count: data.count,
              pois: data.pois.slice(0, 10), // 只返回前10个结果
            };
          } else {
            throw new Error(data.info || "文本搜索失败");
          }
          break;
        }

        case "maps_around_search": {
          // 周边搜索
          const { location, keywords, radius = 3000 } = parsedParams;
          if (!location || !keywords) {
            return "缺少必需参数: location 或 keywords";
          }
          const response = await fetch(
            `${baseURL}/place/around?key=${apiKey}&location=${location}&keywords=${encodeURIComponent(keywords)}&radius=${radius}&output=JSON`
          );
          const data = await response.json();
          if (data.status === "1" && data.pois) {
            result = {
              count: data.count,
              pois: data.pois.slice(0, 10), // 只返回前10个结果
            };
          } else {
            throw new Error(data.info || "周边搜索失败");
          }
          break;
        }

        default:
          return `未知的工具: ${tool}。支持的工具: maps_regeocode, maps_geo, maps_ip_location, maps_weather, maps_search_detail, maps_bicycling, maps_direction_walking, maps_direction_driving, maps_direction_transit_integrated, maps_distance, maps_text_search, maps_around_search`;
      }

      this.introspect(`${callerId} 执行成功`);
      return JSON.stringify(result, null, 2);
    } catch (error) {
      this.introspect(`${callerId} 执行失败: ${error.message}`);
      this.logger(`${callerId} 错误:`, error);
      return `高德地图工具调用失败: ${error.message}`;
    }
  },
};
