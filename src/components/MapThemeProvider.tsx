import React, { createContext, useContext, useState, useEffect } from 'react';

// MapBox-like theme configurations
export interface MapTheme {
  id: string;
  name: string;
  description: string;
  tileUrl: string;
  attribution: string;
  maxZoom: number;
  style: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    surface: string;
  };
  markers: {
    employee: {
      online: string;
      offline: string;
      selected: string;
    };
    task: {
      pending: string;
      completed: string;
      inProgress: string;
      selected: string;
    };
    location: {
      default: string;
      selected: string;
    };
  };
  clusters: {
    background: string;
    border: string;
    text: string;
  };
}

// Predefined themes
export const mapThemes: MapTheme[] = [
  {
    id: 'light',
    name: 'Light Theme',
    description: 'Clean, modern light theme with high contrast',
    tileUrl: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    style: {
      primary: '#3b82f6',
      secondary: '#1d4ed8',
      accent: '#f59e0b',
      background: '#ffffff',
      text: '#1f2937',
      surface: '#f8fafc'
    },
    markers: {
      employee: {
        online: '#10b981',
        offline: '#6b7280',
        selected: '#3b82f6'
      },
      task: {
        pending: '#f59e0b',
        completed: '#10b981',
        inProgress: '#3b82f6',
        selected: '#ef4444'
      },
      location: {
        default: '#8b5cf6',
        selected: '#ef4444'
      }
    },
    clusters: {
      background: '#3b82f6',
      border: '#ffffff',
      text: '#ffffff'
    }
  },
  {
    id: 'dark',
    name: 'Dark Theme',
    description: 'Sleek dark theme for low-light environments',
    tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    style: {
      primary: '#60a5fa',
      secondary: '#3b82f6',
      accent: '#fbbf24',
      background: '#111827',
      text: '#f9fafb',
      surface: '#1f2937'
    },
    markers: {
      employee: {
        online: '#34d399',
        offline: '#9ca3af',
        selected: '#60a5fa'
      },
      task: {
        pending: '#fbbf24',
        completed: '#34d399',
        inProgress: '#60a5fa',
        selected: '#f87171'
      },
      location: {
        default: '#a78bfa',
        selected: '#f87171'
      }
    },
    clusters: {
      background: '#60a5fa',
      border: '#ffffff',
      text: '#ffffff'
    }
  },
  {
    id: 'satellite',
    name: 'Satellite',
    description: 'High-resolution satellite imagery',
    tileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
    maxZoom: 19,
    style: {
      primary: '#ef4444',
      secondary: '#dc2626',
      accent: '#f59e0b',
      background: '#000000',
      text: '#ffffff',
      surface: '#1f2937'
    },
    markers: {
      employee: {
        online: '#10b981',
        offline: '#6b7280',
        selected: '#ef4444'
      },
      task: {
        pending: '#f59e0b',
        completed: '#10b981',
        inProgress: '#3b82f6',
        selected: '#ef4444'
      },
      location: {
        default: '#8b5cf6',
        selected: '#ef4444'
      }
    },
    clusters: {
      background: '#ef4444',
      border: '#ffffff',
      text: '#ffffff'
    }
  },
  {
    id: 'terrain',
    name: 'Terrain',
    description: 'Topographic map with elevation data',
    tileUrl: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
    maxZoom: 17,
    style: {
      primary: '#059669',
      secondary: '#047857',
      accent: '#d97706',
      background: '#f0fdf4',
      text: '#1f2937',
      surface: '#f0fdf4'
    },
    markers: {
      employee: {
        online: '#10b981',
        offline: '#6b7280',
        selected: '#059669'
      },
      task: {
        pending: '#d97706',
        completed: '#10b981',
        inProgress: '#3b82f6',
        selected: '#dc2626'
      },
      location: {
        default: '#7c3aed',
        selected: '#dc2626'
      }
    },
    clusters: {
      background: '#059669',
      border: '#ffffff',
      text: '#ffffff'
    }
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    description: 'Artistic watercolor-style map',
    tileUrl: 'https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://stamen.com/">Stamen Design</a>',
    maxZoom: 16,
    style: {
      primary: '#7c3aed',
      secondary: '#5b21b6',
      accent: '#f59e0b',
      background: '#fef3c7',
      text: '#1f2937',
      surface: '#fef3c7'
    },
    markers: {
      employee: {
        online: '#10b981',
        offline: '#6b7280',
        selected: '#7c3aed'
      },
      task: {
        pending: '#f59e0b',
        completed: '#10b981',
        inProgress: '#3b82f6',
        selected: '#dc2626'
      },
      location: {
        default: '#8b5cf6',
        selected: '#dc2626'
      }
    },
    clusters: {
      background: '#7c3aed',
      border: '#ffffff',
      text: '#ffffff'
    }
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean minimal design with focus on data',
    tileUrl: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    style: {
      primary: '#6366f1',
      secondary: '#4f46e5',
      accent: '#f59e0b',
      background: '#ffffff',
      text: '#374151',
      surface: '#f9fafb'
    },
    markers: {
      employee: {
        online: '#10b981',
        offline: '#6b7280',
        selected: '#6366f1'
      },
      task: {
        pending: '#f59e0b',
        completed: '#10b981',
        inProgress: '#3b82f6',
        selected: '#ef4444'
      },
      location: {
        default: '#8b5cf6',
        selected: '#ef4444'
      }
    },
    clusters: {
      background: '#6366f1',
      border: '#ffffff',
      text: '#ffffff'
    }
  }
];

interface MapThemeContextType {
  currentTheme: MapTheme;
  setTheme: (themeId: string) => void;
  themes: MapTheme[];
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const MapThemeContext = createContext<MapThemeContextType | undefined>(undefined);

export const useMapTheme = () => {
  const context = useContext(MapThemeContext);
  if (!context) {
    throw new Error('useMapTheme must be used within a MapThemeProvider');
  }
  return context;
};

interface MapThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: string;
}

export const MapThemeProvider: React.FC<MapThemeProviderProps> = ({
  children,
  defaultTheme = 'light'
}) => {
  const [currentThemeId, setCurrentThemeId] = useState(defaultTheme);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('map-theme');
    const savedDarkMode = localStorage.getItem('map-dark-mode') === 'true';
    
    if (savedTheme && mapThemes.find(t => t.id === savedTheme)) {
      setCurrentThemeId(savedTheme);
    }
    setIsDarkMode(savedDarkMode);
  }, []);

  // Save theme to localStorage
  useEffect(() => {
    localStorage.setItem('map-theme', currentThemeId);
  }, [currentThemeId]);

  useEffect(() => {
    localStorage.setItem('map-dark-mode', isDarkMode.toString());
  }, [isDarkMode]);

  const currentTheme = mapThemes.find(t => t.id === currentThemeId) || mapThemes[0];

  const setTheme = (themeId: string) => {
    const theme = mapThemes.find(t => t.id === themeId);
    if (theme) {
      setCurrentThemeId(themeId);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Apply theme to document root
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--map-primary', currentTheme.style.primary);
    root.style.setProperty('--map-secondary', currentTheme.style.secondary);
    root.style.setProperty('--map-accent', currentTheme.style.accent);
    root.style.setProperty('--map-background', currentTheme.style.background);
    root.style.setProperty('--map-text', currentTheme.style.text);
    root.style.setProperty('--map-surface', currentTheme.style.surface);
  }, [currentTheme]);

  const value: MapThemeContextType = {
    currentTheme,
    setTheme,
    themes: mapThemes,
    isDarkMode,
    toggleDarkMode
  };

  return (
    <MapThemeContext.Provider value={value}>
      {children}
    </MapThemeContext.Provider>
  );
};

// Theme selector component
export const MapThemeSelector: React.FC = () => {
  const { currentTheme, setTheme, themes } = useMapTheme();

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Map Theme
        </label>
        <select
          value={currentTheme.id}
          onChange={(e) => setTheme(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          {themes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
      </div>
      
      <div className="text-sm text-gray-600">
        {currentTheme.description}
      </div>
      
      {/* Theme Preview */}
      <div className="grid grid-cols-3 gap-2">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setTheme(theme.id)}
            className={`p-2 rounded-lg border-2 transition-all ${
              currentTheme.id === theme.id
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            title={theme.description}
          >
            <div
              className="w-full h-8 rounded"
              style={{
                background: `linear-gradient(45deg, ${theme.style.primary}, ${theme.style.secondary})`
              }}
            ></div>
            <div className="text-xs text-center mt-1 font-medium">
              {theme.name}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// Theme-aware CSS variables
export const mapThemeCSS = `
  :root {
    --map-primary: #3b82f6;
    --map-secondary: #1d4ed8;
    --map-accent: #f59e0b;
    --map-background: #ffffff;
    --map-text: #1f2937;
    --map-surface: #f8fafc;
  }
  
  .map-theme-primary {
    color: var(--map-primary);
  }
  
  .map-theme-secondary {
    color: var(--map-secondary);
  }
  
  .map-theme-accent {
    color: var(--map-accent);
  }
  
  .map-theme-background {
    background-color: var(--map-background);
  }
  
  .map-theme-text {
    color: var(--map-text);
  }
  
  .map-theme-surface {
    background-color: var(--map-surface);
  }
`;
