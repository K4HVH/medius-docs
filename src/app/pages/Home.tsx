import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { GridBackground } from '../../components/surfaces/GridBackground';
import { Card, CardHeader } from '../../components/surfaces/Card';
import '../../styles/docs.css';

const Home: Component = () => {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <GridBackground />
      <div class="content" style={{
        display: 'flex',
        "flex-direction": 'column',
        "align-items": 'center',
        "justify-content": 'center',
        height: '100%',
        padding: 'var(--g-spacing-lg)',
      }}>
        <div style={{
          "max-width": '600px',
          width: '100%',
          display: 'flex',
          "flex-direction": 'column',
          gap: 'var(--g-spacing-lg)',
          "text-align": 'center',
        }}>
          <div>
            <h1 style={{ "margin-bottom": 'var(--g-spacing-sm)' }}>Medius</h1>
            <p class="text-lg">
              Documentation for the Medius box and Rust library.
            </p>
          </div>

          <div class="docs-grid">
            <A href="/native" style={{ "text-decoration": "none" }}>
              <Card interactive padding="normal">
                <CardHeader
                  title="Native API"
                  subtitle="Binary control protocol"
                />
              </Card>
            </A>
            <A href="/library" style={{ "text-decoration": "none" }}>
              <Card interactive padding="normal">
                <CardHeader
                  title="Rust Library"
                  subtitle="Official Rust client"
                />
              </Card>
            </A>
            <A href="/bindings" style={{ "text-decoration": "none" }}>
              <Card interactive padding="normal">
                <CardHeader
                  title="Bindings"
                  subtitle="C, C++ and Python clients"
                />
              </Card>
            </A>
            <A href="/dashboard" style={{ "text-decoration": "none" }}>
              <Card interactive padding="normal">
                <CardHeader
                  title="Dashboard"
                  subtitle="Connect, view and flash a box"
                />
              </Card>
            </A>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
