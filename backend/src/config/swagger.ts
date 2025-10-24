import swaggerJsdoc from 'swagger-jsdoc';
import packageJson from '../../package.json' with { type: 'json' };

const { version } = packageJson;

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EMRsim Chat API',
      version: version || '1.0.0',
      description: 'RESTful API for EMR simulation chat system with voice-enabled patient interactions',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3002',
        description: 'Development server',
      },
      {
        url: 'http://localhost:3002',
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'Personas',
        description: 'Patient persona management',
      },
      {
        name: 'Sessions',
        description: 'Chat session management',
      },
      {
        name: 'Voice',
        description: 'Voice/WebRTC endpoints',
      },
      {
        name: 'SPS',
        description: 'Standardized Patient Scenarios',
      },
      {
        name: 'Transcript',
        description: 'Transcript relay and management',
      },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
        Session: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique session identifier',
            },
            persona_id: {
              type: 'string',
              description: 'Associated persona ID',
            },
            sps_session_id: {
              type: 'string',
              nullable: true,
              description: 'SPS session ID if using standardized scenarios',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Session creation timestamp',
            },
          },
        },
        Persona: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique persona identifier',
            },
            name: {
              type: 'string',
              description: 'Patient name',
            },
            age: {
              type: 'integer',
              description: 'Patient age',
            },
            sex: {
              type: 'string',
              enum: ['male', 'female', 'other'],
              description: 'Patient sex',
            },
            chief_complaint: {
              type: 'string',
              description: 'Primary reason for visit',
            },
          },
        },
        VoiceToken: {
          type: 'object',
          properties: {
            client_secret: {
              type: 'object',
              description: 'OpenAI Realtime API ephemeral token',
            },
          },
        },
        TranscriptEntry: {
          type: 'object',
          properties: {
            role: {
              type: 'string',
              enum: ['user', 'assistant'],
              description: 'Speaker role',
            },
            text: {
              type: 'string',
              description: 'Transcript text',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Entry timestamp',
            },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Bad request - invalid input',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
  // Paths to files containing OpenAPI annotations
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
