import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function NavigationTracker() {
  const location = useLocation();
  useEffect(() => {
  // Navigation tracking intentionally stays local after backend separation.
  }, [location]);
  return null;
}
