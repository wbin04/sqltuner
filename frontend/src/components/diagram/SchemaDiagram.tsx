/**
 * SchemaDiagram Component
 * Interactive Entity Relationship Diagram using React Flow
 */
import { useEffect, useCallback, useState } from 'react';
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
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TableNode } from './TableNode';
import { ForeignKeyEdge } from './ForeignKeyEdge';
import { ContextMenu } from './ContextMenu';
import { transformSchemaToGraph, getLayoutedElements } from './layoutUtils';
import { cn } from '../../lib/utils';

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
  isSimulation?: boolean;
  onAddForeignKey?: (sourceTable: string, sourceCol: string, targetTable: string, targetCol: string) => void;
  onRemoveForeignKey?: (sourceTable: string, sourceCol: string, targetTable: string, targetCol: string) => void;
  onUpdateForeignKey?: (
    oldSource: { table: string; col: string },
    newSource: { table: string; col: string },
    newTarget: { table: string; col: string }
  ) => void;
  onAddTable?: (tableName: string, position: { x: number; y: number }) => void;
  onEditTable?: (tableName: string) => void;
  onAddColumn?: (tableName: string, column: Column) => void;
  onRemoveColumn?: (tableName: string, columnName: string) => void;
  onUpdateColumn?: (tableName: string, columnName: string, newColumn: Column) => void;
  onUpdateTableName?: (oldName: string, newName: string) => void;
}

// Register custom node types
const nodeTypes = {
  tableNode: TableNode,
};

// Register custom edge types
const edgeTypes = {
  foreignKeyEdge: ForeignKeyEdge,
};

function SchemaDiagramInner({ schema, isEditable = false, isSimulation = false, onAddForeignKey, onRemoveForeignKey, onUpdateForeignKey, onAddTable, onEditTable, onAddColumn, onRemoveColumn, onUpdateColumn, onUpdateTableName }: SchemaDiagramProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; flowPosition: { x: number; y: number } } | null>(null);
  const { screenToFlowPosition } = useReactFlow();

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
          type: 'foreignKeyEdge',
          animated: true,
          style: { stroke: '#10b981' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#10b981',
          },
          data: {
            onRemoveForeignKey,
            isEditable,
          },
        };
        setEdges((eds) => addEdge(newEdge, eds));
      }
    },
    [isEditable, onAddForeignKey, setEdges]
  );



  // Handle edge reconnection (drag to different column)
  const onReconnect: OnReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!isEditable || !onUpdateForeignKey) return;

      const oldSourceData = parseHandleId(oldEdge.sourceHandle);
      const newSourceData = parseHandleId(newConnection.sourceHandle);
      const newTargetData = parseHandleId(newConnection.targetHandle);

      if (!oldSourceData || !newSourceData || !newTargetData) return;

      // Call parent callback to update the actual schema data
      onUpdateForeignKey(oldSourceData, newSourceData, newTargetData);
    },
    [isEditable, onUpdateForeignKey, parseHandleId]
  );

  // Handle right-click on canvas
  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
      // Only allow in edit mode AND simulation
      if (!isEditable || !isSimulation || !onAddTable) return;

      event.preventDefault();

      // Get cursor position in screen coordinates
      const screenX = event.clientX;
      const screenY = event.clientY;

      // Convert to flow coordinates (accounting for zoom/pan)
      const flowPosition = screenToFlowPosition({ x: screenX, y: screenY });

      setContextMenu({
        x: screenX,
        y: screenY,
        flowPosition,
      });
    },
    [isSimulation, isEditable, onAddTable, screenToFlowPosition]
  );

  // Handle double-click on node
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!onEditTable) return;

      onEditTable(node.id);
    },
    [onEditTable]
  );

  // Handle add table from context menu
  const handleAddTable = useCallback(() => {
    console.log('[SchemaDiagram.handleAddTable] Called', { hasContextMenu: !!contextMenu, hasOnAddTable: !!onAddTable });
    
    if (!contextMenu || !onAddTable) return;

    const timestamp = Date.now();
    const tableName = `table_${timestamp}`;

    console.log('[SchemaDiagram.handleAddTable] Calling onAddTable with:', { tableName, position: contextMenu.flowPosition });
    onAddTable(tableName, contextMenu.flowPosition);
    setContextMenu(null);
  }, [contextMenu, onAddTable]);

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

    // Add isEditable flag and callbacks to all nodes
    const nodesWithEditFlag = rawNodes.map(node => ({
      ...node,
      data: { 
        ...node.data, 
        isEditable,
        onAddColumn,
        onRemoveColumn,
        onUpdateColumn,
        onUpdateTableName,
      },
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

    // Add onRemoveForeignKey and isEditable to edge data
    const edgesWithData = layoutedEdges.map(edge => ({
      ...edge,
      data: {
        ...edge.data,
        onRemoveForeignKey,
        isEditable,
      },
    }));

    // Force new object references to trigger React Flow update
    setNodes([...layoutedNodes]);
    setEdges([...edgesWithData]);
  }, [schema, isEditable, onAddColumn, onRemoveColumn, onUpdateColumn, onUpdateTableName, onRemoveForeignKey]); // Add callbacks to deps to ensure updates

  // Empty state - only show for real databases, not simulations
  if (!schema || !schema.tables || schema.tables.length === 0) {
    if (!isSimulation) {
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
    // For simulations, continue to render empty canvas
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={isEditable ? onConnect : undefined}
        onReconnect={isEditable ? onReconnect : undefined}
        onPaneContextMenu={isEditable ? onPaneContextMenu : undefined}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
        defaultEdgeOptions={{
          type: 'foreignKeyEdge',
          focusable: true,
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
            'border border-border-DEFAULT dark:border-border-dark'
          )}
        />

        {/* Mini Map */}
        <MiniMap
          className={cn(
            'bg-surface-light dark:bg-surface-dark',
            'border border-border-DEFAULT dark:border-border-dark'
          )}
          nodeColor={() => '#6366f1'}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onAddTable={handleAddTable}
        />
      )}
    </div>
  );
}

// Export wrapper component with ReactFlowProvider
export function SchemaDiagram(props: SchemaDiagramProps) {
  return (
    <ReactFlowProvider>
      <SchemaDiagramInner {...props} />
    </ReactFlowProvider>
  );
}
