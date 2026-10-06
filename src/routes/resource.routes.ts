import { Router } from 'express';
import { listResources } from '../controllers/resource.controller';

/** Routes only map HTTP verbs + paths to controller methods (paths from docs/openapi.yaml). */
const router: Router = Router();

router.get('/', listResources);

export default router;
