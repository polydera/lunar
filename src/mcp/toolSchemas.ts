/**
 * Auto-generate MCP tool schemas from operator/scene-operator registries + action registry.
 *
 * Called by the handler when the bridge requests `__list_tools`.
 * 3 tools: discover, world_state, run.
 */

import { operators, sceneOperators } from '@/core'

interface ToolSchema {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export function generateToolSchemas(actionRegistry?: Map<string, { id: string }>): ToolSchema[] {
  // Collect all operator IDs for the run tool enum
  const allIds = [
    ...operators.all().map((op) => op.id),
    ...sceneOperators.all().map((so) => so.id),
    ...(actionRegistry ? [...actionRegistry.keys()] : []),
  ]

  return [
    {
      name: 'discover',
      description:
        'List available operators grouped by category. ' +
        'No params → compact catalog: { _guide, category: [{ id, l, n?, p? }] }. ' +
        'n = how many nodeIds to pass (omit=0, N=array, 0+=optional). p = param names. ' +
        'Pass operatorIds for full schemas. Pass categories for all in those groups.',
      inputSchema: {
        type: 'object',
        properties: {
          operatorIds: { type: 'array', items: { type: 'string' }, description: 'Get full schemas for these operators' },
          categories: { type: 'array', items: { type: 'string' }, description: 'Get full schemas for these categories' },
        },
      },
    },
    {
      name: 'world_state',
      description:
        'Get the current scene. Node IDs are what you pass in run operations. ' +
        'No params → compact list (id, label, type, visible, center) + summary. ' +
        'Pass nodeIds for full detail: properties (faces, vertices, AABB, OBB with center/axes/extent in world space), transform matrix, color, opacity, children.',
      inputSchema: {
        type: 'object',
        properties: {
          nodeIds: { type: 'array', items: { type: 'string' }, description: 'Get full detail for these nodes' },
          visibleOnly: { type: 'boolean', description: 'Only visible nodes' },
        },
      },
    },
    {
      name: 'run',
      description:
        'Execute one or more operations. Each operation has operatorId, optional nodeIds, optional params. ' +
        'Call discover() to see available operators. Call discover({ operatorId }) for full schema + _example. ' +
        'Operations execute sequentially. Returns array of results.',
      inputSchema: {
        type: 'object',
        properties: {
          operations: {
            type: 'array',
            description: 'Array of operations to execute',
            items: {
              type: 'object',
              properties: {
                operatorId: {
                  type: 'string',
                  enum: allIds,
                  description: 'Operator ID from discover catalog',
                },
                nodeIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Node IDs from world_state',
                },
                nodeId: {
                  type: 'string',
                  description: 'Single node ID (for scene operators)',
                },
                params: {
                  type: 'object',
                  description: 'Parameters for this operation',
                },
              },
              required: ['operatorId'],
            },
          },
        },
        required: ['operations'],
      },
    },
  ]
}
