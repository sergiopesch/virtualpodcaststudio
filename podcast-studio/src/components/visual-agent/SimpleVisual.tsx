"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Sparkles, 
  Maximize2, 
  X,
  Box,
  ArrowRight,
  Circle,
  Square,
  Triangle
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Simplified scene configuration - renders as SVG
export interface SimpleSceneConfig {
  type: "network" | "flowchart" | "layers" | "graph" | "architecture" | "comparison";
  title: string;
  description: string;
  elements: SimpleElement[];
  connections?: SimpleConnection[];
}

interface SimpleElement {
  id: string;
  type: "box" | "sphere" | "cylinder" | "node";
  label?: string;
  position: [number, number, number];
  size?: [number, number, number];
  color: string;
}

interface SimpleConnection {
  from: string;
  to: string;
  type: "line" | "arrow" | "curve" | "dashed";
  color?: string;
  label?: string;
  animated?: boolean;
}

// Convert 3D positions to 2D SVG coordinates
function to2D(pos: [number, number, number], width: number, height: number): { x: number; y: number } {
  // Simple isometric-ish projection
  const scale = 30;
  const centerX = width / 2;
  const centerY = height / 2;
  
  const x = centerX + (pos[0] - pos[2] * 0.5) * scale;
  const y = centerY + (pos[1] * -0.8 + pos[2] * 0.3) * scale;
  
  return { x, y };
}

// Get shape component based on type
function getShape(type: string, size: number, color: string) {
  switch (type) {
    case "sphere":
    case "node":
      return (
        <circle 
          r={size} 
          fill={color} 
          stroke="rgba(255,255,255,0.3)" 
          strokeWidth="2"
        />
      );
    case "cylinder":
      return (
        <ellipse 
          rx={size} 
          ry={size * 0.6} 
          fill={color} 
          stroke="rgba(255,255,255,0.3)" 
          strokeWidth="2"
        />
      );
    case "box":
    default:
      return (
        <rect 
          x={-size} 
          y={-size * 0.7} 
          width={size * 2} 
          height={size * 1.4} 
          rx={4}
          fill={color} 
          stroke="rgba(255,255,255,0.3)" 
          strokeWidth="2"
        />
      );
  }
}

interface SimpleVisualProps {
  config: SimpleSceneConfig;
  concept: string;
  className?: string;
  compact?: boolean;
}

export function SimpleVisual({ config, concept, className, compact = false }: SimpleVisualProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const width = compact ? 300 : 400;
  const height = compact ? 200 : 280;

  // Validate config
  if (!config || !config.elements || config.elements.length === 0) {
    return (
      <div className={cn("rounded-xl bg-black/20 p-4 text-center", className)}>
        <span className="text-white/40 text-sm">No visualization available</span>
      </div>
    );
  }

  // Build element position map for connections
  const elementPositions = new Map<string, { x: number; y: number }>();
  config.elements.forEach(el => {
    if (el.id && el.position) {
      const pos = Array.isArray(el.position) ? el.position : [0, 0, 0];
      elementPositions.set(el.id, to2D(pos as [number, number, number], width, height));
    }
  });

  return (
    <>
      <div className={cn(
        "relative rounded-xl overflow-hidden bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20",
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Box className="size-3.5 text-indigo-400" />
            <span className="text-xs font-medium text-white/70">{config.title || concept}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(true)}
            className="size-6 p-0 rounded-full hover:bg-white/10"
          >
            <Maximize2 className="size-3 text-white/50" />
          </Button>
        </div>

        {/* SVG Visualization */}
        <div className="p-2">
          <svg 
            width="100%" 
            height={height} 
            viewBox={`0 0 ${width} ${height}`}
            className="rounded-lg"
          >
            {/* Background gradient */}
            <defs>
              <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(99, 102, 241, 0.1)" />
                <stop offset="100%" stopColor="rgba(139, 92, 246, 0.1)" />
              </linearGradient>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.5)" />
              </marker>
            </defs>
            <rect width={width} height={height} fill="url(#bgGrad)" rx="8" />

            {/* Connections */}
            {config.connections?.map((conn, idx) => {
              const from = elementPositions.get(conn.from);
              const to = elementPositions.get(conn.to);
              if (!from || !to) return null;

              const color = conn.color || "rgba(255,255,255,0.3)";
              const isAnimated = conn.animated;
              const isDashed = conn.type === "dashed";
              const hasArrow = conn.type === "arrow";

              return (
                <g key={idx}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={color}
                    strokeWidth="2"
                    strokeDasharray={isDashed || isAnimated ? "5,5" : undefined}
                    markerEnd={hasArrow ? "url(#arrowhead)" : undefined}
                    className={isAnimated ? "animate-pulse" : ""}
                  />
                  {conn.label && (
                    <text
                      x={(from.x + to.x) / 2}
                      y={(from.y + to.y) / 2 - 8}
                      fill="rgba(255,255,255,0.6)"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      {conn.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Elements */}
            {config.elements.map((el, idx) => {
              const pos = elementPositions.get(el.id);
              if (!pos) return null;

              const size = el.size ? (el.size[0] + el.size[1]) / 2 * 8 : 20;
              const color = el.color || "#6366f1";

              return (
                <g key={el.id || idx} transform={`translate(${pos.x}, ${pos.y})`}>
                  {getShape(el.type, size, color)}
                  {el.label && (
                    <text
                      y={size + 14}
                      fill="rgba(255,255,255,0.8)"
                      fontSize="11"
                      textAnchor="middle"
                      fontWeight="500"
                    >
                      {el.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Description */}
        {config.description && (
          <div className="px-3 pb-2">
            <p className="text-[10px] text-white/50">{config.description}</p>
          </div>
        )}
      </div>

      {/* Expanded Modal */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsExpanded(false)}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="absolute -top-12 right-0 text-white/70 hover:text-white"
            >
              <X className="size-5 mr-1" />
              Close
            </Button>
            
            <div className="bg-black/50 rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-2">{config.title || concept}</h3>
              <p className="text-sm text-white/60 mb-4">{config.description}</p>
              
              <svg 
                width="100%" 
                height="500" 
                viewBox={`0 0 600 400`}
                className="rounded-xl bg-black/30"
              >
                <defs>
                  <linearGradient id="bgGradLarge" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(99, 102, 241, 0.15)" />
                    <stop offset="100%" stopColor="rgba(139, 92, 246, 0.15)" />
                  </linearGradient>
                  <marker
                    id="arrowheadLarge"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.5)" />
                  </marker>
                </defs>
                <rect width="600" height="400" fill="url(#bgGradLarge)" rx="12" />

                {/* Connections - larger view */}
                {config.connections?.map((conn, idx) => {
                  const from = to2D(
                    config.elements.find(e => e.id === conn.from)?.position as [number, number, number] || [0,0,0],
                    600, 400
                  );
                  const to = to2D(
                    config.elements.find(e => e.id === conn.to)?.position as [number, number, number] || [0,0,0],
                    600, 400
                  );

                  const color = conn.color || "rgba(255,255,255,0.4)";
                  const hasArrow = conn.type === "arrow";

                  return (
                    <line
                      key={idx}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={color}
                      strokeWidth="2"
                      markerEnd={hasArrow ? "url(#arrowheadLarge)" : undefined}
                    />
                  );
                })}

                {/* Elements - larger view */}
                {config.elements.map((el, idx) => {
                  const pos = to2D(el.position as [number, number, number] || [0,0,0], 600, 400);
                  const size = el.size ? (el.size[0] + el.size[1]) / 2 * 12 : 30;
                  const color = el.color || "#6366f1";

                  return (
                    <g key={el.id || idx} transform={`translate(${pos.x}, ${pos.y})`}>
                      {getShape(el.type, size, color)}
                      {el.label && (
                        <text
                          y={size + 18}
                          fill="rgba(255,255,255,0.9)"
                          fontSize="13"
                          textAnchor="middle"
                          fontWeight="500"
                        >
                          {el.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

