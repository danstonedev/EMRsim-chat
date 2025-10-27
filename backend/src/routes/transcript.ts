import { Router } from 'express';
import { relayTranscript } from '../controllers/transcriptRelayController.js';

const router = Router();

router.post('/transcript/relay/:sessionId', relayTranscript);

export { router as transcriptRouter };
