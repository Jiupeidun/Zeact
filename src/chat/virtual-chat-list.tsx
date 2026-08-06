import { type CSSProperties, type ReactNode } from 'react';
import { useAnchoredVirtualList, type AnchoredListOptions, type VirtualItem } from './use-anchored-virtual-list';

export interface VirtualChatListProps<T, K> extends AnchoredListOptions<T, K> {
  renderItem: (virtualItem: VirtualItem<T, K>) => ReactNode;
  className?: string;
  style?: CSSProperties;
  contentClassName?: string;
  contentStyle?: CSSProperties;
}

export function VirtualChatList<T, K>(props: VirtualChatListProps<T, K>) {
  const {
    renderItem, className, style, contentClassName, contentStyle, ...options
  } = props;
  const virtual = useAnchoredVirtualList(options);

  return (
    <div
      ref={virtual.containerRef}
      className={className}
      style={{ overflow: 'auto', overflowAnchor: 'none', ...style }}
    >
      <div
        className={contentClassName}
        style={{ height: virtual.totalSize, position: 'relative', ...contentStyle }}
      >
        {virtual.virtualItems.map((virtualItem) => (
          <div
            key={String(virtualItem.key)}
            ref={virtualItem.measureRef}
            style={{
              left: 0,
              position: 'absolute',
              right: 0,
              top: 0,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(virtualItem)}
          </div>
        ))}
      </div>
    </div>
  );
}
