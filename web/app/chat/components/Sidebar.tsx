"use client";

interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

interface SidebarProps {
  conversations: Conversation[];
  activeId: number | null;
  isOpen: boolean;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export function Sidebar({ conversations, activeId, isOpen, onSelect, onNew, onDelete, onClose }: SidebarProps) {
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 sm:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-64 transform border-r border-gray-200 bg-white transition-transform sm:relative sm:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 p-3">
            <span className="text-sm font-medium text-gray-700">Conversations</span>
            <button
              onClick={onNew}
              className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-700"
            >
              + New
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-2">
            {conversations.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-gray-400">
                No conversations yet
              </p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center rounded-md px-2 py-1.5 text-sm ${
                  activeId === conv.id
                    ? "bg-gray-100 font-medium text-gray-900"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <button
                  onClick={() => onSelect(conv.id)}
                  className="min-w-0 flex-1 truncate text-left"
                >
                  {conv.title}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  className="ml-1 hidden shrink-0 rounded p-0.5 text-gray-400 hover:text-red-500 group-hover:block"
                  aria-label="Delete conversation"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
