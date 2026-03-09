import { Router, Request, Response } from 'express';
import { reviewAuth, requireReviewAccess, requireReviewConfigure } from '../middleware/reviewAuth';
import { getAllGradeDescriptions, updateGradeDescription } from '../services/gradeDescription.service';

const router = Router();
router.use(...reviewAuth);

// GET /api/review/grade-descriptions — list all grade descriptions
router.get('/', requireReviewAccess, async (_req: Request, res: Response) => {
  try {
    const descriptions = await getAllGradeDescriptions();
    res.json({ success: true, data: descriptions });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
});

// PUT /api/review/grade-descriptions/:scoreLevel — update a description
router.put('/:scoreLevel', requireReviewConfigure, async (req: Request, res: Response) => {
  try {
    const scoreLevel = parseInt(req.params.scoreLevel, 10);
    if (isNaN(scoreLevel) || scoreLevel < 1 || scoreLevel > 10) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'scoreLevel must be 1-10' },
      });
    }

    const { description } = req.body;
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'description is required' },
      });
    }

    const user = (req as any).user;
    const result = await updateGradeDescription(scoreLevel, { description: description.trim() }, user.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
});

export default router;
