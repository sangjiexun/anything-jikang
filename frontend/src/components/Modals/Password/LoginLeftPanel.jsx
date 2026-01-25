import React, { useEffect, useRef, useState } from "react";

// 轮播文案
const carouselTexts = [
  {
    zh: "新一代可信可用可交换的智能体",
    en: "Trustworthy, Usable & Exchangeable AI",
  },
  {
    zh: "我们不生产垃圾数据，只创造极致信用",
    en: "No Garbage Data, Only Ultimate Credit",
  },
  {
    zh: "用数据讲好中国故事",
    en: "Tell China's Story with Data",
  },
];

export default function LoginLeftPanel() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayedText, setDisplayedText] = useState(carouselTexts[0].zh);
  const [displayedEnText, setDisplayedEnText] = useState(carouselTexts[0].en);

  // 文字轮播动画
  useEffect(() => {
    const DISPLAY_DURATION = 4000; // 每个文案显示4秒
    const TRANSITION_DURATION = 600; // 翻页过渡时间

    const timer = setInterval(() => {
      setIsTransitioning(true);

      setTimeout(() => {
        setCurrentIndex((prev) => {
          const nextIndex = (prev + 1) % carouselTexts.length;
          setDisplayedText(carouselTexts[nextIndex].zh);
          setDisplayedEnText(carouselTexts[nextIndex].en);
          return nextIndex;
        });

        setTimeout(() => {
          setIsTransitioning(false);
        }, 50);
      }, TRANSITION_DURATION);
    }, DISPLAY_DURATION);

    return () => clearInterval(timer);
  }, []);

  // 网格波浪动画 (纯 Canvas 实现，不依赖 THREE.js)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let time = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    window.addEventListener("resize", resize);

    // 网格参数
    const gridSize = 30;
    const cols = Math.ceil(canvas.offsetWidth / gridSize) + 2;
    const rows = Math.ceil(canvas.offsetHeight / gridSize) + 2;

    const animate = () => {
      time += 0.015;
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // 绘制网格波浪
      ctx.strokeStyle = "rgba(212, 175, 55, 0.15)";
      ctx.lineWidth = 0.5;

      // 水平线
      for (let i = 0; i <= rows; i++) {
        ctx.beginPath();
        for (let j = 0; j <= cols; j++) {
          const x = j * gridSize;
          const baseY = i * gridSize;
          const wave =
            Math.sin(x * 0.02 + time) * 8 +
            Math.sin(x * 0.01 + time * 0.5) * 5 +
            Math.cos(i * 0.1 + time * 0.8) * 3;
          const y = baseY + wave;

          if (j === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // 垂直线
      for (let j = 0; j <= cols; j++) {
        ctx.beginPath();
        for (let i = 0; i <= rows; i++) {
          const baseX = j * gridSize;
          const y = i * gridSize;
          const wave =
            Math.sin(y * 0.02 + time * 0.8) * 5 +
            Math.cos(j * 0.1 + time) * 3;
          const x = baseX + wave;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // 绘制发光节点
      ctx.fillStyle = "rgba(212, 175, 55, 0.4)";
      for (let i = 0; i <= rows; i += 3) {
        for (let j = 0; j <= cols; j += 3) {
          const baseX = j * gridSize;
          const baseY = i * gridSize;
          const waveX =
            Math.sin(baseY * 0.02 + time * 0.8) * 5 +
            Math.cos(j * 0.1 + time) * 3;
          const waveY =
            Math.sin(baseX * 0.02 + time) * 8 +
            Math.sin(baseX * 0.01 + time * 0.5) * 5 +
            Math.cos(i * 0.1 + time * 0.8) * 3;

          const x = baseX + waveX;
          const y = baseY + waveY;

          const pulse = Math.sin(time * 2 + i + j) * 0.3 + 0.7;
          ctx.globalAlpha = pulse * 0.6;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // 绘制漂浮粒子
      for (let i = 0; i < 30; i++) {
        const px =
          ((Math.sin(time * 0.3 + i * 2.5) + 1) / 2) * canvas.offsetWidth;
        const py =
          ((Math.cos(time * 0.2 + i * 1.8) + 1) / 2) * canvas.offsetHeight;
        const size = Math.sin(time + i) * 1.5 + 2;
        const alpha = Math.sin(time * 0.5 + i) * 0.3 + 0.4;

        ctx.fillStyle = `rgba(212, 175, 55, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="hidden md:flex md:w-1/2 md:h-full relative overflow-hidden bg-[#050505]">
      {/* 网格波浪背景 */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.8 }}
      />

      {/* 径向渐变遮罩 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(5,5,5,0.8) 100%)",
        }}
      />

      {/* Logo */}
      <div className="absolute top-8 left-8 z-20">
        <svg
          width="200"
          height="80"
          viewBox="0 0 800 320"
          className="h-16 w-auto"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              id="loginGoldGradient"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" style={{ stopColor: "#FDF5D8" }} />
              <stop offset="30%" style={{ stopColor: "#D4B776" }} />
              <stop offset="60%" style={{ stopColor: "#F5E6B7" }} />
              <stop offset="100%" style={{ stopColor: "#9C8449" }} />
            </linearGradient>
            <linearGradient
              id="loginSilverGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" style={{ stopColor: "#E8E8E8" }} />
              <stop offset="50%" style={{ stopColor: "#A0A0A0" }} />
              <stop offset="100%" style={{ stopColor: "#D0D0D0" }} />
            </linearGradient>
          </defs>
          <g transform="translate(50, 40)">
            <text
              x="0"
              y="160"
              fontFamily="'Microsoft YaHei', 'SimHei', sans-serif"
              fontWeight="900"
              fontSize="180"
              fill="url(#loginGoldGradient)"
              stroke="#ACA390"
              strokeWidth="3"
            >
              极
            </text>
            <text
              x="180"
              y="160"
              fontFamily="'Microsoft YaHei', 'SimHei', sans-serif"
              fontWeight="900"
              fontSize="180"
              fill="url(#loginSilverGradient)"
              stroke="#555"
              strokeWidth="3"
            >
              康
            </text>
            <text
              x="380"
              y="160"
              fontFamily="Arial, sans-serif"
              fontWeight="bold"
              fontSize="140"
              fill="url(#loginGoldGradient)"
              stroke="#ACA390"
              strokeWidth="2"
            >
              AI
            </text>
          </g>
          <text
            x="100"
            y="290"
            fontFamily="Arial, sans-serif"
            fontWeight="bold"
            fontSize="32"
            fill="url(#loginGoldGradient)"
            letterSpacing="4"
          >
            JIKANG AI TECHNOLOGY
          </text>
        </svg>
      </div>

      {/* 文字轮播区域 */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full px-8">
        <div className="text-center">
          {/* 中文标题 */}
          <div
            className={`transition-all duration-500 ease-in-out ${
              isTransitioning
                ? "opacity-0 translate-y-5"
                : "opacity-100 translate-y-0"
            }`}
            style={{
              fontSize: "clamp(32px, 5vw, 72px)",
              fontWeight: 700,
              letterSpacing: "4px",
              fontFamily: "'Microsoft YaHei', '微软雅黑', sans-serif",
              lineHeight: 1.3,
              background: "linear-gradient(to bottom, #f0e6d2, #d4c5a3)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              whiteSpace: "nowrap",
            }}
          >
            {displayedText}
          </div>

          {/* 英文翻译 */}
          <div
            className={`mt-6 transition-all duration-500 ease-in-out ${
              isTransitioning
                ? "opacity-0 translate-y-5"
                : "opacity-100 translate-y-0"
            }`}
            style={{
              fontSize: "clamp(14px, 2vw, 24px)",
              letterSpacing: "3px",
              color: "rgba(212, 175, 55, 0.85)",
              fontWeight: 300,
              fontFamily: "Arial, Helvetica, sans-serif",
            }}
          >
            {displayedEnText}
          </div>
        </div>
      </div>

      {/* 底部版权 */}
      <div className="absolute bottom-6 left-0 right-0 text-center z-20">
        <span
          className="text-xs tracking-widest uppercase"
          style={{ color: "#888888" }}
        >
          Powered by JiKang AI Technology
        </span>
      </div>
    </div>
  );
}
