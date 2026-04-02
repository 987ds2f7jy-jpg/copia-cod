import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function NavigationTracker() {
  const location = useLocation();
  useEffect(() => {
    // Navigation tracking - no-op without base44
  }, [location]);
  return null;
}
