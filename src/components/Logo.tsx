import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export default function Logo({ className = "w-12 h-12", showText = false }: LogoProps) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className} ${showText ? '!h-auto' : ''}`}>
      <div className={`relative w-full flex items-center justify-center ${showText ? 'aspect-square' : 'h-full'}`}>
        <img 
          src="https://neuronyx.aiktc.ac.in/neuronyx.png" 
          alt="NeurOnyx Logo" 
          className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(0,210,255,0.3)]"
          referrerPolicy="no-referrer"
        />
      </div>
      
      {showText && (
        <div className="text-center mt-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-[0.3em] text-white flex items-center justify-center">
            NEURONYX
          </h1>
        </div>
      )}
    </div>
  );
}
