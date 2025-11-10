const Controls = ({ isRecording, onStartStop, disabled }) => {
  return (
    <div className="controls-wrapper" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      gap: '20px'
    }}>
      {/* Circular Record Button */}
      <div className="record-button-container" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div className={`record-button-wrapper ${isRecording ? 'recording' : ''}`}>
          <button
            className={`record-button ${isRecording ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={onStartStop}
            disabled={disabled}
            style={{
              transform: 'none',
              transition: 'background-color 0.3s, box-shadow 0.3s'
            }}
          >
            <div className="button-inner">
              {isRecording ? (
                <>
                  <span className="button-icon">⏹️</span>
                  <span className="button-text">STOP</span>
                </>
              ) : (
                <>
                  <span className="button-icon">🎤</span>
                  <span className="button-text">RECORD</span>
                </>
              )}
            </div>
          </button>
        </div>
      </div>
      
      {/* Status Display */}
      <div className="control-stats">
        <div className="stat-item">
          <span className="stat-label">STATUS</span>
          <span className={`stat-value ${isRecording ? 'active' : ''}`}>
            {isRecording ? 'Recording' : 'Ready'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Controls;