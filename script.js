<script>
    // ===== INITIALIZATION =====
    const state = {
      currentPage: 'home',
      currentColor: { r: 100, g: 149, b: 237 },
      recentColors: JSON.parse(localStorage.getItem('recentColors') || '[]'),
      savedColors: JSON.parse(localStorage.getItem('savedColors') || '[]'),
      sidebarCollapsed: false,
      currentMode: 'rgb',
      theme: localStorage.getItem('theme') || 'dark',
      imageColorHistory: JSON.parse(localStorage.getItem('imageColorHistory') || '[]'),
      currentImageColor: null,
      gameScore: { detective: 0, reflex: 0, memory: 0 },
      currentGame: null
    };

    // ===== THEME SYSTEM =====
    function initTheme() {
      document.documentElement.setAttribute('data-theme', state.theme);
      updateThemeLabel();
      
      document.getElementById('themeToggle').addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', state.theme);
        localStorage.setItem('theme', state.theme);
        updateThemeLabel();
      });
    }

    function updateThemeLabel() {
      const label = document.querySelector('.theme-toggle-label');
      if (label) {
        label.textContent = state.theme === 'dark' ? 'Light Mode' : 'Dark Mode';
      }
    }

    // ===== UTILITY FUNCTIONS =====
    function rgbToHex(r, g, b) {
      return '#' + [r, g, b].map(x => {
        const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('').toUpperCase();
    }

    function hexToRgb(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    }

    function rgbToHsl(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    }

    function hslToRgb(h, s, l) {
      h /= 360; s /= 100; l /= 100;
      let r, g, b;

      if (s === 0) {
        r = g = b = l;
      } else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
      };
    }

    function rgbToCmyk(r, g, b) {
      let c = 1 - (r / 255);
      let m = 1 - (g / 255);
      let y = 1 - (b / 255);
      let k = Math.min(c, m, y);
      
      if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
      
      c = ((c - k) / (1 - k)) * 100;
      m = ((m - k) / (1 - k)) * 100;
      y = ((y - k) / (1 - k)) * 100;
      k = k * 100;
      
      return { c: Math.round(c), m: Math.round(m), y: Math.round(y), k: Math.round(k) };
    }

    function cmykToRgb(c, m, y, k) {
      c /= 100; m /= 100; y /= 100; k /= 100;
      return {
        r: Math.round(255 * (1 - c) * (1 - k)),
        g: Math.round(255 * (1 - m) * (1 - k)),
        b: Math.round(255 * (1 - y) * (1 - k))
      };
    }

    function getLuminance(r, g, b) {
      const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    function getContrastRatio(rgb1, rgb2) {
      const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
      const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    // ===== TOAST SYSTEM =====
    function showToast(message, type = 'success') {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      
      const icons = {
        success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
        error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
      };
      
      toast.innerHTML = `${icons[type]}${message}`;
      container.appendChild(toast);
      
      setTimeout(() => toast.remove(), 3000);
    }

    // ===== CONFETTI EFFECT =====
    function createConfetti() {
      const colors = ['#00d4aa', '#ff6b6b', '#7c5cff', '#ffd700', '#00bfff'];
      const container = document.createElement('div');
      container.className = 'confetti';
      document.body.appendChild(container);
      
      for (let i = 0; i < 50; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + 'vw';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = Math.random() * 0.5 + 's';
        piece.style.transform = `rotate(${Math.random() * 360}deg)`;
        container.appendChild(piece);
      }
      
      setTimeout(() => container.remove(), 3500);
    }

    // ===== NAVIGATION =====
    function navigateTo(page) {
      state.currentPage = page;
      
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
      });
      
      document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === `page-${page}`);
      });
      
      document.getElementById('sidebar').classList.remove('mobile-open');
    }

    // ===== SIDEBAR TOGGLE =====
    function toggleSidebar() {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      document.getElementById('sidebar').classList.toggle('collapsed', state.sidebarCollapsed);
      document.getElementById('mainContent').classList.toggle('expanded', state.sidebarCollapsed);
    }

    // ===== COLOR PICKER (HOME) =====
    function updateColorPreview() {
      const { r, g, b } = state.currentColor;
      const hex = rgbToHex(r, g, b);
      const hsl = rgbToHsl(r, g, b);
      
      document.getElementById('colorPreview').style.background = `rgb(${r}, ${g}, ${b})`;
      document.getElementById('hexValue').textContent = hex;
      document.getElementById('rgbValue').textContent = `rgb(${r}, ${g}, ${b})`;
      document.getElementById('rgbaValue').textContent = `rgba(${r}, ${g}, ${b}, 1)`;
      document.getElementById('hslValue').textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    }

    function initColorPicker() {
      const sliders = ['red', 'green', 'blue'];
      sliders.forEach((color, index) => {
        const slider = document.getElementById(`${color}Slider`);
        const valueDisplay = document.getElementById(`${color}Value`);
        
        slider.addEventListener('input', (e) => {
          const val = parseInt(e.target.value);
          valueDisplay.textContent = val;
          state.currentColor[['r', 'g', 'b'][index]] = val;
          updateColorPreview();
        });
      });
      
      document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const type = btn.dataset.copy;
          let value = '';
          
          switch(type) {
            case 'hex': value = document.getElementById('hexValue').textContent; break;
            case 'rgb': value = document.getElementById('rgbValue').textContent; break;
            case 'rgba': value = document.getElementById('rgbaValue').textContent; break;
            case 'hsl': value = document.getElementById('hslValue').textContent; break;
          }
          
          await navigator.clipboard.writeText(value);
          btn.classList.add('copied');
          showToast('Copied to clipboard!', 'success');
          setTimeout(() => btn.classList.remove('copied'), 1000);
        });
      });
      
      document.getElementById('saveColorBtn').addEventListener('click', () => {
        const hex = rgbToHex(state.currentColor.r, state.currentColor.g, state.currentColor.b);
        saveColor(hex);
        showToast('Color saved!', 'success');
      });
      
      renderRecentColors();
    }

    function renderRecentColors() {
      const container = document.getElementById('recentColors');
      container.innerHTML = '';
      
      state.recentColors.slice(0, 12).forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'recent-color';
        swatch.style.background = color;
        swatch.title = color;
        swatch.addEventListener('click', () => {
          const rgb = hexToRgb(color);
          if (rgb) {
            state.currentColor = rgb;
            document.getElementById('redSlider').value = rgb.r;
            document.getElementById('greenSlider').value = rgb.g;
            document.getElementById('blueSlider').value = rgb.b;
            document.getElementById('redValue').textContent = rgb.r;
            document.getElementById('greenValue').textContent = rgb.g;
            document.getElementById('blueValue').textContent = rgb.b;
            updateColorPreview();
          }
        });
        container.appendChild(swatch);
      });
    }

    function addRecentColor(hex) {
      if (!state.recentColors.includes(hex)) {
        state.recentColors.unshift(hex);
        if (state.recentColors.length > 20) state.recentColors.pop();
        localStorage.setItem('recentColors', JSON.stringify(state.recentColors));
        renderRecentColors();
      }
    }

    // ===== SAVED COLORS =====
    function saveColor(hex) {
      const color = {
        hex: hex,
        date: new Date().toISOString(),
        favorite: false
      };
      state.savedColors.unshift(color);
      localStorage.setItem('savedColors', JSON.stringify(state.savedColors));
      renderSavedColors();
      addRecentColor(hex);
    }

    function renderSavedColors() {
      const empty = document.getElementById('savedColorsEmpty');
      const grid = document.getElementById('savedColorsGrid');
      const clearBtn = document.getElementById('clearAllColors');
      
      if (state.savedColors.length === 0) {
        empty.style.display = 'block';
        grid.style.display = 'none';
        clearBtn.style.display = 'none';
        return;
      }
      
      empty.style.display = 'none';
      grid.style.display = 'grid';
      clearBtn.style.display = 'inline-flex';
      
      grid.innerHTML = '';
      
      state.savedColors.forEach((color, index) => {
        const card = document.createElement('div');
        card.className = 'saved-card';
        
        const date = new Date(color.date).toLocaleDateString();
        
        card.innerHTML = `
          <div class="saved-preview" style="background: ${color.hex}"></div>
          <div class="saved-info">
            <div class="saved-hex">${color.hex}</div>
            <div class="saved-date">${date}</div>
            <div class="saved-actions">
              <button data-action="copy" data-index="${index}" title="Copy">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
              <button data-action="favorite" data-index="${index}" class="${color.favorite ? 'favorited' : ''}" title="Favorite">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="${color.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
              <button data-action="delete" data-index="${index}" title="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        `;
        
        grid.appendChild(card);
      });
      
      grid.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          const index = parseInt(btn.dataset.index);
          
          switch(action) {
            case 'copy':
              navigator.clipboard.writeText(state.savedColors[index].hex);
              showToast('Copied!', 'success');
              break;
            case 'favorite':
              state.savedColors[index].favorite = !state.savedColors[index].favorite;
              localStorage.setItem('savedColors', JSON.stringify(state.savedColors));
              renderSavedColors();
              break;
            case 'delete':
              state.savedColors.splice(index, 1);
              localStorage.setItem('savedColors', JSON.stringify(state.savedColors));
              renderSavedColors();
              showToast('Color deleted', 'info');
              break;
          }
        });
      });
    }

    // ===== MODE TOGGLE =====
    function initModeToggle() {
      const tabs = document.querySelectorAll('.tabs .tab');
      const modeControls = {
        rgb: document.getElementById('rgbControls'),
        hsl: document.getElementById('hslControls'),
        cmyk: document.getElementById('cmykControls')
      };
      
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const mode = tab.dataset.mode;
          state.currentMode = mode;
          
          tabs.forEach(t => {
            t.classList.toggle('active', t.dataset.mode === mode);
            t.setAttribute('aria-selected', t.dataset.mode === mode);
          });
          
          Object.keys(modeControls).forEach(m => {
            modeControls[m].style.display = m === mode ? 'block' : 'none';
          });
        });
      });
      
      ['Red', 'Green', 'Blue'].forEach(color => {
        const slider = document.getElementById(`mode${color}Slider`);
        const value = document.getElementById(`mode${color}`);
        
        slider.addEventListener('input', () => {
          value.textContent = slider.value;
          updateModeColor();
        });
      });
      
      ['Hue', 'Sat', 'Light'].forEach(name => {
        const slider = document.getElementById(`mode${name}Slider`);
        const value = document.getElementById(`mode${name}`);
        
        slider.addEventListener('input', () => {
          const suffix = name === 'Hue' ? '' : '%';
          value.textContent = slider.value + suffix;
          updateModeColorFromHsl();
        });
      });
      
      ['Cyan', 'Magenta', 'Yellow', 'Key'].forEach(name => {
        const slider = document.getElementById(`mode${name}Slider`);
        const value = document.getElementById(`mode${name}`);
        
        slider.addEventListener('input', () => {
          value.textContent = slider.value + '%';
          updateModeColorFromCmyk();
        });
      });
      
      document.querySelectorAll('[data-copy^="mode"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const type = btn.dataset.copy;
          let value = '';
          
          switch(type) {
            case 'modeRgb': value = document.getElementById('modeRgbValue').textContent; break;
            case 'modeHsl': value = document.getElementById('modeHslValue').textContent; break;
            case 'modeCmyk': value = document.getElementById('modeCmykValue').textContent; break;
          }
          
          await navigator.clipboard.writeText(value);
          showToast('Copied!', 'success');
        });
      });

      // Initialize dynamic slider backgrounds
      updateHslSliderBackgrounds(219, 79, 66);
    }

    function updateHslSliderBackgrounds(h, s, l) {
      // Saturation gradient: from grey to full color
      const satStart = `hsl(${h}, 0%, ${l}%)`;
      const satEnd = `hsl(${h}, 100%, ${l}%)`;
      document.documentElement.style.setProperty('--sat-gradient', `linear-gradient(90deg, ${satStart}, ${satEnd})`);

      // Lightness gradient: black -> color -> white
      const lightStart = `hsl(${h}, ${s}%, 0%)`;
      const lightMid = `hsl(${h}, ${s}%, 50%)`;
      const lightEnd = `hsl(${h}, ${s}%, 100%)`;
      document.documentElement.style.setProperty('--light-gradient', `linear-gradient(90deg, ${lightStart}, ${lightMid}, ${lightEnd})`);
    }

    function updateModeColor() {
      const r = parseInt(document.getElementById('modeRedSlider').value);
      const g = parseInt(document.getElementById('modeGreenSlider').value);
      const b = parseInt(document.getElementById('modeBlueSlider').value);
      
      document.getElementById('modePreview').style.background = `rgb(${r}, ${g}, ${b})`;
      
      const hsl = rgbToHsl(r, g, b);
      const cmyk = rgbToCmyk(r, g, b);
      
      document.getElementById('modeRgbValue').textContent = `rgb(${r}, ${g}, ${b})`;
      document.getElementById('modeHslValue').textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
      document.getElementById('modeCmykValue').textContent = `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;

      // Update HSL slider values and backgrounds
      document.getElementById('modeHueSlider').value = hsl.h;
      document.getElementById('modeSatSlider').value = hsl.s;
      document.getElementById('modeLightSlider').value = hsl.l;
      document.getElementById('modeHue').textContent = hsl.h;
      document.getElementById('modeSat').textContent = hsl.s + '%';
      document.getElementById('modeLight').textContent = hsl.l + '%';

      updateHslSliderBackgrounds(hsl.h, hsl.s, hsl.l);
    }

    function updateModeColorFromHsl() {
      const h = parseInt(document.getElementById('modeHueSlider').value);
      const s = parseInt(document.getElementById('modeSatSlider').value);
      const l = parseInt(document.getElementById('modeLightSlider').value);
      
      const rgb = hslToRgb(h, s, l);
      
      document.getElementById('modePreview').style.background = `hsl(${h}, ${s}%, ${l}%)`;
      document.getElementById('modeRedSlider').value = rgb.r;
      document.getElementById('modeGreenSlider').value = rgb.g;
      document.getElementById('modeBlueSlider').value = rgb.b;
      document.getElementById('modeRed').textContent = rgb.r;
      document.getElementById('modeGreen').textContent = rgb.g;
      document.getElementById('modeBlue').textContent = rgb.b;
      
      const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
      
      document.getElementById('modeRgbValue').textContent = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      document.getElementById('modeHslValue').textContent = `hsl(${h}, ${s}%, ${l}%)`;
      document.getElementById('modeCmykValue').textContent = `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;

      updateHslSliderBackgrounds(h, s, l);
    }

    function updateModeColorFromCmyk() {
      const c = parseInt(document.getElementById('modeCyanSlider').value);
      const m = parseInt(document.getElementById('modeMagentaSlider').value);
      const y = parseInt(document.getElementById('modeYellowSlider').value);
      const k = parseInt(document.getElementById('modeKeySlider').value);
      
      const rgb = cmykToRgb(c, m, y, k);
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      
      document.getElementById('modePreview').style.background = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      document.getElementById('modeRedSlider').value = rgb.r;
      document.getElementById('modeGreenSlider').value = rgb.g;
      document.getElementById('modeBlueSlider').value = rgb.b;
      document.getElementById('modeRed').textContent = rgb.r;
      document.getElementById('modeGreen').textContent = rgb.g;
      document.getElementById('modeBlue').textContent = rgb.b;
      
      document.getElementById('modeRgbValue').textContent = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      document.getElementById('modeHslValue').textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
      document.getElementById('modeCmykValue').textContent = `cmyk(${c}%, ${m}%, ${y}%, ${k}%)`;

      // Update HSL slider values
      document.getElementById('modeHueSlider').value = hsl.h;
      document.getElementById('modeSatSlider').value = hsl.s;
      document.getElementById('modeLightSlider').value = hsl.l;
      document.getElementById('modeHue').textContent = hsl.h;
      document.getElementById('modeSat').textContent = hsl.s + '%';
      document.getElementById('modeLight').textContent = hsl.l + '%';

      updateHslSliderBackgrounds(hsl.h, hsl.s, hsl.l);
    }

    // ===== IMAGE PICKER (ENHANCED) =====
    function initImagePicker() {
      const dropZone = document.getElementById('dropZone');
      const imageInput = document.getElementById('imageInput');
      const imagePreview = document.getElementById('imagePreview');
      const previewContainer = document.getElementById('imagePreviewContainer');
      const extractedColors = document.getElementById('extractedColors');
      const extractedPalette = document.getElementById('extractedPalette');
      const hoverCursor = document.getElementById('hoverCursor');
      const livePreview = document.getElementById('liveColorPreview');
      const liveHex = document.getElementById('liveHexValue');
      const liveRgb = document.getElementById('liveRgbValue');
      const saveLiveBtn = document.getElementById('saveLiveColor');
      const copyLiveHex = document.getElementById('copyLiveHex');
      const copyLiveRgb = document.getElementById('copyLiveRgb');
      const historyContainer = document.getElementById('imageColorHistory');

      let canvas = null;
      let ctx = null;
      let currentImageData = null;

      dropZone.addEventListener('click', () => imageInput.click());
      
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });
      
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });
      
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
          handleImage(file);
        }
      });
      
      imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleImage(file);
      });
      
      function handleImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          imagePreview.src = e.target.result;
          previewContainer.style.display = 'block';
          
          imagePreview.onload = () => {
            canvas = document.createElement('canvas');
            ctx = canvas.getContext('2d');
            canvas.width = imagePreview.naturalWidth;
            canvas.height = imagePreview.naturalHeight;
            ctx.drawImage(imagePreview, 0, 0);
            currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            extractColors(e.target.result);
          };
        };
        reader.readAsDataURL(file);
      }
      
      function extractColors(src) {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const colors = [];
          
          for (let i = 0; i < 8; i++) {
            const x = Math.floor(Math.random() * img.width);
            const y = Math.floor(Math.random() * img.height);
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
            if (!colors.includes(hex)) {
              colors.push(hex);
            }
          }
          
          extractedColors.style.display = 'block';
          extractedPalette.innerHTML = '';
          
          colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'palette-swatch';
            swatch.style.background = color;
            swatch.dataset.color = color;
            swatch.addEventListener('click', () => {
              navigator.clipboard.writeText(color);
              showToast(`${color} copied!`, 'success');
              addToImageHistory(color);
            });
            extractedPalette.appendChild(swatch);
          });
        };
        img.src = src;
      }
      
      // Live hover detection
      imagePreview.addEventListener('mousemove', (e) => {
        if (!currentImageData) return;
        
        const rect = imagePreview.getBoundingClientRect();
        const scaleX = imagePreview.naturalWidth / rect.width;
        const scaleY = imagePreview.naturalHeight / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        
        // Update cursor position
        hoverCursor.style.display = 'block';
        hoverCursor.style.left = (e.clientX - rect.left) + 'px';
        hoverCursor.style.top = (e.clientY - rect.top) + 'px';
        
        // Get pixel color
        const pixelIndex = (y * currentImageData.width + x) * 4;
        const r = currentImageData.data[pixelIndex];
        const g = currentImageData.data[pixelIndex + 1];
        const b = currentImageData.data[pixelIndex + 2];
        const hex = rgbToHex(r, g, b);
        
        // Update live preview
        state.currentImageColor = { r, g, b, hex };
        livePreview.style.background = hex;
        liveHex.textContent = hex;
        liveRgb.textContent = `rgb(${r}, ${g}, ${b})`;
        saveLiveBtn.disabled = false;
        
        // Update cursor border color based on brightness
        const brightness = (r + g + b) / 3;
        hoverCursor.style.borderColor = brightness > 128 ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)';
      });
      
      imagePreview.addEventListener('mouseleave', () => {
        hoverCursor.style.display = 'none';
      });
      
      // Click to lock and save color
      imagePreview.addEventListener('click', () => {
        if (state.currentImageColor) {
          addToImageHistory(state.currentImageColor.hex);
          saveColor(state.currentImageColor.hex);
          showToast(`Color ${state.currentImageColor.hex} saved!`, 'success');
        }
      });
      
      // Copy buttons
      copyLiveHex.addEventListener('click', () => {
        if (state.currentImageColor) {
          navigator.clipboard.writeText(state.currentImageColor.hex);
          showToast('HEX copied!', 'success');
        }
      });
      
      copyLiveRgb.addEventListener('click', () => {
        if (state.currentImageColor) {
          const { r, g, b } = state.currentImageColor;
          navigator.clipboard.writeText(`rgb(${r}, ${g}, ${b})`);
          showToast('RGB copied!', 'success');
        }
      });
      
      saveLiveBtn.addEventListener('click', () => {
        if (state.currentImageColor) {
          saveColor(state.currentImageColor.hex);
          addToImageHistory(state.currentImageColor.hex);
          showToast('Color saved!', 'success');
        }
      });
      
      function addToImageHistory(hex) {
        if (!state.imageColorHistory.includes(hex)) {
          state.imageColorHistory.unshift(hex);
          if (state.imageColorHistory.length > 24) state.imageColorHistory.pop();
          localStorage.setItem('imageColorHistory', JSON.stringify(state.imageColorHistory));
          renderImageHistory();
        }
      }
      
      function renderImageHistory() {
        historyContainer.innerHTML = '';
        state.imageColorHistory.forEach(color => {
          const swatch = document.createElement('div');
          swatch.className = 'history-color';
          swatch.style.background = color;
          swatch.title = color;
          swatch.addEventListener('click', () => {
            navigator.clipboard.writeText(color);
            showToast(`${color} copied!`, 'success');
          });
          historyContainer.appendChild(swatch);
        });
      }
      
      renderImageHistory();
    }

    // ===== EYEDROPPER =====
    function initEyedropper() {
      const btn = document.getElementById('startEyedropper');
      const resultDiv = document.getElementById('eyedropperResult');
      const unsupportedDiv = document.getElementById('eyedropperUnsupported');
      
      if (!window.EyeDropper) {
        unsupportedDiv.style.display = 'block';
        btn.style.display = 'none';
        return;
      }
      
      btn.addEventListener('click', async () => {
        try {
          const eyeDropper = new EyeDropper();
          const result = await eyeDropper.open();
          const hex = result.sRGBHex.toUpperCase();
          
          resultDiv.style.display = 'block';
          document.getElementById('eyedropperColorPreview').style.background = hex;
          document.getElementById('eyedropperHex').textContent = hex;
          
          document.getElementById('copyEyedropper').onclick = () => {
            navigator.clipboard.writeText(hex);
            showToast('Copied!', 'success');
          };
          
          addRecentColor(hex);
        } catch (e) {
          console.log('Eyedropper cancelled');
        }
      });
    }

    // ===== PALETTE GENERATOR =====
    function initPaletteGenerator() {
      const generateBtn = document.getElementById('generatePalette');
      const output = document.getElementById('paletteOutput');
      const exportDiv = document.getElementById('paletteExport');
      let currentPalette = [];
      
      generateBtn.addEventListener('click', () => {
        const baseHex = document.getElementById('paletteBaseColor').value;
        const type = document.getElementById('paletteType').value;
        const baseRgb = hexToRgb(baseHex);
        const hsl = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);
        
        currentPalette = [];
        
        function hslToHexLocal(h, s, l) {
          const rgb = hslToRgb(h, s, l);
          return rgbToHex(rgb.r, rgb.g, rgb.b);
        }
        
        switch(type) {
          case 'complementary':
            currentPalette = [
              baseHex,
              hslToHexLocal((hsl.h + 180) % 360, hsl.s, hsl.l)
            ];
            break;
          case 'analogous':
            currentPalette = [
              hslToHexLocal((hsl.h - 30 + 360) % 360, hsl.s, hsl.l),
              baseHex,
              hslToHexLocal((hsl.h + 30) % 360, hsl.s, hsl.l)
            ];
            break;
          case 'triadic':
            currentPalette = [
              baseHex,
              hslToHexLocal((hsl.h + 120) % 360, hsl.s, hsl.l),
              hslToHexLocal((hsl.h + 240) % 360, hsl.s, hsl.l)
            ];
            break;
          case 'monochromatic':
            currentPalette = [
              hslToHexLocal(hsl.h, hsl.s, Math.max(20, hsl.l - 30)),
              hslToHexLocal(hsl.h, hsl.s, Math.max(30, hsl.l - 15)),
              baseHex,
              hslToHexLocal(hsl.h, hsl.s, Math.min(90, hsl.l + 15)),
              hslToHexLocal(hsl.h, hsl.s, Math.min(95, hsl.l + 30))
            ];
            break;
        }
        
        renderPalette();
      });
      
      function renderPalette() {
        output.innerHTML = '';
        
        currentPalette.forEach((color, i) => {
          const card = document.createElement('div');
          card.className = 'palette-card';
          card.innerHTML = `
            <div class="palette-card-preview" style="background: ${color}"></div>
            <div class="palette-card-info">
              <div class="palette-card-hex">${color}</div>
            </div>
          `;
          card.addEventListener('click', () => {
            navigator.clipboard.writeText(color);
            showToast(`${color} copied!`, 'success');
          });
          output.appendChild(card);
        });
        
        exportDiv.style.display = 'block';
      }
      
      document.getElementById('exportCss').addEventListener('click', () => {
        const css = currentPalette.map((c, i) => `--color-${i + 1}: ${c};`).join('\n');
        navigator.clipboard.writeText(`:root {\n${css}\n}`);
        showToast('CSS copied!', 'success');
      });
      
      document.getElementById('exportJson').addEventListener('click', () => {
        const json = JSON.stringify(currentPalette, null, 2);
        navigator.clipboard.writeText(json);
        showToast('JSON copied!', 'success');
      });
      
      document.getElementById('savePalette').addEventListener('click', () => {
        currentPalette.forEach(color => saveColor(color));
        showToast('Palette saved!', 'success');
      });
    }

    // ===== CONTRAST CHECKER =====
    function initContrastChecker() {
      const bgInput = document.getElementById('contrastBg');
      const textInput = document.getElementById('contrastText');
      const preview = document.getElementById('contrastPreview');
      const ratioDisplay = document.getElementById('contrastRatio');
      const wcagAA = document.getElementById('wcagAA');
      const wcagAAA = document.getElementById('wcagAAA');
      
      function updateContrast() {
        const bgColor = bgInput.value;
        const textColor = textInput.value;
        
        preview.style.background = bgColor;
        preview.style.color = textColor;
        
        const bgRgb = hexToRgb(bgColor);
        const textRgb = hexToRgb(textColor);
        
        const ratio = getContrastRatio(bgRgb, textRgb);
        ratioDisplay.textContent = ratio.toFixed(
                    2) + ':1';
        
        wcagAA.className = 'wcag-badge mx-auto mb-2 ' + (ratio >= 4.5 ? 'wcag-pass' : 'wcag-fail');
        wcagAA.textContent = ratio >= 4.5 ? 'AA Pass' : 'AA Fail';
        
        wcagAAA.className = 'wcag-badge mx-auto mb-2 ' + (ratio >= 7 ? 'wcag-pass' : 'wcag-fail');
        wcagAAA.textContent = ratio >= 7 ? 'AAA Pass' : 'AAA Fail';
      }
      
      bgInput.addEventListener('input', updateContrast);
      textInput.addEventListener('input', updateContrast);
      
      updateContrast();
    }

    // ===== GAMES SYSTEM =====
    function initGames() {
      const gameCards = document.querySelectorAll('.game-card');
      const modal = document.getElementById('gameModal');
      const closeBtn = document.getElementById('closeGame');
      
      gameCards.forEach(card => {
        card.addEventListener('click', () => {
          const game = card.dataset.game;
          openGame(game);
        });
      });
      
      closeBtn.addEventListener('click', () => {
        closeGameModal();
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeGameModal();
        }
      });
    }

    function openGame(game) {
      const modal = document.getElementById('gameModal');
      const title = document.getElementById('gameTitle');
      const content = document.getElementById('gameContent');
      
      state.currentGame = game;
      modal.classList.add('active');
      
      switch(game) {
        case 'detective':
          title.textContent = 'Color Detective';
          initDetectiveGame(content);
          break;
        case 'reflex':
          title.textContent = 'Color Reflex';
          initReflexGame(content);
          break;
        case 'memory':
          title.textContent = 'Memory Game';
          initMemoryGame(content);
          break;
      }
    }

    function closeGameModal() {
      document.getElementById('gameModal').classList.remove('active');
      document.getElementById('gameResult').classList.remove('active');
      state.currentGame = null;
    }

    // Game Result Popup
    function showGameResult(isWin, score, onNext, onRetry) {
      const result = document.getElementById('gameResult');
      const emoji = document.getElementById('resultEmoji');
      const text = document.getElementById('resultText');
      const buttons = document.getElementById('resultButtons');
      
      if (isWin) {
        emoji.textContent = '🎉';
        text.textContent = 'YOU WIN!';
        text.classList.remove('fail');
        createConfetti();
        buttons.innerHTML = `
          <button class="btn btn-primary" id="nextGameBtn">Next Game</button>
          <button class="btn btn-secondary" id="backToGamesBtn">Back to Games</button>
        `;
      } else {
        emoji.textContent = '😢';
        text.textContent = 'TRY AGAIN';
        text.classList.add('fail');
        buttons.innerHTML = `
          <button class="btn btn-primary" id="retryBtn">Retry</button>
          <button class="btn btn-secondary" id="exitBtn">Exit to Menu</button>
        `;
      }
      
      result.classList.add('active');
      
      if (isWin) {
        document.getElementById('nextGameBtn').addEventListener('click', () => {
          result.classList.remove('active');
          if (onNext) onNext();
        });
        document.getElementById('backToGamesBtn').addEventListener('click', closeGameModal);
      } else {
        document.getElementById('retryBtn').addEventListener('click', () => {
          result.classList.remove('active');
          if (onRetry) onRetry();
        });
        document.getElementById('exitBtn').addEventListener('click', closeGameModal);
      }
    }

    // Detective Game
    function initDetectiveGame(container) {
      const clues = [
        { clue: 'I am a warm color used in sunsets and flames', answer: 'ORANGE', options: ['ORANGE', 'BLUE', 'GREEN', 'PURPLE'] },
        { clue: 'I am the color of the sky on a clear day', answer: 'BLUE', options: ['RED', 'BLUE', 'YELLOW', 'BLACK'] },
        { clue: 'I am the color of fresh grass and leaves', answer: 'GREEN', options: ['PINK', 'GREEN', 'ORANGE', 'BROWN'] },
        { clue: 'I am a royal color, made by mixing red and blue', answer: 'PURPLE', options: ['ORANGE', 'GREEN', 'PURPLE', 'YELLOW'] },
        { clue: 'I am the color of sunshine and bananas', answer: 'YELLOW', options: ['WHITE', 'YELLOW', 'RED', 'BLUE'] }
      ];
      
      let currentQuestion = 0;
      let score = 0;
      let wrongAnswers = 0;
      
      function renderQuestion() {
        if (currentQuestion >= clues.length) {
          const isWin = wrongAnswers === 0;
          showGameResult(isWin, score, () => {
            // Next game - open reflex
            openGame('reflex');
          }, () => {
            currentQuestion = 0;
            score = 0;
            wrongAnswers = 0;
            renderQuestion();
          });
          return;
        }
        
        const q = clues[currentQuestion];
        const shuffled = [...q.options].sort(() => Math.random() - 0.5);
        
        container.innerHTML = `
          <div class="text-center mb-6">
            <div class="text-sm mb-2" style="color: var(--fg-muted)">Question ${currentQuestion + 1} of ${clues.length}</div>
            <div class="score-display text-2xl">${score} points</div>
          </div>
          <div class="p-6 rounded-xl mb-6" style="background: var(--bg-card-hover)">
            <p class="text-xl text-center">${q.clue}</p>
          </div>
          <div class="game-options">
            ${shuffled.map(opt => `<button class="game-option">${opt}</button>`).join('')}
          </div>
        `;
        
        container.querySelectorAll('.game-option').forEach(btn => {
          btn.addEventListener('click', () => {
            const isCorrect = btn.textContent === q.answer;
            btn.classList.add(isCorrect ? 'correct' : 'wrong');
            
            if (isCorrect) {
              score++;
              showToast('Correct!', 'success');
            } else {
              wrongAnswers++;
              showToast(`Wrong! The answer was ${q.answer}`, 'error');
            }
            
            setTimeout(() => {
              currentQuestion++;
              renderQuestion();
            }, 1000);
          });
        });
      }
      
      renderQuestion();
    }

    // Reflex Game
    function initReflexGame(container) {
      const colors = [
        { name: 'RED', hex: '#ff4444' },
        { name: 'BLUE', hex: '#4444ff' },
        { name: 'GREEN', hex: '#44ff44' },
        { name: 'YELLOW', hex: '#ffff44' },
        { name: 'PURPLE', hex: '#aa44ff' },
        { name: 'ORANGE', hex: '#ff8844' }
      ];
      
      let score = 0;
      let timeLeft = 30;
      let currentColor = null;
      let timer = null;
      
      function renderGame() {
        container.innerHTML = `
          <div class="flex justify-between items-center mb-6">
            <div>
              <div class="text-sm" style="color: var(--fg-muted)">Score</div>
              <div class="score-display text-2xl">${score}</div>
            </div>
            <div class="text-right">
              <div class="text-sm" style="color: var(--fg-muted)">Time</div>
              <div class="text-2xl font-bold" id="reflexTimer">${timeLeft}s</div>
            </div>
          </div>
          <div class="p-8 rounded-xl text-center mb-6" style="background: var(--bg-card-hover)">
            <div class="text-4xl font-bold" id="reflexColorName">READY</div>
          </div>
          <div class="grid grid-cols-3 gap-3" id="reflexOptions"></div>
        `;
        
        showNewColor();
        startTimer();
      }
      
      function showNewColor() {
        currentColor = colors[Math.floor(Math.random() * colors.length)];
        const wrongColors = colors.filter(c => c.name !== currentColor.name);
        const shuffled = [currentColor, ...wrongColors.sort(() => Math.random() - 0.5).slice(0, 3)]
          .sort(() => Math.random() - 0.5);
        
        const nameEl = document.getElementById('reflexColorName');
        nameEl.textContent = currentColor.name;
        nameEl.style.color = colors[Math.floor(Math.random() * colors.length)].hex;
        
        const optionsContainer = document.getElementById('reflexOptions');
        optionsContainer.innerHTML = shuffled.map(c => `
          <button class="p-4 rounded-xl font-semibold transition-all hover:scale-105" style="background: ${c.hex}; color: ${c.name === 'YELLOW' ? '#000' : '#fff'}">${c.name}</button>
        `).join('');
        
        optionsContainer.querySelectorAll('button').forEach(btn => {
          btn.addEventListener('click', () => {
            if (btn.textContent === currentColor.name) {
              score++;
              showToast('+1', 'success');
            } else {
              showToast('Wrong!', 'error');
            }
            showNewColor();
          });
        });
      }
      
      function startTimer() {
        timer = setInterval(() => {
          timeLeft--;
          const timerEl = document.getElementById('reflexTimer');
          if (timerEl) {
            timerEl.textContent = timeLeft + 's';
            timerEl.style.color = timeLeft <= 10 ? 'var(--accent-secondary)' : 'var(--fg)';
          }
          
          if (timeLeft <= 0) {
            clearInterval(timer);
            const isWin = score >= 20;
            showGameResult(isWin, score, () => {
              openGame('memory');
            }, () => {
              score = 0;
              timeLeft = 30;
              renderGame();
            });
          }
        }, 1000);
      }
      
      renderGame();
    }

    // Memory Game
    function initMemoryGame(container) {
      const gameColors = ['#ff6b6b', '#00d4aa', '#7c5cff', '#ffd700', '#00bfff'];
      let sequence = [];
      let userSequence = [];
      let level = 3;
      let attempts = 0;
      
      function startRound() {
        sequence = [];
        userSequence = [];
        
        for (let i = 0; i < level; i++) {
          sequence.push(gameColors[Math.floor(Math.random() * gameColors.length)]);
        }
        
        renderGame();
        showSequence();
      }
      
      function showSequence() {
        const slots = container.querySelectorAll('.memory-slot');
        let index = 0;
        
        const interval = setInterval(() => {
          if (index > 0) {
            slots[index - 1].style.background = '';
            slots[index - 1].style.border = '2px dashed var(--border)';
          }
          
          if (index < sequence.length) {
            slots[index].style.background = sequence[index];
            slots[index].style.border = '2px solid ' + sequence[index];
            index++;
          } else {
            clearInterval(interval);
            setTimeout(renderInputPhase, 500);
          }
        }, 800);
      }
      
      function renderGame() {
        container.innerHTML = `
          <div class="text-center mb-6">
            <div class="text-sm mb-2" style="color: var(--fg-muted)">Level ${level - 2}</div>
            <p class="text-lg">Memorize the sequence!</p>
          </div>
          <div class="memory-slots">
            ${sequence.map((_, i) => `<div class="memory-slot" data-index="${i}">${i + 1}</div>`).join('')}
          </div>
        `;
      }
      
      function renderInputPhase() {
        const shuffled = [...sequence].sort(() => Math.random() - 0.5);
        
        container.innerHTML = `
          <div class="text-center mb-6">
            <div class="text-sm mb-2" style="color: var(--fg-muted)">Your turn!</div>
            <p class="text-lg">Arrange the colors in the correct order</p>
          </div>
          <div class="memory-slots" id="memorySlots">
            ${sequence.map((_, i) => `<div class="memory-slot" data-index="${i}">${i + 1}</div>`).join('')}
          </div>
          <div class="memory-colors" id="memoryColors">
            ${shuffled.map((c, i) => `<div class="memory-color" data-color="${c}" style="background: ${c}"></div>`).join('')}
          </div>
          <button class="btn btn-primary mt-6 w-full" id="checkMemory">Check Answer</button>
        `;
        
        const slots = container.querySelectorAll('.memory-slot');
        const colors = container.querySelectorAll('.memory-color');
        
        colors.forEach(color => {
          color.addEventListener('click', () => {
            const emptySlot = [...slots].find(s => !s.dataset.filled);
            if (emptySlot) {
              emptySlot.style.background = color.dataset.color;
              emptySlot.dataset.filled = color.dataset.color;
              emptySlot.classList.add('filled');
              color.style.opacity = '0.3';
              color.style.pointerEvents = 'none';
              userSequence.push(color.dataset.color);
            }
          });
        });
        
        document.getElementById('checkMemory').addEventListener('click', () => {
          const isCorrect = userSequence.every((c, i) => c === sequence[i]);
          
          if (isCorrect) {
            showToast('Perfect!', 'success');
            level++;
            if (level > 6) {
              showGameResult(true, level - 3, null, () => {
                level = 3;
                startRound();
              });
            } else {
              setTimeout(startRound, 1500);
            }
          } else {
            attempts++;
            showToast('Wrong sequence!', 'error');
            if (attempts >= 2) {
              showGameResult(false, level - 3, null, () => {
                attempts = 0;
                startRound();
              });
            } else {
              setTimeout(renderInputPhase, 1000);
            }
          }
        });
      }
      
      startRound();
    }

    // ===== INITIALIZATION =====
    document.addEventListener('DOMContentLoaded', () => {
      initTheme();
      
      document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.page));
        item.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') navigateTo(item.dataset.page);
        });
      });
      
      document.getElementById('toggleSidebar').addEventListener('click', toggleSidebar);
      
      document.getElementById('mobileMenuBtn').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('mobile-open');
      });
      
      document.getElementById('clearAllColors').addEventListener('click', () => {
        if (confirm('Are you sure you want to delete all saved colors?')) {
          state.savedColors = [];
          localStorage.setItem('savedColors', JSON.stringify(state.savedColors));
          renderSavedColors();
          showToast('All colors deleted', 'info');
        }
      });
      
      initColorPicker();
      initModeToggle();
      initImagePicker();
      initEyedropper();
      initPaletteGenerator();
      initContrastChecker();
      initGames();
      renderSavedColors();
      updateColorPreview();
      
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeGameModal();
          document.getElementById('sidebar').classList.remove('mobile-open');
        }
      });
    });
  </script>