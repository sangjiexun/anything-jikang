import React, { useState, useEffect, useRef } from "react";
import { callAmapTool, getAmapMCPConfig } from "@/utils/mcp/amapTools";
import { MapPin, Compass, Clock, Star, X, CaretRight } from "@phosphor-icons/react";

// 验证坐标是否有效（工具函数，可在组件间共享）
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

// 黑客风格HUD全息地图组件（使用ArcGIS开源底图 + MapLibre GL JS）
function HUDMap({ center, zoom = 13, route, pois = [], onPoiClick }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const routeSourceRef = useRef(null);
  const animationFrameRef = useRef(null);
  const hoverInfoRef = useRef(null);
  const scanlineRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredPoi, setHoveredPoi] = useState(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // 加载MapLibre GL JS（用于渲染ArcGIS底图）
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

        // 初始化地图 - 黑客风格HUD全息（使用ArcGIS开源底图）
        const map = new window.maplibregl.Map({
          container: mapRef.current,
          style: {
            version: 8,
            sources: {
              // ArcGIS开源底图服务（静态瓦片）
              "arcgis-basemap": {
                type: "raster",
                tiles: [
                  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
                  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
                ],
                tileSize: 256,
                attribution: "© Esri"
              }
            },
            layers: [
              {
                id: "arcgis-base",
                type: "raster",
                source: "arcgis-basemap",
                minzoom: 0,
                maxzoom: 19
              }
            ],
            glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf"
          },
          center: center || [116.397428, 39.90923],
          zoom: zoom,
          pitch: 60, // 3D俯仰角（黑客风格）
          bearing: -15, // 旋转角度
        });

        // 添加黑客风格HUD全息效果（蓝色和黄色基调）
        map.on("load", () => {
          // 添加深色背景（黑客风格）
          map.addLayer({
            id: "hud-background",
            type: "background",
            paint: {
              "background-color": "#0a0a1a", // 深蓝黑色背景
              "background-opacity": 0.8
            }
          });

          // 添加网格线效果（HUD全息网格）
          map.addLayer({
            id: "hud-grid",
            type: "line",
            source: {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: []
              }
            },
            paint: {
              "line-color": "#00ffff", // 青色网格线
              "line-width": 0.5,
              "line-opacity": 0.3
            }
          });

          // 添加扫描线动画效果（使用CSS）
          const filterContainer = mapRef.current;
          if (filterContainer) {
            filterContainer.style.filter = "contrast(1.2) brightness(0.9)";
            filterContainer.style.position = "relative";
            
            // 创建扫描线效果
            const scanline = document.createElement("div");
            scanline.className = "hud-scanline";
            scanline.style.cssText = `
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 2px;
              background: linear-gradient(to bottom, 
                transparent 0%, 
                rgba(0, 255, 255, 0.5) 50%, 
                transparent 100%);
              animation: scanline 3s linear infinite;
              pointer-events: none;
              z-index: 1000;
            `;
            filterContainer.appendChild(scanline);
            scanlineRef.current = scanline;
          }

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
            try {
              // 安全地创建bounds
              const firstCoord = validBounds[0];
              if (firstCoord && firstCoord.length === 2 && !isNaN(firstCoord[0]) && !isNaN(firstCoord[1])) {
                const bounds = new window.maplibregl.LngLatBounds(firstCoord, firstCoord);
                validBounds.forEach((coord) => {
                  if (coord && coord.length === 2 && !isNaN(coord[0]) && !isNaN(coord[1])) {
                    bounds.extend(coord);
                  }
                });
                
                map.fitBounds(bounds, {
                  padding: 50,
                  duration: 1000
                });
              }
            } catch (error) {
              console.warn("调整地图视野失败:", error);
            }
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
          // 取消动画帧
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }

          // 清理标记
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

          // 清理路线图层
          if (mapInstanceRef.current && routeSourceRef.current) {
            try {
              if (mapInstanceRef.current.getLayer("route-animated")) {
                mapInstanceRef.current.removeLayer("route-animated");
              }
              if (mapInstanceRef.current.getLayer("route-static")) {
                mapInstanceRef.current.removeLayer("route-static");
              }
              if (mapInstanceRef.current.getSource("route")) {
                mapInstanceRef.current.removeSource("route");
              }
              if (mapInstanceRef.current.getSource("route-animated")) {
                mapInstanceRef.current.removeSource("route-animated");
              }
            } catch (e) {
              // 忽略清理错误
            }
            routeSourceRef.current = null;
          }

          // 清理悬停信息窗口
          if (hoverInfoRef.current) {
            try {
              hoverInfoRef.current.remove();
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
                mapInstanceRef.current.remove();
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
  }, [center, zoom, route, pois, onPoiClick]);

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

      // 绘制静态路线作为背景（黑客风格 - 蓝色和黄色基调）
      map.addLayer({
        id: "route-static",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#00ffff", // 青色路线（蓝色基调）
          "line-width": 5,
          "line-opacity": 0.8,
          "line-dasharray": [2, 2], // 虚线效果
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
                "line-color": "#ffff00", // 黄色流动线（黄色基调）
                "line-width": 7,
                "line-opacity": 0.9,
                "line-dasharray": [4, 2], // 流动虚线效果
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

  // 创建黑客风格HUD全息标记图标（使用Canvas绘制 - 蓝色和黄色基调）
  const createTechMarkerIcon = (poi, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");

    // 判断是否为关键位置（从坐标直接创建的）
    const isKeyLocation = poi.isKeyLocation;

    // 绘制外圈（黑客风格发光效果 - 蓝色和黄色）
    const gradient = ctx.createRadialGradient(25, 25, 0, 25, 25, 25);
    if (isKeyLocation) {
      // 关键位置使用黄色基调
      gradient.addColorStop(0, "rgba(255, 255, 0, 0.8)");
      gradient.addColorStop(0.5, "rgba(255, 255, 0, 0.4)");
      gradient.addColorStop(1, "rgba(255, 255, 0, 0)");
    } else {
      // 普通景点使用蓝色基调
      gradient.addColorStop(0, "rgba(0, 255, 255, 0.8)");
      gradient.addColorStop(0.5, "rgba(0, 255, 255, 0.4)");
      gradient.addColorStop(1, "rgba(0, 255, 255, 0)");
    }
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(25, 25, 25, 0, Math.PI * 2);
    ctx.fill();

    // 绘制内圈（黑客风格 - 蓝色和黄色）
    if (isKeyLocation) {
      ctx.fillStyle = "#ffff00"; // 黄色
    } else {
      ctx.fillStyle = "#00ffff"; // 青色（蓝色基调）
    }
    ctx.beginPath();
    ctx.arc(25, 25, 15, 0, Math.PI * 2);
    ctx.fill();

    // 绘制HUD风格边框（全息效果）
    ctx.strokeStyle = isKeyLocation ? "#ffff00" : "#00ffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(25, 25, 15, 0, Math.PI * 2);
    ctx.stroke();

    // 绘制中心点（全息效果）
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(25, 25, 7, 0, Math.PI * 2);
    ctx.fill();

    // 绘制编号或关键位置标识（黑客风格字体）
    ctx.fillStyle = "#000000";
    ctx.font = "bold 16px 'Courier New', monospace"; // 等宽字体（黑客风格）
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (isKeyLocation) {
      ctx.fillText("★", 25, 25); // 关键位置显示星号
    } else {
      ctx.fillText(String(index + 1), 25, 25);
    }

    // 添加全息扫描线效果
    const scanGradient = ctx.createLinearGradient(0, 0, 0, 50);
    scanGradient.addColorStop(0, "rgba(0, 255, 255, 0)");
    scanGradient.addColorStop(0.5, "rgba(0, 255, 255, 0.3)");
    scanGradient.addColorStop(1, "rgba(0, 255, 255, 0)");
    ctx.fillStyle = scanGradient;
    ctx.fillRect(0, 0, 50, 50);

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
          background: linear-gradient(135deg, rgba(0, 10, 20, 0.95), rgba(10, 0, 20, 0.95));
          backdrop-filter: blur(10px);
          border: 2px solid;
          border-image: linear-gradient(45deg, #00ffff, #ffff00) 1;
          border-radius: 8px;
          padding: 12px;
          min-width: 220px;
          box-shadow: 
            0 0 20px rgba(0, 255, 255, 0.5),
            inset 0 0 10px rgba(0, 255, 255, 0.1);
          font-family: 'Courier New', monospace;
        ">
          <div style="
            color: #00ffff;
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 8px;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
          ">${poi.name || "坐标点"}</div>
          ${poi.description ? `<div style="color: rgba(255, 255, 255, 0.9); font-size: 12px; margin-top: 4px; font-family: 'Courier New', monospace;">${poi.description}</div>` : ""}
          ${poi.distance ? `<div style="color: #ffff00; font-size: 11px; margin-top: 6px; font-family: 'Courier New', monospace;">📍 ${poi.distance}</div>` : ""}
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
      style={{ 
        minHeight: "400px",
        position: "relative",
      }}
    >
      {/* HUD全息网格覆盖层 */}
      <div className="hud-grid-overlay" />
      
      {/* HUD边框效果 */}
      <div className="hud-border" />
      
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10">
          <div className="text-center">
            <div 
              className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mx-auto mb-4"
              style={{
                borderTopColor: "#00ffff",
                borderBottomColor: "#ffff00",
              }}
            ></div>
            <p 
              className="text-cyan-300 font-mono"
              style={{
                textShadow: "0 0 10px rgba(0, 255, 255, 0.8)",
              }}
            >
              正在加载ArcGIS地图...
            </p>
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

  // 从消息中提取坐标（优先使用高德MCP搜索地址获取坐标）
  const extractCoordinatesFromMessage = async (messageText) => {
    if (!messageText) return [];

    const coordinates = [];
    
    // 首先尝试从文本中提取地址，使用高德MCP搜索获取坐标
    const addressPatterns = [
      /(?:地址|位置|地点|去|到|在)[:：]?\s*([^，,。.\n坐标]+?)(?:\s|$|，|。|坐标)/g,
      /([^，,。.\n]+?)(?:的坐标|在哪里|位置|地址)/g,
    ];

    const addresses = [];
    addressPatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(messageText)) !== null) {
        const addr = match[1]?.trim();
        if (addr && addr.length > 1 && addr.length < 50 && !addr.match(/^\d+\.?\d*$/)) {
          addresses.push(addr);
        }
      }
    });

    // 使用高德MCP搜索地址获取坐标
    if (addresses.length > 0) {
      const config = getAmapMCPConfig();
      if (config && config.apiKey) {
        for (const address of addresses) {
          try {
            const geoResult = await callAmapTool("maps_geo", {
              address: address,
            });

            if (geoResult && geoResult.success && geoResult.data) {
              const location = geoResult.data.location;
              if (location) {
                const [lng, lat] = location.split(",").map(Number);
                if (!isNaN(lng) && !isNaN(lat) && isValidCoordinate([lng, lat])) {
                  coordinates.push([lng, lat]);
                }
              }
            }
          } catch (error) {
            console.warn(`通过高德MCP搜索地址"${address}"失败:`, error);
          }
        }
      }
    }

    // 然后匹配直接提供的坐标格式：经度,纬度 或 纬度,经度
    const coordPatterns = [
      // 标准格式：116.397428,39.90923 或 39.90923,116.397428
      /([-+]?\d+\.?\d*)[,，\s]+([-+]?\d+\.?\d*)/g,
      // 带标签的格式：经度:116.397428,纬度:39.90923
      /(?:经度|longitude|lng)[:：]\s*([-+]?\d+\.?\d*)[,，\s]*(?:纬度|latitude|lat)[:：]\s*([-+]?\d+\.?\d*)/gi,
      // 带标签的格式：纬度:39.90923,经度:116.397428
      /(?:纬度|latitude|lat)[:：]\s*([-+]?\d+\.?\d*)[,，\s]*(?:经度|longitude|lng)[:：]\s*([-+]?\d+\.?\d*)/gi,
    ];

    coordPatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(messageText)) !== null) {
        let lng, lat;
        
        // 判断是经度在前还是纬度在前
        if (match[0].toLowerCase().includes("lat") || match[0].toLowerCase().includes("纬度")) {
          // 纬度在前的情况
          lat = parseFloat(match[1]);
          lng = parseFloat(match[2]);
        } else {
          // 默认经度在前
          lng = parseFloat(match[1]);
          lat = parseFloat(match[2]);
        }

        // 验证坐标范围
        if (isValidCoordinate([lng, lat])) {
          coordinates.push([lng, lat]);
        }
      }
    });

    // 去重
    return [...new Set(coordinates.map(c => c.join(',')))].map(c => c.split(',').map(Number));
  };

  // 从流式消息中解析景点信息和坐标
  const parseAttractionsFromMessage = async (messageText) => {
    if (!messageText) return;

    // 首先提取坐标（使用高德MCP搜索）
    const extractedCoords = await extractCoordinatesFromMessage(messageText);
    if (extractedCoords.length > 0) {
      // 如果有坐标，直接使用坐标创建关键位置点
      for (let i = 0; i < extractedCoords.length; i++) {
        const coord = extractedCoords[i];
        if (isValidCoordinate(coord)) {
          await addKeyLocationPoint(coord, `关键位置 ${i + 1}`);
        }
      }
    }

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

  // 添加关键位置点（从坐标直接创建）
  const addKeyLocationPoint = async (coordinates, name = "关键位置") => {
    try {
      const newAttraction = {
        id: Date.now() + Math.random(),
        name: name,
        description: `坐标位置：${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}`,
        coordinates: coordinates,
        distance: attractions.length > 0 ? "计算中..." : "起点",
        duration: null,
        address: null,
        details: [
          `经度：${coordinates[0].toFixed(6)}`,
          `纬度：${coordinates[1].toFixed(6)}`,
          "这是您提问中的关键位置坐标",
        ],
        isKeyLocation: true, // 标记为关键位置
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
      console.error("添加关键位置点失败:", error);
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
