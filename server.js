const express = require('express');
const sql = require('mssql/msnodesqlv8');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

const app = express();
app.use(cors({
  origin: 'http://localhost:4200',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());


// OAUTH 2.0 CONFIGURATION 
const JWT_SECRET = 'CypanArc@gmail.com';
const checkJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.auth = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Failed to authenticate token', error: error.message });
  }
};


//MSSQL DATABASE CONFIGURATION
const dbConfig = {
  connectionString: 'Driver={SQL Server};Server=CYPANARC\\CYPANARC;Database=CRUDUser;Trusted_Connection=yes;',
  server: 'localhost',
  options: {
    trustedConnection: true,
    trustServerCertificate: true
  }
};


// CONNECT TO SQL SERVER
async function getDatabaseConnection() {
  try {
    const pool = await sql.connect(dbConfig);
    return pool;
  } catch (error) {
    console.error('❌ SQL Engine Connection Error:', error.message);
    throw error;
  }
}

// GENERATE TOKEN
app.post('/api/GenerateToken', async (req, res) => {
  try {
    const { username, password } = req.body;

    const payload = {
      username: "CypanArc@gmail.com",
      role: 'admin'
    };

    if (password == "@CypanArc7227") {
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '10m' });
      res.json({ access_token: token });
    }
    else {
      res.status(500).json({ message: 'Invalid Credentials' });
    }
  } catch (error) {
    if (error.message == "Cannot destructure property 'username' of 'req.body' as it is undefined.") {
      res.status(500).json({ message: 'Invalid Credentials' });
    }
    else {
      res.status(500).json({ message: 'Error fetching records from SQL', error: error.message });
    }
  }
});

// VIEW ALL USERS
app.get('/api/viewusers', checkJwt, async (req, res) => {
  try {
    const pool = await getDatabaseConnection();
    const result = await pool.request().query('SELECT id, FirstName, MiddleName, LastName FROM Users ORDER BY id ASC');
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching records from SQL', error: error.message });
  }
});

// CREATE NEW USER
app.post('/api/adduser', checkJwt, async (req, res) => {
  try {
    const { FirstName, MiddleName, LastName } = req.body;
    const pool = await getDatabaseConnection();
    const result = await pool.request()
      .input('FirstName', sql.VarChar(100), FirstName)
      .input('MiddleName', sql.VarChar(100), MiddleName || '')
      .input('LastName', sql.VarChar(100), LastName)
      .query(`
        INSERT INTO Users (FirstName, MiddleName, LastName)
        OUTPUT inserted.FirstName, inserted.MiddleName, inserted.LastName
        VALUES (@FirstName, @MiddleName, @LastName)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    res.status(400).json({ message: 'Failed to insert account record', error: error.message });
  }
});

// EDIT USER
app.put('/api/edituser/:id', checkJwt, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const { FirstName, MiddleName, LastName } = req.body;
    if (isNaN(targetId)) {
      return res.status(400).json({ message: 'Invalid dynamic route parameter target ID.' });
    }
    const pool = await getDatabaseConnection();
    const result = await pool.request()
      .input('targetId', sql.Int, targetId)
      .input('FirstName', sql.VarChar(100), FirstName)
      .input('MiddleName', sql.VarChar(100), MiddleName || '')
      .input('LastName', sql.VarChar(100), LastName)
      .query(`
        UPDATE Users 
        SET FirstName = @FirstName, MiddleName = @MiddleName, LastName = @LastName
        OUTPUT inserted.id, inserted.FirstName, inserted.MiddleName, inserted.LastName
        WHERE id = @targetId
      `);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ message: 'User record not found to update inside active database storage.' });
    }

    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(400).json({ message: 'Update processing error operation runtime conflict', error: error.message });
  }
});

//DELETE USER
app.delete('/api/deleteuser/:id', checkJwt, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const pool = await getDatabaseConnection();

    const result = await pool.request()
      .input('id', sql.Int, targetId)
      .query('DELETE FROM Users WHERE id = @id');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Record cannot be found to delete' });
    }

    res.status(200).json({ message: `Successfully purged user record key ID #${targetId}` });
  } catch (error) {
    res.status(500).json({ message: 'Deletion execution error', error: error.message });
  }
});

//SETUP PORT
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Node.js Backend API running live on: http://localhost:${PORT}`);
});
