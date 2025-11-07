import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TranscriptDisplay = ({ transcript, isProcessing }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcript]);

  return (
    <motion.div 
      className="transcript-display"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="transcript-header">
        <h3>Live Transcript</h3>
        {isProcessing && (
          <motion.div
            className="processing-dot"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>
      <div className="transcript-content" ref={containerRef}>
        <AnimatePresence>
          {transcript.map((item, index) => (
            <motion.p
              key={`${item.timestamp}-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="transcript-item"
            >
              <span className="transcript-time">
                {new Date(item.timestamp).toLocaleTimeString()}
              </span>
              <span className="transcript-text">{item.text}</span>
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default TranscriptDisplay;