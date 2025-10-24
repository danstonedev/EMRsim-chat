import React from 'react';

/**
 * Debug component to visualize transcript data regardless of rendering issues
 */
const TranscriptDebugger = ({ transcripts = [] }) => {
  if (transcripts.length === 0) {
    return (
      <div className="transcript-debugger empty">
        <p>No transcripts available. If you're speaking but nothing appears here, 
        there might be an issue with transcript reception.</p>
      </div>
    );
  }

  return (
    <div className="transcript-debugger">
      <h4>Transcript Data ({transcripts.length} items):</h4>
      <pre style={{ 
        maxHeight: '200px', 
        overflow: 'auto',
        background: '#f8f9fa',
        padding: '10px',
        borderRadius: '4px',
        fontSize: '12px'
      }}>
        {JSON.stringify(transcripts, null, 2)}
      </pre>
    </div>
  );
};

export default TranscriptDebugger;
