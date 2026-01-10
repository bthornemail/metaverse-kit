interface ToolbarProps {
  activeTool: 'select' | 'rectangle';
  setActiveTool: (tool: 'select' | 'rectangle') => void;
  semanticRole: string;
  setSemanticRole: (role: string) => void;
  symbolSet: string;
  setSymbolSet: (setId: string) => void;
  assetPacks: Array<{ id: string; label: string }>;
  onImportPack: () => void;
}

export default function Toolbar({
  activeTool,
  setActiveTool,
  semanticRole,
  setSemanticRole,
  symbolSet,
  setSymbolSet,
  assetPacks,
  onImportPack,
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
      <select
        value={semanticRole}
        onChange={(e) => setSemanticRole(e.target.value)}
        style={{
          padding: '10px 12px',
          background: '#111',
          color: '#ccc',
          border: '1px solid #333',
          borderRadius: '6px',
          fontSize: '12px',
        }}
        title="Semantic role (story layer)"
      >
        <option value="law">Law</option>
        <option value="wisdom">Wisdom</option>
        <option value="identity">Identity</option>
        <option value="witness">Witness</option>
        <option value="boundary">Boundary</option>
        <option value="gate">Gate</option>
        <option value="tower">Tower</option>
        <option value="flood">Flood</option>
        <option value="ark">Ark</option>
        <option value="conversation">Conversation</option>
        <option value="alignment">Alignment</option>
      </select>
      <select
        value={symbolSet}
        onChange={(e) => setSymbolSet(e.target.value)}
        style={{
          padding: '10px 12px',
          background: '#111',
          color: '#ccc',
          border: '1px solid #333',
          borderRadius: '6px',
          fontSize: '12px',
        }}
        title="Symbol set"
      >
        {assetPacks.map((pack) => (
          <option key={pack.id} value={pack.id}>
            {pack.label}
          </option>
        ))}
      </select>
      <button
        onClick={onImportPack}
        style={{
          padding: '10px 12px',
          fontSize: '12px',
          cursor: 'pointer',
          background: '#222',
          color: '#aaa',
          border: '1px solid #333',
          borderRadius: '6px',
        }}
        title="Import asset pack"
      >
        ⬆ Import Pack
      </button>
    </div>
  );
}
