import React, { useEffect, useRef, useState } from "react";

export default function AmapViewer({
  apiKey,
  center,
  zoom = 13,
  height = "400px",
  routeData = null,
  pois = [],
  markers = [],
}) {
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapInstanceRef = useRef(null);
  const locaInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const routeRef = useRef(null);

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;

    // 动态加载高德地图脚本
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

        // 加载高德地图 API
        const amapScript = document.createElement("script");
        amapScript.src = `https://webapi.amap.com/maps?v=2.0&key=${apiKey}`;
        amapScript.onload = () => {
          // 加载 Loca
          const locaScript = document.createElement("script");
          locaScript.src = `https://webapi.amap.com/loca?v=2.0.0&key=${apiKey}`;
          locaScript.onload = () => {
            setMapLoaded(true);
            resolve();
          };
          locaScript.onerror = reject;
          document.head.appendChild(locaScript);
        };
        amapScript.onerror = reject;
        document.head.appendChild(amapScript);
      });
    };

    loadAmapScript()
      .then(() => {
        if (!window.AMap || !mapRef.current) return;

        // 初始化地图
        const map = new window.AMap.Map(mapRef.current, {
          zoom: zoom,
          center: center || [116.455672, 39.966409],
          showLabel: false,
          viewMode: "3D",
          mapStyle: "amap://styles/grey",
        });

        mapInstanceRef.current = map;

        // 初始化 Loca
        if (window.Loca) {
          const loca = new window.Loca.Container({
            map,
          });
          locaInstanceRef.current = loca;
        }

        // 绘制路线
        if (routeData) {
          drawRoute(map, routeData);
        }

        // 绘制 POI 标记
        if (pois.length > 0 || markers.length > 0) {
          drawMarkers(map, pois.length > 0 ? pois : markers);
        }

        return map;
      })
      .catch((error) => {
        console.error("Failed to load Amap:", error);
      });

    return () => {
      // 清理标记
      markersRef.current.forEach((marker) => {
        if (marker) marker.setMap(null);
      });
      markersRef.current = [];

      // 清理路线
      if (routeRef.current) {
        routeRef.current.setMap(null);
        routeRef.current = null;
      }

      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, [apiKey, center, zoom, routeData, pois, markers]);

  // 绘制路线
  const drawRoute = (map, routeData) => {
    if (!window.AMap || !routeData) return;

    try {
      // 清理旧路线
      if (routeRef.current) {
        routeRef.current.setMap(null);
      }

      // 获取路径点
      const paths = [];
      if (routeData.paths && routeData.paths.length > 0) {
        routeData.paths.forEach((path) => {
          if (path.steps) {
            path.steps.forEach((step) => {
              if (step.polyline) {
                const coords = decodePolyline(step.polyline);
                paths.push(...coords);
              }
            });
          }
        });
      }

      if (paths.length > 0) {
        const polyline = new window.AMap.Polyline({
          path: paths,
          strokeColor: "#3366FF",
          strokeWeight: 6,
          strokeOpacity: 0.8,
          lineJoin: "round",
          lineCap: "round",
        });
        polyline.setMap(map);
        routeRef.current = polyline;

        // 调整地图视野以包含整条路线
        map.setFitView([polyline]);
      }
    } catch (error) {
      console.error("绘制路线失败:", error);
    }
  };

  // 绘制标记
  const drawMarkers = (map, items) => {
    if (!window.AMap || !items || items.length === 0) return;

    try {
      // 清理旧标记
      markersRef.current.forEach((marker) => {
        if (marker) marker.setMap(null);
      });
      markersRef.current = [];

      const bounds = [];
      items.forEach((item, index) => {
        let location = null;
        let title = "";

        if (item.location) {
          // POI 对象
          const [lng, lat] = item.location.split(",").map(Number);
          location = [lng, lat];
          title = item.name || item.pname || "";
        } else if (item.longitude && item.latitude) {
          // 坐标对象
          location = [Number(item.longitude), Number(item.latitude)];
          title = item.name || "";
        } else if (Array.isArray(item)) {
          // 直接是坐标数组
          location = item;
        }

        if (location) {
          const marker = new window.AMap.Marker({
            position: location,
            title: title,
            label: {
              content: title || `标记${index + 1}`,
              direction: "right",
            },
          });
          marker.setMap(map);
          markersRef.current.push(marker);
          bounds.push(location);
        }
      });

      // 调整地图视野以包含所有标记
      if (bounds.length > 0) {
        map.setFitView(null, false, [20, 20, 20, 20], 16);
      }
    } catch (error) {
      console.error("绘制标记失败:", error);
    }
  };

  // 解码 polyline 字符串为坐标数组
  const decodePolyline = (polyline) => {
    if (!polyline) return [];
    const coords = [];
    const points = polyline.split(";");
    points.forEach((point) => {
      const [lng, lat] = point.split(",").map(Number);
      if (!isNaN(lng) && !isNaN(lat)) {
        coords.push([lng, lat]);
      }
    });
    return coords;
  };

  return (
    <div className="w-full rounded-lg overflow-hidden border border-theme-sidebar-border">
      <div
        ref={mapRef}
        style={{ width: "100%", height: height, minHeight: "300px" }}
        className="bg-gray-800"
      />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80">
          <div className="text-white/60">正在加载地图...</div>
        </div>
      )}
    </div>
  );
}
