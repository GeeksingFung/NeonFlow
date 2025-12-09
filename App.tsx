import React, { useState, useEffect, useCallback } from 'react';
import { audioService } from './services/audioService';
import VisualizerCanvas from './components/VisualizerCanvas';
import ControlPanel from './components/ControlPanel';
import { VisualizerMode } from './types';

const App: React.FC = () => {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<VisualizerMode>(VisualizerMode.WATER_CIRCLE);
  const [pipVideoElement, setPipVideoElement] = useState<HTMLVideoElement | null>(null);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [colorShift, setColorShift] = useState(0);

  const startCapture = async () => {
    setError(null);
    try {
      // 1. Get Stream
      const stream = await audioService.startSystemCapture();
      
      // 2. Setup Audio Context
      const node = audioService.setupAudioContext(stream);
      setAnalyser(node);
      setIsCapturing(true);

      // Listener for stream end (e.g. user clicks "Stop Sharing" in browser chrome)
      stream.getVideoTracks()[0].onended = () => {
        stopCapture();
      };
    } catch (err: any) {
      console.error(err);
      if (err.message === "NO_AUDIO_TRACK") {
        setError("未检测到音频。请重试，并务必在屏幕共享窗口勾选 '分享音频' (Share Audio)。\n注意：MacOS 用户可能需要选择 '标签页' (Chrome Tab) 才能分享音频。");
      } else if (err.message && err.message.includes("permissions policy")) {
        setError("访问被拒绝：当前环境不允许 'display-capture' (屏幕录制)。请刷新页面或检查环境权限设置。");
      } else if (err.name === "NotAllowedError") {
        setError("操作已取消：您拒绝了屏幕共享权限。");
      } else {
        setError(`无法启动音频捕获: ${err.message || "未知错误"}`);
      }
    }
  };

  const stopCapture = useCallback(() => {
    // If PiP is active, exit it
    if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(console.error);
    }
    
    audioService.cleanup();
    setAnalyser(null);
    setIsCapturing(false);
    setIsPiPActive(false);
  }, []);

  const togglePiP = async () => {
    if (!pipVideoElement) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else {
        await pipVideoElement.requestPictureInPicture();
        setIsPiPActive(true);
      }
    } catch (err) {
      console.error("Failed to toggle PiP", err);
      // Fallback or specific error handling (e.g., PiP disabled)
      alert("无法启动画中画模式。请确保浏览器支持该功能。");
    }
  };

  // Monitor PiP changes externally (e.g. user closes PiP via 'X')
  useEffect(() => {
    const handlePiPChange = () => {
        if (!document.pictureInPictureElement) {
            setIsPiPActive(false);
        } else {
            setIsPiPActive(true);
        }
    };
    
    if (pipVideoElement) {
        pipVideoElement.addEventListener('enterpictureinpicture', handlePiPChange);
        pipVideoElement.addEventListener('leavepictureinpicture', handlePiPChange);
    }

    return () => {
        if (pipVideoElement) {
            pipVideoElement.removeEventListener('enterpictureinpicture', handlePiPChange);
            pipVideoElement.removeEventListener('leavepictureinpicture', handlePiPChange);
        }
    };
  }, [pipVideoElement]);

  // Determine text color for the DOM overlay based on mode (if capturing)
  const isLightMode = [VisualizerMode.NEURAL, VisualizerMode.WATERCOLOR, VisualizerMode.WATER_CIRCLE].includes(mode);
  // If capturing and in light mode, use dark text. Otherwise (Dark mode OR Landing page), use light text.
  const watermarkColorClass = (isCapturing && isLightMode) ? 'text-black/40' : 'text-white/40';

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-hidden relative">
      {!isCapturing ? (
        // --- Landing Screen ---
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center z-10 relative">
          
          {/* Background decoration */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-30">
             <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-[128px] animate-pulse"></div>
             <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600 rounded-full mix-blend-screen filter blur-[128px] animate-pulse" style={{animationDelay: '1s'}}></div>
          </div>

          <h1 className="text-5xl md:text-7xl font-black mb-6 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 text-transparent bg-clip-text drop-shadow-lg">
            NeonFlow
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mb-12 leading-relaxed">
            系统音频可视化工具
            <br/>
            <span className="text-sm md:text-base text-gray-500">
                支持调整窗口大小 • 画中画置顶 • 动感色彩
            </span>
          </p>

          <button
            onClick={startCapture}
            className="group relative px-8 py-4 bg-white text-black font-bold text-lg rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_40px_rgba(255,255,255,0.6)] transition-all duration-300 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              开始捕获系统音频
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-200 to-blue-200 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>

          {error && (
            <div className="mt-8 p-4 bg-red-500/20 border border-red-500/50 rounded-lg max-w-md text-red-200 animate-bounce whitespace-pre-line">
              <p className="font-bold">Error:</p>
              <p>{error}</p>
            </div>
          )}

          <div className="mt-12 text-sm text-gray-500 max-w-md bg-white/5 p-4 rounded-xl border border-white/10">
            <p className="font-semibold mb-2 text-gray-300">⚠️ 重要提示：</p>
            <ul className="text-left space-y-2 list-disc pl-5">
              <li>点击按钮后，浏览器会弹出屏幕共享窗口。</li>
              <li>请选择 <strong>"整个屏幕"</strong> 或包含音频的 <strong>"标签页"</strong>。</li>
              <li><span className="text-pink-400 font-bold">务必勾选左下角的 "分享音频" (Share Audio) 复选框</span>。</li>
              <li className="text-xs text-gray-600">MacOS 用户如果无法在 "整个屏幕" 勾选音频，请尝试使用 "标签页" 共享。</li>
            </ul>
          </div>
        </div>
      ) : (
        // --- Visualizer Screen ---
        <div className="w-screen h-screen relative">
          {analyser && (
            <VisualizerCanvas 
              analyser={analyser} 
              mode={mode}
              onPiPRequest={setPipVideoElement}
              colorShift={colorShift}
            />
          )}
          
          <ControlPanel 
            onStop={stopCapture}
            onTogglePiP={togglePiP}
            currentMode={mode}
            onSetMode={setMode}
            isPiPActive={isPiPActive}
            colorShift={colorShift}
            onColorChange={setColorShift}
          />
        </div>
      )}

      {/* 
        Persistent Watermark (Main Window)
        - On Landing: Bottom-right corner.
        - On Visualizer: Raised to `bottom-20` to sit *above* the Control Panel. 
        - Note: The PiP window gets its watermark from the Canvas drawing.
      */}
      <div className={`fixed z-[60] font-bold text-sm pointer-events-none transition-all duration-500 ${watermarkColorClass} ${isCapturing ? 'bottom-20 right-4' : 'bottom-6 right-6'}`}>
        Idea by Geeksing
      </div>

    </div>
  );
};

export default App;