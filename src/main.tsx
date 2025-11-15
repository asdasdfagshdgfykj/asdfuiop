import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app.tsx';

// Находим корневой элемент и монтируем приложение
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);