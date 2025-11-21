"use client";

import React from "react";
import { Clock, Search } from "lucide-react";

interface HeaderProps {
  title: string;
  description: string;
  status?: {
    label: string;
    color: "green" | "red" | "yellow" | "blue" | "gray";
    active: boolean;
  };
  timer?: {
    duration: number;
    format: (seconds: number) => string;
  };
  progress?: {
    value: number;
    label?: string;
  };
  actions?: React.ReactNode;
  search?: {
    placeholder: string;
    onSearch?: (query: string) => void;
  };
}

export function Header({
  title,
  description,
  status,
  timer,
  progress,
  actions,
  search
}: HeaderProps) {
  const getStatusColor = (color: string, active: boolean) => {
    const colors = {
      green: active ? 'bg-white shadow-glow' : 'bg-white/20',
      red: active ? 'bg-white shadow-glow animate-pulse' : 'bg-white/20', // Monochrome pulse
      yellow: active ? 'bg-white/80' : 'bg-white/20',
      blue: active ? 'bg-white' : 'bg-white/20',
      gray: 'bg-white/10'
    };
    return colors[color as keyof typeof colors] || 'bg-white/10';
  };

  const searchInputId = React.useId();

  return (
    <header className="glass-panel-light border-b border-white/5 px-8 py-5 sticky top-0 z-40 backdrop-blur-xl">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white leading-tight">
              {title}
            </h1>
            <p className="text-sm text-white/50 mt-1 font-light">
              {description}
            </p>
          </div>

          {status && (
            <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <div className={`size-2 rounded-full transition-all duration-500 ${getStatusColor(status.color, status.active)}`} />
              <span className="text-xs font-medium text-white tracking-wide uppercase">
                {status.label}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          {timer && (
            <div className="flex items-center gap-3 text-sm font-mono bg-black/40 px-4 py-2 rounded-xl border border-white/5 shadow-inner">
              <Clock className="size-3.5 text-white/40" />
              <span className="text-white font-medium tracking-wider">{timer.format(timer.duration)}</span>
            </div>
          )}

          {progress && (
            <div className="flex items-center gap-4 min-w-[160px]">
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-700 ease-apple shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                  style={{ width: `${progress.value}%` }}
                />
              </div>
              <span className="text-xs text-white/60 font-medium w-8 text-right">
                {progress.label || `${Math.round(progress.value)}%`}
              </span>
            </div>
          )}

          {search && (
            <div className="relative group">
              <label htmlFor={searchInputId} className="sr-only">
                {search.placeholder}
              </label>
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/40 group-focus-within:text-white transition-colors duration-300"
                aria-hidden="true"
              />
              <input
                id={searchInputId}
                type="search"
                inputMode="search"
                placeholder={search.placeholder}
                className="w-72 rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 transition-all duration-300 focus:bg-white/10 focus:border-white/20 focus:ring-0 outline-none hover:bg-white/10"
                onChange={(e) => search.onSearch?.(e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            {actions}
          </div>
        </div>
      </div>
    </header>
  );
}
