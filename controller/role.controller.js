      // const { initializePool } = require('../db');
      const { pool } = require('../db');


      exports.createRole = async (req, res) => {
        const { name, permissions } = req.body;
        try {
          // const pool = await initializePool();
          const client = await pool.connect();
          try {
            const existing = await client.query('SELECT 1 FROM roles WHERE name = $1', [name]);
            if (existing.rows.length > 0) {
              return res.status(400).json({ error: `Role with name "${name}" already exists` });
            }
            const result = await client.query(
              'INSERT INTO roles (id, name, permissions) VALUES (gen_random_uuid(), $1, $2) RETURNING *',
              [name, permissions || {}]
            );
            res.status(201).json(result.rows[0]);
          } finally {
            client.release();
          }
        } catch (err) {
          console.error('Create Role Error:', err);
          res.status(500).json({ error: err.message });
        }
      };

      exports.getAllRoles = async (req, res) => {
        try {
          // const pool = await initializePool();
          const client = await pool.connect();
          try {
            const result = await client.query('SELECT * FROM roles');
            res.json(result.rows);
          } finally {
            client.release();
          }
        } catch (err) {
          console.error('Get All Roles Error:', err);
          res.status(500).json({ error: err.message });
        }
      };

      exports.getRoleById = async (req, res) => {
        const { id } = req.params;
        try {
          // const pool = await initializePool();
          const client = await pool.connect();
          try {
            const result = await client.query('SELECT * FROM roles WHERE id = $1', [id]);
            if (!result.rows.length) return res.status(404).json({ message: 'Role not found' });
            res.json(result.rows[0]);
          } finally {
            client.release();
          }
        } catch (err) {
          console.error('Get Role Error:', err);
          res.status(500).json({ error: err.message });
        }
      };

      exports.updateRole = async (req, res) => {
        const { id } = req.params;
        const { name, permissions } = req.body;
        try {
          // const pool = await initializePool();
          const client = await pool.connect();
          try {
            const result = await client.query(
              'UPDATE roles SET name = $1, permissions = $2 WHERE id = $3 RETURNING *',
              [name, permissions, id]
            );
            if (!result.rows.length) return res.status(404).json({ message: 'Role not found' });
            res.json(result.rows[0]);
          } finally {
            client.release();
          }
        } catch (err) {
          console.error('Update Role Error:', err);
          res.status(500).json({ error: err.message });
        }
      };

      exports.deleteRole = async (req, res) => {
        const { id } = req.params;
        try {
          // const pool = await initializePool();
          const client = await pool.connect();
          try {
            const result = await client.query('DELETE FROM roles WHERE id = $1 RETURNING *', [id]);
            if (!result.rows.length) return res.status(404).json({ message: 'Role not found' });
            res.json({ message: 'Role deleted successfully' });
          } finally {
            client.release();
          }
        } catch (err) {
          console.error('Delete Role Error:', err);
          res.status(500).json({ error: err.message });
        }
      };