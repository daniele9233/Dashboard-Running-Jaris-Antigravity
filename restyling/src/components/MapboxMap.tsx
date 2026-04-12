import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from './ThemeContext';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

export function MapboxMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const { isDark } = useTheme();

  const add3DBuildings = (mapInstance: mapboxgl.Map) => {
    if (mapInstance.getStyle()?.sprite?.includes('standard')) return;

    const layers = mapInstance.getStyle()?.layers;
    let labelLayerId;
    if (layers) {
      for (let i = 0; i < layers.length; i++) {
        if (layers[i].type === 'symbol' && layers[i].layout && layers[i].layout['text-field']) {
          labelLayerId = layers[i].id;
          break;
        }
      }
    }

    if (mapInstance.getLayer('add-3d-buildings')) {
      mapInstance.removeLayer('add-3d-buildings');
    }

    if (!mapInstance.getSource('composite')) {
      return;
    }

    mapInstance.addLayer(
      {
        'id': 'add-3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': '#111',
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'height']
          ],
          'fill-extrusion-base': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'min_height']
          ],
          'fill-extrusion-opacity': 0.8
        }
      },
      labelLayerId
    );
  };

  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/standard',
      center: [2.2945, 48.8584],
      zoom: 15.5,
      pitch: 60,
      bearing: -20,
      antialias: true,
      attributionControl: false
    });

    map.current.on('style.load', () => {
      if (!map.current) return;
      
      if (!isDark) {
        map.current.setConfigProperty('basemap', 'lightPreset', 'dusk');
      } else {
        add3DBuildings(map.current);
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    const targetStyle = isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/standard';
    
    map.current.setStyle(targetStyle);
    
    map.current.once('style.load', () => {
      if (!map.current) return;
      
      if (!isDark) {
        map.current.setConfigProperty('basemap', 'lightPreset', 'dusk');
      } else {
        add3DBuildings(map.current);
      }
    });
  }, [isDark]);

  return <div ref={mapContainer} className="absolute inset-0 w-full h-full" />;
}
