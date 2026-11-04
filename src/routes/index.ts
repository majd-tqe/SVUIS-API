import { Router } from 'express';
import authRoutes from './auth.routes.js';
import studentRoutes from './student.routes.js';
import studiesRoutes from './studies.routes.js';
import paymentsRoutes from './payments.routes.js';
import assessmentsRoutes from './assessments.routes.js';
import classesRoutes from './classes.routes.js';
import classAssignRoutes from './class-assign.routes.js';
import tutorsRoutes from './tutors.routes.js';
import accountRoutes from './account.routes.js';
import scheduleRoutes from './schedule.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/student', studentRoutes);
router.use('/studies', studiesRoutes);
router.use('/payments', paymentsRoutes);
router.use('/assessments', assessmentsRoutes);
router.use('/classes', classesRoutes);
router.use('/classes/schedule', scheduleRoutes);
router.use('/classes/assign', classAssignRoutes);
router.use('/tutors', tutorsRoutes);
router.use('/account', accountRoutes);

export default router;
