import React, { useState, useEffect, useRef } from "react";
import { callAmapTool, getAmapMCPConfig } from "@/utils/mcp/amapTools";
import { MapPin, Navigation, Clock, Star, X, ChevronRight } from "@phosphor-icons/react";

// HUD风格地图组件（使用Mapbox GL JS）
function HUDMap({ center, zoom = 13, route, pois = [], onPoiClick }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    // 加载Mapbox GL JS（开源HUD风格地图）
    const loadMapbox = () => {
      return new Promise((resolve, reject) => {
        if (window.mapboxgl) {
          resolve();
          return;
        }

        // 加载Mapbox GL CSS
        const link = document.createElement("link");
        link.href = "https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css";
        link.rel = "stylesheet";
        document.head.appendChild(link);

        // 加载Mapbox GL JS
        const script = document.createElement("script");
        script.src = "https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js";
        script.onload = () => {
          if (window.mapboxgl) {
            resolve();
          } else {
            reject(new Error("Mapbox GL JS加载失败"));
          }
        };
        script.onerror = () => reject(new Error("Mapbox GL JS加载失败"));
        document.head.appendChild(script);
      });
    };

    loadMapbox()
      .then(() => {
        if (!window.mapboxgl || !mapRef.current) return;

        // 使用公开的Mapbox token（或用户可以配置自己的）
        window.mapboxgl.accessToken = "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXV4NTFyemYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw";

        // 初始化地图 - HUD风格（深色主题）
        const map = new window.mapboxgl.Map({
          container: mapRef.current,
          style: "mapbox://styles/mapbox/dark-v11", // 深色HUD风格
          center: center || [116.397428, 39.90923],
          zoom: zoom,
          pitch: 45, // 3D视角
          bearing: -17.6,
        });

        map.on("load", () => {
          setMapLoaded(true);
          mapInstanceRef.current = map;

          // 绘制路线
          if (route && route.length > 0) {
            map.addSource("route", {
              type: "geojson",
              data: {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: route,
                },
              },
            });

            map.addLayer({
              id: "route",
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

            // 添加路线动画
            map.addLayer({
              id: "route-animation",
              type: "line",
              source: "route",
              layout: {
                "line-join": "round",
                "line-cap": "round",
              },
              paint: {
                "line-color": "#00ffff",
                "line-width": 6,
                "line-opacity": 0.6,
                "line-dasharray": [2, 2],
              },
            });
          }

          // 添加POI标记
          if (pois.length > 0) {
            map.addSource("pois", {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: pois.map((poi, index) => ({
                  type: "Feature",
                  geometry: {
                    type: "Point",
                    coordinates: poi.coordinates,
                  },
                  properties: {
                    id: index,
                    name: poi.name,
                    description: poi.description,
                  },
                })),
              },
            });

            // 添加标记图层
            map.addLayer({
              id: "pois",
              type: "circle",
              source: "pois",
              paint: {
                "circle-radius": 8,
                "circle-color": "#ff6b6b",
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
              },
            });

            // 添加点击事件
            map.on("click", "pois", (e) => {
              const feature = e.features[0];
              if (feature && onPoiClick) {
                onPoiClick(feature.properties);
              }
            });

            // 鼠标悬停效果
            map.on("mouseenter", "pois", () => {
              map.getCanvas().style.cursor = "pointer";
            });

            map.on("mouseleave", "pois", () => {
              map.getCanvas().style.cursor = "";
            });
          }

          // 调整视野以包含所有点
          if (route.length > 0 || pois.length > 0) {
            const bounds = new window.mapboxgl.LngLatBounds();
            route.forEach((coord) => bounds.extend(coord));
            pois.forEach((poi) => bounds.extend(poi.coordinates));
            map.fitBounds(bounds, { padding: 50 });
          }
        });
      })
      .catch((error) => {
        console.error("地图加载失败:", error);
      });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [center, zoom, route, pois, onPoiClick]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-lg overflow-hidden"
      style={{ minHeight: "400px" }}
    />
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
            <Navigation className="w-3 h-3" />
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
            <Navigation className="w-4 h-4" />
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
                <ChevronRight className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
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
export default function TravelRoutePlanner({ query, onComplete }) {
  const [attractions, setAttractions] = useState([]);
  const [route, setRoute] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentAttractionIndex, setCurrentAttractionIndex] = useState(0);
  const [selectedPoi, setSelectedPoi] = useState(null);

  useEffect(() => {
    if (!query) return;
    generateTravelRoute(query);
  }, [query]);

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

      // 流式生成景点
      const generatedAttractions = [];
      
      // 模拟流式输出，逐个生成景点
      for (let i = 0; i < (attractionKeywords.length || 5); i++) {
        await new Promise((resolve) => setTimeout(resolve, 800)); // 模拟延迟

        let attractionName = attractionKeywords[i] || `${city}景点${i + 1}`;
        
        // 使用高德MCP获取地址坐标
        let coordinates = null;
        try {
          const geoResult = await callAmapTool("maps_geo", {
            address: `${city}${attractionName}`,
          });

          if (geoResult && geoResult.success && geoResult.data) {
            const location = geoResult.data.location;
            if (location) {
              const [lng, lat] = location.split(",").map(Number);
              coordinates = [lng, lat];
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
          };
          const baseCoord = defaultCoords[city] || [116.397428, 39.90923];
          coordinates = [
            baseCoord[0] + (Math.random() - 0.5) * 0.1,
            baseCoord[1] + (Math.random() - 0.5) * 0.1,
          ];
        }

        const attraction = {
          id: i,
          name: attractionName,
          description: `这是${city}的一个著名景点，值得一游。`,
          coordinates: coordinates,
          distance: i > 0 ? `${(Math.random() * 5 + 2).toFixed(1)}公里` : "起点",
          duration: i > 0 ? `${Math.round(Math.random() * 30 + 15)}分钟` : null,
          details: [
            `位于${city}市中心`,
            "开放时间：9:00-18:00",
            "建议游玩时间：2-3小时",
          ],
        };

        generatedAttractions.push(attraction);
        setAttractions([...generatedAttractions]);
        setCurrentAttractionIndex(i);

        // 构建路线
        if (generatedAttractions.length > 1) {
          const routeCoords = generatedAttractions.map((a) => a.coordinates);
          setRoute(routeCoords);
        }
      }

      setLoading(false);
      if (onComplete) {
        onComplete({
          attractions: generatedAttractions,
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
                  <ChevronRight className="w-4 h-4 text-cyan-400 mt-0.5" />
                  <span>{detail}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => handleNavigate(selectedPoi.coordinates)}
              className="mt-4 w-full px-4 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Navigation className="w-5 h-5" />
              开始导航
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
