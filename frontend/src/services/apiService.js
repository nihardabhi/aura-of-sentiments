import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    if (process.env.REACT_APP_DEBUG === 'true') {
      console.log('API Request:', config);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    if (process.env.REACT_APP_DEBUG === 'true') {
      console.log('API Response:', response);
    }
    return response;
  },
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const processText = async (text, options = {}) => {
  try {
    const controller = new AbortController();
    const timeoutId = options.timeout ? 
      setTimeout(() => controller.abort(), options.timeout) : null;

    const response = await apiClient.post(
      '/process_text',
      { text },
      {
        signal: options.signal || controller.signal,
      }
    );

    if (timeoutId) clearTimeout(timeoutId);

    return response.data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
};

export const checkHealth = async () => {
  try {
    const response = await apiClient.get('/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    return { status: 'error' };
  }
};

export const getStatus = async () => {
  try {
    const response = await apiClient.get('/status');
    return response.data;
  } catch (error) {
    console.error('Status check failed:', error);
    return { status: 'error' };
  }
};