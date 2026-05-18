import React, { ReactNode, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: ReactNode;
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  delay?: number;
}

export function Tooltip({ children, text, position = 'top', className = '', delay = 4000 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: -9999, left: -9999 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const elRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const calculatePosition = () => {
    if (!elRef.current || !tooltipRef.current) return;
    const targetRect = elRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    
    let top = 0;
    let left = 0;
    const margin = 12;

    if (position === 'top') {
      top = targetRect.top - tooltipRect.height - margin;
      left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
    } else if (position === 'bottom') {
      top = targetRect.bottom + margin;
      left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
    } else if (position === 'left') {
      top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
      left = targetRect.left - tooltipRect.width - margin;
    } else if (position === 'right') {
      top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
      left = targetRect.right + margin;
    }

    // Viewport clamping
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    if (left < margin) left = margin;
    if (left + tooltipRect.width > vw - margin) left = vw - tooltipRect.width - margin;
    if (top < margin) {
      if (position === 'top') top = targetRect.bottom + margin;
      else top = margin;
    }
    if (top + tooltipRect.height > vh - margin) {
      if (position === 'bottom') top = targetRect.top - tooltipRect.height - margin;
      else top = vh - tooltipRect.height - margin;
    }

    setCoords({ top, left });
  };

  useLayoutEffect(() => {
    if (isVisible) {
      calculatePosition();
    } else {
      setCoords({ top: -9999, left: -9999 });
    }
  }, [isVisible, text]);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  const handleClick = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      if (isVisible) calculatePosition();
    };
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isVisible]);

  return (
    <div 
      className={`relative inline-flex items-center justify-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      ref={elRef}
    >
      {children}
      {isVisible && createPortal(
        <div 
          ref={tooltipRef}
          style={{
            top: coords.top,
            left: coords.left,
            opacity: coords.top !== -9999 ? 1 : 0,
          }}
          className="fixed z-[9999] px-4 py-3 text-[10px] md:text-xs font-mono text-accent bg-panel/95 backdrop-blur-md border border-border-color rounded-xl shadow-2xl transition-opacity duration-200 pointer-events-none w-max max-w-[280px] md:max-w-xs break-words leading-relaxed normal-case"
        >
          {text}
        </div>,
        document.body
      )}
    </div>
  );
}
