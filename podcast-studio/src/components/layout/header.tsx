"use client";

import React from "react";
import { Clock, Search } from "lucide-react";
import { UserMenu } from "./user-menu";

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
      green: active ? 'bg-green-500' : 'bg-gray-300',
      red: active ? 'bg-red-500' : 'bg-gray-300', 
      yellow: active ? 'bg-yellow-500' : 'bg-gray-300',
      blue: active ? 'bg-blue-500' : 'bg-gray-300',
      gray: 'bg-gray-300'
    };
    return colors[color as keyof typeof colors] || 'bg-gray-300';
  };

  const getStatusTextColor = (color: string, active: boolean) => {
    const colors = {
      green: active ? 'text-green-600' : 'text-gray-500',
      red: active ? 'text-red-600' : 'text-gray-500',
      yellow: active ? 'text-yellow-600' : 'text-gray-500', 
      blue: active ? 'text-blue-600' : 'text-gray-500',
      gray: 'text-gray-500'
    };
    return colors[color as keyof typeof colors] || 'text-gray-500';
  };

  const searchInputId = React.useId();

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 px-6 py-5 sticky top-0 z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {title}
            </h1>
            <p className="text-gray-600 text-sm">
              {description}
            </p>
          </div>
          
          {status && (
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(status.color, status.active)} animate-pulse`}></div>
              <span className={`text-sm font-medium ${getStatusTextColor(status.color, status.active)}`}>
                {status.label}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {timer && (
            <div className="flex items-center space-x-2 text-sm font-mono bg-gray-50 px-3 py-2 rounded-lg">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{timer.format(timer.duration)}</span>
            </div>
          )}
          
          {progress && (
            <div className="flex items-center space-x-3">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div
                  className="gradient-primary h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress.value}%` }}
                ></div>
              </div>
              <span className="text-xs text-gray-500 font-medium">
                {progress.label || `${Math.round(progress.value)}%`}
              </span>
            </div>
          )}
          
          {search && (
            <div className="relative">
              <label htmlFor={searchInputId} className="sr-only">
                {search.placeholder}
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                id={searchInputId}
                type="search"
                inputMode="search"
                placeholder={search.placeholder}
                className="w-48 rounded-lg border border-gray-300 bg-white/60 pl-10 pr-4 py-2 text-base text-gray-900 shadow-sm transition focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none sm:w-64"
                onChange={(e) => search.onSearch?.(e.target.value)}
              />
            </div>
          )}

          {actions}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
