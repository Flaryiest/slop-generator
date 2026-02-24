import { createHashRouter, createRoutesFromElements, Route } from 'react-router-dom';

import IndexPage from '@/pages/home/index';
import GeneratePage from '@/pages/generate/generate';

// Use hash router so routes work with both file:// (Electron) and http://
const router = createHashRouter(createRoutesFromElements(<>
  <Route path="/" element={<IndexPage/>} />
  <Route path="/generate" element={<GeneratePage/>} />
</>));

export default router;
