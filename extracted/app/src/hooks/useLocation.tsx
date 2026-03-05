import { useState, useCallback, useEffect } from 'react';

interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
  address?: string;
}

interface LocationState {
  location: Location | null;
  error: string | null;
  loading: boolean;
  permission: PermissionState | null;
}

// Calculate distance between two coordinates in meters using Haversine formula
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Check if user is within office radius
export function isWithinOfficeRadius(
  userLat: number,
  userLng: number,
  officeLat: number,
  officeLng: number,
  radius: number
): boolean {
  const distance = calculateDistance(userLat, userLng, officeLat, officeLng);
  return distance <= radius;
}

export type LocationHook = ReturnType<typeof useLocation>;

export function useLocation() {
  const [state, setState] = useState<LocationState>({
    location: null,
    error: null,
    loading: false,
    permission: null
  });

  // Check permission status
  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setState(prev => ({ ...prev, permission: result.state }));
        
        result.addEventListener('change', () => {
          setState(prev => ({ ...prev, permission: result.state }));
        });
      });
    }
  }, []);

  const getCurrentLocation = useCallback((): Promise<Location> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = 'Geolocation is not supported by your browser';
        setState(prev => ({ ...prev, error, loading: false }));
        reject(new Error(error));
        return;
      }

      setState(prev => ({ ...prev, loading: true, error: null }));

      navigator.geolocation.getCurrentPosition(
          const location: Location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          
          // Anti-spoofing: Reject low accuracy (common in spoofers/VPNs)
          if (position.coords.accuracy > 50) {
            const error = 'GPS accuracy too low ( > 50m). Please move to an open area near a window.';
            setState(prev => ({ ...prev, error, loading: false }));
            reject(new Error(error));
            return;
          }

          setState(prev => ({
            ...prev,
            location,
            loading: false,
            error: null
          }));
          
          resolve(location);
        },
        (error) => {
          let errorMessage = 'Unable to retrieve your location';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location permissions.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out.';
              break;
          }
          
          setState(prev => ({
            ...prev,
            error: errorMessage,
            loading: false
          }));
          
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    });
  }, []);

  const watchLocation = useCallback((callback: (location: Location) => void) => {
    if (!navigator.geolocation) {
      setState(prev => ({ 
        ...prev, 
        error: 'Geolocation is not supported by your browser' 
      }));
      return null;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: Location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        
        setState(prev => ({
          ...prev,
          location,
          error: null
        }));
        
        callback(location);
      },
      (error) => {
        let errorMessage = 'Unable to retrieve your location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        
        setState(prev => ({ ...prev, error: errorMessage }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const checkLocationPermission = useCallback(async (): Promise<PermissionState | null> => {
    if ('permissions' in navigator) {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      setState(prev => ({ ...prev, permission: result.state }));
      return result.state;
    }
    return null;
  }, []);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      await getCurrentLocation();
      return true;
    } catch {
      return false;
    }
  }, [getCurrentLocation]);

  return {
    ...state,
    getCurrentLocation,
    watchLocation,
    checkLocationPermission,
    requestLocationPermission,
    calculateDistance,
    isWithinOfficeRadius
  };
}
