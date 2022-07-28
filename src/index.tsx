import 'stop-runaway-react-effects/hijack';

import React from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from "@sentry/react";
import './index.css';
import App from './App';

if (process.env.REACT_APP_SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.REACT_APP_SENTRY_DSN,
        tracesSampleRate: 0.0,
    });
}

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<React.StrictMode>
        <Sentry.ErrorBoundary fallback={<p>An unexpected error has occurred. We've been notified and will fix it</p>} showDialog>
            <App/>
        </Sentry.ErrorBoundary>
    </React.StrictMode>);
}