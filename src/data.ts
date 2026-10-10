import { EarthExplorer } from './earth';
import './styles.css';

const app = document.querySelector('#app');
if (!app) {
  throw new Error('Root app element missing');
}

const root = document.createElement('div');
root.className = 'app-shell';
app.appendChild(root);

const canvasHost = document.createElement('div');
canvasHost.className = 'canvas-host';
root.appendChild(canvasHost);

const hud = document.createElement('div');
hud.className = 'hud';
root.appendChild(hud);

const topbar = document.createElement('header');
topbar.className = 'topbar';

topbar.innerHTML = `
  <div class="brand-wrap" aria-label="Earth Reality brand">
    <span class="brand-swatch" aria-hidden="true"></span>
    <span class="brand-text">EARTH REALITY</span>
  </div>
  <div class="search-box" role="search">
    <input id="location-search" type="search" placeholder="Search cities, regions, oceans..." aria-label="Search locations" />
    <button id="location-clear" type="button">Clear</button>
  </div>
`;

const sidebar = document.createElement('aside');
sidebar.className = 'sidebar';

const infoCard = document.createElement('section');
infoCard.className = 'panel-card';
infoCard.innerHTML = `
  <div class="panel-header">
    <span>Location</span>
  </div>
  <div class="info-body">
    <div class="title-stack">
      <h2 id="info-name">Earth</h2>
      <span id="info-kind">Planet</span>
    </div>
    <div class="metric-grid">
      <div class="metric-box">
        <span class="metric-label">Latitude</span>
        <span id="lat-value" class="metric-value">0°</span>
      </div>
      <div class="metric-box">
        <span class="metric-label">Longitude</span>
        <span id="lon-value" class="metric-value">0°</span>
      </div>
      <div class="metric-box">
        <span class="metric-label">Elevation</span>
        <span id="elev-value" class="metric-value">0 m</span>
      </div>
      <div class="metric-box">
        <span class="metric-label">Time</span>
        <span id="sim-time" class="metric-value">12:00</span>
      </div>
    </div>
  </div>
`;

const layerCard = document.createElement('section');
layerCard.className = 'panel-card';
layerCard.innerHTML = `
  <div class="panel-header">
    <span>Layers</span>
  </div>
  <div class="button-grid">
    <button class="toggle-button active" data-layer="atmosphere" type="button">Atmosphere</button>
    <button class="toggle-button active" data-layer="clouds" type="button">Clouds</button>
    <button class="toggle-button active" data-layer="grid" type="button">Grid</button>
    <button class="toggle-button active" data-layer="lights" type="button">City lights</button>
  </div>
`;

const exploreCard = document.createElement('section');
exploreCard.className = 'panel-card';
exploreCard.innerHTML = `
  <div class="panel-header">
    <span>Explore</span>
  </div>
  <div id="location-list" class="location-list"></div>
`;

sidebar.append(infoCard, layerCard, exploreCard);

const bottomBar = document.createElement('div');
bottomBar.className = 'bottom-bar';

const status = document.createElement('div');
status.className = 'status-pill';
status.innerHTML = '<span class="status-dot"></span><span>Earth online</span>';

const actions = document.createElement('div');
actions.className = 'action-row';
actions.innerHTML = `
  <button id="reset-view" class="action-button" type="button">Reset</button>
  <button id="toggle-rotation" class="action-button" type="button">Pause</button>
  <button id="focus-home" class="action-button" type="button">Home</button>
  <button id="toggle-fullscreen" class="action-button" type="button">Fullscreen</button>
`;

bottomBar.append(status, actions);
hud.append(topbar, sidebar, bottomBar);
root.appendChild(canvasHost);

const searchInput = document.getElementById('location-search') as HTMLInputElement;
const clearBtn = document.getElementById('location-clear') as HTMLButtonElement;
const titleEl = document.getElementById('info-name') as HTMLElement;
const kindEl = document.getElementById('info-kind') as HTMLElement;
const latEl = document.getElementById('lat-value') as HTMLElement;
const lonEl = document.getElementById('lon-value') as HTMLElement;
const elevEl = document.getElementById('elev-value') as HTMLElement;
const simTime = document.getElementById('sim-time') as HTMLElement;

const explorer = new EarthExplorer({
  canvasHost,
  searchInput,
  clearBtn,
  titleEl,
  kindEl,
  latEl,
  lonEl,
  elevEl,
  simTime,
  locationListEl: document.getElementById('location-list') as HTMLElement,
  toggleButtons: Array.from(document.querySelectorAll('.toggle-button')) as HTMLButtonElement[],
  resetButton: document.getElementById('reset-view') as HTMLButtonElement,
  toggleRotationButton: document.getElementById('toggle-rotation') as HTMLButtonElement,
  focusHomeButton: document.getElementById('focus-home') as HTMLButtonElement,
  fullscreenButton: document.getElementById('toggle-fullscreen') as HTMLButtonElement,
});

window.addEventListener('resize', () => explorer.handleResize());

explorer.start();
