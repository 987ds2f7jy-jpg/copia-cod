import { createContext, useContext } from 'react';

export const BrowserPrivacyContext = createContext(null);

export function useBrowserPrivacy() {
  const context = useContext(BrowserPrivacyContext);
  if (!context) throw new Error('useBrowserPrivacy must be used inside BrowserPrivacyProvider');
  return context;
}
