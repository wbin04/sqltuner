/**
 * Layout Utilities
 * Auto-layout calculation using dagre for graph positioning
 */
import dagre from 'dagre';
import { Node, Edge, MarkerType } from '@xyflow/react';

export interface LayoutOptions {
  rankdir?: 'TB' | 'LR' | 'BT' | 'RL';
  nodesep?: number;
  ranksep?: number;
}

const DEFAULT_OPTIONS: LayoutOptions = {
  rankdir: 'LR', // Left to Right layout
  nodesep: 100,
  ranksep: 150,
};

/**
 * Calculate node positions using dagre algorithm
 */
export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const { rankdir, nodesep, ranksep } = { ...DEFAULT_OPTIONS, ...options };

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Configure graph
  dagreGraph.setGraph({
    rankdir,
    nodesep,
    ranksep,
  });

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    // Use estimated width/height if not provided
    const width = node.width || 300;
    const height = node.height || 200;
    dagreGraph.setNode(node.id, { width, height });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Apply calculated positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - (node.width || 300) / 2,
        y: nodeWithPosition.y - (node.height || 200) / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Transform schema data to React Flow nodes and edges
 */
export interface TableSchema {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    is_pk?: boolean;
    is_nullable?: boolean;
  }>;
  foreign_keys?: Array<{
    column: string;
    ref_table: string;
    ref_column: string;
  }>;
}

export function transformSchemaToGraph(tables: TableSchema[]): {
  nodes: Node[];
  edges: Edge[];
} {
  // Create nodes from tables
  const nodes: Node[] = tables.map((table) => ({
    id: table.name,
    type: 'tableNode',
    position: { x: 0, y: 0 }, // Will be calculated by dagre
    data: {
      tableName: table.name,
      columns: table.columns,
      foreign_keys: table.foreign_keys,
    },
    // Estimate dimensions based on columns count
    width: 300,
    height: Math.min(400, 100 + table.columns.length * 35),
  }));

  // Create edges from foreign keys
  const edges: Edge[] = [];

  tables.forEach((table) => {
    if (table.foreign_keys && table.foreign_keys.length > 0) {
      table.foreign_keys.forEach((fk) => {
        edges.push({
          id: `${table.name}.${fk.column}-${fk.ref_table}.${fk.ref_column}`,
          source: table.name,
          target: fk.ref_table,
          sourceHandle: `${table.name}__${fk.column}__source`,
          targetHandle: `${fk.ref_table}__${fk.ref_column}__target`,
          type: 'foreignKeyEdge',
          animated: false,
          style: { stroke: '#94a3b8', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#94a3b8',
          },
          label: fk.column,
          labelStyle: { fontSize: 11, fill: '#64748b' },
          labelBgStyle: { fill: '#f1f5f9', opacity: 0.8 },
        });
      });
    }
  });

  return { nodes, edges };
}
