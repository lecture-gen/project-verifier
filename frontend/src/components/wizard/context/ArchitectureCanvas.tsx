"use client";

// 아키텍처 시각화 — react-flow 기반.
// LLM 이 준 layer 값을 column 인덱스로 매핑해 좌표를 결정한다.
// dagre 같은 외부 layout lib 의존성을 추가하지 않는다.

import { useMemo } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Edge as RfEdge,
  type Node as RfNode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Architecture } from "@/lib/api/context-types";

const LAYER_COLUMNS: Record<string, number> = {
  client: 0,
  api: 1,
  service: 2,
  persistence: 3,
  external: 4,
  infra: 5,
};

const LAYER_LABEL: Record<string, string> = {
  client: "Client",
  api: "API",
  service: "Service",
  persistence: "Persistence",
  external: "External",
  infra: "Infra",
};

const COL_WIDTH = 220;
const ROW_HEIGHT = 88;

function columnFor(layer: string): number {
  return LAYER_COLUMNS[layer] ?? LAYER_COLUMNS.service;
}

export function ArchitectureCanvas({ architecture }: { architecture: Architecture }) {
  const { nodes, edges, layerColumns } = useMemo(() => {
    const rfNodes: RfNode[] = [];
    const rfEdges: RfEdge[] = [];

    // layer 별로 row index 매겨서 좌표 결정
    const rowByLayer = new Map<string, number>();
    for (const node of architecture.nodes ?? []) {
      const col = columnFor(node.layer);
      const layerKey = node.layer || "service";
      const row = rowByLayer.get(layerKey) ?? 0;
      rowByLayer.set(layerKey, row + 1);
      rfNodes.push({
        id: node.id,
        type: "default",
        position: { x: col * COL_WIDTH, y: row * ROW_HEIGHT },
        data: {
          label: (
            <div className="text-xs">
              <div className="font-semibold">{node.label}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {LAYER_LABEL[node.layer] ?? node.layer}
              </div>
            </div>
          ),
        },
        style: {
          borderRadius: 8,
          borderColor: "var(--border)",
          background: "var(--card)",
          color: "var(--card-foreground)",
        },
      });
    }

    for (const edge of architecture.edges ?? []) {
      rfEdges.push({
        id: `${edge.source}->${edge.target}`,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        labelStyle: { fontSize: 10 },
      });
    }

    const layerColumns = Array.from(rowByLayer.keys()).sort(
      (a, b) => columnFor(a) - columnFor(b),
    );
    return { nodes: rfNodes, edges: rfEdges, layerColumns };
  }, [architecture]);

  if (!architecture.nodes || architecture.nodes.length === 0) {
    return (
      <p className="rounded border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
        아키텍처 노드가 생성되지 않았습니다. (LLM 응답에 architecture.nodes 가 비어 있음)
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {architecture.summary && (
        <p className="text-sm leading-relaxed text-foreground/90">
          {architecture.summary}
        </p>
      )}
      <div className="flex flex-wrap gap-2 text-[11px]">
        {architecture.style && (
          <span className="rounded bg-muted px-2 py-0.5">
            스타일 · {architecture.style}
          </span>
        )}
        {architecture.layers?.map((layer) => (
          <span key={`layer-${layer}`} className="rounded bg-muted/60 px-2 py-0.5">
            계층 · {layer}
          </span>
        ))}
        {architecture.modules?.map((module) => (
          <span key={`module-${module}`} className="rounded bg-muted/40 px-2 py-0.5">
            모듈 · {module}
          </span>
        ))}
      </div>
      <div className="rounded border border-border/60" style={{ height: 360 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
        >
          <Background gap={20} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {layerColumns.length > 0 && (
        <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {layerColumns.map((layer) => (
            <span key={`legend-${layer}`}>
              col {columnFor(layer) + 1}: {LAYER_LABEL[layer] ?? layer}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
