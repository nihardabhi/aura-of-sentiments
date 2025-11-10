import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TranscriptDisplay = ({ transcript, isProcessing }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcript]);

  return (
    <>
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-icon">📝</span>
          <h3>Live Transcript</h3>
        </div>
        {isProcessing && (
          <div className="processing-badge">
            <span className="processing-dot"></span>
            Processing
          </div>
        )}
      </div>
      <div className="panel-body">
        <div className="transcript-scroll" ref={containerRef}>
          {transcript.length === 0 ? (
            <motion.div 
              className="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="empty-icon">🎤</div>
              <p>Your words will appear here in real-time</p>
              <p className="empty-hint">Press the record button to begin</p>
            </motion.div>
          ) : (
            <AnimatePresence>
              {transcript.map((item, index) => (
                <motion.div
                  key={`${item.timestamp}-${index}`}
                  className="transcript-entry"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="transcript-meta">
                    <span className="transcript-time">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="transcript-text">{item.text}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </>
  );
};

export default TranscriptDisplay;