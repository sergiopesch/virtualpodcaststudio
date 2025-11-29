"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Maximize2, X, RotateCcw, Loader2 } from "lucide-react";

// Scene configuration types
export interface ThreeJsSceneConfig {
  type: "network" | "flowchart" | "layers" | "particles" | "graph" | "architecture" | "comparison";
  title: string;
  description: string;
  elements: SceneElement[];
  connections?: Connection[];
  animation?: AnimationConfig;
  camera?: CameraConfig;
  lighting?: LightingConfig;
}

interface SceneElement {
  id: string;
  type: "box" | "sphere" | "cylinder" | "plane" | "text" | "arrow" | "group";
  label?: string;
  position: [number, number, number];
  size?: [number, number, number];
  color: string;
  opacity?: number;
  children?: SceneElement[];
}

interface Connection {
  from: string;
  to: string;
  type: "line" | "arrow" | "curve" | "dashed";
  color?: string;
  label?: string;
  animated?: boolean;
}

interface AnimationConfig {
  type: "rotate" | "pulse" | "flow" | "highlight" | "none";
  speed?: number;
  loop?: boolean;
}

interface CameraConfig {
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
}

interface LightingConfig {
  ambient: number;
  directional?: { position: [number, number, number]; intensity: number };
}

// Helper to safely parse position
function safePosition(pos: unknown): [number, number, number] {
  if (Array.isArray(pos) && pos.length >= 3) {
    return [Number(pos[0]) || 0, Number(pos[1]) || 0, Number(pos[2]) || 0];
  }
  return [0, 0, 0];
}

// Helper to safely parse size
function safeSize(size: unknown): [number, number, number] {
  if (Array.isArray(size) && size.length >= 3) {
    return [Number(size[0]) || 1, Number(size[1]) || 1, Number(size[2]) || 1];
  }
  if (Array.isArray(size) && size.length >= 1) {
    const val = Number(size[0]) || 1;
    return [val, size[1] !== undefined ? Number(size[1]) || val : val, size[2] !== undefined ? Number(size[2]) || val : val];
  }
  return [1, 1, 1];
}

// Individual element renderer
function SceneElementMesh({ element, elementsMap }: { element: SceneElement; elementsMap: Map<string, THREE.Vector3> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Safely parse position and size with defaults
  const position = useMemo(() => safePosition(element.position), [element.position]);
  const size = useMemo(() => safeSize(element.size), [element.size]);
  const color = element.color || "#4a90d9";
  const opacity = element.opacity ?? 0.9;

  // Store position for connections
  useEffect(() => {
    if (element.id) {
      elementsMap.set(element.id, new THREE.Vector3(position[0], position[1], position[2]));
    }
  }, [element.id, position, elementsMap]);

  // Subtle hover animation
  useFrame(() => {
    if (meshRef.current) {
      if (hovered) {
        meshRef.current.scale.lerp(new THREE.Vector3(1.1, 1.1, 1.1), 0.1);
      } else {
        meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      }
    }
  });

  const geometry = useMemo(() => {
    switch (element.type) {
      case "sphere":
        return <sphereGeometry args={[size[0] / 2, 32, 32]} />;
      case "cylinder":
        return <cylinderGeometry args={[size[0] / 2, size[0] / 2, size[1], 32]} />;
      case "plane":
        return <planeGeometry args={[size[0], size[1]]} />;
      case "box":
      default:
        return <boxGeometry args={size} />;
    }
  }, [element.type, size]);

  if (element.type === "text") {
    return (
      <Text
        position={position}
        fontSize={0.3}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {element.label || ""}
      </Text>
    );
  }

  if (element.type === "group" && element.children) {
    return (
      <group position={position}>
        {element.children.map((child) => (
          <SceneElementMesh key={child.id} element={child} elementsMap={elementsMap} />
        ))}
      </group>
    );
  }

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {geometry}
        <meshStandardMaterial
          color={color}
          transparent={opacity < 1}
          opacity={opacity}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
      {element.label && (
        <Html
          position={[0, (size[1] || 1) / 2 + 0.3, 0]}
          center
          style={{
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <div className="px-2 py-1 bg-black/70 rounded text-white text-xs whitespace-nowrap">
            {element.label}
          </div>
        </Html>
      )}
    </group>
  );
}

// Connection renderer
function ConnectionLine({ 
  connection, 
  elementsMap 
}: { 
  connection: Connection; 
  elementsMap: Map<string, THREE.Vector3>;
}) {
  const lineRef = useRef<THREE.Line>(null);
  const [points, setPoints] = useState<THREE.Vector3[]>([]);

  useEffect(() => {
    const fromPos = elementsMap.get(connection.from);
    const toPos = elementsMap.get(connection.to);
    
    if (fromPos && toPos) {
      if (connection.type === "curve") {
        // Create a curved path
        const midPoint = new THREE.Vector3()
          .addVectors(fromPos, toPos)
          .multiplyScalar(0.5);
        midPoint.y += 1; // Curve upward
        
        const curve = new THREE.QuadraticBezierCurve3(fromPos, midPoint, toPos);
        setPoints(curve.getPoints(20));
      } else {
        setPoints([fromPos.clone(), toPos.clone()]);
      }
    }
  }, [connection, elementsMap]);

  // Animate flow
  useFrame(() => {
    if (connection.animated && lineRef.current) {
      const material = lineRef.current.material as THREE.LineDashedMaterial;
      if (material.dashOffset !== undefined) {
        material.dashOffset -= 0.02;
      }
    }
  });

  if (points.length < 2) return null;

  const color = connection.color || "#ffffff";

  return (
    <Line
      ref={lineRef}
      points={points}
      color={color}
      lineWidth={2}
      dashed={connection.type === "dashed" || connection.animated}
      dashScale={connection.animated ? 5 : 1}
      dashSize={0.5}
      gapSize={0.2}
    />
  );
}

// Animated scene container
function AnimatedScene({ 
  config, 
  elementsMap 
}: { 
  config: ThreeJsSceneConfig; 
  elementsMap: Map<string, THREE.Vector3>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current && config.animation?.type === "rotate") {
      const speed = config.animation.speed || 0.5;
      groupRef.current.rotation.y += 0.002 * speed;
    }
  });

  // Filter out invalid elements (must have id and valid type)
  const validElements = useMemo(() => {
    if (!Array.isArray(config.elements)) return [];
    return config.elements.filter(el => el && el.id && el.type);
  }, [config.elements]);

  // Filter out invalid connections
  const validConnections = useMemo(() => {
    if (!Array.isArray(config.connections)) return [];
    return config.connections.filter(conn => conn && conn.from && conn.to);
  }, [config.connections]);

  return (
    <group ref={groupRef}>
      {validElements.map((element) => (
        <SceneElementMesh key={element.id} element={element} elementsMap={elementsMap} />
      ))}
      {validConnections.map((connection, idx) => (
        <ConnectionLine key={idx} connection={connection} elementsMap={elementsMap} />
      ))}
    </group>
  );
}

// Camera controller
function CameraController({ config }: { config?: CameraConfig }) {
  const { camera } = useThree();

  useEffect(() => {
    const pos = safePosition(config?.position);
    const target = safePosition(config?.target);
    
    // Use default camera position if not specified
    if (!config?.position) {
      camera.position.set(5, 5, 8);
    } else {
      camera.position.set(pos[0], pos[1], pos[2]);
    }
    
    camera.lookAt(target[0], target[1], target[2]);
  }, [camera, config]);

  return null;
}

// Scene lighting component with safe position handling
function SceneLighting({ config }: { config?: LightingConfig }) {
  const directionalPos = useMemo(() => {
    if (config?.directional?.position) {
      return safePosition(config.directional.position);
    }
    return [5, 10, 5] as [number, number, number];
  }, [config?.directional?.position]);

  return (
    <>
      <ambientLight intensity={config?.ambient || 0.4} />
      {config?.directional && (
        <directionalLight
          position={directionalPos}
          intensity={config.directional.intensity || 0.8}
          castShadow
        />
      )}
      <pointLight position={[10, 10, 10]} intensity={0.5} />
    </>
  );
}

// Canvas-only component (used inside VisualCard)
interface ThreeJsCanvasProps {
  config: ThreeJsSceneConfig;
  className?: string;
}

export function ThreeJsCanvas({ config, className }: ThreeJsCanvasProps) {
  const elementsMap = useMemo(() => new Map<string, THREE.Vector3>(), []);

  // Validate config has required fields
  if (!config || !config.elements) {
    return (
      <div className={cn("relative h-[280px] flex items-center justify-center bg-black/40 rounded-xl", className)}>
        <span className="text-white/40 text-sm">Invalid scene configuration</span>
      </div>
    );
  }

  return (
    <div className={cn("relative h-[280px]", className)}>
      <Canvas
        camera={{ fov: config.camera?.fov || 60 }}
        style={{ background: "transparent" }}
      >
        <CameraController config={config.camera} />
        <OrbitControls 
          enableZoom={true} 
          enablePan={true} 
          minDistance={3}
          maxDistance={20}
          autoRotate={config.animation?.type === "rotate"}
          autoRotateSpeed={1}
        />
        
        <SceneLighting config={config.lighting} />
        
        {/* Scene */}
        <AnimatedScene config={config} elementsMap={elementsMap} />
        
        {/* Grid helper for context */}
        <gridHelper args={[10, 10, "#333333", "#222222"]} position={[0, -2, 0]} />
      </Canvas>
      
      {/* Interaction hint */}
      <div className="absolute bottom-2 left-2 text-[10px] text-white/40 flex items-center gap-1">
        <RotateCcw className="size-3" />
        Drag to rotate • Scroll to zoom
      </div>
    </div>
  );
}

// Full-screen modal for expanded view
interface ThreeJsExpandedModalProps {
  config: ThreeJsSceneConfig;
  concept: string;
  onClose: () => void;
}

export function ThreeJsExpandedModal({ config, concept, onClose }: ThreeJsExpandedModalProps) {
  const elementsMap = useMemo(() => new Map<string, THREE.Vector3>(), []);

  // Validate config
  if (!config || !config.elements) {
    return (
      <div 
        className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="text-white/60">Invalid scene configuration</div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div className="relative w-full h-full max-w-6xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-white/70 hover:text-white"
        >
          <X className="size-5 mr-1" />
          Close
        </Button>
        
        <div className="w-full h-full rounded-xl overflow-hidden">
          <Canvas
            camera={{ fov: config.camera?.fov || 60 }}
            style={{ background: "transparent" }}
          >
            <CameraController config={config.camera} />
            <OrbitControls 
              enableZoom={true} 
              enablePan={true} 
              minDistance={3}
              maxDistance={20}
              autoRotate={config.animation?.type === "rotate"}
              autoRotateSpeed={1}
            />
            <SceneLighting config={config.lighting} />
            <AnimatedScene config={config} elementsMap={elementsMap} />
            <gridHelper args={[10, 10, "#333333", "#222222"]} position={[0, -2, 0]} />
          </Canvas>
        </div>
        
        <div className="absolute bottom-4 left-4 text-white">
          <h3 className="text-lg font-semibold">{config.title || concept}</h3>
          <p className="text-sm text-white/60 mt-1">{config.description}</p>
        </div>
      </div>
    </div>
  );
}

// Legacy full component (for backwards compatibility)
interface ThreeJsVisualProps {
  config: ThreeJsSceneConfig;
  concept: string;
  onDismiss?: () => void;
  className?: string;
}

export function ThreeJsVisual({ config, concept, onDismiss, className }: ThreeJsVisualProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const elementsMap = useMemo(() => new Map<string, THREE.Vector3>(), []);

  // Simulate loading for smooth transition
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Validate config
  if (!config || !config.elements) {
    return (
      <div className={cn("rounded-2xl border border-white/10 bg-black/40 p-4", className)}>
        <span className="text-white/40 text-sm">Invalid scene configuration</span>
      </div>
    );
  }

  return (
    <>
      {/* Main Card */}
      <div
        className={cn(
          "relative rounded-2xl border bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500/30 p-4 transition-all duration-300",
          "hover:shadow-lg hover:scale-[1.01]",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full bg-white/10 flex items-center justify-center">
              <div className="size-3 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full" />
            </div>
            <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
              3D Visualization
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">
              {config.type || "scene"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(true)}
              className="size-6 p-0 rounded-full hover:bg-white/10"
            >
              <Maximize2 className="size-3 text-white/50" />
            </Button>
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="size-6 p-0 rounded-full hover:bg-white/10"
              >
                <X className="size-3 text-white/50" />
              </Button>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className="text-sm font-semibold text-white mb-2">{config.title || concept}</h4>
        <p className="text-xs text-white/60 mb-3">{config.description || ""}</p>

        {/* Canvas */}
        <div className="relative rounded-xl overflow-hidden bg-black/40 h-[280px]">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-8 text-white/40 animate-spin" />
            </div>
          ) : (
            <Canvas
              camera={{ fov: config.camera?.fov || 60 }}
              onCreated={() => setIsLoading(false)}
              style={{ background: "transparent" }}
            >
              <CameraController config={config.camera} />
              <OrbitControls 
                enableZoom={true} 
                enablePan={true} 
                minDistance={3}
                maxDistance={20}
                autoRotate={config.animation?.type === "rotate"}
                autoRotateSpeed={1}
              />
              <SceneLighting config={config.lighting} />
              <AnimatedScene config={config} elementsMap={elementsMap} />
              <gridHelper args={[10, 10, "#333333", "#222222"]} position={[0, -2, 0]} />
            </Canvas>
          )}
          
          {/* Interaction hint */}
          <div className="absolute bottom-2 left-2 text-[10px] text-white/40 flex items-center gap-1">
            <RotateCcw className="size-3" />
            Drag to rotate • Scroll to zoom
          </div>
        </div>
      </div>

      {/* Expanded Modal */}
      {isExpanded && (
        <ThreeJsExpandedModal 
          config={config} 
          concept={concept} 
          onClose={() => setIsExpanded(false)} 
        />
      )}
    </>
  );
}

// Loading skeleton
export function ThreeJsVisualSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="size-6 rounded-full bg-white/10" />
        <div className="h-3 w-24 rounded bg-white/10" />
      </div>
      <div className="h-4 w-3/4 rounded bg-white/10 mb-2" />
      <div className="h-3 w-1/2 rounded bg-white/10 mb-3" />
      <div className="rounded-xl bg-white/5 h-[280px] flex items-center justify-center">
        <Loader2 className="size-8 text-white/20 animate-spin" />
      </div>
    </div>
  );
}
