import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import './styles/app.css';
import './styles/adaptive.css';
import './styles/draw.css';
import './styles/hold-recording.css';
import './styles/inline-recording.css';

createRoot(document.getElementById('root')).render(<App />);
