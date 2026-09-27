import React, { useState } from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export default function Logo({ className = "w-12 h-12", showText = false }: LogoProps) {
  const [imgSrc, setImgSrc] = useState('/logo.png');

  return (
    <div className={`flex flex-col items-center gap-2 ${className} ${showText ? '!h-auto' : ''}`}>
      <div className={`relative w-full aspect-square flex items-center justify-center rounded-full overflow-hidden border border-brand-accent/30 bg-brand-bg/60 shadow-[0_0_15px_rgba(0,210,255,0.2)] shrink-0 ${showText ? '' : 'h-full'}`}>
        <img 
          src={imgSrc} 
          alt="NeurOnyx Logo" 
          className="w-full h-full object-cover rounded-full"
          referrerPolicy="no-referrer"
          onError={() => {
            if (imgSrc === '/logo.png') {
              setImgSrc('https://neuronyx.aiktc.ac.in/logo.png');
            }
          }}
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
