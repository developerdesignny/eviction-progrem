import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
import { toFileDto } from '../services/projectView';
import { ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES } from '../../shared/types';

export const filesRouter = Router();
filesRouter.use(requireAuth);

// Files are stored as bytea in Postgres — no object storage service to host or back up
// separately. Memory storage is fine at 25 MB a file and this document volume.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_UPLOAD_MIME.includes(file.mimetype)) {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

filesRouter.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const file = await prisma.fileAttachment.create({
    data: {
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      data: req.file.buffer,
    },
  });
  res.status(201).json(toFileDto(file));
});

filesRouter.get('/:id', async (req, res) => {
  const file = await prisma.fileAttachment.findUnique({ where: { id: req.params.id } });
  if (!file) return res.status(404).json({ error: 'File not found' });

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', String(file.size));
  // inline so PDFs open in the browser; the filename still applies if saved.
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${file.filename.replace(/"/g, '')}"`,
  );
  res.send(Buffer.from(file.data));
});
