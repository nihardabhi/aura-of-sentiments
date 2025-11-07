import React from 'react';
import { motion } from 'framer-motion';

const Controls = ({ isRecording, onStartStop, disabled }) => {
  return (
    <motion.div 
      className="controls"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.button
        className={`control-button ${isRecording ? 'recording' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={onStartStop}
        disabled={disabled}
        whileHover={!disabled ? { scale: 1.05 } : {}}
        whileTap={!disabled ? { scale: 0.95 } : {}}
      >
        <div className="button-content">
          {isRecording ? (
            <>
              <span className="recording-indicator"></span>
              <span>Stop Recording</span>
            </>
          ) : disabled ? (
            <span>Connecting...</span>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span>Start Recording</span>
            </>
          )}
        </div>
      </motion.button>
      
      {isRecording && (
        <motion.div
          className="recording-status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="pulse"></span>
          <span>Listening...</span>
        </motion.div>
      )}
      
      <motion.div className="controls-hint">
        {!isRecording && !disabled && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 1 }}
          >
            Click to start speaking and watch your emotions come alive
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
};

export default Controls;