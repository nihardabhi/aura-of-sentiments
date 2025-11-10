import { motion, AnimatePresence } from 'framer-motion';

const KeywordsDisplay = ({ keywords, sentiment, energy }) => {
  return (
    <>
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-icon">🏷️</span>
          <h3>Keyword Analysis</h3>
        </div>
        <div className="keyword-count">{keywords.length} topics</div>
      </div>
      <div className="panel-body">
        <div className="keywords-container">
          {keywords.length === 0 ? (
            <motion.div 
              className="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="empty-icon">💭</div>
              <p>Keywords will appear as you speak...</p>
            </motion.div>
          ) : (
            <div className="keywords-3d-cloud">
              <AnimatePresence mode="popLayout">
                {keywords.map((keyword, index) => (
                  <motion.div
                    key={`${keyword}-${index}`}
                    className="keyword-3d"
                    initial={{ 
                      opacity: 0, 
                      scale: 0, 
                      y: 20,
                      rotateZ: -180
                    }}
                    animate={{ 
                      opacity: 1, 
                      scale: 1, 
                      y: 0,
                      rotateZ: 0,
                      transition: {
                        type: "spring",
                        stiffness: 260,
                        damping: 20,
                        delay: index * 0.15
                      }
                    }}
                    exit={{ 
                      opacity: 0, 
                      scale: 0,
                      transition: { duration: 0.2 }
                    }}
                    whileHover={{ 
                      scale: 1.1,
                      rotate: [0, -5, 5, -5, 0],
                      transition: { duration: 0.3 }
                    }}
                    style={{
                      '--delay': `${index * 0.1}s`,
                      '--size': `${1 + Math.random() * 0.4}`,
                    }}
                  >
                    <span className="keyword-text">{keyword}</span>
                    <div className="keyword-glow"></div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default KeywordsDisplay;