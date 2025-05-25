const pool=require("../db")

exports.createCategory=async(req,res)=>{
    const {categoryName,createdById}=req.body

    try {
        const result=await pool.query(
            'INSERT INTO product_categories (categoryName,createdById) Values ($1,$2) RETURNING *',
            [categoryName,createdById]
        );
        res.status(201).json(result.rows[0])
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

exports.getAllCategories=async(req,res)=>{
    try {
        const result=await pool.query('SELECT * FROM product_categories');
        res.status(200).json(result.rows)
    } catch (error) {
        console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
    }
}

exports.getCategoryById=async(req,res)=>{
    const {id}=req.params;
    try {
        const result=await pool.query(
            'SELECT * FROM product_categories WHERE id=$1',
            [id]
        )
        if (result.rows.length===0) {
            return res.status(404).json({error:'Category Not Found'})
        }
        res.status(200).json(result.rows[0])
    } catch (error) {
        console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Internal server error' });
    }
}

exports.updateCategory=async(req,res)=>{
    const {id}=req.params
    const {categoryName}=req.body

    try {
        const result=await pool.query(
            'UPDATE product_categories SET categoryName=$1 WHERE id=$2 RETURNING*',
            [categoryName,id]
        );
        if (result.rows.length===0) {
            return res.status(404).json({error:"Category Not Found"})
        }
        res.status(200).json(result.rows[0])
    } catch (error) {
        console.error('Error updating category:', error);
    res.status(500).json({ error: 'Internal server error' });
    }
}

exports.deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM product_categories WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};