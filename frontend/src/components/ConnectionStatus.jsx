import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ConnectionStatus = ({ deepgramStatus, apiStatus, errors }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
      case 'ready':
        return '#22c55e';
      case 'connecting':
      case 'processing':
        return '#eab308';
      case 'disconnected':
      case 'error':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'ready':
        return 'Ready';
      case 'connecting':
        return 'Connecting...';
      case 'processing':
        return 'Processing...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="connection-status">
      <div className="status-indicators">
        <motion.div 
          className="status-item"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <span 
            className="status-dot" 
            style={{ backgroundColor: getStatusColor(deepgramStatus) }}
          />
          <span className="status-label">Deepgram</span>
          <span className="status-text">{getStatusText(deepgramStatus)}</span>
        </motion.div>
        
        <motion.div 
          className="status-item"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <span 
            className="status-dot" 
            style={{ backgroundColor: getStatusColor(apiStatus) }}
          />
          <span className="status-label">AI API</span>
          <span className="status-text">{getStatusText(apiStatus)}</span>
        </motion.div>
      </div>
      
      <AnimatePresence>
        {errors.length > 0 && (
          <motion.div 
            className="error-messages"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {errors.map((error, index) => (
              <motion.div 
                key={`${error.type}-${error.timestamp}`}
                className="error-message"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.1 }}
              >
                <span className="error-type">{error.type}:</span>
                <span className="error-text">{error.message}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ConnectionStatus;