/**
 * User Model
 * 
 * Handles user-related database operations with support for both SQLite and PostgreSQL.
 */

const dbClient = require('../database/dbClient');
const logger = require('../utils/logger');

/**
 * Get a user by ID
 */
async function getUserById(id) {
  const query = dbClient.createPortableQuery({
    sqlite: 'SELECT * FROM users WHERE id = ?',
    postgres: 'SELECT * FROM users WHERE id = $1'
  });
  
  try {
    return await dbClient.queryOne(query, [id]);
  } catch (err) {
    logger.error(`Error getting user by ID: ${id}`, err);
    throw err;
  }
}

/**
 * Get a user by email
 */
async function getUserByEmail(email) {
  const query = dbClient.createPortableQuery({
    sqlite: 'SELECT * FROM users WHERE email = ? COLLATE NOCASE',
    postgres: 'SELECT * FROM users WHERE LOWER(email) = LOWER($1)'
  });
  
  try {
    return await dbClient.queryOne(query, [email]);
  } catch (err) {
    logger.error(`Error getting user by email: ${email}`, err);
    throw err;
  }
}

/**
 * Get all users with optional pagination
 */
async function getAllUsers(page = 1, pageSize = 10) {
  const offset = (page - 1) * pageSize;
  
  const query = dbClient.createPortableQuery({
    sqlite: 'SELECT * FROM users LIMIT ? OFFSET ?',
    postgres: 'SELECT * FROM users LIMIT $1 OFFSET $2'
  });
  
  const countQuery = 'SELECT COUNT(*) as total FROM users';
  
  try {
    const [usersResult, countResult] = await Promise.all([
      dbClient.query(query, [pageSize, offset]),
      dbClient.queryOne(countQuery)
    ]);
    
    return {
      users: usersResult.rows,
      total: dbClient.getDatabaseType() === 'postgres' ? parseInt(countResult.total) : countResult.total,
      page,
      pageSize,
      totalPages: Math.ceil(
        (dbClient.getDatabaseType() === 'postgres' ? parseInt(countResult.total) : countResult.total) / pageSize
      )
    };
  } catch (err) {
    logger.error('Error getting all users', err);
    throw err;
  }
}

/**
 * Create a new user
 */
async function createUser(userData) {
  const { name, email, password_hash, role } = userData;
  
  // Handle UUID generation differently for SQLite vs PostgreSQL
  const query = dbClient.createPortableQuery({
    sqlite: `
      INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) 
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, datetime('now'), datetime('now'))
    `,
    postgres: `
      INSERT INTO users (name, email, password_hash, role, created_at, updated_at) 
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `
  });
  
  try {
    if (dbClient.getDatabaseType() === 'postgres') {
      // PostgreSQL returns the inserted row
      const result = await dbClient.queryOne(query, [name, email, password_hash, role]);
      return result;
    } else {
      // SQLite: Insert then fetch the user
      const result = await dbClient.query(query, [name, email, password_hash, role]);
      return await getUserById(result.lastID);
    }
  } catch (err) {
    logger.error('Error creating user', err);
    throw err;
  }
}

/**
 * Update a user's information
 */
async function updateUser(id, updates) {
  // Build the update query dynamically based on provided fields
  const allowedFields = ['name', 'email', 'role', 'preferences'];
  const updateFields = Object.keys(updates).filter(field => 
    allowedFields.includes(field) && updates[field] !== undefined
  );
  
  if (updateFields.length === 0) {
    return await getUserById(id);
  }
  
  // Create SET clause based on database type
  let setClause, queryParams;
  
  if (dbClient.getDatabaseType() === 'postgres') {
    setClause = updateFields
      .map((field, index) => `${field} = $${index + 1}`)
      .join(', ');
    
    // Add updated_at field
    setClause += `, updated_at = NOW()`;
    
    // Create parameter array with values in the correct order
    queryParams = updateFields.map(field => updates[field]);
    queryParams.push(id); // Add ID as the last parameter
    
    const query = `UPDATE users SET ${setClause} WHERE id = $${queryParams.length} RETURNING *`;
    return await dbClient.queryOne(query, queryParams);
  } else {
    setClause = updateFields
      .map(field => `${field} = ?`)
      .join(', ');
    
    // Add updated_at field
    setClause += `, updated_at = datetime('now')`;
    
    // Create parameter array with values in the correct order
    queryParams = updateFields.map(field => updates[field]);
    queryParams.push(id); // Add ID as the last parameter
    
    const query = `UPDATE users SET ${setClause} WHERE id = ?`;
    await dbClient.query(query, queryParams);
    return await getUserById(id);
  }
}

/**
 * Delete a user
 */
async function deleteUser(id) {
  const query = dbClient.createPortableQuery({
    sqlite: 'DELETE FROM users WHERE id = ?',
    postgres: 'DELETE FROM users WHERE id = $1'
  });
  
  try {
    const result = await dbClient.query(query, [id]);
    return result.rowCount > 0;
  } catch (err) {
    logger.error(`Error deleting user: ${id}`, err);
    throw err;
  }
}

module.exports = {
  getUserById,
  getUserByEmail,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser
};
