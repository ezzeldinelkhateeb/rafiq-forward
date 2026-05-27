import React, { useEffect, useState, useRef, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  fetchBrainMapData,
  addManualNode,
  deleteBrainNode,
  updateNodeStatus,
  type BrainNode,
  type NodeLink,
} from "@/functions/brain-map.fn";
import {
  Plus,
  Trash2,
  Check,
  RefreshCw,
  AlertCircle,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Info,
} from "lucide-react";

interface VisualNode {
  id: string;
  type: "problem" | "goal" | "fear" | "task";
  title: string;
  status: "active" | "resolved";
  x: number;
  y: number;
}

const TYPE_CONFIG = {
  goal: { label: "هدف 🎯", color: "#E6C38E", bg: "rgba(230,195,142,0.12)", border: "rgba(230,195,142,0.4)" },
  problem: { label: "مشكلة 🔴", color: "#F56565", bg: "rgba(245,101,101,0.12)", border: "rgba(245,101,101,0.4)" },
  fear: { label: "خوف 🟣", color: "#B794F4", bg: "rgba(183,148,244,0.12)", border: "rgba(183,148,244,0.4)" },
  task: { label: "مهمة 🟢", color: "#48BB78", bg: "rgba(72,187,120,0.12)", border: "rgba(72,187,120,0.4)" },
};

const RELATION_CONFIG = {
  causes: { label: "يسبب ➔", color: "#F6E05E" },
  helps: { label: "يساعد في ➔", color: "#68D391" },
  blocks: { label: "يعطل ➔", color: "#FEB2B2" },
  subtask: { label: "جزء من ➔", color: "#4FD1C5" },
};

interface BrainMapProps {
  userId: string;
}

export function BrainMap({ userId }: BrainMapProps) {
  const getBrainData = useServerFn(fetchBrainMapData);
  const callAddNode = useServerFn(addManualNode);
  const callDeleteNode = useServerFn(deleteBrainNode);
  const callUpdateStatus = useServerFn(updateNodeStatus);

  const [nodes, setNodes] = useState<BrainNode[]>([]);
  const [links, setLinks] = useState<NodeLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual Node Add Form
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"problem" | "goal" | "fear" | "task">("goal");
  const [newParentId, setNewParentId] = useState("");

  // Inspect state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // SVG Pan & Zoom State
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const svgWidth = 800;
  const svgHeight = 600;

  // Load brain map data
  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getBrainData({ data: { userId } });
      setNodes(res.nodes);
      setLinks(res.links);
    } catch (e) {
      console.error("[BrainMap] Load error:", e);
      setError("مش قاد أقرأ خريطة دماغك حالياً.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  // Compute Layout coords
  const visualNodes = useMemo(() => {
    if (nodes.length === 0) return [];
    
    const center = { x: svgWidth / 2, y: svgHeight / 2 };
    const nodesMap = new Map<string, VisualNode>();

    // Initial positions (orbit based on type)
    nodes.forEach((node, idx) => {
      const angle = idx * ((2 * Math.PI) / Math.max(1, nodes.length));
      const radius =
        node.type === "goal"
          ? 90
          : node.type === "problem"
            ? 180
            : node.type === "fear"
              ? 260
              : 320;

      nodesMap.set(node.id, {
        id: node.id,
        type: node.type,
        title: node.title,
        status: node.status,
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      });
    });

    // Relaxation iteration (simple spring forces)
    const k = 150; // ideal distance
    const iterations = 35;
    for (let iter = 0; iter < iterations; iter++) {
      const vNodes = Array.from(nodesMap.values());
      
      // Repulsion force
      for (let i = 0; i < vNodes.length; i++) {
        const u = vNodes[i];
        for (let j = i + 1; j < vNodes.length; j++) {
          const v = vNodes[j];
          const dx = v.x - u.x;
          const dy = v.y - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 120) {
            const force = (120 - dist) / 6;
            const ux = (dx / dist) * force;
            const uy = (dy / dist) * force;
            u.x -= ux;
            u.y -= uy;
            v.x += ux;
            v.y += uy;
          }
        }
      }

      // Attraction force along links
      links.forEach((link) => {
        const u = nodesMap.get(link.from_node);
        const v = nodesMap.get(link.to_node);
        if (u && v) {
          const dx = v.x - u.x;
          const dy = v.y - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - k) * 0.12;
          const ux = (dx / dist) * force;
          const uy = (dy / dist) * force;
          u.x += ux;
          u.y += uy;
          v.x -= ux;
          v.y -= uy;
        }
      });

      // Clamp distance to boundary
      vNodes.forEach((node) => {
        const dx = node.x - center.x;
        const dy = node.y - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist > 400) {
          node.x -= (dx / dist) * (dist - 400) * 0.15;
          node.y -= (dy / dist) * (dist - 400) * 0.15;
        }
      });
    }

    return Array.from(nodesMap.values());
  }, [nodes, links]);

  // Selected Node Details
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  // Handle addition
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const newNode = await callAddNode({
        data: {
          userId,
          title: newTitle,
          type: newType,
          parentId: newParentId || undefined,
        },
      });

      setNodes((prev) => [...prev, newNode]);

      // If it has a parent, create a subtask/helps link automatically
      if (newParentId) {
        const relation = newType === "task" ? "subtask" : "helps";
        const newLink: NodeLink = {
          from_node: newNode.id,
          to_node: newParentId,
          relation_type: relation,
        };
        // Persist link manually
        await supabaseAdmin.from("node_links").insert(newLink);
        setLinks((prev) => [...prev, newLink]);
      }

      setNewTitle("");
      setNewParentId("");
    } catch (e) {
      console.error("[BrainMap] Create node error:", e);
    }
  };

  // Handle deletion
  const handleDelete = async (nodeId: string) => {
    try {
      await callDeleteNode({ data: { userId, nodeId } });
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setLinks((prev) => prev.filter((l) => l.from_node !== nodeId && l.to_node !== nodeId));
      setSelectedNodeId(null);
    } catch (e) {
      console.error("[BrainMap] Delete node error:", e);
    }
  };

  // Handle status toggle
  const handleToggleStatus = async (nodeId: string, currentStatus: "active" | "resolved") => {
    const nextStatus = currentStatus === "active" ? "resolved" : "active";
    try {
      await callUpdateStatus({ data: { userId, nodeId, status: nextStatus } });
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, status: nextStatus } : n))
      );
    } catch (e) {
      console.error("[BrainMap] Update status error:", e);
    }
  };

  // SVG Mouse handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Only drag if clicking SVG canvas background
    if ((e.target as Element).tagName !== "svg" && (e.target as Element).id !== "grid-bg") return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top Add Node bar */}
      <form onSubmit={handleAdd} className="flex gap-2 flex-wrap items-end bg-ivory/[0.01] border border-ivory/8 p-3 rounded-xl">
        <div className="flex-1 min-w-[150px] space-y-1">
          <label className="text-[11px] text-ivory/50 block pr-1">عايز ترسم إيه في دماغك؟</label>
          <input
            type="text"
            required
            placeholder="مثال: قلق الامتحانات، تنظيم نومي..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-ivory/[0.03] border border-ivory/10 text-ivory focus:outline-none focus:border-[#E6C38E]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-ivory/50 block pr-1">النوع</label>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as any)}
            className="px-2 py-1.5 text-xs rounded-lg bg-ivory/[0.03] border border-ivory/10 text-ivory focus:outline-none focus:border-[#E6C38E]"
          >
            <option value="goal" className="bg-[#121212]">هدف 🎯</option>
            <option value="problem" className="bg-[#121212]">مشكلة 🔴</option>
            <option value="fear" className="bg-[#121212]">خوف 🟣</option>
            <option value="task" className="bg-[#121212]">مهمة 🟢</option>
          </select>
        </div>

        {nodes.length > 0 && (
          <div className="space-y-1">
            <label className="text-[11px] text-ivory/50 block pr-1">اربطها بـ</label>
            <select
              value={newParentId}
              onChange={(e) => setNewParentId(e.target.value)}
              className="px-2 py-1.5 text-xs rounded-lg bg-ivory/[0.03] border border-ivory/10 text-ivory/70 focus:outline-none focus:border-[#E6C38E]"
            >
              <option value="" className="bg-[#121212]">بدون ربط</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id} className="bg-[#121212]">
                  {n.title.slice(0, 15)}... ({n.type === "goal" ? "هدف" : n.type === "problem" ? "مشكلة" : "مهمة"})
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          className="px-3 py-1.5 rounded-lg bg-[#E6C38E] hover:bg-[#d4ad6e] text-[#121212] font-bold text-xs flex items-center gap-1 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </form>

      {/* Main View Area */}
      <div className="flex-1 relative border border-ivory/10 rounded-2xl bg-[#0e0e0e] overflow-hidden min-h-[380px] flex">
        {loading && (
          <div className="absolute inset-0 bg-[#0e0e0e]/80 flex flex-col items-center justify-center gap-2 z-10">
            <RefreshCw className="w-6 h-6 text-[#E6C38E] animate-spin" />
            <p className="text-xs text-ivory/40">برسم الخريطة البصرية لدماغك...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-x-4 top-4 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400 flex items-center gap-2 z-10">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Floating View Controls */}
        <div className="absolute left-3 top-3 flex flex-col gap-2 z-10">
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            className="p-2 rounded-lg bg-ivory/[0.04] border border-ivory/10 text-ivory/60 hover:text-ivory hover:bg-ivory/[0.08]"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
            className="p-2 rounded-lg bg-ivory/[0.04] border border-ivory/10 text-ivory/60 hover:text-ivory hover:bg-ivory/[0.08]"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            className="p-2 rounded-lg bg-ivory/[0.04] border border-ivory/10 text-ivory/60 hover:text-ivory hover:bg-ivory/[0.08]"
            title="Reset View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Empty map helper */}
        {!loading && nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-2">
            <Info className="w-8 h-8 text-[#E6C38E]/50" />
            <h4 className="text-sm font-semibold text-ivory/80">دماغك لسه هادية ورايقة! 🧠</h4>
            <p className="text-xs text-ivory/40 max-w-[280px] leading-relaxed">
              ابني هدف أو سجل مشكلة بتعطلك فوق، أو ابدأ دردشة مع رفيق وهيتم رسم أفكارك هنا تلقائياً.
            </p>
          </div>
        )}

        {/* SVG Viewport */}
        <svg
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* SVG Arrow Marker */}
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="rgba(244,244,240,0.18)" />
            </marker>
          </defs>

          {/* Grid Background Pattern */}
          <rect id="grid-bg" width="100%" height="100%" fill="none" />

          {/* Transformation Group */}
          <g transform={`translate(${offset.x + (svgWidth * (1 - zoom)) / 2}, ${offset.y + (svgHeight * (1 - zoom)) / 2}) scale(${zoom})`}>
            {/* Draw Links/Lines */}
            {links.map((link, idx) => {
              const fromNode = visualNodes.find((n) => n.id === link.from_node);
              const toNode = visualNodes.find((n) => n.id === link.to_node);
              if (!fromNode || !toNode) return null;

              const config = RELATION_CONFIG[link.relation_type] || { color: "rgba(244,244,240,0.15)" };

              return (
                <g key={idx}>
                  {/* Glowing line backing */}
                  <line
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke={config.color}
                    strokeWidth="3"
                    strokeOpacity="0.08"
                    strokeDasharray="4 4"
                  />
                  {/* Visible Line */}
                  <line
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke={config.color}
                    strokeWidth="1.5"
                    strokeOpacity="0.35"
                    markerEnd="url(#arrow)"
                  />
                </g>
              );
            })}

            {/* Draw Nodes */}
            {visualNodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const typeCfg = TYPE_CONFIG[node.type];
              const isResolved = node.status === "resolved";

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer select-none group"
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  {/* Glowing Aura Filter */}
                  <circle
                    r="24"
                    fill="transparent"
                    stroke={typeCfg.color}
                    strokeWidth={isSelected ? "3" : "1.5"}
                    strokeOpacity={isSelected ? "0.6" : "0.2"}
                    className="transition-all duration-300 group-hover:stroke-opacity-70 group-hover:scale-110"
                    style={{
                      filter: `drop-shadow(0 0 6px ${typeCfg.color})`,
                    }}
                  />

                  {/* Inner Glassmorphic base */}
                  <circle
                    r="15"
                    fill={isResolved ? "rgba(72,187,120,0.15)" : typeCfg.bg}
                    stroke={isResolved ? "#48BB78" : typeCfg.color}
                    strokeWidth="1.5"
                    className="transition-colors duration-300"
                  />

                  {/* Dot */}
                  <circle
                    r="5"
                    fill={isResolved ? "#48BB78" : typeCfg.color}
                    className="animate-pulse"
                  />

                  {/* Node Label tag */}
                  <g transform="translate(0, 32)">
                    <rect
                      x={-(node.title.length * 3.5) - 8}
                      y="-10"
                      width={node.title.length * 7 + 16}
                      height="18"
                      rx="6"
                      fill="#121212"
                      stroke={isSelected ? typeCfg.color : "rgba(244,244,240,0.06)"}
                      strokeWidth="1"
                      fillOpacity="0.85"
                    />
                    <text
                      textAnchor="middle"
                      y="3"
                      className="text-[10px] font-arabic font-semibold transition-all fill-ivory/80"
                      style={{
                        fill: isResolved ? "rgba(72,187,120,0.6)" : "rgba(244,244,240,0.85)",
                        textDecoration: isResolved ? "line-through" : "none",
                      }}
                    >
                      {node.title}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Dynamic Details Sidebar Overlay */}
        {selectedNode && (
          <div
            className="absolute right-3 top-3 bottom-3 w-64 bg-[#121212]/95 border border-ivory/10 rounded-xl p-4 flex flex-col gap-4 text-right shadow-2xl z-10 animate-fade-in"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-ivory/8 pb-2">
              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{
                color: TYPE_CONFIG[selectedNode.type].color,
                background: TYPE_CONFIG[selectedNode.type].bg,
                border: `1px solid ${TYPE_CONFIG[selectedNode.type].border}`
              }}>
                {TYPE_CONFIG[selectedNode.type].label}
              </span>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="text-ivory/40 hover:text-ivory transition-colors text-xs font-bold font-mono"
              >
                إغلاق ×
              </button>
            </div>

            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] text-ivory/30">عنوان العقدة:</span>
                <p className="text-xs font-semibold leading-relaxed text-ivory/90">{selectedNode.title}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-ivory/30">حالة الإنجاز:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleStatus(selectedNode.id, selectedNode.status)}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      selectedNode.status === "resolved"
                        ? "bg-green-500/10 border border-green-500/30 text-green-400"
                        : "bg-ivory/[0.03] border border-ivory/10 text-ivory/60 hover:border-ivory/20"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {selectedNode.status === "resolved" ? "تم الإنجاز" : "تحديد كمكتمل"}
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-ivory/8 pt-3">
              <button
                onClick={() => handleDelete(selectedNode.id)}
                className="w-full py-2 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                حذف العقدة نهائياً
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
