import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock docx.service before importing the route so the mock is in place
vi.mock('../services/docx.service.js', () => ({
  generateDocx: vi.fn().mockResolvedValue(Buffer.from('fake-docx')),
}));

// Import route AFTER mock setup — this import will fail (module not found) until Plan 02 creates the route.
// That import failure IS the RED state confirming these are real contracts.
import { generateRouter } from '../routes/generate.route.js';
import { errorMiddleware } from '../middleware/error.middleware.js';

// --- App setup ---

const app = express();
app.use(express.json());
app.use('/api', generateRouter);
app.use(errorMiddleware);

// --- Fixtures ---

const VALID_BODY = {
  resumeStructure: {
    meta: {
      pageWidth: 612,
      pageHeight: 792,
      marginTop: 72,
      marginBottom: 72,
      marginLeft: 72,
      marginRight: 72,
    },
    header: [],
    sections: [],
  },
  bullets: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// --- Integration tests for POST /api/generate ---

describe('POST /api/generate', () => {
  it('returns 200 with Content-Type application/vnd.openxmlformats-officedocument.wordprocessingml.document on valid body', async () => {
    const res = await request(app)
      .post('/api/generate')
      .send(VALID_BODY)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(
      /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/,
    );
  });

  it('returns 400 when resumeStructure is missing from body', async () => {
    const res = await request(app)
      .post('/api/generate')
      .send({ bullets: [] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
  });

  it('returns 400 when bullets is not an array', async () => {
    const res = await request(app)
      .post('/api/generate')
      .send({ resumeStructure: VALID_BODY.resumeStructure, bullets: 'not-an-array' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .post('/api/generate')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
  });
});
