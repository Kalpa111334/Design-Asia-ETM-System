import React, { createContext, useContext, useEffect } from 'react';
import L from 'leaflet';

// Fix for default markers in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface OpenStreetMapContextType {
  isLoaded: boolean;
  loadError: string | null;
}

const OpenStreetMapContext = createContext<OpenStreetMapContextType>({
  isLoaded: false,
  loadError: null,
});

export const useOpenStreetMap = () => {
  const context = useContext(OpenStreetMapContext);
  if (!context) {
    throw new Error('useOpenStreetMap must be used within an OpenStreetMapProvider');
  }
  return context;
};

interface OpenStreetMapLoaderProps {
  children: React.ReactNode;
}

export default function OpenStreetMapLoader({ children }: OpenStreetMapLoaderProps) {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  useEffect(() => {
    // OpenStreetMap doesn't require API keys, so we can load immediately
    // But we'll add a small delay to simulate loading for consistency
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (loadError) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-lg m-4">
        <h3 className="font-semibold">Error loading OpenStreetMap</h3>
        <p>{loadError}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mb-4"></div>
        <p className="text-lg font-medium text-gray-700">Loading OpenStreetMap...</p>
        <p className="text-sm text-gray-500">Preparing map services</p>
      </div>
    );
  }

  return (
    <OpenStreetMapContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </OpenStreetMapContext.Provider>
  );
}
