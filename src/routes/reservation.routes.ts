import { Router } from 'express';
import {
  cancelReservation,
  confirmReservation,
  createReservation,
  getUserReservations,
} from '../controllers/reservation.controller';

/** Routes only map HTTP verbs + paths to controller methods (paths from docs/openapi.yaml). */
const router: Router = Router();

router.post('/', createReservation);
router.get('/user/:userId', getUserReservations);
router.patch('/:id/cancel', cancelReservation);
router.patch('/:id/confirm', confirmReservation);

export default router;
