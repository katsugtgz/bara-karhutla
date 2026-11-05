import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/anybody/wdth.css';
import '@fontsource-variable/atkinson-hyperlegible-next';
import '../../styles/tokens.css';
import '../../styles/base.css';
import Kisah from './Kisah';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Kisah />
  </StrictMode>,
);
