import React, { useState, useEffect, useRef } from "react";
import { callAmapTool, getAmapMCPConfig } from "@/utils/mcp/amapTools";
import { MapPin, Compass, Clock, Star, X, CaretRight } from "@phosphor-icons/react";

// HUD风格地图组件（使用高德地图 + Loca.js）
function HUDMap({ center, zoom = 13, route, pois = [], onPoiClick, apiKey }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const locaInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const routeLayerRef = useRef(null);
  const hoverInfoRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredPoi, setHoveredPoi] = useState(null);

  useEffect(() => {
    if (!mapRef.current || !apiKey) return;

    // 加载高德地图脚本
    const loadAmapScript = () => {
      return new Promise((resolve, reject) => {
        // 检查是否已加载
        if (window.AMap && window.Loca) {
          resolve();
          return;
        }

        // 加载 jQuery (如果需要)
        if (!window.jQuery) {
          const jqScript = document.createElement("script");
          jqScript.src = "//g.alicdn.com/code/lib/jquery/1.11.3/jquery.min.js";
          jqScript.crossOrigin = "anonymous";
          document.head.appendChild(jqScript);
        }

        // 检查是否已加载
        if (window.AMap && window.Loca) {
          setMapLoaded(true);
          resolve();
          return;
        }

        // 加载高德地图 JS API - 使用v2.0以支持Loca.js
        const amapScript = document.createElement("script");
        amapScript.src = `https://webapi.amap.com/maps?v=2.0&key=${apiKey}`;
        amapScript.async = true;
        amapScript.defer = true;
        
        amapScript.onload = () => {
          if (window.AMap) {
            // 加载Loca.js用于流动路线动画
            if (!window.Loca) {
              const locaScript = document.createElement("script");
              locaScript.src = `https://webapi.amap.com/loca?v=2.0.0&key=${apiKey}`;
              locaScript.async = true;
              locaScript.defer = true;
              locaScript.onload = () => {
                if (window.Loca) {
                  setMapLoaded(true);
                  resolve();
                } else {
                  reject(new Error("Loca.js加载失败"));
                }
              };
              locaScript.onerror = () => {
                reject(new Error("Loca.js加载失败"));
              };
              document.head.appendChild(locaScript);
            } else {
              setMapLoaded(true);
              resolve();
            }
          } else {
            reject(new Error("地图API加载失败"));
          }
        };
        
        amapScript.onerror = () => {
          reject(new Error("高德地图加载失败"));
        };
        
        document.head.appendChild(amapScript);
      });
    };

    loadAmapScript()
      .then(() => {
        if (!window.AMap || !mapRef.current) return;

        // 初始化地图 - HUD风格（深色主题，3D视角）
        const map = new window.AMap.Map(mapRef.current, {
          zoom: zoom,
          center: center || [116.397428, 39.90923],
          viewMode: "3D", // 3D视角
          pitch: 60, // 俯仰角
          rotation: -15, // 旋转角度
          mapStyle: "amap://styles/dark", // 深色HUD风格
          showLabel: false,
          resizeEnable: true,
        });

        map.on("complete", () => {
          setMapLoaded(true);
          mapInstanceRef.current = map;

          // 创建Loca容器用于流动路线
          if (window.Loca && !locaInstanceRef.current) {
            locaInstanceRef.current = new window.Loca.Container({
              map: map,
            });
          }

          // 绘制流动路线
          if (route && route.length > 0 && window.Loca) {
            drawAnimatedRoute(map, route);
          }

          // 绘制科技感坐标标记
          if (pois.length > 0) {
            drawTechMarkers(map, pois);
          }

          // 调整视野以包含所有点
          if (route.length > 0 || pois.length > 0) {
            const bounds = new window.AMap.Bounds();
            route.forEach((coord) => bounds.extend(coord));
            pois.forEach((poi) => bounds.extend(poi.coordinates));
            map.setBounds(bounds);
          }
        });
      })
      .catch((error) => {
        console.error("地图加载失败:", error);
      });

    return () => {
      // 使用setTimeout延迟清理，避免与React的DOM清理冲突
      setTimeout(() => {
        try {
          // 清理标记
          if (markersRef.current && markersRef.current.length > 0) {
            markersRef.current.forEach((marker) => {
              try {
                if (marker && marker.setMap) {
                  marker.setMap(null);
                }
              } catch (e) {
                // 忽略单个标记清理错误
              }
            });
            markersRef.current = [];
          }

          // 清理路线图层
          if (routeLayerRef.current && locaInstanceRef.current) {
            try {
              locaInstanceRef.current.remove(routeLayerRef.current);
            } catch (e) {
              // 忽略清理错误
            }
            routeLayerRef.current = null;
          }

          // 清理Loca实例
          if (locaInstanceRef.current) {
            try {
              locaInstanceRef.current.destroy();
            } catch (e) {
              // 忽略清理错误
            }
            locaInstanceRef.current = null;
          }

          // 清理悬停信息窗口
          if (hoverInfoRef.current) {
            try {
              hoverInfoRef.current.close();
            } catch (e) {
              // 忽略关闭错误
            }
            hoverInfoRef.current = null;
          }

          // 清理地图实例（最后清理）
          if (mapInstanceRef.current) {
            try {
              // 检查地图容器是否还存在
              if (mapRef.current && mapRef.current.parentNode) {
                mapInstanceRef.current.destroy();
              }
            } catch (e) {
              // 忽略销毁错误
            }
            mapInstanceRef.current = null;
          }
        } catch (error) {
          // 忽略所有清理错误，避免影响React的清理流程
          console.warn("地图清理过程中出现错误（已忽略）:", error);
        }
      }, 0);
    };
  }, [center, zoom, route, pois, onPoiClick, apiKey]);

  // 绘制流动路线（使用Loca.js PulseLineLayer）
  const drawAnimatedRoute = (map, routeCoords) => {
    if (!window.Loca || !locaInstanceRef.current || !routeCoords || routeCoords.length < 2) return;

    try {
      // 先清理旧的路线图层
      if (routeLayerRef.current && locaInstanceRef.current) {
        try {
          locaInstanceRef.current.remove(routeLayerRef.current);
        } catch (e) {
          // 忽略清理错误
        }
        routeLayerRef.current = null;
      }

      const loca = locaInstanceRef.current;

      // 创建GeoJSON数据源
      const geo = new window.Loca.GeoJSONSource({
        data: {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: routeCoords,
          },
        },
      });

      // 创建脉冲线图层（流动路线）
      const layer = new window.Loca.PulseLineLayer({
        zIndex: 10,
        opacity: 1,
        visible: true,
        zooms: [2, 22],
      });

      layer.setSource(geo);
      layer.setStyle({
        altitude: 0,
        lineWidth: 8,
        headColor: "#00ffff", // 青色脉冲头
        trailColor: "rgba(0, 255, 136, 0.6)", // 绿色脉冲尾
        interval: 1,
        duration: 3000, // 3秒跑完整段路
      });

      loca.add(layer);
      loca.animate.start();
      routeLayerRef.current = layer;

      // 同时绘制静态路线作为背景
      const staticPolyline = new window.AMap.Polyline({
        path: routeCoords,
        strokeColor: "#00ff88",
        strokeWeight: 4,
        strokeOpacity: 0.8,
        lineJoin: "round",
        lineCap: "round",
      });
      staticPolyline.setMap(map);
    } catch (error) {
      console.error("绘制流动路线失败:", error);
    }
  };

  // 绘制科技感坐标标记
  const drawTechMarkers = (map, pois) => {
    if (!window.AMap || !pois || pois.length === 0) return;

    try {
      // 清理旧标记
      if (markersRef.current && markersRef.current.length > 0) {
        markersRef.current.forEach((marker) => {
          try {
            if (marker && marker.setMap) {
              marker.setMap(null);
              // 移除事件监听器
              if (marker.off) {
                marker.off("mouseover");
                marker.off("mouseout");
                marker.off("click");
              }
            }
          } catch (e) {
            // 忽略单个标记清理错误
          }
        });
        markersRef.current = [];
      }

      pois.forEach((poi, index) => {
        if (!poi.coordinates) return;

        try {
          // 创建科技感自定义图标
          const icon = new window.AMap.Icon({
            size: new window.AMap.Size(40, 40),
            image: createTechMarkerIcon(poi, index),
            imageSize: new window.AMap.Size(40, 40),
          });

          // 创建标记
          const marker = new window.AMap.Marker({
            position: poi.coordinates,
            icon: icon,
            title: poi.name,
            zIndex: 100 + index,
          });

          // 鼠标悬停显示卡片
          marker.on("mouseover", () => {
            setHoveredPoi(poi);
            showHoverCard(map, poi, marker);
          });

          marker.on("mouseout", () => {
            setHoveredPoi(null);
            hideHoverCard();
          });

          // 点击事件
          marker.on("click", () => {
            if (onPoiClick) {
              onPoiClick({ id: index, name: poi.name, description: poi.description });
            }
          });

          marker.setMap(map);
          markersRef.current.push(marker);
        } catch (error) {
          console.warn(`创建标记 ${index} 失败:`, error);
        }
      });
    } catch (error) {
      console.error("绘制标记失败:", error);
    }
  };

  // 创建科技感标记图标（使用Canvas绘制）
  const createTechMarkerIcon = (poi, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");

    // 绘制外圈（发光效果）
    const gradient = ctx.createRadialGradient(20, 20, 0, 20, 20, 20);
    gradient.addColorStop(0, "rgba(0, 255, 136, 0.8)");
    gradient.addColorStop(0.5, "rgba(0, 255, 255, 0.4)");
    gradient.addColorStop(1, "rgba(0, 255, 136, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(20, 20, 20, 0, Math.PI * 2);
    ctx.fill();

    // 绘制内圈（科技感）
    ctx.fillStyle = "#00ff88";
    ctx.beginPath();
    ctx.arc(20, 20, 12, 0, Math.PI * 2);
    ctx.fill();

    // 绘制中心点
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(20, 20, 6, 0, Math.PI * 2);
    ctx.fill();

    // 绘制编号
    ctx.fillStyle = "#000000";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(index + 1), 20, 20);

    return canvas.toDataURL();
  };

  // 显示悬停卡片
  const showHoverCard = (map, poi, marker) => {
    if (!map || !marker || hoverInfoRef.current) return;

    const content = `
      <div style="
        background: linear-gradient(135deg, rgba(0, 51, 102, 0.95), rgba(51, 0, 102, 0.95));
        backdrop-filter: blur(10px);
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 12px;
        padding: 12px;
        min-width: 200px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      ">
        <div style="
          color: #00ff88;
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 8px;
        ">${poi.name || "景点"}</div>
        ${poi.description ? `<div style="color: rgba(255, 255, 255, 0.8); font-size: 12px; margin-top: 4px;">${poi.description}</div>` : ""}
        ${poi.distance ? `<div style="color: rgba(255, 255, 255, 0.6); font-size: 11px; margin-top: 6px;">📍 ${poi.distance}</div>` : ""}
      </div>
    `;

    const infoWindow = new window.AMap.InfoWindow({
      content: content,
      offset: new window.AMap.Pixel(0, -40),
      closeWhenClickMap: false,
    });

    infoWindow.open(map, marker.getPosition());
    hoverInfoRef.current = infoWindow;
  };

  // 隐藏悬停卡片
  const hideHoverCard = () => {
    if (hoverInfoRef.current) {
      hoverInfoRef.current.close();
      hoverInfoRef.current = null;
    }
  };

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-lg overflow-hidden relative"
      style={{ minHeight: "400px" }}
    >
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mx-auto mb-4"></div>
            <p className="text-cyan-300">正在加载地图...</p>
          </div>
        </div>
      )}
    </div>
  );
}

// 景点卡片组件
function AttractionCard({ attraction, index, onClose, onNavigate }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className="bg-gradient-to-br from-blue-900/90 to-purple-900/90 backdrop-blur-md border border-cyan-500/30 rounded-xl p-4 shadow-2xl animate-slide-in"
      style={{
        animationDelay: `${index * 0.1}s`,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-cyan-400" weight="fill" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{attraction.name}</h3>
            <div className="flex items-center gap-2 text-xs text-cyan-300">
              <Star className="w-3 h-3" weight="fill" />
              <span>景点 {index + 1}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <X className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {attraction.description && (
        <p className="text-white/80 text-sm mb-3 line-clamp-2">
          {attraction.description}
        </p>
      )}

      <div className="flex items-center gap-4 text-xs text-white/60 mb-3">
        {attraction.distance && (
          <div className="flex items-center gap-1">
            <Compass className="w-3 h-3" />
            <span>{attraction.distance}</span>
          </div>
        )}
        {attraction.duration && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{attraction.duration}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {attraction.coordinates && (
          <button
            onClick={() => onNavigate && onNavigate(attraction.coordinates)}
            className="flex-1 px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-1"
          >
            <Compass className="w-4 h-4" />
            导航
          </button>
        )}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm"
        >
          {isExpanded ? "收起" : "详情"}
        </button>
      </div>

      {isExpanded && attraction.details && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-white/70 text-sm space-y-2">
            {attraction.details.map((detail, i) => (
              <div key={i} className="flex items-start gap-2">
                <CaretRight className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                <span>{detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 主组件
export default function TravelRoutePlanner({ query, message, onComplete }) {
  const [attractions, setAttractions] = useState([]);
  const [route, setRoute] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentAttractionIndex, setCurrentAttractionIndex] = useState(0);
  const [selectedPoi, setSelectedPoi] = useState(null);
  const [parsedAttractions, setParsedAttractions] = useState(new Set());

  // 监听流式消息，实时解析景点
  useEffect(() => {
    if (!message) return;
    parseAttractionsFromMessage(message);
  }, [message]);

  // 初始查询处理
  useEffect(() => {
    if (!query) return;
    generateTravelRoute(query);
  }, [query]);

  // 从流式消息中解析景点信息
  const parseAttractionsFromMessage = async (messageText) => {
    if (!messageText) return;

    // 匹配景点模式：更智能的匹配
    const patterns = [
      // 1. 明确的景点推荐格式
      /(?:推荐|建议|可以去|游览|参观)[:：]?\s*([^，,。.\n]+?)(?:景点|景区|公园|博物馆|古迹|遗址|名胜|地方)/g,
      // 2. 编号列表格式
      /(?:第[一二三四五六七八九十\d]+[个项]|景点\d+)[:：]?\s*([^，,。.\n]+?)(?:\s|$|，|。|：)/g,
      // 3. 景点名称后跟描述
      /([^，,。.\n]+?)(?:景点|景区|公园|博物馆|古迹|遗址|名胜)(?:[，,。.\n]|$)/g,
      // 4. 简单列表格式
      /(?:^|\n)\s*[-•·]\s*([^，,。.\n]+?)(?:景点|景区|公园|博物馆|古迹|遗址|名胜|地方)/g,
    ];

    const foundAttractions = [];
    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(messageText)) !== null) {
        const name = match[1]?.trim();
        // 过滤掉无效的匹配
        if (
          name &&
          name.length > 1 &&
          name.length < 30 &&
          !parsedAttractions.has(name) &&
          !name.match(/^(的|是|在|到|去|和|或|与|等|等)$/) &&
          !name.includes("推荐") &&
          !name.includes("建议")
        ) {
          foundAttractions.push(name);
        }
      }
    });

    // 去重并获取新发现的景点
    const newAttractions = [...new Set(foundAttractions)].filter(
      (name) => !parsedAttractions.has(name)
    );

    if (newAttractions.length === 0) return;

    // 更新已解析的景点集合
    setParsedAttractions((prev) => {
      const updated = new Set(prev);
      newAttractions.forEach((name) => updated.add(name));
      return updated;
    });

    // 为每个新发现的景点获取坐标并创建卡片（并行处理以提高速度）
    setLoading(false); // 一旦开始解析，就不再显示加载状态
    
    // 逐个添加，保持顺序和动画效果
    for (let i = 0; i < newAttractions.length; i++) {
      await addAttractionCard(newAttractions[i]);
      // 添加小延迟以产生流式效果
      if (i < newAttractions.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  };

  // 添加景点卡片
  const addAttractionCard = async (attractionName) => {
    try {
      const config = getAmapMCPConfig();
      if (!config || !config.apiKey) {
        console.warn("未找到高德地图MCP配置");
        return;
      }

      // 提取城市信息
      const cityMatch = 
        message?.match(/(?:在|到|去|前往|游览)([^，,。.\n]+?)(?:的|旅游|游玩|景点|地方)/) || 
        query?.match(/(?:在|到|去|前往|游览)([^，,。.\n]+?)(?:的|旅游|游玩|景点|地方)/);
      const city = cityMatch ? cityMatch[1].trim() : "北京";

      // 使用高德MCP获取地址坐标（真实坐标）
      let coordinates = null;
      let address = null;
      
      try {
        // 尝试多种地址格式
        const addressVariants = [
          `${city}${attractionName}`,
          `${attractionName}`,
          `${city}市${attractionName}`,
        ];

        for (const addr of addressVariants) {
          try {
            const geoResult = await callAmapTool("maps_geo", {
              address: addr,
            });

            if (geoResult && geoResult.success && geoResult.data) {
              const location = geoResult.data.location;
              if (location) {
                const [lng, lat] = location.split(",").map(Number);
                if (!isNaN(lng) && !isNaN(lat)) {
                  coordinates = [lng, lat];
                  address = geoResult.data.formatted_address || addr;
                  break;
                }
              }
            }
          } catch (error) {
            // 继续尝试下一个地址格式
            continue;
          }
        }
      } catch (error) {
        console.warn(`获取${attractionName}坐标失败:`, error);
      }

      // 如果没有获取到坐标，使用默认坐标（城市中心附近）
      if (!coordinates) {
        const defaultCoords = {
          北京: [116.397428, 39.90923],
          上海: [121.473701, 31.230416],
          广州: [113.264385, 23.129112],
          深圳: [114.057868, 22.543099],
          杭州: [120.153576, 30.287459],
          成都: [104.065735, 30.659462],
          西安: [108.948024, 34.341568],
          南京: [118.796877, 32.060255],
        };
        const baseCoord = defaultCoords[city] || defaultCoords["北京"];
        coordinates = [
          baseCoord[0] + (Math.random() - 0.5) * 0.1,
          baseCoord[1] + (Math.random() - 0.5) * 0.1,
        ];
        address = `${city}${attractionName}`;
      }

      // 计算距离（基于前一个景点）
      let distance = "起点";
      let duration = null;
      if (attractions.length > 0) {
        const prevCoord = attractions[attractions.length - 1].coordinates;
        // 简单的距离估算（实际应该调用距离API）
        const dist = Math.sqrt(
          Math.pow(coordinates[0] - prevCoord[0], 2) +
          Math.pow(coordinates[1] - prevCoord[1], 2)
        ) * 111; // 粗略转换为公里
        distance = `${dist.toFixed(1)}公里`;
        duration = `${Math.round(dist * 2)}分钟`; // 假设平均速度30km/h
      }

      const newAttraction = {
        id: Date.now() + Math.random(),
        name: attractionName,
        description: address ? `位于${address}` : `这是${city}的一个著名景点，值得一游。`,
        coordinates: coordinates,
        distance: distance,
        duration: duration,
        address: address,
        details: [
          address || `位于${city}市中心`,
          "开放时间：9:00-18:00",
          "建议游玩时间：2-3小时",
        ],
      };

      setAttractions((prev) => {
        const updated = [...prev, newAttraction];
        
        // 更新路线
        if (updated.length > 1) {
          const routeCoords = updated.map((a) => a.coordinates);
          setRoute(routeCoords);
        }
        
        return updated;
      });
    } catch (error) {
      console.error("添加景点卡片失败:", error);
    }
  };

  const generateTravelRoute = async (queryText) => {
    setLoading(true);
    setAttractions([]);
    setRoute([]);

    try {
      const config = getAmapMCPConfig();
      if (!config || !config.apiKey) {
        throw new Error("未找到高德地图MCP配置");
      }

      // 解析查询，提取城市和景点信息
      const cityMatch = queryText.match(/(?:在|到|去|前往)([^，,。.\n]+?)(?:的|旅游|游玩|景点)/);
      const city = cityMatch ? cityMatch[1] : "北京";

      // 提取景点关键词
      const attractionKeywords = [];
      const keywordPatterns = [
        /(?:推荐|想去|看看|游览)([^，,。.\n]+?)(?:景点|地方|景区)/,
        /([^，,。.\n]+?)(?:景点|景区|公园|博物馆|古迹)/,
      ];

      keywordPatterns.forEach((pattern) => {
        const match = queryText.match(pattern);
        if (match && match[1]) {
          attractionKeywords.push(match[1].trim());
        }
      });

      // 如果已经有从流式消息解析的景点，就不需要再生成
      if (attractions.length > 0) {
        setLoading(false);
        return;
      }

      // 流式生成景点
      const generatedAttractions = [];
      
      // 模拟流式输出，逐个生成景点
      for (let i = 0; i < (attractionKeywords.length || 5); i++) {
        await new Promise((resolve) => setTimeout(resolve, 800)); // 模拟延迟

        let attractionName = attractionKeywords[i] || `${city}景点${i + 1}`;
        
        await addAttractionCard(attractionName);
      }

      setLoading(false);
      if (onComplete) {
        onComplete({
          attractions: attractions,
          route: route,
        });
      }
    } catch (error) {
      console.error("生成旅游路线失败:", error);
      setLoading(false);
    }
  };

  const handlePoiClick = (properties) => {
    const attraction = attractions[properties.id];
    if (attraction) {
      setSelectedPoi(attraction);
    }
  };

  const handleNavigate = (coordinates) => {
    // 可以在这里实现导航功能
    console.log("导航到:", coordinates);
  };

  const handleCloseCard = (index) => {
    setAttractions((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full space-y-4">
      {/* 地图区域 */}
      <div className="relative w-full h-[500px] rounded-xl overflow-hidden border border-cyan-500/30">
        {loading && attractions.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mx-auto mb-4"></div>
              <p className="text-cyan-300">正在规划路线...</p>
            </div>
          </div>
        ) : (
          <HUDMap
            apiKey={getAmapMCPConfig()?.apiKey || getAmapMCPConfig()?.webApiKey}
            center={attractions[0]?.coordinates || [116.397428, 39.90923]}
            zoom={13}
            route={route}
            pois={attractions.map((a, i) => ({
              ...a,
              id: i,
            }))}
            onPoiClick={handlePoiClick}
          />
        )}
      </div>

      {/* 景点卡片列表 */}
      <div className="space-y-3">
        {attractions.map((attraction, index) => (
          <AttractionCard
            key={attraction.id}
            attraction={attraction}
            index={index}
            onClose={() => handleCloseCard(index)}
            onNavigate={handleNavigate}
          />
        ))}
      </div>

      {/* 选中POI的详情卡片 */}
      {selectedPoi && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-blue-900/95 to-purple-900/95 backdrop-blur-md border border-cyan-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">{selectedPoi.name}</h2>
              <button
                onClick={() => setSelectedPoi(null)}
                className="p-2 hover:bg-white/10 rounded transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>
            <p className="text-white/80 mb-4">{selectedPoi.description}</p>
            <div className="space-y-2">
              {selectedPoi.details?.map((detail, i) => (
                <div key={i} className="flex items-start gap-2 text-white/70 text-sm">
                  <CaretRight className="w-4 h-4 text-cyan-400 mt-0.5" />
                  <span>{detail}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => handleNavigate(selectedPoi.coordinates)}
              className="mt-4 w-full px-4 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Compass className="w-5 h-5" />
              开始导航
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
