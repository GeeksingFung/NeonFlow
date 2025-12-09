
import React, { useState } from 'react';
import { VisualizerMode } from '../types';

interface ControlPanelProps {
  onStop: () => void;
  onTogglePiP: () => void;
  currentMode: VisualizerMode;
  onSetMode: (mode: VisualizerMode) => void;
  isPiPActive: boolean;
  colorShift: number;
  onColorChange: (val: number) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ 
  onStop, 
  onTogglePiP, 
  currentMode, 
  onSetMode,
  isPiPActive,
  colorShift,
  onColorChange
}) => {
  const [showColor, setShowColor] = useState(false);

  const getButtonClass = (mode: VisualizerMode, activeColorClass: string) => {
    const isActive = currentMode === mode;
    return `px-2 py-1 rounded text-xs font-bold transition-all whitespace-nowrap ${
      isActive ? `${activeColorClass} text-white shadow-sm scale-105` : 'text-gray-400 hover:text-white hover:bg-white/10'
    }`;
  };

  return (
    // ADJUSTMENT 4: Fixed bottom, full width, compressed height
    <div className="fixed bottom-0 left-0 w-full bg-black/80 backdrop-blur-md border-t border-white/10 z-50 flex flex-col justify-center pb-safe">
      
      {/* Color Slider - Appears above the bar when active to save height */}
      {showColor && (
        <div className="w-full px-4 py-2 bg-black/90 border-b border-white/5 animate-in slide-in-from-bottom-2 fade-in">
          <div className="flex items-center gap-3 w-full max-w-4xl mx-auto">
             <span className="text-xs text-gray-400 font-bold whitespace-nowrap">色相</span>
             <input 
                 type="range" 
                 min="0" 
                 max="360" 
                 value={colorShift} 
                 onChange={(e) => onColorChange(Number(e.target.value))}
                 className="flex-1 h-1.5 bg-gradient-to-r from-red-500 via-green-500 to-blue-500 rounded-lg appearance-none cursor-pointer outline-none"
             />
             <span className="text-xs text-gray-400 font-mono w-8 text-right">{colorShift}°</span>
          </div>
        </div>
      )}

      {/* Main Control Bar */}
      <div className="flex items-center justify-between px-4 py-2 gap-2 overflow-x-auto no-scrollbar w-full">
        
        {/* Mode Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 flex-nowrap">
          {/* Primary Group */}
          <div className="flex bg-white/5 rounded-lg p-0.5 gap-0.5 shrink-0">
            <button onClick={() => onSetMode(VisualizerMode.WATER_CIRCLE)} className={getButtonClass(VisualizerMode.WATER_CIRCLE, 'bg-teal-600')}>水墨圆</button>
            <button onClick={() => onSetMode(VisualizerMode.NEURAL)} className={getButtonClass(VisualizerMode.NEURAL, 'bg-blue-600')}>网络</button>
            <button onClick={() => onSetMode(VisualizerMode.CIRCULAR)} className={getButtonClass(VisualizerMode.CIRCULAR, 'bg-indigo-600')}>圆形</button>
            <button onClick={() => onSetMode(VisualizerMode.BARS)} className={getButtonClass(VisualizerMode.BARS, 'bg-pink-600')}>柱状</button>
            <button onClick={() => onSetMode(VisualizerMode.WAVE)} className={getButtonClass(VisualizerMode.WAVE, 'bg-cyan-600')}>波形</button>
          </div>

          {/* Secondary Group */}
          <div className="flex bg-white/5 rounded-lg p-0.5 gap-0.5 shrink-0">
            <button onClick={() => onSetMode(VisualizerMode.WATERCOLOR)} className={getButtonClass(VisualizerMode.WATERCOLOR, 'bg-purple-500')}>水彩</button>
            <button onClick={() => onSetMode(VisualizerMode.NEBULA)} className={getButtonClass(VisualizerMode.NEBULA, 'bg-fuchsia-600')}>星云</button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pl-4 border-l border-white/10 shrink-0">
          <button
              onClick={() => setShowColor(!showColor)}
              className={`p-1.5 rounded-full transition-all ${
                showColor ? 'bg-white text-black' : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="颜色"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a4 4 0 0 1 4 4c0 4-4 8-4 8s-4-4-4-8a4 4 0 0 1 4-4Z" opacity="0.5"/></svg>
          </button>

          <button
              onClick={onTogglePiP}
              className={`p-1.5 rounded-full transition-all ${
                  isPiPActive ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="画中画"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="10" width="10" height="7" rx="1" /><rect x="15" y="14" width="7" height="7" rx="1" /><path d="M12 17h10" /><path d="M12 7h10" /></svg>
          </button>

          <button
              onClick={onStop}
              className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded flex items-center gap-1 transition-all ml-1"
          >
            <span>停止</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
