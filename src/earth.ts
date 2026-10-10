import * as THREE from 'three';
import { locationCatalog, type GeoLocation } from './data';

type EarthControls = {
  canvasHost: HTMLElement;
  searchInput: HTMLInputElement;
  clearBtn: HTMLButtonElement;
  titleEl: HTMLElement;
  kindEl: HTMLElement;
  latEl: HTMLElement;
  lonEl: HTMLElement;
  elevEl: HTMLElement;
  simTime: HTMLElement;
  locationListEl: HTMLElement;
  toggleButtons: HTMLButtonElement[];
  resetButton: HTMLButtonElement;
  toggleRotationButton: HTMLButtonElement;
  focusHomeButton: HTMLButtonElement;
  fullscreenButton: HTMLButtonElement;
};

type LayerState = {
  atmosphere: boolean;
  clouds: boolean;
  grid: boolean;
  lights: boolean;
};

const clamp = THREE.MathUtils.clamp;

export class EarthExplorer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private earthGroup: THREE.Group;
  private earthMesh: THREE.Mesh;
  private atmosphere: THREE.Mesh;
  private cloudMesh: THREE.Mesh;
  private grid: THREE.LineSegments;
  private cityLights: THREE.Mesh;
  private pointerDown = false;
  private targetRotationX = 0.45;
  private targetRotationY = 0.85;
  private currentRotationX = 0.45;
  private currentRotationY = 0.85;
  private autoRotate = true;
  private simulationSpeed = 20;
  private baseDate = new Date(Date.now());
  private layerState: LayerState = {
    atmosphere: true,
    clouds: true,
    grid: true,
    lights: true,
  };
  private controls: EarthControls;
  private searchTerm = '';
  private focusItem: GeoLocation | null = null;

  constructor(controls: EarthControls) {
    this.controls = controls;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x02070d, 1);
    this.controls.canvasHost.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x02070d, 5, 12);

    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0.35, 4.2);

    const ambient = new THREE.AmbientLight(0x7ea8ff, 0.75);
    this.scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.9);
    sunLight.position.set(4, 1.2, 2.5);
    this.scene.add(sunLight);

    this.earthGroup = new THREE.Group();
    this.scene.add(this.earthGroup);

    const earthTexture = this.createEarthTexture();
    const earthMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: earthTexture },
        uSunDirection: { value: new THREE.Vector3(0.9, 0.2, 0.3).normalize() },
        uNightTexture: { value: this.createNightTexture() },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;

        void main() {
          vUv = uv;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform sampler2D uNightTexture;
        uniform vec3 uSunDirection;
        varying vec2 vUv;
        varying vec3 vNormal;

        void main() {
          vec3 normal = normalize(vNormal);
          float dayFactor = clamp(dot(normal, normalize(uSunDirection)), 0.0, 1.0);
          vec4 base = texture2D(uTexture, vUv);
          vec4 night = texture2D(uNightTexture, vUv);
          vec3 litColor = mix(night.rgb * 0.5, base.rgb, smoothstep(0.0, 0.6, dayFactor));
          vec3 finalColor = mix(base.rgb * 0.18, litColor, smoothstep(0.0, 1.0, dayFactor + 0.15));
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });

    this.earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1.55, 160, 160), earthMaterial);
    this.earthGroup.add(this.earthMesh);

    const atmosphereMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDirection;
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.8 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          vec3 color = vec3(0.2, 0.55, 1.0);
          float alpha = intensity * 0.66;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
    this.atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.64, 80, 80), atmosphereMaterial);
    this.earthGroup.add(this.atmosphere);

    const cloudTexture = this.createCloudTexture();
    const cloudMaterial = new THREE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    this.cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(1.585, 96, 96), cloudMaterial);
    this.earthGroup.add(this.cloudMesh);

    const cityLightsTexture = this.createCityLightTexture();
    this.cityLights = new THREE.Mesh(
      new THREE.SphereGeometry(1.60, 96, 96),
      new THREE.MeshBasicMaterial({
        map: cityLightsTexture,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.earthGroup.add(this.cityLights);

    this.grid = this.createGrid();
    this.scene.add(this.grid);

    this.addStars();
    this.setupInteractions();
    this.bindUI();
    this.updateLocationList();
    this.updateInfo('Earth', 'Planet', 0, 0, 0);
    this.applyLayerState();
  }

  private addStars() {
    const positions: number[] = [];
    const colors: number[] = [];
    for (let i = 0; i < 1800; i += 1) {
      const radius = 18 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      positions.push(x, y, z);
      const color = new THREE.Color().setHSL(0.6 + Math.random() * 0.2, 0.8, 0.75 + Math.random() * 0.2);
      colors.push(color.r, color.g, color.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
    });

    const stars = new THREE.Points(geometry, material);
    this.scene.add(stars);
  }

  private createGrid(): THREE.LineSegments {
    const vertices: number[] = [];
    for (let lat = -90; lat <= 90; lat += 15) {
      for (let lon = -180; lon <= 180; lon += 15) {
        const p0 = this.latLonToVector(lat, lon, 1.72);
        const p1 = this.latLonToVector(lat, lon + 15, 1.72);
        vertices.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      }
    }
    for (let lon = -180; lon <= 180; lon += 15) {
      for (let lat = -90; lat <= 90; lat += 15) {
        const p0 = this.latLonToVector(lat, lon, 1.72);
        const p1 = this.latLonToVector(lat + 15, lon, 1.72);
        vertices.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.LineBasicMaterial({ color: 0x7ecbff, transparent: true, opacity: 0.15 });
    return new THREE.LineSegments(geometry, material);
  }

  private setupInteractions() {
    const handlePointerMove = (event: PointerEvent) => {
      if (!this.pointerDown) return;
      const dx = event.clientX - (this as any)._lastPointerX;
      const dy = event.clientY - (this as any)._lastPointerY;
      (this as any)._lastPointerX = event.clientX;
      (this as any)._lastPointerY = event.clientY;
      this.targetRotationY += dx * 0.005;
      this.targetRotationX += dy * 0.005;
      this.targetRotationX = clamp(this.targetRotationX, -1.35, 1.35);
    };

    this.renderer.domElement.addEventListener('pointerdown', (event) => {
      this.pointerDown = true;
      (this as any)._lastPointerX = event.clientX;
      (this as any)._lastPointerY = event.clientY;
      this.renderer.domElement.setPointerCapture(event.pointerId);
    });

    this.renderer.domElement.addEventListener('pointermove', handlePointerMove);

    this.renderer.domElement.addEventListener('pointerup', () => {
      this.pointerDown = false;
    });

    this.renderer.domElement.addEventListener('pointerleave', () => {
      this.pointerDown = false;
    });

    this.renderer.domElement.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        this.camera.position.z = clamp(this.camera.position.z + event.deltaY * 0.002, 2.6, 7.5);
      },
      { passive: false }
    );
  }

  private bindUI() {
    this.controls.searchInput.addEventListener('input', () => {
      this.searchTerm = this.controls.searchInput.value.trim().toLowerCase();
      this.updateLocationList();
    });

    this.controls.clearBtn.addEventListener('click', () => {
      this.controls.searchInput.value = '';
      this.searchTerm = '';
      this.updateLocationList();
      this.controls.searchInput.focus();
    });

    this.controls.toggleButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const layer = button.dataset.layer as keyof LayerState | undefined;
        if (!layer) return;
        this.layerState[layer] = !this.layerState[layer];
        button.classList.toggle('active', this.layerState[layer]);
        this.applyLayerState();
      });
    });

    this.controls.resetButton.addEventListener('click', () => {
      this.targetRotationX = 0.45;
      this.targetRotationY = 0.85;
      this.camera.position.set(0, 0.35, 4.2);
      this.updateInfo('Earth', 'Planet', 0, 0, 0);
      this.focusItem = null;
    });

    this.controls.toggleRotationButton.addEventListener('click', () => {
      this.autoRotate = !this.autoRotate;
      this.controls.toggleRotationButton.textContent = this.autoRotate ? 'Pause' : 'Resume';
    });

    this.controls.focusHomeButton.addEventListener('click', () => {
      this.targetRotationX = 0.45;
      this.targetRotationY = 0.85;
      this.updateInfo('Earth', 'Planet', 0, 0, 0);
      this.focusItem = null;
    });

    this.controls.fullscreenButton.addEventListener('click', async () => {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    });
  }

  private applyLayerState() {
    this.atmosphere.visible = this.layerState.atmosphere;
    this.cloudMesh.visible = this.layerState.clouds;
    this.grid.visible = this.layerState.grid;
    this.cityLights.visible = this.layerState.lights;
  }

  private createEarthTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    const ocean = ctx.createLinearGradient(0, 0, 0, canvas.height);
    ocean.addColorStop(0, '#103d63');
    ocean.addColorStop(0.4, '#0d587f');
    ocean.addColorStop(0.75, '#0b4a73');
    ocean.addColorStop(1, '#041f2b');
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawNoise = (color: string, alpha: number, size: number) => {
      for (let i = 0; i < 6000; i += 1) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const r = Math.random() * size + 0.5;
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    drawNoise('#3ab6ca', 0.12, 2.4);
    drawNoise('#a1d6d0', 0.08, 3.5);

    const continentStyle = [
      { fill: '#7cae58', points: [[0.08,0.46],[0.13,0.33],[0.20,0.25],[0.31,0.27],[0.40,0.20],[0.47,0.21],[0.53,0.26],[0.48,0.40],[0.43,0.50],[0.38,0.54],[0.31,0.60],[0.22,0.67],[0.15,0.64],[0.10,0.55]] },
      { fill: '#5a9b47', points: [[0.53,0.30],[0.60,0.24],[0.68,0.23],[0.76,0.29],[0.82,0.39],[0.79,0.48],[0.70,0.56],[0.62,0.58],[0.56,0.54],[0.50,0.45]] },
      { fill: '#7eaf63', points: [[0.52,0.66],[0.61,0.59],[0.73,0.64],[0.78,0.72],[0.70,0.82],[0.60,0.85],[0.53,0.78],[0.49,0.71]] },
      { fill: '#8dbb70', points: [[0.28,0.66],[0.35,0.59],[0.41,0.63],[0.43,0.71],[0.38,0.79],[0.32,0.82],[0.28,0.77]] },
      { fill: '#b3d57d', points: [[0.72,0.51],[0.80,0.49],[0.85,0.56],[0.82,0.62],[0.73,0.60]] },
      { fill: '#8ba56c', points: [[0.09,0.80],[0.12,0.75],[0.18,0.75],[0.20,0.82],[0.16,0.86],[0.11,0.84]] },
      { fill: '#a3b9d9', points: [[0.24,0.18],[0.30,0.15],[0.39,0.17],[0.42,0.23],[0.34,0.27],[0.27,0.24]] },
      { fill: '#dfeaf5', points: [[0.05,0.90],[0.14,0.90],[0.23,0.94],[0.33,0.97],[0.18,1.00],[0.07,0.96]] },
    ];

    for (const land of continentStyle) {
      ctx.beginPath();
      land.points.forEach(([x, y], i) => {
        const px = x * canvas.width;
        const py = y * canvas.height;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = land.fill;
      ctx.fill();
    }

    const mountainStroke = (points: Array<[number, number]>, color: string, alpha: number) => {
      ctx.beginPath();
      points.forEach(([x, y], index) => {
        const px = x * canvas.width;
        const py = y * canvas.height;
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    mountainStroke([[0.12,0.50],[0.16,0.47],[0.21,0.52],[0.26,0.48],[0.31,0.54]], '#5b7f48', 0.3);
    mountainStroke([[0.57,0.43],[0.62,0.39],[0.69,0.46],[0.73,0.42],[0.78,0.47]], '#547b44', 0.28);
    mountainStroke([[0.34,0.67],[0.39,0.63],[0.43,0.68],[0.48,0.64]], '#628c46', 0.28);

    ctx.fillStyle = '#b9d8e8';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.14);
    ctx.globalAlpha = 1;

    const drawIceCap = (x: number, y: number, w: number, h: number) => {
      ctx.beginPath();
      ctx.ellipse(x * canvas.width, y * canvas.height, w * canvas.width, h * canvas.height, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#edf7ff';
      ctx.fill();
    };

    drawIceCap(0.32, 0.14, 0.15, 0.08);
    drawIceCap(0.67, 0.13, 0.09, 0.05);
    drawIceCap(0.5, 0.95, 0.2, 0.08);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  private createNightTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Night texture unavailable');
    ctx.fillStyle = '#050b1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 800; i += 1) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = 1.5 + Math.random() * 3.5;
      ctx.beginPath();
      ctx.fillStyle = `rgba(220, 245, 255, ${0.2 + Math.random() * 0.9})`;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  private createCloudTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cloud canvas unavailable');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 180; i += 1) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = 30 + Math.random() * 90;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, 'rgba(255,255,255,0.92)');
      gradient.addColorStop(0.35, 'rgba(255,255,255,0.75)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  private createCityLightTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('City lights canvas unavailable');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const points = [
      [0.28, 0.26], [0.30, 0.20], [0.40, 0.33], [0.64, 0.33], [0.77, 0.24], [0.74, 0.58], [0.58, 0.68], [0.34, 0.63],
      [0.46, 0.27], [0.68, 0.29], [0.51, 0.48], [0.60, 0.50]
    ];

    for (const [x, y] of points) {
      const px = x * canvas.width;
      const py = y * canvas.height;
      const radius = 18 + Math.random() * 30;
      const gradient = ctx.createRadialGradient(px, py, 2, px, py, radius);
      gradient.addColorStop(0, 'rgba(255,244,156,1)');
      gradient.addColorStop(0.5, 'rgba(255,214,85,0.9)');
      gradient.addColorStop(1, 'rgba(255,214,85,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  private latLonToVector(lat: number, lon: number, radius = 1.65): THREE.Vector3 {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return new THREE.Vector3(x, y, z);
  }

  private updateInfo(name: string, kind: string, lat: number, lon: number, altitude: number) {
    this.controls.titleEl.textContent = name;
    this.controls.kindEl.textContent = kind;
    this.controls.latEl.textContent = `${lat.toFixed(1)}°`;
    this.controls.lonEl.textContent = `${lon.toFixed(1)}°`;
    this.controls.elevEl.textContent = altitude > 0 ? `${Math.round(altitude)} m` : `${Math.abs(Math.round(altitude))} m`;
  }

  private updateLocationList() {
    const q = this.searchTerm;
    const filtered = locationCatalog.filter((item) => {
      return item.name.toLowerCase().includes(q) || item.type.toLowerCase().includes(q);
    });

    const items = filtered.slice(0, 12).map((item) => {
      return `
        <button class="location-item" type="button" data-name="${item.name}">
          <span>
            <span class="location-name">${item.name}</span>
            <span class="location-kind">${item.type}</span>
          </span>
          <span>${item.lat.toFixed(0)}°</span>
        </button>
      `;
    }).join('');

    this.controls.locationListEl.innerHTML = items || '<div class="empty-state">No match found</div>';

    this.controls.locationListEl.querySelectorAll('.location-item').forEach((button) => {
      button.addEventListener('click', () => {
        const name = button.getAttribute('data-name');
        const match = locationCatalog.find((item) => item.name === name);
        if (match) this.focusLocation(match);
      });
    });
  }

  private focusLocation(item: GeoLocation) {
    this.focusItem = item;
    this.targetRotationY = -((item.lon + 180) * Math.PI) / 180 + Math.PI / 2;
    this.targetRotationX = (item.lat / 90) * 0.8;
    this.updateInfo(item.name, item.type, item.lat, item.lon, item.alt);
  }

  private getSolarDirection(date: Date): THREE.Vector3 {
    const julian = (date.getTime() / 86400000) + 2440587.5;
    const days = julian - 2451545.0;
    const declination = (23.44 * Math.PI / 180) * Math.sin((2 * Math.PI * (days + 10) / 365.25));
    const daySecs = date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds();
    const angle = ((daySecs / 86400) * 2 * Math.PI) - Math.PI;
    return new THREE.Vector3(Math.cos(declination) * Math.cos(angle), Math.sin(declination), Math.cos(declination) * Math.sin(angle)).normalize();
  }

  public start() {
    const tick = () => {
      const now = new Date();
      this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.08;
      this.currentRotationX += (this.targetRotationX - this.currentRotationX) * 0.08;

      if (this.autoRotate) {
        this.currentRotationY += 0.0035 * (this.simulationSpeed / 20);
        this.targetRotationY = this.currentRotationY;
      }

      this.earthMesh.rotation.y = this.currentRotationY;
      this.earthMesh.rotation.x = this.currentRotationX;
      this.atmosphere.rotation.copy(this.earthMesh.rotation);
      this.cloudMesh.rotation.y = this.currentRotationY + 0.18;
      this.cloudMesh.rotation.x = this.currentRotationX;
      this.cityLights.rotation.copy(this.earthMesh.rotation);
      this.grid.rotation.copy(this.earthMesh.rotation);

      const sunDirection = this.getSolarDirection(now);
      (this.earthMesh.material as THREE.ShaderMaterial).uniforms.uSunDirection.value = sunDirection;
      (this.atmosphere.material as THREE.ShaderMaterial).uniforms.uSunDirection.value = sunDirection;

      const hh = now.getUTCHours().toString().padStart(2, '0');
      const mm = now.getUTCMinutes().toString().padStart(2, '0');
      this.controls.simTime.textContent = `${hh}:${mm} UTC`;

      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(tick);
    };
    tick();
  }

  public handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
}
