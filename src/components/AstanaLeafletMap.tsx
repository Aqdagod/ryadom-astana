import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Category, Event } from '../types/database';
import { ASTANA_CENTER, isEventLiveNow, isWithinAstana } from '../utils/time';

interface AstanaLeafletMapProps {
  mode: 'main' | 'mini' | 'picker';
  events?: Event[];
  categories?: Category[];
  selectedEventId?: string | null;
  onSelectEvent?: (eventId: string) => void;
  center?: [number, number];
  zoom?: number;
  userPosition?: [number, number] | null;
  pickerPosition?: [number, number];
  onPickLocation?: (lat: number, lng: number) => void;
  className?: string;
}

export const AstanaLeafletMap: React.FC<AstanaLeafletMapProps> = ({
  mode,
  events = [],
  categories = [],
  selectedEventId,
  onSelectEvent,
  center = ASTANA_CENTER,
  zoom = mode === 'main' ? 13 : 14,
  userPosition,
  pickerPosition,
  onPickLocation,
  className = 'w-full h-full',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: mode === 'main',
      dragging: mode !== 'mini',
      scrollWheelZoom: mode !== 'mini',
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OSM',
      maxZoom: 18,
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    const userLayer = L.layerGroup().addTo(map);

    mapRef.current = map;
    markersLayerRef.current = markersLayer;
    userLayerRef.current = userLayer;

    // Ensure proper sizing inside responsive containers
    setTimeout(() => {
      map.invalidateSize();
    }, 120);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      userLayerRef.current = null;
    };
  }, []);

  // Recenter when center changes in mini or user position
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (mode === 'mini') {
      map.setView(center, zoom, { animate: false });
    }
  }, [center[0], center[1], zoom, mode]);

  // Picker click listener
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'picker' || !onPickLocation) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      onPickLocation(Number(lat.toFixed(5)), Number(lng.toFixed(5)));
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [mode, onPickLocation]);

  // Render event markers or picker marker
  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    if (mode === 'picker' && pickerPosition) {
      const valid = isWithinAstana(pickerPosition[0], pickerPosition[1]);
      const pinColor = valid ? '#4F46E5' : '#EF4444';
      const icon = L.divIcon({
        className: 'leaflet-div-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        html: `<div class="ryadom-pin" style="background:${pinColor};width:36px;height:36px;"><span class="ryadom-pin-inner" style="font-size:15px;">📍</span></div>`,
      });
      L.marker(pickerPosition, { icon }).addTo(layer);
      return;
    }

    if (mode === 'mini') {
      const icon = L.divIcon({
        className: 'leaflet-div-icon',
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        html: `<div class="ryadom-pin" style="background:#4F46E5;"><span class="ryadom-pin-inner">📍</span></div>`,
      });
      L.marker(center, { icon }).addTo(layer);
      return;
    }

    // Main map: published events with category colors & live highlight
    events.forEach((ev) => {
      const cat = categories.find((c) => c.id === ev.category_id);
      const color = cat?.color || '#4F46E5';
      const emoji = cat?.icon || '📍';
      const isLive = isEventLiveNow(ev.starts_at, ev.ends_at);
      const isSelected = selectedEventId === ev.id;

      const size = isLive ? 42 : isSelected ? 38 : 32;
      const html = `
        <div style="position:relative;width:${size}px;height:${size}px;">
          ${isLive ? '<span class="ryadom-ping-ring"></span>' : ''}
          <div class="ryadom-pin ${isLive ? 'ryadom-pin-live' : ''}" style="background:${isLive ? '#10B981' : color};width:${size}px;height:${size}px;${isSelected && !isLive ? 'border-color:#0F172A;transform:rotate(-45deg) scale(1.1);' : ''}">
            <span class="ryadom-pin-inner">${emoji}</span>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'leaflet-div-icon',
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        html,
      });

      const marker = L.marker([ev.lat, ev.lng], {
        icon,
        zIndexOffset: isLive ? 900 : isSelected ? 800 : 100,
      });

      if (onSelectEvent) {
        marker.on('click', () => onSelectEvent(ev.id));
      }
      marker.addTo(layer);
    });
  }, [mode, events, categories, selectedEventId, pickerPosition, center, onSelectEvent]);

  // Render user position dot
  useEffect(() => {
    const layer = userLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (mode === 'main' && userPosition) {
      const icon = L.divIcon({
        className: 'leaflet-div-icon',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        html: `<div style="width:18px;height:18px;border-radius:9999px;background:#4F46E5;border:3px solid #fff;box-shadow:0 0 0 4px rgba(79,70,229,0.25);"></div>`,
      });
      L.marker(userPosition, { icon, zIndexOffset: 1000 }).addTo(layer);
    }
  }, [mode, userPosition]);

  return <div ref={containerRef} className={className} />;
};
