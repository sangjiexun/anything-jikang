import React, { useState, useEffect, useRef } from "react";
import { callAmapTool, getAmapMCPConfig } from "@/utils/mcp/amapTools";
import { MapPin, Compass, Clock, Star, X, CaretRight } from "@phosphor-icons/react";

// HUD风格地图组件（使用MapLibre GL JS - 2025最新开源地图框架）
function HUDMap({ center, zoom = 13, route, pois = [], onPoiClick }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const routeSourceRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredPoi, setHoveredPoi] = useState(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // 加载MapLibre GL JS（2025最新版本 v5.16.0）
    const loadMapLibre = () => {
      return new Promise((resolve, reject) => {
        // 检查是否已加载
        if (window.maplibregl) {
          resolve();
          return;
        }

        // 加载MapLibre GL CSS
        const link = document.createElement("link");
        link.href = "https://unpkg.com/maplibre-gl@5.16.0/dist/maplibre-gl.css";
        link.rel = "stylesheet";
        document.head.appendChild(link);

        // 加载MapLibre GL JS
        const script = document.createElement("script");
        script.src = "https://unpkg.com/maplibre-gl@5.16.0/dist/maplibre-gl.js";
        script.onload = () => {
          if (window.maplibregl) {
            resolve();
          } else {
            reject(new Error("MapLibre GL JS加载失败"));
          }
        };
        script.onerror = () => reject(new Error("MapLibre GL JS加载失败"));
        document.head.appendChild(script);
      });
    };

    loadMapLibre()
      .then(() => {
        if (!window.maplibregl || !mapRef.current) return;

        // 初始化地图 - HUD风格（深色主题，3D视角）
        const map = new window.maplibregl.Map({
          container: mapRef.current,
          style: {
            version: 8,
            sources: {
              "raster-tiles": {
                type: "raster",
                tiles: [
                  "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                ],
                tileSize: 256,
                attribution: "© OpenStreetMap contributors"
              }
            },
            layers: [
              {
                id: "simple-tiles",
                type: "raster",
                source: "raster-tiles",
                minzoom: 0,
                maxzoom: 22
              }
            ],
            glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf"
          },
          center: center || [116.397428, 39.90923],
          zoom: zoom,
          pitch: 60, // 3D俯仰角
          bearing: -15, // 旋转角度
        });

        // 添加深色滤镜（HUD风格）
        map.on("load", () => {
          // 添加深色滤镜图层
          map.addLayer({
            id: "dark-filter",
            type: "background",
            paint: {
              "background-color": "#0a0a0a",
              "background-opacity": 0.3
            }
          });

          setMapLoaded(true);
          mapInstanceRef.current = map;

          // 绘制流动路线
          if (route && route.length > 0) {
            drawAnimatedRoute(map, route);
          }

          // 绘制科技感坐标标记
          if (pois.length > 0) {
            drawTechMarkers(map, pois);
          }

          // 调整视野以包含所有点
          const validBounds = [];
          if (route && route.length > 0) {
            route.forEach((coord) => {
              if (isValidCoordinate(coord)) {
                validBounds.push(coord);
              }
            });
          }
          if (pois && pois.length > 0) {
            pois.forEach((poi) => {
              if (poi.coordinates && isValidCoordinate(poi.coordinates)) {
                validBounds.push(poi.coordinates);
              }
            });
          }
          
          if (validBounds.length > 0) {
            const bounds = validBounds.reduce((bounds, coord) => {
              return bounds.extend(coord);
            }, new window.maplibregl.LngLatBounds(validBounds[0], validBounds[0]));
            
            map.fitBounds(bounds, {
              padding: 50,
              duration: 1000
            });
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

  // 验证坐标是否有效
  const isValidCoordinate = (coord) => {
    if (!coord || !Array.isArray(coord) || coord.length < 2) return false;
    const [lng, lat] = coord;
    return (
      typeof lng === "number" &&
      typeof lat === "number" &&
      !isNaN(lng) &&
      !isNaN(lat) &&
      lng >= -180 &&
      lng <= 180 &&
      lat >= -90 &&
      lat <= 90
    );
  };

  // 绘制流动路线（使用MapLibre GL JS + 自定义动画）
  const drawAnimatedRoute = (map, routeCoords) => {
    if (!map || !routeCoords || routeCoords.length < 2) return;

    try {
      // 验证并过滤无效坐标
      const validCoords = routeCoords.filter(isValidCoordinate);
      if (validCoords.length < 2) {
        console.warn("有效坐标点不足，无法绘制路线");
        return;
      }

      // 先清理旧的路线图层
      if (map.getLayer("route-animated")) {
        map.removeLayer("route-animated");
      }
      if (map.getLayer("route-static")) {
        map.removeLayer("route-static");
      }
      if (map.getSource("route")) {
        map.removeSource("route");
      }

      // 创建GeoJSON数据源
      const geojson = {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: validCoords,
        },
      };

      map.addSource("route", {
        type: "geojson",
        data: geojson,
      });

      // 绘制静态路线作为背景
      map.addLayer({
        id: "route-static",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#00ff88",
          "line-width": 4,
          "line-opacity": 0.8,
        },
      });

      // 绘制流动动画路线
      let animationProgress = 0;
      const animateRoute = () => {
        animationProgress = (animationProgress + 0.02) % 1;

        // 计算动画路径
        const animatedCoords = [];
        for (let i = 0; i < validCoords.length - 1; i++) {
          const start = validCoords[i];
          const end = validCoords[i + 1];
          const segmentProgress = Math.max(0, Math.min(1, (animationProgress * validCoords.length) - i));
          
          if (segmentProgress > 0 && segmentProgress <= 1) {
            const animatedPoint = [
              start[0] + (end[0] - start[0]) * segmentProgress,
              start[1] + (end[1] - start[1]) * segmentProgress,
            ];
            animatedCoords.push(animatedPoint);
          }
        }

        if (animatedCoords.length > 0) {
          const animatedGeojson = {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: animatedCoords,
            },
          };

          if (map.getSource("route-animated")) {
            map.getSource("route-animated").setData(animatedGeojson);
          } else {
            map.addSource("route-animated", {
              type: "geojson",
              data: animatedGeojson,
            });

            map.addLayer({
              id: "route-animated",
              type: "line",
              source: "route-animated",
              layout: {
                "line-join": "round",
                "line-cap": "round",
              },
              paint: {
                "line-color": "#00ffff",
                "line-width": 6,
                "line-opacity": 0.9,
              },
            });
          }
        }

        animationFrameRef.current = requestAnimationFrame(animateRoute);
      };

      animateRoute();
      routeSourceRef.current = "route";
    } catch (error) {
      console.error("绘制流动路线失败:", error);
    }
  };

  // 绘制科技感坐标标记
  const drawTechMarkers = (map, pois) => {
    if (!map || !pois || pois.length === 0) return;

    try {
      // 清理旧标记
      if (markersRef.current && markersRef.current.length > 0) {
        markersRef.current.forEach((marker) => {
          try {
            if (marker && marker.remove) {
              marker.remove();
            }
          } catch (e) {
            // 忽略单个标记清理错误
          }
        });
        markersRef.current = [];
      }

      pois.forEach((poi, index) => {
        // 验证坐标有效性
        if (!poi.coordinates || !isValidCoordinate(poi.coordinates)) {
          console.warn(`景点 ${poi.name || index} 的坐标无效，已跳过`);
          return;
        }

        try {
          // 确保坐标格式正确 [lng, lat]
          const [lng, lat] = poi.coordinates;
          const validPosition = [Number(lng), Number(lat)];

          // 创建科技感自定义图标
          const iconUrl = createTechMarkerIcon(poi, index);

          // 创建DOM元素作为标记
          const el = document.createElement("div");
          el.className = "tech-marker";
          el.style.width = "40px";
          el.style.height = "40px";
          el.style.backgroundImage = `url(${iconUrl})`;
          el.style.backgroundSize = "contain";
          el.style.cursor = "pointer";
          el.title = poi.name || `景点 ${index + 1}`;

          // 创建MapLibre标记
          const marker = new window.maplibregl.Marker({
            element: el,
            anchor: "center",
          })
            .setLngLat(validPosition)
            .addTo(map);

          // 鼠标悬停显示卡片
          el.addEventListener("mouseenter", () => {
            setHoveredPoi(poi);
            showHoverCard(map, poi, validPosition);
          });

          el.addEventListener("mouseleave", () => {
            setHoveredPoi(null);
            hideHoverCard();
          });

          // 点击事件
          el.addEventListener("click", () => {
            if (onPoiClick) {
              onPoiClick({ id: index, name: poi.name, description: poi.description });
            }
          });

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
  const showHoverCard = (map, poi, position) => {
    if (!map || !position || hoverInfoRef.current) return;

    try {
      if (!isValidCoordinate(position)) {
        console.warn("标记位置无效，无法显示悬停卡片");
        return;
      }

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

      const popup = new window.maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: [0, -40],
      })
        .setLngLat(position)
        .setHTML(content)
        .addTo(map);

      hoverInfoRef.current = popup;
    } catch (error) {
      console.warn("显示悬停卡片失败:", error);
    }
  };

  // 隐藏悬停卡片
  const hideHoverCard = () => {
    if (hoverInfoRef.current) {
      hoverInfoRef.current.remove();
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
            if (!isNaN(lng) && !isNaN(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
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
        const offsetLng = (Math.random() - 0.5) * 0.1;
        const offsetLat = (Math.random() - 0.5) * 0.1;
        coordinates = [
          Number((baseCoord[0] + offsetLng).toFixed(6)),
          Number((baseCoord[1] + offsetLat).toFixed(6)),
        ];
        // 再次验证坐标
        if (!isValidCoordinate(coordinates)) {
          coordinates = baseCoord; // 如果无效，使用原始坐标
        }
        address = `${city}${attractionName}`;
      }

      // 最终验证坐标
      if (!isValidCoordinate(coordinates)) {
        console.error(`无法为景点 ${attractionName} 获取有效坐标`);
        return;
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
        
        // 更新路线（只包含有效坐标）
        if (updated.length > 1) {
          const routeCoords = updated
            .map((a) => a.coordinates)
            .filter((coord) => coord && isValidCoordinate(coord));
          if (routeCoords.length >= 2) {
            setRoute(routeCoords);
          }
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
