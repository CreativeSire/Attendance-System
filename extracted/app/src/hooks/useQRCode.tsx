import { useState, useCallback, useEffect, useRef } from 'react';
import type { QRSession } from '@/types';

// Generate a random QR code
function generateQRCode(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

export type QRCodeGeneratorHook = ReturnType<typeof useQRCodeGenerator>;

export function useQRCodeGenerator(officeLocation: { lat: number; lng: number }, refreshInterval: number = 5) {
  const [currentQR, setCurrentQR] = useState<QRSession | null>(null);
  const [permanentCode, setPermanentCode] = useState<string>(() => {
    return localStorage.getItem('dala_permanent_qr') || `OFFICE-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  });

  // Save permanent code
  useEffect(() => {
    localStorage.setItem('dala_permanent_qr', permanentCode);
  }, [permanentCode]);

  // Tick triggers re-renders so computed timeRemaining stays accurate (no drift)
  const [, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateNewQR = useCallback(() => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + refreshInterval * 60 * 1000);

    const newSession: QRSession = {
      id: Date.now().toString(),
      code: generateQRCode(),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      location: officeLocation
    };

    setCurrentQR(newSession);
    return newSession;
  }, [officeLocation, refreshInterval]);

  const startQRGenerator = useCallback(() => {
    generateNewQR();

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      generateNewQR();
    }, refreshInterval * 60 * 1000);
  }, [generateNewQR, refreshInterval]);

  const stopQRGenerator = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const verifyQRCode = useCallback((scannedCode: string): boolean => {
    // Check dynamic code first
    if (currentQR && scannedCode === currentQR.code && new Date() < new Date(currentQR.expiresAt)) {
      return true;
    }
    // Check permanent printed code
    return scannedCode === permanentCode;
  }, [currentQR, permanentCode]);

  // 1-second ticker for accurate countdown display — no drift possible
  useEffect(() => {
    const tick = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Computed directly from expiresAt — always accurate
  const timeRemaining = currentQR
    ? Math.max(0, Math.floor((new Date(currentQR.expiresAt).getTime() - Date.now()) / 1000))
    : refreshInterval * 60;

  return {
    currentQR,
    permanentCode,
    timeRemaining,
    generateNewQR,
    startQRGenerator,
    stopQRGenerator,
    verifyQRCode,
    isValid: !!currentQR && new Date() < new Date(currentQR.expiresAt)
  };
}

// Hook for QR code scanning
export function useQRScanner() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startScanning = useCallback(() => {
    setIsScanning(true);
    setError(null);
    setScanResult(null);
  }, []);

  const stopScanning = useCallback(() => {
    setIsScanning(false);
  }, []);

  const handleScan = useCallback((result: string) => {
    setScanResult(result);
    setIsScanning(false);
    return result;
  }, []);

  const handleError = useCallback((err: Error) => {
    setError(err.message);
    setIsScanning(false);
  }, []);

  const resetScan = useCallback(() => {
    setScanResult(null);
    setError(null);
    setIsScanning(false);
  }, []);

  return {
    scanResult,
    isScanning,
    error,
    startScanning,
    stopScanning,
    handleScan,
    handleError,
    resetScan
  };
}
