import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/App.css';

const reportWebVitals = (metric) => {
  if (metric && process.env.NODE_ENV === 'development') {
    console.log(metric);
  }
};


if (!process.env.REACT_APP_DEEPGRAM_API_KEY) {
  console.warn(' REACT_APP_DEEPGRAM_API_KEY is not set in .env file');
}

if (!process.env.REACT_APP_BACKEND_URL) {
  console.warn(' REACT_APP_BACKEND_URL is not set in .env file, using default: http://localhost:8000');
}


const root = ReactDOM.createRoot(document.getElementById('root'));


root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


if (process.env.NODE_ENV === 'development') {
  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS(reportWebVitals);
    getFID(reportWebVitals);
    getFCP(reportWebVitals);
    getLCP(reportWebVitals);
    getTTFB(reportWebVitals);
  });
}