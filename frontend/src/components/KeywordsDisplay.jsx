import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const KeywordsDisplay = ({ keywords, sentiment, energy }) => {
  // Calculate dynamic properties for keywords
  const getKeywordStyle = (index) => {
    const size = 1 + (Math.random() * 0.5) + (energy * 0.3);
    const hue = sentiment > 0 ? 120 : sentiment < 0 ? 0 : 60;
    const saturation = Math.abs(sentiment) * 100;
    const lightness = 50 + (energy * 20);
    
    return {
      fontSize: `${size}rem`,
      color: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
      filter: `brightness(${1 + energy * 0.5})`
    };
  };

  return (
    <motion.div 
      className="keywords-display"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h3>Key Topics</h3>
      <div className="keywords-cloud">
        <AnimatePresence mode="popLayout">
          {keywords.map((keyword, index) => (
            <motion.span
              key={`${keyword}-${index}`}
              className="keyword-tag"
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
                  delay: index * 0.1
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
              style={getKeywordStyle(index)}
            >
              {keyword}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      {keywords.length === 0 && (
        <motion.p
          className="keywords-empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
        >
          Keywords will appear as you speak...
        </motion.p>
      )}
    </motion.div>
  );
};

export default KeywordsDisplay;