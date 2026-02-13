import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err, info) {
    console.error('ErrorBoundary caught:', err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: '#0a0a1a', color: '#e0e0e0',
          fontFamily: 'system-ui, sans-serif', padding: 24, textAlign: 'center',
        }}>
          <h1 style={{ fontSize: 28, color: '#00ff88', marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ color: '#888', marginBottom: 24, maxWidth: 400 }}>
            AtlasIQ encountered an unexpected error. Please refresh to try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 32px', border: '2px solid #00ff88', borderRadius: 50,
              background: 'transparent', color: '#00ff88', fontSize: 16, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
