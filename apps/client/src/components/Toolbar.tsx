interface ToolbarProps {
  activeTool: 'select' | 'rectangle';
  setActiveTool: (tool: 'select' | 'rectangle') => void;
  onOpenToolbox: () => void;
}

export default function Toolbar({
  activeTool,
  setActiveTool,
  onOpenToolbox,
}: ToolbarProps) {
  const buttonStyle = (tool: string) => ({
    padding: '12px 20px',
    fontSize: '14px',
    cursor: 'pointer',
    background: activeTool === tool ? '#4488ff' : '#222',
    color: activeTool === tool ? '#fff' : '#aaa',
    border: '1px solid ' + (activeTool === tool ? '#4488ff' : '#333'),
    borderRadius: '6px',
    transition: 'all 0.2s',
    fontWeight: activeTool === tool ? 'bold' : 'normal',
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        display: 'flex',
        gap: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        padding: '12px',
        borderRadius: '8px',
        backdropFilter: 'blur(10px)',
        border: '1px solid #333',
      }}
    >
      <button
        style={buttonStyle('select')}
        onClick={() => setActiveTool('select')}
        title="Select / Pan (drag to move canvas)"
      >
        ✋ Select
      </button>
      <button
        style={buttonStyle('rectangle')}
        onClick={() => setActiveTool('rectangle')}
        title="Draw Rectangle (click and drag)"
      >
        ⬜ Rectangle
      </button>
      <button
        onClick={onOpenToolbox}
        style={{
          padding: '10px 12px',
          fontSize: '12px',
          cursor: 'pointer',
          background: '#222',
          color: '#aaa',
          border: '1px solid #333',
          borderRadius: '6px',
        }}
        title="Open toolbox"
      >
        🧰 Toolbox
      </button>
    </div>
  );
}
