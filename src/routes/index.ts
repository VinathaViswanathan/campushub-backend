import { Router } from 'express';
import reservationRoutes from './reservation.routes';
import resourceRoutes from './resource.routes';

const apiRouter: Router = Router();

apiRouter.use('/resources', resourceRoutes);
apiRouter.use('/reservations', reservationRoutes);

export default apiRouter;
