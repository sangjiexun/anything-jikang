import React, { useEffect, useRef, useState } from "react";

export default function AmapViewer({ apiKey, center, zoom = 13, height = "400px" }) {
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapInstanceRef = useRef(null);
  const locaInstanceRef = useRef(null);

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

        return map;
      })
      .catch((error) => {
        console.error("Failed to load Amap:", error);
      });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, [apiKey, center, zoom]);

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
