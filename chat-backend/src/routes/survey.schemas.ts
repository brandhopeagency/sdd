import { Router, Request, Response } from 'express';
import { authenticate, requireActiveAccount, requirePermission } from '../middleware/auth';
import { workbenchGuard } from '../middleware/workbenchGuard';
import { Permission } from '../types';
import {
  createSchema,
  getSchemaById,
  listSchemas,
  updateSchema,
  publishSchema,
  archiveSchema,
  restoreSchema,
  cloneSchema,
  deleteSchema,
  importSchema,
  exportSchema,
} from '../services/surveySchema.service';

const router = Router();
router.use(authenticate, requireActiveAccount, workbenchGuard);

router.get('/', requirePermission(Permission.SURVEY_SCHEMA_MANAGE), async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const schemas = await listSchemas(status);
    res.json({ success: true, data: schemas });
  } catch (error: any) {
    console.error('[Survey Schemas] Error listing:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list schemas' } });
  }
});

router.post('/', requirePermission(Permission.SURVEY_SCHEMA_MANAGE), async (req: Request, res: Response) => {
  try {
    const { title, description, questions } = req.body;
    const schema = await createSchema(title, description ?? null, questions ?? [], req.user!.id);
    res.status(201).json({ success: true, data: schema });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
    }
    console.error('[Survey Schemas] Error creating:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create schema' } });
  }
});

router.get('/:id/export', requirePermission(Permission.SURVEY_SCHEMA_MANAGE), async (req: Request, res: Response) => {
  try {
    const exportData = await exportSchema(req.params.id);
    res.json({ success: true, data: exportData });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
    }
    console.error('[Survey Schemas] Error exporting:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to export schema' } });
  }
});

router.post('/import', requirePermission(Permission.SURVEY_SCHEMA_MANAGE), async (req: Request, res: Response) => {
  try {
    const schema = await importSchema(req.body, req.user!.id);
    res.status(201).json({ success: true, data: schema });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: 'IMPORT_VALIDATION_FAILED', message: error.message },
        details: error.details ?? undefined,
      });
    }
    console.error('[Survey Schemas] Error importing:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to import schema' } });
  }
});

router.get('/:id', requirePermission(Permission.SURVEY_SCHEMA_MANAGE), async (req: Request, res: Response) => {
  try {
    const schema = await getSchemaById(req.params.id);
    if (!schema) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Schema not found' } });
    res.json({ success: true, data: schema });
  } catch (error: any) {
    console.error('[Survey Schemas] Error getting:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get schema' } });
  }
});

router.patch('/:id', requirePermission(Permission.SURVEY_SCHEMA_MANAGE), async (req: Request, res: Response) => {
  try {
    const schema = await updateSchema(req.params.id, req.body);
    res.json({ success: true, data: schema });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
    }
    console.error('[Survey Schemas] Error updating:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update schema' } });
  }
});

router.post('/:id/publish', requirePermission(Permission.SURVEY_SCHEMA_MANAGE), async (req: Request, res: Response) => {
  try {
    const schema = await publishSchema(req.params.id);
    res.json({ success: true, data: schema });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
    }
    console.error('[Survey Schemas] Error publishing:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to publish schema' } });
  }
});

router.post('/:id/archive', requirePermission(Permission.SURVEY_SCHEMA_ARCHIVE), async (req: Request, res: Response) => {
  try {
    const schema = await archiveSchema(req.params.id);
    res.json({ success: true, data: schema });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
    }
    console.error('[Survey Schemas] Error archiving:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to archive schema' } });
  }
});

router.post('/:id/restore', requirePermission(Permission.SURVEY_SCHEMA_ARCHIVE), async (req: Request, res: Response) => {
  try {
    const schema = await restoreSchema(req.params.id);
    res.json({ success: true, data: schema });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
    }
    console.error('[Survey Schemas] Error restoring:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to restore schema' } });
  }
});

router.post('/:id/clone', requirePermission(Permission.SURVEY_SCHEMA_MANAGE), async (req: Request, res: Response) => {
  try {
    const schema = await cloneSchema(req.params.id, req.user!.id);
    res.status(201).json({ success: true, data: schema });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
    }
    console.error('[Survey Schemas] Error cloning:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to clone schema' } });
  }
});

router.delete('/:id', requirePermission(Permission.SURVEY_SCHEMA_MANAGE), async (req: Request, res: Response) => {
  try {
    await deleteSchema(req.params.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
    }
    console.error('[Survey Schemas] Error deleting:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete schema' } });
  }
});

export default router;
