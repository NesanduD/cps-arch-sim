import { useState, useMemo, type KeyboardEvent } from 'react';
import type { ArchNode, ArchEdge } from '../types/architecture';

// 1. Define the props this component needs from App.tsx
interface CommandPanelProps {
  input: string;
  setInput: (value: string) => void;
  messages: string[];
  nodes: ArchNode[];
  edges: ArchEdge[];
  onCommandSubmit: (e: KeyboardEvent<HTMLInputElement>) => void;
  isLocked: boolean;
}

export default function CommandPanel({
  input,
  setInput,
  messages,
  nodes,
  edges,
  onCommandSubmit,
  isLocked
}: CommandPanelProps) {
  // 2. These states are now perfectly contained inside this component!
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // 3. The dynamic suggestion engine moves here.
  const suggestions = useMemo(() => {
    const currentLabels = nodes.map(n => String(n.data.label));
    const allPossible: string[] = [];

    if (!input.trim()) {
      if (currentLabels.length === 0) return ['add Internet', 'create Web Server'];
      if (currentLabels.length === 1) return [`add Database`, `remove ${currentLabels[0]}`];
      if (currentLabels.length >= 2) return [`connect ${currentLabels[0]} to ${currentLabels[1]}`, `add Firewall`];
    }

    const commonTypes = ['Database', 'Firewall', 'Load Balancer', 'Router', 'Microservice', 'API'];
    commonTypes.forEach(t => {
      allPossible.push(`add ${t}`);
      allPossible.push(`create ${t}`);
      allPossible.push(`new ${t}`);
    });

    currentLabels.forEach(l => {
      allPossible.push(`remove ${l}`);
      allPossible.push(`delete ${l}`);
      allPossible.push(`drop ${l}`);
    });

    currentLabels.forEach(l1 => {
      currentLabels.forEach(l2 => {
        if (l1 !== l2) {
          allPossible.push(`connect ${l1} to ${l2}`);
          allPossible.push(`link ${l1} to ${l2}`);
        }
      });
    });

    edges.forEach(e => {
      const s = nodes.find(n => n.id === e.source)?.data.label;
      const t = nodes.find(n => n.id === e.target)?.data.label;
      if (s && t) {
        allPossible.push(`disconnect ${s} from ${t}`);
        allPossible.push(`unlink ${s} from ${t}`);
      }
    });

    return allPossible
      .filter(s => s.toLowerCase().includes(input.toLowerCase()))
      .slice(0, 4);
  }, [input, nodes, edges]);

  return (
    <div className="left-panel">
      {/* Header with Floating Help Menu */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', position: 'relative' }}>
        <h3 style={{ margin: 0, fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
          Architecture Command Center
        </h3>
        <button 
          onClick={() => setShowHelp(!showHelp)}
          style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}
        >
          {showHelp ? 'Hide Commands ▴' : 'View Commands ▾'}
        </button>

        {showHelp && (
          <div style={{ 
            position: 'absolute', bottom: '100%', right: 0, marginBottom: '12px',
            backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', 
            padding: '16px', fontSize: '13px', color: '#cbd5e1', zIndex: 20,
            boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <strong style={{ color: '#60a5fa', width: '85px', textAlign: 'right', marginRight: '12px' }}>Add:</strong> 
                <code style={{ backgroundColor: '#1e293b', padding: '4px 8px', borderRadius: '4px', color: '#e2e8f0', whiteSpace: 'nowrap' }}>add | create | new &lt;node&gt;</code>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <strong style={{ color: '#ef4444', width: '85px', textAlign: 'right', marginRight: '12px' }}>Remove:</strong> 
                <code style={{ backgroundColor: '#1e293b', padding: '4px 8px', borderRadius: '4px', color: '#e2e8f0', whiteSpace: 'nowrap' }}>remove | delete | drop &lt;node&gt;</code>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <strong style={{ color: '#10b981', width: '85px', textAlign: 'right', marginRight: '12px' }}>Connect:</strong> 
                <code style={{ backgroundColor: '#1e293b', padding: '4px 8px', borderRadius: '4px', color: '#e2e8f0', whiteSpace: 'nowrap' }}>connect | link &lt;A&gt; to &lt;B&gt;</code>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <strong style={{ color: '#f59e0b', width: '85px', textAlign: 'right', marginRight: '12px' }}>Disconnect:</strong> 
                <code style={{ backgroundColor: '#1e293b', padding: '4px 8px', borderRadius: '4px', color: '#e2e8f0', whiteSpace: 'nowrap' }}>disconnect | unlink &lt;A&gt; from &lt;B&gt;</code>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Input with Auto-Suggest */}
      <div style={{ position: 'relative' }}>
        {isInputFocused && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '8px',
            backgroundColor: '#1e293b', border: '1px solid #3b82f6', borderRadius: '8px',
            overflow: 'hidden', boxShadow: '0 -10px 15px -3px rgba(0, 0, 0, 0.3)', zIndex: 10
          }}>
            {suggestions.map((s, idx) => (
              <div
                key={idx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setInput(s);
                  setIsInputFocused(false);
                }}
                style={{
                  padding: '10px 16px', cursor: 'pointer', color: '#e2e8f0', fontSize: '14px',
                  borderBottom: idx === suggestions.length - 1 ? 'none' : '1px solid #334155'
                }}
              >
                <span style={{ color: '#3b82f6', marginRight: '8px', fontWeight: 'bold' }}>↵</span> {s}
              </div>
            ))}
          </div>
        )}

        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onCommandSubmit}
          disabled={isLocked}
          placeholder="e.g., 'create Database' or 'link Internet to Database' (Press Enter)"
          className="command-input"
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setTimeout(() => setIsInputFocused(false), 200)}
        />
      </div>
      
      {/* Terminal-style Chat Log */}
      <div className="chat-log">
        {messages.map((msg, idx) => {
          const isError = msg.toLowerCase().includes('error');
          const isSuccess = msg.toLowerCase().includes('completed') || msg.toLowerCase().includes('connected');
          const textColor = isError ? '#ef4444' : (isSuccess ? '#10b981' : '#cbd5e1');

          return (
            <div key={idx} style={{ marginBottom: '8px', borderBottom: idx === messages.length - 1 ? 'none' : '1px solid #1e293b', paddingBottom: '8px', color: textColor, display: 'flex' }}>
              <span style={{ color: '#475569', marginRight: '12px', minWidth: '24px', textAlign: 'right', fontSize: '12px', paddingTop: '2px' }}>
                {messages.length - idx}.
              </span>
              <span style={{ lineHeight: '1.4' }}>{msg}</span>
            </div>
          )
        })}
      </div>
    </div>
  );
}