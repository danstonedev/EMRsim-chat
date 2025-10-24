import axios from 'axios';
import { z } from 'zod';

// Define schema for user data validation
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'instructor', 'student']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  preferences: z.record(z.unknown()).optional(),
});

// Define schema for user list response
const UserListSchema = z.object({
  users: z.array(UserSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});

describe('User API Contract Tests', () => {
  let authToken: string;
  
  beforeAll(async () => {
    // Get auth token for API calls
    const response = await axios.post('/api/auth/login', {
      email: process.env.TEST_USER_EMAIL,
      password: process.env.TEST_USER_PASSWORD
    });
    
    authToken = response.data.token;
  });
  
  test('GET /api/users - returns properly formatted user list', async () => {
    const response = await axios.get('/api/users', {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    
    expect(response.status).toBe(200);
    
    // Validate response against schema
    const result = UserListSchema.safeParse(response.data);
    
    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('Schema validation errors:', result.error.format());
    }
  });
  
  test('GET /api/users/:id - returns properly formatted user', async () => {
    // First get a list of users to find a valid ID
    const listResponse = await axios.get('/api/users', {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    
    const userId = listResponse.data.users[0]?.id;
    if (!userId) {
      throw new Error('No users found to test with');
    }
    
    const response = await axios.get(`/api/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    
    expect(response.status).toBe(200);
    
    // Validate response against schema
    const result = UserSchema.safeParse(response.data);
    
    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('Schema validation errors:', result.error.format());
    }
  });
  
  test('POST /api/users - creates user with correct format', async () => {
    const newUser = {
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
      role: 'student',
      password: 'Password123!'
    };
    
    const response = await axios.post('/api/users', newUser, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    
    expect(response.status).toBe(201);
    
    // Validate response against schema
    const result = UserSchema.safeParse(response.data);
    
    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('Schema validation errors:', result.error.format());
    }
    
    // Verify created user has the correct data
    expect(response.data.name).toBe(newUser.name);
    expect(response.data.email).toBe(newUser.email);
    expect(response.data.role).toBe(newUser.role);
  });
  
  test('PATCH /api/users/:id - updates user with correct format', async () => {
    // First create a user we can update
    const newUser = {
      name: 'Update Test User',
      email: `update-${Date.now()}@example.com`,
      role: 'student',
      password: 'Password123!'
    };
    
    const createResponse = await axios.post('/api/users', newUser, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    
    const userId = createResponse.data.id;
    
    // Now update the user
    const updateData = {
      name: 'Updated Name'
    };
    
    const response = await axios.patch(`/api/users/${userId}`, updateData, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    
    expect(response.status).toBe(200);
    
    // Validate response against schema
    const result = UserSchema.safeParse(response.data);
    
    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('Schema validation errors:', result.error.format());
    }
    
    // Verify updated user has the correct data
    expect(response.data.name).toBe(updateData.name);
    expect(response.data.email).toBe(newUser.email); // Should be unchanged
  });
});
