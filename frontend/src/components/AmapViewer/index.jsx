import React, { useEffect, useRef, useState } from "react";
import { getAmapMCPConfig } from "@/utils/mcp/amapTools";

export default function AmapViewer({
  apiKey,
  center,
  zoom = 13,
  height = "400px",
  routeData = null,
  pois = [],
  markers = [],
  trajectoryData = null, // 轨迹数据：{ datasetId, terminalId }，webServiceKey将从MCP配置中获取
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

        // 检查是否已加载
        if (window.AMap) {
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
            // 加载Loca.js用于轨迹可视化
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
            reject(new Error("地图API加载失败：AMap对象未初始化"));
          }
        };
        
        amapScript.onerror = (error) => {
          console.error("高德地图加载失败:", error);
          console.error("可能的原因：");
          console.error("1. API Key类型错误 - 请确保使用的是Web端Key（JS API），而不是Web服务API Key");
          console.error("2. API Key的平台设置不正确 - 请在控制台设置中允许当前域名");
          console.error("3. API Key已过期或无效");
          reject(new Error("地图加载失败：USERKEY_PLAT_NOMATCH - 请检查API Key类型和平台设置"));
        };
        
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
          showLabel: false, // 轨迹可视化时关闭标签
          viewMode: trajectoryData ? "3D" : "2D", // 轨迹可视化使用3D模式
          mapStyle: trajectoryData ? "amap://styles/grey" : "amap://styles/normal",
          resizeEnable: true,
        });
        
        mapInstanceRef.current = map;

        // 地图加载完成后的处理
        map.on("complete", () => {
          // 确保地图正确渲染
          setTimeout(() => {
            try {
              // 检查resize方法是否存在（高德地图v1.4.15可能没有此方法）
              if (map && typeof map.resize === 'function') {
                map.resize();
              } else if (map && typeof map.getSize === 'function') {
                // 如果resize不存在，至少调用getSize来触发地图更新
                map.getSize();
              }
            } catch (e) {
              // 忽略resize错误，高德地图会自动处理容器大小变化
            }
          }, 200);
        });

        // 绘制路线
        if (routeData) {
          drawRoute(map, routeData);
        }

        // 绘制 POI 标记
        if (pois.length > 0 || markers.length > 0) {
          drawMarkers(map, pois.length > 0 ? pois : markers);
        }

        // 绘制轨迹（如果提供轨迹数据）
        if (trajectoryData && window.Loca) {
          drawTrajectory(map, trajectoryData);
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

      // 清理Loca实例
      if (locaInstanceRef.current) {
        try {
          locaInstanceRef.current.destroy();
        } catch (e) {
          console.warn("清理Loca实例失败:", e);
        }
        locaInstanceRef.current = null;
      }

      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, [apiKey, center, zoom, routeData, pois, markers, trajectoryData]);

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

  // 绘制轨迹（使用Loca.js PulseLineLayer）
  const drawTrajectory = async (map, trajectoryData) => {
    if (!window.Loca || !window.jQuery || !trajectoryData.datasetId) {
      console.warn("轨迹可视化需要Loca.js、jQuery和数据集ID");
      return;
    }

    // 从MCP配置中获取Web服务Key
    const mcpConfig = getAmapMCPConfig();
    const webServiceKey = trajectoryData.webServiceKey || mcpConfig?.apiKey;
    
    if (!webServiceKey) {
      console.warn("未找到Web服务Key，请确保在MCP配置中设置了API Key");
      return;
    }

    try {
      // 创建Loca容器
      if (!locaInstanceRef.current) {
        locaInstanceRef.current = new window.Loca.Container({
          map: map,
        });
      }

      const loca = locaInstanceRef.current;

      // 构建属性筛选查询 - 确保格式正确
      const propertiesFilter = {
        relation: "and",
        conditions: [
          {
            field: "terminalId",
            operation: "equal",
            value: trajectoryData.terminalId || 1,
          },
        ],
      };

      // 调用GeoHUB API获取轨迹点
      // 注意：properties参数需要是JSON字符串，但不需要双重编码
      const propertiesStr = JSON.stringify(propertiesFilter);
      const url = `https://restapi.amap.com/rest/lbs/geohub/place/properties?key=${encodeURIComponent(webServiceKey)}&dataset_id=${encodeURIComponent(trajectoryData.datasetId)}&properties=${encodeURIComponent(propertiesStr)}&offset=300`;

      console.log("调用GeoHUB API:", url);
      console.log("参数详情:", {
        key: webServiceKey ? "已从MCP配置获取" : "缺失",
        dataset_id: trajectoryData.datasetId,
        properties: propertiesStr,
        offset: 300,
        mcpConfig: mcpConfig ? "已加载" : "未找到",
      });

      window.jQuery.ajax({
        url: url,
        method: "GET",
        dataType: "json",
      })
        .done(function (res) {
          console.log("GeoHUB API响应:", res);
          
          // 检查API错误响应
          if (res.status === "0" || res.status === 0) {
            console.error("GeoHUB API错误:", res.info || res.message, "错误码:", res.infocode);
            if (res.info === "INVALID_PARAMS" || res.infocode === "20000") {
              console.error("参数错误详情:", {
                key: webServiceKey ? "已从MCP配置获取" : "缺失（请检查MCP配置中的API Key）",
                dataset_id: trajectoryData.datasetId ? "已提供" : "缺失",
                properties: propertiesStr,
                mcpConfigAvailable: mcpConfig ? "是" : "否",
              });
            }
            return;
          }

          if (!res || !res.objects || res.objects.length === 0) {
            console.warn("未找到轨迹数据，响应:", res);
            return;
          }

          // 提取轨迹路径
          const path = [];
          res.objects.forEach((item) => {
            if (item.geometry && item.geometry.coordinates) {
              path.push(item.geometry.coordinates);
            }
          });

          if (path.length === 0) {
            console.warn("轨迹路径为空");
            return;
          }

          // 创建GeoJSON数据源
          const geo = new window.Loca.GeoJSONSource({
            data: {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  geometry: {
                    type: "LineString",
                    coordinates: path,
                  },
                },
              ],
            },
          });

          // 创建脉冲线图层
          const layer = new window.Loca.PulseLineLayer({
            zIndex: 10,
            opacity: 1,
            visible: true,
            zooms: [2, 22],
          });

          layer.setSource(geo);
          layer.setStyle({
            altitude: 0,
            lineWidth: 6,
            // 脉冲头颜色
            headColor: "#efd551",
            // 脉冲尾颜色
            trailColor: "rgba(128, 128, 128, 0.5)",
            interval: 1,
            // 脉冲线的速度，几秒钟跑完整段路
            duration: 5000,
          });

          loca.add(layer);
          loca.animate.start();

          // 调整地图视野以包含整条轨迹
          if (path.length > 0) {
            const bounds = new window.AMap.Bounds();
            path.forEach((coord) => {
              bounds.extend(coord);
            });
            map.setBounds(bounds);
          }
        })
        .fail(function (jqXHR, textStatus, errorThrown) {
          console.error("获取轨迹数据失败:", {
            status: jqXHR.status,
            statusText: jqXHR.statusText,
            textStatus: textStatus,
            errorThrown: errorThrown,
            responseText: jqXHR.responseText,
          });
          
          // 尝试解析错误响应
          try {
            const errorData = JSON.parse(jqXHR.responseText);
            if (errorData.status === "0" && errorData.info === "INVALID_PARAMS") {
              console.error("参数错误，请检查：");
              console.error("1. MCP配置中的API Key是否正确（Web服务Key）");
              console.error("2. 数据集ID是否存在");
              console.error("3. 属性字段名称是否正确（terminalId）");
              console.error("4. API Key是否有GeoHUB权限");
              console.error("5. 当前使用的Key:", webServiceKey ? `${webServiceKey.substring(0, 10)}...` : "未找到");
            }
          } catch (e) {
            // 忽略解析错误
          }
        });
    } catch (error) {
      console.error("绘制轨迹失败:", error);
    }
  };

  return (
    <div 
      className="w-full rounded-lg overflow-hidden border border-theme-sidebar-border relative" 
      style={{ 
        height: height, 
        minHeight: "300px",
        maxWidth: "100%",
        position: "relative",
        boxSizing: "border-box"
      }}
    >
      <div
        ref={mapRef}
        style={{ 
          width: "100%", 
          height: "100%", 
          minHeight: "300px",
          position: "relative",
          boxSizing: "border-box",
          overflow: "hidden"
        }}
        className="bg-gray-800"
      />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80 z-10 pointer-events-none">
          <div className="text-white/60">正在加载地图...</div>
        </div>
      )}
      {!apiKey && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-500/10 border border-red-500/30 z-10 pointer-events-none">
          <div className="text-red-400 text-sm text-center p-4">
            <p className="font-semibold mb-2">地图API Key未配置</p>
            <p className="text-xs">请在MCP设置中配置Web端API Key（用于地图显示）</p>
            <p className="text-xs mt-1">注意：Web服务API Key和Web端Key是不同的，请确保使用正确的Key类型</p>
          </div>
        </div>
      )}
    </div>
  );
}
