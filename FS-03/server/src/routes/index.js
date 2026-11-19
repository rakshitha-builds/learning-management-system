import { Router } from 'express';
import healthRoutes from './healthRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
// Mounted in later stages:
// router.use('/auth', authRoutes);          // Stage 4
// router.use('/courses', courseRoutes);     // Stage 5
// router.use('/enrollments', ...);          // Stage 5
// router.use('/quizzes', ...);              // Stage 7  ... and so on

export default router;
