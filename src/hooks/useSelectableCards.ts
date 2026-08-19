'use client';

import { useCallback, useState } from 'react';

export function useSelectableCards(initialSelectedId: string | null = null) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const isActive = useCallback((id: string) => selectedId === id, [selectedId]);
  const isHovered = useCallback((id: string) => hoveredId === id, [hoveredId]);

  const onMouseEnter = useCallback((id: string) => setHoveredId(id), []);
  const onMouseLeave = useCallback((id: string) => {
    setHoveredId((current) => (current === id ? null : current));
  }, []);
  const onSelect = useCallback((id: string) => setSelectedId(id), []);

  return {
    selectedId,
    hoveredId,
    isActive,
    isHovered,
    onMouseEnter,
    onMouseLeave,
    onSelect,
    setSelectedId,
  };
}
