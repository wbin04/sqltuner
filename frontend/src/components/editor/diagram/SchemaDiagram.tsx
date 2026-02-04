/**
 * SchemaDiagram Component
 * Interactive Entity Relationship Diagram using React Flow
 */
import { useEffect, useCallback } from 'react';
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
  Connection,
  addEdge,
  MarkerType,
  ConnectionLineType,
  OnReconnect,
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
  isEditable?: boolean;
  onAddForeignKey?: (sourceTable: string, sourceCol: string, targetTable: string, targetCol: string) => void;
  onRemoveForeignKey?: (sourceTable: string, sourceCol: string, targetTable: string, targetCol: string) => void;
  onUpdateForeignKey?: (
    oldSource: { table: string; col: string },
    newSource: { table: string; col: string },
    newTarget: { table: string; col: string }
  ) => void;
}

// Register custom node types
const nodeTypes = {
  tableNode: TableNode,
};

export function SchemaDiagram({ schema, isEditable = false, onAddForeignKey, onRemoveForeignKey, onUpdateForeignKey }: SchemaDiagramProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Helper to parse handle IDs like "users__id__target" -> { table: "users", col: "id" }
  const parseHandleId = useCallback((handleId: string | null | undefined) => {
    if (!handleId) return null;
    const parts = handleId.split('__');
    if (parts.length < 2) return null;
    return { table: parts[0], col: parts[1] };
  }, []);

  // Handle new connections (drag from source to target)
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isEditable || !onAddForeignKey) return;

      // Parse handle IDs: format is "tableName__columnName__source/target"
      const sourceHandle = connection.sourceHandle;
      const targetHandle = connection.targetHandle;

      if (!sourceHandle || !targetHandle) return;

      const [sourceTable, sourceCol] = sourceHandle.split('__');
      const [targetTable, targetCol] = targetHandle.split('__');

      if (sourceTable && sourceCol && targetTable && targetCol) {
        onAddForeignKey(sourceTable, sourceCol, targetTable, targetCol);
        
        // Add edge to UI
        const newEdge: Edge = {
          id: `${sourceTable}.${sourceCol}-${targetTable}.${targetCol}`,
          source: connection.source!,
          target: connection.target!,
          sourceHandle,
          targetHandle,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#10b981' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#10b981',
          },
        };
        setEdges((eds) => addEdge(newEdge, eds));
      }
    },
    [isEditable, onAddForeignKey, setEdges]
  );

  // Handle edge deletion
  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (!isEditable || !onRemoveForeignKey) return;

      event.stopPropagation();
      
      if (window.confirm('Remove this foreign key relationship?')) {
        // Parse edge ID or handles
        const sourceHandle = edge.sourceHandle;
        const targetHandle = edge.targetHandle;

        if (sourceHandle && targetHandle) {
          const [sourceTable, sourceCol] = sourceHandle.split('__');
          const [targetTable, targetCol] = targetHandle.split('__');

          if (sourceTable && sourceCol && targetTable && targetCol) {
            onRemoveForeignKey(sourceTable, sourceCol, targetTable, targetCol);
            setEdges((eds) => eds.filter((e) => e.id !== edge.id));
          }
        }
      }
    },
    [isEditable, onRemoveForeignKey, setEdges]
  );

  // Handle edge reconnection (drag to different column)
  const onReconnect: OnReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!isEditable || !onUpdateForeignKey) return;

      const oldSourceData = parseHandleId(oldEdge.sourceHandle);
      const oldTargetData = parseHandleId(oldEdge.targetHandle);
      const newSourceData = parseHandleId(newConnection.sourceHandle);
      const newTargetData = parseHandleId(newConnection.targetHandle);

      if (!oldSourceData || !newSourceData || !newTargetData) return;

      // Call parent callback to update the actual schema data
      onUpdateForeignKey(oldSourceData, newSourceData, newTargetData);
    },
    [isEditable, onUpdateForeignKey, parseHandleId]
  );

  // Transform schema data and apply layout
  useEffect(() => {
    console.log('[SchemaDiagram] Schema changed:', {
      hasTables: schema?.tables?.length || 0,
      isEditable,
      timestamp: Date.now()
    });

    if (!schema || !schema.tables || schema.tables.length === 0) {
      console.log('[SchemaDiagram] No schema, clearing nodes/edges');
      setNodes([]);
      setEdges([]);
      return;
    }

    // Transform schema to graph structure
    const { nodes: rawNodes, edges: rawEdges } = transformSchemaToGraph(schema.tables);

    console.log('[SchemaDiagram] Transformed graph:', {
      nodeCount: rawNodes.length,
      edgeCount: rawEdges.length,
      edges: rawEdges.map(e => ({ id: e.id, source: e.source, target: e.target }))
    });

    // Add isEditable flag to all nodes
    const nodesWithEditFlag = rawNodes.map(node => ({
      ...node,
      data: { ...node.data, isEditable },
    }));

    // Apply dagre layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodesWithEditFlag,
      rawEdges,
      { rankdir: 'LR', nodesep: 80, ranksep: 200 }
    );

    console.log('[SchemaDiagram] Setting nodes/edges:', {
      nodeCount: layoutedNodes.length,
      edgeCount: layoutedEdges.length
    });

    // Force new object references to trigger React Flow update
    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
  }, [schema, isEditable]); // Remove setNodes, setEdges from deps to avoid infinite loops

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
        onConnect={isEditable ? onConnect : undefined}
        onEdgeClick={isEditable ? onEdgeClick : undefined}
        onReconnect={isEditable ? onReconnect : undefined}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        className={cn(
          'bg-background-light dark:bg-background-dark'
        )}
        proOptions={{ hideAttribution: true }}
        connectionLineStyle={{ stroke: '#10b981', strokeWidth: 2 }}
        connectionLineType={ConnectionLineType.SmoothStep}
        edgesUpdatable={isEditable}
        defaultEdgeOptions={{
          type: 'smoothstep',
          focusable: true,
          updatable: isEditable ? 'target' : false,
        }}
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
