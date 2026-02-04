/**
 * SchemaDiagram Component
 * Interactive Entity Relationship Diagram using React Flow
 */
import { useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TableNode } from './TableNode';
import { transformSchemaToGraph, getLayoutedElements } from './layoutUtils';
import { cn } from '../../../lib/utils';

interface Column {
  name: string;
  type: string;
  is_pk?: boolean;
  is_nullable?: boolean;
}

interface ForeignKey {
  column: string;
  ref_table: string;
  ref_column: string;
}

interface TableSchema {
  name: string;
  columns: Column[];
  foreign_keys?: ForeignKey[];
  indexes?: any[];
  row_count?: number;
}

interface SchemaDef {
  database_name?: string;
  db_type?: string;
  tables: TableSchema[];
}

interface SchemaDiagramProps {
  schema: SchemaDef | null;
}

// Register custom node types
const nodeTypes = {
  tableNode: TableNode,
};

export function SchemaDiagram({ schema }: SchemaDiagramProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Transform schema data and apply layout
  useEffect(() => {
    if (!schema || !schema.tables || schema.tables.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Transform schema to graph structure
    const { nodes: rawNodes, edges: rawEdges } = transformSchemaToGraph(schema.tables);

    // Apply dagre layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      rawNodes,
      rawEdges,
      { rankdir: 'LR', nodesep: 80, ranksep: 200 }
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [schema, setNodes, setEdges]);

  // Empty state
  if (!schema || !schema.tables || schema.tables.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center py-8">
          <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
            No schema available to display
          </p>
          <p className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">
            Connect to a database or define a schema to see the diagram
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        className={cn(
          'bg-background-light dark:bg-background-dark'
        )}
        proOptions={{ hideAttribution: true }}
      >
        {/* Background Grid */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          className="bg-surface-light dark:bg-surface-dark"
          color="currentColor"
          style={{ opacity: 0.2 }}
        />

        {/* Zoom Controls */}
        <Controls
          className={cn(
            'bg-surface-light dark:bg-surface-dark',
            'border border-border-DEFAULT dark:border-border-dark',
            'rounded-lg shadow-lg'
          )}
        />

        {/* Mini Map */}
        <MiniMap
          className={cn(
            'bg-surface-light dark:bg-surface-dark',
            'border border-border-DEFAULT dark:border-border-dark',
            'rounded-lg shadow-lg'
          )}
          nodeColor={() => '#6366f1'}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}
