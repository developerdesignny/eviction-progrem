import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

export const usersRouter = Router();
usersRouter.use(requireAuth);

const select = { id: true, name: true, email: true, active: true } as const;

usersRouter.get('/', async (_req, res) => {
  res.json(await prisma.user.findMany({ select, orderBy: [{ active: 'desc' }, { name: 'asc' }] }));
});

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

usersRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid user' });
  }
  const email = parsed.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    return res.status(409).json({ error: 'A user with that email already exists' });
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
    },
    select,
  });
  res.status(201).json(user);
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  active: z.boolean().optional(),
});

usersRouter.patch('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid update' });
  }

  // Users are deactivated, never deleted — and the last active one has to stay,
  // otherwise nobody can sign in to undo it.
  if (parsed.data.active === false) {
    const activeCount = await prisma.user.count({ where: { active: true } });
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (target?.active && activeCount <= 1) {
      return res.status(400).json({ error: 'Cannot deactivate the last active user' });
    }
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email?.toLowerCase(),
      active: parsed.data.active,
      ...(parsed.data.password
        ? { passwordHash: await bcrypt.hash(parsed.data.password, 10) }
        : {}),
    },
    select,
  });
  res.json(user);
});
