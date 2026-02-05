/**
 * ForeignKeyEdge Component
 * Custom React Flow edge for foreign key relationships with delete button
 */
import { memo } from 'react';
import {
  EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
  useReactFlow,
} from '@xyflow/react';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface ForeignKeyEdgeData {
  onRemoveForeignKey?: (sourceTable: string, sourceCol: string, targetTable: string, targetCol: string) => void;
  isEditable?: boolean;
}

export const ForeignKeyEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  selected,
  data,
}: EdgeProps) => {
  const edgeData = data as ForeignKeyEdgeData;
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const { setEdges } = useReactFlow();

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm('Remove this foreign key relationship?')) {
      // Parse edge ID to get source and target info
      // Assuming ID format: "sourceTable.sourceCol-targetTable.targetCol"
      const parts = id.split('-');
      if (parts.length === 2) {
        const [sourcePart, targetPart] = parts;
        const [sourceTable, sourceCol] = sourcePart.split('.');
        const [targetTable, targetCol] = targetPart.split('.');

        // Call the remove callback if provided
        if (edgeData.onRemoveForeignKey) {
          edgeData.onRemoveForeignKey(sourceTable, sourceCol, targetTable, targetCol);
        }

        // Remove edge from UI
        setEdges((edges) => edges.filter((edge) => edge.id !== id));
      }
    }
  };

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? '#ef4444' : style.stroke || '#94a3b8',
          strokeWidth: selected ? 3 : style.strokeWidth || 2,
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 11,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300 border">
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
      {selected && edgeData.isEditable && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - 20}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              onClick={handleDelete}
              className={cn(
                'flex items-center justify-center w-6 h-6 rounded-full',
                'bg-red-500 hover:bg-red-600 text-white',
                'transition-colors shadow-md'
              )}
              title="Remove relationship"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

ForeignKeyEdge.displayName = 'ForeignKeyEdge';