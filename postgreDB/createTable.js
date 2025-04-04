
const createTable = async (clientPg)=>{
  const createTableQuery = `CREATE TABLE IF NOT EXISTS users(
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`;

  try {
    await clientPg.query(createTableQuery);
    console.log('Table created successfuly!')
  } catch (error) {
    console.log('Error creating table', error.message)
  }
};

module.exports = createTable;