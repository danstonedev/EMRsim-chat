import { Router } from 'express';
import { relayTranscript } from '../controllers/transcriptRelayController.ts';

const router = Router();

router.post('/transcript/relay/:sessionId', relayTranscript);

export { router as transcriptRouter };
